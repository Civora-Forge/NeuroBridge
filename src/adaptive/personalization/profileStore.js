/**
 * profileStore.js — Persistence & synchronisation of the personalization
 * profile (Task 5)
 *
 * Architecture (reuses what the app already has — no new infrastructure):
 *
 *   local   — the Role 4 localStorage namespace
 *             (`getRole4StorageKey(userId, "adaptive_profile")`), with the
 *             Task 4 in-memory fallback when storage is unavailable. This is
 *             the offline copy and the only store for demo / signed-out
 *             users. Sign-out wipes it with every other `nb_*` key.
 *   remote  — one row per authenticated Supabase user in
 *             `public.support_personalization_profiles` (RLS: a user can only
 *             read/write their own row; cascade-deleted with the account).
 *             Used only when the live Supabase session belongs to the same
 *             user — the same rule getRole4Repository() applies.
 *
 * Sync protocol: every write lands locally first (marked `pending`), then
 * the store fetches the remote row, merges field-by-field (mergeProfiles),
 * and writes back with optimistic concurrency (`update ... where revision =
 * <the revision just read>`). A concurrent write from another device makes
 * that update match zero rows → re-fetch, re-merge, retry. Network failures
 * keep the local copy `pending`; it is pushed on the next load / `online`
 * event. A missing table (migration not applied) degrades to local-only.
 *
 * Temporary contextual state ("for now" choices) is kept in memory only and
 * is never written to either store.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { supabase } from "@/lib/supabaseClient";
import { getRole4StorageKey, ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";
import {
  clearAdaptationLearning,
  createMemoryStorage,
  getAdaptationFeedback,
} from "@/adaptive/learning/adaptationLearning";
import {
  clearExplicitPreference as clearExplicitInModel,
  createProfile,
  forgetLearnedPreference as forgetInModel,
  mergeProfiles,
  promoteLearnedPreferences,
  resetLearnedPersonalization as resetLearnedInModel,
  resetProfile as resetProfileInModel,
  sameProfileContent,
  sanitizeProfile,
  setExplicitPreference as setExplicitInModel,
  summarizeFeedbackForProfile,
  undoLastChange as undoInModel,
} from "./profileModel.js";
import { PREFERENCE_DIMENSIONS, isModuleId } from "./profileVocabulary.js";

export const PROFILE_TABLE = "support_personalization_profiles";

export const SyncStatus = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  SYNCING: "syncing",
  /** Saved locally and in the user's account. */
  SYNCED: "synced",
  /** No account sync for this user (demo / signed out / sync unavailable). */
  LOCAL_ONLY: "local_only",
  /** Account sync failed; local copy is pending and will be retried. */
  OFFLINE: "offline",
});

const MAX_SYNC_ATTEMPTS = 3;
const TEMPORARY_TTL_MS = 4 * 60 * 60 * 1000;
/** PostgREST / Postgres codes meaning "the table is not there". */
const UNAVAILABLE_CODES = new Set(["42P01", "PGRST205", "PGRST204", "PGRST106"]);

// ─────────────────────────────────────────────────────────────────
//  Adapters
// ─────────────────────────────────────────────────────────────────

const memoryFallback = createMemoryStorage();

function defaultStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch {
    // Access can throw in privacy modes / sandboxed frames.
  }
  return memoryFallback;
}

/** Local copy: `{ profile, pending }` under the Role 4 namespace. */
export function createLocalProfileStorage(storage) {
  const target = () => storage ?? defaultStorage();
  const key = (userId) => getRole4StorageKey(userId, ROLE4_COLLECTIONS.ADAPTIVE_PROFILE);
  return {
    read(userId) {
      for (const source of [target(), memoryFallback]) {
        try {
          const raw = source.getItem(key(userId));
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          // clearUserRole4Data() writes `[]` into every Role 4 collection.
          if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return null;
          return { profile: sanitizeProfile(parsed.profile, userId), pending: parsed.pending === true };
        } catch {
          // fall through to the memory fallback
        }
      }
      return null;
    },
    write(userId, record) {
      const payload = JSON.stringify({ profile: record.profile, pending: record.pending === true });
      try {
        target().setItem(key(userId), payload);
      } catch {
        memoryFallback.setItem(key(userId), payload);
      }
    },
    remove(userId) {
      for (const source of [target(), memoryFallback]) {
        try {
          source.removeItem(key(userId));
        } catch {
          // ignore
        }
      }
    },
  };
}

class RemoteUnavailableError extends Error {}

function remoteError(error) {
  if (error && UNAVAILABLE_CODES.has(error.code)) return new RemoteUnavailableError(error.message);
  return new Error(`Personalization sync failed: ${error?.message ?? "unknown error"}`);
}

/** Supabase row adapter (RLS-scoped to the signed-in user). */
export function createSupabaseProfileRemote(client, userId) {
  const table = () => client.from(PROFILE_TABLE);
  const row = (profile) => ({
    user_id: userId,
    profile,
    revision: profile.revision,
    updated_at: new Date(profile.updatedAt).toISOString(),
  });
  return {
    kind: "supabase",
    async fetch() {
      const { data, error } = await table().select("profile, revision").eq("user_id", userId).maybeSingle();
      if (error) throw remoteError(error);
      return data ? { profile: data.profile, revision: Number(data.revision) || 0 } : null;
    },
    async save(profile, expectedRevision) {
      if (expectedRevision === null) {
        const { error } = await table().insert(row(profile));
        if (error?.code === "23505") return { conflict: true }; // created concurrently
        if (error) throw remoteError(error);
        return { conflict: false };
      }
      const { data, error } = await table()
        .update(row(profile))
        .eq("user_id", userId)
        .eq("revision", expectedRevision)
        .select("revision");
      if (error) throw remoteError(error);
      return { conflict: !Array.isArray(data) || data.length === 0 };
    },
    async remove() {
      const { error } = await table().delete().eq("user_id", userId);
      if (error) throw remoteError(error);
    },
  };
}

/** Default auth watcher: Supabase session changes → signed-in user id. */
function defaultSubscribeAuth(callback) {
  try {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user?.id ?? null));
    return () => data?.subscription?.unsubscribe?.();
  } catch {
    return () => {};
  }
}

async function defaultResolveRemote(userId) {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.user?.id || data.session.user.id !== userId) return null;
    return createSupabaseProfileRemote(supabase, userId);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
//  Store state
// ─────────────────────────────────────────────────────────────────

let config = {
  local: createLocalProfileStorage(),
  resolveRemote: defaultResolveRemote,
  subscribeAuth: defaultSubscribeAuth,
  now: () => Date.now(),
};
/** In-flight loads, so concurrent mounts share one fetch (Task 6). */
const loadsInFlight = new Map();
const states = new Map();
const listeners = new Map();
const queues = new Map();
const temporaryByUser = new Map();
/** Users whose remote table is unavailable this session. */
const unavailableRemote = new Set();

/**
 * Inject persistence adapters (tests / alternative backends). Omitted keys
 * keep their current value.
 */
export function configurePersonalizationPersistence(overrides = {}) {
  config = {
    local: overrides.local ?? config.local,
    resolveRemote: overrides.resolveRemote ?? config.resolveRemote,
    subscribeAuth: overrides.subscribeAuth ?? config.subscribeAuth,
    now: overrides.now ?? config.now,
  };
}

/** Forget all in-memory state and restore default adapters (tests). */
export function resetPersonalizationStore() {
  states.clear();
  listeners.clear();
  queues.clear();
  temporaryByUser.clear();
  unavailableRemote.clear();
  loadsInFlight.clear();
  config = {
    local: createLocalProfileStorage(),
    resolveRemote: defaultResolveRemote,
    subscribeAuth: defaultSubscribeAuth,
    now: () => Date.now(),
  };
}

/**
 * Sign-out boundary (Task 6): drop every in-memory profile and temporary
 * state while keeping the configured adapters. Local copies are removed by
 * the app-wide sign-out wipe (`nb_*` keys).
 */
export function clearPersonalizationSession() {
  const users = [...states.keys()];
  states.clear();
  temporaryByUser.clear();
  unavailableRemote.clear();
  loadsInFlight.clear();
  for (const userId of users) {
    for (const listener of listeners.get(userId) ?? []) listener();
  }
}

/**
 * Re-sync when the user's account session (re)appears — e.g. after an
 * expired session is refreshed — if local changes are still pending.
 * Returns an unsubscribe function.
 */
export function watchAuthForSync(userId) {
  if (!userId || typeof config.subscribeAuth !== "function") return () => {};
  return config.subscribeAuth((sessionUserId) => {
    if (sessionUserId === userId && getProfileSnapshot(userId).pending) syncProfile(userId);
  });
}

const IDLE_SNAPSHOT = Object.freeze({ profile: null, status: SyncStatus.IDLE, pending: false, temporary: null, error: null });

function setState(userId, patch) {
  const previous = states.get(userId) ?? IDLE_SNAPSHOT;
  const next = Object.freeze({ ...previous, ...patch });
  states.set(userId, next);
  for (const listener of listeners.get(userId) ?? []) listener();
  return next;
}

export function getProfileSnapshot(userId) {
  return (userId && states.get(userId)) || IDLE_SNAPSHOT;
}

export function subscribeProfile(userId, listener) {
  if (!userId) return () => {};
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId).add(listener);
  return () => listeners.get(userId)?.delete(listener);
}

/** Serialize operations per user so concurrent writes never clobber. */
function enqueue(userId, operation) {
  const previous = queues.get(userId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(operation);
  queues.set(userId, run.catch(() => {}));
  return run;
}

function ensureLocalState(userId) {
  const current = states.get(userId);
  if (current?.profile) return current;
  const local = config.local.read(userId);
  return setState(userId, {
    profile: local?.profile ?? createProfile(userId, config.now()),
    pending: local?.pending ?? false,
    temporary: temporaryByUser.get(userId) ?? null,
  });
}

async function remoteFor(userId) {
  if (unavailableRemote.has(userId)) return null;
  try {
    return await config.resolveRemote(userId);
  } catch {
    return null;
  }
}

function settleLocal(userId, profile, { pending, status, error = null }) {
  config.local.write(userId, { profile, pending });
  return setState(userId, { profile, pending, status, error });
}

/**
 * Reconcile `profile` with the user's remote row: fetch → merge → conditional
 * write, retrying on concurrent updates. Never throws; reports via status.
 */
async function reconcile(userId, profile, { changed = false } = {}) {
  const remote = await remoteFor(userId);
  if (!remote) {
    // No account session (demo, signed out, or an expired session). A change
    // made now stays pending so it is pushed once the session returns.
    const pending = changed || getProfileSnapshot(userId).pending === true;
    return settleLocal(userId, profile, { pending, status: SyncStatus.LOCAL_ONLY });
  }
  setState(userId, { status: SyncStatus.SYNCING });
  let working = profile;
  for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
    try {
      const record = await remote.fetch();
      const remoteProfile = record ? sanitizeProfile(record.profile, userId, config.now()) : null;
      const remoteRevision = record ? record.revision : null;
      const merged = mergeProfiles(working, remoteProfile);
      if (remoteProfile && sameProfileContent(merged, remoteProfile)) {
        // Remote already holds everything we know; adopt its revision.
        return settleLocal(userId, { ...merged, revision: remoteRevision }, { pending: false, status: SyncStatus.SYNCED });
      }
      const candidate = { ...merged, revision: Math.max(merged.revision, remoteRevision ?? 0) + 1 };
      const result = await remote.save(candidate, remoteRevision);
      if (result?.conflict) {
        working = candidate; // another device wrote in between: merge again
        continue;
      }
      return settleLocal(userId, candidate, { pending: false, status: SyncStatus.SYNCED });
    } catch (error) {
      if (error instanceof RemoteUnavailableError) {
        unavailableRemote.add(userId);
        return settleLocal(userId, working, { pending: false, status: SyncStatus.LOCAL_ONLY });
      }
      return settleLocal(userId, working, { pending: true, status: SyncStatus.OFFLINE, error: error.message });
    }
  }
  return settleLocal(userId, working, { pending: true, status: SyncStatus.OFFLINE, error: "sync_conflict_retry" });
}

// ─────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────

/** Load (local first, then reconcile with the account copy). */
export function loadProfile(userId) {
  if (!userId) return Promise.resolve(IDLE_SNAPSHOT);
  if (loadsInFlight.has(userId)) return loadsInFlight.get(userId);
  const run = enqueue(userId, async () => {
    const state = ensureLocalState(userId);
    setState(userId, { status: SyncStatus.LOADING });
    return reconcile(userId, state.profile);
  }).finally(() => loadsInFlight.delete(userId));
  loadsInFlight.set(userId, run);
  return run;
}

/** Push any pending local changes (e.g. when the device comes back online). */
export function syncProfile(userId) {
  return loadProfile(userId);
}

function mutate(userId, change) {
  if (!userId) return Promise.reject(new Error("A signed-in user is required"));
  return enqueue(userId, async () => {
    const state = ensureLocalState(userId);
    const changed = change(state.profile, config.now());
    if (changed === state.profile) return state;
    const next = { ...changed, revision: state.profile.revision + 1 };
    // Local first: the change survives even if the account sync fails.
    settleLocal(userId, next, { pending: true, status: SyncStatus.SYNCING });
    return reconcile(userId, next, { changed: true });
  });
}

/** Explicit user action: set one preference (`moduleId` for a context). */
export function setExplicitPreference(userId, field, value, { moduleId } = {}) {
  return mutate(userId, (profile, now) => setExplicitInModel(profile, field, value, { moduleId, now }));
}

export function clearExplicitPreference(userId, field, { moduleId } = {}) {
  return mutate(userId, (profile, now) => clearExplicitInModel(profile, field, { moduleId, now }));
}

export function forgetLearnedPreference(userId, key, { moduleId } = {}) {
  return mutate(userId, (profile, now) => forgetInModel(profile, key, { moduleId, now }));
}

export function undoLastProfileChange(userId) {
  return mutate(userId, (profile, now) => undoInModel(profile, { now }));
}

/** Reset learned personalization (and this device's Task 4 history). */
export function resetLearnedPersonalization(userId) {
  clearAdaptationLearning(userId);
  return mutate(userId, (profile, now) => resetLearnedInModel(profile, { now }));
}

/** Reset the whole profile; synced so other devices drop it too. */
export function resetPersonalizationProfile(userId) {
  clearAdaptationLearning(userId);
  clearTemporaryPreferences(userId);
  return mutate(userId, (profile, now) => resetProfileInModel(profile, { now }));
}

/**
 * Promote sufficiently reliable Task 4 learning into the profile. Cheap
 * no-op (no write, no sync) when nothing qualifies or changes.
 */
export function promoteFromFeedback(userId) {
  return mutate(userId, (profile, now) => {
    const summaries = summarizeFeedbackForProfile(profile, getAdaptationFeedback(userId), { now });
    return promoteLearnedPreferences(profile, summaries, { now }).profile;
  });
}

/**
 * Privacy deletion: remove the account row and every local trace (profile,
 * Task 4 history, temporary state). Unlike a reset, nothing is kept — not
 * even reset barriers. Throws if the account row could not be deleted.
 */
export function deletePersonalizationData(userId) {
  if (!userId) return Promise.resolve();
  return enqueue(userId, async () => {
    const remote = await remoteFor(userId);
    try {
      if (remote) await remote.remove();
    } finally {
      config.local.remove(userId);
      clearAdaptationLearning(userId);
      temporaryByUser.delete(userId);
      states.delete(userId);
      for (const listener of listeners.get(userId) ?? []) listener();
    }
  });
}

// ─────────────────────────────────────────────────────────────────
//  Temporary contextual state (memory only, never persisted)
// ─────────────────────────────────────────────────────────────────

/**
 * A "for now" choice (e.g. reduced motion for this session). Dimensions only;
 * expires after `ttlMs` and on reload/sign-out. Outranks the stable
 * preference while active but is never written to the profile.
 */
export function setTemporaryPreference(userId, field, value, { moduleId, ttlMs = TEMPORARY_TTL_MS } = {}) {
  if (!userId) return;
  if (!Object.prototype.hasOwnProperty.call(PREFERENCE_DIMENSIONS, field)) {
    throw new TypeError(`Temporary state supports presentation dimensions only: ${field}`);
  }
  if (value !== null && !Object.prototype.hasOwnProperty.call(PREFERENCE_DIMENSIONS[field].values, value)) {
    throw new TypeError(`Invalid value for ${field}`);
  }
  const current = temporaryByUser.get(userId) ?? { global: {}, contexts: {} };
  const next = { global: { ...current.global }, contexts: { ...current.contexts } };
  const entry = { value, expiresAt: config.now() + ttlMs };
  if (moduleId && isModuleId(moduleId)) {
    next.contexts[moduleId] = { ...(next.contexts[moduleId] ?? {}), [field]: entry };
  } else {
    next.global[field] = entry;
  }
  temporaryByUser.set(userId, next);
  setState(userId, { temporary: next });
}

export function clearTemporaryPreferences(userId) {
  if (!userId || !temporaryByUser.has(userId)) return;
  temporaryByUser.delete(userId);
  setState(userId, { temporary: null });
}

/**
 * profileStore.test.js — Task 5 persistence, offline fallback and
 * cross-device synchronisation.
 *
 * The remote is the REAL Supabase adapter (createSupabaseProfileRemote) on a
 * fake PostgREST client that enforces the same conditional-update semantics
 * the migration relies on. "Devices" are separate local storages sharing one
 * remote table; switching device resets the in-memory store.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SyncStatus,
  configurePersonalizationPersistence,
  createLocalProfileStorage,
  createSupabaseProfileRemote,
  deletePersonalizationData,
  forgetLearnedPreference,
  getProfileSnapshot,
  loadProfile,
  promoteFromFeedback,
  resetLearnedPersonalization,
  resetPersonalizationProfile,
  resetPersonalizationStore,
  setExplicitPreference,
  setTemporaryPreference,
  syncProfile,
} from "../profileStore.js";
import { PROFILE_CONFIG, resolveProfileView } from "../profileModel.js";
import {
  createMemoryStorage,
  getAdaptationFeedback,
  recordAdaptationFeedback,
  setLearningStorage,
} from "@/adaptive/learning/adaptationLearning";
import { clearUserRole4Data } from "@/support/persistence/role4Store";
import { getRole4StorageKey, ROLE4_COLLECTIONS } from "@/support/schemas/storageKeys";

const USER = "8a6f9a3e-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────
//  Fake Supabase (one table, RLS emulated by user_id)
// ─────────────────────────────────────────────────────────────────

function createFakeSupabase({ sessionUserId = USER } = {}) {
  const rows = new Map();
  const state = { offline: false, missingTable: false, beforeUpdate: null, writes: 0 };
  const fail = () => {
    if (state.missingTable) return { code: "42P01", message: "relation does not exist" };
    if (state.offline) throw new TypeError("Failed to fetch");
    return null;
  };
  const authorized = (userId) => userId === sessionUserId;
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: sessionUserId } } }, error: null }) },
    from(table) {
      expect(table).toBe("support_personalization_profiles");
      return {
        select() {
          const filters = {};
          const query = {
            eq(column, value) {
              filters[column] = value;
              return query;
            },
            async maybeSingle() {
              const error = fail();
              if (error) return { data: null, error };
              const row = authorized(filters.user_id) ? rows.get(filters.user_id) : undefined;
              return { data: row ? JSON.parse(JSON.stringify(row)) : null, error: null };
            },
          };
          return query;
        },
        async insert(row) {
          const error = fail();
          if (error) return { error };
          if (!authorized(row.user_id)) return { error: { code: "42501", message: "rls" } };
          if (rows.has(row.user_id)) return { error: { code: "23505", message: "duplicate key" } };
          rows.set(row.user_id, JSON.parse(JSON.stringify(row)));
          state.writes += 1;
          return { error: null };
        },
        update(row) {
          const filters = {};
          const query = {
            eq(column, value) {
              filters[column] = value;
              return query;
            },
            async select() {
              const error = fail();
              if (error) return { data: null, error };
              if (state.beforeUpdate) {
                const hook = state.beforeUpdate;
                state.beforeUpdate = null;
                await hook();
              }
              const current = rows.get(filters.user_id);
              if (!authorized(filters.user_id) || !current || current.revision !== filters.revision) {
                return { data: [], error: null };
              }
              rows.set(filters.user_id, JSON.parse(JSON.stringify(row)));
              state.writes += 1;
              return { data: [{ revision: row.revision }], error: null };
            },
          };
          return query;
        },
        delete() {
          return {
            async eq(_column, value) {
              const error = fail();
              if (error) return { error };
              if (authorized(value)) rows.delete(value);
              return { error: null };
            },
          };
        },
      };
    },
  };
  return { client, rows, state };
}

let clock = NOW;
let fake;
const devices = {};

function useDevice(name, { remote = true } = {}) {
  resetPersonalizationStore();
  if (!devices[name]) devices[name] = createMemoryStorage();
  configurePersonalizationPersistence({
    local: createLocalProfileStorage(devices[name]),
    resolveRemote: async (userId) => (remote ? createSupabaseProfileRemote(fake.client, userId) : null),
    now: () => clock,
  });
}
const view = (options) => resolveProfileView(getProfileSnapshot(USER).profile, { now: clock, ...options });
const remoteProfile = () => fake.rows.get(USER)?.profile;

beforeEach(() => {
  clock = NOW;
  fake = createFakeSupabase();
  for (const key of Object.keys(devices)) delete devices[key];
  setLearningStorage(createMemoryStorage());
});
afterEach(() => {
  resetPersonalizationStore();
  setLearningStorage(null);
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────

describe("creation, retrieval and session persistence", () => {
  it("creates a profile on first load and persists it per user", async () => {
    useDevice("laptop");
    await loadProfile(USER);
    expect(getProfileSnapshot(USER)).toMatchObject({ status: SyncStatus.SYNCED, pending: false });
    expect(getProfileSnapshot(USER).profile.userId).toBe(USER);
    expect(fake.rows.get(USER)).toMatchObject({ user_id: USER });
  });

  it("survives a new session (reload) on the same device", async () => {
    useDevice("laptop");
    await setExplicitPreference(USER, "guidancePace", "slow");
    useDevice("laptop", { remote: false }); // new session, offline account
    await loadProfile(USER);
    expect(view().preferences.guidancePace.value).toBe("slow");
    expect(getProfileSnapshot(USER).status).toBe(SyncStatus.LOCAL_ONLY);
  });

  it("is stored in the Role 4 namespace and tolerates the Role 4 privacy reset", async () => {
    useDevice("laptop", { remote: false });
    configurePersonalizationPersistence({ local: createLocalProfileStorage(localStorage) });
    await setExplicitPreference(USER, "motion", "reduced");
    const key = getRole4StorageKey(USER, ROLE4_COLLECTIONS.ADAPTIVE_PROFILE);
    expect(JSON.parse(localStorage.getItem(key)).profile.explicit.global.motion.value).toBe("reduced");
    clearUserRole4Data(USER);
    useDevice("other", { remote: false });
    configurePersonalizationPersistence({ local: createLocalProfileStorage(localStorage) });
    await loadProfile(USER);
    expect(view().preferences).toEqual({});
  });
});

describe("cross-device synchronisation", () => {
  it("a preference set on one device is available on another", async () => {
    useDevice("laptop");
    await setExplicitPreference(USER, "explanationLength", "short");
    await setExplicitPreference(USER, "mode:calm_visuals", "avoided", { moduleId: "dyslexia.reader" });
    useDevice("phone");
    await loadProfile(USER);
    expect(view().preferences.explanationLength.value).toBe("short");
    expect(view({ moduleId: "dyslexia.reader" }).supportModes.avoided).toEqual([{ mode: "calm_visuals", scope: "context" }]);
  });

  it("merges concurrent edits from two devices field by field", async () => {
    useDevice("laptop");
    await loadProfile(USER);
    useDevice("phone");
    await loadProfile(USER);
    // Laptop writes while the phone is between its fetch and its write.
    fake.state.beforeUpdate = async () => {
      const row = fake.rows.get(USER);
      const laptopProfile = JSON.parse(JSON.stringify(row.profile));
      laptopProfile.explicit.global.motion = { value: "reduced", setAt: clock - 1 };
      laptopProfile.revision = row.revision + 1;
      fake.rows.set(USER, { ...row, profile: laptopProfile, revision: row.revision + 1 });
    };
    clock += 1000;
    await setExplicitPreference(USER, "guidancePace", "brisk");
    expect(getProfileSnapshot(USER).status).toBe(SyncStatus.SYNCED);
    const merged = resolveProfileView(remoteProfile(), { now: clock });
    expect(merged.preferences).toMatchObject({ motion: { value: "reduced" }, guidancePace: { value: "brisk" } });
    expect(view().preferences.motion.value).toBe("reduced");
  });

  it("the newest edit of the same preference wins on every device", async () => {
    useDevice("laptop");
    await setExplicitPreference(USER, "guidancePace", "slow");
    useDevice("phone");
    await loadProfile(USER);
    clock += 1000;
    await setExplicitPreference(USER, "guidancePace", "brisk");
    useDevice("laptop");
    await loadProfile(USER);
    expect(view().preferences.guidancePace.value).toBe("brisk");
  });

  it("a reset on one device is not undone by stale data on another", async () => {
    useDevice("phone");
    await setExplicitPreference(USER, "guidancePace", "slow");
    useDevice("laptop");
    await loadProfile(USER);
    clock += DAY;
    await resetPersonalizationProfile(USER);
    // The phone still has the old preference locally and reconnects.
    useDevice("phone");
    await loadProfile(USER);
    expect(view().preferences).toEqual({});
    expect(resolveProfileView(remoteProfile(), { now: clock }).preferences).toEqual({});
  });
});

describe("offline fallback", () => {
  it("keeps changes locally while offline and pushes them when back online", async () => {
    useDevice("laptop");
    await loadProfile(USER);
    fake.state.offline = true;
    await setExplicitPreference(USER, "notificationLevel", "essential");
    expect(getProfileSnapshot(USER)).toMatchObject({ status: SyncStatus.OFFLINE, pending: true });
    expect(view().preferences.notificationLevel.value).toBe("essential");
    expect(resolveProfileView(remoteProfile(), { now: clock }).preferences).toEqual({});
    fake.state.offline = false;
    await syncProfile(USER);
    expect(getProfileSnapshot(USER)).toMatchObject({ status: SyncStatus.SYNCED, pending: false });
    expect(resolveProfileView(remoteProfile(), { now: clock }).preferences.notificationLevel.value).toBe("essential");
  });

  it("pending offline edits survive a reload and merge with remote edits made meanwhile", async () => {
    useDevice("laptop");
    await loadProfile(USER);
    fake.state.offline = true;
    await setExplicitPreference(USER, "motion", "reduced");
    fake.state.offline = false;
    useDevice("phone");
    clock += 1000;
    await setExplicitPreference(USER, "guidancePace", "slow");
    useDevice("laptop"); // reload; pending local change still there
    await loadProfile(USER);
    expect(view().preferences).toMatchObject({ motion: { value: "reduced" }, guidancePace: { value: "slow" } });
    expect(resolveProfileView(remoteProfile(), { now: clock }).preferences.motion.value).toBe("reduced");
  });

  it("degrades to local-only when the account table is unavailable or the user is not signed in", async () => {
    fake.state.missingTable = true;
    useDevice("laptop");
    await setExplicitPreference(USER, "motion", "reduced");
    expect(getProfileSnapshot(USER)).toMatchObject({ status: SyncStatus.LOCAL_ONLY, pending: false });
    expect(view().preferences.motion.value).toBe("reduced");

    fake = createFakeSupabase({ sessionUserId: "someone-else" });
    useDevice("demo");
    configurePersonalizationPersistence({ resolveRemote: async () => null });
    await setExplicitPreference("demo:nb-user-042:abc", "motion", "reduced");
    expect(getProfileSnapshot("demo:nb-user-042:abc").status).toBe(SyncStatus.LOCAL_ONLY);
    expect(fake.rows.size).toBe(0);
  });

  it("RLS: a session for another user cannot read or write this user's row", async () => {
    fake = createFakeSupabase({ sessionUserId: "attacker" });
    useDevice("laptop");
    await setExplicitPreference(USER, "motion", "reduced");
    expect(fake.rows.size).toBe(0);
    expect(getProfileSnapshot(USER).pending).toBe(true);
  });
});

describe("learned promotion through the store", () => {
  const feedback = (outcome, at, i) =>
    recordAdaptationFeedback({ userId: USER, key: "UI:low_stimulation", outcome, exposureId: `e-${at}-${i}`, moduleId: "generic", at });

  it("promotes only after stable evidence across sessions, then syncs to other devices", async () => {
    useDevice("laptop");
    for (let i = 0; i < 6; i += 1) feedback("accepted", clock - 1000, i);
    await promoteFromFeedback(USER);
    expect(view().learned).toEqual({});
    const writesBefore = fake.state.writes;
    await promoteFromFeedback(USER); // same session, nothing new → no write
    expect(fake.state.writes).toBe(writesBefore);
    clock += PROFILE_CONFIG.promote.minStableMs;
    await promoteFromFeedback(USER);
    expect(view().learned["UI:low_stimulation"]).toMatchObject({ stance: "favoured" });
    // The phone has no local feedback history but receives the stance.
    useDevice("phone");
    setLearningStorage(createMemoryStorage());
    await loadProfile(USER);
    expect(view().learned["UI:low_stimulation"].stance).toBe("favoured");
    expect(getAdaptationFeedback(USER)).toEqual([]);
  });

  it("forgetting and resetting learned personalization stick; explicit preferences stay", async () => {
    useDevice("laptop");
    await setExplicitPreference(USER, "guidancePace", "slow");
    for (let i = 0; i < 6; i += 1) feedback("accepted", clock - 1000, i);
    await promoteFromFeedback(USER);
    clock += PROFILE_CONFIG.promote.minStableMs;
    await promoteFromFeedback(USER);
    await forgetLearnedPreference(USER, "UI:low_stimulation");
    clock += PROFILE_CONFIG.promote.minStableMs;
    await promoteFromFeedback(USER);
    await promoteFromFeedback(USER);
    expect(view().learned).toEqual({}); // old feedback no longer counts

    await resetLearnedPersonalization(USER);
    expect(getAdaptationFeedback(USER)).toEqual([]);
    expect(view().preferences.guidancePace.value).toBe("slow");
  });
});

describe("temporary state and privacy deletion", () => {
  it("temporary context is never persisted locally or remotely", async () => {
    useDevice("laptop");
    await loadProfile(USER);
    setTemporaryPreference(USER, "motion", "reduced");
    await setExplicitPreference(USER, "guidancePace", "slow");
    expect(resolveProfileView(getProfileSnapshot(USER).profile, { now: clock, temporary: getProfileSnapshot(USER).temporary }).preferences.motion.source).toBe("temporary");
    expect(JSON.stringify(fake.rows.get(USER))).not.toMatch(/reduced|temporary/);
    const local = devices.laptop.getItem(getRole4StorageKey(USER, ROLE4_COLLECTIONS.ADAPTIVE_PROFILE));
    expect(local).not.toMatch(/reduced|temporary/);
    useDevice("laptop");
    await loadProfile(USER);
    expect(view().preferences.motion).toBeUndefined();
    expect(() => setTemporaryPreference(USER, "mode:calm_visuals", "avoided")).toThrow(TypeError);
  });

  it("privacy deletion removes the account row and every local trace", async () => {
    useDevice("laptop");
    await setExplicitPreference(USER, "guidancePace", "slow");
    recordAdaptationFeedback({ userId: USER, key: "UI:low_stimulation", outcome: "accepted", exposureId: "x", at: clock });
    await deletePersonalizationData(USER);
    expect(fake.rows.has(USER)).toBe(false);
    expect(devices.laptop.getItem(getRole4StorageKey(USER, ROLE4_COLLECTIONS.ADAPTIVE_PROFILE))).toBeNull();
    expect(getAdaptationFeedback(USER)).toEqual([]);
    expect(getProfileSnapshot(USER).profile).toBeNull();
  });

  it("privacy deletion reports a failed account deletion (but still clears the device)", async () => {
    useDevice("laptop");
    await setExplicitPreference(USER, "guidancePace", "slow");
    fake.state.offline = true;
    await expect(deletePersonalizationData(USER)).rejects.toThrow();
    expect(devices.laptop.getItem(getRole4StorageKey(USER, ROLE4_COLLECTIONS.ADAPTIVE_PROFILE))).toBeNull();
  });
});

/**
 * profileModel.js — Persistent personalization profile (Task 5)
 *
 * A pure, deterministic, user-owned profile with three strictly separated
 * layers. They are never merged into one score:
 *
 *   explicit  — what the user set themselves (dimensions, preferred/avoided
 *               support modes, avoided interaction patterns). Only ever
 *               changed by an explicit user action. Always outranks learned.
 *   learned   — stances PROMOTED from Task 4 feedback learning
 *               (adaptationLearning.js) once evidence is sufficient,
 *               confident and stable over time. Keyed by Task 4 preference
 *               key (`TARGET:ruleId` / `RECOMMENDATION:<id>`).
 *   temporary — "for now" contextual state. Lives outside the profile (see
 *               profileStore.js), is session-only and is never serialized:
 *               sanitizeProfile() has no slot for it, so it cannot silently
 *               become a permanent preference.
 *
 * Every layer supports a global scope and per-module context scopes; context
 * entries win over global ones within the same layer, and the explicit layer
 * wins over the learned layer at every scope.
 *
 * Learned promotion guards against oscillation with (1) an evidence and
 * confidence gate, (2) a stability window — the same stance must be observed
 * across checks at least `minStableMs` apart, (3) a hysteresis band for
 * demotion, (4) no direct flip (a stance must be demoted, wait out a
 * cooldown and re-qualify), and (5) expiry of stances not re-confirmed.
 * Avoided stances are never promoted for safety-adjacent rules.
 *
 * Synchronisation: every entry carries its own timestamp and removals are
 * tombstones, so mergeProfiles() is a field-level last-writer-wins merge that
 * is commutative, idempotent and respects reset barriers (a stale device can
 * never resurrect data the user reset).
 *
 * No diagnoses or sensitive traits: the vocabulary is closed
 * (profileVocabulary.js) and unknown fields are dropped.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { summarizePreference } from "@/adaptive/learning/adaptationLearning";
import {
  AVOID_FIELD_PREFIX,
  AVOIDABLE_PATTERNS,
  LEARNED_STANCES,
  MODE_FIELD_PREFIX,
  PREFERENCE_DIMENSIONS,
  PROTECTED_RULE_IDS,
  SUPPORT_MODES,
  describeLearnedKey,
  isExplicitField,
  isLearnedKey,
  isModuleId,
  isValidExplicitValue,
} from "./profileVocabulary.js";

export const PROFILE_SCHEMA_VERSION = 1;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const PROFILE_CONFIG = Object.freeze({
  promote: Object.freeze({
    favouredAt: 0.75,
    avoidedAt: 0.25,
    minConfidence: 0.6,
    minEvidenceCount: 4,
    /** Same stance must persist this long (spans sessions) before promotion. */
    minStableMs: 12 * HOUR,
  }),
  demote: Object.freeze({ favouredBelow: 0.6, avoidedAbove: 0.4 }),
  /** After a demotion the key cannot be re-promoted for this long. */
  demotionCooldownMs: 7 * DAY,
  /** A learned stance not re-confirmed for this long stops applying. */
  learnedTtlMs: 120 * DAY,
  maxHistory: 25,
  maxContexts: 60,
  maxEntriesPerScope: 120,
});

// ─────────────────────────────────────────────────────────────────
//  Construction & sanitization
// ─────────────────────────────────────────────────────────────────

function emptyLayer() {
  return { global: {}, contexts: {} };
}

export function createProfile(userId, now = Date.now()) {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    userId: String(userId),
    revision: 0,
    updatedAt: now,
    explicit: emptyLayer(),
    learned: emptyLayer(),
    candidates: emptyLayer(),
    resets: { explicitAt: 0, learnedAt: 0 },
    history: [],
  };
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isTime = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const in01 = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

function sanitizeExplicitEntry(field, entry) {
  if (!isExplicitField(field) || !isObject(entry) || !isTime(entry.setAt)) return null;
  if (!isValidExplicitValue(field, entry.value)) return null;
  return { value: entry.value, setAt: entry.setAt };
}

function sanitizeLearnedEntry(key, entry) {
  if (!isLearnedKey(key) || !isObject(entry) || !isTime(entry.updatedAt)) return null;
  const out = { stance: null, updatedAt: entry.updatedAt };
  if (entry.stance === LEARNED_STANCES.FAVOURED || entry.stance === LEARNED_STANCES.AVOIDED) {
    if (!in01(entry.score) || !in01(entry.confidence) || !isTime(entry.promotedAt) || !isTime(entry.confirmedAt)) {
      return null;
    }
    Object.assign(out, {
      stance: entry.stance,
      score: entry.score,
      confidence: entry.confidence,
      evidenceCount: Math.max(0, Math.trunc(Number(entry.evidenceCount) || 0)),
      promotedAt: entry.promotedAt,
      confirmedAt: entry.confirmedAt,
    });
  }
  for (const marker of ["demotedAt", "forgottenAt", "expiredAt"]) {
    if (isTime(entry[marker])) out[marker] = entry[marker];
  }
  return out;
}

function sanitizeCandidate(key, entry) {
  if (!isLearnedKey(key) || !isObject(entry) || !isTime(entry.firstSeenAt)) return null;
  if (entry.stance !== LEARNED_STANCES.FAVOURED && entry.stance !== LEARNED_STANCES.AVOIDED) return null;
  return { stance: entry.stance, firstSeenAt: entry.firstSeenAt };
}

function sanitizeBucket(bucket, sanitizeEntry) {
  const out = {};
  if (!isObject(bucket)) return out;
  for (const [key, entry] of Object.entries(bucket).slice(0, PROFILE_CONFIG.maxEntriesPerScope)) {
    const clean = sanitizeEntry(key, entry);
    if (clean) out[key] = clean;
  }
  return out;
}

function sanitizeLayer(layer, sanitizeEntry) {
  const out = emptyLayer();
  if (!isObject(layer)) return out;
  out.global = sanitizeBucket(layer.global, sanitizeEntry);
  if (isObject(layer.contexts)) {
    for (const [moduleId, bucket] of Object.entries(layer.contexts).slice(0, PROFILE_CONFIG.maxContexts)) {
      if (!isModuleId(moduleId)) continue;
      const clean = sanitizeBucket(bucket, sanitizeEntry);
      if (Object.keys(clean).length > 0) out.contexts[moduleId] = clean;
    }
  }
  return out;
}

function sanitizeHistoryEntry(entry) {
  if (!isObject(entry) || typeof entry.id !== "string" || !isTime(entry.at)) return null;
  if (entry.layer !== "explicit" && entry.layer !== "learned") return null;
  const moduleId = entry.moduleId === null || entry.moduleId === undefined ? null : entry.moduleId;
  if (moduleId !== null && !isModuleId(moduleId)) return null;
  if (entry.layer === "explicit") {
    if (!isExplicitField(entry.field)) return null;
    if (!isValidExplicitValue(entry.field, entry.previous ?? null) || !isValidExplicitValue(entry.field, entry.next ?? null)) {
      return null;
    }
  } else {
    if (!isLearnedKey(entry.field)) return null;
  }
  const out = {
    id: entry.id.slice(0, 80),
    at: entry.at,
    layer: entry.layer,
    moduleId,
    field: entry.field,
    previous: entry.layer === "explicit" ? entry.previous ?? null : sanitizeLearnedEntry(entry.field, entry.previous),
    next: entry.layer === "explicit" ? entry.next ?? null : null,
  };
  if (isTime(entry.undoneAt)) out.undoneAt = entry.undoneAt;
  return out;
}

/**
 * Validate an untrusted profile (local storage, remote row). Unknown fields,
 * unknown preference ids, malformed entries and anything not in the closed
 * vocabulary are dropped. Returns a fresh profile when unusable or when it
 * belongs to another user.
 */
export function sanitizeProfile(raw, userId, now = Date.now()) {
  const owner = String(userId);
  if (!isObject(raw) || raw.schemaVersion !== PROFILE_SCHEMA_VERSION || String(raw.userId) !== owner) {
    return createProfile(owner, now);
  }
  const resets = {
    explicitAt: isTime(raw.resets?.explicitAt) ? raw.resets.explicitAt : 0,
    learnedAt: isTime(raw.resets?.learnedAt) ? raw.resets.learnedAt : 0,
  };
  const history = Array.isArray(raw.history)
    ? raw.history.map(sanitizeHistoryEntry).filter(Boolean).slice(-PROFILE_CONFIG.maxHistory)
    : [];
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    userId: owner,
    revision: Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
    updatedAt: isTime(raw.updatedAt) ? raw.updatedAt : now,
    explicit: sanitizeLayer(raw.explicit, sanitizeExplicitEntry),
    learned: sanitizeLayer(raw.learned, sanitizeLearnedEntry),
    candidates: sanitizeLayer(raw.candidates, sanitizeCandidate),
    resets,
    history,
  };
}

// ─────────────────────────────────────────────────────────────────
//  Immutable helpers
// ─────────────────────────────────────────────────────────────────

function clone(profile) {
  return JSON.parse(JSON.stringify(profile));
}

function bucketOf(layer, moduleId, create = false) {
  if (!moduleId) return layer.global;
  if (!layer.contexts[moduleId] && create) layer.contexts[moduleId] = {};
  return layer.contexts[moduleId] ?? {};
}

function scopeOf(moduleId) {
  if (moduleId === undefined || moduleId === null || moduleId === "global") return null;
  if (!isModuleId(moduleId)) throw new TypeError(`Invalid module id: ${moduleId}`);
  return moduleId;
}

let historyCounter = 0;
function historyId(now) {
  historyCounter = (historyCounter + 1) % 1e6;
  return `h-${now.toString(36)}-${historyCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pushHistory(profile, entry) {
  profile.history = [...profile.history, entry].slice(-PROFILE_CONFIG.maxHistory);
}

function touch(profile, now) {
  profile.updatedAt = Math.max(profile.updatedAt ?? 0, now);
  return profile;
}

// ─────────────────────────────────────────────────────────────────
//  Explicit layer (user actions only)
// ─────────────────────────────────────────────────────────────────

/**
 * Set (or clear with `null`) one explicit preference. Only ever called from an
 * explicit user action. Throws on fields/values outside the vocabulary.
 *
 * @param {object} profile
 * @param {string} field - dimension id, `mode:<id>` or `avoid:<pattern>`
 * @param {string|boolean|null} value
 * @param {{ moduleId?: string|null, now?: number }} [options]
 */
export function setExplicitPreference(profile, field, value, { moduleId, now = Date.now() } = {}) {
  if (!isExplicitField(field)) throw new TypeError(`Unknown preference: ${field}`);
  const normalized = value === undefined || value === false ? null : value;
  if (!isValidExplicitValue(field, normalized)) throw new TypeError(`Invalid value for ${field}`);
  const scope = scopeOf(moduleId);
  const next = clone(profile);
  const bucket = bucketOf(next.explicit, scope, true);
  const previous = bucket[field]?.value ?? null;
  if (previous === normalized) return profile;
  bucket[field] = { value: normalized, setAt: now };
  pushHistory(next, { id: historyId(now), at: now, layer: "explicit", moduleId: scope, field, previous, next: normalized });
  return touch(next, now);
}

export function clearExplicitPreference(profile, field, options = {}) {
  return setExplicitPreference(profile, field, null, options);
}

// ─────────────────────────────────────────────────────────────────
//  Learned layer
// ─────────────────────────────────────────────────────────────────

function isActiveLearned(entry, now, config = PROFILE_CONFIG) {
  return Boolean(entry?.stance) && now - entry.confirmedAt <= config.learnedTtlMs;
}

/**
 * Earliest feedback timestamp that may count towards a learned stance: after
 * a learning reset, and after the user explicitly forgot that stance.
 */
export function learnedEvidenceFloor(profile, key, moduleId = null) {
  const floor = profile.resets.learnedAt;
  const scoped = bucketOf(profile.learned, moduleId)[key];
  const global = profile.learned.global[key];
  return Math.max(floor, scoped?.forgottenAt ?? 0, moduleId ? 0 : global?.forgottenAt ?? 0);
}

/**
 * Summarize Task 4 feedback events per scope for promotion, ignoring
 * evidence recorded before a reset or before the user forgot a stance.
 *
 * @returns {{ global: Record<string, object>, contexts: Record<string, Record<string, object>> }}
 */
export function summarizeFeedbackForProfile(profile, events, { now = Date.now(), config } = {}) {
  const list = Array.isArray(events) ? events : [];
  const out = { global: {}, contexts: {} };
  const keys = [...new Set(list.map((event) => event.key))].filter(isLearnedKey);
  for (const key of keys) {
    const globalEvents = list.filter((event) => event.key === key && event.at > learnedEvidenceFloor(profile, key));
    if (globalEvents.length > 0) {
      out.global[key] = summarizePreference(globalEvents, key, { now, ...(config ? { config } : {}) });
    }
    const modules = [...new Set(globalEvents.map((event) => event.moduleId))].filter(
      (moduleId) => isModuleId(moduleId) && moduleId !== "generic",
    );
    for (const moduleId of modules) {
      const floor = learnedEvidenceFloor(profile, key, moduleId);
      const scoped = list.filter((event) => event.key === key && event.at > floor);
      const summary = summarizePreference(scoped, key, { moduleId, now, ...(config ? { config } : {}) });
      if (summary.scope === "context") {
        out.contexts[moduleId] = { ...(out.contexts[moduleId] ?? {}), [key]: summary };
      }
    }
  }
  return out;
}

function classify(summary, key, config) {
  if (!summary?.sufficient) return null;
  const { promote } = config;
  if (summary.confidence < promote.minConfidence || summary.evidenceCount < promote.minEvidenceCount) return null;
  if (summary.score >= promote.favouredAt) return LEARNED_STANCES.FAVOURED;
  if (summary.score <= promote.avoidedAt) {
    const ruleId = key.split(":").slice(1).join(":");
    // Never learn to avoid safety / distress support.
    return PROTECTED_RULE_IDS.includes(ruleId) ? null : LEARNED_STANCES.AVOIDED;
  }
  return null;
}

function stanceFields(summary) {
  return {
    score: summary.score,
    confidence: summary.confidence,
    evidenceCount: summary.evidenceCount,
  };
}

/**
 * Promote / refresh / demote learned stances from feedback summaries. Pure;
 * returns the same profile object when nothing changed.
 *
 * @returns {{ profile: object, changed: boolean, promoted: string[], demoted: string[] }}
 */
export function promoteLearnedPreferences(profile, summaries, { now = Date.now(), config = PROFILE_CONFIG } = {}) {
  const next = clone(profile);
  const promoted = [];
  const demoted = [];
  const scopes = [[null, summaries?.global ?? {}]];
  for (const [moduleId, bucket] of Object.entries(summaries?.contexts ?? {})) {
    if (isModuleId(moduleId)) scopes.push([moduleId, bucket ?? {}]);
  }

  for (const [moduleId, bucket] of scopes) {
    const learned = bucketOf(next.learned, moduleId, true);
    const candidates = bucketOf(next.candidates, moduleId, true);
    for (const [key, summary] of Object.entries(bucket)) {
      if (!isLearnedKey(key)) continue;
      const existing = learned[key];
      const label = moduleId ? `${moduleId}/${key}` : key;

      if (existing?.stance && isActiveLearned(existing, now, config)) {
        delete candidates[key];
        if (!summary?.sufficient) continue; // decayed evidence: keep until TTL
        const demote =
          existing.stance === LEARNED_STANCES.FAVOURED
            ? summary.score < config.demote.favouredBelow
            : summary.score > config.demote.avoidedAbove;
        if (demote) {
          learned[key] = { stance: null, updatedAt: now, demotedAt: now };
          demoted.push(label);
        } else if (classify(summary, key, config) === existing.stance) {
          learned[key] = { ...existing, ...stanceFields(summary), confirmedAt: now, updatedAt: now };
        }
        continue;
      }

      if (existing?.demotedAt && now - existing.demotedAt < config.demotionCooldownMs) {
        delete candidates[key];
        continue;
      }
      const stance = classify(summary, key, config);
      if (!stance) {
        delete candidates[key];
        continue;
      }
      const candidate = candidates[key];
      if (!candidate || candidate.stance !== stance) {
        candidates[key] = { stance, firstSeenAt: now };
        continue;
      }
      if (now - candidate.firstSeenAt >= config.promote.minStableMs) {
        learned[key] = {
          stance,
          ...stanceFields(summary),
          promotedAt: now,
          confirmedAt: now,
          updatedAt: now,
        };
        delete candidates[key];
        promoted.push(label);
      }
    }
  }

  // Recency: stances not re-confirmed within the TTL stop applying.
  for (const bucket of [next.learned.global, ...Object.values(next.learned.contexts)]) {
    for (const [key, entry] of Object.entries(bucket)) {
      if (entry.stance && !isActiveLearned(entry, now, config)) {
        bucket[key] = { stance: null, updatedAt: now, expiredAt: now };
        demoted.push(key);
      }
    }
  }
  pruneEmptyContexts(next);

  const changed =
    JSON.stringify(next.learned) !== JSON.stringify(profile.learned) ||
    JSON.stringify(next.candidates) !== JSON.stringify(profile.candidates);
  return changed ? { profile: touch(next, now), changed, promoted, demoted } : { profile, changed, promoted, demoted };
}

/** User forgets one learned stance; feedback before now no longer counts. */
export function forgetLearnedPreference(profile, key, { moduleId, now = Date.now() } = {}) {
  if (!isLearnedKey(key)) throw new TypeError(`Unknown learned preference: ${key}`);
  const scope = scopeOf(moduleId);
  const next = clone(profile);
  const bucket = bucketOf(next.learned, scope, true);
  const previous = bucket[key] ?? null;
  bucket[key] = { stance: null, updatedAt: now, forgottenAt: now };
  delete bucketOf(next.candidates, scope, true)[key];
  pushHistory(next, { id: historyId(now), at: now, layer: "learned", moduleId: scope, field: key, previous, next: null });
  pruneEmptyContexts(next);
  return touch(next, now);
}

/** Reset only learned personalization (explicit preferences untouched). */
export function resetLearnedPersonalization(profile, { now = Date.now() } = {}) {
  const next = clone(profile);
  next.learned = emptyLayer();
  next.candidates = emptyLayer();
  next.resets.learnedAt = now;
  next.history = next.history.filter((entry) => entry.layer !== "learned");
  return touch(next, now);
}

/** Reset the entire profile. Reset barriers keep stale devices from restoring it. */
export function resetProfile(profile, { now = Date.now() } = {}) {
  const fresh = createProfile(profile.userId, now);
  fresh.revision = profile.revision;
  fresh.resets = { explicitAt: now, learnedAt: now };
  return fresh;
}

/** Most recent user change that can still be undone. */
export function lastUndoableChange(profile) {
  for (let index = profile.history.length - 1; index >= 0; index -= 1) {
    const entry = profile.history[index];
    if (!entry.undoneAt) return entry;
  }
  return null;
}

/** Undo the most recent explicit change or learned "forget". */
export function undoLastChange(profile, { now = Date.now() } = {}) {
  const entry = lastUndoableChange(profile);
  if (!entry) return profile;
  const next = clone(profile);
  const target = next.history.find((item) => item.id === entry.id);
  target.undoneAt = now;
  if (entry.layer === "explicit") {
    bucketOf(next.explicit, entry.moduleId, true)[entry.field] = { value: entry.previous ?? null, setAt: now };
  } else {
    const bucket = bucketOf(next.learned, entry.moduleId, true);
    bucket[entry.field] = entry.previous?.stance
      ? { ...entry.previous, updatedAt: now }
      : { stance: null, updatedAt: now };
  }
  return touch(next, now);
}

function pruneEmptyContexts(profile) {
  for (const layer of [profile.explicit, profile.learned, profile.candidates]) {
    for (const [moduleId, bucket] of Object.entries(layer.contexts)) {
      if (Object.keys(bucket).length === 0) delete layer.contexts[moduleId];
    }
  }
}

// ─────────────────────────────────────────────────────────────────
//  Merge (conflicting updates across devices / tabs)
// ─────────────────────────────────────────────────────────────────

function newer(left, right, stampOf) {
  if (!left) return right;
  if (!right) return left;
  const a = stampOf(left);
  const b = stampOf(right);
  if (a !== b) return a > b ? left : right;
  // Deterministic tie-break so every device converges on the same value.
  return JSON.stringify(left) >= JSON.stringify(right) ? left : right;
}

function mergeLayer(left, right, stampOf, barrier) {
  const out = emptyLayer();
  const mergeBucket = (a = {}, b = {}) => {
    const bucket = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const winner = newer(a[key], b[key], stampOf);
      if (winner && stampOf(winner) > barrier) bucket[key] = winner;
    }
    return bucket;
  };
  out.global = mergeBucket(left.global, right.global);
  for (const moduleId of new Set([...Object.keys(left.contexts), ...Object.keys(right.contexts)])) {
    const bucket = mergeBucket(left.contexts[moduleId], right.contexts[moduleId]);
    if (Object.keys(bucket).length > 0) out.contexts[moduleId] = bucket;
  }
  return out;
}

/**
 * Field-level merge of two versions of the same user's profile. Explicit
 * entries: newest `setAt` wins; learned entries: newest `updatedAt` wins;
 * resets are barriers (anything older is dropped). Commutative & idempotent.
 */
export function mergeProfiles(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left.userId !== right.userId) throw new Error("Cannot merge profiles of different users");
  const resets = {
    explicitAt: Math.max(left.resets.explicitAt, right.resets.explicitAt),
    learnedAt: Math.max(left.resets.learnedAt, right.resets.learnedAt),
  };
  const historyById = new Map();
  for (const entry of [...left.history, ...right.history]) {
    const current = historyById.get(entry.id);
    historyById.set(entry.id, current && (current.undoneAt ?? 0) >= (entry.undoneAt ?? 0) ? current : entry);
  }
  const history = [...historyById.values()]
    .filter((entry) => entry.at > (entry.layer === "explicit" ? resets.explicitAt : resets.learnedAt))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .slice(-PROFILE_CONFIG.maxHistory);
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    userId: left.userId,
    revision: Math.max(left.revision, right.revision),
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    explicit: mergeLayer(left.explicit, right.explicit, (entry) => entry.setAt, resets.explicitAt),
    learned: mergeLayer(left.learned, right.learned, (entry) => entry.updatedAt, resets.learnedAt),
    candidates: mergeLayer(left.candidates, right.candidates, (entry) => entry.firstSeenAt, resets.learnedAt),
    resets,
    history,
  };
}

/** Content equality ignoring revision/updatedAt bookkeeping. */
export function sameProfileContent(left, right) {
  if (!left || !right) return left === right;
  const strip = ({ revision: _r, updatedAt: _u, ...rest }) => rest;
  return JSON.stringify(strip(left)) === JSON.stringify(strip(right));
}

// ─────────────────────────────────────────────────────────────────
//  Resolution (what the engine and UI consume)
// ─────────────────────────────────────────────────────────────────

function temporaryValue(temporary, field, moduleId, now) {
  const scoped = moduleId ? temporary?.contexts?.[moduleId]?.[field] : undefined;
  for (const [entry, scope] of [[scoped, "context"], [temporary?.global?.[field], "global"]]) {
    if (entry && entry.value !== null && (entry.expiresAt === undefined || entry.expiresAt > now)) {
      return { value: entry.value, scope };
    }
  }
  return null;
}

function explicitValue(profile, field, moduleId) {
  const scoped = moduleId ? profile.explicit.contexts[moduleId]?.[field] : undefined;
  if (scoped && scoped.value !== null) return { value: scoped.value, scope: "context" };
  const global = profile.explicit.global[field];
  if (global && global.value !== null) return { value: global.value, scope: "global" };
  return null;
}

/**
 * Resolve the profile for one context. Precedence per dimension:
 * temporary (session "for now") → explicit context → explicit global → unset.
 * Learned stances: context → global (never above explicit; they only reach
 * the engine as bounded supporting evidence).
 *
 * @param {object|null} profile
 * @param {{ moduleId?: string|null, now?: number, temporary?: object, includeLearned?: boolean }} [options]
 */
export function resolveProfileView(profile, { moduleId = null, now = Date.now(), temporary, includeLearned = true } = {}) {
  if (!profile) return undefined;
  const context = moduleId && moduleId !== "generic" && isModuleId(moduleId) ? moduleId : null;

  const preferences = {};
  const known = [];
  for (const field of Object.keys(PREFERENCE_DIMENSIONS)) {
    const temp = temporaryValue(temporary, field, context, now);
    const explicit = explicitValue(profile, field, context);
    if (temp) preferences[field] = { value: temp.value, source: "temporary", scope: temp.scope };
    else if (explicit) preferences[field] = { value: explicit.value, source: "explicit", scope: explicit.scope };
    if (explicit) known.push(field);
  }

  const supportModes = { preferred: [], avoided: [] };
  for (const mode of Object.keys(SUPPORT_MODES)) {
    const resolved = explicitValue(profile, `${MODE_FIELD_PREFIX}${mode}`, context);
    if (resolved) {
      supportModes[resolved.value].push({ mode, scope: resolved.scope });
      known.push(`${MODE_FIELD_PREFIX}${mode}`);
    }
  }

  const avoidedPatterns = [];
  for (const pattern of Object.keys(AVOIDABLE_PATTERNS)) {
    const resolved = explicitValue(profile, `${AVOID_FIELD_PREFIX}${pattern}`, context);
    if (resolved) {
      avoidedPatterns.push({ pattern, scope: resolved.scope });
      known.push(`${AVOID_FIELD_PREFIX}${pattern}`);
    }
  }

  const learned = {};
  if (includeLearned) {
    const layers = [[profile.learned.global, "global"]];
    if (context && profile.learned.contexts[context]) layers.push([profile.learned.contexts[context], "context"]);
    for (const [bucket, scope] of layers) {
      for (const [key, entry] of Object.entries(bucket)) {
        if (scope === "context" && entry && !entry.stance) {
          delete learned[key]; // forgotten in this context: no global fallback
          continue;
        }
        if (isActiveLearned(entry, now)) {
          learned[key] = {
            stance: entry.stance,
            score: entry.score,
            confidence: entry.confidence,
            evidenceCount: entry.evidenceCount,
            scope,
          };
        }
      }
    }
  }

  const avoided = new Set(avoidedPatterns.map((item) => item.pattern));
  const value = (field) => preferences[field]?.value ?? null;
  return {
    revision: profile.revision,
    moduleId: context,
    /** Feedback before this time no longer counts (learning reset). */
    learnedSince: profile.resets.learnedAt,
    preferences,
    supportModes,
    avoidedPatterns,
    learned,
    known,
    presentation: {
      interactionStyle: value("interactionStyle"),
      informationDensity: value("informationDensity"),
      explanationLength: value("explanationLength"),
      guidancePace: value("guidancePace"),
      notificationLevel: value("notificationLevel"),
      interruptionTolerance: value("interruptionTolerance"),
      visualPresentation: value("visualPresentation"),
      reduceMotion: value("motion") === "reduced" || avoided.has("animations"),
      allowUnrequestedOffers: !avoided.has("unrequested_offers"),
      soundCues: !avoided.has("sound_cues"),
      frequentCheckIns: !avoided.has("frequent_check_ins") && value("interruptionTolerance") !== "low",
    },
  };
}

/** Whether a preference is already known, so the app need not ask again. */
export function isPreferenceKnown(view, field) {
  return Boolean(view?.known?.includes(field));
}

/**
 * User-facing description: explicit vs learned, by scope. Exposes no
 * behavioural history, candidate state or raw feedback.
 */
export function describeProfile(profile, { now = Date.now() } = {}) {
  if (!profile) return { explicit: [], learned: [], undo: null };
  const explicit = [];
  const pushExplicit = (bucket, moduleId) => {
    for (const [field, entry] of Object.entries(bucket)) {
      if (entry.value === null) continue;
      explicit.push({ field, moduleId, value: entry.value, setAt: entry.setAt });
    }
  };
  pushExplicit(profile.explicit.global, null);
  for (const [moduleId, bucket] of Object.entries(profile.explicit.contexts)) pushExplicit(bucket, moduleId);

  const learned = [];
  const pushLearned = (bucket, moduleId) => {
    for (const [key, entry] of Object.entries(bucket)) {
      if (!isActiveLearned(entry, now)) continue;
      learned.push({
        key,
        moduleId,
        label: describeLearnedKey(key),
        stance: entry.stance,
        strength: entry.confidence >= 0.75 ? "strong" : "moderate",
        since: entry.promotedAt,
      });
    }
  };
  pushLearned(profile.learned.global, null);
  for (const [moduleId, bucket] of Object.entries(profile.learned.contexts)) pushLearned(bucket, moduleId);

  const undo = lastUndoableChange(profile);
  return {
    explicit,
    learned,
    undo: undo ? { layer: undo.layer, field: undo.field, moduleId: undo.moduleId } : null,
  };
}

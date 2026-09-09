/**
 * asdLearnerId.js — single source of truth for resolving the ASD learner
 * (ward) id used by the ASD hub and every ASD practice feature.
 *
 * The hub reads practice progress under `targetWardId`; features used to
 * record under `user.id`. This module makes both use the same resolver so
 * completions land under the exact key the hub reads (guardians, care-link
 * ids and email fallbacks included), without a second persistence system.
 *
 * Ownership: ASD Experience Engineer
 */

export const CARE_LINK_REGISTRY = {
  "CL-ARUN-0042": "nb-user-042",
  "CL-MEERA-0011": "nb-user-011",
  "CL-RIYA-0088": "nb-user-088",
};

export const RUNTIME_SYNC_WARD_KEY = "nb_runtime_sync_ward_id";

export function readRuntimeSyncWardId() {
  try {
    const value = localStorage.getItem(RUNTIME_SYNC_WARD_KEY);
    return value && value.startsWith("nb-user-") ? value : null;
  } catch {
    return null;
  }
}

export function writeRuntimeSyncWardId(wardId) {
  if (!wardId || !String(wardId).startsWith("nb-user-")) return;
  try {
    localStorage.setItem(RUNTIME_SYNC_WARD_KEY, wardId);
  } catch {
    /* silent */
  }
}

export function normalizeWardId(wardId) {
  const raw = String(wardId || "").trim();
  if (!raw) return null;
  if (raw.startsWith("nb-user-")) return raw;
  const mapped = CARE_LINK_REGISTRY[raw.toUpperCase()];
  return mapped || null;
}

/**
 * Resolve the canonical ward (learner) id for the currently signed-in user.
 * Mirrors the exact resolution the ASD hub uses so feature pages and the hub
 * always agree on the same progress key.
 */
export function resolveASDLearnerId(user, role) {
  if (!user) return null;

  const runtimeWard = readRuntimeSyncWardId();
  if (runtimeWard) {
    return runtimeWard;
  }

  if (role === "guardian") {
    const linkedIds = Array.isArray(user.linkedWardIds) ? user.linkedWardIds : [];
    const normalizedLinked = linkedIds.map(normalizeWardId).filter(Boolean);
    return normalizedLinked[0] || "nb-user-088";
  }

  const careLinkId = String(user?.careLinkId || "").toUpperCase().trim();
  if (careLinkId && CARE_LINK_REGISTRY[careLinkId]) {
    return CARE_LINK_REGISTRY[careLinkId];
  }

  const email = String(user?.email || "").toLowerCase();
  if (email.includes("riya") || email.includes("neha")) {
    return "nb-user-088";
  }

  const selectedProfile = String(user?.selectedProfile || "").toLowerCase();
  const disorderList = Array.isArray(user?.disorders) ? user.disorders.map((item) => String(item).toLowerCase()) : [];
  const hasAsdProfile = selectedProfile === "asd" || disorderList.includes("asd");

  if (typeof user?.id === "string" && user.id.startsWith("nb-user-")) {
    return user.id;
  }

  if (email.includes("arun")) {
    return "nb-user-042";
  }

  if (email.includes("meera")) {
    return "nb-user-011";
  }

  if (hasAsdProfile) {
    return "nb-user-088";
  }

  return "nb-user-088";
}
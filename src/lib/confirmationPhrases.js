/**
 * Deterministic, exact-match allowlist for hands-free voice confirmation —
 * the same pattern as backend/services/fast_path.py's exact-phrase matching,
 * mirrored here because pendingConfirmation state lives on the frontend.
 *
 * Deliberately NOT fuzzy/substring matching: "yes, but wait" or "no, that's
 * not what I meant" must NOT accidentally confirm/cancel a pending write.
 * An unmatched reply falls through to the normal agent pipeline as a new
 * message — the safe default, never treated as accidental confirmation.
 */

const AFFIRMATIVE_PHRASES = new Set([
  "yes", "yes please", "yeah", "yep", "yup", "confirm", "do it", "proceed",
  "go ahead", "sure", "okay", "ok", "yes do it", "yes confirm", "please do it",
  "yes go ahead",
]);

const NEGATIVE_PHRASES = new Set([
  "no", "nope", "cancel", "dont do it", "no cancel", "no cancel that", "stop",
  "never mind", "nevermind", "actually no", "actually dont do that",
  "dont do that", "no dont", "leave it",
]);

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAffirmativeConfirmation(text) {
  return AFFIRMATIVE_PHRASES.has(normalize(text));
}

export function isNegativeConfirmation(text) {
  return NEGATIVE_PHRASES.has(normalize(text));
}

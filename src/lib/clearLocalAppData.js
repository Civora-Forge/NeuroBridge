/**
 * clearLocalAppData.js
 *
 * Wipes every NeuroBridge-namespaced localStorage key on sign-out.
 *
 * Why: `logout()` in AuthContext.jsx used to remove only the `nb_auth` key.
 * Everything else NeuroBridge stores locally — OCD journal entries and
 * compulsion/SUDS logs (nb_ocd_*), guardian notes, ASD ward settings, reading
 * history/profile caches, adaptive-engine behavioral memory, etc. — stayed on
 * disk after sign-out. On a shared or public device, the next person to open
 * the browser could read a previous user's mental-health self-report data
 * straight out of localStorage without ever signing in. Clearing everything
 * NeuroBridge writes, rather than hand-maintaining an allowlist of "the
 * sensitive ones", is the only version of this fix that doesn't silently
 * rot as new features add new keys.
 */

const APP_KEY_PREFIXES = ["nb_", "neurobridge", "focusforge-", "evidence-folder-"];

export function clearAllLocalAppData() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && APP_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // best-effort — localStorage may be unavailable (private mode, disabled, quota)
  }
}

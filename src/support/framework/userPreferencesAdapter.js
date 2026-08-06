/**
 * userPreferencesAdapter.js — D14 input wiring (minimum adapter)
 *
 * Maps the application's canonical preference source (the AuthContext `user`
 * preference object, persisted under `nb_prefs_<userId>`) onto the Adaptive
 * Engine's D14 `userPreferences` input fragment (spec §5). This is the only
 * new wiring between the live runtime and the already-implemented D14 stage.
 *
 * - Reads only the D14-relevant keys: `accessibility`, `requested`,
 *   `restricted`.
 * - Forwards values unchanged; no transformations, no defaults.
 * - Returns `undefined` when none are present so the engine runs its unchanged
 *   pass-through (no `user_preferences` source, no behavior change).
 *
 * Validation and allowlisting stay inside the D14 stage
 * (`backend/adaptive/engine/preferences.js`); this adapter only decides which
 * user data is offered to the engine.
 *
 * Ownership: Adaptive Experience Engineer
 */

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Extract the D14 `userPreferences` fragment from the app's preference source.
 * @param {object} [user] - The AuthContext user preference object.
 * @returns {{ accessibility?: object, requested?: object[], restricted?: object[] }|undefined}
 */
export function buildUserPreferencesFragment(user) {
  if (!isPlainObject(user)) {
    return undefined;
  }
  const fragment = {};
  if (isPlainObject(user.accessibility)) {
    fragment.accessibility = user.accessibility;
  }
  if (Array.isArray(user.requested)) {
    fragment.requested = user.requested;
  }
  if (Array.isArray(user.restricted)) {
    fragment.restricted = user.restricted;
  }
  return Object.keys(fragment).length > 0 ? fragment : undefined;
}

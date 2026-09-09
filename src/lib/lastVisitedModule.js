/**
 * Tracks the last support module a user actually opened, so the dashboard
 * can offer "Continue where you left off" instead of a black-box
 * recommendation. Simple, transparent, localStorage-only — no new backend.
 */

const STORAGE_KEY = "neurobridge-last-visited-module";

export function recordModuleVisit(moduleId, path) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ moduleId, path, at: Date.now() }));
  } catch {
    /* silent — this is a convenience, not critical state */
  }
}

export function getLastVisitedModule() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Finds the module whose launchRoute is the longest matching prefix of pathname. */
export function findModuleForPath(pathname, modulesRegistry) {
  let best = null;
  for (const module of Object.values(modulesRegistry)) {
    if (!module.launchRoute || module.launchRoute === "/") continue;
    if (pathname === module.launchRoute || pathname.startsWith(`${module.launchRoute}/`)) {
      if (!best || module.launchRoute.length > best.launchRoute.length) best = module;
    }
  }
  return best;
}

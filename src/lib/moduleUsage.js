/**
 * moduleUsage.js — tracks how often and how recently each module has been
 * opened, purely in localStorage, so the dashboard can surface "what you
 * actually use" instead of a black-box AI guess. Same transparency rule as
 * lastVisitedModule.js: every ranking here can be explained in one sentence
 * ("opened most often", "opened recently") with no hidden scoring model.
 */

const STORAGE_KEY = "neurobridge-module-usage";
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // a week-old visit counts half as much as today's

function readUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeUsage(usage) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    /* silent — this is a convenience, not critical state */
  }
}

/** Record one open of a module. Call this wherever a module is actually launched. */
export function recordModuleUsage(moduleId) {
  if (!moduleId) return;
  const usage = readUsage();
  const entry = usage[moduleId] || { count: 0, lastOpenedAt: 0 };
  usage[moduleId] = { count: entry.count + 1, lastOpenedAt: Date.now() };
  writeUsage(usage);
}

/**
 * Rank candidate module ids by recency-weighted frequency and return the
 * top `limit` with a plain-language reason attached.
 *
 * Modules with no usage history yet fall back to registry order, so a new
 * user still sees two suggestions on day one — just labeled "Suggested for
 * you" instead of implying real usage.
 */
export function getTopUsedModules(candidateModuleIds = [], limit = 2) {
  const usage = readUsage();
  const now = Date.now();

  const scored = candidateModuleIds.map((id, index) => {
    const entry = usage[id];
    if (!entry) return { id, score: 0, hasHistory: false, index };
    const ageMs = Math.max(0, now - entry.lastOpenedAt);
    const recencyWeight = Math.pow(0.5, ageMs / HALF_LIFE_MS);
    return { id, score: entry.count * recencyWeight, hasHistory: true, index, lastOpenedAt: entry.lastOpenedAt };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index; // stable, transparent tie-break: registry order
  });

  return scored.slice(0, limit).map((entry, rank) => ({
    id: entry.id,
    reason: !entry.hasHistory ? "Suggested for you" : rank === 0 ? "Your most-used tool" : "Opened recently",
  }));
}

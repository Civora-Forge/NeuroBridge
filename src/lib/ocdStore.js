/**
 * ocdStore.js
 * -----------
 * Lightweight localStorage-backed reactive store for OCD module data.
 * Replaces the need for Zustand in the web app while using the same
 * patterns as the mobile Zustand store (easy migration).
 *
 * All data is stored under namespaced keys in localStorage.
 * Any component can call read/write helpers and the data persists
 * across page refreshes.
 *
 * Schema mirrors the mobile TypeScript models in mobile/src/types/ocd.ts
 */

// ─── Key registry ────────────────────────────────────────────────────────────
const KEYS = {
  HIERARCHY:        "nb_ocd_hierarchy",
  SESSIONS:         "nb_ocd_sessions",
  SUDS_LOGS:        "nb_ocd_suds_logs",
  JOURNAL_ENTRIES:  "nb_ocd_journal",
  GOALS:            "nb_ocd_goals",
  MINDFUL_RUNS:     "nb_ocd_mindful_runs",
  COMPULSION_LOGS:  "nb_ocd_compulsion_logs",
};

// ─── Generic helpers ──────────────────────────────────────────────────────────
function load(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("ocdStore: localStorage write failed", e);
  }
}

// ─── OCD Subtypes ─────────────────────────────────────────────────────────────
export const OCD_SUBTYPES = [
  "Contamination",
  "Checking",
  "Symmetry / Just-Right",
  "Intrusive Thoughts",
  "Harm",
  "Religious / Scrupulosity",
  "Relationship OCD",
  "Health Anxiety",
];

// ─── ERP Hierarchy ────────────────────────────────────────────────────────────
export function getHierarchy() {
  return load(KEYS.HIERARCHY, [
    {
      id: "h1",
      title: "Contamination Hierarchy",
      subtype: "Contamination",
      items: [
        { id: "i1", title: "Touch a public door handle", suds: 35, durationMin: 2, masteryCount: 0, mastered: false },
        { id: "i2", title: "Touch a door handle and wait 5 min before washing", suds: 55, durationMin: 5, masteryCount: 0, mastered: false },
        { id: "i3", title: "Touch a door handle and do NOT wash for 30 min", suds: 75, durationMin: 30, masteryCount: 0, mastered: false },
      ],
    },
  ]);
}

export function saveHierarchy(hierarchy) {
  save(KEYS.HIERARCHY, hierarchy);
}

// ─── ERP Sessions ─────────────────────────────────────────────────────────────
export function getSessions() {
  return load(KEYS.SESSIONS, []);
}

export function addSession(session) {
  const sessions = getSessions();
  const full = { ...session, id: `s-${Date.now()}`, createdAt: new Date().toISOString() };
  save(KEYS.SESSIONS, [full, ...sessions]);
  return full;
}

// Update mastery on a hierarchy item (SUDS < 30 for N ≥ 3 sessions)
export function checkAndMarkMastery(itemId) {
  const sessions = getSessions().filter((s) => s.itemId === itemId && s.postSuds != null);
  const recentLow = sessions.slice(0, 5).filter((s) => s.postSuds < 30);
  if (recentLow.length >= 3) {
    const hierarchy = getHierarchy();
    const updated = hierarchy.map((h) => ({
      ...h,
      items: h.items.map((i) =>
        i.id === itemId ? { ...i, mastered: true, masteryCount: sessions.length } : i,
      ),
    }));
    saveHierarchy(updated);
    return true;
  }
  return false;
}

// ─── SUDS Logs (real-time within a session) ──────────────────────────────────
export function getSudsLogs() {
  return load(KEYS.SUDS_LOGS, []);
}

export function addSudsLog(log) {
  const logs = getSudsLogs();
  const full = { ...log, id: `sl-${Date.now()}`, ts: new Date().toISOString() };
  save(KEYS.SUDS_LOGS, [full, ...logs]);
  return full;
}

// ─── Journal Entries ──────────────────────────────────────────────────────────
export function getJournalEntries() {
  return load(KEYS.JOURNAL_ENTRIES, []);
}

export function addJournalEntry(entry) {
  const entries = getJournalEntries();
  const full = {
    ...entry,
    id: `j-${Date.now()}`,
    createdAt: new Date().toISOString(),
    hour: new Date().getHours(),
  };
  save(KEYS.JOURNAL_ENTRIES, [full, ...entries]);
  return full;
}

// ─── Response Prevention Goals ───────────────────────────────────────────────
export function getGoals() {
  return load(KEYS.GOALS, [
    {
      id: "g1",
      title: "Delay door-checking by 2 minutes",
      delayMinutes: 2,
      streak: 0,
      successCount: 0,
      attemptCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: "g2",
      title: "Skip one handwashing repeat after a trigger",
      delayMinutes: 5,
      streak: 0,
      successCount: 0,
      attemptCount: 0,
      createdAt: new Date().toISOString(),
    },
  ]);
}

export function updateGoal(goalId, patchOrFn) {
  const goals = getGoals();
  const updated = goals.map((g) => {
    if (g.id !== goalId) return g;
    const patch = typeof patchOrFn === "function" ? patchOrFn(g) : patchOrFn;
    return { ...g, ...patch };
  });
  save(KEYS.GOALS, updated);
  return updated;
}

export function addGoal(goal) {
  const goals = getGoals();
  const full = { ...goal, id: `g-${Date.now()}`, streak: 0, successCount: 0, attemptCount: 0, createdAt: new Date().toISOString() };
  save(KEYS.GOALS, [...goals, full]);
  return full;
}

// ─── Mindfulness Runs ─────────────────────────────────────────────────────────
export function getMindfulRuns() {
  return load(KEYS.MINDFUL_RUNS, []);
}

export function addMindfulRun(run) {
  const runs = getMindfulRuns();
  const full = { ...run, id: `mr-${Date.now()}`, createdAt: new Date().toISOString() };
  save(KEYS.MINDFUL_RUNS, [full, ...runs]);
  return full;
}

// ─── Compulsion Logs ──────────────────────────────────────────────────────────
export function getCompulsionLogs() {
  return load(KEYS.COMPULSION_LOGS, []);
}

export function addCompulsionLog(log) {
  const logs = getCompulsionLogs();
  const full = { ...log, id: `cl-${Date.now()}`, ts: new Date().toISOString(), hour: new Date().getHours() };
  save(KEYS.COMPULSION_LOGS, [full, ...logs]);
  return full;
}

// ─── AI helpers (rule-based, on-device) ──────────────────────────────────────

/** Infer OCD subtype from free text */
export function inferSubtype(text) {
  const t = text.toLowerCase();
  if (/germ|dirt|contamin|wash|clean|sick|infect/.test(t))       return "Contamination";
  if (/check|lock|stove|door|window|off|sure/.test(t))            return "Checking";
  if (/symmetr|even|right|align|order|perfect|arrange/.test(t))   return "Symmetry / Just-Right";
  if (/harm|hurt|stab|knife|push|violent|accident/.test(t))       return "Harm";
  if (/god|sin|blasph|pra|relig|moral|devil/.test(t))             return "Religious / Scrupulosity";
  if (/relationship|love|cheat|feel|real|partner/.test(t))        return "Relationship OCD";
  if (/cancer|disease|doctor|symptom|health|ill/.test(t))         return "Health Anxiety";
  return "Intrusive Thoughts";
}

/** ERP coaching message — never reassures, promotes staying with discomfort */
export function buildErpCoachingMessage(preSuds, currentSuds, elapsedMin) {
  const drop = preSuds - currentSuds;
  if (drop >= 20) return `Anxiety has dropped ${drop} points. Notice that happening — without you doing anything to make it stop. Stay present.`;
  if (drop >= 10) return `It's shifting. ${currentSuds > 50 ? "This is hard, and that's expected." : "You're further along than it feels."} Keep going.`;
  if (elapsedMin < 3) return `Anxiety is still high at ${currentSuds}. This is normal at the start. The task is to stay — not to feel comfortable.`;
  if (currentSuds > 75) return `SUDS at ${currentSuds}. Sit with the uncertainty. Discomfort is not danger.`;
  return `${elapsedMin} minutes in. This is exactly what ERP should feel like. Don't leave yet.`;
}

/** Validate no-reassurance (guard for copy) */
export function containsReassurance(text) {
  return /(you('re| are) safe|nothing bad|it'?s? okay|everything will|don't worry|you'll be fine)/i.test(text);
}

/** Weekly insight summary */
export function buildWeeklyInsight() {
  const entries = getJournalEntries();
  const sessions = getSessions();
  const week = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const recentEntries = entries.filter((e) => new Date(e.createdAt).getTime() > week);
  const recentSessions = sessions.filter((s) => new Date(s.createdAt).getTime() > week);

  const subtypeCounts = recentEntries.reduce((acc, e) => {
    const k = e.subtype ?? "Unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const dominantSubtype = Object.entries(subtypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
  const avgPreSuds = recentSessions.length
    ? (recentSessions.reduce((s, r) => s + (r.preSuds ?? 0), 0) / recentSessions.length).toFixed(0)
    : null;
  const avgPostSuds = recentSessions.length
    ? (recentSessions.reduce((s, r) => s + (r.postSuds ?? 0), 0) / recentSessions.length).toFixed(0)
    : null;

  // Hour-based risk windows
  const hourCounts = recentEntries.reduce((acc, e) => {
    const h = e.hour ?? 0;
    acc[h] = (acc[h] || 0) + 1;
    return acc;
  }, {});
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const peakLabel = peakHour !== null
    ? `${peakHour}:00–${Number(peakHour) + 1}:00`
    : null;

  return {
    dominantSubtype,
    entryCount: recentEntries.length,
    sessionCount: recentSessions.length,
    avgPreSuds,
    avgPostSuds,
    peakHour: peakLabel,
    narratives: [
      recentSessions.length > 0 && avgPostSuds !== null
        ? `Across ${recentSessions.length} ERP session${recentSessions.length > 1 ? "s" : ""} this week, your average post-session SUDS was ${avgPostSuds} (started at ${avgPreSuds}).`
        : "No ERP sessions logged this week yet.",
      dominantSubtype !== "Unknown"
        ? `Most entries relate to ${dominantSubtype}.`
        : null,
      peakLabel
        ? `Your highest-frequency log window is around ${peakLabel}. Consider scheduling a mindfulness interruption there.`
        : null,
    ].filter(Boolean),
  };
}

/** SMART goal suggestions derived from journal + ERP data */
export function suggestGoals() {
  const sessions = getSessions();
  const entries = getJournalEntries();

  // Find hierarchy items close to mastery but not yet mastered
  const hierarchy = getHierarchy();
  const suggestions = [];

  hierarchy.forEach((h) => {
    h.items.forEach((item) => {
      if (item.mastered) return;
      const itemSessions = sessions.filter((s) => s.itemId === item.id);
      if (itemSessions.length >= 1 && !item.mastered) {
        suggestions.push({
          id: `sg-${item.id}`,
          title: `Practice "${item.title}" — aim for a ${Math.max(1, item.durationMin - 1)}-min session`,
          delayMinutes: item.durationMin,
          source: "erp",
        });
      }
    });
  });

  // If lots of journal entries without ERP work, suggest beginner exposure
  if (entries.length > 3 && sessions.length === 0) {
    suggestions.push({
      id: "sg-starter",
      title: "Try your first timed ERP exposure today — even 2 minutes counts",
      delayMinutes: 2,
      source: "journal",
    });
  }

  return suggestions.slice(0, 3);
}

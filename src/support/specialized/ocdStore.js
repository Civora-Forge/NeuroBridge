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
 *
 * Extended (2025): SUDS readings, compulsion outcome logs, milestones,
 *   streak calendar, weekly analytics, and therapist-export helpers.
 */

// ─── Key registry ────────────────────────────────────────────────────────────
const KEYS = {
  HIERARCHY:          "nb_ocd_hierarchy",
  SESSIONS:           "nb_ocd_sessions",
  SUDS_LOGS:          "nb_ocd_suds_logs",
  JOURNAL_ENTRIES:    "nb_ocd_journal",
  GOALS:              "nb_ocd_goals",
  MINDFUL_RUNS:       "nb_ocd_mindful_runs",
  COMPULSION_LOGS:    "nb_ocd_compulsion_logs",
  // ── Extended keys (added for premium features) ──
  SUDS_READINGS:      "nb_ocd_suds_readings",   // context-tagged real-time readings
  COMPULSION_OUTCOMES:"nb_ocd_compulsion_outcomes", // delay outcomes with shame-free logging
  MILESTONES:         "nb_ocd_milestones",       // clinical milestone badges
  STREAK_DAYS:        "nb_ocd_streak_days",      // calendar of active days
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
// ─── SUDS Readings ─────────────────────────────────────────────────────────
export function getSudsReadings() { return load(KEYS.SUDS_READINGS, []); }
export function addSudsReading(r) {
  const readings = getSudsReadings();
  const full = { ...r, id: `sr-${Date.now()}`, ts: new Date().toISOString(), hour: new Date().getHours(), dayKey: new Date().toISOString().slice(0,10) };
  save(KEYS.SUDS_READINGS, [full,...readings]); _maybeMarkStreakDay(); return full;
}
export function getDailySudsStats(n=7) {
  const rd=getSudsReadings(); const o={};
  for(let i=0;i<n;i++){const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);o[k]={avg:null,max:null,count:0,readings:[]};}
  rd.forEach(r=>{if(o[r.dayKey]){o[r.dayKey].readings.push(r.value);o[r.dayKey].count++;}});
  Object.keys(o).forEach(k=>{if(o[k].readings.length>0){o[k].avg=Math.round(o[k].readings.reduce((a,v)=>a+v,0)/o[k].readings.length);o[k].max=Math.max(...o[k].readings);}});
  return o;
}
export function detectAnxietySpike(t=70){const recent=getSudsReadings().filter(r=>(Date.now()-new Date(r.ts).getTime())<30*60*1000);return recent.filter(r=>r.value>=t).length>=3;}
export const DELAY_OUTCOMES={RESISTED:"resisted",DELAYED:"delayed",GAVE_IN:"gave_in"};
export function getCompulsionOutcomes(){return load(KEYS.COMPULSION_OUTCOMES,[]);}
export function addCompulsionOutcome(o){const list=getCompulsionOutcomes();const full={...o,id:`co-${Date.now()}`,ts:new Date().toISOString(),dayKey:new Date().toISOString().slice(0,10)};save(KEYS.COMPULSION_OUTCOMES,[full,...list]);_maybeMarkStreakDay();return full;}
export function getResistanceStats(n=30){const since=Date.now()-n*24*60*60*1000;const os=getCompulsionOutcomes().filter(o=>new Date(o.ts).getTime()>since);const t=os.length;if(!t)return{total:0,resistedPct:0,delayedPct:0,gaveInPct:0,resisted:0,delayed:0,gaveIn:0};const rs=os.filter(o=>o.outcome==="resisted").length;const dl=os.filter(o=>o.outcome==="delayed").length;const gi=os.filter(o=>o.outcome==="gave_in").length;return{total:t,resisted:rs,delayed:dl,gaveIn:gi,resistedPct:Math.round(rs/t*100),delayedPct:Math.round(dl/t*100),gaveInPct:Math.round(gi/t*100)};}
function _maybeMarkStreakDay(){const today=new Date().toISOString().slice(0,10);const days=load(KEYS.STREAK_DAYS,[]);if(!days.includes(today))save(KEYS.STREAK_DAYS,[...days,today]);}
export function getStreakDays(){return load(KEYS.STREAK_DAYS,[]);}
export function getStreakStats(){const days=[...getStreakDays()].sort();if(!days.length)return{current:0,longest:0};let longest=1,run=1;for(let i=1;i<days.length;i++){const diff=(new Date(days[i])-new Date(days[i-1]))/(1000*60*60*24);if(diff===1){run++;longest=Math.max(longest,run);}else run=1;}const today=new Date().toISOString().slice(0,10);const daysSince=Math.round((new Date(today)-new Date(days[days.length-1]))/(1000*60*60*24));return{current:daysSince>1?0:run,longest};}
export function getCalendarHeatmap(numDays=84){const sessions=getSessions();const outcomes=getCompulsionOutcomes();const readings=getSudsReadings();const result=[];for(let i=numDays-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);const sc=sessions.filter(s=>s.createdAt?.slice(0,10)===key).length;const oc=outcomes.filter(o=>o.dayKey===key).length;const rc=readings.filter(r=>r.dayKey===key).length;const activity=sc+oc+Math.floor(rc/3);result.push({date:key,level:activity===0?0:Math.min(3,activity<=1?1:activity<=3?2:3),sc,oc,rc});}return result;}
const MILESTONE_DEFS=[{id:"first_session",label:"First Step",desc:"Completed your first ERP session.",icon:"🌱"},{id:"first_mastery",label:"First Mastery",desc:"Mastered your first exposure item.",icon:"⭐"},{id:"streak_7",label:"7-Day Warrior",desc:"Active for 7 consecutive days.",icon:"🔥"},{id:"streak_30",label:"30-Day Champion",desc:"Maintained a 30-day streak.",icon:"🏆"},{id:"first_resist",label:"First Resistance",desc:"Resisted a compulsion for the first time.",icon:"💪"},{id:"sessions_10",label:"10 Exposures",desc:"Logged 10 ERP sessions.",icon:"🎯"},{id:"suds_drop_20",label:"Habituation Hero",desc:"SUDS dropped 20+ points in one session.",icon:"📉"}];
export function getMilestones(){return load(KEYS.MILESTONES,[]);}
export function checkAndEarnMilestones(){const earned=new Set(getMilestones().map(m=>m.id));const sessions=getSessions();const outcomes=getCompulsionOutcomes();const newOnes=[];const checks={first_session:()=>sessions.length>=1,first_mastery:()=>getHierarchy().some(h=>h.items.some(i=>i.mastered)),streak_7:()=>getStreakStats().current>=7,streak_30:()=>getStreakStats().longest>=30,first_resist:()=>outcomes.some(o=>o.outcome==="resisted"),sessions_10:()=>sessions.length>=10,suds_drop_20:()=>sessions.some(s=>s.preSuds!=null&&s.postSuds!=null&&(s.preSuds-s.postSuds)>=20)};MILESTONE_DEFS.forEach(def=>{if(!earned.has(def.id)){try{if(checks[def.id]?.())newOnes.push({...def,earnedAt:new Date().toISOString()});}catch(_){}}});if(newOnes.length>0)save(KEYS.MILESTONES,[...getMilestones(),...newOnes]);return newOnes;}
export function buildTherapistExport(){const sessions=getSessions();const entries=getJournalEntries();const outcomes=getCompulsionOutcomes();const milestones=getMilestones();const streaks=getStreakStats();const resistance=getResistanceStats(30);const insight=buildWeeklyInsight();const avgDrop=sessions.length>0?(sessions.filter(s=>s.preSuds!=null&&s.postSuds!=null).reduce((a,s)=>a+(s.preSuds-s.postSuds),0)/sessions.length).toFixed(1):"N/A";const lines=["═══════════════════════════════════════════════════","   NeuroBridge OCD Progress Report",`   Generated: ${new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}`,"═══════════════════════════════════════════════════","","── ERP SESSION SUMMARY ──────────────────────────",`Total ERP sessions logged:     ${sessions.length}`,`Average SUDS drop per session: ${avgDrop} points`,`Current active streak:         ${streaks.current} day(s)`,`Longest streak:                ${streaks.longest} day(s)`,"","── RESPONSE PREVENTION (Last 30 days) ───────────",`Total delay attempts:   ${resistance.total}`,`Fully resisted:         ${resistance.resisted} (${resistance.resistedPct}%)`,`Delayed then did:       ${resistance.delayed} (${resistance.delayedPct}%)`,`Compulsion performed:   ${resistance.gaveIn} (${resistance.gaveInPct}%)`,"","── THOUGHT JOURNAL ──────────────────────────────",`Total entries:          ${entries.length}`,insight.dominantSubtype!=="Unknown"?`Most frequent subtype:  ${insight.dominantSubtype}`:"",insight.peakHour?`Peak anxiety window:    ${insight.peakHour}`:"","","── MILESTONES EARNED ────────────────────────────",milestones.length===0?"None yet — keep practising.":milestones.map(m=>`  ${m.icon} ${m.label} — ${m.desc}`).join("\n"),"","── CLINICAL NOTE ────────────────────────────────","This report was generated from self-monitored data via NeuroBridge.","Data reflects client-reported measures and should be interpreted","alongside clinical assessment. Not a substitute for therapy.","═══════════════════════════════════════════════════"];return lines.filter(Boolean).join("\n");}

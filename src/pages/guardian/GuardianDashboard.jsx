import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Bell, BookOpen, FileText, ChevronRight, AlertTriangle,
  CheckCircle2, Info, MessageSquarePlus, LogOut, Users,
  ShieldAlert, Sparkles, BarChart2, Link2, ListChecks, Plus, Pencil, Trash2,
} from "lucide-react";
import { useAuth, MOCK_WARD_ACTIVITY } from "@/context/AuthContext";
import { loadWardTasks, saveWardTasks } from "@/lib/wardTaskStore";
import { loadWardSyncData, pushWardActivity, pushWardAlert } from "@/lib/careSyncStore";
import AdaptiveOutcomePanel from "@/components/adaptive/AdaptiveOutcomePanel";

const PROFILE_COLORS = {
  ocd:         { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300" },
  dyslexia:    { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
  adhd:        { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" },
  default:     { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
};

const ACTIVITY_ICONS = {
  positive: CheckCircle2,
  neutral:  Info,
  alert:    AlertTriangle,
};
const ACTIVITY_COLORS = {
  positive: "text-emerald-500",
  neutral:  "text-slate-400",
  alert:    "text-red-400",
};
const ALERT_LEVELS = {
  high:   { cls: "bg-red-500/10 border-red-400/30 text-red-400",    label: "High" },
  medium: { cls: "bg-amber-500/10 border-amber-400/30 text-amber-400", label: "Medium" },
  low:    { cls: "bg-sky-500/10 border-sky-400/30 text-sky-400",    label: "Low" },
};
const RUNTIME_SYNC_WARD_KEY = "nb_runtime_sync_ward_id";

function readRuntimeSyncWardId() {
  try {
    const value = localStorage.getItem(RUNTIME_SYNC_WARD_KEY);
    return value && value.startsWith("nb-user-") ? value : null;
  } catch {
    return null;
  }
}

function writeRuntimeSyncWardId(wardId) {
  if (!wardId || !String(wardId).startsWith("nb-user-")) return;
  try {
    localStorage.setItem(RUNTIME_SYNC_WARD_KEY, wardId);
  } catch {
  }
}

// ─────────────────────────────────────────────
//  Card-flip wrapper
// ─────────────────────────────────────────────
function CardFlip({ front, back, flipped }) {
  return (
    <div style={{ perspective: "1200px" }} className="w-full">
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: "preserve-3d", position: "relative" }}
        className="w-full"
      >
        {/* Front */}
        <div style={{ backfaceVisibility: "hidden" }} className="w-full">
          {front}
        </div>
        {/* Back */}
        <div
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", top: 0, left: 0, width: "100%" }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Section title helper
// ─────────────────────────────────────────────
function SectionTitle({ icon: Icon, children, color = "text-violet-500" }) {
  return (
    <h3 className={`flex items-center gap-2 font-semibold mb-4 ${color}`}>
      <Icon className="w-4 h-4" />
      {children}
    </h3>
  );
}

// ─────────────────────────────────────────────
//  WardStats — the "back" of the flip card
// ─────────────────────────────────────────────
function WardStats({ ward, onBack }) {
  const data = MOCK_WARD_ACTIVITY[ward.id];
  const profile = ward.profile || "default";
  const pal = PROFILE_COLORS[profile] || PROFILE_COLORS.default;

  return (
    <div className="neuro-card p-6 space-y-4 bg-gradient-to-br from-violet-50/50 to-slate-50 dark:from-violet-900/10 dark:to-slate-900/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Viewing progress for</p>
          <p className="font-bold text-lg">{data?.name}</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground transition border border-border rounded-xl px-3 py-1.5"
        >
          ← Back
        </button>
      </div>

      {/* Weekly stat pills */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(data?.weeklyStats ?? {}).map(([k, v]) => (
          <div key={k} className={`rounded-2xl p-3 ${pal.bg}`}>
            <p className={`text-xl font-bold ${pal.text}`}>{v}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {k.replace(/([A-Z])/g, " $1").toLowerCase()}
            </p>
          </div>
        ))}
      </div>

      {/* Today's timeline */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Timeline</p>
        <ol className="relative border-l border-violet-200 dark:border-violet-800 space-y-4 pl-5">
          {(data?.today ?? []).map((e, i) => {
            const Icon = ACTIVITY_ICONS[e.type] || Info;
            return (
              <li key={i} className="relative">
                <span className={`absolute -left-[1.35rem] top-0.5 ${ACTIVITY_COLORS[e.type]}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <p className="text-xs text-muted-foreground">{e.time}</p>
                <p className="text-sm leading-snug">{e.event}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  WardCard — summary card on the "front" face
// ─────────────────────────────────────────────
function WardCard({ wardId, onFlip }) {
  const data = MOCK_WARD_ACTIVITY[wardId];
  if (!data) return null;
  const profile = data.profile || "default";
  const pal = PROFILE_COLORS[profile] || PROFILE_COLORS.default;
  const unresolvedAlerts = (data.alerts ?? []).filter((a) => !a.resolved).length;

  return (
    <div className="neuro-card p-5 bg-gradient-to-br from-violet-50/40 to-slate-50/60 dark:from-violet-900/10 dark:to-slate-900/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
            <Heart className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <p className="font-semibold">{data.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pal.bg} ${pal.text}`}>
              {data.profile?.toUpperCase() ?? "—"}
            </span>
          </div>
        </div>
        <button
          onClick={() => onFlip(wardId)}
          className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 font-medium transition"
        >
          Progress <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        {Object.entries(data.weeklyStats).slice(0, 3).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/60 dark:bg-white/5 py-2 px-1">
            <p className="text-base font-bold text-violet-600 dark:text-violet-400">{v}</p>
            <p className="text-[10px] text-muted-foreground capitalize leading-tight">
              {k.replace(/([A-Z])/g, " $1").toLowerCase()}
            </p>
          </div>
        ))}
      </div>

      {unresolvedAlerts > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs bg-red-500/10 text-red-400 rounded-xl px-3 py-2 border border-red-400/20">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {unresolvedAlerts} unresolved alert{unresolvedAlerts > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main GuardianDashboard
// ─────────────────────────────────────────────
export default function GuardianDashboard() {
  const { user, logout, postGuardianNote } = useAuth();
  const navigate = useNavigate();

  const wardIds = useMemo(() => {
    const raw = Array.isArray(user?.linkedWardIds) ? user.linkedWardIds : [];
    const normalized = raw
      .map((id) => {
        const value = String(id || "").trim();
        return value.startsWith("nb-user-") ? value : null;
      })
      .filter(Boolean);

    if (normalized.length > 0) {
      return [...new Set(normalized)];
    }

    const email = String(user?.email || "").toLowerCase();
    if (email.includes("neha") || email.includes("riya") || user?.id === "nb-guardian-088") {
      return ["nb-user-088"];
    }

    return ["nb-user-088"];
  }, [user?.linkedWardIds, user?.email, user?.id]);
  const [syncWardId, setSyncWardId] = useState(() => readRuntimeSyncWardId() || wardIds[0] || "nb-user-088");

  const [activeTab, setActiveTab] = useState("overview");
  const [flippedWardId, setFlippedWardId] = useState(null);
  const [journalText, setJournalText] = useState("");
  const [journalWardId, setJournalWardId] = useState(wardIds[0] ?? null);
  const [noteSent, setNoteSent] = useState(false);
  const [resolvedAlerts, setResolvedAlerts] = useState([]);
  const [taskWardId, setTaskWardId] = useState(wardIds[0] ?? null);
  const [tasksByWard, setTasksByWard] = useState(() => loadWardTasks(wardIds));
  const [taskDraft, setTaskDraft] = useState({ title: "", time: "" });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: "", time: "" });
  const syncedWardData = useMemo(
    () =>
      wardIds.reduce((acc, id) => {
        acc[id] = loadWardSyncData(id, MOCK_WARD_ACTIVITY[id] ?? {});
        return acc;
      }, {}),
    [wardIds, activeTab],
  );

  const allAlerts = wardIds.flatMap((id) =>
    (syncedWardData[id]?.alerts ?? []).map((a) => ({ ...a, wardId: id, wardName: syncedWardData[id]?.name || MOCK_WARD_ACTIVITY[id]?.name })),
  );
  const guardianVisibleAlerts = allAlerts.filter(
    (alert) => !(alert?.source === "guardian" && (alert?.kind === "task-update" || alert?.kind === "schedule-change")),
  );
  const allNotes = wardIds.flatMap((id) =>
    (syncedWardData[id]?.journalNotes ?? []).map((n) => ({ ...n, wardId: id, wardName: syncedWardData[id]?.name || MOCK_WARD_ACTIVITY[id]?.name })),
  );
  const activeWardTasks = taskWardId ? tasksByWard[taskWardId] ?? [] : [];

  function setActiveWardId(wardId) {
    setSyncWardId(wardId);
    setTaskWardId(wardId);
    setJournalWardId(wardId);
    writeRuntimeSyncWardId(wardId);
  }

  useEffect(() => {
    const hydrated = loadWardTasks(wardIds);

    try {
      const raw = localStorage.getItem("nb_guardian_ward_tasks");
      const parsed = raw ? JSON.parse(raw) : {};
      const legacyKeys = Object.keys(parsed || {}).filter((key) => !String(key).startsWith("nb-user-"));
      if (wardIds.length > 0 && legacyKeys.length > 0) {
        const firstWard = wardIds[0];
        const existing = hydrated[firstWard] || [];
        if (existing.length === 0) {
          const legacyTasks = parsed[legacyKeys[0]];
          if (Array.isArray(legacyTasks) && legacyTasks.length > 0) {
            hydrated[firstWard] = legacyTasks;
            saveWardTasks(hydrated);
          }
        }
      }
    } catch {
    }

    setTasksByWard(hydrated);

    if (wardIds.length === 0) {
      setJournalWardId(null);
      setTaskWardId(null);
      return;
    }

    const runtimeWard = readRuntimeSyncWardId();
    const preferredWard = wardIds.includes(runtimeWard) ? runtimeWard : wardIds[0];

    if (syncWardId !== preferredWard) {
      setSyncWardId(preferredWard);
    }
    if (!wardIds.includes(journalWardId) || journalWardId !== preferredWard) {
      setJournalWardId(preferredWard);
    }
    if (!wardIds.includes(taskWardId) || taskWardId !== preferredWard) {
      setTaskWardId(preferredWard);
    }
    writeRuntimeSyncWardId(preferredWard);
  }, [user?.id, wardIds]);

  async function handleSendNote() {
    if (!journalText.trim() || !journalWardId) return;
    await postGuardianNote(journalWardId, journalText.trim());
    setJournalText("");
    setNoteSent(true);
    setTimeout(() => setNoteSent(false), 2500);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function updateWardTasks(wardId, nextTasks) {
    const next = {
      ...tasksByWard,
      [wardId]: nextTasks,
    };
    setTasksByWard(next);
    saveWardTasks(next);
  }

  function handleAddTask() {
    if (!taskWardId || !taskDraft.title.trim()) return;
    const task = {
      id: `g-${Date.now()}`,
      title: taskDraft.title.trim(),
      time: taskDraft.time.trim(),
      done: false,
    };
    updateWardTasks(taskWardId, [task, ...activeWardTasks]);
    pushWardActivity(taskWardId, {
      event: `Guardian added task: ${task.title}`,
      type: "neutral",
    });
    pushWardAlert(taskWardId, {
      level: "low",
      message: `New task added by guardian: ${task.title}`,
      source: "guardian",
      kind: "task-update",
    });
    setTaskDraft({ title: "", time: "" });
  }

  function handleDeleteTask(taskId) {
    if (!taskWardId) return;
    const deleted = activeWardTasks.find((task) => task.id === taskId);
    const filtered = activeWardTasks.filter((task) => task.id !== taskId);
    updateWardTasks(taskWardId, filtered);
    if (deleted) {
      pushWardActivity(taskWardId, {
        event: `Guardian deleted task: ${deleted.title}`,
        type: "neutral",
      });
      pushWardAlert(taskWardId, {
        level: "medium",
        message: `Task removed by guardian: ${deleted.title}`,
        source: "guardian",
        kind: "task-update",
      });
    }
    if (editingTaskId === taskId) {
      setEditingTaskId(null);
      setEditDraft({ title: "", time: "" });
    }
  }

  function handleStartEditTask(task) {
    setEditingTaskId(task.id);
    setEditDraft({ title: task.title ?? "", time: task.time ?? "" });
  }

  function handleSaveEditTask() {
    if (!taskWardId || !editingTaskId || !editDraft.title.trim()) return;
    const previous = activeWardTasks.find((task) => task.id === editingTaskId);
    const updated = activeWardTasks.map((task) => {
      if (task.id !== editingTaskId) return task;
      return {
        ...task,
        title: editDraft.title.trim(),
        time: editDraft.time.trim(),
      };
    });
    updateWardTasks(taskWardId, updated);
    pushWardActivity(taskWardId, {
      event: `Guardian updated task: ${editDraft.title.trim()}`,
      type: "neutral",
    });
    pushWardAlert(taskWardId, {
      level: "low",
      message: `Task updated by guardian: ${previous?.title || "task"} → ${editDraft.title.trim()}`,
      source: "guardian",
      kind: "task-update",
    });
    setEditingTaskId(null);
    setEditDraft({ title: "", time: "" });
  }

  function handleSimulateScheduleChangeAlert() {
    if (!taskWardId) return;
    const wardName = MOCK_WARD_ACTIVITY[taskWardId]?.name || "ward";
    pushWardActivity(taskWardId, {
      event: "Guardian simulated a schedule change alert",
      type: "alert",
    });
    pushWardAlert(taskWardId, {
      level: "high",
      message: `${wardName}, schedule changed. Check updated routine and use calm-breath mode before transition.`,
      source: "guardian",
      kind: "schedule-change",
    });
  }

  const tabs = [
    { id: "overview",   label: "Day-at-a-Glance", icon: Sparkles },
    { id: "tasks",      label: "Tasks",            icon: ListChecks },
    { id: "alerts",     label: "Alerts",           icon: Bell },
    { id: "journal",    label: "Shared Journal",   icon: BookOpen },
    { id: "export",     label: "Reports",          icon: FileText },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      {/* ── Header ─────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Heart className="w-4 h-4 text-violet-500" />
            </div>
            <h1 className="text-2xl font-bold">Care-Circle Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome, <span className="font-medium text-foreground">{user?.name}</span>
            {" · "}
            <span className="text-violet-500">{wardIds.length} ward{wardIds.length !== 1 ? "s" : ""} linked</span>
          </p>
          <p className="text-xs text-amber-500 mt-1">Sync Ward Key: {syncWardId || "nb-user-088"}</p>
        </div>
        <button
          onClick={handleLogout}
          className="neuro-btn-outline flex items-center gap-2 text-sm"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>

      {/* ── Privacy reminder banner ─────────── */}
      <div className="rounded-2xl border border-violet-300/30 bg-violet-500/5 px-4 py-3 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-violet-300/80 leading-relaxed">
          <span className="font-semibold text-violet-300">Privacy-First.</span>
          {" "}Your ward controls what data is shared with you. Private journal entries and unshared activities are not visible here. This space is for support, not surveillance.
        </p>
      </div>

      <AdaptiveOutcomePanel
        targetId={syncWardId || wardIds[0]}
        title={`Predictive Care Model · ${MOCK_WARD_ACTIVITY[syncWardId || wardIds[0]]?.name || "Ward"}`}
        compact
      />

      {/* ── Tabs ───────────────────────────── */}
      <div className="flex gap-1 flex-wrap border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
              activeTab === id
                ? "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-b-2 border-violet-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════ */}
      {/* TAB: OVERVIEW — Day at a Glance     */}
      {/* ════════════════════════════════════ */}
      {activeTab === "overview" && (
        <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Click <strong>Progress</strong> on any ward card to flip it and see their detailed weekly stats.
          </p>

          {wardIds.map((wardId) => {
            const isFlipped = flippedWardId === wardId;
            return (
              <CardFlip
                key={wardId}
                flipped={isFlipped}
                front={
                  <WardCard
                    wardId={wardId}
                    onFlip={(id) => setFlippedWardId(id)}
                  />
                }
                back={
                  <WardStats
                    ward={{ id: wardId, profile: MOCK_WARD_ACTIVITY[wardId]?.profile }}
                    onBack={() => setFlippedWardId(null)}
                  />
                }
              />
            );
          })}
        </motion.div>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: ALERTS                          */}
      {/* ════════════════════════════════════ */}
      {activeTab === "alerts" && (
        <motion.div key="alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <SectionTitle icon={Bell} color="text-red-500">Safety &amp; Meltdown Alerts</SectionTitle>

          {guardianVisibleAlerts.length === 0 ? (
            <div className="neuro-card p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No alerts right now. Everything looks calm 💚</p>
            </div>
          ) : (
            guardianVisibleAlerts.map((a) => {
              const lvl = ALERT_LEVELS[a.level] ?? ALERT_LEVELS.low;
              const resolved = resolvedAlerts.includes(a.id) || a.resolved;
              return (
                <motion.div
                  key={a.id}
                  layout
                  className={`rounded-2xl border p-4 flex items-start gap-3 ${resolved ? "opacity-40" : ""} ${lvl.cls}`}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-wide">{lvl.label}</span>
                      <span className="text-xs text-muted-foreground">{a.wardName} · {a.ts}</span>
                    </div>
                    <p className="text-sm mt-0.5">{a.message}</p>
                  </div>
                  {!resolved && (
                    <button
                      onClick={() => setResolvedAlerts((p) => [...p, a.id])}
                      className="text-xs border border-current rounded-lg px-2 py-1 opacity-70 hover:opacity-100 flex-shrink-0 transition"
                    >
                      Resolve
                    </button>
                  )}
                  {resolved && (
                    <span className="text-xs text-emerald-400 flex-shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Done
                    </span>
                  )}
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: TASKS                           */}
      {/* ════════════════════════════════════ */}
      {activeTab === "tasks" && (
        <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <SectionTitle icon={ListChecks} color="text-violet-500">Task Management</SectionTitle>

          <div className="neuro-card p-5 space-y-3 bg-gradient-to-br from-violet-50/40 to-slate-50/40 dark:from-violet-900/10 dark:to-slate-900/10">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-medium text-foreground">Manage shared ASD routine tasks for your ward</p>
              <button
                onClick={() => navigate("/asd")}
                className="text-xs px-3 py-1.5 rounded-xl border border-violet-300/40 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 transition"
              >
                Open ASD Manager
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {wardIds.map((id) => (
                <button
                  key={id}
                  onClick={() => setActiveWardId(id)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition font-medium ${
                    taskWardId === id
                      ? "bg-violet-500/15 border-violet-400/50 text-violet-500"
                      : "border-border text-muted-foreground hover:border-violet-300/40"
                  }`}
                >
                  {MOCK_WARD_ACTIVITY[id]?.name}
                </button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={taskDraft.title}
                onChange={(e) => setTaskDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
                className="sm:col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
              />
              <input
                type="time"
                value={taskDraft.time}
                onChange={(e) => setTaskDraft((prev) => ({ ...prev, time: e.target.value }))}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAddTask}
              disabled={!taskDraft.title.trim() || !taskWardId}
              className="neuro-btn text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Task
            </motion.button>

            <button
              onClick={handleSimulateScheduleChangeAlert}
              disabled={!taskWardId}
              className="text-xs px-3 py-1.5 rounded-xl border border-amber-300/40 text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
            >
              Simulate Schedule Change Alert
            </button>
          </div>

          <div className="space-y-3">
            {activeWardTasks.length === 0 ? (
              <div className="neuro-card p-6 text-sm text-muted-foreground text-center">
                No tasks yet for this ward. Add one above to begin shared planning.
              </div>
            ) : (
              activeWardTasks.map((task) => (
                <div key={task.id} className="neuro-card p-4 space-y-3">
                  {editingTaskId === task.id ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input
                          type="text"
                          value={editDraft.title}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                          className="sm:col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                        />
                        <input
                          type="time"
                          value={editDraft.time}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, time: e.target.value }))}
                          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveEditTask}
                          disabled={!editDraft.title.trim()}
                          className="text-xs px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingTaskId(null);
                            setEditDraft({ title: "", time: "" });
                          }}
                          className="text-xs px-3 py-1.5 rounded-xl border border-border text-muted-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{task.time || "No time set"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEditTask(task)}
                          className="text-xs px-2.5 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-xs px-2.5 py-1.5 rounded-xl border border-red-300/40 text-red-500 hover:bg-red-500/10 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: SHARED JOURNAL                  */}
      {/* ════════════════════════════════════ */}
      {activeTab === "journal" && (
        <motion.div key="journal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <SectionTitle icon={BookOpen} color="text-violet-500">Collaborative Space</SectionTitle>

          {/* Write note */}
          <div className="neuro-card p-5 space-y-3 bg-gradient-to-br from-violet-50/40 to-slate-50/40 dark:from-violet-900/10 dark:to-slate-900/10">
            <p className="text-sm font-medium flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-violet-500" />
              Leave a positive reinforcement note
            </p>

            {/* Ward selector */}
            <div className="flex gap-2 flex-wrap">
              {wardIds.map((id) => (
                <button
                  key={id}
                  onClick={() => setActiveWardId(id)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition font-medium ${
                    journalWardId === id
                      ? "bg-violet-500/15 border-violet-400/50 text-violet-500"
                      : "border-border text-muted-foreground hover:border-violet-300/40"
                  }`}
                >
                  {MOCK_WARD_ACTIVITY[id]?.name}
                </button>
              ))}
            </div>

            <textarea
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Write something encouraging… (e.g. 'So proud of your ERP session today! 🌟')"
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            />

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSendNote}
              disabled={!journalText.trim()}
              className="neuro-btn text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {noteSent ? (
                <><CheckCircle2 className="w-4 h-4" /> Note sent!</>
              ) : (
                <><MessageSquarePlus className="w-4 h-4" /> Send to Ward</>
              )}
            </motion.button>
          </div>

          {/* Existing notes */}
          <div className="space-y-3">
            {allNotes.map((n) => (
              <div
                key={n.id}
                className={`rounded-2xl border p-4 ${
                  n.from === "guardian"
                    ? "border-violet-300/30 bg-violet-500/5"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${n.from === "guardian" ? "text-violet-500" : "text-slate-500"}`}>
                    {n.from === "guardian" ? user?.name ?? "You" : n.wardName}
                  </span>
                  <span className="text-xs text-muted-foreground">· {n.ts}</span>
                </div>
                <p className="text-sm leading-relaxed">{n.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: EXPORT / REPORTS                */}
      {/* ════════════════════════════════════ */}
      {activeTab === "export" && (
        <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <SectionTitle icon={FileText} color="text-slate-500">Clinical Progress Reports</SectionTitle>

          <div className="neuro-card p-5 border-l-4 border-l-violet-500 bg-violet-500/5">
            <p className="text-sm font-medium text-violet-600 dark:text-violet-300">
              Export a Clinical Summary PDF
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Share this report directly with your ward's therapist, ASHA worker, or school counsellor. The PDF includes ERP progress, mood trends, and goal completion rates.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {wardIds.map((wardId) => {
              const data = MOCK_WARD_ACTIVITY[wardId];
              if (!data) return null;
              const pal = PROFILE_COLORS[data.profile] || PROFILE_COLORS.default;
              return (
                <div key={wardId} className="neuro-card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                      <BarChart2 className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="font-semibold">{data.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pal.bg} ${pal.text}`}>
                        {data.profile?.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    {Object.entries(data.weeklyStats).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                        <span className="font-semibold text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => alert(`PDF export for ${data.name} coming soon — wire to therapistExport.ts`)}
                    className="neuro-btn w-full text-sm flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> Export PDF
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            PDF generation uses <code className="font-mono text-violet-400">pdf-lib</code> via the existing <code className="font-mono text-violet-400">therapistExport.ts</code> service — swap <code className="font-mono text-violet-400">alert()</code> with the real call when mobile is wired.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Shield, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth, CARE_LINK_REGISTRY, MOCK_WARD_ACTIVITY } from "@/context/AuthContext";
import { ALL_DISORDERS, DISORDER_META } from "@/lib/disorders";
import { loadWardTasks, saveWardTasks, toAsdRoutineTask, fromAsdRoutineTask } from "@/lib/wardTaskStore";
import { loadWardSyncData, pushWardActivity, pushWardAlert } from "@/lib/careSyncStore";
import RoutineVisualizer from "./RoutineVisualizer";
import SensoryMonitor from "./SensoryMonitor";
import SocialStoryBuilder from "./SocialStoryBuilder";
import MeltdownPrevention from "./MeltdownPrevention";
import EmotionCards from "./EmotionCards";

const ROLE_FALLBACK = "user";
const ASD_PROFILE_PREFIX = "nb_asd_profile_";
const ASD_STORIES_PREFIX = "nb_asd_stories_";
const ASD_MELTDOWN_PREFIX = "nb_asd_meltdown_";
const ASD_WARD_ALERT_SEEN_PREFIX = "nb_asd_seen_alert_";
const ASD_WARD_SETTINGS_PREFIX = "nb_asd_ward_settings_";
const RUNTIME_SYNC_WARD_KEY = "nb_runtime_sync_ward_id";

const createStep = (id, text, image_url = "") => ({ id, text, image_url });

const EMOTION_STATES = [
  {
    label: "Calm",
    supportText: "I feel calm. I can continue my plan one small step at a time.",
    risk: "low",
  },
  {
    label: "Excited",
    supportText: "I feel excited. I will take one deep breath so my body stays steady.",
    risk: "low",
  },
  {
    label: "Worried",
    supportText: "I feel worried. I can ask one clear question and use my breathing card.",
    risk: "moderate",
  },
  {
    label: "Frustrated",
    supportText: "I feel frustrated. I can pause, stretch my hands, and try again slowly.",
    risk: "moderate",
  },
  {
    label: "Overwhelmed",
    supportText: "I feel overwhelmed. I need a quiet break and support from my coping plan.",
    risk: "high",
  },
  {
    label: "Upset",
    supportText: "I feel upset. I will move to a safe space and do five calm breaths.",
    risk: "high",
  },
];

const getBuiltInStories = (name = "the child") => [
  {
    id: "builtin-school-day",
    user_id: "builtin",
    title: "Going to School Calmly",
    steps: [
      createStep("school-1", `🏫 ${name} checks the plan for the day.`),
      createStep("school-2", "🚌 Travel to school with one calm breath."),
      createStep("school-3", "👋 Say hello to teacher/class with a simple greeting."),
      createStep("school-4", "🌿 If noise is high, use headphones or quiet breathing."),
      createStep("school-5", "✅ Complete one class task at a time."),
      createStep("school-6", "🎉 End of day: celebrate effort, not perfection."),
    ],
    content: `🏫 ${name} checks the plan for the day.`,
    is_builtin: true,
  },
  {
    id: "builtin-routine-change",
    user_id: "builtin",
    title: "When Plans Change",
    steps: [
      createStep("change-1", "⚠️ Plans changed. Pause and take one breath."),
      createStep("change-2", "📋 Look at the updated plan with support."),
      createStep("change-3", "❓ Ask one clear question about what happens next."),
      createStep("change-4", "🌿 Pick one calming strategy before moving on."),
    ],
    content: "⚠️ Plans changed. Pause and take one breath.",
    is_builtin: true,
  },
  {
    id: "builtin-bus-delay",
    user_id: "builtin",
    title: "When the Bus Is Delayed",
    steps: [
      createStep("bus-1", "🚌 The bus is late. I stop and take one deep breath."),
      createStep("bus-2", "📱 I check the updated timing with my guardian or teacher."),
      createStep("bus-3", "🎧 I use headphones or a calming sound while waiting."),
      createStep("bus-4", "✅ I follow the new plan one step at a time."),
    ],
    content: "🚌 The bus is late. I stop and take one deep breath.",
    is_builtin: true,
  },
  {
    id: "builtin-cafeteria-noise",
    user_id: "builtin",
    title: "Handling Cafeteria Noise",
    steps: [
      createStep("noise-1", "🔊 The cafeteria is loud and my body feels tense."),
      createStep("noise-2", "🌿 I move to a quieter corner or use ear protection."),
      createStep("noise-3", "🤝 I tell an adult: 'I need a calm minute please'."),
      createStep("noise-4", "🍽️ I return when I feel ready and finish at my pace."),
    ],
    content: "🔊 The cafeteria is loud and my body feels tense.",
    is_builtin: true,
  },
  {
    id: "builtin-substitute-teacher",
    user_id: "builtin",
    title: "New Teacher, Same Calm Plan",
    steps: [
      createStep("teacher-1", "👩‍🏫 Today there is a substitute teacher."),
      createStep("teacher-2", "📋 I look at my routine card for what stays the same."),
      createStep("teacher-3", "💬 I ask one simple question if I feel unsure."),
      createStep("teacher-4", "⭐ I complete one task and celebrate effort."),
    ],
    content: "👩‍🏫 Today there is a substitute teacher.",
    is_builtin: true,
  },
];

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const readRuntimeSyncWardId = () => {
  try {
    const value = localStorage.getItem(RUNTIME_SYNC_WARD_KEY);
    return value && value.startsWith("nb-user-") ? value : null;
  } catch {
    return null;
  }
};

const writeRuntimeSyncWardId = (wardId) => {
  if (!wardId || !String(wardId).startsWith("nb-user-")) return;
  try {
    localStorage.setItem(RUNTIME_SYNC_WARD_KEY, wardId);
  } catch {
  }
};

const PROFILE_TO_DISORDER = {
  asd: "asd",
  anxiety: "anxiety",
  ocd: "ocd",
  dyslexia: "dyslexia",
  adhd: "adhd",
  dyspraxia: "dyspraxia",
  dyscalculia: "dyscalculia",
  depression: "depression",
  apd: "apd",
};

const getDefaultWardSettings = ({ wardId, user, role }) => {
  const fallbackDisorder = PROFILE_TO_DISORDER[MOCK_WARD_ACTIVITY[wardId]?.profile] || "asd";
  const disorders =
    role === "user" && user?.id === wardId && Array.isArray(user?.disorders) && user.disorders.length > 0
      ? user.disorders
      : [fallbackDisorder];

  const privacy =
    role === "user" && user?.id === wardId && user?.privacy
      ? user.privacy
      : { shareActivity: true, shareJournal: true, shareAlerts: true };

  return { disorders, privacy };
};

const normalizeWardId = (wardId) => {
  const raw = String(wardId || "").trim();
  if (!raw) return null;
  if (raw.startsWith("nb-user-")) return raw;
  const mapped = CARE_LINK_REGISTRY[raw.toUpperCase()];
  return mapped || null;
};

const resolveCanonicalWardId = (user, role) => {
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
};

const getCandidateWardIds = ({ targetWardId, appUser, currentUser }) => {
  const candidates = [
    targetWardId,
    appUser?.id,
    currentUser?.id,
    appUser?.careLinkId ? CARE_LINK_REGISTRY[String(appUser.careLinkId).toUpperCase()] : null,
  ].filter(Boolean);
  return [...new Set(candidates)];
};

const loadAndNormalizeWardTasks = ({ targetWardId, appUser, currentUser }) => {
  const tasksByWard = loadWardTasks();
  const canonical = tasksByWard[targetWardId];
  if (Array.isArray(canonical) && canonical.length > 0) {
    return canonical;
  }

  const candidates = getCandidateWardIds({ targetWardId, appUser, currentUser }).filter((id) => id !== targetWardId);
  for (const legacyId of candidates) {
    const legacyTasks = tasksByWard[legacyId];
    if (Array.isArray(legacyTasks) && legacyTasks.length > 0) {
      tasksByWard[targetWardId] = legacyTasks;
      saveWardTasks(tasksByWard);
      return legacyTasks;
    }
  }

  return [];
};

export default function ASDModule() {
  const { user: appUser, role: appRole, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("routine");

  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(ROLE_FALLBACK);
  const [targetWardId, setTargetWardId] = useState(null);

  const [routines, setRoutines] = useState([]);
  const [sensoryProfile, setSensoryProfile] = useState(null);
  const [stories, setStories] = useState([]);
  const [meltdownLogs, setMeltdownLogs] = useState([]);
  const [emotionCheckin, setEmotionCheckin] = useState("Calm");
  const [wardAlerts, setWardAlerts] = useState([]);
  const [wardSettings, setWardSettings] = useState({ disorders: [], privacy: {} });
  const lastToastAlertIdRef = useRef(null);

  const hasLinkedWards = Array.isArray(appUser?.linkedWardIds) && appUser.linkedWardIds.length > 0;
  const isGuardian = role === "guardian";
  const isManagerMode = isGuardian || role === "admin";
  const canEditRoutine = isManagerMode;
  const canEditThresholds = isManagerMode;
  const canManageStories = isManagerMode;
  const canViewMeltdownLogs = isManagerMode;
  const canUseCalmingTools = role === "user" || role === "guardian";
  const isAdmin = role === "admin";
  const showEmotionFeature = !isAdmin && role === "user";

  const wardOptions = useMemo(() => {
    const linkedIds = Array.isArray(appUser?.linkedWardIds) ? appUser.linkedWardIds : [];
    const normalizedLinked = [...new Set(linkedIds.map(normalizeWardId).filter(Boolean))];
    if (normalizedLinked.length === 0 && isGuardian) {
      return [{ id: "nb-user-088", name: "Riya Sen" }];
    }
    return normalizedLinked.map((id) => ({ id, name: id === "nb-user-088" ? "Riya Sen" : id }));
  }, [appUser?.linkedWardIds, isGuardian]);

  useEffect(() => {
    if (authLoading) return;

    setLoading(true);
    setError("");

    if (!isAuthenticated || !appUser?.id) {
      setError("User session is unavailable in the app. Please open this page after logging in.");
      setLoading(false);
      return;
    }

    const resolvedRole = appRole || appUser?.role || ROLE_FALLBACK;
    const resolvedWardId = resolveCanonicalWardId(appUser, resolvedRole);

    setCurrentUser(appUser);
    setRole(resolvedRole);
    setTargetWardId(resolvedWardId);
    writeRuntimeSyncWardId(resolvedWardId);
    setLoading(false);
  }, [authLoading, isAuthenticated, appUser?.id, appRole, isManagerMode]);

  useEffect(() => {
    if (!targetWardId || !currentUser) return;

    setLoading(true);
    const builtInStories = getBuiltInStories(currentUser.name);

    const wardTaskList = loadAndNormalizeWardTasks({ targetWardId, appUser, currentUser });
    setRoutines(wardTaskList.map((task) => toAsdRoutineTask(task, targetWardId)));

    setSensoryProfile(
      readJson(`${ASD_PROFILE_PREFIX}${targetWardId}`, {
        user_id: targetWardId,
        sound_threshold: 60,
        light_threshold: 60,
        crowd_threshold: 50,
        notes: "Local ASD profile",
      }),
    );

    const customStories = readJson(`${ASD_STORIES_PREFIX}${targetWardId}`, []);
    setStories([...builtInStories, ...customStories]);
    setMeltdownLogs(readJson(`${ASD_MELTDOWN_PREFIX}${targetWardId}`, []));
    const syncData = loadWardSyncData(targetWardId, {});
    setWardAlerts((syncData.alerts || []).slice(0, 12));
    setWardSettings(
      readJson(
        `${ASD_WARD_SETTINGS_PREFIX}${targetWardId}`,
        getDefaultWardSettings({ wardId: targetWardId, user: currentUser, role }),
      ),
    );

    setLoading(false);
  }, [targetWardId, currentUser?.id, currentUser?.name, role, appUser?.id, appUser?.careLinkId]);

  useEffect(() => {
    if (!targetWardId) return;

    const refresh = () => {
      const wardTaskList = loadAndNormalizeWardTasks({ targetWardId, appUser, currentUser });
      setRoutines(wardTaskList.map((task) => toAsdRoutineTask(task, targetWardId)));
      setSensoryProfile(readJson(`${ASD_PROFILE_PREFIX}${targetWardId}`, sensoryProfile || null));
      const builtInStories = getBuiltInStories(currentUser?.name || "the child");
      const customStories = readJson(`${ASD_STORIES_PREFIX}${targetWardId}`, []);
      setStories([...builtInStories, ...customStories]);
      setMeltdownLogs(readJson(`${ASD_MELTDOWN_PREFIX}${targetWardId}`, []));
      const syncData = loadWardSyncData(targetWardId, {});
      setWardAlerts((syncData.alerts || []).slice(0, 12));
      setWardSettings(
        readJson(
          `${ASD_WARD_SETTINGS_PREFIX}${targetWardId}`,
          getDefaultWardSettings({ wardId: targetWardId, user: currentUser, role }),
        ),
      );
    };

    const refreshFromFocus = () => {
      refresh();
    };

    const refreshFromVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const timer = setInterval(refresh, 2500);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refreshFromFocus);
    document.addEventListener("visibilitychange", refreshFromVisibility);

    refresh();

    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refreshFromFocus);
      document.removeEventListener("visibilitychange", refreshFromVisibility);
    };
  }, [targetWardId, currentUser?.name, currentUser?.id, role, sensoryProfile, appUser?.id, appUser?.careLinkId]);

  const persistRoutines = (nextRoutines) => {
    if (!targetWardId) return;
    const tasksByWard = loadWardTasks();
    tasksByWard[targetWardId] = nextRoutines.map(fromAsdRoutineTask);
    saveWardTasks(tasksByWard);
  };

  const addRoutineTask = ({ title, timeLabel }) => {
    if (!canEditRoutine || !targetWardId) return;

    const next = [
      ...routines,
      {
        id: `local-${Date.now()}`,
        user_id: targetWardId,
        title,
        time_label: timeLabel || null,
        is_completed: false,
      },
    ];

    setRoutines(next);
    persistRoutines(next);
    pushWardActivity(targetWardId, { event: `Routine added: ${title}`, type: "neutral" });
    if (role === "guardian") {
      pushWardAlert(targetWardId, {
        level: "low",
        message: `New task added by guardian: ${title}`,
        source: "guardian",
        kind: "task-update",
      });
    }
  };

  const toggleTaskCompletion = (task) => {
    const next = routines.map((item) =>
      item.id === task.id ? { ...item, is_completed: !item.is_completed } : item,
    );
    setRoutines(next);
    persistRoutines(next);
    if (targetWardId && !task.is_completed) {
      pushWardActivity(targetWardId, { event: `${task.title} marked complete`, type: "positive" });
    }
  };

  const editRoutineTask = (task, patch) => {
    if (!canEditRoutine) return;
    const next = routines.map((item) =>
      item.id === task.id
        ? {
            ...item,
            title: patch?.title ?? item.title,
            time_label: patch?.time_label ?? item.time_label,
          }
        : item,
    );
    setRoutines(next);
    persistRoutines(next);
    if (targetWardId) {
      pushWardActivity(targetWardId, {
        event: `Routine updated: ${patch?.title || task.title}`,
        type: "neutral",
      });
      if (role === "guardian") {
        pushWardAlert(targetWardId, {
          level: "low",
          message: `Task updated by guardian: ${task.title} → ${patch?.title || task.title}`,
          source: "guardian",
          kind: "task-update",
        });
      }
    }
  };

  const deleteRoutineTask = (task) => {
    if (!canEditRoutine || !task?.id) return;
    const next = routines.filter((item) => item.id !== task.id);
    setRoutines(next);
    persistRoutines(next);
    if (targetWardId) {
      pushWardActivity(targetWardId, {
        event: `Routine deleted: ${task.title}`,
        type: "neutral",
      });
      if (role === "guardian") {
        pushWardAlert(targetWardId, {
          level: "medium",
          message: `Task removed by guardian: ${task.title}`,
          source: "guardian",
          kind: "task-update",
        });
      }
    }
  };

  const saveThresholds = (payload) => {
    if (!canEditThresholds || !targetWardId) return;
    const next = { ...sensoryProfile, ...payload };
    setSensoryProfile(next);
    writeJson(`${ASD_PROFILE_PREFIX}${targetWardId}`, next);
  };

  const saveWardSettings = (next) => {
    if (!targetWardId) return;
    setWardSettings(next);
    writeJson(`${ASD_WARD_SETTINGS_PREFIX}${targetWardId}`, next);
    if (role === "guardian") {
      pushWardActivity(targetWardId, {
        event: "Guardian updated conditions/permissions",
        type: "neutral",
      });
      pushWardAlert(targetWardId, {
        level: "low",
        message: "Guardian updated your care conditions/permissions.",
        source: "guardian",
        kind: "care-settings",
      });
    }
  };

  const toggleWardCondition = (conditionKey) => {
    if (!isManagerMode) return;
    const current = Array.isArray(wardSettings?.disorders) ? wardSettings.disorders : [];
    const hasCondition = current.includes(conditionKey);
    const nextDisorders = hasCondition
      ? current.filter((item) => item !== conditionKey)
      : [...current, conditionKey];
    saveWardSettings({
      ...wardSettings,
      disorders: nextDisorders,
    });
  };

  const toggleWardPermission = (permissionKey) => {
    if (!isManagerMode) return;
    const currentPrivacy = wardSettings?.privacy || {};
    saveWardSettings({
      ...wardSettings,
      privacy: {
        ...currentPrivacy,
        [permissionKey]: !currentPrivacy[permissionKey],
      },
    });
  };

  const createStory = ({ title, content, steps }) => {
    if (!canManageStories || !targetWardId) return;

    const normalizedSteps = Array.isArray(steps)
      ? steps.filter((step) => typeof step?.text === "string" && step.text.trim())
      : [];

    const customStories = readJson(`${ASD_STORIES_PREFIX}${targetWardId}`, []);
    const nextCustom = [
      {
        id: `local-story-${Date.now()}`,
        user_id: targetWardId,
        title,
        content: content || normalizedSteps[0]?.text || "",
        steps: normalizedSteps,
        is_builtin: false,
      },
      ...customStories,
    ];

    writeJson(`${ASD_STORIES_PREFIX}${targetWardId}`, nextCustom);
    setStories([...getBuiltInStories(currentUser?.name || "the child"), ...nextCustom]);
  };

  const updateStory = (storyId, patch) => {
    if (!canManageStories || !targetWardId) return;
    if (storyId.startsWith("builtin-")) {
      setError("Built-in stories are read-only. Create a new custom story to modify steps.");
      return;
    }

    const customStories = readJson(`${ASD_STORIES_PREFIX}${targetWardId}`, []);
    const nextCustom = customStories.map((item) => (item.id === storyId ? { ...item, ...patch } : item));
    writeJson(`${ASD_STORIES_PREFIX}${targetWardId}`, nextCustom);
    setStories([...getBuiltInStories(currentUser?.name || "the child"), ...nextCustom]);
  };

  const deleteStory = (storyId) => {
    if (!canManageStories || !targetWardId) return;
    if (storyId.startsWith("builtin-")) {
      setError("Built-in stories cannot be deleted.");
      return;
    }

    const customStories = readJson(`${ASD_STORIES_PREFIX}${targetWardId}`, []);
    const nextCustom = customStories.filter((item) => item.id !== storyId);
    writeJson(`${ASD_STORIES_PREFIX}${targetWardId}`, nextCustom);
    setStories([...getBuiltInStories(currentUser?.name || "the child"), ...nextCustom]);
  };

  const createMeltdownLog = (payload) => {
    if (!canUseCalmingTools || !targetWardId) return;

    const entry = {
      id: `local-log-${Date.now()}`,
      user_id: targetWardId,
      created_at: new Date().toISOString(),
      ...payload,
    };

    const next = [entry, ...meltdownLogs];
    setMeltdownLogs(next);
    writeJson(`${ASD_MELTDOWN_PREFIX}${targetWardId}`, next);

    pushWardAlert(targetWardId, {
      level: payload?.risk_level === "high" ? "high" : "medium",
      message: payload?.notes || "Coping mode activated",
      source: "ward",
      kind: payload?.event_type || "meltdown-log",
    });
  };

  const selectedEmotion =
    EMOTION_STATES.find((state) => state.label === emotionCheckin) || EMOTION_STATES[0];

  const unreadWardAlerts = useMemo(() => {
    if (!targetWardId) return [];
    const seen = readJson(`${ASD_WARD_ALERT_SEEN_PREFIX}${targetWardId}`, []);
    return wardAlerts
      .filter((item) => item?.source === "guardian" || item?.kind === "schedule-change" || item?.kind === "task-update")
      .filter((item) => !seen.includes(item.id));
  }, [targetWardId, wardAlerts]);

  const wardFacingAlerts = useMemo(
    () => wardAlerts.filter((item) => item?.source === "guardian" || item?.kind === "schedule-change" || item?.kind === "task-update"),
    [wardAlerts],
  );

  const markAlertsAsSeen = () => {
    if (!targetWardId) return;
    const ids = wardFacingAlerts.map((item) => item.id);
    writeJson(`${ASD_WARD_ALERT_SEEN_PREFIX}${targetWardId}`, ids);
  };

  useEffect(() => {
    if (role === "guardian" || isAdmin || wardFacingAlerts.length === 0) return;

    const latest = wardFacingAlerts[0];
    if (!latest?.id || latest.id === lastToastAlertIdRef.current) {
      return;
    }

    const seen = readJson(`${ASD_WARD_ALERT_SEEN_PREFIX}${targetWardId}`, []);
    const isUnread = !seen.includes(latest.id);
    if (isUnread) {
      toast({
        title: latest.kind === "schedule-change" ? "Schedule Changed" : "New Guardian Update",
        description: latest.message,
      });
    }

    lastToastAlertIdRef.current = latest.id;
  }, [wardFacingAlerts, role, isAdmin, targetWardId, toast]);

  const readEmotionAloud = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleSelectEmotion = (state) => {
    if (!state) return;
    setEmotionCheckin(state.label);
    readEmotionAloud(`${state.label}. ${state.supportText}`);
    if (targetWardId) {
      pushWardActivity(targetWardId, {
        event: `Emotion selected: ${state.label}`,
        type: "neutral",
      });
    }

    if (state.risk === "high" || state.risk === "moderate") {
      createMeltdownLog({
        event_type: "emotional-checkin",
        notes: `Emotion selected: ${state.label}`,
        risk_level: state.risk,
      });
      if (state.risk === "high") {
        setActiveTab("meltdown");
      }
    }
  };

  const roleBadge = useMemo(() => (isManagerMode ? "GUARDIAN" : role.toUpperCase()), [role, isManagerMode]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/" className="neuro-btn-ghost text-sm gap-2 inline-flex min-h-0 py-2 px-3">
          <ArrowLeft size={16} /> Back to Modes
        </Link>
        <Badge variant="secondary" className="gap-1"><Shield size={14} /> Role: {roleBadge}</Badge>
        <Badge variant="outline">Local Shared Sync</Badge>
      </div>

      {isManagerMode && wardOptions.length > 0 && (
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Viewing child:</span>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={targetWardId || ""}
              onChange={(event) => {
                setTargetWardId(event.target.value);
                writeRuntimeSyncWardId(event.target.value);
              }}
            >
              {wardOptions.map((ward) => (
                <option key={ward.id} value={ward.id}>{ward.name}</option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">ASD Support Module</CardTitle>
          <CardDescription>
            Current layout preserved with integrated guardian-child local synchronization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-amber-500 mb-2">Sync Ward Key: {targetWardId || readRuntimeSyncWardId() || "nb-user-088"}</p>
          {loading && <p className="text-sm text-muted-foreground">Loading ASD module...</p>}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!loading && isManagerMode && (
            <Alert>
              <AlertDescription>
                Guardian task manager is enabled. You can Add, Edit, and Delete tasks in the Routine tab.
              </AlertDescription>
            </Alert>
          )}
          {!loading && role === "user" && (
            <Alert>
              <AlertDescription>
                Routine tasks shown here are synced from guardian assignments and schedule updates.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {isManagerMode && targetWardId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Ward Conditions &amp; Permissions</CardTitle>
            <CardDescription>
              Review and update selected conditions and sharing permissions for the current ward.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected Conditions</p>
              <div className="flex flex-wrap gap-2">
                {ALL_DISORDERS.map((condition) => {
                  const active = (wardSettings?.disorders || []).includes(condition);
                  return (
                    <Button
                      key={condition}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleWardCondition(condition)}
                    >
                      {DISORDER_META[condition]?.label || condition}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Sharing Permissions</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={wardSettings?.privacy?.shareActivity ? "default" : "outline"}
                  onClick={() => toggleWardPermission("shareActivity")}
                >
                  Share Activity
                </Button>
                <Button
                  size="sm"
                  variant={wardSettings?.privacy?.shareJournal ? "default" : "outline"}
                  onClick={() => toggleWardPermission("shareJournal")}
                >
                  Share Journal
                </Button>
                <Button
                  size="sm"
                  variant={wardSettings?.privacy?.shareAlerts ? "default" : "outline"}
                  onClick={() => toggleWardPermission("shareAlerts")}
                >
                  Share Alerts
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isAdmin && role !== "guardian" && wardFacingAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ward Notifications</CardTitle>
            <CardDescription>
              Updates from guardian actions such as task updates and schedule changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant={unreadWardAlerts.length > 0 ? "destructive" : "secondary"}>
                {unreadWardAlerts.length > 0 ? `${unreadWardAlerts.length} unread` : "All read"}
              </Badge>
              <Button size="sm" variant="outline" onClick={markAlertsAsSeen}>Mark all as read</Button>
            </div>
            <div className="space-y-2 max-h-52 overflow-auto pr-1">
              {wardFacingAlerts.slice(0, 8).map((alertItem) => {
                const isUnread = unreadWardAlerts.some((item) => item.id === alertItem.id);
                return (
                  <div
                    key={alertItem.id}
                    className={`rounded-xl border p-3 ${isUnread ? "bg-amber-500/10 border-amber-400/40" : "bg-background/40"}`}
                  >
                    <p className="text-sm font-medium">{alertItem.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alertItem.ts} · {alertItem.source || "system"}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users size={18} /> Admin View</CardTitle>
            <CardDescription>
              Admin controls are read-only in local shared sync mode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Guardian-user ASD data sharing is active via local synchronized storage.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className={`grid w-full ${showEmotionFeature ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4"} h-auto gap-1 p-1`}>
            <TabsTrigger value="routine">Routine</TabsTrigger>
            <TabsTrigger value="sensory">Sensory</TabsTrigger>
            <TabsTrigger value="stories">Stories</TabsTrigger>
            <TabsTrigger value="meltdown">Meltdown</TabsTrigger>
            {showEmotionFeature && <TabsTrigger value="emotion">Emotion</TabsTrigger>}
          </TabsList>

          <TabsContent value="routine">
            <RoutineVisualizer
              role={role}
              canManageRoutine={canEditRoutine}
              routines={routines}
              loading={loading}
              onAddTask={addRoutineTask}
              onToggleTask={toggleTaskCompletion}
              onEditTask={editRoutineTask}
              onDeleteTask={deleteRoutineTask}
            />
          </TabsContent>

          <TabsContent value="sensory">
            <SensoryMonitor
              role={role}
              profile={sensoryProfile}
              loading={loading}
              onSaveThresholds={saveThresholds}
            />
          </TabsContent>

          <TabsContent value="stories">
            <SocialStoryBuilder
              role={role}
              stories={stories}
              loading={loading}
              onCreateStory={createStory}
              onUpdateStory={updateStory}
              onDeleteStory={deleteStory}
            />
          </TabsContent>

          <TabsContent value="meltdown">
            <MeltdownPrevention
              role={role}
              routines={routines}
              sensoryProfile={sensoryProfile}
              meltdownLogs={canViewMeltdownLogs ? meltdownLogs : []}
              onCreateMeltdownLog={createMeltdownLog}
            />
          </TabsContent>

          {showEmotionFeature && (
            <TabsContent value="emotion">
              <EmotionCards
                states={EMOTION_STATES}
                selectedEmotion={emotionCheckin}
                onSelectEmotion={handleSelectEmotion}
                onReadEmotion={(state) => readEmotionAloud(`${state.label}. ${state.supportText}`)}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Neha-Riya ASD integration is enabled in local shared sync mode.
        </AlertDescription>
      </Alert>
    </div>
  );
}

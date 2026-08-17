/**
 * useASDData.js — React adapter that wires ASD module data (routines, social
 * stories) into the standalone feature pages so each /asd/* page can render
 * its feature component with live props.
 */

import { useEffect, useState } from "react";
import { useAuth, CARE_LINK_REGISTRY, MOCK_WARD_ACTIVITY } from "@/context/AuthContext";
import { loadWardTasks, saveWardTasks, toAsdRoutineTask, fromAsdRoutineTask } from "@/support/stores/wardTaskStore";
import { pushWardActivity, pushWardAlert } from "@/support/stores/careSyncStore";

const ROLE_FALLBACK = "user";
const ASD_STORIES_PREFIX = "nb_asd_stories_";
const RUNTIME_SYNC_WARD_KEY = "nb_runtime_sync_ward_id";

const createStep = (id, text, image_url = "") => ({ id, text, image_url });

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

export function useASDData() {
  const { user: appUser, role: appRole, isAuthenticated, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(ROLE_FALLBACK);
  const [targetWardId, setTargetWardId] = useState(null);

  const [routines, setRoutines] = useState([]);
  const [stories, setStories] = useState([]);

  const isGuardian = role === "guardian";
  const isManagerMode = isGuardian || role === "admin";
  const canEditRoutine = isManagerMode;
  const canManageStories = isManagerMode;

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
  }, [authLoading, isAuthenticated, appUser?.id, appRole, isManagerMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!targetWardId || !currentUser) return;

    setLoading(true);
    const builtInStories = getBuiltInStories(currentUser.name);

    const wardTaskList = loadAndNormalizeWardTasks({ targetWardId, appUser, currentUser });
    setRoutines(wardTaskList.map((task) => toAsdRoutineTask(task, targetWardId)));

    const customStories = readJson(`${ASD_STORIES_PREFIX}${targetWardId}`, []);
    setStories([...builtInStories, ...customStories]);

    setLoading(false);
  }, [targetWardId, currentUser?.id, currentUser?.name, role, appUser?.id, appUser?.careLinkId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!targetWardId) return;

    const refresh = () => {
      const wardTaskList = loadAndNormalizeWardTasks({ targetWardId, appUser, currentUser });
      setRoutines(wardTaskList.map((task) => toAsdRoutineTask(task, targetWardId)));
      const builtInStories = getBuiltInStories(currentUser?.name || "the child");
      const customStories = readJson(`${ASD_STORIES_PREFIX}${targetWardId}`, []);
      setStories([...builtInStories, ...customStories]);
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
  }, [targetWardId, currentUser?.name, currentUser?.id, role, appUser?.id, appUser?.careLinkId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return {
    loading,
    error,
    role,
    targetWardId,
    canEditRoutine,
    canManageStories,
    routines,
    stories,
    addRoutineTask,
    toggleTaskCompletion,
    editRoutineTask,
    deleteRoutineTask,
    createStory,
    updateStory,
    deleteStory,
  };
}

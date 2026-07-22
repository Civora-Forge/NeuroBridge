export const TASKS_STORAGE_KEY = "nb_guardian_ward_tasks";
const NOTIFICATION_KEY_PREFIX = "nb_user_task_notifications_";

export const DEFAULT_WARD_TASKS = {
  "nb-user-042": [
    { id: "g-042-1", title: "Morning OCD check-in", time: "08:00", done: false },
    { id: "g-042-2", title: "ERP practice block", time: "16:00", done: false },
  ],
  "nb-user-011": [
    { id: "g-011-1", title: "Adaptive reading session", time: "09:00", done: false },
    { id: "g-011-2", title: "Word bank revision", time: "17:30", done: false },
  ],
  "nb-user-088": [
    { id: "g-088-1", title: "ASD visual schedule review", time: "07:30", done: false },
    { id: "g-088-2", title: "Anxiety grounding practice", time: "18:00", done: false },
  ],
};

export function getDefaultTasksByWard(wardIds) {
  return (wardIds || []).reduce((acc, wardId) => {
    acc[wardId] = DEFAULT_WARD_TASKS[wardId] ? [...DEFAULT_WARD_TASKS[wardId]] : [];
    return acc;
  }, {});
}

export function loadWardTasks(wardIds = []) {
  const defaults = getDefaultTasksByWard(wardIds);
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveWardTasks(tasksByWard) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasksByWard || {}));
}

export function toAsdRoutineTask(task, userId) {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    time_label: task.time || null,
    is_completed: Boolean(task.done),
  };
}

export function fromAsdRoutineTask(task) {
  return {
    id: task.id,
    title: task.title,
    time: task.time_label || "",
    done: Boolean(task.is_completed),
  };
}

function getNotificationKey(wardId) {
  return `${NOTIFICATION_KEY_PREFIX}${wardId}`;
}

export function loadTaskNotifications(wardId) {
  if (!wardId) {
    return [];
  }
  try {
    const raw = localStorage.getItem(getNotificationKey(wardId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function pushTaskNotification(wardId, payload) {
  if (!wardId) {
    return;
  }
  const existing = loadTaskNotifications(wardId);
  const next = [
    {
      id: `notif-${Date.now()}`,
      created_at: new Date().toISOString(),
      read: false,
      ...payload,
    },
    ...existing,
  ].slice(0, 30);

  localStorage.setItem(getNotificationKey(wardId), JSON.stringify(next));
}

export function markAllTaskNotificationsRead(wardId) {
  if (!wardId) {
    return;
  }
  const existing = loadTaskNotifications(wardId);
  const next = existing.map((item) => ({ ...item, read: true }));
  localStorage.setItem(getNotificationKey(wardId), JSON.stringify(next));
}

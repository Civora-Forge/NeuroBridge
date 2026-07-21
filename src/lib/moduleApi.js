const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const withLocalFallback = async ({ storageKey, request, fallbackValue = [] }) => {
  try {
    const result = await request();
    localStorage.setItem(storageKey, JSON.stringify(result));
    return result;
  } catch {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return fallbackValue;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return fallbackValue;
    }
  }
};

export const getEntries = (path, storageKey) =>
  withLocalFallback({
    storageKey,
    request: async () => {
      const response = await fetch(`${API_BASE_URL}${path}`);
      if (!response.ok) {
        throw new Error("Unable to fetch entries");
      }
      return response.json();
    },
    fallbackValue: [],
  });

export const createEntry = async (path, storageKey, payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Unable to save entry");
    }

    const created = await response.json();
    const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
    localStorage.setItem(storageKey, JSON.stringify([created, ...existing]));
    return created;
  } catch {
    const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const created = {
      ...payload,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(storageKey, JSON.stringify([created, ...existing]));
    return created;
  }
};

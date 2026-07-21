const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const jsonRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
};

export const createReadingSession = async (payload) =>
  jsonRequest("/api/dyslexia/reading/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getReadingInsights = async (userId) =>
  jsonRequest(`/api/dyslexia/reading/insights/${userId}`);

export const logPhonologyErrors = async (payload) =>
  jsonRequest("/api/dyslexia/phonology/log", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const generatePhonologyDrills = async (payload) =>
  jsonRequest("/api/dyslexia/phonology/drills", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const trackReinforcementEvent = async (payload) =>
  jsonRequest("/api/dyslexia/reinforcement/event", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const analyzeWriting = async (payload) =>
  jsonRequest("/api/dyslexia/writing/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getLearningProfile = async (userId) =>
  jsonRequest(`/api/dyslexia/profile/${userId}`);

export const getAnalyticsStreamUrl = (userId) =>
  `${API_BASE_URL}/api/dyslexia/analytics/stream/${userId}`;

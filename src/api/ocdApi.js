import axios from 'axios';

// Assuming the FastAPI backend runs on localhost:8000 during development
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api/ocd` : (import.meta.env.PROD ? '/api/ocd' : 'http://localhost:8000/api/ocd'));

const ocdApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Every one of these requires a real, authenticated backend user (see
// backend/auth.py's get_current_user) — without an Authorization header
// every call here 401s and the calling page silently shows an empty state,
// which was a real, live bug (confirmed via the network tab: agent-created
// hierarchies/sessions were invisible because this file never sent the
// header the backend requires at all). Callers pass `headers` from
// `backendAuthHeaders(user)` (src/lib/backendAuth.js) — the same resolver
// the agent chat store uses, so a demo login and a real Supabase session
// both work identically here.

export const createHierarchy = async (data, headers = {}) => {
  const response = await ocdApi.post('/hierarchies/', data, { headers });
  return response.data;
};

export const getHierarchies = async (headers = {}) => {
  const response = await ocdApi.get('/hierarchies/', { headers });
  return response.data;
};

export const addHierarchyTask = async (hierarchyId, data, headers = {}) => {
  const response = await ocdApi.post(`/hierarchies/${hierarchyId}/tasks/`, data, { headers });
  return response.data;
};

export const updateHierarchyTask = async (taskId, data, headers = {}) => {
  const response = await ocdApi.patch(`/tasks/${taskId}`, data, { headers });
  return response.data;
};

export const removeHierarchyTask = async (taskId, headers = {}) => {
  await ocdApi.delete(`/tasks/${taskId}`, { headers });
  return taskId;
};

export const createSession = async (data, headers = {}) => {
  const response = await ocdApi.post('/sessions/', data, { headers });
  return response.data;
};

export const getSessions = async (headers = {}) => {
  const response = await ocdApi.get('/sessions/', { headers });
  return response.data;
};

export const completeSession = async (sessionId, data, headers = {}) => {
  const response = await ocdApi.patch(`/sessions/${sessionId}/complete`, data, { headers });
  return response.data;
};

export const createSudsLog = async (data, headers = {}) => {
  const response = await ocdApi.post('/suds/', data, { headers });
  return response.data;
};

export const getSudsLogs = async (headers = {}) => {
  const response = await ocdApi.get('/suds/', { headers });
  return response.data;
};

export const createJournalEntry = async (data, headers = {}) => {
  const response = await ocdApi.post('/journal/', data, { headers });
  return response.data;
};

export const getJournalEntries = async (headers = {}) => {
  const response = await ocdApi.get('/journal/', { headers });
  return response.data;
};

export default ocdApi;

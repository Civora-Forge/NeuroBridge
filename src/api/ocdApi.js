import axios from 'axios';

// Assuming the FastAPI backend runs on localhost:8000 during development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/ocd';

const ocdApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const createHierarchy = async (data) => {
  const response = await ocdApi.post('/hierarchies/', data);
  return response.data;
};

export const getHierarchies = async () => {
  const response = await ocdApi.get('/hierarchies/');
  return response.data;
};

export const createSession = async (data) => {
  const response = await ocdApi.post('/sessions/', data);
  return response.data;
};

export const getSessions = async () => {
  const response = await ocdApi.get('/sessions/');
  return response.data;
};

export const createSudsLog = async (data) => {
  const response = await ocdApi.post('/suds/', data);
  return response.data;
};

export const getSudsLogs = async () => {
  const response = await ocdApi.get('/suds/');
  return response.data;
};

export const createJournalEntry = async (data) => {
  const response = await ocdApi.post('/journal/', data);
  return response.data;
};

export const getJournalEntries = async () => {
  const response = await ocdApi.get('/journal/');
  return response.data;
};

export default ocdApi;

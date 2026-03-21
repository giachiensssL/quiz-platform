// src/api/api.js
import axios from 'axios';

const envApiBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API ||
  process.env.VITE_API_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

const isLocalHost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(window.location.hostname || '');

const normalizeApiBase = (base) => {
  const value = String(base || '').trim().replace(/\/+$/, '');
  if (!value) return '';

  // Supports full API paths (e.g. /api, /api/v1) and only appends /api for root host URLs.
  try {
    const parsed = new URL(value);
    const path = (parsed.pathname || '').replace(/\/+$/, '');
    if (!path || path === '/') {
      return `${parsed.origin}/api`;
    }
    if (/^\/api(\/|$)/i.test(path)) {
      return `${parsed.origin}${path}`;
    }
    return `${parsed.origin}${path}`;
  } catch {
    if (/\/api(\/|$)/i.test(value)) return value;
    return `${value}/api`;
  }
};

export const API_BASE_URL = normalizeApiBase(
  envApiBase || (isLocalHost ? 'http://localhost:5001' : 'https://quiz-platform-sm9a.onrender.com')
);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('qm_token');
      localStorage.removeItem('qm_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ================= API =================

export const authAPI = {
  login: (d) => api.post('/auth/login', d),
  me: () => api.get('/auth/me')
};

export const usersAPI = {
  list: () => api.get('/users'),
  create: (d) => api.post('/users', d),
  remove: (id) => api.delete(`/users/${id}`),
  block: (id) => api.patch(`/users/${id}/block`),
  unblock: (id) => api.patch(`/users/${id}/unblock`)
};

export const facultiesAPI = {
  list: () => api.get('/faculties'),
  create: (d) => api.post('/faculties', d),
  update: (id, d) => api.put(`/faculties/${id}`, d),
  remove: (id) => api.delete(`/faculties/${id}`)
};

export const yearsAPI = {
  list: () => api.get('/years'),
  listByFaculty: (fid) => api.get(`/years/${fid}`),
  create: (d) => api.post('/years', d),
  update: (id, d) => api.put(`/years/${id}`, d),
  remove: (id) => api.delete(`/years/${id}`)
};

export const semestersAPI = {
  list: () => api.get('/semesters'),
  listByYear: (yid) => api.get(`/semesters/${yid}`),
  create: (d) => api.post('/semesters', d),
  update: (id, d) => api.put(`/semesters/${id}`, d),
  remove: (id) => api.delete(`/semesters/${id}`)
};

export const subjectsAPI = {
  list: (params) => api.get('/subjects', { params }),
  listBySemester: (sid) => api.get(`/subjects/${sid}`),
  create: (d) => api.post('/subjects', d),
  update: (id, d) => api.put(`/subjects/${id}`, d),
  remove: (id) => api.delete(`/subjects/${id}`)
};

export const lessonsAPI = {
  listBySubject: (sid) => api.get(`/lessons/${sid}`),
  create: (d) => api.post('/lessons', d),
  update: (id, d) => api.put(`/lessons/${id}`, d),
  remove: (id) => api.delete(`/lessons/${id}`)
};

export const questionsAPI = {
  listAll: () => api.get('/questions'),
  listByLesson: (lid) => api.get(`/questions/${lid}`),
  create: (d) => api.post('/questions', d),
  update: (id, d) => api.put(`/questions/${id}`, d),
  remove: (id) => api.delete(`/questions/${id}`)
};

export const answersAPI = {
  listByQuestion: (qid) => api.get(`/questions/${qid}/answers`),
  create: (d) => api.post('/answers', d),
  update: (id, d) => api.put(`/answers/${id}`, d),
  remove: (id) => api.delete(`/answers/${id}`)
};

export const resultsAPI = {
  submit: (d) => api.post('/submit', d),
  myList: () => api.get('/results/me')
};

export const leaderboardAPI = {
  list: (period = 'all') =>
    api.get('/leaderboard', { params: { period } })
};

export const adminDataAPI = {
  listUsers: () => api.get('/admin/users'),
  createUser: (d) => api.post('/admin/create-user', d),
  updateUser: (id, d) => api.patch(`/admin/users/${id}`, d),
  resetUserPassword: (id, password) =>
    api.patch(`/admin/users/${id}/reset-password`, { password }),
  setUserBlocked: (id, blocked) =>
    api.patch(`/admin/users/${id}/block`, { blocked }),
  removeUser: (id) => api.delete(`/admin/users/${id}`),

  listFaculties: () => api.get('/admin/faculties'),
  createFaculty: (d) => api.post('/admin/faculties', d),
  updateFaculty: (id, d) => api.put(`/admin/faculties/${id}`, d),
  removeFaculty: (id) => api.delete(`/admin/faculties/${id}`),

  listYears: () => api.get('/admin/years'),
  createYear: (d) => api.post('/admin/years', d),
  updateYear: (id, d) => api.put(`/admin/years/${id}`, d),
  removeYear: (id) => api.delete(`/admin/years/${id}`),

  listSemesters: () => api.get('/admin/semesters'),
  createSemester: (d) => api.post('/admin/semesters', d),
  updateSemester: (id, d) => api.put(`/admin/semesters/${id}`, d),
  removeSemester: (id) => api.delete(`/admin/semesters/${id}`),

  listSubjects: () => api.get('/admin/subjects'),
  createSubject: (d) => api.post('/admin/subjects', d),
  updateSubject: (id, d) => api.put(`/admin/subjects/${id}`, d),
  removeSubject: (id) => api.delete(`/admin/subjects/${id}`),

  listLessons: () => api.get('/admin/lessons'),
  createLesson: (d) => api.post('/admin/lessons', d),
  updateLesson: (id, d) => api.put(`/admin/lessons/${id}`, d),
  removeLesson: (id) => api.delete(`/admin/lessons/${id}`),

  listQuestions: () => api.get('/admin/questions'),
  createQuestion: (d) => api.post('/admin/questions', d),
  updateQuestion: (id, d) => api.put(`/admin/questions/${id}`, d),
  removeQuestion: (id) => api.delete(`/admin/questions/${id}`),

  getAnalyticsSummary: () => api.get('/analytics/summary'),
};

export const analyticsAPI = {
  track: (d) => api.post('/analytics/track', d),
  heartbeat: (d) => api.post('/analytics/heartbeat', d),
  leave: (d) => api.post('/analytics/leave', d),
};

export default api;

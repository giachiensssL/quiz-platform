// src/api/api.js
import axios from 'axios';

const fallbackApiBase = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:5001/api`
  : 'http://localhost:5001/api';

const envApiBase = process.env.REACT_APP_API_URL
  || process.env.REACT_APP_API_BASE_URL
  || process.env.REACT_APP_API
  || fallbackApiBase;

const normalizeApiBase = (base) => {
  const value = String(base || '').trim().replace(/\/+$/, '');
  if (!value) return '';
  return /\/api$/i.test(value) ? value : `${value}/api`;
};

export const API_BASE_URL = normalizeApiBase(envApiBase);
export const AUTH_NOTICE_KEY = 'qm_auth_notice';

export const getFullAvatarUrl = (path) => {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http')) return path;
  const base = API_BASE_URL.replace(/\/api\/?$/i, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

const isLikelyJwt = (token) => {
  const value = String(token || '').trim();
  if (!value) return false;
  // JWT normally has 3 dot-separated base64url parts.
  return value.split('.').length === 3;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let refreshPromise = null;

const requestTokenRefresh = async () => {
  const refreshToken = localStorage.getItem('qm_refresh_token');
  if (!refreshToken) throw new Error('Missing refresh token');

  const response = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
    {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
    }
  );

  const payload = response?.data || {};
  if (!payload?.token) throw new Error('Refresh did not return token');

  localStorage.setItem('qm_token', payload.token);
  if (payload.refreshToken) {
    localStorage.setItem('qm_refresh_token', payload.refreshToken);
  }

  return payload.token;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qm_token');
  if (isLikelyJwt(token)) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const serverMessage = String(err?.response?.data?.message || '');
    const requestUrl = String(err?.config?.url || '').toLowerCase();
    const isLoginRequest = requestUrl.includes('/auth/login');
    const isRefreshRequest = requestUrl.includes('/auth/refresh');
    const isLogoutRequest = requestUrl.includes('/auth/logout');
    const skipAuthRedirect = Boolean(err?.config?.skipAuthRedirect);
    const canRetry = !err?.config?._retry;
    const hasSessionToken = Boolean(localStorage.getItem('qm_token'));
    const hasRefreshToken = Boolean(localStorage.getItem('qm_refresh_token'));
    const isOnLoginPage = String(window?.location?.pathname || '').startsWith('/login');

    if (status === 401 && !isLoginRequest && !isRefreshRequest && !isLogoutRequest && canRetry && hasSessionToken && hasRefreshToken) {
      const kickedByOtherSession = serverMessage.toLowerCase().includes('đăng nhập ở thiết bị khác');
      if (!kickedByOtherSession) {
        try {
          if (!refreshPromise) {
            refreshPromise = requestTokenRefresh();
          }
          const nextAccessToken = await refreshPromise;
          err.config._retry = true;
          err.config.headers = err.config.headers || {};
          err.config.headers.Authorization = `Bearer ${nextAccessToken}`;
          return api.request(err.config);
        } catch {
          // fall through to logout handling below
        } finally {
          refreshPromise = null;
        }
      }
    }

    if (status === 401 && !isLoginRequest && !skipAuthRedirect && hasSessionToken) {
      const serverMessageLower = serverMessage.toLowerCase();
      const kickedByOtherSession = serverMessageLower.includes('đăng nhập ở thiết bị khác') || serverMessageLower.includes('thiết bị khác');
      
      if (kickedByOtherSession) {
        sessionStorage.setItem(
          AUTH_NOTICE_KEY,
          'Tài khoản này vừa được đăng nhập ở thiết bị khác. Bạn đã bị đăng xuất, vui lòng đăng nhập lại.'
        );
      }

      // Only redirect if absolutely certain it's an auth failure, not a network fluke.
      if (status === 401) {
        localStorage.removeItem('qm_token');
        localStorage.removeItem('qm_user');
        localStorage.removeItem('qm_refresh_token');
        if (!isOnLoginPage) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// ================= API =================

export const authAPI = {
  login: (d) => api.post('/auth/login', d),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  getBaseUrl: () => API_BASE_URL,
  updateProfile: (d) => {
    if (d instanceof FormData) {
      return api.put('/auth/profile', d, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.put('/auth/profile', d);
  }
};

// NOTE: User management is handled through adminDataAPI below (correct admin endpoints).

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
  submit: (d) => api.post("/submit", d, { skipAuthRedirect: true }),
  myList: () => api.get("/results/me"),
  details: (id) => api.get(`/results/attempt/${id}`),
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
  getUserAccessLocks: (id) => api.get(`/admin/users/${id}/access-locks`),
  setUserAccessLocks: (id, accessLocks) => api.patch(`/admin/users/${id}/access-locks`, { accessLocks }),

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
  extractDocumentText: (d) => api.post('/admin/import/extract-text', d),

  getAnalyticsSummary: () => api.get('/analytics/summary'),
};

export const analyticsAPI = {
  track: (d) => api.post('/analytics/track', d),
  heartbeat: (d) => api.post('/analytics/heartbeat', d),
  leave: (d) => api.post('/analytics/leave', d),
};

export const vipAPI = {
  createOrder: (d) => api.post('/vip/create-order', d),
  getStatus: (orderId) => api.get(`/vip/status/${orderId}`),
  simulatePayment: (orderId) => api.post('/vip/simulate-payment', { orderId }),
};

export default api;

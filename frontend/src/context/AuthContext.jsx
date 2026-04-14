import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authAPI } from '../api/api';
const AuthContext = createContext(null);
const ADMIN_CREDS = { username: 'Janscient125', password: 'Janscient2005' };
const USERS_STORAGE_KEY = 'qm_mock_users';
const REFRESH_TOKEN_KEY = 'qm_refresh_token';
const ENABLE_LOCAL_AUTH_FALLBACK = String(process.env.REACT_APP_ENABLE_LOCAL_AUTH || '').toLowerCase() === 'true';
const safeStorageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage write errors in restricted browser mode.
  }
};
const safeStorageRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage remove errors in restricted browser mode.
  }
};
const INIT_USERS = [
  { id: 1, username: 'sinhvien01', password: '123456', role: 'user', name: 'Nguyễn Văn A', blocked: false, email: 'a@sv.edu.vn', attempts: [], totalScore: 0, quizzesTaken: 0 },
  { id: 2, username: 'sinhvien02', password: '123456', role: 'user', name: 'Trần Thị B', blocked: false, email: 'b@sv.edu.vn', attempts: [], totalScore: 0, quizzesTaken: 0 },
];

const normalizeUser = (user) => ({
  ...user,
  blocked: Boolean(user?.blocked),
  attempts: Array.isArray(user?.attempts) ? user.attempts : [],
  totalScore: Number(user?.totalScore || 0),
  quizzesTaken: Number(user?.quizzesTaken || 0),
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(safeStorageGet('qm_user')) || null; } catch { return null; } });
  const [mockUsers, setMockUsers] = useState(() => {
    try {
      const raw = JSON.parse(safeStorageGet(USERS_STORAGE_KEY) || 'null');
      if (Array.isArray(raw) && raw.length) return raw.map(normalizeUser);
    } catch {
      // fallback to seed users
    }
    return INIT_USERS.map(normalizeUser);
  });

  useEffect(() => {
    safeStorageSet(USERS_STORAGE_KEY, JSON.stringify(mockUsers));
  }, [mockUsers]);

  useEffect(() => {
    if (ENABLE_LOCAL_AUTH_FALLBACK) return;
    const token = safeStorageGet('qm_token') || '';
    if (!token) return;

    const syncUser = async () => {
      try {
        const res = await authAPI.me();
        if (res?.data?.user) {
          const bu = res.data.user;
          const u = {
            id: bu.id,
            username: bu.username,
            role: bu.role,
            name: bu.fullName || bu.username,
            avatar: bu.avatar || '',
          };
          setUser(u);
          safeStorageSet('qm_user', JSON.stringify(u));
        }
      } catch (err) {
        if (err?.response?.status === 401) {
          logout();
        }
      }
    };

    syncUser();

    // Cleanup local token if it was mock
    const isLocalToken = token === 'admin-token' || token.startsWith('token-');
    if (isLocalToken) {
      setUser(null);
      safeStorageRemove('qm_user');
      safeStorageRemove('qm_token');
      safeStorageRemove(REFRESH_TOKEN_KEY);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const response = await authAPI.login({ username, password });
      const payload = response?.data || {};
      const backendUser = payload?.user || {};
      const u = {
        id: backendUser.id,
        username: backendUser.username || username,
        role: payload.role || backendUser.role || 'user',
        name: backendUser.fullName || backendUser.username || username,
        avatar: backendUser.avatar || '',
      };
      setUser(u);
      safeStorageSet('qm_user', JSON.stringify(u));
      safeStorageSet('qm_token', payload.token || '');
      if (payload.refreshToken) safeStorageSet(REFRESH_TOKEN_KEY, payload.refreshToken);
      return { success: true, role: u.role };
    } catch (error) {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.message;

      if (status === 401) {
        return { success: false, error: serverMessage || 'Tên đăng nhập hoặc mật khẩu không đúng.' };
      }

      if (status === 403) {
        return { success: false, error: serverMessage || 'Tài khoản bị khoá. Liên hệ admin.' };
      }

      if (serverMessage && status) {
        return { success: false, error: serverMessage };
      }

      if (error?.code === 'ERR_NETWORK') {
        return { success: false, error: 'Không kết nối được backend (http://localhost:5001). Hãy bật backend rồi đăng nhập lại.' };
      }

      // Only allow local fallback when explicitly enabled and server is unreachable.
    }

    if (!ENABLE_LOCAL_AUTH_FALLBACK) {
      return { success: false, error: 'Không thể kết nối máy chủ. Vui lòng thử lại sau.' };
    }

    if (username === ADMIN_CREDS.username && password === ADMIN_CREDS.password) {
      const u = { username, role: 'admin', name: 'Admin' };
      setUser(u); safeStorageSet('qm_user', JSON.stringify(u)); safeStorageSet('qm_token', 'admin-token');
      return { success: true, role: 'admin' };
    }
    const found = mockUsers.find(u => u.username === username && u.password === password);
    if (found) {
      if (found.blocked) return { success: false, error: 'Tài khoản bị khoá. Liên hệ admin.' };
      const u = { id: found.id, username: found.username, role: 'user', name: found.name };
      setUser(u); safeStorageSet('qm_user', JSON.stringify(u)); safeStorageSet('qm_token', `token-${found.id}`);
      return { success: true, role: 'user' };
    }
    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }, [mockUsers]);
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.warn('Backend logout failed:', err.message);
    } finally {
      setUser(null);
      safeStorageRemove('qm_user');
      safeStorageRemove('qm_token');
      safeStorageRemove(REFRESH_TOKEN_KEY);
    }
  }, []);

  const updateProfile = useCallback(async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      const updatedUser = response.data.user;
      const u = {
        ...user,
        username: updatedUser.username,
        name: updatedUser.fullName || updatedUser.username,
        avatar: updatedUser.avatar,
      };
      setUser(u);
      safeStorageSet('qm_user', JSON.stringify(u));
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.response?.data?.message || 'Cập nhật không thành công' };
    }
  }, [user]);

  return <AuthContext.Provider value={{ user, login, logout, updateProfile, mockUsers, setMockUsers }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Button } from './UI';

export default function Navbar() {
  const THEME_KEY = 'qm_theme';
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { realtimeStatus } = useData();
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const initial = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const isActive = (p) => location.pathname === p || location.pathname.startsWith(p + '/');
  const initials = user?.name ? user.name.split(' ').map(w=>w[0]).slice(-2).join('').toUpperCase() : 'U';
  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate(user?.role==='admin'?'/admin':'/')}>Quiz<span className="brand-accent">Master</span></div>
      {user?.role !== 'admin' && (
        <div className="navbar-nav">
          <button className={`nav-link${location.pathname==='/'?' active':''}`} onClick={()=>navigate('/')}>Trang chủ</button>
          <button className={`nav-link${isActive('/leaderboard')?' active':''}`} onClick={()=>navigate('/leaderboard')}>Bảng xếp hạng</button>
          <button className={`nav-link${isActive('/profile')?' active':''}`} onClick={()=>navigate('/profile')}>Hồ sơ</button>
        </div>
      )}
      {user?.role === 'admin' && (
        <div className="navbar-nav">
          <button className={`nav-link${isActive('/admin')?' active':''}`} onClick={()=>navigate('/admin')}>Admin Dashboard</button>
        </div>
      )}
      <div className="navbar-right">
        {user?.role !== 'admin' && (
          <div className={`realtime-badge ${realtimeStatus || 'disconnected'}`}>
            Realtime: {realtimeStatus === 'connected' ? 'Connected' : realtimeStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={toggleTheme}>{theme === 'dark' ? '☀ Sáng' : '🌙 Tối'}</Button>
        <span style={{fontSize:'.82rem',color:'var(--muted)'}}>{user?.name}</span>
        <button className="avatar-btn">{initials}</button>
        <Button variant="ghost" size="sm" onClick={()=>{logout();navigate('/login');}}>Đăng xuất</Button>
      </div>
    </nav>
  );
}

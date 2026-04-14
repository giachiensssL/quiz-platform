import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Button } from './UI';
import { sidebarItems } from './Sidebar';
import { API_BASE_URL, getFullAvatarUrl } from '../api/api';

export default function Navbar() {
  const THEME_KEY = 'qm_theme';
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { realtimeStatus } = useData();
  const [theme, setTheme] = useState('light');
  const [drawerOpen, setDrawerOpen] = useState(false);


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

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const isActive = (p) => location.pathname === p || location.pathname.startsWith(p + '/');
  const initials = user?.name ? user.name.split(' ').map(w=>w[0]).slice(-2).join('').toUpperCase() : 'U';

  const mobileItems = user?.role === 'admin'
    ? [{ label: 'Admin Dashboard', icon: '🛠', path: '/admin' }]
    : sidebarItems;

  const avatarUrl = getFullAvatarUrl(user?.avatar);

  return (
    <>
      <nav className="navbar">
        <button
          type="button"
          className={`nav-hamburger${drawerOpen ? ' open' : ''}`}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="navbar-brand" onClick={() => navigate(user?.role==='admin'?'/admin':'/')}>
          <span className="brand-dot" />
          QuizMaster
        </div>
        {user?.role !== 'admin' && (
          <button 
            className="buy-vip-nav-btn"
            onClick={() => navigate('/buy-vip')}
            style={{
              marginLeft: '15px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: 'linear-gradient(135deg, #FFD700, #F59E0B)',
              color: '#000',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ✨ MUA VIP
          </button>
        )}
        {user?.role !== 'admin' && (
          <div className="navbar-nav">
            <button className={`nav-link${location.pathname==='/'?' active':''}`} onClick={()=>navigate('/')}>Trang chủ</button>
            <button className={`nav-link${isActive('/practice')?' active':''}`} onClick={()=>navigate('/practice')}>Luyện thi</button>
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
              <span className="realtime-dot" />
              {realtimeStatus === 'connected' ? 'Realtime On' : realtimeStatus === 'connecting' ? 'Đang kết nối' : 'Mất kết nối'}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={toggleTheme}>{theme === 'dark' ? '☀ Sáng' : '🌙 Tối'}</Button>
          <span className="navbar-user">{user?.name}</span>
          <button className="avatar-btn" onClick={() => navigate('/profile')} style={{ overflow: 'hidden', padding: 0 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : initials}
          </button>
          <Button variant="ghost" size="sm" onClick={()=>{logout();navigate('/login');}}>Đăng xuất</Button>
        </div>
      </nav>

      <div className={`mobile-drawer${drawerOpen ? ' on' : ''}`}>
        <div className="mobile-drawer-overlay" onClick={() => setDrawerOpen(false)} />
        <div className="mobile-drawer-panel">
          <div className="mobile-drawer-header">
            <div className="mobile-drawer-brand">QuizMaster</div>
            <button type="button" className="mobile-drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
          </div>
          <div className="mobile-drawer-section">
            {mobileItems.map((item) => (
              <button
                key={item.path}
                type="button"
                className={`mobile-drawer-item${isActive(item.path) ? ' active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  setDrawerOpen(false);
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div className="mobile-drawer-footer">
            <button
              type="button"
              className="mobile-drawer-item"
              onClick={() => {
                logout();
                navigate('/login');
                setDrawerOpen(false);
              }}
            >
              <span>↩</span>
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

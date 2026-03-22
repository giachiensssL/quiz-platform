import { useNavigate, useLocation } from 'react-router-dom';

const ITEMS = [
  { label: 'Tất cả ngành học', icon: '🏛', path: '/' },
  { label: 'Bảng xếp hạng', icon: '🏆', path: '/leaderboard' },
  { label: 'Hồ sơ cá nhân', icon: '👤', path: '/profile' },
];

export const sidebarItems = ITEMS;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <aside className="sidebar">
      <div className="sidebar-section-label">Điều hướng</div>
      {ITEMS.map((item) => (
        <button
          key={item.path}
          className={`sidebar-btn${isActive(item.path) ? ' active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className="sb-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">Hỗ trợ</div>
      <button className="sidebar-btn" type="button">
        <span className="sb-icon">📖</span>
        Hướng dẫn
      </button>
      <button className="sidebar-btn" type="button">
        <span className="sb-icon">💬</span>
        Phản hồi
      </button>
    </aside>
  );
}




import { useNavigate, useLocation } from 'react-router-dom';

const ITEMS = [
  { label: 'Tất cả Khoa', icon: '🏛️', path: '/' },
  { label: 'Lịch sử làm bài', icon: '⏱️', path: '/profile' },
  { label: 'Đã lưu', icon: '🔖', path: '/saved' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <aside className="sidebar">
      <div className="sidebar-section-label">Điều hướng</div>
      {ITEMS.map(item => (
        <button key={item.path} className={`sidebar-btn${location.pathname===item.path?' active':''}`} onClick={()=>navigate(item.path)}>
          <span className="sb-icon">{item.icon}</span>{item.label}
        </button>
      ))}
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">Hỗ trợ</div>
      <button className="sidebar-btn"><span className="sb-icon">📖</span>Hướng dẫn</button>
      <button className="sidebar-btn"><span className="sb-icon">💬</span>Phản hồi</button>
    </aside>
  );
}

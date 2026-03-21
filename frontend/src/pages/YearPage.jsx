import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Button, EmptyState } from '../components/UI';

export default function YearPage() {
  const { facultyId } = useParams();
  const navigate = useNavigate();
  const { data } = useData();
  const faculty = data.faculties.find((f) => String(f.id) === String(facultyId));
  const years = data.years.filter((y) => String(y.facultyId) === String(facultyId));

  if (faculty?.locked) {
    return (
      <div className="app-wrapper">
        <Navbar />
        <div className="main-layout">
          <Sidebar />
          <div className="page-content">
            <Button variant="ghost" size="sm" icon="←" onClick={() => navigate('/')} style={{marginBottom:12}}>Quay lại</Button>
            <EmptyState icon="🔒" text="Khoa này đang bị khoá" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <Navbar />
      <div className="main-layout">
        <Sidebar />
        <div className="page-content">
          <div className="breadcrumb">
            <span className="bc-item" onClick={() => navigate('/')}>Trang chủ</span>
            <span className="bc-sep">/</span>
            <span className="bc-item current">{faculty?.name || 'Khoa'}</span>
          </div>
          <div className="page-header">
            <Button variant="ghost" size="sm" icon="←" onClick={() => navigate('/')} style={{marginBottom:12}}>Quay lại</Button>
            <div className="page-title">Chọn Năm học</div>
            <div className="page-sub">{faculty?.name}</div>
          </div>
          {years.length === 0 ? <EmptyState icon="📅" text="Chưa có năm học nào" /> : (
            <div className="cards-grid">
              {years.map(y => (
                <div key={y.id} className="item-card" onClick={y.locked ? undefined : () => navigate(`/semester/${y.id}`)} style={y.locked ? { opacity: 0.6, cursor: 'not-allowed', pointerEvents: 'auto' } : undefined}>
                  <div className="card-icon-wrap">📅</div>
                  <h4>{y.name}</h4>
                  <div className="card-footer">
                    <span className={`badge ${y.locked ? 'badge-red' : 'badge-blue'}`}>{y.locked ? 'Đã khoá' : '2 học kỳ'}</span>
                    <span className="card-arrow">{y.locked ? '🔒' : '→'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Button, EmptyState } from '../components/UI';

export default function SubjectPage() {
  const { semesterId } = useParams();
  const navigate = useNavigate();
  const { data } = useData();
  const semester = data.semesters.find((s) => String(s.id) === String(semesterId));
  const year = data.years.find((y) => String(y.id) === String(semester?.yearId));
  const faculty = data.faculties.find((f) => String(f.id) === String(year?.facultyId));
  const subjects = data.subjects.filter((s) => String(s.semesterId) === String(semesterId));

  if (semester?.locked) {
    return (
      <div className="app-wrapper">
        <Navbar />
        <div className="main-layout">
          <Sidebar />
          <div className="page-content">
            <Button variant="ghost" size="sm" icon="←" onClick={() => navigate(`/semester/${year?.id}`)} style={{marginBottom:12}}>Quay lại</Button>
            <EmptyState icon="🔒" text="Học kỳ này đang bị khoá" />
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
            <span className="bc-item" onClick={() => navigate(`/year/${faculty?.id}`)}>{faculty?.name}</span>
            <span className="bc-sep">/</span>
            <span className="bc-item" onClick={() => navigate(`/semester/${year?.id}`)}>{year?.name}</span>
            <span className="bc-sep">/</span>
            <span className="bc-item current">{semester?.name}</span>
          </div>
          <div className="page-header">
            <Button variant="ghost" size="sm" icon="←" onClick={() => navigate(`/semester/${year?.id}`)} style={{marginBottom:12}}>Quay lại</Button>
            <div className="page-title">Chọn Môn học</div>
            <div className="page-sub">{semester?.name} — {year?.name}</div>
          </div>
          {subjects.length === 0 ? <EmptyState icon="📚" text="Chưa có môn học nào" /> : (
            <div className="cards-grid wide">
              {subjects.map((s, i) => (
                <div key={s.id} className="item-card" onClick={s.locked ? undefined : () => navigate(`/lesson/${s.id}`)} style={s.locked ? { opacity: 0.6, cursor: 'not-allowed', pointerEvents: 'auto' } : undefined}>
                  <div className={`card-icon-wrap${i % 2 ? ' orange' : ''}`}>{s.icon}</div>
                  <h4>{s.name}</h4>
                  <div className="card-footer">
                    <span className={`badge ${s.locked ? 'badge-red' : (i%2?'badge-orange':'badge-blue')}`}>{s.locked ? 'Đã khoá' : `${s.lessons} bài học`}</span>
                    <span className="card-arrow">{s.locked ? '🔒' : '→'}</span>
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

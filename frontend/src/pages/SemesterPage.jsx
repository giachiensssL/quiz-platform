import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Button, EmptyState } from '../components/UI';

export default function SemesterPage() {
  const { yearId } = useParams();
  const navigate = useNavigate();
  const { data } = useData();
  const year = data.years.find((y) => String(y.id) === String(yearId));
  const faculty = data.faculties.find((f) => String(f.id) === String(year?.facultyId));
  const semesters = data.semesters.filter((s) => String(s.yearId) === String(yearId));

  if (year?.locked) {
    return (
      <div className="app-wrapper">
        <Navbar />
        <div className="main-layout">
          <Sidebar />
          <div className="page-content">
            <Button variant="ghost" size="sm" icon="←" onClick={() => navigate(`/year/${year?.facultyId}`)} style={{marginBottom:12}}>Quay lại</Button>
            <EmptyState icon="🔒" text="Năm học này đang bị khoá" />
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
            <span className="bc-item" onClick={() => navigate(`/year/${year?.facultyId}`)}>{faculty?.name}</span>
            <span className="bc-sep">/</span>
            <span className="bc-item current">{year?.name}</span>
          </div>
          <div className="page-header">
            <Button variant="ghost" size="sm" icon="←" onClick={() => navigate(`/year/${year?.facultyId}`)} style={{marginBottom:12}}>Quay lại</Button>
            <div className="page-title">Chọn Học kỳ</div>
            <div className="page-sub">{faculty?.name} — {year?.name}</div>
          </div>
          {semesters.length === 0 ? <EmptyState icon="📋" text="Chưa có học kỳ nào" /> : (
            <div className="cards-grid">
              {semesters.map(s => (
                <div key={s.id} className="item-card" onClick={() => navigate(`/subject/${s.id}`)}>
                  <div className="card-icon-wrap orange">📋</div>
                  <h4>{s.name}</h4>
                  <div className="card-footer">
                    <span className="badge badge-orange">Xem môn →</span>
                    <span className="card-arrow">→</span>
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

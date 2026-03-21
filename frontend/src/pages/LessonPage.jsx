import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Button, Badge, EmptyState } from '../components/UI';

export default function LessonPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { data } = useData();
  const subject = data.subjects.find((s) => String(s.id) === String(subjectId));
  const semester = data.semesters.find((s) => String(s.id) === String(subject?.semesterId));
  const lessons = data.lessons.filter((l) => String(l.subjectId) === String(subjectId));

  if (subject?.locked) {
    return (
      <div className="app-wrapper">
        <Navbar />
        <div className="main-layout">
          <Sidebar />
          <div className="page-content">
            <Button variant="ghost" size="sm" icon="←" onClick={() => navigate(`/subject/${semester?.id}`)} style={{marginBottom:12}}>Quay lại</Button>
            <EmptyState icon="🔒" text="Môn học này đang bị khoá" />
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
            <span className="bc-item" onClick={() => navigate(`/subject/${semester?.id}`)}>{semester?.name}</span>
            <span className="bc-sep">/</span>
            <span className="bc-item current">{subject?.name}</span>
          </div>
          <div className="page-header">
            <Button variant="ghost" size="sm" icon="←" onClick={() => navigate(`/subject/${semester?.id}`)} style={{marginBottom:12}}>Quay lại</Button>
            <div className="page-title">{subject?.icon} {subject?.name}</div>
            <div className="page-sub">{lessons.length} bài học có sẵn</div>
          </div>
          {lessons.length === 0 ? <EmptyState icon="📝" text="Chưa có bài học nào" /> : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {lessons.map((l, i) => (
                <div key={l.id} className="item-card" style={{flexDirection:'row',alignItems:'center',gap:14}}
                  onClick={l.locked ? undefined : () => navigate(`/quiz/${l.id}`)}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'var(--blue-light)',color:'var(--blue)',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'.85rem'}}>{i+1}</div>
                  <div style={{flex:1, opacity: l.locked ? 0.6 : 1}}>
                    <div style={{fontWeight:600,fontSize:'.95rem'}}>{l.name}</div>
                    <div style={{fontSize:'.78rem',color:'var(--muted)',marginTop:2}}>{l.questions} câu hỏi</div>
                  </div>
                  <Badge color={l.locked ? 'red' : 'green'}>{l.locked ? 'Đã khoá 🔒' : 'Bắt đầu →'}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

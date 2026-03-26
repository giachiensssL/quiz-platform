import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { EmptyState } from '../components/UI';

export default function PracticePage() {
  const navigate = useNavigate();
  const { data } = useData();

  const subjectStats = useMemo(() => {
    return data.subjects
      .map((subject) => {
        const lessons = data.lessons.filter((lesson) => String(lesson.subjectId) === String(subject.id) && !lesson.locked);
        const lessonIds = new Set(lessons.map((lesson) => String(lesson.id)));
        const questionCount = data.questions.filter((question) => lessonIds.has(String(question.lessonId))).length;
        return {
          ...subject,
          lessonCount: lessons.length,
          questionCount,
        };
      })
      .filter((subject) => !subject.locked && subject.questionCount > 0)
      .sort((a, b) => b.questionCount - a.questionCount);
  }, [data.subjects, data.lessons, data.questions]);

  return (
    <div className="app-wrapper">
      <Navbar />
      <div className="main-layout">
        <Sidebar />
        <div className="page-content">
          <div className="page-header">
            <div className="page-title">Luyện thi theo môn</div>
            <div className="page-sub">Chọn một môn để hệ thống tự tạo đề 50 câu trong 45 phút</div>
          </div>

          {subjectStats.length === 0 ? (
            <EmptyState icon="🗂️" text="Chưa có dữ liệu môn học để luyện thi" />
          ) : (
            <div className="cards-grid wide">
              {subjectStats.map((subject, index) => (
                <div
                  key={subject.id}
                  className="item-card"
                  onClick={() => navigate(`/practice/${subject.id}`)}
                >
                  <div className={`card-icon-wrap${index % 2 ? ' orange' : ''}`}>{subject.icon || '📚'}</div>
                  <h4>{subject.name}</h4>
                  <div className="card-footer">
                    <span className={`badge ${index % 2 ? 'badge-orange' : 'badge-blue'}`}>
                      {subject.lessonCount} bài • {subject.questionCount} câu
                    </span>
                    <span className="card-arrow">Luyện đề →</span>
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

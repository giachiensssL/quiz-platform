import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { EmptyState } from '../components/UI';

function ItemCard({ item, onClick, colorClass = '' }) {
  return (
    <div
      className="item-card"
      onClick={item.locked ? undefined : onClick}
      style={item.locked ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
    >
      <div className={`card-icon-wrap${colorClass ? ' ' + colorClass : ''}`}>{item.icon || '📚'}</div>
      <h4>{item.name}</h4>
      {item.desc && <p className="card-desc">{item.desc}</p>}
      <div className="card-footer">
        <span className={`badge ${item.locked ? 'badge-red' : 'badge-blue'}`}>{item.locked ? 'Đã khoá' : `${item.lessons || item.questions || item.quizzes || ''} ${item.lessons ? 'bài' : item.questions ? 'câu' : item.quizzes ? 'bài' : ''}`}</span>
        <span className="card-arrow">{item.locked ? '🔒' : '→'}</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { data } = useData();

  return (
    <div className="app-wrapper">
      <Navbar />
      <div className="main-layout">
        <Sidebar />
        <div className="page-content">
          <div className="page-header">
            <div className="page-title">Chọn ngành học</div>
            <div className="page-sub">Bắt đầu ôn luyện bằng cách chọn ngành học của bạn</div>
          </div>
          {data.faculties.length === 0 ? (
            <EmptyState icon="🏛️" text="Chưa có ngành học nào" />
          ) : (
            <div className="cards-grid wide">
              {data.faculties.map((f, i) => (
                <ItemCard key={f.id} item={f} colorClass={i % 2 === 1 ? 'orange' : ''}
                  onClick={() => navigate(`/year/${f.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




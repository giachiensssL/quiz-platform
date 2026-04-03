import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resultsAPI } from '../api/api';
import Navbar from '../components/Navbar';
import { Button, Badge, EmptyState } from '../components/UI';
import { buildComparison, evaluateQuestion, TYPE_LABELS } from '../utils/quizUtils';

function CompareAnswerBlock({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, letterSpacing: '.05em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ fontSize: '.875rem', display: 'flex', gap: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-1)', minWidth: 24 }}>{item.label}:</span>
            <span style={{ color: 'var(--text-2)' }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAttempt = async () => {
      try {
        setLoading(true);
        const res = await resultsAPI.details(attemptId);
        setAttempt(res.data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Không thể tải thông tin bài làm.');
      } finally {
        setLoading(false);
      }
    };
    fetchAttempt();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="app-wrapper"><Navbar />
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
          <div style={{ color: 'var(--muted)' }}>Đang tải kết quả...</div>
        </div>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="app-wrapper"><Navbar />
        <div className="page-content" style={{ paddingTop: 60 }}>
          <EmptyState icon="❓" text={error || 'Không tìm thấy bài làm'} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <Button variant="primary" onClick={() => navigate('/profile')}>Quay lại hồ sơ</Button>
          </div>
        </div>
      </div>
    );
  }

  const details = (attempt.details || []).map((detail, index) => {
    const { question, answer: userAnswer } = detail;
    const evaluation = evaluateQuestion(question, userAnswer);
    const comparison = buildComparison(question, userAnswer);
    return {
      question,
      index,
      userAnswer,
      comparison,
      ...evaluation,
    };
  });

  const accuracy = attempt.total > 0 ? Math.round((attempt.correct / attempt.total) * 100) : 0;

  return (
    <div className="app-wrapper"><Navbar />
      <div className="page-content" style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 100 }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="ghost" onClick={() => navigate(-1)}>← Quay lại</Button>
          <div className="page-title" style={{ fontSize: '1.25rem' }}>Chi tiết bài làm</div>
        </div>

        <div className="stat-card" style={{ marginBottom: 32, padding: 24, background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--blue)' }}>{accuracy}%</div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 4, fontWeight: 700 }}>CHÍNH XÁC</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>{attempt.score}/{attempt.totalPossible || attempt.total}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 4, fontWeight: 700 }}>ĐIỂM SỐ</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--orange)' }}>{attempt.correct}/{attempt.total}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 4, fontWeight: 700 }}>CÂU ĐÚNG</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-1)', marginTop: 8 }}>
                {new Date(attempt.createdAt).toLocaleDateString('vi-VN')}
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 4, fontWeight: 700 }}>THỜI GIAN</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {details.map((item) => (
            <div key={item.index} style={{ padding: 20, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: 'var(--muted)', fontSize: '1.1rem' }}>#{(item.index + 1).toString().padStart(2, '0')}</span>
                  <Badge color="gray">{TYPE_LABELS[item.question.type] || item.question.type}</Badge>
                </div>
                <Badge color={item.fullyCorrect ? 'green' : 'red'}>
                  {item.fullyCorrect ? 'Đúng hoàn toàn' : 'Chưa chính xác'}
                </Badge>
              </div>

              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 20, lineHeight: 1.5 }}>
                {item.question.text || item.question.question}
              </div>

              {item.question.imageUrl && (
                <img
                  src={item.question.imageUrl}
                  alt="Question"
                  style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12, marginBottom: 20, border: '1px solid var(--border-soft)' }}
                />
              )}

              <div style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 16, border: '1px solid var(--border-soft)' }}>
                <CompareAnswerBlock title="Bạn đã chọn:" items={item.comparison.chosenItems} />
                <div style={{ height: 1, background: 'var(--border-soft)', margin: '12px 0' }} />
                <CompareAnswerBlock title="Đáp án đúng là:" items={item.comparison.correctItems} />
              </div>

              {item.question.hint && (
                <div style={{ marginTop: 16, fontSize: '.8rem', color: 'var(--muted)', fontStyle: 'italic', display: 'flex', gap: 6 }}>
                  <span>💡</span>
                  <span>Gợi ý: {item.question.hint}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

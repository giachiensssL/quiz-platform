import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import Navbar from '../components/Navbar';
import { EmptyState } from '../components/UI';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, mockUsers } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    user: null,
    stats: {
      totalAttempts: 0,
      accuracy: 0,
      totalScore: 0,
      streakDays: 0,
    },
    recentActivities: [],
  });

  const isServerToken = (token) => {
    const value = String(token || '').trim();
    return Boolean(value) && value !== 'admin-token' && !value.startsWith('token-');
  };

  const toLocalProfile = () => {
    const found = (mockUsers || []).find((item) => String(item?.id) === String(user?.id) || item?.username === user?.username);
    const attempts = Array.isArray(found?.attempts) ? found.attempts : [];
    const totalAttempts = attempts.length;
    const totalScore = attempts.reduce((sum, item) => sum + Number(item?.score || 0), 0);
    const totalCorrect = attempts.reduce((sum, item) => sum + Number(item?.correct || 0), 0);
    const totalIncorrect = attempts.reduce((sum, item) => sum + Number(item?.incorrect || 0), 0);
    const totalAnswered = totalCorrect + totalIncorrect;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    return {
      user: {
        username: user?.username || '',
        fullName: found?.name || user?.name || '',
      },
      stats: {
        totalAttempts,
        accuracy,
        totalScore,
        streakDays: 0,
      },
      recentActivities: [],
    };
  };

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      const token = localStorage.getItem('qm_token');
      if (!isServerToken(token)) {
        if (mounted) {
          setProfile(toLocalProfile());
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const res = await authAPI.me();
        const payload = res?.data || {};
        if (!mounted) return;
        setProfile({
          user: payload.user || null,
          stats: {
            totalAttempts: Number(payload?.stats?.totalAttempts || 0),
            accuracy: Number(payload?.stats?.accuracy || 0),
            totalScore: Number(payload?.stats?.totalScore || 0),
            streakDays: Number(payload?.stats?.streakDays || 0),
          },
          recentActivities: Array.isArray(payload?.recentActivities) ? payload.recentActivities : [],
        });
      } catch {
        if (!mounted) return;
        setProfile(toLocalProfile());
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.username]);

  const displayName = profile?.user?.fullName || user?.name || user?.username || 'User';
  const initials = useMemo(
    () => (displayName ? displayName.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase() : 'U'),
    [displayName]
  );

  const statCards = [
    [String(profile?.stats?.totalAttempts || 0), 'Bài đã làm', ''],
    [`${Number(profile?.stats?.accuracy || 0)}%`, 'Tỉ lệ đúng', ''],
    [Number(profile?.stats?.totalScore || 0).toLocaleString(), 'Tổng điểm', ''],
    [String(profile?.stats?.streakDays || 0), 'Chuỗi ngày', ''],
  ];

  const formatRelative = (isoDate) => {
    if (!isoDate) return '';
    const ts = new Date(isoDate).getTime();
    if (Number.isNaN(ts)) return '';
    const diffDays = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return new Date(ts).toLocaleDateString('vi-VN');
  };

  return (
    <div className="app-wrapper"><Navbar/>
      <div className="page-content">
        <div className="profile-head">
          <div className="profile-avatar">{initials}</div>
          <div>
            <div className="page-title">{displayName}</div>
            <div style={{fontSize:'.875rem',color:'var(--muted)',marginTop:4}}>@{user?.username || profile?.user?.username || ''}</div>
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <span className="badge badge-blue">Sinh viên</span>
              <span className="badge badge-green">Hoạt động</span>
            </div>
          </div>
        </div>
        <div className="stat-row">
          {statCards.map(([v,l,c])=>(
            <div key={l} className="stat-card">
              <div className="stat-val">{v}</div>
              <div className="stat-label">{l}</div>
              {c&&<div className="stat-change">{c}</div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:20}}>
          <div className="section-title">Hoạt động gần đây</div>
          <div className="table-wrap">
            {loading && <div style={{ padding: 16, color: 'var(--muted)' }}>Đang tải hồ sơ...</div>}
            {!loading && profile.recentActivities.length === 0 && (
              <EmptyState icon="📝" text="Bạn chưa làm bài nào. Hồ sơ hiện đang bắt đầu từ đầu." />
            )}
            {!loading && profile.recentActivities.map((item, i) => (
              <div 
                key={item.id || `${item.lessonName}-${i}`} 
                className="activity-row"
                style={{
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between',
                  padding:'12px 16px',
                  borderBottom:i<4?'1px solid var(--border-soft)':'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onClick={() => navigate(`/review/${item.id}`)}
              >
                <div>
                  <div style={{fontWeight:600,fontSize:'.875rem'}}>{item.lessonName}</div>
                  <div style={{fontSize:'.75rem',color:'var(--muted)',marginTop:2}}>{formatRelative(item.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge badge-green">{Number(item.accuracy || 0)}%</span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL, leaderboardAPI } from '../api/api';
import Navbar from '../components/Navbar';
import { EmptyState } from '../components/UI';

const CULTIVATION_TITLES = [
  'Thánh Nhân',       // Rank 1
  'Tiên Đế',         // Rank 2
  'Tiên Tôn',         // Rank 3
  'Tiên Vương',       // Rank 4
  'Đại La Kim Tiên',   // Rank 5
  'Thái Ất Kim Tiên',  // Rank 6
  'Kim Tiên',         // Rank 7
  'Chân Tiên',        // Rank 8
  'Tiên Nhân',        // Rank 9
  'Độ Kiếp'           // Rank 10
];

export default function LeaderboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [lb, setLb] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedKey, setHighlightedKey] = useState('');
  const previousRanksRef = useRef(new Map());
  const highlightTimerRef = useRef(null);
  const consumedPriorityStateRef = useRef(false);

  const highlightHint = useMemo(() => {
    const navHint = location.state?.highlightHint || {};
    let localUser = {};
    try {
      localUser = JSON.parse(localStorage.getItem('qm_user') || '{}') || {};
    } catch {
      localUser = {};
    }
    return {
      id: navHint.id || localUser._id || localUser.id || '',
      username: navHint.username || localUser.username || '',
    };
  }, [location.state]);

  const getRowKey = (row) => {
    if (!row) return '';
    return String(row._id || row.id || row.userId || row.username || '');
  };

  const loadLeaderboard = async (mountedRef, currentTab) => {
    try {
      setLoading(true);
      const res = await leaderboardAPI.list(currentTab);
      if (!mountedRef.current) return;
      const nextRows = Array.isArray(res?.data) ? res.data : [];
      
      // Process rank changes for highlighting
      const nextRanks = new Map();
      nextRows.forEach((row, index) => {
        const key = getRowKey(row);
        if (key) nextRanks.set(key, index);
      });
      previousRanksRef.current = nextRanks;

      setLb(nextRows);
    } catch {
      if (!mountedRef.current) return;
      setLb([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const mounted = { current: true };
    loadLeaderboard(mounted, tab);

    const timer = window.setInterval(() => loadLeaderboard(mounted, tab), 15000);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [tab]);

  const getCultivationTitle = (index) => {
    if (index === -1) return 'Thiên Đạo Admin Đại Đế'; // Special case for Admin
    if (index < CULTIVATION_TITLES.length) return CULTIVATION_TITLES[index];
    return 'Phàm Nhân';
  };

  const toDisplayName = (row, index) => {
    const baseName = row?.fullName || row?.username || 'Đạo Hữu';
    const title = getCultivationTitle(index);
    return `${baseName} ${title}`;
  };

  const accuracy = (row) => {
    const total = Number(row?.correctTotal || 0) + Number(row?.wrongTotal || 0);
    const correct = Number(row?.correctTotal || 0);
    if (!total || !correct) return 0;
    return Math.round((correct / total) * 100);
  };

  return (
    <div className="app-wrapper xianxia-theme">
      <Navbar />
      
      <style>{`
        .xianxia-theme {
          background: #0a0a0c url('https://www.transparenttextures.com/patterns/dark-matter.png');
          color: #e2e8f0;
          min-height: 100vh;
        }
        .xianxia-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .xianxia-header {
          text-align: center;
          margin-bottom: 50px;
          position: relative;
        }
        .xianxia-title {
          font-family: 'DM Serif Display', serif;
          font-size: 3rem;
          background: linear-gradient(to bottom, #fde68a, #f59e0b, #b45309);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 10px;
          filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.5));
          text-transform: uppercase;
          letter-spacing: 4px;
        }
        .xianxia-sub {
          color: #94a3b8;
          font-size: 1.1rem;
          letter-spacing: 2px;
        }
        
        .cultivation-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        .stat-box {
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          backdrop-filter: blur(10px);
          box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
        }
        .stat-box strong {
          display: block;
          font-size: 1.8rem;
          color: #fbbf24;
          margin-bottom: 5px;
        }
        .stat-box span {
          color: #64748b;
          font-size: 0.8rem;
          text-transform: uppercase;
        }

        .realm-tabs {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 30px;
        }
        .realm-tab {
          background: transparent;
          border: 1px solid #475569;
          color: #94a3b8;
          padding: 8px 24px;
          border-radius: 99px;
          cursor: pointer;
          transition: 0.3s;
          font-weight: 600;
        }
        .realm-tab.active {
          border-color: #f59e0b;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.1);
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
        }

        .leaderboard-scroll {
          background: rgba(15, 23, 42, 0.8);
          border: 2px solid #b45309;
          border-radius: 16px;
          padding: 10px;
          box-shadow: 0 0 50px rgba(0,0,0,0.8);
        }

        .lb-item {
          display: flex;
          align-items: center;
          padding: 18px 24px;
          margin-bottom: 8px;
          background: rgba(30, 41, 59, 0.4);
          border-radius: 10px;
          border-left: 4px solid transparent;
          transition: 0.3s;
        }
        .lb-item:hover {
          background: rgba(51, 65, 85, 0.6);
          transform: scale(1.01);
        }
        .lb-item.admin-rank {
          background: linear-gradient(90deg, rgba(120, 53, 15, 0.3), rgba(30, 41, 59, 0.4));
          border-left-color: #fbbf24;
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.15);
        }
        .lb-item.top-1 { border-left-color: #fbbf24; }
        .lb-item.top-2 { border-left-color: #e2e8f0; }
        .lb-item.top-3 { border-left-color: #b45309; }

        .lb-pos {
          width: 60px;
          font-size: 1.4rem;
          font-weight: 800;
          color: #64748b;
          font-style: italic;
        }
        .lb-item.top-1 .lb-pos { color: #fbbf24; text-shadow: 0 0 10px #fbbf24; }
        .lb-item.top-2 .lb-pos { color: #e2e8f0; }
        .lb-item.top-3 .lb-pos { color: #b45309; }

        .lb-avatar-circle {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #1e293b;
          border: 2px solid #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 20px;
          font-size: 1.2rem;
          color: #94a3b8;
          overflow: hidden;
        }
        .lb-item.top-1 .lb-avatar-circle { border-color: #fbbf24; color: #fbbf24; }

        .lb-info {
          flex: 1;
        }
        .lb-name-text {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f1f5f9;
          display: block;
          margin-bottom: 4px;
        }
        .lb-item.admin-rank .lb-name-text {
          background: linear-gradient(90deg, #fbbf24, #fde68a);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .lb-realm-tag {
          font-size: 0.75rem;
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
          padding: 2px 10px;
          border-radius: 4px;
          border: 1px solid rgba(245, 158, 11, 0.3);
          font-weight: 600;
          text-transform: uppercase;
        }
        .lb-meta-text {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 4px;
          display: block;
        }

        .lb-score-val {
          text-align: right;
        }
        .lb-points {
          font-size: 1.4rem;
          font-weight: 800;
          color: #fbbf24;
          display: block;
        }
        .lb-unit {
          font-size: 0.65rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        /* Sparkle/Glow effects */
        .admin-glow {
          position: relative;
          overflow: hidden;
        }
        .admin-glow::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent, rgba(251, 191, 36, 0.1), transparent);
          transform: rotate(45deg);
          animation: adminShine 4s infinite;
        }
        @keyframes adminShine {
          0% { transform: translateX(-100%) rotate(45deg); }
          100% { transform: translateX(100%) rotate(45deg); }
        }
      `}</style>

      <div className="xianxia-container">
        <header className="xianxia-header">
          <h1 className="xianxia-title">Thiên Môn Bảng</h1>
          <p className="xianxia-sub">Những vị Thiên Kiêu đứng đầu Thiên môn học viện</p>
        </header>

        <section className="cultivation-stats">
          <div className="stat-box">
            <span>Đạo Hữu Tham Gia</span>
            <strong>{lb.length}</strong>
          </div>
          <div className="stat-box">
            <span>Tu Vi Cao Nhất</span>
            <strong>{(lb[0]?.totalScore || 0).toLocaleString()}</strong>
          </div>
          <div className="stat-box">
            <span>Thời Gian</span>
            <strong>{tab === 'all' ? 'Vĩnh Hằng' : tab === 'week' ? 'Tuần Này' : 'Tháng Này'}</strong>
          </div>
        </section>

        <div className="realm-tabs">
          {[['all', 'Toàn Giới'], ['week', 'Tuần Này'], ['month', 'Tháng Này']].map(([k, v]) => (
            <button key={k} className={`realm-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{v}</button>
          ))}
        </div>

        <div className="leaderboard-scroll">
          {/* Thiên Đạo Admin Đại Đế - Always at top */}
          <div className="lb-item admin-rank admin-glow">
            <div className="lb-pos">∞</div>
            <div className="lb-avatar-circle" style={{ borderColor: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)' }}>
              <span style={{ fontSize: '1.5rem' }}>👑</span>
            </div>
            <div className="lb-info">
              <span className="lb-name-text">Admin Đại Đế</span>
              <span className="lb-realm-tag">Thiên Đạo</span>
              <span className="lb-meta-text">Vô thượng uy nghiêm • Thủ hộ thiên địa</span>
            </div>
            <div className="lb-score-val">
              <span className="lb-points" style={{ fontSize: '1.8rem' }}>∞</span>
              <span className="lb-unit">Tu Vi</span>
            </div>
          </div>

          {loading && <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang bói toán Thiên Cơ...</div>}

          {lb.map((r, i) => {
            const absoluteRank = i + 1;
            const topClass = absoluteRank <= 3 ? ` top-${absoluteRank}` : '';
            return (
              <div key={getRowKey(r) || i} className={`lb-item${topClass}`}>
                <div className="lb-pos">#{absoluteRank}</div>
                <div className="lb-avatar-circle">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : toDisplayName(r, i).split(' ').pop()?.[0] || 'U'}
                </div>
                <div className="lb-info">
                  <span className="lb-name-text">{toDisplayName(r, i)}</span>
                  <span className="lb-realm-tag">{getCultivationTitle(i)}</span>
                  <span className="lb-meta-text">
                    {accuracy(r)}% Tâm Pháp • {r.attempts || 0} lần độ kiếp
                  </span>
                </div>
                <div className="lb-score-val">
                  <span className="lb-points">{Number(r.totalScore || 0).toLocaleString()}</span>
                  <span className="lb-unit">Tu Vi</span>
                </div>
              </div>
            );
          })}

          {!loading && lb.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <EmptyState icon="🧘" text="Chưa có tu sĩ nào xuất thế" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

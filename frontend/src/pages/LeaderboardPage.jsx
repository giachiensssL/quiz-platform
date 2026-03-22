import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL, leaderboardAPI } from '../api/api';
import Navbar from '../components/Navbar';
import { EmptyState } from '../components/UI';

export default function LeaderboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab,setTab]=useState('all');
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

  const matchTargetRow = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    if (highlightHint.id) {
      const byId = rows.find((row) => String(row?._id || row?.id || '') === String(highlightHint.id));
      if (byId) return getRowKey(byId);
    }
    if (highlightHint.username) {
      const byName = rows.find((row) => String(row?.username || '').toLowerCase() === String(highlightHint.username).toLowerCase());
      if (byName) return getRowKey(byName);
    }
    return '';
  };

  const processRankChange = (rows) => {
    const nextRanks = new Map();
    rows.forEach((row, index) => {
      const key = getRowKey(row);
      if (key) nextRanks.set(key, index);
    });

    const targetKey = matchTargetRow(rows);
    if (targetKey) {
      const prevRank = previousRanksRef.current.get(targetKey);
      const nextRank = nextRanks.get(targetKey);
      if (typeof prevRank === 'number' && typeof nextRank === 'number' && nextRank < prevRank) {
        setHighlightedKey(targetKey);
        if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => setHighlightedKey(''), 4500);
      }
    }

    previousRanksRef.current = nextRanks;
  };

  useEffect(() => {
    let mounted = true;
    let socket;
    let reconnectTimer;

    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        const res = await leaderboardAPI.list(tab);
        if (!mounted) return;
        const nextRows = Array.isArray(res?.data) ? res.data : [];
        processRankChange(nextRows);
        setLb(nextRows);
      } catch {
        if (!mounted) return;
        setLb([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadLeaderboard();

    if (location.state?.priorityRefresh && !consumedPriorityStateRef.current) {
      consumedPriorityStateRef.current = true;
      window.setTimeout(loadLeaderboard, 1200);
      navigate('/leaderboard', { replace: true, state: null });
    }

    const timer = window.setInterval(loadLeaderboard, 10000);

    const wsBase = API_BASE_URL.replace(/\/api\/?$/, '').replace(/^http/i, 'ws');
    const wsUrl = `${wsBase}/ws`;
    const connectSocket = () => {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data || '{}');
          if (payload?.event === 'leaderboard-updated') {
            loadLeaderboard();
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onclose = () => {
        if (!mounted) return;
        reconnectTimer = window.setTimeout(connectSocket, 2000);
      };
    };
    connectSocket();

    return () => {
      mounted = false;
      window.clearInterval(timer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, [location.state, navigate, tab]);

  const toDisplayName = (row) => row?.fullName || row?.username || 'Người dùng';
  const accuracy = (row) => {
    const total = Number(row?.correctTotal || 0) + Number(row?.wrongTotal || 0);
    const correct = Number(row?.correctTotal || 0);
    if (!total || !correct) return 0;
    return Math.round((correct / total) * 100);
  };

  const topThree = lb.slice(0, 3);
  const others = lb.slice(3);
  const bestScore = Number(lb[0]?.totalScore || 0);

  return (
    <div className="app-wrapper"><Navbar/>
      <div className="page-content leaderboard-page">
        <div className="page-header">
          <div className="page-title">🏆 Bảng xếp hạng</div>
          <div className="page-sub">Top sinh viên toàn hệ thống</div>
        </div>

        <div className="lb-hero">
          <div className="lb-hero-stat">
            <span className="lb-hero-label">Người tham gia</span>
            <strong>{lb.length}</strong>
          </div>
          <div className="lb-hero-stat">
            <span className="lb-hero-label">Điểm cao nhất</span>
            <strong>{bestScore.toLocaleString()}</strong>
          </div>
          <div className="lb-hero-stat">
            <span className="lb-hero-label">Chu kỳ</span>
            <strong>{tab === 'all' ? 'Toàn bộ' : tab === 'week' ? 'Tuần này' : 'Tháng này'}</strong>
          </div>
        </div>

        <div className="tab-bar">
          {[['all','Tất cả'],['week','Tuần này'],['month','Tháng này']].map(([k,v])=>(
            <button key={k} className={`tab-btn${tab===k?' active':''}`} onClick={()=>setTab(k)}>{v}</button>
          ))}
        </div>

        <div className="table-wrap lb-list-wrap" style={{ marginBottom: 12 }}>
          {topThree.map((r, i) => {
            const rowKey = getRowKey(r) || `top-${i}`;
            const isPromoted = highlightedKey && highlightedKey === rowKey;
            const topRowClass = i === 0 ? ' lb-row-top1 lb-row-sparkle-1' : i === 1 ? ' lb-row-top2 lb-row-sparkle-2' : ' lb-row-top3 lb-row-sparkle-3';
            return (
              <div key={rowKey} className={`lb-row${topRowClass}${isPromoted ? ' lb-row-promoted' : ''}`}>
                <div className={`lb-rank${i===0?' gold':i===1?' silver':' bronze'}`}>
                  {i===0?'🥇':i===1?'🥈':'🥉'}
                </div>
                <div className="lb-avatar">{toDisplayName(r).split(' ').pop()?.[0] || 'U'}</div>
                <div className="lb-name">
                  <strong>
                    {toDisplayName(r)}
                    {isPromoted && <span className="lb-up-badge">↑ Tăng hạng</span>}
                  </strong>
                  <span className="lb-meta">{accuracy(r)}% chính xác • {r.attempts || 0} lượt làm</span>
                </div>
                <div className="lb-pts">{Number(r.totalScore || 0).toLocaleString()} điểm</div>
              </div>
            );
          })}
          {!loading && topThree.length === 0 && <EmptyState icon="🏆" text="Chưa có dữ liệu xếp hạng từ người dùng" />}
        </div>

        <div className="table-wrap lb-list-wrap">
          {loading && <div style={{ padding: 16, color: 'var(--muted)' }}>Đang tải bảng xếp hạng...</div>}
          {!loading && lb.length === 0 && <EmptyState icon="🏆" text="Chưa có dữ liệu xếp hạng từ người dùng" />}
          {others.map((r,i)=>{
            const absoluteRank = i + 4;
            const rowKey = getRowKey(r) || `row-${absoluteRank}`;
            const isPromoted = highlightedKey && highlightedKey === rowKey;
            return (
            <div key={rowKey} className={`lb-row${isPromoted ? ' lb-row-promoted' : ''}`}>
              <div className="lb-rank">
                #{absoluteRank}
              </div>
              <div className="lb-avatar">{toDisplayName(r).split(' ').pop()?.[0] || 'U'}</div>
              <div className="lb-name">
                <strong>
                  {toDisplayName(r)}
                  {isPromoted && <span className="lb-up-badge">↑ Tăng hạng</span>}
                </strong>
                <span className="lb-meta">{accuracy(r)}% chính xác • {r.attempts || 0} lượt làm</span>
              </div>
              <div className="lb-pts">{Number(r.totalScore || 0).toLocaleString()} điểm</div>
            </div>
          )})}
        </div>
      </div>
    </div>
  );
}

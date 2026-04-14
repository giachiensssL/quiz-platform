import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { leaderboardAPI, getFullAvatarUrl } from '../api/api';
import Navbar from '../components/Navbar';
import { EmptyState } from '../components/UI';

const CULTIVATION_TITLES = [
  'Thánh Nhân',
  'Tiên Đế',
  'Tiên Tôn',
  'Tiên Vương',
  'Đại La Kim Tiên',
  'Thái Ất Kim Tiên',
  'Kim Tiên',
  'Chân Tiên',
  'Tiên Nhân',
  'Độ Kiếp',
];

const RANK_COLORS = ['#FFD700','#C0C0C0','#CD7F32','#E879F9','#60A5FA','#34D399'];

export default function LeaderboardPage() {
  const location = useLocation();
  const [tab, setTab] = useState('all');
  const [lb, setLb] = useState([]);
  const [loading, setLoading] = useState(false);
  const previousRanksRef = useRef(new Map());

  const getRowKey = (row) => String(row?._id || row?.id || row?.userId || row?.username || '');

  const loadLeaderboard = async (mountedRef, currentTab) => {
    try {
      setLoading(true);
      const res = await leaderboardAPI.list(currentTab);
      if (!mountedRef.current) return;
      const nextRows = Array.isArray(res?.data) ? res.data : [];
      const nextRanks = new Map();
      nextRows.forEach((row, idx) => { const k = getRowKey(row); if (k) nextRanks.set(k, idx); });
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
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [tab]);

  const getCultivationTitle = (index) => {
    if (index === -1) return 'Thiên Đạo Admin Đại Đế';
    return CULTIVATION_TITLES[index] || 'Phàm Nhân';
  };

  const getRankColor = (index) => RANK_COLORS[index] || '#94a3b8';

  const toDisplayName = (row) => row?.fullName || row?.username || 'Đạo Hữu';

  const accuracy = (row) => {
    const total = Number(row?.correctTotal || 0) + Number(row?.wrongTotal || 0);
    const correct = Number(row?.correctTotal || 0);
    if (!total || !correct) return 0;
    return Math.round((correct / total) * 100);
  };

  const top3 = lb.slice(0, 3);
  const rest = lb.slice(3);

  // Stable random particles
  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    size: 2 + (((i * 7 + 3) % 5)),
    left: (i * 4.17) % 100,
    delay: (i * 0.65) % 15,
    dur: 15 + (i * 1.3) % 20,
    color: ['#FFD700','#d4af37','#C0C0C0','#E879F9','#60A5FA'][i % 5],
  })), []);

  return (
    <div style={{ minHeight: '100vh', background: '#050510', color: '#e2e8f0', position: 'relative', overflow: 'hidden' }}>
      <Navbar />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Inter:wght@400;500;600;700&display=swap');

        .lb-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(120,40,200,0.25) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 20% 80%, rgba(212,175,55,0.12) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(60,100,200,0.1) 0%, transparent 50%),
            #050510;
        }

        .lb-particle {
          position: fixed; border-radius: 50%; pointer-events: none; z-index: 1;
          animation: lbParticle linear infinite;
        }
        @keyframes lbParticle {
          0%   { transform: translateY(110vh) scale(0); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 0.5; }
          100% { transform: translateY(-15vh) scale(1.2); opacity: 0; }
        }

        /* HEADER */
        .lb-header { position: relative; text-align: center; padding: 64px 20px 24px; z-index: 2; }
        .lb-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.8rem, 5vw, 3.2rem);
          font-weight: 900;
          color: #FFD700;
          text-shadow: 0 0 30px rgba(255,215,0,0.6), 0 2px 4px rgba(0,0,0,0.8);
          letter-spacing: 4px;
          animation: lbTitlePulse 3.5s ease-in-out infinite alternate;
        }
        @keyframes lbTitlePulse {
          from { text-shadow: 0 0 15px rgba(255,215,0,0.4), 0 2px 4px rgba(0,0,0,0.8); }
          to   { text-shadow: 0 0 40px rgba(255,215,0,0.9), 0 0 80px rgba(255,215,0,0.3), 0 2px 4px rgba(0,0,0,0.8); }
        }
        .lb-subtitle {
          font-family: 'Inter', serif; font-style: italic;
          color: rgba(212,175,55,0.75); font-size: 1.05rem; letter-spacing: 2px; margin-top: 10px;
          animation: lbFadeUp 1s ease 0.4s both;
          text-shadow: 0 1px 3px rgba(0,0,0,0.6);
        }
        .lb-divider {
          display: flex; align-items: center; gap: 16px; justify-content: center;
          margin: 20px auto; max-width: 560px;
        }
        .lb-divider-line { flex:1; height:1px; background: linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent); }
        .lb-divider-gem {
          width:8px; height:8px; background:#d4af37; transform:rotate(45deg);
          box-shadow: 0 0 10px #d4af37;
          animation: lbGemPulse 2s ease-in-out infinite;
        }
        @keyframes lbGemPulse {
          0%,100% { box-shadow: 0 0 6px #d4af37; transform: rotate(45deg) scale(1); }
          50%      { box-shadow: 0 0 24px #ffd700, 0 0 48px rgba(212,175,55,0.35); transform: rotate(45deg) scale(1.35); }
        }

        /* TABS */
        .lb-tabs {
          display: flex; justify-content: center; gap: 12px;
          margin: 0 0 36px; z-index: 2; position: relative;
        }
        .lb-tab {
          font-family: 'Playfair Display', serif;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,175,55,0.25);
          color: rgba(212,175,55,0.65);
          padding: 10px 24px; border-radius: 40px; cursor: pointer;
          font-size: 0.85rem; letter-spacing: 1px;
          transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
          position: relative; overflow: hidden;
        }
        .lb-tab::before {
          content:''; position:absolute; inset:0;
          background: linear-gradient(135deg, rgba(212,175,55,0.1), transparent);
          opacity:0; transition: opacity 0.3s;
        }
        .lb-tab:hover::before { opacity:1; }
        .lb-tab.active {
          border-color: #d4af37; color: #ffd700;
          background: rgba(212,175,55,0.1);
          box-shadow: 0 0 22px rgba(212,175,55,0.28), inset 0 0 20px rgba(212,175,55,0.05);
        }

        /* STATS */
        .lb-stats {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 16px;
          max-width: 860px; margin: 0 auto 36px; padding: 0 20px;
          z-index: 2; position: relative;
        }
        .lb-stat {
          background: rgba(12,12,35,0.85); border: 1px solid rgba(212,175,55,0.18);
          border-radius: 14px; padding: 20px 16px; text-align: center;
          position: relative; overflow: hidden; backdrop-filter: blur(12px);
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .lb-stat:hover { transform: translateY(-5px); }
        .lb-stat::after {
          content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%;
          background: radial-gradient(circle at 50% 50%, rgba(212,175,55,0.06), transparent 60%);
        }
        .lb-stat-val {
          font-family:'Playfair Display', serif; font-size:1.6rem; font-weight:700; color:#FFD700;
          text-shadow: 0 0 15px rgba(255,215,0,0.4), 0 1px 3px rgba(0,0,0,0.8); display:block;
        }
        .lb-stat-label {
          font-size:0.75rem; color:rgba(212,175,55,0.6); text-transform:uppercase;
          letter-spacing:1.5px; margin-top:6px; display:block;
        }

        /* TOP 3 PODIUM */
        .lb-podium { max-width: 860px; margin: 0 auto 40px; padding: 0 20px; z-index:2; position:relative; }
        .lb-podium-wrap { display:flex; align-items:flex-end; justify-content:center; gap:14px; }
        .lb-podium-card {
          flex:1; max-width: 250px; border-radius: 18px; padding: 28px 16px 22px;
          text-align: center; position: relative; overflow: hidden; cursor: default;
          transition: transform 0.4s cubic-bezier(0.34,1.2,0.64,1);
          animation: lbPodiumRise 0.8s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .lb-podium-card:hover { transform: translateY(-10px) scale(1.03); }
        .lb-podium-card.r1 {
          order:2; animation-delay:0.05s; padding-top:44px;
          background: linear-gradient(160deg, rgba(40,25,0,0.97), rgba(18,12,0,0.98));
          border: 1px solid rgba(255,215,0,0.55);
          box-shadow: 0 0 50px rgba(255,215,0,0.18), 0 24px 70px rgba(0,0,0,0.7);
        }
        .lb-podium-card.r2 {
          order:1; animation-delay:0.2s;
          background: linear-gradient(160deg, rgba(18,18,32,0.97), rgba(12,12,22,0.98));
          border: 1px solid rgba(192,192,192,0.32);
          box-shadow: 0 0 30px rgba(192,192,192,0.08), 0 20px 50px rgba(0,0,0,0.6);
        }
        .lb-podium-card.r3 {
          order:3; animation-delay:0.3s;
          background: linear-gradient(160deg, rgba(28,18,8,0.97), rgba(18,10,4,0.98));
          border: 1px solid rgba(205,127,50,0.32);
          box-shadow: 0 0 30px rgba(205,127,50,0.08), 0 20px 50px rgba(0,0,0,0.6);
        }
        @keyframes lbPodiumRise {
          from { opacity:0; transform:translateY(70px) scale(0.75); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .lb-podium-shine {
          position:absolute; top:-50%; left:-50%; width:200%; height:200%;
          background: linear-gradient(45deg, transparent 38%, rgba(255,215,0,0.06) 50%, transparent 62%);
          animation: lbShine 5s infinite; pointer-events:none;
        }
        @keyframes lbShine { from{transform:translateX(-100%);} to{transform:translateX(100%);} }
        .lb-podium-crown {
          font-size:2.2rem; display:block; margin-bottom:10px;
          animation: lbCrownFloat 3s ease-in-out infinite;
        }
        @keyframes lbCrownFloat {
          0%,100% { transform:translateY(0); }
          50%      { transform:translateY(-7px); }
        }
        .lb-podium-avatar {
          width:74px; height:74px; border-radius:50%; margin:0 auto 12px;
          display:flex; align-items:center; justify-content:center;
          font-size:1.85rem; font-family:'Playfair Display', serif; font-weight:700;
          overflow:hidden; position:relative;
        }
        .r1 .lb-podium-avatar {
          background: radial-gradient(circle, rgba(255,215,0,0.22), rgba(90,50,0,0.55));
          border:2.5px solid #FFD700; box-shadow:0 0 32px rgba(255,215,0,0.45); color:#FFD700;
        }
        .r2 .lb-podium-avatar {
          background: radial-gradient(circle, rgba(192,192,192,0.2), rgba(50,50,70,0.55));
          border:2px solid #C0C0C0; color:#C0C0C0;
        }
        .r3 .lb-podium-avatar {
          background: radial-gradient(circle, rgba(205,127,50,0.2), rgba(60,30,10,0.55));
          border:2px solid #CD7F32; color:#CD7F32;
        }
        .lb-podium-rank-zh {
          font-family:'Inter', sans-serif; font-size:0.85rem; letter-spacing:2px;
          color:rgba(255,255,255,0.5); margin-bottom:6px; display:block; font-style:italic;
        }
        .lb-podium-name {
          font-family:'Playfair Display', serif; font-size:1rem; font-weight:700;
          margin-bottom:8px; word-break:break-word; line-height:1.3;
        }
        .r1 .lb-podium-name { color:#FFD700; text-shadow:0 0 12px rgba(255,215,0,0.4); font-size:1.1rem; }
        .r2 .lb-podium-name { color:#D0D0D0; }
        .r3 .lb-podium-name { color:#D4935A; }
        .lb-podium-tag {
          display:inline-block; font-size:0.7rem; padding:4px 12px; border-radius:20px;
          letter-spacing:0.5px; text-transform:uppercase; font-family:'Playfair Display', serif; margin-bottom:14px;
          font-weight:600;
        }
        .r1 .lb-podium-tag { background:rgba(255,215,0,0.15); border:1px solid rgba(255,215,0,0.45); color:#FFD700; }
        .r2 .lb-podium-tag { background:rgba(192,192,192,0.1); border:1px solid rgba(192,192,192,0.35); color:#D0D0D0; }
        .r3 .lb-podium-tag { background:rgba(205,127,50,0.1); border:1px solid rgba(205,127,50,0.35); color:#D4935A; }
        .lb-podium-score {
          font-family:'Playfair Display', serif; font-size:1.6rem; font-weight:900; display:block;
          text-shadow: 0 0 20px currentColor, 0 1px 3px rgba(0,0,0,0.8);
        }
        .r1 .lb-podium-score { color:#FFD700; }
        .r2 .lb-podium-score { color:#D0D0D0; }
        .r3 .lb-podium-score { color:#D4935A; }
        .lb-podium-score-lbl { font-size:0.68rem; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1.5px; }

        /* RANKED LIST */
        .lb-list { max-width:860px; margin:0 auto; padding:0 20px 80px; position:relative; z-index:2; }
        .lb-list-section-title {
          font-family:'Playfair Display', serif; font-size:0.75rem; letter-spacing:4px;
          color:rgba(212,175,55,0.35); text-align:center; margin-bottom:18px; text-transform:uppercase;
        }
        .lb-row {
          display:flex; align-items:center; gap:14px;
          padding:14px 20px; margin-bottom:8px;
          background:rgba(8,8,28,0.75); border-radius:13px;
          border:1px solid rgba(255,255,255,0.04);
          transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
          animation: lbRowIn 0.5s ease both;
          backdrop-filter: blur(6px);
          position: relative; overflow: hidden;
        }
        .lb-row::before {
          content:''; position:absolute; left:0; top:0; bottom:0;
          width:3px;
          background:var(--rc,rgba(212,175,55,0.3));
          box-shadow:0 0 8px var(--rc,rgba(212,175,55,0.3));
          transition: width 0.3s;
        }
        .lb-row:hover { background:rgba(16,16,45,0.92); border-color:rgba(212,175,55,0.12); transform:translateX(5px); }
        .lb-row:hover::before { width:5px; }
        @keyframes lbRowIn {
          from { opacity:0; transform:translateX(-24px); }
          to   { opacity:1; transform:translateX(0); }
        }
        .lb-row-rank {
          font-family:'Playfair Display', serif; font-size:0.9rem; font-weight:700;
          color:rgba(212,175,55,0.55); width:36px; text-align:center; flex-shrink:0;
        }
        .lb-row-avatar {
          width:42px; height:42px; border-radius:50%; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          font-size:1.1rem; font-family:'Playfair Display', serif; font-weight:700;
          border:1px solid var(--rc,rgba(212,175,55,0.3));
          background:rgba(8,8,28,0.9); color:var(--rc,rgba(212,175,55,0.7));
          overflow:hidden;
        }
        .lb-row-info { flex:1; min-width:0; }
        .lb-row-name {
          font-family:'Playfair Display', serif; font-size:0.95rem; font-weight:700; color:#e8eaf0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          text-shadow:0 1px 3px rgba(0,0,0,0.6);
        }
        .lb-row-tag {
          font-size:0.68rem; padding:2px 10px; border-radius:10px;
          border:1px solid var(--rc,rgba(212,175,55,0.3));
          color:var(--rc,rgba(212,175,55,0.8));
          background:rgba(212,175,55,0.06);
          display:inline-block; margin-top:4px; letter-spacing:0.5px; text-transform:uppercase;
          font-family:'Playfair Display', serif; font-weight:600;
        }
        .lb-row-meta { font-size:0.72rem; color:rgba(255,255,255,0.35); margin-top:3px; }
        .lb-row-score { text-align:right; flex-shrink:0; }
        .lb-row-pts {
          font-family:'Playfair Display', serif; font-size:1.2rem; font-weight:900;
          color:var(--rc,rgba(212,175,55,0.9));
          text-shadow:0 0 14px var(--rc,transparent), 0 1px 3px rgba(0,0,0,0.6); display:block;
        }
        .lb-row-unit { font-size:0.62rem; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:1px; }

        /* ADMIN ROW - Thiên Đạo, luôn đứng trên cùng */
        .lb-admin-wrap {
          max-width:860px; margin:0 auto 30px; padding:0 20px;
          position:relative; z-index:2;
        }
        .lb-admin-label {
          font-family:'Playfair Display', serif; font-size:0.72rem; letter-spacing:3px;
          color:rgba(212,175,55,0.55); text-align:center; margin-bottom:14px;
          text-transform:uppercase; text-shadow:0 0 8px rgba(212,175,55,0.3);
        }
        .lb-admin {
          display:flex; align-items:center; gap:18px;
          padding: 22px 28px;
          background:linear-gradient(135deg,rgba(60,30,0,0.97),rgba(10,5,0,0.99));
          border-radius:16px;
          position:relative; overflow:hidden;
          animation: lbAdminGlow 4s ease-in-out infinite;
        }
        .lb-admin::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(60deg,transparent 30%,rgba(255,215,0,0.05) 50%,transparent 70%);
          animation:lbShine 4s infinite;
          border-radius:16px;
        }
        /* 3-color rotating border via conic-gradient pseudo-element */
        .lb-admin-border {
          position:absolute; inset:-2px; border-radius:18px; z-index:-1;
          background: conic-gradient(#FFD700 0deg, #C855F7 120deg, #22D3EE 240deg, #FFD700 360deg);
          animation: lbAdminBorderSpin 4s linear infinite;
          filter: blur(1px);
        }
        .lb-admin-border-inner {
          position:absolute; inset:2px; border-radius:16px;
          background:linear-gradient(135deg,rgba(60,30,0,0.97),rgba(10,5,0,0.99));
          z-index:0;
        }
        .lb-admin > * { position:relative; z-index:1; }
        @keyframes lbAdminBorderSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes lbAdminGlow {
          0%,100% { box-shadow:0 0 40px rgba(255,215,0,0.25), 0 0 80px rgba(200,85,247,0.12), 0 16px 50px rgba(0,0,0,0.7); }
          33%      { box-shadow:0 0 50px rgba(200,85,247,0.3), 0 0 90px rgba(34,211,238,0.12), 0 16px 50px rgba(0,0,0,0.7); }
          66%      { box-shadow:0 0 50px rgba(34,211,238,0.28), 0 0 90px rgba(255,215,0,0.12), 0 16px 50px rgba(0,0,0,0.7); }
        }
        /* 3-color halo ring around admin avatar */
        .lb-admin-avatar-wrap {
          position:relative; flex-shrink:0; width:60px; height:60px;
        }
        .lb-admin-avatar-halo {
          position:absolute; inset:-4px; border-radius:50%;
          background: conic-gradient(#FFD700 0deg, #C855F7 120deg, #22D3EE 240deg, #FFD700 360deg);
          animation: lbAdminAvatarSpin 3s linear infinite;
          z-index:0;
        }
        .lb-admin-avatar-halo-outer {
          position:absolute; inset:-8px; border-radius:50%;
          background: conic-gradient(rgba(255,215,0,0.3) 0deg, rgba(200,85,247,0.3) 120deg, rgba(34,211,238,0.3) 240deg, rgba(255,215,0,0.3) 360deg);
          animation: lbAdminAvatarSpin 6s linear infinite reverse;
          filter: blur(4px);
          z-index:0;
        }
        .lb-admin-avatar {
          position:relative; z-index:1;
          width:60px; height:60px; border-radius:50%;
          background:rgba(10,5,0,0.9);
          display:flex; align-items:center; justify-content:center;
          font-size:1.8rem;
        }
        @keyframes lbAdminAvatarSpin {
          from { transform:rotate(0deg); }
          to   { transform:rotate(360deg); }
        }

        /* LOADING */
        .lb-loading {
          text-align:center; padding:70px;
          color:rgba(212,175,55,0.38);
          font-family:'Inter', sans-serif; font-style:italic; font-size:1.2rem;
        }
        .lb-loading-dots span { display:inline-block; animation: lbDot 1.4s ease infinite; }
        .lb-loading-dots span:nth-child(2) { animation-delay:0.22s; }
        .lb-loading-dots span:nth-child(3) { animation-delay:0.44s; }
        @keyframes lbDot {
          0%,80%,100% { transform:scale(0.4); opacity:0.2; }
          40%          { transform:scale(1.3); opacity:1; }
        }
        @keyframes lbFadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* Background */}
      <div className="lb-bg" />
      {particles.map((p) => (
        <div key={p.id} className="lb-particle" style={{
          width: p.size, height: p.size,
          left: `${p.left}%`, bottom: '-20px',
          background: p.color,
          boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`,
        }} />
      ))}

      {/* Header */}
      <header className="lb-header">
        <h1 className="lb-title">Thiên Môn Bảng</h1>
        <p className="lb-subtitle">Những vị Thiên Kiêu đứng đầu Thiên môn học viện</p>
        <div className="lb-divider">
          <div className="lb-divider-line" />
          <div className="lb-divider-gem" />
          <div className="lb-divider-line" />
        </div>
      </header>

      {/* Tabs */}
      <div className="lb-tabs">
        {[['all','⚔ Toàn Giới'],['week','🌙 Tuần Này'],['month','⭐ Tháng Này']].map(([k,v]) => (
          <button key={k} className={`lb-tab${tab===k?' active':''}`} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="lb-stats">
        <div className="lb-stat">
          <span className="lb-stat-val">{lb.length}</span>
          <span className="lb-stat-label">Đạo Hữu Tham Gia</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-val">{(lb[0]?.totalScore || 0).toLocaleString()}</span>
          <span className="lb-stat-label">Tu Vi Cao Nhất</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-val">{tab==='all'?'Vĩnh Hằng':tab==='week'?'Tuần Này':'Tháng Này'}</span>
          <span className="lb-stat-label">Thời Gian</span>
        </div>
      </div>

      {/* ===== Admin Đại Đế - Always pinned at top, above all ===== */}
      <div className="lb-admin-wrap">
        <div className="lb-admin-label">— Thiên Đạo — Vượt Ngoài Bảng Xếp Hạng —</div>
        <div className="lb-admin" style={{ position:'relative' }}>
          <div className="lb-admin-border" />
          <div className="lb-admin-border-inner" />
          {/* 3-color halo avatar */}
          <div className="lb-admin-avatar-wrap">
            <div className="lb-admin-avatar-halo-outer" />
            <div className="lb-admin-avatar-halo" />
            <div className="lb-admin-avatar">👑</div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{
              fontFamily:"'Playfair Display', serif", fontWeight:900, fontSize:'1.2rem',
              color:'#FFD700',
              textShadow:'0 0 20px rgba(255,215,0,0.7), 0 2px 4px rgba(0,0,0,0.8)',
              letterSpacing:2, marginBottom:6,
            }}>Admin Đại Đế</div>
            <span style={{
              fontSize:'0.72rem', padding:'4px 14px', borderRadius:20,
              border:'1px solid rgba(255,215,0,0.5)',
              background:'rgba(255,215,0,0.1)', display:'inline-block',
              letterSpacing:1.5, textTransform:'uppercase',
              fontFamily:"'Inter', sans-serif", fontWeight:600,
              color:'#FFD700',
            }}>Thiên Đạo</span>
            <div style={{ fontSize:'0.76rem', color:'rgba(255,255,255,0.5)', marginTop:5, fontFamily:"'Inter', sans-serif" }}>
              Thiên đạo pháp tắc 
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <span style={{
              fontFamily:"'Playfair Display', serif", fontSize:'2.2rem', fontWeight:900, display:'block',
              color:'#FFD700',
              textShadow:'0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(200,85,247,0.4), 0 2px 4px rgba(0,0,0,0.9)',
            }}>∞</span>
            <span style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:1 }}>Tu Vi</span>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {!loading && top3.length > 0 && (
        <div className="lb-podium">
          <div className="lb-podium-wrap">
            {[
              { rClass:'r2', rank:2, data:top3[1], crown:'🥈' },
              { rClass:'r1', rank:1, data:top3[0], crown:'👑' },
              { rClass:'r3', rank:3, data:top3[2], crown:'🥉' },
            ].map(({ rClass, rank, data, crown }) => data && (
              <div key={rank} className={`lb-podium-card ${rClass}`}>
                {rClass === 'r1' && <div className="lb-podium-shine" />}
                <span className="lb-podium-crown">{crown}</span>
                <div className="lb-podium-avatar">
                  {getFullAvatarUrl(data.avatar) ? (
                    <img src={getFullAvatarUrl(data.avatar)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (toDisplayName(data)[0] || 'U').toUpperCase()}
                </div>
                <span className="lb-podium-rank-zh">
                  {rank===1?'第一名':rank===2?'第二名':'第三名'}
                </span>
                <div className="lb-podium-name">{toDisplayName(data)}</div>
                <span className="lb-podium-tag">{getCultivationTitle(rank - 1)}</span><br />
                <span className="lb-podium-score">{Number(data.totalScore || 0).toLocaleString()}</span>
                <span className="lb-podium-score-lbl">Tu Vi</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full List */}
      <div className="lb-list">

        {loading && (
          <div className="lb-loading">
            Đang bói toán Thiên Cơ
            <div className="lb-loading-dots" style={{ marginTop:10 }}>
              <span>✦</span>&ensp;<span>✦</span>&ensp;<span>✦</span>
            </div>
          </div>
        )}

        {!loading && lb.length > 0 && (
          <>
            {top3.length > 0 && rest.length > 0 && (
              <div className="lb-list-section-title">— Những Thiên Kiêu Còn Lại —</div>
            )}
            {(top3.length === 0 ? lb : rest).map((r, i) => {
              const ai = top3.length === 0 ? i : i + 3;
              const ar = ai + 1;
              const color = getRankColor(ai);
              return (
                <div key={getRowKey(r) || i} className="lb-row"
                  style={{ '--rc': color, animationDelay: `${i * 0.055}s` }}>
                  <div className="lb-row-rank">#{ar}</div>
                  <div className="lb-row-avatar">
                    {getFullAvatarUrl(r.avatar) ? (
                      <img src={getFullAvatarUrl(r.avatar)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (toDisplayName(r)[0] || 'U').toUpperCase()}
                  </div>
                  <div className="lb-row-info">
                    <div className="lb-row-name">{toDisplayName(r)}</div>
                    <span className="lb-row-tag">{getCultivationTitle(ai)}</span>
                    <div className="lb-row-meta">{accuracy(r)}% Tâm Pháp · {r.attempts || 0} lần độ kiếp</div>
                  </div>
                  <div className="lb-row-score">
                    <span className="lb-row-pts">{Number(r.totalScore || 0).toLocaleString()}</span>
                    <span className="lb-row-unit">Tu Vi</span>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!loading && lb.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <EmptyState icon="🧘" text="Chưa có tu sĩ nào xuất thế" />
          </div>
        )}
      </div>
    </div>
  );
}

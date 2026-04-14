import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, leaderboardAPI } from '../api/api';

const CHAT_HISTORY_KEY = 'qm_chat_history';
const MAX_HISTORY = 200;

export default function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    // Load history from localStorage on first render
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [inputValue, setInputValue] = useState('');
  const [connected, setConnected] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [rankMap, setRankMap] = useState({}); // { username: rankPlusOne }

  const fetchRanks = async () => {
    try {
      const res = await leaderboardAPI.list('all');
      if (res?.data && Array.isArray(res.data)) {
        const newMap = {};
        res.data.slice(0, 10).forEach((item, index) => {
          const name = item.username || item.fullName;
          if (name) newMap[name] = index + 1;
        });
        setRankMap(newMap);
      }
    } catch (err) {
      console.error('Failed to fetch ranks for chat', err);
    }
  };

  useEffect(() => {
    fetchRanks();
    const interval = setInterval(fetchRanks, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getFullAvatarUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const base = API_BASE_URL.replace('/api', '');
    return `${base}${path}`;
  };

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      const toSave = messages.slice(-MAX_HISTORY);
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
    } catch {
      // localStorage full — silent fail
    }
  }, [messages]);

  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const wsUrl = `${protocol}//${host}:5001/ws`;

    const connect = () => {
      if (socketRef.current && socketRef.current.readyState < 2) {
        socketRef.current.close();
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => { setConnected(true); };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'chat_message') {
            setMessages((prev) => [...prev, data.payload]);
            if (!isOpen) setHasNew(true);
          }
        } catch (e) {
          console.error('Chat message error', e);
        }
      };

      socket.onclose = (e) => {
        setConnected(false);
        if (e.code !== 1000 && e.code !== 1001) {
          setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) setHasNew(false);
  }, [isOpen]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const messagePayload = {
      event: 'chat_message',
      user: user.name || user.username,
      text: inputValue,
      avatar: user.avatar || '',
      role: user.role || 'user',      // ← include role for admin detection
      timestamp: Date.now(),
    };

    socketRef.current.send(JSON.stringify(messagePayload));
    setInputValue('');
  };

  const clearHistory = () => {
    if (window.confirm('Xóa toàn bộ lịch sử chat?')) {
      setMessages([]);
      localStorage.removeItem(CHAT_HISTORY_KEY);
    }
  };

  if (!user) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap');

        .xianxia-chat { font-family: 'Inter', sans-serif; }

        .xianxia-header {
          font-family: 'Playfair Display', serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-bottom: 2px solid #d4af37;
          position: relative; overflow: hidden;
        }
        .xianxia-header::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle at 70% 30%, rgba(212,175,55,0.1) 0%, transparent 60%);
          pointer-events: none;
        }

        .xianxia-window {
          background-color: #0f0f1a !important;
          background-image:
            radial-gradient(circle at 10% 10%, rgba(26,26,46,0.8) 0%, transparent 40%),
            radial-gradient(circle at 90% 90%, rgba(22,33,62,0.8) 0%, transparent 40%);
          border: 2px solid #d4af37 !important;
          box-shadow: 0 0 20px rgba(212,175,55,0.2), 0 10px 40px rgba(0,0,0,0.6) !important;
        }

        /* ── Regular messages ── */
        .msg-bubble-other {
          background: rgba(255,255,255,0.05);
          border-left: 3px solid #d4af37;
          border-radius: 4px 12px 12px 4px;
          color: #e0e0e0;
        }
        .msg-bubble-me {
          background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05));
          border-right: 3px solid #d4af37;
          border-radius: 12px 4px 4px 12px;
          color: #fff;
        }

        /* ── Admin messages ── */
        .msg-bubble-admin {
          background: linear-gradient(135deg, rgba(60,30,0,0.9), rgba(20,10,0,0.95));
          border: 1px solid rgba(255,215,0,0.5);
          border-left: 4px solid #FFD700;
          border-radius: 4px 14px 14px 4px;
          color: #fff7e6;
          position: relative;
          overflow: hidden;
          animation: adminMsgGlow 3s ease-in-out infinite;
        }
        .msg-bubble-admin::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(45deg, transparent 35%, rgba(255,215,0,0.04) 50%, transparent 65%);
          animation: adminMsgShine 4s infinite;
          pointer-events: none;
        }
        @keyframes adminMsgGlow {
          0%,100% { box-shadow: 0 0 10px rgba(255,215,0,0.15); }
          50%      { box-shadow: 0 0 20px rgba(255,215,0,0.3), 0 0 40px rgba(200,85,247,0.1); }
        }
        @keyframes adminMsgShine {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        /* Admin avatar = 3-color spinning halo */
        .admin-avatar-wrap {
          position: relative;
          width: 38px; height: 38px; flex-shrink: 0;
        }
        .admin-avatar-halo {
          position: absolute; inset: -3px; border-radius: 50%;
          background: conic-gradient(#FFD700 0deg, #C855F7 120deg, #22D3EE 240deg, #FFD700 360deg);
          animation: adminAvatarSpin 3s linear infinite;
          z-index: 0;
        }
        @keyframes adminAvatarSpin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        .admin-avatar-inner {
          position: relative; z-index: 1;
          width: 38px; height: 38px; border-radius: 50%;
          background: #1a1a2e;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; color: #FFD700; overflow: hidden;
        }

        /* ── Rank Halos for Top 3 ── */
        .rank-halo-1 {
          position: absolute; inset: -3px; border-radius: 50%;
          border: 2px solid #FFD700;
          box-shadow: 0 0 12px rgba(255, 215, 0, 0.7);
          animation: rank-pulse 2s infinite ease-in-out;
          z-index: 0;
        }
        .rank-halo-2 {
          position: absolute; inset: -3px; border-radius: 50%;
          border: 2px solid #C0C0C0;
          box-shadow: 0 0 12px rgba(192, 192, 192, 0.6);
          animation: rank-pulse 2.5s infinite ease-in-out;
          z-index: 0;
        }
        .rank-halo-3 {
          position: absolute; inset: -3px; border-radius: 50%;
          border: 2px solid #CD7F32;
          box-shadow: 0 0 12px rgba(205, 127, 50, 0.6);
          animation: rank-pulse 3s infinite ease-in-out;
          z-index: 0;
        }
        @keyframes rank-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.18); opacity: 0.9; }
        }

        /* Tag labels */
        .admin-name-label {
          font-size: 0.72rem; font-weight: 700;
          color: #FFD700;
          text-shadow: 0 0 8px rgba(255,215,0,0.5);
          display: flex; align-items: center; gap: 4px;
          margin-bottom: 4px; margin-left: 4px;
        }
        .admin-crown { font-size: 0.8rem; animation: crownBob 2s ease-in-out infinite; }
        @keyframes crownBob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-3px);} }
        .admin-badge {
          font-size: 0.6rem; padding: 1px 7px; border-radius: 10px;
          background: rgba(255,215,0,0.15); border: 1px solid rgba(255,215,0,0.5);
          color: #FFD700; font-weight: 600; letter-spacing: 0.5px;
        }

        /* Input & helpers */
        .xianxia-input-wrap {
          background: #16213e;
          border-top: 1px solid rgba(212,175,55,0.3);
        }
        .xianxia-input {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(212, 175, 55, 0.2) !important;
          color: #fff !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 0.95rem !important;
        }
        .xianxia-input:focus {
          border-color: #d4af37 !important;
          box-shadow: 0 0 8px rgba(212, 175, 55, 0.3) !important;
        }
        .xianxia-btn {
          background: linear-gradient(135deg, #d4af37, #aa8a2e);
          color: #0f0f1a;
          box-shadow: 0 2px 10px rgba(212, 175, 55, 0.3);
          transition: all 0.3s;
        }
        .xianxia-btn:hover:not(:disabled) {
          transform: scale(1.08);
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.5);
        }
        .xianxia-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Toggle button */
        .chat-toggle-btn {
          background: linear-gradient(135deg, #1a1a2e, #16213e) !important;
          border: 2px solid #d4af37 !important;
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.4) !important;
          transition: all 0.3s !important;
        }
        .chat-toggle-btn:hover {
          transform: translateY(-5px) scale(1.1) !important;
          box-shadow: 0 0 25px rgba(212, 175, 55, 0.6) !important;
        }
        .aura-effect {
          position: absolute; width: 100%; height: 100%; border-radius: 50%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.2), transparent 70%);
          animation: auraPulse 3s ease-in-out infinite; z-index: -1;
        }
        @keyframes auraPulse {
          0%,100%{transform:scale(1); opacity:0.3;}
          50%{transform:scale(1.2); opacity:0.6;}
        }

        /* Scrollbar */
        .scroll-custom::-webkit-scrollbar { width: 4px; }
        .scroll-custom::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
        .scroll-custom::-webkit-scrollbar-thumb { background: #d4af37; border-radius: 10px; }

        /* History separator */
        .chat-history-sep {
          text-align: center; font-size: 0.65rem;
          color: rgba(212, 175, 55, 0.35); letter-spacing: 2px;
          padding: 4px 0; border-top: 1px solid rgba(212, 175, 55, 0.1);
          margin-bottom: 8px; font-family: 'Playfair Display', serif; font-style: italic;
        }
      `}</style>

      {/* Floating Button */}
      <button
        className="chat-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', bottom: '25px', right: '25px',
          width: '65px', height: '65px', borderRadius: '50%',
          color: '#d4af37', cursor: 'pointer', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px',
        }}
      >
        <span style={{ position: 'relative', zIndex: 1 }}>{isOpen ? '✕' : '📜'}</span>
        {!isOpen && (hasNew || !connected) && (
          <div style={{
            position: 'absolute', top: '5px', right: '5px',
            width: '14px', height: '14px', borderRadius: '50%',
            backgroundColor: !connected ? '#ff4d4d' : '#d4af37',
            border: '2px solid #1a1a2e', zIndex: 2,
            boxShadow: '0 0 8px currentColor',
          }} />
        )}
        <div className="aura-effect" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className="xianxia-window xianxia-chat"
          style={{
            position: 'fixed', bottom: '100px', right: '25px',
            width: '380px', height: '560px',
            borderRadius: '12px', display: 'flex', flexDirection: 'column',
            zIndex: 1000, overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div className="xianxia-header" style={{
            padding: '14px 18px', color: '#d4af37', fontWeight: 700,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            letterSpacing: '2px',
          }}>
            <span style={{ fontSize: '1.1rem', textShadow: '0 0 10px rgba(212, 175, 55, 0.5)' }}>
              📜 Vạn Giới Truyền Tin
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: connected ? '#4caf50' : '#f44336',
                boxShadow: connected ? '0 0 8px #4caf50' : 'none',
              }} />
              <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 400 }}>
                {connected ? 'Linh lực ổn định' : 'Mất kết nối'}
              </span>
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  title="Xóa lịch sử"
                  style={{
                    background: 'none', border: 'none', color: 'rgba(212, 175, 55, 0.4)',
                    cursor: 'pointer', fontSize: '0.75rem', padding: '2px 4px',
                    lineHeight: 1,
                  }}
                >🗑</button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="scroll-custom" style={{
            flex: 1, padding: '16px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {messages.length > 0 && (
              <div className="chat-history-sep">
                — Lịch sử truyền tin ({messages.length} tin) —
              </div>
            )}
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center', color: 'rgba(212, 175, 55, 0.4)',
                marginTop: '80px', fontStyle: 'italic', fontSize: '0.9rem',
              }}>
                Chưa có đạo hữu nào truyền tin...
              </div>
            )}

            {messages.map((msg, i) => {
              const isMe = msg.user === (user.name || user.username);
              const isAdmin = msg.role === 'admin';
              const avatar = getFullAvatarUrl(msg.avatar);
              const ts = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
              const rRank = rankMap[msg.user] || 0;

              if (isAdmin) {
                // ── Admin message (full-width, centered, special) ──
                return (
                  <div key={i} style={{ alignSelf: 'stretch', width: '100%' }}>
                    <div style={{
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                    }}>
                      {/* 3-color halo avatar */}
                      <div className="admin-avatar-wrap">
                        <div className="admin-avatar-halo" />
                        <div className="admin-avatar-inner">
                          {avatar
                            ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : '👑'}
                        </div>
                      </div>
                      <div style={{ flex: 1. }}>
                        <div className="admin-name-label">
                          <span className="admin-crown">👑</span>
                          <span>Admin Đại Đế</span>
                          <span className="admin-badge">Admin</span>
                          {ts && <span style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.3)', marginLeft: 4 }}>{ts}</span>}
                        </div>
                        <div className="msg-bubble-admin" style={{
                          padding: '10px 14px', fontSize: '0.95rem',
                          wordBreak: 'break-word', lineHeight: '1.5',
                        }}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // ── Regular message ──
              return (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                    flexDirection: isMe ? 'row-reverse' : 'row',
                  }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      border: rRank > 0 ? 'none' : '1.5px solid #d4af37', 
                      backgroundColor: '#1a1a2e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', color: '#d4af37', flexShrink: 0,
                      position: 'relative',
                      boxShadow: '0 0 8px rgba(212, 175, 55, 0.15)',
                    }}>
                      {rRank === 1 && <div className="rank-halo-1" />}
                      {rRank === 2 && <div className="rank-halo-2" />}
                      {rRank === 3 && <div className="rank-halo-3" />}
                      <div style={{
                        width: '100%', height: '100%', borderRadius: '50%', 
                        overflow: 'hidden', position: 'relative', zIndex: 1,
                        background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {avatar
                          ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (msg.user ? msg.user[0].toUpperCase() : 'U')}
                      </div>
                    </div>
                    <div>
                      {!isMe && (
                        <div style={{
                          fontSize: '0.7rem', color: '#d4af37',
                          marginBottom: '3px', marginLeft: '4px',
                          fontWeight: 600, opacity: 0.75,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {msg.user}
                          {ts && <span style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.25)', fontWeight: 400 }}>{ts}</span>}
                        </div>
                      )}
                      <div
                        className={isMe ? 'msg-bubble-me' : 'msg-bubble-other'}
                        style={{
                          padding: '9px 13px', fontSize: '0.92rem',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                          wordBreak: 'break-word', lineHeight: '1.45',
                        }}
                      >
                        {msg.text}
                      </div>
                      {isMe && ts && (
                        <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.25)', marginTop: 2, textAlign: 'right' }}>{ts}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="xianxia-input-wrap" style={{
            padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center',
          }}>
            <input
              type="text"
              className="xianxia-input"
              placeholder="Truyền niệm..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{ flex: 1, padding: '9px 14px', borderRadius: '8px', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || !connected}
              className="xianxia-btn"
              style={{
                border: 'none', borderRadius: '8px',
                width: '40px', height: '40px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0,
              }}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

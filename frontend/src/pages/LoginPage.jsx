import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AUTH_NOTICE_KEY } from '../api/api';
import { Button, Input } from '../components/UI';

/* ─── Dragon SVG decorations ─── */
const DragonLeft = () => (
  <svg viewBox="0 0 80 260" style={{ position: 'absolute', left: -58, top: '50%', transform: 'translateY(-50%)', width: 58, height: 260, filter: 'drop-shadow(0 0 8px #f59e0b)' }} xmlns="http://www.w3.org/2000/svg">
    <path d="M60 10 C20 40, 70 80, 30 120 C-10 160, 70 190, 40 230 C20 250, 55 260, 65 250" stroke="#f59e0b" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <circle cx="65" cy="10" r="7" fill="#f59e0b" opacity="0.9"/>
    <ellipse cx="30" cy="120" rx="10" ry="6" fill="#fbbf24" opacity="0.7" transform="rotate(-20 30 120)"/>
    <ellipse cx="55" cy="200" rx="8" ry="5" fill="#fbbf24" opacity="0.7" transform="rotate(15 55 200)"/>
    {[40, 80, 115, 155, 200, 235].map((y, i) => (
      <ellipse key={i} cx={i % 2 === 0 ? 45 : 30} cy={y} rx="8" ry="4" fill="#f59e0b" opacity="0.55" transform={`rotate(${i * 20} ${i % 2 === 0 ? 45 : 30} ${y})`}/>
    ))}
  </svg>
);

const DragonRight = () => (
  <svg viewBox="0 0 80 260" style={{ position: 'absolute', right: -58, top: '50%', transform: 'translateY(-50%) scaleX(-1)', width: 58, height: 260, filter: 'drop-shadow(0 0 8px #f59e0b)' }} xmlns="http://www.w3.org/2000/svg">
    <path d="M60 10 C20 40, 70 80, 30 120 C-10 160, 70 190, 40 230 C20 250, 55 260, 65 250" stroke="#f59e0b" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <circle cx="65" cy="10" r="7" fill="#f59e0b" opacity="0.9"/>
    <ellipse cx="30" cy="120" rx="10" ry="6" fill="#fbbf24" opacity="0.7" transform="rotate(-20 30 120)"/>
    <ellipse cx="55" cy="200" rx="8" ry="5" fill="#fbbf24" opacity="0.7" transform="rotate(15 55 200)"/>
    {[40, 80, 115, 155, 200, 235].map((y, i) => (
      <ellipse key={i} cx={i % 2 === 0 ? 45 : 30} cy={y} rx="8" ry="4" fill="#f59e0b" opacity="0.55" transform={`rotate(${i * 20} ${i % 2 === 0 ? 45 : 30} ${y})`}/>
    ))}
  </svg>
);

/* ─── Floating particle sparks ─── */
function GoldSparks() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 3 + (i % 3),
            height: 3 + (i % 3),
            borderRadius: '50%',
            background: i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#f59e0b' : '#fde68a',
            left: `${8 + i * 5}%`,
            bottom: `${10 + (i % 5) * 12}%`,
            animation: `floatSpark ${2.5 + (i % 4) * 0.6}s ease-in-out ${i * 0.3}s infinite alternate`,
            boxShadow: `0 0 6px 2px currentColor`,
            opacity: 0.75,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main Login Page ─── */
export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
    if (!notice) return;
    setError(notice);
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.username || !form.password) { setError('Vui lòng nhập đầy đủ thông tin.'); return; }
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 500));
    const res = await login(form.username, form.password);
    setLoading(false);
    if (res.success) navigate(res.role === 'admin' ? '/admin' : '/');
    else setError(res.error);
  };

  return (
    <>
      {/* ── Keyframes ── */}
      <style>{`
        @keyframes floatSpark {
          from { transform: translateY(0) scale(1); opacity: 0.5; }
          to   { transform: translateY(-28px) scale(1.4); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 30px 6px rgba(245,158,11,0.45), 0 0 80px 20px rgba(245,158,11,0.15), inset 0 0 30px rgba(245,158,11,0.08); }
          50%       { box-shadow: 0 0 50px 12px rgba(245,158,11,0.65), 0 0 120px 40px rgba(245,158,11,0.25), inset 0 0 50px rgba(245,158,11,0.15); }
        }
        @keyframes topGlow {
          0%, 100% { opacity: 0.6; transform: scaleX(1); }
          50%       { opacity: 1;   transform: scaleX(1.05); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes cloudDrift {
          0%   { transform: translateX(-2%) translateY(0); }
          50%  { transform: translateX(2%) translateY(-6px); }
          100% { transform: translateX(-2%) translateY(0); }
        }
        .gate-input label { color: #fde68a !important; font-size: .78rem !important; letter-spacing: .06em !important; }
        .gate-input input {
          background: rgba(20,12,0,0.55) !important;
          border: 1px solid rgba(245,158,11,0.4) !important;
          color: #fde68a !important;
          border-radius: 6px !important;
        }
        .gate-input input::placeholder { color: rgba(253,230,138,0.38) !important; }
        .gate-input input:focus { border-color: #f59e0b !important; box-shadow: 0 0 0 2px rgba(245,158,11,0.25) !important; }
      `}</style>

      {/* ── Full-screen background ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'url(/heavenly-gate.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        zIndex: 0,
      }} />

      {/* ── Atmospheric fog overlay ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(0,0,0,0.55) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,0,0,0.3) 0%, transparent 100%)',
        zIndex: 1,
        animation: 'cloudDrift 8s ease-in-out infinite',
      }} />

      {/* ── Page layout ── */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}>

        {/* ── Heaven title ── */}
        <div style={{
          textAlign: 'center',
          marginBottom: 24,
          animation: 'glowPulse 3s ease-in-out infinite',
        }}>
          <div style={{
            fontSize: '1rem',
            letterSpacing: '0.4em',
            color: '#fde68a',
            textTransform: 'uppercase',
            textShadow: '0 0 20px #f59e0b, 0 0 40px #f59e0b',
            marginBottom: 6,
            fontWeight: 600,
          }}>
            ✦ Thiên Đạo Học Viện ✦
          </div>
          <h1 style={{
            fontFamily: "'Lora', serif",
            fontSize: '2.6rem',
            fontWeight: 800,
            margin: 0,
            background: 'linear-gradient(90deg, #fbbf24, #fde68a, #f59e0b, #fde68a, #fbbf24)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'shimmer 4s linear infinite',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 12px rgba(245,158,11,0.8))',
          }}>
            Thiên Môn
          </h1>
        </div>

        {/* ── Gate card wrapper ── */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* Dragon decorations */}
          <DragonLeft />
          <DragonRight />

          {/* Top gate arch glow */}
          <div style={{
            position: 'absolute',
            top: -18,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            height: 4,
            background: 'linear-gradient(90deg, transparent, #f59e0b, #fde68a, #f59e0b, transparent)',
            borderRadius: 999,
            animation: 'topGlow 3s ease-in-out infinite',
            boxShadow: '0 0 20px 4px rgba(245,158,11,0.6)',
          }} />

          {/* Corner ornaments */}
          {[
            { top: -8, left: -8 },
            { top: -8, right: -8 },
            { bottom: -8, left: -8 },
            { bottom: -8, right: -8 },
          ].map((pos, i) => (
            <div key={i} style={{
              position: 'absolute',
              ...pos,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fde68a, #f59e0b)',
              boxShadow: '0 0 12px 4px rgba(245,158,11,0.7)',
              zIndex: 1,
            }} />
          ))}

          {/* Gold spark particles */}
          <GoldSparks />

          {/* ── The Gate Door / Login Card ── */}
          <div style={{
            width: 400,
            padding: '40px 36px 36px',
            borderRadius: 4,
            background: 'linear-gradient(180deg, rgba(15,8,0,0.88) 0%, rgba(30,18,0,0.92) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '2px solid',
            borderImage: 'linear-gradient(180deg, #fde68a, #f59e0b, #92400e, #f59e0b, #fde68a) 1',
            animation: 'glowPulse 3s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden',
          }}>

            {/* Inner gold border line */}
            <div style={{
              position: 'absolute',
              inset: 6,
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 2,
              pointerEvents: 'none',
            }} />

            {/* Gate center icon */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245,158,11,0.3), rgba(245,158,11,0.05))',
                border: '2px solid rgba(245,158,11,0.5)',
                fontSize: '1.8rem',
                boxShadow: '0 0 20px rgba(245,158,11,0.4)',
                marginBottom: 8,
              }}>
                🐉
              </div>
              <div style={{
                color: '#fde68a',
                fontFamily: "'Lora', serif",
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textShadow: '0 0 12px rgba(245,158,11,0.7)',
              }}>
                Thiên Môn Nhập Đạo
              </div>
              <div style={{
                fontSize: '0.72rem',
                color: 'rgba(253,230,138,0.55)',
                marginTop: 3,
                letterSpacing: '0.08em',
              }}>
                — Nhập thông tin để bước qua Thiên môn —
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="gate-input">
              <Input
                label="Tên đăng nhập"
                placeholder="Nhập danh hiệu..."
                value={form.username}
                onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setError(''); }}
                error={error && !form.username ? ' ' : ''}
                autoFocus
              />
              <Input
                label="Mật khẩu"
                type="password"
                placeholder="Nhập mật lệnh..."
                value={form.password}
                onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }}
                error={error && !form.password ? ' ' : ''}
              />

              {error && (
                <div style={{
                  marginBottom: 14,
                  padding: '10px 14px',
                  background: 'rgba(180,20,20,0.25)',
                  border: '1px solid rgba(220,38,38,0.4)',
                  borderRadius: 6,
                  color: '#fca5a5',
                  fontSize: '0.82rem',
                }}>
                  ⚠ {error}
                </div>
              )}

              {/* Gold login button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: 6,
                  border: '1px solid rgba(245,158,11,0.6)',
                  background: loading
                    ? 'rgba(120,80,0,0.4)'
                    : 'linear-gradient(135deg, rgba(180,110,0,0.7), rgba(245,158,11,0.6), rgba(180,110,0,0.7))',
                  color: '#fde68a',
                  fontSize: '1rem',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
                  transition: 'all .2s',
                  fontFamily: "'Lora', serif",
                  marginTop: 4,
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220,140,0,0.85), rgba(255,190,50,0.75), rgba(220,140,0,0.85))';
                    e.currentTarget.style.boxShadow = '0 6px 30px rgba(245,158,11,0.55)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(180,110,0,0.7), rgba(245,158,11,0.6), rgba(180,110,0,0.7))';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {loading ? '⋯ Thiên đạo xác thực...' : '🐉 Bước Vào Thiên Đạo'}
              </button>
            </form>

            {/* Bottom note */}
            <div style={{
              marginTop: 16,
              fontSize: '0.7rem',
              color: 'rgba(253,230,138,0.4)',
              textAlign: 'center',
              lineHeight: 1.6,
              borderTop: '1px solid rgba(245,158,11,0.15)',
              paddingTop: 12,
            }}>
              <span style={{ color: 'rgba(245,158,11,0.7)', fontWeight: 600 }}>⚡ Lưu ý:</span>{' '}
              Mỗi phiên chỉ cho phép một thiết bị đăng nhập.
            </div>
          </div>

          {/* Bottom gate glow */}
          <div style={{
            position: 'absolute',
            bottom: -18,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            height: 4,
            background: 'linear-gradient(90deg, transparent, #f59e0b, #fde68a, #f59e0b, transparent)',
            borderRadius: 999,
            animation: 'topGlow 3s ease-in-out 1.5s infinite',
            boxShadow: '0 0 20px 4px rgba(245,158,11,0.6)',
          }} />
        </div>

        {/* Stats below */}
        <div style={{
          display: 'flex',
          gap: 40,
          marginTop: 32,
          paddingTop: 20,
        }}>
          {[['8,2K', 'Người học', '👤'], ['1,3M', 'Lượt làm bài', '📝'], ['24/7', 'Realtime', '⚡']].map(([val, lbl, icon]) => (
            <div key={lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', marginBottom: 2 }}>{icon}</div>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#fbbf24',
                textShadow: '0 0 10px rgba(245,158,11,0.6)',
              }}>
                {val}
              </div>
              <div style={{
                fontSize: '0.62rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(253,230,138,0.5)',
                marginTop: 2,
              }}>
                {lbl}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { vipAPI } from '../api/api';
import { Button, Input } from '../components/UI';

// History is stored per-email: key = 'qm_vip_history_<email>'
const getHistoryKey = (email) => `qm_vip_history_${email.toLowerCase().trim()}`;

const loadHistory = (email) => {
  try {
    const saved = localStorage.getItem(getHistoryKey(email));
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const saveHistory = (email, entries) => {
  localStorage.setItem(getHistoryKey(email), JSON.stringify(entries));
};

export default function VipPurchasePage() {
  const navigate = useNavigate();
  // 0: Select pkg, 1: Info, 2: Payment, 3: Success, 4: History (email gate), 5: History view
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [order, setOrder] = useState(null);
  const [email, setEmail] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [historyEmail, setHistoryEmail] = useState('');
  const [historyEntries, setHistoryEntries] = useState([]);

  const packages = [
    { id: 'p1',  count: 1,  amount: 35000,  label: 'Khởi đầu', desc: 'Sở hữu 1 tài khoản tu luyện', icon: '🌱' },
    { id: 'p5',  count: 5,  amount: 50000,  label: 'Tiểu Thánh', desc: 'Sở hữu 5 tài khoản tu luyện', icon: '💎' },
    { id: 'p10', count: 10, amount: 100000, label: 'Đại Thánh', desc: 'Sở hữu 10 tài khoản cực phẩm', icon: '👑' },
  ];

  // Auto-polling for payment status
  useEffect(() => {
    let interval;
    if (step === 2 && order?.orderId) {
      interval = setInterval(async () => {
        try {
          const res = await vipAPI.getStatus(order.orderId);
          if (res.data.status === 'completed') {
            setAccounts(res.data.accounts);
            setStep(3);
            clearInterval(interval);
          }
        } catch (e) { console.error('Polling error', e); }
      }, 5000); // Check every 5 seconds
    }
    return () => clearInterval(interval);
  }, [step, order]);

  // Save new purchase to email-specific history
  useEffect(() => {
    if (step === 3 && accounts.length > 0 && order?.orderId && email) {
      const existing = loadHistory(email);
      if (!existing.some(h => h.orderId === order.orderId)) {
        const newEntry = {
          date: new Date().toLocaleString('vi-VN'),
          orderId: order.orderId,
          package: packages.find(p => p.id === selectedPkg?.id)?.label,
          accounts,
          email,
        };
        const updated = [newEntry, ...existing].slice(0, 15);
        saveHistory(email, updated);
      }
    }
  }, [step, accounts]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await vipAPI.createOrder({ email, packageId: selectedPkg.id });
      setOrder(res.data);
      setStep(2);
    } catch { alert('Lỗi tạo đơn hàng. Vui lòng thử lại.'); }
    finally { setLoading(false); }
  };

  const handleCheckPayment = async () => {
    setChecking(true);
    try {
      const res = await vipAPI.getStatus(order.orderId);
      if (res.data.status === 'completed') {
        setAccounts(res.data.accounts);
        setStep(3);
      } else {
        alert('Hệ thống đang chờ xác nhận từ ngân hàng. Vui lòng đợi trong giây lát hoặc kiểm tra lịch sử sau ít phút.');
      }
    } catch { alert('Lỗi kết nối. Vui lòng thử lại.'); }
    finally { setChecking(false); }
  };

  const handleViewHistory = (e) => {
    e.preventDefault();
    const entries = loadHistory(historyEmail);
    setHistoryEntries(entries);
    if (entries.length === 0) {
      alert(`Không tìm thấy lịch sử mua hàng nào với email: ${historyEmail}`);
      return;
    }
    setStep(5);
  };

  const exportToTxt = (entry) => {
    const content =
      `DANH SÁCH TÀI KHOẢN VIP - THIÊN ĐẠO HỌC VIỆN\n` +
      `--------------------------------------------------\n` +
      `Ngày mua  : ${entry.date}\n` +
      `Mã đơn   : ${entry.orderId}\n` +
      `Gói       : ${entry.package}\n` +
      `Email     : ${entry.email || ''}\n` +
      `--------------------------------------------------\n` +
      entry.accounts.map((a, i) => `${i + 1}. Username: ${a.username} | Password: ${a.password}`).join('\n') +
      `\n--------------------------------------------------\n` +
      `Cảm ơn bạn đã tu luyện cùng chúng tôi!`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TaiKhoan_VIP_${entry.orderId}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;700&display=swap');
        .vip-nav { background: #fff; height: 60px; display: flex; align-items: center; padding: 0 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100; justify-content: space-between; }
        .back-btn { font-weight: 600; color: #4a5568; cursor: pointer; border: none; background: none; font-size: 0.9rem; }
        .vip-card { background: #fff; border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; overflow: hidden; }
        .vip-head { background: #fdfcf7; padding: 28px; border-bottom: 3px double #e2e8f0; text-align: center; }
        .vip-title { font-family: 'Playfair Display', serif; font-size: 1.7rem; color: #b7791f; margin: 0; }
        .pkg-card { border: 2px solid #edf2f7; border-radius: 10px; padding: 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: 0.18s; }
        .pkg-card:hover { border-color: #d69e2e; background: #fffaf0; transform: translateY(-2px); }
        .receipt-row { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px dashed #e2e8f0; font-size: 0.84rem; }
        .btn-gold { background: #b7791f; color: #fff; border: none; padding: 13px; border-radius: 8px; width: 100%; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
        .btn-gold:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-outline { background: #fff; color: #b7791f; border: 1.5px solid #b7791f; padding: 10px; border-radius: 8px; width: 100%; font-weight: 600; cursor: pointer; font-size: 0.84rem; margin-top: 10px; }
        .btn-gray { background: #edf2f7; color: #4a5568; border: none; padding: 11px; border-radius: 8px; width: 100%; font-weight: 600; cursor: pointer; margin-top: 10px; }
        .success-circle { width: 58px; height: 58px; border-radius: 50%; background: #c6f6d5; color: #2f855a; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 18px; }
        .acc-list { background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 18px; max-height: 260px; overflow-y: auto; }
        .acc-row { padding: 8px 0; border-bottom: 1px dashed #edf2f7; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; }
        .copy-btn { color: #3182ce; background: none; border: none; cursor: pointer; font-size: 0.75rem; text-decoration: underline; }
        .history-row { border: 1px solid #edf2f7; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #fdfcf7; }
        .history-meta { font-size: 0.65rem; color: #b7791f; font-weight: 700; display: flex; justify-content: space-between; margin-bottom: 6px; }
        .shield-tag { background: #fffaf0; border: 1px solid #feebc8; color: #744210; font-size: 0.72rem; padding: 3px 8px; border-radius: 20px; }
      `}</style>

      {/* ── Sticky Nav ── */}
      <nav className="vip-nav">
        <button className="back-btn" onClick={() => {
          if (step === 5) { setStep(4); return; }
          if (step > 0 && step < 3) { setStep(step - 1); return; }
          navigate('/');
        }}>← QUAY LẠI</button>
        <span style={{ fontWeight: 700, color: '#2d3748' }}>QUYẾT CHIẾN VIP</span>
        <button className="back-btn" style={{ color: '#b7791f' }} onClick={() => setStep(4)}>🔒 LỊCH SỬ</button>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="vip-card">
          <div className="vip-head">
            <h1 className="vip-title">
              {step === 2 ? 'KIM LỆNH THANH TOÁN' : step === 3 ? 'THÀNH CÔNG' : step === 4 ? 'XÁC MINH EMAIL' : step === 5 ? 'LỊCH SỬ MUA' : 'KHAI MỞ VIP'}
            </h1>
          </div>

          <div style={{ padding: 24 }}>
            {/* System Notice: Payment not ready */}
            <div style={{
              background: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: 24,
              boxShadow: '0 4px 6px -1px rgba(197, 48, 48, 0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <strong style={{ color: '#c53030', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông báo quan trọng</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#742a2a', lineHeight: 1.6 }}>
                Hiện tại chương trình thanh toán tự động chưa sẵn sàng hoạt động. 
                Nếu bạn muốn giao dịch hãy liên hệ Admin qua 
                <strong style={{ color: '#c53030' }}> Zalo: 0876030347</strong> hoặc 
                <a href="https://m.me/tuantudeptrai123?hash=Abb5IMVvnQMqfZ8n&source_id=8585216" target="_blank" rel="noopener noreferrer" style={{ color: '#c53030', fontWeight: 800, textDecoration: 'none' }}> Facebook: Sở Thiên Thu</a> để được hỗ trợ trực tiếp.
              </p>
            </div>




            {/* ── Step 0: Select package ── */}
            {step === 0 && (
              <div>
                <p style={{ color: '#718096', fontSize: '0.85rem', marginBottom: 20, textAlign: 'center' }}>Chọn gói tài khoản phù hợp với bạn:</p>
                {packages.map(p => (
                  <div key={p.id} className="pkg-card" onClick={() => { setSelectedPkg(p); setStep(1); }}>
                    <span style={{ fontSize: '1.5rem' }}>{p.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{p.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a0aec0' }}>{p.desc}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#b7791f' }}>{p.amount.toLocaleString()}đ</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Step 1: Enter email ── */}
            {step === 1 && (
              <form onSubmit={handleCreateOrder}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#718096', display: 'block', marginBottom: 8 }}>EMAIL NHẬN TÀI KHOẢN</label>
                <Input required type="email" placeholder="you@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
                <div style={{ background: '#f7fafc', padding: 14, borderRadius: 8, margin: '18px 0', border: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>{selectedPkg.label}</span>
                  <span style={{ fontWeight: 800, color: '#b7791f' }}>{selectedPkg.amount.toLocaleString()} đ</span>
                </div>
                <button className="btn-gold" type="submit" disabled={loading}>{loading ? 'ĐANG KHỞI TẠO...' : 'TIẾP TỤC THANH TOÁN'}</button>
                <button type="button" className="btn-gray" onClick={() => setStep(0)}>Chọn lại gói</button>
              </form>
            )}

            {/* ── Step 2: QR Payment ── */}
            {step === 2 && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ background: '#fff', display: 'inline-block', padding: 10, border: '1px solid #e2e8f0' }}>
                    <img src={order.qrUrl} alt="QR" style={{ width: 180, height: 180 }} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', marginTop: 10 }}>{selectedPkg.amount.toLocaleString()} đ</div>
                </div>
                <div className="receipt-row"><span style={{ color: '#718096' }}>Ngân hàng</span><span style={{ fontWeight: 600 }}>{order.bankId}</span></div>
                <div className="receipt-row"><span style={{ color: '#718096' }}>Số tài khoản</span><span style={{ fontWeight: 600 }}>{order.bankAccount}</span></div>
                <div className="receipt-row"><span style={{ color: '#718096' }}>Nội dung (bắt buộc)</span><span style={{ fontWeight: 700, color: '#c05621' }}>{order.orderId}</span></div>
                <div style={{ background: '#fffaf0', border: '1px solid #feebc8', borderRadius: 8, padding: 14, margin: '16px 0', fontSize: '0.78rem', color: '#744210' }}>
                  <strong>⚠️ Quan trọng:</strong> Nhập đúng nội dung chuyển khoản ở trên. Hệ thống tự nhận diện và tạo tài khoản khi nhận được tiền.
                </div>
                <button className="btn-gold" onClick={handleCheckPayment} disabled={checking}>{checking ? 'ĐANG KIỂM TRA...' : 'TÔI ĐÃ CHUYỂN TIỀN'}</button>
              </div>
            )}

            {/* ── Step 3: Success ── */}
            {step === 3 && (
              <div style={{ textAlign: 'center' }}>
                <div className="success-circle">✓</div>
                <h2 style={{ color: '#2f855a', margin: '0 0 8px' }}>GIAO DỊCH THÀNH CÔNG</h2>
                <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: 20 }}>Tài khoản đã được gửi tới <strong>{email}</strong></p>
                <div className="acc-list">
                  {accounts.map((acc, i) => (
                    <div key={i} className="acc-row">
                      <code style={{ fontSize: '0.82rem' }}>U: {acc.username} | P: {acc.password}</code>
                      <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(`U: ${acc.username} P: ${acc.password}`); alert('Đã sao chép!'); }}>Copy</button>
                    </div>
                  ))}
                </div>
                <button className="btn-outline" onClick={() => exportToTxt({ date: new Date().toLocaleString('vi-VN'), orderId: order.orderId, package: selectedPkg.label, email, accounts })}>
                  📥 TẢI FILE TÀI KHOẢN (.TXT)
                </button>
                <button className="btn-gold" style={{ marginTop: 10 }} onClick={() => navigate('/login')}>VỀ TRANG ĐĂNG NHẬP</button>
              </div>
            )}

            {/* ── Step 4: History email gate ── */}
            {step === 4 && (
              <form onSubmit={handleViewHistory}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔒</div>
                  <p style={{ color: '#4a5568', fontSize: '0.9rem' }}>Nhập email bạn đã dùng khi mua để xem lịch sử.</p>
                  <span className="shield-tag">Bảo vệ quyền riêng tư</span>
                </div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#718096', display: 'block', marginBottom: 8 }}>EMAIL ĐÃ MUA</label>
                <Input required type="email" placeholder="email-ban-da-mua@gmail.com" value={historyEmail} onChange={e => setHistoryEmail(e.target.value)} autoFocus />
                <button className="btn-gold" type="submit" style={{ marginTop: 16 }}>XEM LỊCH SỬ</button>
                <button type="button" className="btn-gray" onClick={() => setStep(0)}>Quay lại</button>
              </form>
            )}

            {/* ── Step 5: History view (email-gated) ── */}
            {step === 5 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#718096' }}>Email: <strong>{historyEmail}</strong></span>
                  <span className="shield-tag">🔒 Riêng tư</span>
                </div>
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {historyEntries.map((h, i) => (
                    <div key={i} className="history-row">
                      <div className="history-meta">
                        <span>{h.date} — {h.package}</span>
                        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => exportToTxt(h)}>📥 Tải file</span>
                      </div>
                      {h.accounts.map((acc, j) => (
                        <div key={j} style={{ fontSize: '0.75rem', padding: '3px 0', display: 'flex', justifyContent: 'space-between' }}>
                          <code>U: {acc.username} | P: {acc.password}</code>
                          <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(`U: ${acc.username} P: ${acc.password}`); alert('Đã sao chép!'); }}>Copy</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <button className="btn-gray" onClick={() => setStep(4)}>Xem email khác</button>
              </div>
            )}

          </div>

          {/* Direct Contact QRs */}
          <div style={{
            padding: '0 24px 24px',
            display: 'flex',
            gap: 24,
            justifyContent: 'center',
            borderTop: '1px solid #edf2f7',
            paddingTop: 24
          }}>
            <div style={{ textAlign: 'center' }}>
              <a href="https://m.me/tuantudeptrai123?hash=Abb5IMVvnQMqfZ8n&source_id=8585216" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <img src="/messenger_qr.png" alt="Messenger QR" style={{ width: 120, height: 120, borderRadius: 8, border: '1px solid #eee', display: 'block', margin: '0 auto' }} />
                <div style={{ marginTop: 8, fontSize: '0.65rem', fontWeight: 700, color: '#0084ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Messenger Admin</div>
              </a>
            </div>
            <div style={{ textAlign: 'center' }}>
              <img src="/zalo_qr.png" alt="Zalo QR" style={{ width: 120, height: 120, borderRadius: 8, border: '1px solid #eee', display: 'block', margin: '0 auto' }} />
              <div style={{ marginTop: 8, fontSize: '0.65rem', fontWeight: 700, color: '#0068ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zalo Admin</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

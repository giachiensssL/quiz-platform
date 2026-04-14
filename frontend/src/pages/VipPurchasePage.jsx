import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { vipAPI } from '../api/api';
import { Button, Input } from '../components/UI';

export default function VipPurchasePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: Select, 1: Info, 2: Payment, 3: Success, 4: History
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('pending');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('qm_vip_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const packages = [
    { id: 'p1',  count: 1,  amount: 35000,  label: 'Khởi đầu', desc: 'Sở hữu 1 tài khoản tu luyện', icon: '🌱' },
    { id: 'p5',  count: 5,  amount: 50000,  label: 'Tiểu Thánh', desc: 'Sở hữu 5 tài khoản tu luyện', icon: '💎' },
    { id: 'p10', count: 10, amount: 100000, label: 'Đại Thánh', desc: 'Sở hữu 10 tài khoản cực phẩm', icon: '👑' },
  ];

  useEffect(() => {
    if (step === 3 && accounts.length > 0 && order?.orderId) {
      const exists = history.some(h => h.orderId === order.orderId);
      if (!exists) {
        const newEntry = { 
          date: new Date().toLocaleString('vi-VN'), 
          orderId: order.orderId,
          package: packages.find(p => p.id === selectedPkg?.id)?.label,
          accounts 
        };
        const newHistory = [newEntry, ...history].slice(0, 15);
        setHistory(newHistory);
        localStorage.setItem('qm_vip_history', JSON.stringify(newHistory));
      }
    }
  }, [step, accounts, order]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await vipAPI.createOrder({ email, name, packageId: selectedPkg.id });
      setOrder(res.data);
      setStep(2);
    } catch (err) { alert('Lỗi tạo đơn hàng'); }
    finally { setLoading(false); }
  };

  const handleCheckPayment = async () => {
    setChecking(true);
    try {
      const res = await vipAPI.simulatePayment(order.orderId);
      if (res.data.status === 'completed') {
        setAccounts(res.data.accounts);
        setStatus('completed');
        setStep(3);
      } else { alert(res.data.message || 'Chưa nhận được thanh toán.'); }
    } catch (e) { alert('Lỗi kiểm tra.'); }
    finally { setChecking(false); }
  };

  return (
    <div className="vip-page" style={{
      minHeight: '100vh', background: '#f8fafc', color: '#1a202c',
      display: 'flex', flexDirection: 'column', paddingBottom: '40px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;700&display=swap');
        
        .vip-nav {
          background: #fff; height: 60px; display: flex; align-items: center;
          padding: 0 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          position: sticky; top: 0; z-index: 100; justify-content: space-between;
        }
        .back-btn {
          display: flex; align-items: center; gap: 8px; font-weight: 600;
          color: #4a5568; cursor: pointer; border: none; background: none; font-size: 0.9rem;
        }
        .back-btn:hover { color: #2d3748; }
        
        .vip-container {
          flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        
        .vip-card {
          background: #ffffff; border-radius: 12px;
          width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          border: 1px solid #e2e8f0; overflow: hidden;
        }
        
        .vip-title-section {
          background: #fdfcf7; padding: 30px; border-bottom: 3px double #e2e8f0; text-align: center;
        }
        .vip-title {
          font-family: 'Playfair Display', serif; font-size: 1.8rem;
          color: #b7791f; margin: 0;
        }
        
        .pkg-group { padding: 24px; }
        .pkg-card {
          border: 2px solid #edf2f7; border-radius: 10px; padding: 18px;
          margin-bottom: 15px; display: flex; align-items: center; gap: 16px;
          cursor: pointer; transition: 0.2s; position: relative;
        }
        .pkg-card:hover { border-color: #d69e2e; background: #fffaf0; transform: translateY(-2px); }
        .pkg-card.active { border-color: #b7791f; background: #fffaf0; }
        
        .pkg-icon { font-size: 1.5rem; }
        .pkg-info { flex: 1; }
        .pkg-name { font-weight: 700; color: #2d3748; }
        .pkg-desc { font-size: 0.75rem; color: #718096; }
        .pkg-price { font-weight: 800; color: #b7791f; font-size: 1rem; }
        
        .receipt-row {
          display: flex; justify-content: space-between; padding: 12px 0;
          border-bottom: 1px dashed #e2e8f0; font-size: 0.85rem;
        }
        .qr-area { background: #fff; border: 1px solid #edf2f7; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; }
        
        .warning-notice {
          background: #fffaf0; border-radius: 8px; padding: 15px;
          border: 1px solid #feebc8; margin-top: 20px; font-size: 0.8rem;
        }
        
        .btn-gold {
          background: #b7791f; color: #fff; border: none; padding: 14px;
          border-radius: 8px; width: 100%; font-weight: 700; cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(183, 121, 31, 0.3);
        }
        .btn-gold:hover { background: #975a16; }
        
        .success-checkmark {
          width: 60px; height: 60px; border-radius: 50%; background: #c6f6d5;
          color: #2f855a; display: flex; align-items: center; justify-content: center;
          font-size: 2rem; margin: 0 auto 20px;
        }
      `}</style>
      
      {/* ── Navigation Bar ── */}
      <nav className="vip-nav">
        <button className="back-btn" onClick={() => {
          if (step > 0 && step < 3) setStep(step - 1);
          else navigate('/');
        }}>
          ← QUAY LẠI
        </button>
        <div style={{fontWeight:700, fontSize:'1rem', color:'#2d3748', letterSpacing:'0.05em'}}>QUYẾT CHIẾN VIP</div>
        <div style={{width:'80px', textAlign:'right'}}>
           {history.length > 0 && <span style={{fontSize:'0.75rem', color:'#b7791f', cursor:'pointer', fontWeight:600}} onClick={() => setStep(4)}>LỊCH SỬ</span>}
        </div>
      </nav>

      <div className="vip-container">
        <div className="vip-card">
          <div className="vip-title-section">
            <h1 className="vip-title">{step === 2 ? 'KIM LỆNH THANH TOÁN' : step === 3 ? 'TU TIÊN THÀNH CÔNG' : 'MỞ KHÓA TÂN THỦ'}</h1>
            <p style={{fontSize:'0.75rem', color:'#a0aec0', marginTop:5, textTransform:'uppercase', letterSpacing:'0.1em'}}>--- Thiên Đạo Học Viện ---</p>
          </div>

          <div style={{padding: '24px'}}>
            {step === 0 && (
              <div>
                <p style={{textAlign:'center', marginBottom:24, fontWeight:600, color:'#4a5568'}}>Chọn linh sảo phù hợp với đạo hạnh của bạn:</p>
                {packages.map(p => (
                  <div key={p.id} className="pkg-card" onClick={() => { setSelectedPkg(p); setStep(1); }}>
                    <div className="pkg-icon">{p.icon}</div>
                    <div className="pkg-info">
                      <div className="pkg-name">{p.label}</div>
                      <div className="pkg-desc">{p.desc}</div>
                    </div>
                    <div className="pkg-price">{p.amount.toLocaleString()}đ</div>
                  </div>
                ))}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleCreateOrder}>
                <div style={{marginBottom:20}}>
                  <label style={{fontSize:'0.8rem', fontWeight:700, color:'#718096', display:'block', marginBottom:8}}>EMAIL NHẬN MẬT MÃ</label>
                  <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email của bạn..." />
                </div>
                <div style={{background:'#f7fafc', padding:15, borderRadius:8, marginBottom:25, border:'1px solid #edf2f7'}}>
                   <div style={{fontSize:'0.7rem', color:'#a0aec0'}}>GÓI ĐANG MUA</div>
                   <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:5}}>
                      <span style={{fontWeight:700}}>{selectedPkg.label}</span>
                      <span style={{fontWeight:800, color:'#b7791f'}}>{selectedPkg.amount.toLocaleString()} đ</span>
                   </div>
                </div>
                <button className="btn-gold" type="submit" disabled={loading}>
                  {loading ? 'ĐANG KHỞI TẠO...' : 'TIẾP TỤC ĐẾN THANH TOÁN'}
                </button>
              </form>
            )}

            {step === 2 && (
              <div>
                <div className="qr-area">
                  <div style={{background:'#fff', display:'inline-block', padding:10, border:'1px solid #e2e8f0', marginBottom:12}}>
                    <img src={order.qrUrl} alt="QR" style={{ width: 180, height: 180 }} />
                  </div>
                  <div style={{fontSize:'1.3rem', fontWeight:800, color:'#2d3748'}}>{selectedPkg.amount.toLocaleString()} đ</div>
                </div>

                <div className="receipt-row">
                  <span style={{color:'#718096'}}>Ngân hàng</span>
                  <span style={{fontWeight:600}}>{order.bankId}</span>
                </div>
                <div className="receipt-row">
                  <span style={{color:'#718096'}}>Số tài khoản</span>
                  <span style={{fontWeight:600}}>{order.bankAccount}</span>
                </div>
                <div className="receipt-row">
                  <span style={{color:'#718096'}}>Nội dung (Bắt buộc)</span>
                  <span style={{fontWeight:700, color:'#c05621'}}>{order.orderId}</span>
                </div>

                <div className="warning-notice">
                  <div style={{fontWeight:700, color:'#c05621', marginBottom:4}}>⚠️ LƯU Ý QUAN TRỌNG:</div>
                  Hệ thống sẽ tự nhận diện theo **Mã đơn hàng**. Vui lòng không sửa nội dung chuyển khoản để nhận tài khoản ngay lập tức.
                </div>

                <button className="btn-gold" style={{marginTop:20}} onClick={handleCheckPayment} disabled={checking}>
                  {checking ? 'ĐANG KIỂM TRA...' : 'XÁC NHẬN ĐÃ CHUYỂN TIỀN'}
                </button>
              </div>
            )}

            {step === 3 && (
              <div style={{textAlign:'center'}}>
                <div className="success-checkmark">✓</div>
                <h2 style={{margin:'0 0 10px', color:'#2f855a'}}>PHÁ ĐỊA THÀNH CÔNG</h2>
                <p style={{fontSize:'0.85rem', color:'#718096', marginBottom:24}}>Cẩm nang tu luyện đã được gửi tới <b>{email}</b></p>
                
                <div style={{background:'#f8fafc', padding:18, borderRadius:10, textAlign:'left', border:'1px solid #e2e8f0', marginBottom:25}}>
                  <div style={{fontSize:'0.7rem', fontWeight:700, color:'#a0aec0', textTransform:'uppercase', marginBottom:12, letterSpacing:'0.05em'}}>Danh sách tài khoản mở khóa</div>
                  {accounts.map((acc, i) => (
                    <div key={i} style={{padding:'10px 0', borderBottom:i===accounts.length-1?'none':'1px dashed #edf2f7', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontFamily:'monospace', fontSize:'0.85rem'}}>U: {acc.username} | P: {acc.password}</span>
                      <span style={{color:'#3182ce', fontSize:'0.7rem', cursor:'pointer', borderBottom:'1px solid'}} onClick={() => {navigator.clipboard.writeText(`U:${acc.username} P:${acc.password}`); alert('Đã sao chép!');}}>Copy</span>
                    </div>
                  ))}
                </div>

                <Button fullWidth onClick={() => navigate('/login')} style={{background:'#2d3748', color:'#fff'}}>VỀ TRANG ĐĂNG NHẬP</Button>
              </div>
            )}

            {step === 4 && (
              <div>
                <h3 style={{fontSize:'1rem', marginBottom:20, textAlign:'center'}}>Lịch sử tu luyện</h3>
                <div style={{maxHeight:380, overflowY:'auto'}} className="scroll-custom">
                  {history.map((h, i) => (
                    <div key={i} style={{marginBottom:15, border:'1px solid #edf2f7', borderRadius:8, padding:12, background:'#fdfcf7'}}>
                      <div style={{fontSize:'0.65rem', color:'#b7791f', fontWeight:700, marginBottom:8}}>{h.date} - Gói: {h.package}</div>
                      {h.accounts.map((acc, j) => (
                        <div key={j} style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', padding:'4px 0'}}>
                          <span style={{fontFamily:'monospace'}}>U: {acc.username} | P: {acc.password}</span>
                          <span style={{color:'#3182ce', cursor:'pointer'}} onClick={() => {navigator.clipboard.writeText(`U: ${acc.username} P: ${acc.password}`); alert('Đã sao chép!');}}>Copy</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <Button fullWidth onClick={() => setStep(0)} style={{marginTop:20, background:'#edf2f7', color:'#4a5568'}}>QUAY LẠI TRANG CHÍNH</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

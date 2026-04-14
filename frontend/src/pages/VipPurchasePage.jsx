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

  const exportToTxt = (entry) => {
    const content = `DANH SÁCH TÀI KHOẢN VIP - THIÊN ĐẠO HỌC VIỆN\n` +
      `-------------------------------------------\n` +
      `Ngày mua: ${entry.date}\n` +
      `Mã đơn hàng: ${entry.orderId}\n` +
      `Gói: ${entry.package}\n` +
      `-------------------------------------------\n` +
      entry.accounts.map((acc, i) => `${i + 1}. Username: ${acc.username} | Password: ${acc.password}`).join('\n') +
      `\n-------------------------------------------\n` +
      `Cảm ơn bạn đã lựa chọn tu luyện tại hệ thống của chúng tôi!`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TaiKhoan_VIP_${entry.orderId}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
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
        .back-btn { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #4a5568; cursor: pointer; border: none; background: none; font-size: 0.9rem; }
        .vip-card { background: #ffffff; border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15); border: 1px solid #e2e8f0; overflow: hidden; }
        .vip-title-section { background: #fdfcf7; padding: 30px; border-bottom: 3px double #e2e8f0; text-align: center; }
        .vip-title { font-family: 'Playfair Display', serif; font-size: 1.8rem; color: #b7791f; margin: 0; }
        .pkg-card { border: 2px solid #edf2f7; border-radius: 10px; padding: 18px; margin-bottom: 15px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: 0.2s; position: relative; }
        .pkg-card:hover { border-color: #d69e2e; background: #fffaf0; transform: translateY(-2px); }
        .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #e2e8f0; font-size: 0.85rem; }
        .btn-gold { background: #b7791f; color: #fff; border: none; padding: 14px; border-radius: 8px; width: 100%; font-weight: 700; cursor: pointer; }
        .btn-outline-gold { background: #fff; color: #b7791f; border: 1px solid #b7791f; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem; margin-top: 10px; width: 100%; }
        .success-checkmark { width: 60px; height: 60px; border-radius: 50%; background: #c6f6d5; color: #2f855a; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 20px; }
      `}</style>
      
      <nav className="vip-nav">
        <button className="back-btn" onClick={() => (step > 0 && step < 3) ? setStep(step - 1) : navigate('/')}>← QUAY LẠI</button>
        <div style={{fontWeight:700, fontSize:'1rem', color:'#2d3748'}}>QUYẾT CHIẾN VIP</div>
        <div style={{width:'80px', textAlign:'right'}}>
           {history.length > 0 && <span style={{fontSize:'0.75rem', color:'#b7791f', cursor:'pointer', fontWeight:600}} onClick={() => setStep(4)}>LỊCH SỬ</span>}
        </div>
      </nav>

      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
        <div className="vip-card">
          <div className="vip-title-section">
            <h1 className="vip-title">{step === 2 ? 'KIM LỆNH THANH TOÁN' : step === 3 ? 'THÀNH CÔNG' : step === 4 ? 'LỊCH SỬ MUA' : 'KHAI MỞ VIP'}</h1>
          </div>

          <div style={{padding: '24px'}}>
            {step === 0 && (
              <div>
                {packages.map(p => (
                  <div key={p.id} className="pkg-card" onClick={() => { setSelectedPkg(p); setStep(1); }}>
                    <div style={{fontSize:'1.5rem'}}>{p.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700}}>{p.label}</div>
                      <div style={{fontSize:'0.75rem', color:'#718096'}}>{p.desc}</div>
                    </div>
                    <div style={{fontWeight:800, color:'#b7791f'}}>{p.amount.toLocaleString()}đ</div>
                  </div>
                ))}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleCreateOrder}>
                <Input required label="EMAIL NHẬN MẬT MÃ" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <div style={{background:'#f7fafc', padding:15, borderRadius:8, margin:'20px 0', border:'1px solid #edf2f7'}}>
                   <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontWeight:700}}>{selectedPkg.label}</span>
                      <span style={{fontWeight:800, color:'#b7791f'}}>{selectedPkg.amount.toLocaleString()} đ</span>
                   </div>
                </div>
                <button className="btn-gold" type="submit" disabled={loading}>{loading ? 'KHỞI TẠO...' : 'THANH TOÁN'}</button>
              </form>
            )}

            {step === 2 && (
              <div style={{textAlign:'center'}}>
                <div style={{background:'#fff', display:'inline-block', padding:10, border:'1px solid #e2e8f0', marginBottom:20}}>
                  <img src={order.qrUrl} alt="QR" style={{ width: 180, height: 180 }} />
                </div>
                <div className="receipt-row"><span>Ngân hàng</span><span style={{fontWeight:600}}>{order.bankId}</span></div>
                <div className="receipt-row"><span>Số tài khoản</span><span style={{fontWeight:600}}>{order.bankAccount}</span></div>
                <div className="receipt-row"><span>Nội dung</span><span style={{fontWeight:700, color:'#c05621'}}>{order.orderId}</span></div>
                <button className="btn-gold" style={{marginTop:20}} onClick={handleCheckPayment} disabled={checking}>{checking ? 'ĐANG KIỂM TRA...' : 'XÁC NHẬN ĐÃ CHUYỂN TIỀN'}</button>
              </div>
            )}

            {step === 3 && (
              <div style={{textAlign:'center'}}>
                <div className="success-checkmark">✓</div>
                <h2 style={{color:'#2f855a', margin:'0 0 10px'}}>MUA THÀNH CÔNG</h2>
                <div style={{background:'#f8fafc', padding:15, borderRadius:10, textAlign:'left', border:'1px solid #e2e8f0', marginBottom:20}}>
                  {accounts.map((acc, i) => (
                    <div key={i} style={{padding:'8px 0', borderBottom:i===accounts.length-1?'none':'1px dashed #edf2f7', fontSize:'0.85rem'}}>
                      <code>U: {acc.username} | P: {acc.password}</code>
                    </div>
                  ))}
                </div>
                <button className="btn-outline-gold" onClick={() => exportToTxt({ date: new Date().toLocaleString('vi-VN'), orderId: order.orderId, package: selectedPkg.label, accounts })}>
                  📥 TẢI FILE TÀI KHOẢN (.TXT)
                </button>
                <Button fullWidth onClick={() => navigate('/login')} style={{marginTop:10}}>VỀ ĐĂNG NHẬP</Button>
              </div>
            )}

            {step === 4 && (
              <div>
                <div style={{maxHeight:380, overflowY:'auto'}}>
                  {history.map((h, i) => (
                    <div key={i} style={{marginBottom:15, border:'1px solid #edf2f7', borderRadius:8, padding:12, background:'#fdfcf7'}}>
                      <div style={{fontSize:'0.65rem', color:'#b7791f', fontWeight:700, display:'flex', justifyContent:'space-between'}}>
                        <span>{h.date}</span>
                        <span onClick={() => exportToTxt(h)} style={{cursor:'pointer', textDecoration:'underline'}}>Tải file</span>
                      </div>
                      <div style={{fontWeight:600, fontSize:'0.8rem', margin:'5px 0'}}>{h.package}</div>
                      {h.accounts.map((acc, j) => (
                        <div key={j} style={{fontSize:'0.75rem', color:'#4a5568'}}>U: {acc.username} | P: {acc.password}</div>
                      ))}
                    </div>
                  ))}
                </div>
                <Button fullWidth onClick={() => setStep(0)} style={{marginTop:20}}>QUAY LẠI</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

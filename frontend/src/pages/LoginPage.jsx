import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/UI';

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">Quiz<span style={{color:'var(--orange)'}}>Master</span></div>
        <p className="auth-tagline">Hệ thống ôn luyện trắc nghiệm dành cho sinh viên</p>
        <form onSubmit={handleSubmit}>
          <Input label="Tên đăng nhập" placeholder="Nhập tên đăng nhập" value={form.username}
            onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setError(''); }}
            error={error && !form.username ? ' ' : ''} autoFocus />
          <Input label="Mật khẩu" type="password" placeholder="Nhập mật khẩu" value={form.password}
            onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }}
            error={error && !form.password ? ' ' : ''} />
          {error && <div className="form-error" style={{marginBottom:12}}>⚠ {error}</div>}
          <Button variant="primary" full size="lg" loading={loading} type="submit">Đăng nhập</Button>
        </form>
        <div style={{marginTop:20,padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--r)',fontSize:'.76rem',color:'var(--muted)'}}>
          <strong>Woa:</strong> Xin chào quý bạn học thân mến &nbsp;|&nbsp; chúc bạn ôn luyện tốt!!! Chạ Yảo
        </div>
      </div>
    </div>
  );
}

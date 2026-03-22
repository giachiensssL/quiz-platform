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
    <div className="auth-screen auth-split">
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="auth-brand-icon">Q</div>
          <h1>QuizMaster</h1>
          <p>Hệ thống ôn luyện trắc nghiệm dành cho sinh viên với trải nghiệm học tập trực quan và hiện đại.</p>
          <div className="auth-stats">
            <div>
              <strong>8,2K</strong>
              <span>Người học</span>
            </div>
            <div>
              <strong>1,3M</strong>
              <span>Lượt làm bài</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Realtime</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-logo">Đăng nhập hệ thống</div>
          <p className="auth-tagline">Nhập thông tin tài khoản để bắt đầu ôn luyện.</p>
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
          <div className="auth-note">
            <strong>Lưu ý:</strong> Giữ nguyên toàn bộ logic xác thực/API hiện có, chỉ thay đổi giao diện trực quan.
          </div>
        </div>
      </div>
    </div>
  );
}

// src/pages/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { adminDataAPI } from '../../api/api';
import Navbar from '../../components/Navbar';
import { Button, Input, Select, Textarea, Modal, Confirm, Toast, Badge, EmptyState } from '../../components/UI';
import { parseDocxQuestionsWithReport } from '../../utils/wordQuestionParser';

// ── OVERVIEW ────────────────────────────────────────────────────
function Overview({ data, analytics }) {
  const stats = [
    { label: 'Người dùng', val: 2, icon: '👥', color: 'var(--blue)' },
    { label: 'Câu hỏi', val: data.questions.length, icon: '❓', color: 'var(--orange)' },
    { label: 'Môn học', val: data.subjects.length, icon: '📚', color: 'var(--success)' },
    { label: 'Bài học', val: data.lessons.length, icon: '📝', color: '#8B5CF6' },
    { label: 'Khoa', val: data.faculties.length, icon: '🏛️', color: '#0891B2' },
    { label: 'Học kỳ', val: data.semesters.length, icon: '📋', color: '#D97706' },
    { label: 'Lượt truy cập', val: analytics?.totalVisits || 0, icon: '📈', color: '#0EA5E9' },
    { label: 'Đang online', val: analytics?.onlineUsers || 0, icon: '🟢', color: 'var(--success)' },
  ];
  return (
    <>
      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{s.icon}</div>
            <div className="stat-val" style={{ color: s.color, fontSize: '1.6rem' }}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <div className="table-header"><div className="table-title">Câu hỏi mới nhất</div></div>
        <table className="data-table">
          <thead><tr><th>#</th><th>Câu hỏi</th><th>Loại</th><th>Bài học</th></tr></thead>
          <tbody>
            {data.questions.slice(0, 6).map((q, i) => (
              <tr key={q.id}>
                <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                <td style={{ maxWidth: 320 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.text || q.question}</div></td>
                <td><Badge color={q.type === 'single' ? 'blue' : q.type === 'multiple' ? 'orange' : 'gray'}>{q.type}</Badge></td>
                <td style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{data.lessons.find(l => l.id === q.lessonId)?.name || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── USERS ────────────────────────────────────────────────────────
function UsersPanel() {
  const { mockUsers, setMockUsers } = useAuth();
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', role: 'user' });
  const [editForm, setEditForm] = useState({ fullName: '', email: '', role: 'user' });
  const [resetPassword, setResetPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [toast, setToast] = useState('');
  const [mode, setMode] = useState('server');
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const ef = (k) => (e) => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const mapMockUser = (user) => ({
    _id: String(user.id),
    id: String(user.id),
    username: user.username,
    password: user.password,
    fullName: user.name || user.fullName || '',
    email: user.email || '',
    role: user.role || 'user',
    isBlocked: Boolean(user.blocked),
    attempts: Array.isArray(user.attempts) ? user.attempts : [],
    createdAt: user.createdAt || new Date().toISOString(),
  });

  const loadMockUsers = () => {
    setUsers((mockUsers || []).map(mapMockUser));
    setMode('local');
  };

  const loadUsers = async () => {
    const token = localStorage.getItem('qm_token') || '';
    const isLocalToken = !token || token === 'admin-token' || token.startsWith('token-');

    if (isLocalToken) {
      loadMockUsers();
      return;
    }

    try {
      setLoading(true);
      const res = await adminDataAPI.listUsers();
      setUsers(Array.isArray(res?.data) ? res.data : []);
      setMode('server');
    } catch {
      loadMockUsers();
      setToast('Không tải được danh sách người dùng từ server. Đang dùng dữ liệu cục bộ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const save = async () => {
    const username = form.username.trim().toLowerCase();
    if (!username || !form.password) return;

    if (mode === 'local') {
      if ((mockUsers || []).some((item) => String(item.username || '').toLowerCase() === username)) {
        setToast('Username đã tồn tại trong dữ liệu cục bộ.');
        return;
      }

      const nextUser = {
        id: Date.now(),
        username,
        password: form.password,
        role: form.role,
        name: form.fullName.trim() || username,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        blocked: false,
        attempts: [],
        createdAt: new Date().toISOString(),
      };
      setMockUsers((prev) => [...prev, nextUser]);
      setForm({ fullName: '', email: '', username: '', password: '', role: 'user' });
      setModal(false);
      setToast('Đã tạo tài khoản (cục bộ)!');
      setUsers((prev) => [...prev, mapMockUser(nextUser)]);
      return;
    }

    try {
      await adminDataAPI.createUser({
        username,
        password: form.password,
        role: form.role,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
      });
      setForm({ fullName: '', email: '', username: '', password: '', role: 'user' });
      setModal(false);
      setToast('Đã tạo tài khoản thành công!');
      await loadUsers();
    } catch (error) {
      setToast(error?.response?.data?.message || 'Không thể tạo tài khoản mới.');
    }
  };

  const remove = async (id) => {
    if (mode === 'local') {
      setMockUsers((prev) => prev.filter((item) => String(item.id) !== String(id)));
      setUsers((prev) => prev.filter((item) => String(item._id || item.id) !== String(id)));
      setToast('Đã xoá tài khoản (cục bộ).');
      setConfirm(null);
      return;
    }

    try {
      await adminDataAPI.removeUser(id);
      setToast('Đã xoá tài khoản.');
      await loadUsers();
    } catch (error) {
      setToast(error?.response?.data?.message || 'Không thể xoá tài khoản.');
    } finally {
      setConfirm(null);
    }
  };

  const toggleBlock = async (id, blocked) => {
    if (mode === 'local') {
      setMockUsers((prev) => prev.map((item) => String(item.id) === String(id) ? { ...item, blocked: !blocked } : item));
      setUsers((prev) => prev.map((item) => String(item._id || item.id) === String(id) ? { ...item, isBlocked: !blocked } : item));
      return;
    }

    try {
      await adminDataAPI.setUserBlocked(id, !blocked);
      await loadUsers();
    } catch (error) {
      setToast(error?.response?.data?.message || 'Không thể cập nhật trạng thái tài khoản.');
    }
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role || 'user',
    });
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingUser?._id) return;

    if (mode === 'local') {
      const id = String(editingUser._id || editingUser.id);
      setMockUsers((prev) => prev.map((item) => {
        if (String(item.id) !== id) return item;
        return {
          ...item,
          name: editForm.fullName,
          fullName: editForm.fullName,
          email: editForm.email,
          role: editForm.role,
        };
      }));
      setUsers((prev) => prev.map((item) => {
        if (String(item._id || item.id) !== id) return item;
        return {
          ...item,
          fullName: editForm.fullName,
          email: editForm.email,
          role: editForm.role,
        };
      }));
      setToast('Đã cập nhật thông tin người dùng (cục bộ).');
      setEditModal(false);
      setEditingUser(null);
      return;
    }

    try {
      await adminDataAPI.updateUser(editingUser._id, {
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
      });
      setToast('Đã cập nhật thông tin người dùng.');
      setEditModal(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      setToast(error?.response?.data?.message || 'Không thể cập nhật người dùng.');
    }
  };

  const openResetPassword = (user) => {
    setResetUser(user);
    setResetPassword('');
    setResetModal(true);
  };

  const submitResetPassword = async () => {
    if (!resetUser?._id) return;
    if (!resetPassword || resetPassword.trim().length < 6) {
      setToast('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (mode === 'local') {
      const id = String(resetUser._id || resetUser.id);
      setMockUsers((prev) => prev.map((item) => String(item.id) === id ? { ...item, password: resetPassword.trim() } : item));
      setUsers((prev) => prev.map((item) => String(item._id || item.id) === id ? { ...item, password: resetPassword.trim() } : item));
      setToast('Đặt lại mật khẩu thành công (cục bộ).');
      setResetModal(false);
      setResetUser(null);
      setResetPassword('');
      return;
    }

    try {
      await adminDataAPI.resetUserPassword(resetUser._id, resetPassword.trim());
      setToast('Đặt lại mật khẩu thành công.');
      setResetModal(false);
      setResetUser(null);
      setResetPassword('');
      await loadUsers();
    } catch (error) {
      setToast(error?.response?.data?.message || 'Không thể đặt lại mật khẩu.');
    }
  };

  return (
    <>
      <Toast message={toast} type="success" onDone={() => setToast('')} />
      <Confirm open={!!confirm} title="Xác nhận xoá" message={`Xoá tài khoản "${confirm?.username}"? Thao tác không thể hoàn tác.`}
        danger onConfirm={() => remove(confirm?.id)} onCancel={() => setConfirm(null)} />
      <Modal open={modal} title="Tạo tài khoản mới" onClose={() => setModal(false)}
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Huỷ</Button><Button variant="primary" onClick={save}>Tạo tài khoản</Button></>}>
        <div className="form-grid-2">
          <Input label="Họ và tên" placeholder="Nguyễn Văn A" value={form.fullName} onChange={f('fullName')} />
          <Input label="Email" placeholder="abc@sv.edu.vn" value={form.email} onChange={f('email')} />
        </div>
        <div className="form-grid-2">
          <Input label="Tên đăng nhập *" placeholder="sinhvien01" value={form.username} onChange={f('username')} />
          <Input label="Mật khẩu *" type="password" placeholder="••••••" value={form.password} onChange={f('password')} />
        </div>
        <Select
          label="Phân quyền"
          value={form.role}
          onChange={f('role')}
          options={[{ value: 'user', label: 'Người dùng' }, { value: 'admin', label: 'Quản trị viên' }]}
        />
      </Modal>

      <Modal open={editModal} title="Cập nhật người dùng" onClose={() => setEditModal(false)}
        footer={<><Button variant="ghost" onClick={() => setEditModal(false)}>Huỷ</Button><Button variant="primary" onClick={saveEdit}>Lưu thay đổi</Button></>}>
        <div className="form-grid-2">
          <Input label="Họ và tên" placeholder="Nguyễn Văn A" value={editForm.fullName} onChange={ef('fullName')} />
          <Input label="Email" placeholder="abc@sv.edu.vn" value={editForm.email} onChange={ef('email')} />
        </div>
        <Select
          label="Phân quyền"
          value={editForm.role}
          onChange={ef('role')}
          options={[{ value: 'user', label: 'Người dùng' }, { value: 'admin', label: 'Quản trị viên' }]}
        />
      </Modal>

      <Modal
        open={resetModal}
        title={`Đặt lại mật khẩu${resetUser?.username ? `: @${resetUser.username}` : ''}`}
        onClose={() => setResetModal(false)}
        footer={<><Button variant="ghost" onClick={() => setResetModal(false)}>Huỷ</Button><Button variant="primary" onClick={submitResetPassword}>Cập nhật</Button></>}
      >
        <Input
          label="Mật khẩu mới"
          type="password"
          placeholder="Tối thiểu 6 ký tự"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
        />
      </Modal>

      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Danh sách người dùng</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => setShowPasswords((prev) => !prev)}>
              {showPasswords ? '🙈 Ẩn mật khẩu' : '👁 Hiện mật khẩu'}
            </Button>
            <Button variant="primary" size="sm" icon="+" onClick={() => setModal(true)}>Tạo tài khoản</Button>
          </div>
        </div>
        {mode === 'local' && (
          <div style={{ padding: '8px 12px', fontSize: '.8rem', color: 'var(--muted)' }}>
            Đang dùng chế độ cục bộ vì server không sẵn sàng hoặc token không hợp lệ cho API admin.
          </div>
        )}
        {loading ? <EmptyState icon="⏳" text="Đang tải danh sách người dùng..." /> : users.length === 0 ? <EmptyState icon="👥" text="Chưa có người dùng" /> : (
          <table className="data-table">
            <thead><tr><th>Tài khoản</th><th>Thông tin</th><th>Mật khẩu</th><th>Vai trò</th><th>Trạng thái</th><th>Kết quả</th><th>Thao tác</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>@{u.username}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '.78rem' }}>{u._id}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.fullName || 'Chưa cập nhật tên'}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{u.email || 'Chưa có email'}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '.75rem' }}>
                      Tạo lúc: {u.createdAt ? new Date(u.createdAt).toLocaleString('vi-VN') : 'N/A'}
                    </div>
                  </td>
                  <td style={{ maxWidth: 210, fontSize: '.76rem', wordBreak: 'break-all', color: 'var(--muted)' }}>
                    {showPasswords ? (u.password || 'N/A') : '••••••••'}
                  </td>
                  <td><Badge color={u.role === 'admin' ? 'orange' : 'blue'}>{u.role || 'user'}</Badge></td>
                  <td><Badge color={u.isBlocked ? 'red' : 'green'}>{u.isBlocked ? 'Bị khoá' : 'Hoạt động'}</Badge></td>
                  <td style={{ fontSize: '.8rem', color: 'var(--text-2)' }}>
                    <div>Lượt làm: {Array.isArray(u.attempts) ? u.attempts.length : 0}</div>
                  </td>
                  <td>
                    <div className="td-actions">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Phân quyền</Button>
                      <Button variant="ghost" size="sm" onClick={() => openResetPassword(u)}>Đặt lại MK</Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleBlock(u._id, u.isBlocked)}>{u.isBlocked ? '🔓 Mở' : '🔒 Khoá'}</Button>
                      <Button variant="danger" size="sm" onClick={() => setConfirm(u)}>Xoá</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── GENERIC CRUD TABLE ─────────────────────────────────────────
function CrudTable({ title, icon, items, fields, tableFields, onAdd, onUpdate, onRemove, onToggleLock, showLockColumn = false, createDefaults }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');

  const openAdd = () => {
    setEditing(null);
    const base = Object.fromEntries(fields.map((f) => [f.key, '']));
    const defaults = typeof createDefaults === 'function' ? createDefaults(base) : (createDefaults || {});
    setForm({ ...base, ...defaults });
    setModal(true);
  };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setModal(true); };
  const visibleFields = Array.isArray(tableFields) && tableFields.length ? tableFields : fields.slice(0, 3);

  useEffect(() => {
    if (!modal) return;
    setForm((prev) => {
      let changed = false;
      const next = { ...prev };

      fields.forEach((field) => {
        if (field.type !== 'select') return;
        const options = typeof field.options === 'function' ? field.options(next) : (field.options || []);
        const valid = options.some((opt) => String(opt.value) === String(next[field.key] || ''));
        if (next[field.key] && !valid) {
          next[field.key] = '';
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [fields, form, modal]);
  const save = async () => {
    const missing = fields.filter(f => f.required && !form[f.key]);
    if (missing.length) return;
    try {
      if (editing) { await onUpdate(editing.id, form); setToast('Đã cập nhật!'); }
      else { await onAdd(form); setToast('Đã thêm mới!'); }
      setModal(false);
    } catch (error) {
      setToast(error?.message || 'Không thể lưu dữ liệu lên server.');
    }
  };

  return (
    <>
      <Toast message={toast} type="success" onDone={() => setToast('')} />
      <Confirm open={!!confirm} title={`Xoá ${title.toLowerCase()}`}
        message={`Xác nhận xoá "${confirm?.name}"?`} danger
        onConfirm={async () => {
          try {
            await onRemove(confirm.id);
            setToast('Đã xoá!');
          } catch (error) {
            setToast(error?.message || 'Không thể xoá dữ liệu trên server.');
          } finally {
            setConfirm(null);
          }
        }}
        onCancel={() => setConfirm(null)} />
      <Modal open={modal} title={editing ? `Sửa ${title}` : `Thêm ${title}`} onClose={() => setModal(false)}
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Huỷ</Button><Button variant="primary" onClick={save}>Lưu</Button></>}>
        {fields.map(f => (
          f.type === 'select' ? (
            <Select key={f.key} label={f.label + (f.required ? ' *' : '')}
              options={typeof f.options === 'function' ? f.options(form) : (f.options || [])} value={form[f.key] || ''}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          ) : f.type === 'textarea' ? (
            <Textarea key={f.key} label={f.label + (f.required ? ' *' : '')}
              placeholder={f.placeholder} value={form[f.key] || ''}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          ) : (
            <Input key={f.key} label={f.label + (f.required ? ' *' : '')}
              placeholder={f.placeholder} value={form[f.key] || ''}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          )
        ))}
      </Modal>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">{icon} {title}</div>
          <Button variant="primary" size="sm" icon="+" onClick={openAdd}>Thêm mới</Button>
        </div>
        {items.length === 0 ? <EmptyState icon={icon} text={`Chưa có ${title.toLowerCase()} nào`} /> : (
          <table className="data-table">
            <thead><tr><th>#</th>{visibleFields.map(f => <th key={f.key}>{f.label}</th>)}{showLockColumn && <th>Trạng thái</th>}<th>Thao tác</th></tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  {visibleFields.map((f) => {
                    const rendered = typeof f.render === 'function' ? f.render(item) : item[f.key];
                    return <td key={f.key}>{rendered || '–'}</td>;
                  })}
                  {showLockColumn && <td><Badge color={item.locked ? 'red' : 'green'}>{item.locked ? 'Đã khoá' : 'Đang mở'}</Badge></td>}
                  <td><div className="td-actions">
                    {onToggleLock && <Button variant="ghost" size="sm" onClick={() => onToggleLock(item.id, !item.locked)}>{item.locked ? '🔓 Mở' : '🔒 Khóa'}</Button>}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>Sửa</Button>
                    <Button variant="danger" size="sm" onClick={() => setConfirm(item)}>Xoá</Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function LessonsPanel({ data, lessonsCrud, subjectId, setSubjectId, onlySelectedSubject, setOnlySelectedSubject }) {

  useEffect(() => {
    if (!subjectId && data.subjects?.length) setSubjectId(String(data.subjects[0].id));
  }, [data.subjects, subjectId]);

  const filteredLessons = (onlySelectedSubject && subjectId)
    ? (data.lessons || []).filter((lesson) => String(lesson.subjectId) === String(subjectId))
    : (data.lessons || []);

  const fields = [
    { key: 'name', label: 'Tên bài học', required: true, placeholder: 'Ôn tập Chương 1' },
    {
      key: 'subjectId',
      label: 'Môn học',
      required: true,
      type: 'select',
      options: ((onlySelectedSubject && subjectId)
        ? (data.subjects || []).filter((s) => String(s.id) === String(subjectId))
        : (data.subjects || [])
      ).map((s) => ({ value: s.id, label: s.name })),
    },
    { key: 'order', label: 'Thứ tự bài', placeholder: '1' },
  ];

  const createDefaults = () => ({
    subjectId: subjectId || '',
  });

  const handleAddLesson = async (form) => {
    const resolvedSubjectId = form.subjectId || subjectId || '';
    await lessonsCrud.add({ ...form, subjectId: resolvedSubjectId });
  };

  const handleUpdateLesson = async (id, form) => {
    const resolvedSubjectId = form.subjectId || subjectId || '';
    await lessonsCrud.update(id, { ...form, subjectId: resolvedSubjectId });
  };

  return (
    <>
      <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8, maxWidth: 680 }}>
        <Select
          label="Môn đang quản trị"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          options={(data.subjects || []).map((s) => ({ value: s.id, label: s.name }))}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 30, fontSize: '.86rem', color: 'var(--text-2)' }}>
          <input
            type="checkbox"
            checked={onlySelectedSubject}
            onChange={(e) => setOnlySelectedSubject(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--blue)' }}
          />
          Chỉ hiện môn đang chọn (mặc định)
        </label>
      </div>
      <CrudTable
        title="Bài học"
        icon="📝"
        items={filteredLessons}
        fields={fields}
        createDefaults={createDefaults}
        onAdd={handleAddLesson}
        onUpdate={handleUpdateLesson}
        onRemove={lessonsCrud.remove}
        onToggleLock={(id, locked) => lessonsCrud.update(id, { locked })}
        showLockColumn
      />
    </>
  );
}

function YearsPanel({ data, yearsCrud }) {
  const [facultyId, setFacultyId] = useState('');

  const filteredYears = facultyId
    ? (data.years || []).filter((year) => String(year.facultyId || '') === String(facultyId))
    : (data.years || []);

  const facultyOptions = facultyId
    ? (data.faculties || []).filter((f) => String(f.id) === String(facultyId))
    : (data.faculties || []);

  const yearNameOptions = [
    { value: 'Năm 1', label: 'Năm 1' },
    { value: 'Năm 2', label: 'Năm 2' },
    { value: 'Năm 3', label: 'Năm 3' },
  ];

  const fields = [
    {
      key: 'name',
      label: 'Tên năm học',
      required: true,
      type: 'select',
      options: yearNameOptions,
    },
    {
      key: 'facultyId',
      label: 'Khoa',
      required: true,
      type: 'select',
      options: facultyOptions.map((f) => ({ value: f.id, label: f.name })),
      render: (item) => (data.faculties || []).find((f) => String(f.id) === String(item.facultyId || ''))?.name || item.facultyId,
    },
  ];

  const createDefaults = () => ({
    name: 'Năm 1',
    facultyId: facultyId || '',
  });

  const handleAddYear = async (form) => {
    const resolvedFacultyId = form.facultyId || facultyId || '';
    await yearsCrud.add({ ...form, facultyId: resolvedFacultyId });
  };

  const handleUpdateYear = async (id, form) => {
    const resolvedFacultyId = form.facultyId || facultyId || '';
    await yearsCrud.update(id, { ...form, facultyId: resolvedFacultyId });
  };

  return (
    <>
      <div style={{ marginBottom: 10, maxWidth: 420 }}>
        <Select
          label="Lọc theo khoa"
          value={facultyId}
          onChange={(e) => setFacultyId(e.target.value)}
          options={[{ value: '', label: 'Tất cả khoa' }, ...(data.faculties || []).map((f) => ({ value: f.id, label: f.name }))]}
        />
      </div>
      <CrudTable
        title="Năm học"
        icon="📅"
        items={filteredYears}
        fields={fields}
        createDefaults={createDefaults}
        onAdd={handleAddYear}
        onUpdate={handleUpdateYear}
        onRemove={yearsCrud.remove}
        onToggleLock={(id, locked) => yearsCrud.update(id, { locked })}
        showLockColumn
      />
    </>
  );
}

function SemestersPanel({ data, semestersCrud }) {
  const [facultyId, setFacultyId] = useState('');
  const [yearId, setYearId] = useState('');

  const yearOptions = (data.years || []).filter((year) => {
    if (!facultyId) return true;
    return String(year.facultyId || '') === String(facultyId);
  });

  useEffect(() => {
    if (!yearId) return;
    const exists = yearOptions.some((year) => String(year.id) === String(yearId));
    if (!exists) setYearId('');
  }, [yearId, yearOptions]);

  const filteredSemesters = (data.semesters || []).filter((semester) => {
    if (yearId && String(semester.yearId || '') !== String(yearId)) return false;
    if (facultyId) {
      const year = (data.years || []).find((item) => String(item.id) === String(semester.yearId || ''));
      if (!year || String(year.facultyId || '') !== String(facultyId)) return false;
    }
    return true;
  });

  const semesterNameOptions = [
    { value: 'Học kỳ 1', label: 'Học kỳ 1' },
    { value: 'Học kỳ 2', label: 'Học kỳ 2' },
    { value: 'Học kỳ 3', label: 'Học kỳ 3' },
  ];

  const fields = [
    {
      key: 'name',
      label: 'Tên học kỳ',
      required: true,
      type: 'select',
      options: semesterNameOptions,
    },
    {
      key: 'yearId',
      label: 'Năm học',
      required: true,
      type: 'select',
      options: (facultyId ? yearOptions : (data.years || [])).map((year) => ({ value: year.id, label: year.name })),
      render: (item) => (data.years || []).find((y) => String(y.id) === String(item.yearId || ''))?.name || item.yearId,
    },
  ];

  const createDefaults = () => ({
    name: 'Học kỳ 1',
    yearId: yearId || (yearOptions.length === 1 ? String(yearOptions[0].id) : ''),
  });

  const handleAddSemester = async (form) => {
    const resolvedYearId = form.yearId || yearId || (yearOptions.length === 1 ? String(yearOptions[0].id) : '');
    await semestersCrud.add({ ...form, yearId: resolvedYearId });
  };

  const handleUpdateSemester = async (id, form) => {
    const resolvedYearId = form.yearId || yearId || (yearOptions.length === 1 ? String(yearOptions[0].id) : '');
    await semestersCrud.update(id, { ...form, yearId: resolvedYearId });
  };

  return (
    <>
      <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8, maxWidth: 640 }}>
        <Select
          label="Lọc theo khoa"
          value={facultyId}
          onChange={(e) => { setFacultyId(e.target.value); setYearId(''); }}
          options={[{ value: '', label: 'Tất cả khoa' }, ...(data.faculties || []).map((f) => ({ value: f.id, label: f.name }))]}
        />
        <Select
          label="Lọc theo năm học"
          value={yearId}
          onChange={(e) => setYearId(e.target.value)}
          options={[{ value: '', label: 'Tất cả năm học' }, ...yearOptions.map((y) => ({ value: y.id, label: y.name }))]}
        />
      </div>
      <CrudTable
        title="Học kỳ"
        icon="📋"
        items={filteredSemesters}
        fields={fields}
        createDefaults={createDefaults}
        onAdd={handleAddSemester}
        onUpdate={handleUpdateSemester}
        onRemove={semestersCrud.remove}
      />
    </>
  );
}

function SubjectsPanel({ data, subjectsCrud }) {
  const [facultyId, setFacultyId] = useState('');
  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');

  const yearOptions = (data.years || []).filter((year) => {
    if (!facultyId) return true;
    return String(year.facultyId || '') === String(facultyId);
  });

  useEffect(() => {
    if (!yearId) return;
    const exists = yearOptions.some((year) => String(year.id) === String(yearId));
    if (!exists) {
      setYearId('');
      setSemesterId('');
    }
  }, [yearId, yearOptions]);

  const semesterOptions = (data.semesters || []).filter((semester) => {
    if (!yearId) return true;
    return String(semester.yearId || '') === String(yearId);
  });

  const hasId = (list, id) => (list || []).some((item) => String(item.id) === String(id || ''));
  const pickId = (preferred, fallback, list) => {
    if (preferred && hasId(list, preferred)) return String(preferred);
    if (fallback && hasId(list, fallback)) return String(fallback);
    return list?.length ? String(list[0].id) : '';
  };

  useEffect(() => {
    if (!semesterId) return;
    const exists = semesterOptions.some((semester) => String(semester.id) === String(semesterId));
    if (!exists) setSemesterId('');
  }, [semesterId, semesterOptions]);

  const filteredSubjects = (data.subjects || []).filter((subject) => {
    if (facultyId && String(subject.facultyId || '') !== String(facultyId)) return false;
    if (yearId && String(subject.yearId || '') !== String(yearId)) return false;
    if (semesterId && String(subject.semesterId || '') !== String(semesterId)) return false;
    return true;
  });

  const facultyOptions = facultyId
    ? (data.faculties || []).filter((faculty) => String(faculty.id) === String(facultyId))
    : (data.faculties || []);

  const fields = [
    { key: 'name', label: 'Tên môn học', required: true, placeholder: 'Cấu trúc dữ liệu' },
    {
      key: 'facultyId',
      label: 'Khoa',
      required: true,
      type: 'select',
      options: facultyOptions.map((f) => ({ value: f.id, label: f.name })),
      render: (item) => (data.faculties || []).find((f) => String(f.id) === String(item.facultyId || ''))?.name || item.facultyId,
    },
    {
      key: 'yearId',
      label: 'Năm học',
      required: true,
      type: 'select',
      options: (form) => (data.years || [])
        .filter((y) => {
          const activeFacultyId = form.facultyId || facultyId;
          if (activeFacultyId && String(y.facultyId || '') !== String(activeFacultyId)) return false;
          return true;
        })
        .map((y) => ({ value: y.id, label: y.name })),
      render: (item) => (data.years || []).find((y) => String(y.id) === String(item.yearId || ''))?.name || item.yearId,
    },
    {
      key: 'semesterId',
      label: 'Học kỳ',
      required: true,
      type: 'select',
      options: (form) => (data.semesters || [])
        .filter((s) => {
          const activeYearId = form.yearId || yearId;
          if (activeYearId && String(s.yearId || '') !== String(activeYearId)) return false;
          return true;
        })
        .map((s) => ({ value: s.id, label: s.name })),
      render: (item) => (data.semesters || []).find((s) => String(s.id) === String(item.semesterId || ''))?.name || item.semesterId,
    },
  ];

  const createDefaults = () => ({
    facultyId: facultyId || '',
    yearId: yearId || '',
    semesterId: semesterId || '',
  });

  const handleAddSubject = async (form) => {
    const resolvedFacultyId = pickId(form.facultyId, facultyId, data.faculties || []);
    const resolvedYearOptions = (data.years || []).filter((year) => {
      if (!resolvedFacultyId) return true;
      return String(year.facultyId || '') === String(resolvedFacultyId);
    });
    const resolvedYearId = pickId(form.yearId, yearId, resolvedYearOptions);
    const resolvedSemesterOptions = (data.semesters || []).filter((semester) => {
      if (!resolvedYearId) return true;
      return String(semester.yearId || '') === String(resolvedYearId);
    });
    const resolvedSemesterId = pickId(form.semesterId, semesterId, resolvedSemesterOptions);

    const resolved = {
      ...form,
      facultyId: resolvedFacultyId,
      yearId: resolvedYearId,
      semesterId: resolvedSemesterId,
    };
    await subjectsCrud.add(resolved);
  };

  const handleUpdateSubject = async (id, form) => {
    const resolvedFacultyId = pickId(form.facultyId, facultyId, data.faculties || []);
    const resolvedYearOptions = (data.years || []).filter((year) => {
      if (!resolvedFacultyId) return true;
      return String(year.facultyId || '') === String(resolvedFacultyId);
    });
    const resolvedYearId = pickId(form.yearId, yearId, resolvedYearOptions);
    const resolvedSemesterOptions = (data.semesters || []).filter((semester) => {
      if (!resolvedYearId) return true;
      return String(semester.yearId || '') === String(resolvedYearId);
    });
    const resolvedSemesterId = pickId(form.semesterId, semesterId, resolvedSemesterOptions);

    const resolved = {
      ...form,
      facultyId: resolvedFacultyId,
      yearId: resolvedYearId,
      semesterId: resolvedSemesterId,
    };
    await subjectsCrud.update(id, resolved);
  };

  return (
    <>
      <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8, maxWidth: 920 }}>
        <Select
          label="Lọc theo khoa"
          value={facultyId}
          onChange={(e) => { setFacultyId(e.target.value); setYearId(''); setSemesterId(''); }}
          options={[{ value: '', label: 'Tất cả khoa' }, ...(data.faculties || []).map((f) => ({ value: f.id, label: f.name }))]}
        />
        <Select
          label="Lọc theo năm học"
          value={yearId}
          onChange={(e) => { setYearId(e.target.value); setSemesterId(''); }}
          options={[{ value: '', label: 'Tất cả năm học' }, ...yearOptions.map((y) => ({ value: y.id, label: y.name }))]}
        />
        <Select
          label="Lọc theo học kỳ"
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value)}
          options={[{ value: '', label: 'Tất cả học kỳ' }, ...semesterOptions.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </div>
      <CrudTable
        title="Môn học"
        icon="📚"
        items={filteredSubjects}
        fields={fields}
        tableFields={fields}
        createDefaults={createDefaults}
        onAdd={handleAddSubject}
        onUpdate={handleUpdateSubject}
        onRemove={subjectsCrud.remove}
        onToggleLock={(id, locked) => subjectsCrud.update(id, { locked })}
        showLockColumn
      />
    </>
  );
}

function SubjectStatsBoard({ data }) {
  const lessons = Array.isArray(data.lessons) ? data.lessons : [];
  const questions = Array.isArray(data.questions) ? data.questions : [];

  return (
    <div className="subject-count-grid">
      {(data.subjects || []).map((subject) => {
        const lessonIds = lessons.filter((l) => String(l.subjectId) === String(subject.id)).map((l) => String(l.id));
        const questionCount = questions.filter((q) => lessonIds.includes(String(q.lessonId))).length;
        return (
          <div key={subject.id} className="subject-count-card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{subject.icon || '📚'} {subject.name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge color="blue">{lessonIds.length} bài</Badge>
              <Badge color="orange">{questionCount} câu</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── QUESTIONS PANEL ────────────────────────────────────────────
function QuestionsPanel({ data, questionsCrud, filterSubjectId, setFilterSubjectId, filterLessonId, setFilterLessonId, onlySelectedSubject, setOnlySelectedSubject }) {
  const makeDefaultByType = (type) => {
    if (type === 'truefalse') {
      return [
        { text: '', imageUrl: '', correct: true },
        { text: '', imageUrl: '', correct: false },
      ];
    }
    return [{ text: '', imageUrl: '', correct: false }, { text: '', imageUrl: '', correct: false }];
  };

  const [modal, setModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [importLessonId, setImportLessonId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [questionImageFileName, setQuestionImageFileName] = useState('');
  const [answerImageFileNames, setAnswerImageFileNames] = useState({});
  const [imagePreview, setImagePreview] = useState({ url: '', title: 'Xem hình ảnh câu hỏi' });
  // filterSubjectId, setFilterSubjectId, filterLessonId, setFilterLessonId, onlySelectedSubject, setOnlySelectedSubject → lifted to AdminDashboard
  const [form, setForm] = useState({
    lessonId: '',
    type: 'single',
    text: '',
    imageUrl: '',
    answers: makeDefaultByType('single'),
    dragItems: [
      { id: 'item-1', label: '' },
      { id: 'item-2', label: '' },
    ],
    dropTargets: [
      { id: 'slot-1', label: 'Vị trí 1', correctItemId: '', correctItemIds: [] },
      { id: 'slot-2', label: 'Vị trí 2', correctItemId: '', correctItemIds: [] },
    ],
  });

  useEffect(() => {
    if (!filterSubjectId && data.subjects?.length) setFilterSubjectId(String(data.subjects[0].id));
  }, [data.subjects, filterSubjectId]);

  const lessonOptions = (onlySelectedSubject && filterSubjectId)
    ? (data.lessons || []).filter((lesson) => String(lesson.subjectId) === String(filterSubjectId))
    : (data.lessons || []);

  const questionList = (data.questions || []).filter((q) => {
    if (filterLessonId && String(q.lessonId) !== String(filterLessonId)) return false;
    if (onlySelectedSubject && filterSubjectId) {
      const lesson = (data.lessons || []).find((item) => String(item.id) === String(q.lessonId));
      if (!lesson || String(lesson.subjectId) !== String(filterSubjectId)) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!filterLessonId) return;
    const exists = lessonOptions.some((lesson) => String(lesson.id) === String(filterLessonId));
    if (!exists) setFilterLessonId('');
  }, [filterLessonId, lessonOptions]);

  const openAdd = () => {
    setEditing(null);
    setQuestionImageFileName('');
    setAnswerImageFileNames({});
    const defaultLessonId = filterLessonId || (lessonOptions.length === 1 ? String(lessonOptions[0].id) : '');
    setForm({
      lessonId: defaultLessonId,
      type: 'single',
      text: '',
      imageUrl: '',
      answers: makeDefaultByType('single'),
      dragItems: [
        { id: 'item-1', label: '' },
        { id: 'item-2', label: '' },
      ],
      dropTargets: [
        { id: 'slot-1', label: 'Vị trí 1', correctItemId: '', correctItemIds: [] },
        { id: 'slot-2', label: 'Vị trí 2', correctItemId: '', correctItemIds: [] },
      ],
    });
    setModal(true);
  };

  const preventDropDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const importDocxFile = async (file) => {
    if (!file) return;
    setImportFileName(file.name || '');

    if (!importLessonId) {
      setToast('Vui lòng chọn bài học trước khi import Word.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setToast('Chỉ hỗ trợ file Word .docx');
      return;
    }

    try {
      setIsImporting(true);
      const report = await parseDocxQuestionsWithReport(file);
      const parsed = report.questions;
      if (!parsed.length) {
        setToast('Không tìm thấy câu hỏi hợp lệ trong file Word.');
        return;
      }

      const chunkSize = 5;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        await Promise.all(chunk.map((question) => questionsCrud.add({
          ...question,
          lessonId: importLessonId,
          answers: question.answers.map((answer, idx) => ({ id: idx + 1, ...answer })),
        })));
      }

      if (report.invalidCount > 0) {
        setToast(`Đã import ${parsed.length} câu hợp lệ. Bỏ qua ${report.invalidCount}/${report.candidateCount} câu sai định dạng.`);
      } else {
        setToast(`Đã import ${parsed.length} câu hỏi từ file Word.`);
      }
      setImportModal(false);
      setImportLessonId('');
      setImportFileName('');
    } catch (error) {
      setToast(`Import thất bại: ${error.message || 'Không thể đọc file Word'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportDocx = async (event) => {
    const file = event.target.files?.[0];
    await importDocxFile(file);
    event.target.value = '';
  };

  const onImportDrop = async (event) => {
    preventDropDefaults(event);
    const file = event.dataTransfer?.files?.[0];
    await importDocxFile(file);
  };

  const openEdit = (q) => {
    setEditing(q);
    setQuestionImageFileName('');
    setAnswerImageFileNames({});
    setForm({
      lessonId: q.lessonId,
      type: q.type || 'single',
      text: q.text || q.question || '',
      imageUrl: q.imageUrl || '',
      answers: (Array.isArray(q.answers) && q.answers.length ? q.answers : makeDefaultByType(q.type || 'single')).map((a) => ({
        text: a.text || '',
        imageUrl: a.imageUrl || '',
        correct: Boolean(a.correct ?? a.isCorrect),
      })),
      dragItems: (Array.isArray(q.dragItems) && q.dragItems.length ? q.dragItems : [
        { id: 'item-1', label: '' },
        { id: 'item-2', label: '' },
      ]).map((item, idx) => ({
        id: item.id || `item-${idx + 1}`,
        label: item.label || item.text || '',
      })),
      dropTargets: (Array.isArray(q.dropTargets) && q.dropTargets.length ? q.dropTargets : [
        { id: 'slot-1', label: 'Vị trí 1', correctItemId: '', correctItemIds: [] },
        { id: 'slot-2', label: 'Vị trí 2', correctItemId: '', correctItemIds: [] },
      ]).map((target, idx) => ({
        id: target.id || `slot-${idx + 1}`,
        label: target.label || `Vị trí ${idx + 1}`,
        correctItemId: target.correctItemId || '',
        correctItemIds: Array.isArray(target.correctItemIds)
          ? target.correctItemIds.filter(Boolean)
          : (target.correctItemId ? [target.correctItemId] : []),
      })),
    });
    setModal(true);
  };

  const onTypeChange = (nextType) => {
    setForm((prev) => ({
      ...prev,
      type: nextType,
      answers: makeDefaultByType(nextType),
      dragItems: nextType === 'drag'
        ? [{ id: 'item-1', label: '' }, { id: 'item-2', label: '' }]
        : prev.dragItems,
      dropTargets: nextType === 'drag'
        ? [
          { id: 'slot-1', label: 'Vị trí 1', correctItemId: '', correctItemIds: [] },
          { id: 'slot-2', label: 'Vị trí 2', correctItemId: '', correctItemIds: [] },
        ]
        : prev.dropTargets,
    }));
  };

  const addAnswer = () => setForm(f => ({ ...f, answers: [...f.answers, { text: '', imageUrl: '', correct: false }] }));
  const removeAnswer = (i) => setForm(f => ({ ...f, answers: f.answers.filter((_, idx) => idx !== i) }));
  const setAnswer = (i, key, val) => setForm(f => ({ ...f, answers: f.answers.map((a, idx) => idx === i ? { ...a, [key]: val } : a) }));

  const pickQuestionImage = (file) => {
    if (!file) return;
    setQuestionImageFileName(file.name || '');
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, imageUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const onPickImage = (event) => {
    const file = event.target.files?.[0];
    pickQuestionImage(file);
  };

  const onDropQuestionImage = (event) => {
    preventDropDefaults(event);
    const file = event.dataTransfer?.files?.[0];
    pickQuestionImage(file);
  };

  const pickAnswerImage = (index, file) => {
    if (!file) return;
    setAnswerImageFileNames((prev) => ({ ...prev, [index]: file.name || '' }));
    const reader = new FileReader();
    reader.onload = () => {
      setAnswer(index, 'imageUrl', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const onPickAnswerImage = (index, event) => {
    const file = event.target.files?.[0];
    pickAnswerImage(index, file);
  };

  const onDropAnswerImage = (index, event) => {
    preventDropDefaults(event);
    const file = event.dataTransfer?.files?.[0];
    pickAnswerImage(index, file);
  };

  const toggleCorrect = (i) => {
    if (form.type === 'single') {
      setForm(f => ({ ...f, answers: f.answers.map((a, idx) => ({ ...a, correct: idx === i })) }));
    } else {
      setAnswer(i, 'correct', !form.answers[i].correct);
    }
  };

  const addDragItem = () => {
    setForm((prev) => ({
      ...prev,
      dragItems: [...prev.dragItems, { id: `item-${Date.now()}`, label: '' }],
    }));
  };

  const setDragItem = (id, value) => {
    setForm((prev) => ({
      ...prev,
      dragItems: prev.dragItems.map((item) => (item.id === id ? { ...item, label: value } : item)),
    }));
  };

  const removeDragItem = (id) => {
    setForm((prev) => {
      const nextItems = prev.dragItems.filter((item) => item.id !== id);
      return {
        ...prev,
        dragItems: nextItems,
        dropTargets: prev.dropTargets.map((target) => ({
          ...target,
          correctItemIds: (Array.isArray(target.correctItemIds)
            ? target.correctItemIds
            : (target.correctItemId ? [target.correctItemId] : [])
          ).filter((itemId) => itemId !== id),
          correctItemId: String(target.correctItemId || '') === String(id) ? '' : target.correctItemId,
        })),
      };
    });
  };

  const addDropTarget = () => {
    setForm((prev) => ({
      ...prev,
      dropTargets: [...prev.dropTargets, { id: `slot-${Date.now()}`, label: `Vị trí ${prev.dropTargets.length + 1}`, correctItemId: '', correctItemIds: [] }],
    }));
  };

  const setDropTarget = (id, key, value) => {
    setForm((prev) => ({
      ...prev,
      dropTargets: prev.dropTargets.map((target) => (target.id === id ? { ...target, [key]: value } : target)),
    }));
  };

  const removeDropTarget = (id) => {
    setForm((prev) => ({
      ...prev,
      dropTargets: prev.dropTargets.filter((target) => target.id !== id),
    }));
  };

  const saveQuestion = async () => {
    const resolvedLessonId = form.lessonId || filterLessonId || (lessonOptions.length === 1 ? String(lessonOptions[0].id) : '');
    if (!resolvedLessonId || !form.text.trim()) {
      setToast('Vui lòng nhập đầy đủ bài học và nội dung câu hỏi.');
      return;
    }

    const answers = form.answers
      .map((a) => ({
        text: String(a.text || '').trim(),
        imageUrl: String(a.imageUrl || '').trim(),
        correct: Boolean(a.correct),
      }))
      .filter((a) => a.text || a.imageUrl);

    const approxBase64Size = String(form.imageUrl || '').length
      + answers.reduce((sum, item) => sum + String(item.imageUrl || '').length, 0);
    if (approxBase64Size > 6 * 1024 * 1024) {
      setToast('Ảnh quá lớn, vui lòng giảm dung lượng ảnh trước khi lưu câu hỏi.');
      return;
    }

    if (form.type === 'drag') {
      const dragItems = form.dragItems
        .map((item) => ({ ...item, id: String(item.id || '').trim(), label: String(item.label || '').trim() }))
        .filter((item) => item.label);
      const dropTargets = form.dropTargets
        .map((target) => ({
          ...target,
          label: String(target.label || '').trim(),
          correctItemIds: (Array.isArray(target.correctItemIds)
            ? target.correctItemIds
            : (target.correctItemId ? [target.correctItemId] : [])
          ).map((itemId) => String(itemId || '').trim()).filter(Boolean),
        }))
        .filter((target) => target.label);

      if (dragItems.length < 2) {
        setToast('Kéo & thả cần ít nhất 2 mục để kéo.');
        return;
      }
      if (dropTargets.length < 1) {
        setToast('Kéo & thả cần ít nhất 1 ô đích để kéo vào.');
        return;
      }
      if (dropTargets.some((target) => target.correctItemIds.length < 1)) {
        setToast('Mỗi ô đích cần chọn ít nhất 1 mục đúng.');
        return;
      }

      const payload = {
        lessonId: resolvedLessonId,
        type: form.type,
        text: form.text.trim(),
        imageUrl: form.imageUrl || '',
        dragItems,
        dropTargets: dropTargets.map((target) => ({
          ...target,
          correctItemId: target.correctItemIds[0] || '',
        })),
        answers: dragItems.map((item, idx) => ({
          id: idx + 1,
          text: item.label,
          correct: true,
          order: idx + 1,
        })),
      };

      try {
        if (editing) {
          await questionsCrud.update(editing.id, payload);
          setToast('Đã cập nhật câu hỏi!');
        } else {
          await questionsCrud.add(payload);
          setToast('Đã lưu câu hỏi!');
        }
        setModal(false);
      } catch (error) {
        const status = Number(error?.response?.status || 0);
        if (status === 413) {
          setToast('Dữ liệu câu hỏi quá lớn (413). Hãy giảm kích thước ảnh hoặc chia nhỏ nội dung.');
          return;
        }
        setToast(error?.response?.data?.message || error?.message || 'Không thể lưu câu hỏi.');
      }
      return;
    }

    if (answers.length < 2 && form.type !== 'fill') {
      setToast('Cần ít nhất 2 đáp án hợp lệ.');
      return;
    }
    if (form.type === 'fill' && answers.length < 1) {
      setToast('Điền vào chỗ trống cần ít nhất 1 đáp án đúng.');
      return;
    }

    const correctCount = answers.filter((a) => a.correct).length;
    if (form.type === 'single' && correctCount !== 1) {
      setToast('Loại một đáp án chỉ được chọn đúng 1 đáp án đúng.');
      return;
    }
    if (form.type === 'multiple' && (correctCount < 2 || correctCount > 4)) {
      setToast('Loại nhiều đáp án phải chọn từ 2 đến 4 đáp án đúng.');
      return;
    }
    if (form.type === 'truefalse' && answers.length < 2) {
      setToast('Đúng/Sai cần ít nhất 2 ý nhỏ.');
      return;
    }

    const payload = {
      lessonId: resolvedLessonId,
      type: form.type,
      text: form.text.trim(),
      imageUrl: form.imageUrl || '',
      answers: (form.type === 'fill' ? answers.map((a) => ({ ...a, correct: true })) : answers)
        .map((a, idx) => ({ id: idx + 1, ...a })),
    };

    try {
      if (editing) {
        await questionsCrud.update(editing.id, payload);
        setToast('Đã cập nhật câu hỏi!');
      } else {
        await questionsCrud.add(payload);
        setToast('Đã lưu câu hỏi!');
      }
      setModal(false);
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      if (status === 413) {
        setToast('Dữ liệu câu hỏi quá lớn (413). Hãy giảm kích thước ảnh hoặc chia nhỏ nội dung.');
        return;
      }
      setToast(error?.response?.data?.message || error?.message || 'Không thể lưu câu hỏi.');
    }
  };

  return (
    <>
      <Toast message={toast} type="success" onDone={() => setToast('')} />
      <Confirm open={!!confirm} title="Xoá câu hỏi" message="Xác nhận xoá câu hỏi này?" danger
        onConfirm={async () => {
          await questionsCrud.remove(confirm?.id);
          setConfirm(null);
          setToast('Đã xoá!');
        }} onCancel={() => setConfirm(null)} />

      <Modal
        open={Boolean(imagePreview.url)}
        title={imagePreview.title || 'Xem hình ảnh câu hỏi'}
        onClose={() => setImagePreview({ url: '', title: 'Xem hình ảnh câu hỏi' })}
        footer={<Button variant="ghost" onClick={() => setImagePreview({ url: '', title: 'Xem hình ảnh câu hỏi' })}>Đóng</Button>}
      >
        {imagePreview.url ? (
          <img
            src={imagePreview.url}
            alt="question-full-preview"
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)' }}
          />
        ) : null}
      </Modal>

      <Modal
        open={importModal}
        title="Import câu hỏi từ Word (.docx)"
        onClose={() => setImportModal(false)}
        footer={<><Button variant="ghost" onClick={() => setImportModal(false)}>Đóng</Button></>}
      >
        <Select
          label="Bài học để lưu câu hỏi *"
          value={importLessonId}
          onChange={(e) => setImportLessonId(e.target.value)}
          options={lessonOptions.map((lesson) => ({ value: lesson.id, label: lesson.name }))}
        />
        <div className="form-group">
          <label className="form-label">File Word (.docx)</label>
          <label className="upload-trigger" onDragOver={preventDropDefaults} onDrop={onImportDrop}>
            <input className="file-picker-input" type="file" accept=".docx" disabled={isImporting} onChange={handleImportDocx} />
            <span>{isImporting ? 'Đang xử lý...' : 'Kéo thả hoặc chọn file Word để import'}</span>
          </label>
          <div className="file-picked-name">{importFileName || 'Chưa chọn file nào'}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
            Hỗ trợ định dạng như: "Câu 1:", "Question 1", "1)", "1." cùng đáp án kiểu "A.", "a)", "B)".
            Đáp án đúng có thể đánh dấu bằng * hoặc [x] hoặc (đúng).
          </div>
        </div>
      </Modal>

      <Modal open={modal} title={editing ? 'Sửa câu hỏi' : 'Thêm câu hỏi'} onClose={() => setModal(false)}
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Huỷ</Button><Button variant="primary" onClick={saveQuestion}>Lưu</Button></>}>
        <Select label="Bài học *" value={form.lessonId} onChange={e => setForm(f => ({ ...f, lessonId: e.target.value }))}
          options={lessonOptions.map(l => ({ value: l.id, label: l.name }))} />
        <Select label="Loại câu hỏi *" value={form.type} onChange={e => onTypeChange(e.target.value)}
          options={[{value:'single',label:'Một đáp án'},{value:'multiple',label:'Nhiều đáp án'},{value:'truefalse',label:'Đúng / Sai'},{value:'fill',label:'Điền vào chỗ trống'},{value:'drag',label:'Kéo & Thả'}]} />
        <Textarea label="Nội dung câu hỏi *" placeholder="Nhập câu hỏi..." rows={6} value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} />
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Hình ảnh câu hỏi (tuỳ chọn)</label>
          <label className="upload-trigger" onDragOver={preventDropDefaults} onDrop={onDropQuestionImage}>
            <input className="file-picker-input" type="file" accept="image/*" onChange={onPickImage} />
            <span>Kéo thả hoặc tải ảnh câu hỏi</span>
          </label>
          <div className="file-picked-name">{questionImageFileName || 'Chưa chọn ảnh từ máy'}</div>
          <Input label="Hoặc dán URL ảnh" placeholder="https://..." value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
          {form.imageUrl && (
            <img
              src={form.imageUrl}
              alt="question-preview"
              style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', marginTop: 8 }}
            />
          )}
        </div>
        {form.type !== 'drag' && form.type !== 'truefalse' && (
          <div style={{ marginBottom: 6 }}>
            <label className="form-label">
              {form.type === 'fill' ? 'Đáp án điền (chấp nhận nhiều đáp án)' : 'Đáp án'}
            </label>

            {form.answers.map((a, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {form.type !== 'fill' && (
                  <input
                    type={form.type === 'multiple' ? 'checkbox' : 'radio'}
                    checked={a.correct}
                    onChange={() => toggleCorrect(i)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--blue)' }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <Textarea
                    label={form.type === 'fill' ? `Đáp án đúng ${i + 1}` : `Đáp án ${i + 1}`}
                    rows={4}
                    placeholder="Nhập nội dung đáp án (có thể để trống nếu dùng ảnh)"
                    value={a.text}
                    onChange={e => setAnswer(i, 'text', e.target.value)}
                  />
                  <label className="upload-trigger upload-trigger-sm" onDragOver={preventDropDefaults} onDrop={(e) => onDropAnswerImage(i, e)}>
                    <input className="file-picker-input" type="file" accept="image/*" onChange={(e) => onPickAnswerImage(i, e)} />
                    <span>Kéo thả hoặc tải ảnh đáp án {i + 1}</span>
                  </label>
                  <div className="file-picked-name">{answerImageFileNames[i] || 'Chưa chọn ảnh từ máy'}</div>
                  <Input label="URL ảnh đáp án" placeholder="https://..." value={a.imageUrl || ''} onChange={(e) => setAnswer(i, 'imageUrl', e.target.value)} />
                  {a.imageUrl && (
                    <img
                      src={a.imageUrl}
                      alt={`answer-${i + 1}`}
                      style={{ width: '100%', maxHeight: 180, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 8 }}
                    />
                  )}
                </div>
                {form.type !== 'truefalse' && form.answers.length > 2 && (
                  <button onClick={() => removeAnswer(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem' }}>×</button>
                )}
                </div>
              </div>
            ))}

            {(form.type === 'single' || form.type === 'multiple' || form.type === 'fill') && (
              <Button variant="ghost" size="sm" onClick={addAnswer}>+ Thêm đáp án</Button>
            )}

            {form.type === 'single' && <div style={{ marginTop: 6, fontSize: '.78rem', color: 'var(--muted)' }}>Chỉ được chọn 1 đáp án đúng.</div>}
            {form.type === 'multiple' && <div style={{ marginTop: 6, fontSize: '.78rem', color: 'var(--muted)' }}>Chọn từ 2 đến 4 đáp án đúng.</div>}
          </div>
        )}

        {form.type === 'truefalse' && (
          <div style={{ marginBottom: 8 }}>
            <label className="form-label">Các ý nhỏ Đúng/Sai</label>
            <div style={{ marginBottom: 8, fontSize: '.8rem', color: 'var(--muted)' }}>
              Mỗi ý nhỏ có nội dung riêng, sau đó chọn đáp án đúng là Đúng hoặc Sai.
            </div>
            {form.answers.map((a, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>Ý {i + 1}</div>
                <Textarea
                  label={`Nội dung ý ${i + 1}`}
                  rows={4}
                  placeholder="Nhập nội dung ý (có thể dài hoặc nhiều dòng)"
                  value={a.text}
                  onChange={(e) => setAnswer(i, 'text', e.target.value)}
                />
                <label className="upload-trigger upload-trigger-sm" onDragOver={preventDropDefaults} onDrop={(e) => onDropAnswerImage(i, e)}>
                  <input className="file-picker-input" type="file" accept="image/*" onChange={(e) => onPickAnswerImage(i, e)} />
                  <span>Kéo thả hoặc tải ảnh cho ý {i + 1}</span>
                </label>
                <div className="file-picked-name">{answerImageFileNames[i] || 'Chưa chọn ảnh từ máy'}</div>
                <Input label="URL ảnh cho ý này" placeholder="https://..." value={a.imageUrl || ''} onChange={(e) => setAnswer(i, 'imageUrl', e.target.value)} />
                {a.imageUrl && (
                  <img
                    src={a.imageUrl}
                    alt={`tf-${i + 1}`}
                    style={{ width: '100%', maxHeight: 180, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 8 }}
                  />
                )}
                <div style={{ display: 'flex', gap: 18, marginTop: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '.85rem' }}>
                    <input
                      type="radio"
                      name={`tf-${i}`}
                      checked={a.correct === true}
                      onChange={() => setAnswer(i, 'correct', true)}
                    />
                    Đúng
                  </label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '.85rem' }}>
                    <input
                      type="radio"
                      name={`tf-${i}`}
                      checked={a.correct === false}
                      onChange={() => setAnswer(i, 'correct', false)}
                    />
                    Sai
                  </label>
                  {form.answers.length > 2 && (
                    <button onClick={() => removeAnswer(i)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem' }}>×</button>
                  )}
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addAnswer}>+ Thêm ý nhỏ</Button>
          </div>
        )}

        {form.type === 'drag' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className="form-label">Các mục để kéo</label>
              {form.dragItems.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    className="form-input"
                    placeholder={`Mục kéo ${idx + 1}`}
                    value={item.label}
                    onChange={(e) => setDragItem(item.id, e.target.value)}
                  />
                  {form.dragItems.length > 2 && (
                    <button onClick={() => removeDragItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem' }}>×</button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addDragItem}>+ Thêm mục kéo</Button>
            </div>

            <div>
              <label className="form-label">Các ô để kéo vào</label>
              {form.dropTargets.map((target, idx) => (
                <div key={target.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                  <input
                    className="form-input"
                    placeholder={`Tên ô đích ${idx + 1}`}
                    value={target.label}
                    onChange={(e) => setDropTarget(target.id, 'label', e.target.value)}
                  />
                  {form.dropTargets.length > 2 && (
                    <button onClick={() => removeDropTarget(target.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem' }}>×</button>
                  )}
                  <div style={{ gridColumn: '1 / -1', border: '1px dashed var(--border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: '.8rem', marginBottom: 6, color: 'var(--text-2)' }}>Chọn 1 hoặc nhiều mục đúng cho ô này:</div>
                    {(form.dragItems || []).filter((item) => item.label.trim()).map((item) => {
                      const selectedIds = Array.isArray(target.correctItemIds)
                        ? target.correctItemIds
                        : (target.correctItemId ? [target.correctItemId] : []);
                      const checked = selectedIds.includes(item.id);
                      return (
                        <label key={`${target.id}-${item.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 12, marginBottom: 6, fontSize: '.84rem' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selectedIds, item.id]
                                : selectedIds.filter((id) => id !== item.id);
                              setDropTarget(target.id, 'correctItemIds', [...new Set(next)]);
                              setDropTarget(target.id, 'correctItemId', next[0] || '');
                            }}
                          />
                          {item.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addDropTarget}>+ Thêm ô đích</Button>
              <div style={{ marginTop: 6, fontSize: '.78rem', color: 'var(--muted)' }}>
                Mỗi ô đích có thể gán 1 hoặc nhiều mục kéo đúng.
              </div>
            </div>
          </div>
        )}
      </Modal>
      <div className="table-wrap">
        <div className="table-header">
          <div>
            <div className="table-title">❓ Câu hỏi</div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, maxWidth: 460 }}>
              <Select
                label="Lọc theo môn"
                value={filterSubjectId}
                onChange={(e) => { setFilterSubjectId(e.target.value); setFilterLessonId(''); }}
                options={(data.subjects || []).map((s) => ({ value: s.id, label: s.name }))}
              />
              <Select
                label="Lọc theo bài"
                value={filterLessonId}
                onChange={(e) => setFilterLessonId(e.target.value)}
                options={[{ value: '', label: 'Tất cả bài học' }, ...lessonOptions.map((l) => ({ value: l.id, label: l.name }))]}
              />
            </div>
            <label style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.84rem', color: 'var(--text-2)' }}>
              <input
                type="checkbox"
                checked={onlySelectedSubject}
                onChange={(e) => { setOnlySelectedSubject(e.target.checked); setFilterLessonId(''); }}
                style={{ width: 16, height: 16, accentColor: 'var(--blue)' }}
              />
              Chỉ hiện môn đang chọn (mặc định)
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" icon="⬆" onClick={() => setImportModal(true)}>Import Word</Button>
            <Button variant="primary" size="sm" icon="+" onClick={openAdd}>Thêm câu hỏi</Button>
          </div>
        </div>
        {questionList.length === 0 ? <EmptyState icon="❓" text="Chưa có câu hỏi" /> : (
          <table className="data-table">
            <thead><tr><th>#</th><th>Nội dung</th><th>Loại</th><th>Ảnh</th><th>Bài học</th><th>Thao tác</th></tr></thead>
            <tbody>
              {questionList.map((q, i) => (
                <tr key={q.id}>
                  <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ maxWidth: 260 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.text || q.question}</div></td>
                  <td><Badge color={q.type === 'single' ? 'blue' : q.type === 'multiple' ? 'orange' : 'gray'}>{q.type}</Badge></td>
                  <td>
                    {q.imageUrl ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setImagePreview({ url: q.imageUrl, title: `Ảnh câu hỏi #${i + 1}` })}
                      >
                        🖼️ Xem ảnh
                      </Button>
                    ) : '–'}
                  </td>
                  <td style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{data.lessons.find(l => l.id === q.lessonId)?.name || '–'}</td>
                  <td><div className="td-actions">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>Sửa</Button>
                    <Button variant="danger" size="sm" onClick={() => setConfirm(q)}>Xoá</Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── MAIN ADMIN DASHBOARD ────────────────────────────────────────
const SECTIONS = [
  { id: 'overview', icon: '📊', label: 'Tổng quan' },
  { id: 'users', icon: '👥', label: 'Người dùng' },
  { id: 'faculties', icon: '🏛️', label: 'Khoa' },
  { id: 'years', icon: '📅', label: 'Năm học' },
  { id: 'semesters', icon: '📋', label: 'Học kỳ' },
  { id: 'subjects', icon: '📚', label: 'Môn học' },
  { id: 'lessons', icon: '📝', label: 'Bài học' },
  { id: 'questions', icon: '❓', label: 'Câu hỏi' },
];

export default function AdminDashboard() {
  const [section, setSection] = useState('overview');
  const [analytics, setAnalytics] = useState({ totalVisits: 0, onlineUsers: 0, peakOnline: 0 });
  const { data, syncFromServer } = useData();
  const { faculties, years, semesters, subjects, lessons, questions } = useData();
  const { user } = useAuth();

  // ── Filter states lifted here so they survive data re-syncs ──
  const [lessonsSubjectId, setLessonsSubjectId] = useState('');
  const [lessonsOnlySelected, setLessonsOnlySelected] = useState(true);
  const [qFilterSubjectId, setQFilterSubjectId] = useState('');
  const [qFilterLessonId, setQFilterLessonId] = useState('');
  const [qOnlySelected, setQOnlySelected] = useState(true);

  useEffect(() => {
    syncFromServer?.().catch(() => {});
  }, [syncFromServer]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let timer;
    const pull = async () => {
      try {
        const res = await adminDataAPI.getAnalyticsSummary();
        setAnalytics(res?.data || { totalVisits: 0, onlineUsers: 0, peakOnline: 0 });
      } catch {
        // ignore analytics error on UI
      }
    };
    pull();
    timer = window.setInterval(pull, 15000);
    return () => window.clearInterval(timer);
  }, [user?.role]);

  const renderContent = () => {
    switch (section) {
      case 'overview': return <Overview data={data} analytics={analytics} />;
      case 'users': return <UsersPanel />;
      case 'faculties': return <CrudTable title="Khoa" icon="🏛️" items={data.faculties}
        fields={[{key:'icon',label:'Icon',placeholder:'💻'},{key:'name',label:'Tên khoa',required:true,placeholder:'Công nghệ Thông tin'},{key:'desc',label:'Mô tả',placeholder:'Số môn học...'}]}
        onAdd={faculties.add} onUpdate={faculties.update} onRemove={faculties.remove} onToggleLock={(id, locked) => faculties.update(id, { locked })} showLockColumn />;
      case 'years': return <YearsPanel data={data} yearsCrud={years} />;
      case 'semesters': return <SemestersPanel data={data} semestersCrud={semesters} />;
      case 'subjects': return <SubjectsPanel data={data} subjectsCrud={subjects} />;
      case 'lessons': return <LessonsPanel data={data} lessonsCrud={lessons}
        subjectId={lessonsSubjectId} setSubjectId={setLessonsSubjectId}
        onlySelectedSubject={lessonsOnlySelected} setOnlySelectedSubject={setLessonsOnlySelected} />;
      case 'questions': return <QuestionsPanel data={data} questionsCrud={questions}
        filterSubjectId={qFilterSubjectId} setFilterSubjectId={setQFilterSubjectId}
        filterLessonId={qFilterLessonId} setFilterLessonId={setQFilterLessonId}
        onlySelectedSubject={qOnlySelected} setOnlySelectedSubject={setQOnlySelected} />;
      default: return null;
    }
  };

  return (
    <div className="app-wrapper">
      <Navbar />
      <div className="page-content">
        <div className="page-header">
          <div className="page-title">⚙️ Admin Dashboard</div>
          <div className="page-sub">Quản lý toàn bộ hệ thống QuizMaster</div>
        </div>
        <div className="admin-layout">
          <div className="admin-sidebar">
            {SECTIONS.map(s => (
              <button key={s.id} className={`as-btn${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
          <div className="admin-main">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
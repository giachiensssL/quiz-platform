// src/pages/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { adminDataAPI } from '../../api/api';
import Navbar from '../../components/Navbar';
import { Button, Input, Select, Textarea, Modal, Confirm, Toast, Badge, EmptyState } from '../../components/UI';
import { parseDocxQuestionsWithReport, parseLessonsFromTextWithReport, parseQuestionsFromTextWithReport } from '../../utils/wordQuestionParser';

// ── OVERVIEW ────────────────────────────────────────────────────
function Overview({ data, analytics }) {
  const stats = [
    { label: 'Người dùng', val: 2, icon: '👥', color: 'var(--blue)' },
    { label: 'Câu hỏi', val: data.questions.length, icon: '❓', color: 'var(--orange)' },
    { label: 'Môn học', val: data.subjects.length, icon: '📚', color: 'var(--success)' },
    { label: 'Bài học', val: data.lessons.length, icon: '📝', color: '#8B5CF6' },
    { label: 'Ngành học', val: data.faculties.length, icon: '🏛️', color: '#0891B2' },
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
  const emptyAccessLocks = { faculties: [], years: [], semesters: [], subjects: [], lessons: [] };
  const normalizeAccessLocks = (locks) => ({
    faculties: Array.from(new Set((locks?.faculties || []).map((id) => String(id)))),
    years: Array.from(new Set((locks?.years || []).map((id) => String(id)))),
    semesters: Array.from(new Set((locks?.semesters || []).map((id) => String(id)))),
    subjects: Array.from(new Set((locks?.subjects || []).map((id) => String(id)))),
    lessons: Array.from(new Set((locks?.lessons || []).map((id) => String(id)))),
  });
  const countUserLocks = (locks) => {
    const normalized = normalizeAccessLocks(locks || emptyAccessLocks);
    return normalized.faculties.length
      + normalized.years.length
      + normalized.semesters.length
      + normalized.subjects.length
      + normalized.lessons.length;
  };
  const mapOption = (item, labelField = 'name') => ({ id: String(item?._id || item?.id || ''), label: String(item?.[labelField] || item?.label || item?.title || item?.name || '').trim() });

  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [accessModal, setAccessModal] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessForm, setAccessForm] = useState(emptyAccessLocks);
  const [accessOptions, setAccessOptions] = useState({ faculties: [], years: [], semesters: [], subjects: [], lessons: [] });
  const [confirm, setConfirm] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', role: 'user' });
  const [editForm, setEditForm] = useState({ fullName: '', email: '', username: '', password: '', role: 'user' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [toast, setToast] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [mode, setMode] = useState('server');
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const ef = (k) => (e) => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const mapMockUser = (user) => ({
    _id: String(user.id),
    id: String(user.id),
    username: user.username,
    plainPassword: user.password,
    fullName: user.name || user.fullName || '',
    email: user.email || '',
    role: user.role || 'user',
    isBlocked: Boolean(user.blocked),
    accessLocks: normalizeAccessLocks(user.accessLocks || emptyAccessLocks),
    attempts: Array.isArray(user.attempts) ? user.attempts : [],
    createdAt: user.createdAt || new Date().toISOString(),
  });

  const mapServerUser = (user) => ({
    ...user,
    _id: String(user?._id || user?.id || ''),
    accessLocks: normalizeAccessLocks(user?.accessLocks || emptyAccessLocks),
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
      setUsers((Array.isArray(res?.data) ? res.data : []).map(mapServerUser));
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
        plainPassword: form.password,
        role: form.role,
        name: form.fullName.trim() || username,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        blocked: false,
        accessLocks: normalizeAccessLocks(emptyAccessLocks),
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
    try {
      if (mode === 'local') {
        setMockUsers((prev) => prev.filter((item) => String(item.id) !== String(id)));
        setUsers((prev) => prev.filter((item) => String(item._id || item.id) !== String(id)));
        setToast('Đã xoá tài khoản (cục bộ).');
        return;
      }

      await adminDataAPI.removeUser(id);
      setToast('Đã xoá tài khoản.');
      await loadUsers();
    } catch (error) {
      setToast(error?.response?.data?.message || 'Không thể xoá tài khoản.');
    } finally {
      setConfirm(null);
      setIsRemoving(false);
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
      username: user.username || '',
      password: user.plainPassword || '',
      role: user.role || 'user',
    });
    setEditModal(true);
  };

  const toggleAccessLockItem = (key, id) => {
    const lockId = String(id || '');
    setAccessForm((prev) => {
      const current = Array.isArray(prev?.[key]) ? prev[key] : [];
      const exists = current.includes(lockId);
      return {
        ...prev,
        [key]: exists ? current.filter((item) => item !== lockId) : [...current, lockId],
      };
    });
  };

  const openAccessLocks = async (user) => {
    if (mode === 'local') {
      setToast('Chế độ cục bộ không hỗ trợ khóa truy cập theo user. Vui lòng đăng nhập server admin.');
      return;
    }

    try {
      setAccessLoading(true);
      setAccessTarget(user);
      const [facRes, yearRes, semRes, subRes, lessonRes, lockRes] = await Promise.all([
        adminDataAPI.listFaculties(),
        adminDataAPI.listYears(),
        adminDataAPI.listSemesters(),
        adminDataAPI.listSubjects(),
        adminDataAPI.listLessons(),
        adminDataAPI.getUserAccessLocks(String(user._id || user.id)),
      ]);

      setAccessOptions({
        faculties: (Array.isArray(facRes?.data) ? facRes.data : []).map((item) => mapOption(item, 'name')),
        years: (Array.isArray(yearRes?.data) ? yearRes.data : []).map((item) => mapOption(item, 'label')),
        semesters: (Array.isArray(semRes?.data) ? semRes.data : []).map((item) => mapOption(item, 'label')),
        subjects: (Array.isArray(subRes?.data) ? subRes.data : []).map((item) => mapOption(item, 'name')),
        lessons: (Array.isArray(lessonRes?.data) ? lessonRes.data : []).map((item) => mapOption(item, 'title')),
      });
      setAccessForm(normalizeAccessLocks(lockRes?.data?.accessLocks || emptyAccessLocks));
      setAccessModal(true);
    } catch (error) {
      setToast(error?.response?.data?.message || 'Không tải được danh sách khóa truy cập user.');
    } finally {
      setAccessLoading(false);
    }
  };

  const saveAccessLocks = async () => {
    if (!accessTarget?._id) return;
    try {
      setAccessLoading(true);
      await adminDataAPI.setUserAccessLocks(String(accessTarget._id), normalizeAccessLocks(accessForm));
      setUsers((prev) => prev.map((item) => (
        String(item._id || item.id) === String(accessTarget._id)
          ? { ...item, accessLocks: normalizeAccessLocks(accessForm) }
          : item
      )));
      setToast('Đã cập nhật khóa truy cập theo tài khoản.');
      setAccessModal(false);
      setAccessTarget(null);
    } catch (error) {
      setToast(error?.response?.data?.message || 'Không thể lưu khóa truy cập user.');
    } finally {
      setAccessLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editingUser?._id) return;

    if (mode === 'local') {
      const id = String(editingUser._id || editingUser.id);
      setMockUsers((prev) => prev.map((item) => {
        if (String(item.id) !== id) return item;
        return {
          ...item,
          username: editForm.username.trim().toLowerCase(),
          password: editForm.password || item.password,
          plainPassword: editForm.password || item.password,
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
          username: editForm.username.trim().toLowerCase(),
          plainPassword: editForm.password || item.plainPassword,
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
        username: editForm.username.trim().toLowerCase(),
        password: editForm.password,
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

  return (
    <>
      <Toast message={toast} type="success" onDone={() => setToast('')} />
      <Confirm open={!!confirm} title="Xác nhận xoá" message={`Xoá tài khoản "${confirm?.username}"? Thao tác không thể hoàn tác.`}
        danger loading={isRemoving}
        onConfirm={async () => {
          if (!confirm?.id || isRemoving) return;
          setIsRemoving(true);
          await remove(confirm.id);
        }}
        onCancel={() => { if (!isRemoving) setConfirm(null); }} />
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
          <Input label="Tên đăng nhập" placeholder="sinhvien01" value={editForm.username} onChange={ef('username')} />
        </div>
        <div className="form-grid-2">
          <Input label="Email" placeholder="abc@sv.edu.vn" value={editForm.email} onChange={ef('email')} />
          <Input label="Mật khẩu" type="text" placeholder="Ít nhất 6 ký tự" value={editForm.password} onChange={ef('password')} />
        </div>
        <Select
          label="Phân quyền"
          value={editForm.role}
          onChange={ef('role')}
          options={[{ value: 'user', label: 'Người dùng' }, { value: 'admin', label: 'Quản trị viên' }]}
        />
      </Modal>

      <Modal
        open={accessModal}
        title={`Khóa truy cập theo user: @${accessTarget?.username || ''}`}
        onClose={() => { if (!accessLoading) setAccessModal(false); }}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAccessModal(false)} disabled={accessLoading}>Huỷ</Button>
            <Button variant="primary" onClick={saveAccessLocks} loading={accessLoading}>Lưu khóa truy cập</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {[
            { key: 'faculties', title: 'Ngành học' },
            { key: 'years', title: 'Năm học' },
            { key: 'semesters', title: 'Học kỳ' },
            { key: 'subjects', title: 'Môn học' },
            { key: 'lessons', title: 'Bài học' },
          ].map((section) => {
            const options = accessOptions?.[section.key] || [];
            return (
              <div key={section.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  {section.title} ({Array.isArray(accessForm?.[section.key]) ? accessForm[section.key].length : 0} khóa)
                </div>
                {options.length === 0 ? (
                  <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Không có dữ liệu</div>
                ) : (
                  <div style={{ display: 'grid', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {options.map((opt) => {
                      const checked = (accessForm?.[section.key] || []).includes(opt.id);
                      return (
                        <label key={`${section.key}-${opt.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.84rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleAccessLockItem(section.key, opt.id)} />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
            <thead><tr><th>Tài khoản</th><th>Thông tin</th><th>Mật khẩu</th><th>Vai trò</th><th>Trạng thái</th><th>Khóa riêng</th><th>Kết quả</th><th>Thao tác</th></tr></thead>
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
                    {showPasswords ? (u.plainPassword || 'Chưa có mật khẩu hiển thị') : '••••••••'}
                  </td>
                  <td><Badge color={u.role === 'admin' ? 'orange' : 'blue'}>{u.role || 'user'}</Badge></td>
                  <td><Badge color={u.isBlocked ? 'red' : 'green'}>{u.isBlocked ? 'Bị khoá' : 'Hoạt động'}</Badge></td>
                  <td>
                    <Badge color={countUserLocks(u.accessLocks) > 0 ? 'orange' : 'green'}>
                      {countUserLocks(u.accessLocks) > 0 ? `${countUserLocks(u.accessLocks)} mục khóa` : 'Không khóa'}
                    </Badge>
                  </td>
                  <td style={{ fontSize: '.8rem', color: 'var(--text-2)' }}>
                    <div>Lượt làm: {Array.isArray(u.attempts) ? u.attempts.length : 0}</div>
                  </td>
                  <td>
                    <div className="td-actions">
                      <Button variant="ghost" size="sm" onClick={() => openAccessLocks(u)}>Khóa truy cập</Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Sửa</Button>
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const openAdd = () => {
    setEditing(null);
    const base = Object.fromEntries(fields.map((f) => [f.key, '']));
    const defaults = typeof createDefaults === 'function' ? createDefaults(base) : (createDefaults || {});
    setForm({ ...base, ...defaults });
    setModal(true);
  };

  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setModal(true); };
  const visibleFields = Array.isArray(tableFields) && tableFields.length ? tableFields : fields.slice(0, 3);
  const selectedSet = new Set(selectedIds.map((id) => String(id)));

  useEffect(() => {
    const validIdSet = new Set((items || []).map((item) => String(item.id)));
    setSelectedIds((prev) => prev.map((id) => String(id)).filter((id) => validIdSet.has(id)));
  }, [items]);

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;
  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? items.map((item) => String(item.id)) : []);
  };

  const toggleItemSelection = (id, checked) => {
    const key = String(id);
    setSelectedIds((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((item) => item !== key);
    });
  };

  const runBulkDelete = async () => {
    const ids = selectedIds.map((id) => String(id));
    if (!ids.length) return;

    const results = await Promise.allSettled(ids.map((id) => onRemove(id)));
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failCount = results.length - successCount;

    if (failCount > 0) {
      setToast(`Đã xoá ${successCount} mục, lỗi ${failCount} mục.`);
    } else {
      setToast(`Đã xoá ${successCount} mục đã chọn.`);
    }
    setSelectedIds([]);
  };

  const runBulkLockToggle = async (nextLocked) => {
    if (!onToggleLock) return;
    const ids = selectedIds.map((id) => String(id));
    if (!ids.length) return;

    const results = await Promise.allSettled(ids.map((id) => onToggleLock(id, nextLocked)));
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failCount = results.length - successCount;

    const actionLabel = nextLocked ? 'khóa' : 'mở khóa';
    if (failCount > 0) {
      setToast(`Đã ${actionLabel} ${successCount} mục, lỗi ${failCount} mục.`);
    } else {
      setToast(`Đã ${actionLabel} ${successCount} mục đã chọn.`);
    }
  };

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
    if (missing.length) {
      const labels = missing.map((item) => item.label).join(', ');
      setToast(`Vui lòng nhập/chọn: ${labels}.`);
      return;
    }
    try {
      setIsSaving(true);
      if (editing) { await onUpdate(editing.id, form); setToast('Đã cập nhật!'); }
      else { await onAdd(form); setToast('Đã thêm mới!'); }
      setModal(false);
    } catch (error) {
      setToast(error?.message || 'Không thể lưu dữ liệu lên server.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Toast message={toast} type="success" onDone={() => setToast('')} />
      <Confirm open={!!confirm} title={`Xoá ${title.toLowerCase()}`}
        message={confirm?.bulk ? `Xác nhận xoá ${selectedIds.length} mục đã chọn?` : `Xác nhận xoá "${confirm?.name}"?`}
        loading={isConfirming}
        onConfirm={async () => {
          if (isConfirming) return;
          try {
            setIsConfirming(true);
            if (confirm?.bulk) {
              await runBulkDelete();
            } else {
              await onRemove(confirm.id);
              setToast('Đã xoá!');
            }
          } catch (error) {
            setToast(error?.message || 'Không thể xoá dữ liệu trên server.');
          } finally {
            setConfirm(null);
            setIsConfirming(false);
          }
        }}
        onCancel={() => { if (!isConfirming) setConfirm(null); }} />
      <Modal open={modal} title={editing ? `Sửa ${title}` : `Thêm ${title}`} onClose={() => setModal(false)}
        footer={<><Button variant="ghost" onClick={() => setModal(false)} disabled={isSaving}>Huỷ</Button><Button variant="primary" onClick={save} loading={isSaving} disabled={isSaving}>Lưu</Button></>}>
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
            <div key={f.key}>
              <Input label={f.label + (f.required ? ' *' : '')}
                placeholder={f.placeholder} value={form[f.key] || ''}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              {Array.isArray(f.quickOptions) && f.quickOptions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {f.quickOptions.map((opt) => {
                    const active = String(form[f.key] || '') === String(opt);
                    return (
                      <Button
                        key={`${f.key}-${opt}`}
                        variant={active ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setForm((p) => ({ ...p, [f.key]: opt }))}
                      >
                        {opt}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )
        ))}
      </Modal>
      <div className="table-wrap">
        <div className="table-header">
          <div>
            <div className="table-title">{icon} {title}</div>
            <div style={{ marginTop: 6, fontSize: '.8rem', color: 'var(--muted)' }}>
              Đã chọn: {selectedIds.length}/{items.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onToggleLock && (
              <>
                <Button variant="ghost" size="sm" onClick={() => runBulkLockToggle(true)} disabled={!selectedIds.length}>Khóa đã chọn</Button>
                <Button variant="ghost" size="sm" onClick={() => runBulkLockToggle(false)} disabled={!selectedIds.length}>Mở khóa đã chọn</Button>
              </>
            )}
            <Button variant="danger" size="sm" onClick={() => setConfirm({ bulk: true })} disabled={!selectedIds.length}>Xóa đã chọn</Button>
            <Button variant="primary" size="sm" icon="+" onClick={openAdd}>Thêm mới</Button>
          </div>
        </div>
        {items.length === 0 ? <EmptyState icon={icon} text={`Chưa có ${title.toLowerCase()} nào`} /> : (
          <table className="data-table">
            <thead><tr>
              <th>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  aria-label={`Chọn tất cả ${title.toLowerCase()}`}
                />
              </th>
              <th>#</th>{visibleFields.map(f => <th key={f.key}>{f.label}</th>)}{showLockColumn && <th>Trạng thái</th>}<th>Thao tác</th>
            </tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(String(item.id))}
                      onChange={(e) => toggleItemSelection(item.id, e.target.checked)}
                      aria-label={`Chọn ${title.toLowerCase()} ${i + 1}`}
                    />
                  </td>
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
    {
      key: 'name',
      label: 'Tên bài học',
      required: true,
      type: 'select',
      options: [
        { value: 'Bài 1', label: 'Bài 1' },
        { value: 'Bài 2', label: 'Bài 2' },
        { value: 'Bài 3', label: 'Bài 3' },
        { value: 'Bài 4', label: 'Bài 4' },
        { value: 'Bài 5', label: 'Bài 5' },
        { value: 'Bài 6', label: 'Bài 6' },
        { value: 'Bài 7', label: 'Bài 7' },
        { value: 'Bài 8', label: 'Bài 8' },
        { value: 'Bài 9', label: 'Bài 9' },
      ],
    },
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
    {
      key: 'order',
      label: 'Thứ tự bài',
      type: 'select',
      options: [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' },
        { value: '5', label: '5' },
        { value: '6', label: '6' },
        { value: '7', label: '7' },
        { value: '8', label: '8' },
        { value: '9', label: '9' },
      ],
    },
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

  const fields = [
    {
      key: 'name',
      label: 'Tên năm học',
      required: true,
      type: 'select',
      options: [
        { value: 'Năm 1', label: 'Năm 1' },
        { value: 'Năm 2', label: 'Năm 2' },
        { value: 'Năm 3', label: 'Năm 3' },
        { value: 'Năm 4', label: 'Năm 4' },
      ],
    },
    {
      key: 'facultyId',
      label: 'Ngành học',
      required: true,
      type: 'select',
      options: facultyOptions.map((f) => ({ value: f.id, label: f.name })),
      render: (item) => (data.faculties || []).find((f) => String(f.id) === String(item.facultyId || ''))?.name || item.facultyId,
    },
  ];

  const createDefaults = () => ({
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
          label="Lọc theo ngành học"
          value={facultyId}
          onChange={(e) => setFacultyId(e.target.value)}
          options={[{ value: '', label: 'Tất cả ngành học' }, ...(data.faculties || []).map((f) => ({ value: f.id, label: f.name }))]}
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

  const fields = [
    {
      key: 'name',
      label: 'Tên học kỳ',
      required: true,
      type: 'select',
      options: [
        { value: 'Học kỳ 1', label: 'Học kỳ 1' },
        { value: 'Học kỳ 2', label: 'Học kỳ 2' },
        { value: 'Học kỳ 3', label: 'Học kỳ 3' },
      ],
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
          label="Lọc theo ngành học"
          value={facultyId}
          onChange={(e) => { setFacultyId(e.target.value); setYearId(''); }}
          options={[{ value: '', label: 'Tất cả ngành học' }, ...(data.faculties || []).map((f) => ({ value: f.id, label: f.name }))]}
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
        onToggleLock={(id, locked) => semestersCrud.update(id, { locked })}
        showLockColumn
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
      label: 'Ngành học',
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
          label="Lọc theo ngành học"
          value={facultyId}
          onChange={(e) => { setFacultyId(e.target.value); setYearId(''); setSemesterId(''); }}
          options={[{ value: '', label: 'Tất cả ngành học' }, ...(data.faculties || []).map((f) => ({ value: f.id, label: f.name }))]}
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
        title="Môn học (có thể di chuyển ngành/năm/kỳ)"
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
      <div style={{ marginTop: 8, color: 'var(--color-muted)' }}>
        Mẹo: bấm "Sửa" trên từng môn để đổi Ngành học, Năm học hoặc Học kỳ và di chuyển môn sang vị trí mới.
      </div>
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
function QuestionsPanel({ data, questionsCrud, lessonsCrud, syncFromServer, filterSubjectId, setFilterSubjectId, filterLessonId, setFilterLessonId, onlySelectedSubject, setOnlySelectedSubject }) {
  const IMPORT_MAX_FILE_BYTES = 100 * 1024 * 1024;
  const DRAG_TEMPLATE_SORT = 'sort_words';
  const DRAG_TEMPLATE_MATCH = 'match_words';
  const isDragType = (type) => type === 'drag';
  const isMatchType = (type) => type === 'match';
  const normalizeQuestionType = (type) => {
    const raw = String(type || '').trim().toLowerCase();
    if (raw === 'drag' || raw === 'drag_drop') return 'drag';
    if (raw === 'arrange' || raw === 'arrange_words') return 'match';
    if (raw === 'match_words') return 'match';
    return raw || 'single';
  };

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
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [onlyDuplicateQuestions, setOnlyDuplicateQuestions] = useState(false);
  const [bulkLessonId, setBulkLessonId] = useState('');
  const [importLessonId, setImportLessonId] = useState('');
  const [importMode, setImportMode] = useState('single');
  const [importSubjectId, setImportSubjectId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importSkipLogs, setImportSkipLogs] = useState([]);
  const [requireFullImport, setRequireFullImport] = useState(true);
  const [questionImageFileName, setQuestionImageFileName] = useState('');
  const [answerImageFileNames, setAnswerImageFileNames] = useState({});
  const [imagePreview, setImagePreview] = useState({ url: '', title: 'Xem hình ảnh câu hỏi' });
  const [opProgress, setOpProgress] = useState({ active: false, label: '', current: 0, total: 0 });
  // filterSubjectId, setFilterSubjectId, filterLessonId, setFilterLessonId, onlySelectedSubject, setOnlySelectedSubject → lifted to AdminDashboard
  const [form, setForm] = useState({
    lessonId: '',
    type: 'single',
    dragLayout: 'position',
    text: '',
    answerSentence: '',
    imageUrl: '',
    answers: makeDefaultByType('single'),
    dragItems: [
      { id: 'item-1', label: '' },
      { id: 'item-2', label: '' },
    ],
    dropTargets: [
      { id: 'slot-1', prompt: '', label: 'Vị trí 1', correctItemId: '', correctItemIds: [] },
      { id: 'slot-2', prompt: '', label: 'Vị trí 2', correctItemId: '', correctItemIds: [] },
    ],
  });

  useEffect(() => {
    if (!filterSubjectId && data.subjects?.length) setFilterSubjectId(String(data.subjects[0].id));
  }, [data.subjects, filterSubjectId]);

  const lessonOptions = (onlySelectedSubject && filterSubjectId)
    ? (data.lessons || []).filter((lesson) => String(lesson.subjectId) === String(filterSubjectId))
    : (data.lessons || []);

  const scopedQuestionList = (data.questions || []).filter((q) => {
    if (filterLessonId && String(q.lessonId) !== String(filterLessonId)) return false;
    if (onlySelectedSubject && filterSubjectId) {
      const lesson = (data.lessons || []).find((item) => String(item.id) === String(q.lessonId));
      if (!lesson || String(lesson.subjectId) !== String(filterSubjectId)) return false;
    }
    return true;
  });

  const buildDuplicateKey = (question) => {
    const text = String(question?.text || question?.question || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return text;
  };

  const duplicateCountByKey = scopedQuestionList.reduce((acc, item) => {
    const key = buildDuplicateKey(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const duplicateGroups = scopedQuestionList.reduce((acc, item) => {
    const key = buildDuplicateKey(item);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const compareQuestionById = (a, b) => {
    const aNum = Number(a?.id);
    const bNum = Number(b?.id);
    const aValid = Number.isFinite(aNum);
    const bValid = Number.isFinite(bNum);
    if (aValid && bValid && aNum !== bNum) return aNum - bNum;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  };

  const duplicateDeleteIds = Object.values(duplicateGroups).flatMap((group) => {
    if (!Array.isArray(group) || group.length <= 1) return [];
    const sorted = [...group].sort(compareQuestionById);
    return sorted.slice(1).map((item) => String(item.id));
  });

  const duplicateGroupCount = Object.values(duplicateGroups).filter((group) => Array.isArray(group) && group.length > 1).length;

  const duplicateQuestionTotal = scopedQuestionList.filter((item) => (duplicateCountByKey[buildDuplicateKey(item)] || 0) > 1).length;

  const questionList = onlyDuplicateQuestions
    ? scopedQuestionList.filter((item) => (duplicateCountByKey[buildDuplicateKey(item)] || 0) > 1)
    : scopedQuestionList;

  const questionSelectedSet = new Set(selectedQuestionIds.map((id) => String(id)));
  const allVisibleQuestionIds = questionList.map((q) => String(q.id));
  const allVisibleSelected = allVisibleQuestionIds.length > 0 && allVisibleQuestionIds.every((id) => questionSelectedSet.has(id));

  useEffect(() => {
    const validIdSet = new Set((data.questions || []).map((item) => String(item.id)));
    setSelectedQuestionIds((prev) => prev.map((id) => String(id)).filter((id) => validIdSet.has(id)));
  }, [data.questions]);

  useEffect(() => {
    if (!bulkLessonId && filterLessonId) {
      setBulkLessonId(String(filterLessonId));
    }
  }, [bulkLessonId, filterLessonId]);

  useEffect(() => {
    if (!filterLessonId) return;
    const exists = lessonOptions.some((lesson) => String(lesson.id) === String(filterLessonId));
    if (!exists) setFilterLessonId('');
  }, [filterLessonId, lessonOptions]);

  const toggleSelectAllVisibleQuestions = (checked) => {
    if (!checked) {
      setSelectedQuestionIds((prev) => prev.filter((id) => !allVisibleQuestionIds.includes(String(id))));
      return;
    }
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev.map((id) => String(id)));
      allVisibleQuestionIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const toggleQuestionSelection = (questionId, checked) => {
    const key = String(questionId);
    setSelectedQuestionIds((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((id) => id !== key);
    });
  };

  const runBulkDeleteQuestions = async () => {
    const ids = selectedQuestionIds.map((id) => String(id));
    if (!ids.length) return;
    startOpProgress('Đang xoá câu hỏi...', ids.length);
    const results = await Promise.allSettled(ids.map((id) => questionsCrud.remove(id)));
    doneOpProgress('Đã hoàn tất xoá câu hỏi');
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    if (failCount > 0) {
      setToast(`Đã xoá ${successCount} câu, lỗi ${failCount} câu.`);
    } else {
      setToast(`Đã xoá ${successCount} câu hỏi đã chọn.`);
    }
    setSelectedQuestionIds([]);
  };

  const runDeleteDuplicateQuestionsKeepOne = async () => {
    const ids = duplicateDeleteIds.map((id) => String(id));
    if (!ids.length) {
      setToast('Không có câu trùng để xoá trong phạm vi lọc hiện tại.');
      return;
    }
    startOpProgress('Đang xoá câu trùng...', ids.length);
    const results = await Promise.allSettled(ids.map((id) => questionsCrud.remove(id)));
    doneOpProgress('Đã hoàn tất xoá câu trùng');
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    if (failCount > 0) {
      setToast(`Đã xoá ${successCount} câu trùng, lỗi ${failCount} câu.`);
    } else {
      setToast(`Đã xoá ${successCount} câu trùng và giữ lại 1 câu cho mỗi nhóm.`);
    }
    setSelectedQuestionIds((prev) => prev.filter((id) => !ids.includes(String(id))));
  };

  const runBulkUpdateLesson = async () => {
    const ids = selectedQuestionIds.map((id) => String(id));
    const nextLessonId = String(bulkLessonId || '');
    if (!ids.length || !nextLessonId) {
      setToast('Chọn câu hỏi và bài học đích trước khi cập nhật.');
      return;
    }

    const selectedQuestionMap = new Map((data.questions || []).map((q) => [String(q.id), q]));
    startOpProgress('Đang cập nhật bài học cho câu hỏi...', ids.length);
    const results = await Promise.allSettled(ids.map((id) => {
      const source = selectedQuestionMap.get(String(id));
      if (!source) {
        return Promise.reject(new Error('Question not found'));
      }
      return questionsCrud.update(id, {
        lessonId: nextLessonId,
        type: source.type,
        text: source.text || source.question || '',
        answerSentence: source.answerSentence || '',
        imageUrl: source.imageUrl || '',
        answers: source.answers,
        dragItems: source.dragItems || [],
        dropTargets: source.dropTargets || [],
      });
    }));
    doneOpProgress('Đã hoàn tất cập nhật bài học');

    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    if (failCount > 0) {
      setToast(`Đã cập nhật ${successCount} câu, lỗi ${failCount} câu.`);
    } else {
      setToast(`Đã cập nhật bài học cho ${successCount} câu hỏi.`);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setQuestionImageFileName('');
    setAnswerImageFileNames({});
    const defaultLessonId = filterLessonId || (lessonOptions.length === 1 ? String(lessonOptions[0].id) : '');
    setForm({
      lessonId: defaultLessonId,
      type: 'single',
      dragLayout: 'position',
      text: '',
      answerSentence: '',
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

  const openImportModal = () => {
    setImportMode('single');
    setImportLessonId(filterLessonId || (lessonOptions.length === 1 ? String(lessonOptions[0].id) : ''));
    setImportSubjectId(filterSubjectId || '');
    setRequireFullImport(true);
    setImportFileName('');
    setImportPreview(null);
    setImportSkipLogs([]);
    setImportModal(true);
  };

  const normalizeImportedQuestion = (question) => {
    const type = normalizeQuestionType(question?.type || 'single');
    const normalizedAnswers = (Array.isArray(question?.answers) ? question.answers : [])
      .map((answer, idx) => ({
        id: idx + 1,
        text: String(answer?.text || '').trim(),
        imageUrl: String(answer?.imageUrl || '').trim(),
        correct: Boolean(answer?.correct ?? answer?.isCorrect),
        order: Number(answer?.order || 0) || undefined,
      }));

    const providedDragItems = (Array.isArray(question?.dragItems) ? question.dragItems : [])
      .map((item, idx) => ({
        id: String(item?.id || `item-${idx + 1}`),
        label: String(item?.label || item?.text || '').trim(),
      }))
      .filter((item) => item.label);

    const dragItems = providedDragItems.length >= 2
      ? providedDragItems
      : normalizedAnswers
        .filter((answer) => String(answer?.text || '').trim())
        .map((answer, idx) => ({ id: `item-${idx + 1}`, label: String(answer.text || '').trim() }));

    const dragIdSet = new Set(dragItems.map((item) => item.id));
    const providedDropTargets = (Array.isArray(question?.dropTargets) ? question.dropTargets : [])
      .map((target, idx) => {
        const rawIds = Array.isArray(target?.correctItemIds) ? target.correctItemIds : (target?.correctItemId ? [target.correctItemId] : []);
        const validIds = rawIds.map((id) => String(id || '')).filter((id) => dragIdSet.has(id));
        return {
          id: String(target?.id || `slot-${idx + 1}`),
          prompt: String(target?.prompt || '').trim(),
          label: String(target?.label || `Vị trí ${idx + 1}`).trim(),
          correctItemId: validIds[0] || '',
          correctItemIds: validIds,
        };
      })
      .filter((target) => target.label);

    const dropTargets = providedDropTargets.length
      ? providedDropTargets
      : dragItems.map((item, idx) => ({
        id: `slot-${idx + 1}`,
        prompt: '',
        label: `Vị trí ${idx + 1}`,
        correctItemId: item.id,
        correctItemIds: [item.id],
      }));

    const answerSentence = String(question?.answerSentence || '').trim()
      || (type === 'match' ? dragItems.map((item) => item.label).join(' ').trim() : '');

    return {
      text: String(question?.text || '').trim(),
      type,
      answerSentence,
      imageUrl: String(question?.imageUrl || '').trim(),
      answers: normalizedAnswers,
      dragItems,
      dropTargets,
    };
  };

  const normalizeKeyText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const buildQuestionKey = (question) => {
    const type = String(question?.type || '').trim().toLowerCase();
    const text = normalizeKeyText(question?.text || question?.question || '');
    const answers = (Array.isArray(question?.answers) ? question.answers : [])
      .map((item) => `${normalizeKeyText(item?.text || '')}:${Boolean(item?.correct ?? item?.isCorrect) ? '1' : '0'}`)
      .join('|');
    const dragItems = (Array.isArray(question?.dragItems) ? question.dragItems : [])
      .map((item) => normalizeKeyText(item?.label || item?.text || ''))
      .join('|');
    const dropTargets = (Array.isArray(question?.dropTargets) ? question.dropTargets : [])
      .map((item) => normalizeKeyText(item?.label || ''))
      .join('|');

    return `${type}|${text}|${answers}|${dragItems}|${dropTargets}`;
  };

  const startOpProgress = (label, total = 1) => {
    setOpProgress({ active: true, label, current: 0, total: Math.max(1, Number(total) || 1) });
  };

  const stepOpProgress = (increment = 1) => {
    setOpProgress((prev) => ({
      ...prev,
      current: Math.min(Number(prev.current || 0) + Math.max(1, Number(increment) || 1), Number(prev.total || 1)),
    }));
  };

  const doneOpProgress = (label) => {
    setOpProgress((prev) => ({
      active: true,
      label: label || prev.label,
      current: Number(prev.total || 1),
      total: Number(prev.total || 1),
    }));
    window.setTimeout(() => {
      setOpProgress({ active: false, label: '', current: 0, total: 0 });
    }, 900);
  };

  const toSkipLog = ({ reason, lessonLabel, questionText, detail }) => ({
    reason,
    lessonLabel: lessonLabel || '',
    questionText: String(questionText || '').slice(0, 180),
    detail: detail || '',
  });

  const splitImportableQuestions = (questionsToImport, existingKeys, lessonLabel) => {
    const localKeys = new Set(existingKeys);
    const importable = [];
    const skipped = [];

    questionsToImport
      .map(normalizeImportedQuestion)
      .forEach((question) => {
        if (!question.text) {
          skipped.push(toSkipLog({ reason: 'Thiếu nội dung', lessonLabel, questionText: '', detail: 'Câu hỏi rỗng' }));
          return;
        }
        const key = buildQuestionKey(question);
        if (localKeys.has(key)) {
          skipped.push(toSkipLog({ reason: 'Trùng câu hỏi', lessonLabel, questionText: question.text, detail: 'Đã tồn tại trong bài học đích' }));
          return;
        }
        localKeys.add(key);
        importable.push(question);
      });

    return { importable, skipped };
  };

  const fileToBase64 = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const extractTextFromFile = async (file) => {
    const lowerName = String(file?.name || '').toLowerCase();

    if (lowerName.endsWith('.docx')) {
      const report = await parseDocxQuestionsWithReport(file);
      return {
        text: String(report?.sourceText || ''),
        parsedQuestions: report?.questions || [],
        invalidDetails: report?.invalidDetails || [],
        report,
      };
    }

    if (lowerName.endsWith('.pdf')) {
      const fileContentBase64 = await fileToBase64(file);
      const response = await adminDataAPI.extractDocumentText({
        fileName: file.name,
        fileContentBase64,
      });
      const text = String(response?.data?.text || '');
      const highlightedTexts = Array.isArray(response?.data?.highlightedTexts) ? response.data.highlightedTexts : [];
      const report = parseQuestionsFromTextWithReport(text, { highlightedAnswers: highlightedTexts });
      return {
        text,
        parsedQuestions: report.questions,
        invalidDetails: report.invalidDetails || [],
        highlightedTexts,
        report,
      };
    }

    if (lowerName.endsWith('.txt')) {
      const text = await file.text();
      const report = parseQuestionsFromTextWithReport(text);
      return {
        text,
        parsedQuestions: report.questions,
        invalidDetails: report.invalidDetails || [],
        report,
      };
    }

    throw new Error('Chỉ hỗ trợ file .docx, .pdf, .txt');
  };

  const findOrCreateLessonForAutoImport = async (subjectId, lessonNumber, lessonTitle) => {
    const normalizedSubjectId = String(subjectId || '');
    const normalizedNumber = Number(lessonNumber || 0);
    const titlePrefix = normalizedNumber > 0 ? `bài ${normalizedNumber}` : '';

    const existing = (data.lessons || []).find((lesson) => {
      if (String(lesson.subjectId) !== normalizedSubjectId) return false;
      if (normalizedNumber > 0 && Number(lesson.order || 0) === normalizedNumber) return true;
      if (!titlePrefix) return false;
      return String(lesson.name || '').toLowerCase().includes(titlePrefix);
    });
    if (existing) return { lesson: existing, created: false };

    const lessonName = normalizedNumber > 0
      ? (lessonTitle ? `Bài ${normalizedNumber}: ${lessonTitle}` : `Bài ${normalizedNumber}`)
      : (lessonTitle || `Bài ${Date.now()}`);

    const created = await lessonsCrud.add({
      subjectId: normalizedSubjectId,
      name: lessonName,
      order: normalizedNumber > 0 ? normalizedNumber : 0,
      desc: '',
    });
    return { lesson: created, created: true };
  };

  const findLessonForAutoImportPreview = (subjectId, lessonNumber, lessonTitle) => {
    const normalizedSubjectId = String(subjectId || '');
    const normalizedNumber = Number(lessonNumber || 0);
    const titlePrefix = normalizedNumber > 0 ? `bài ${normalizedNumber}` : '';

    return (data.lessons || []).find((lesson) => {
      if (String(lesson.subjectId) !== normalizedSubjectId) return false;
      if (normalizedNumber > 0 && Number(lesson.order || 0) === normalizedNumber) return true;
      if (!titlePrefix) return false;
      return String(lesson.name || '').toLowerCase().includes(titlePrefix)
        || (lessonTitle && String(lesson.name || '').toLowerCase().includes(String(lessonTitle).toLowerCase()));
    }) || null;
  };

  const normalizeInvalidLogs = (items, fallbackLessonLabel = '') => {
    return (Array.isArray(items) ? items : []).map((item) => {
      const lessonLabel = item?.lessonNumber
        ? `Bài ${item.lessonNumber}${item?.lessonTitle ? `: ${item.lessonTitle}` : ''}`
        : fallbackLessonLabel;
      return toSkipLog({
        reason: 'Sai định dạng',
        lessonLabel,
        questionText: item?.questionHead || item?.sample || '',
        detail: item?.message || item?.reason || 'Không parse được câu hỏi',
      });
    });
  };

  const prepareImportPreview = async (file) => {
    if (!file) return;
    if (Number(file.size || 0) > IMPORT_MAX_FILE_BYTES) {
      const maxMb = Math.floor(IMPORT_MAX_FILE_BYTES / (1024 * 1024));
      setToast(`File quá lớn. Vui lòng chọn file tối đa ${maxMb}MB.`);
      return;
    }
    setImportFileName(file.name || '');
    setImportPreview(null);
    setImportSkipLogs([]);

    if (importMode === 'single' && !importLessonId) {
      setToast('Vui lòng chọn bài học trước khi import.');
      return;
    }
    if (importMode === 'auto' && !importSubjectId) {
      setToast('Vui lòng chọn môn học để tự tạo bài học.');
      return;
    }

    try {
      setIsImporting(true);
      startOpProgress('Đang phân tích tài liệu...', 1);
      const extracted = await extractTextFromFile(file);
      doneOpProgress('Đã phân tích xong tài liệu');
      const allSkipLogs = [...normalizeInvalidLogs(extracted.invalidDetails)];
      const lessonPlans = [];

      if (importMode === 'single') {
        const lesson = (data.lessons || []).find((item) => String(item.id) === String(importLessonId));
        const lessonLabel = lesson?.name || `Lesson ${importLessonId}`;
        const existingKeys = new Set(
          (data.questions || [])
            .filter((q) => String(q.lessonId) === String(importLessonId))
            .map(buildQuestionKey)
        );
        const split = splitImportableQuestions(extracted.parsedQuestions, existingKeys, lessonLabel);
        allSkipLogs.push(...split.skipped);

        lessonPlans.push({
          subjectId: String(lesson?.subjectId || ''),
          lessonId: String(importLessonId),
          lessonLabel,
          willCreate: false,
          lessonNumber: null,
          lessonTitle: '',
          totalParsed: extracted.parsedQuestions.length,
          toImportCount: split.importable.length,
          questionsToImport: split.importable,
        });
      } else {
        const lessonReport = parseLessonsFromTextWithReport(extracted.text, { highlightedAnswers: extracted.highlightedTexts || [] });
        allSkipLogs.push(...normalizeInvalidLogs(lessonReport.invalidDetails));

        lessonReport.lessons.forEach((group) => {
          const existingLesson = findLessonForAutoImportPreview(importSubjectId, group.lessonNumber, group.title);
          const lessonLabel = existingLesson
            ? String(existingLesson.name || '')
            : `Bài ${group.lessonNumber || '?'}${group.title ? `: ${group.title}` : ''}`;

          const existingKeys = new Set(
            (data.questions || [])
              .filter((q) => existingLesson && String(q.lessonId) === String(existingLesson.id))
              .map(buildQuestionKey)
          );

          const split = splitImportableQuestions(group.questions, existingKeys, lessonLabel);
          allSkipLogs.push(...split.skipped);

          lessonPlans.push({
            subjectId: String(importSubjectId),
            lessonId: existingLesson ? String(existingLesson.id) : '',
            lessonLabel,
            willCreate: !existingLesson,
            lessonNumber: group.lessonNumber,
            lessonTitle: group.title,
            totalParsed: group.questions.length,
            toImportCount: split.importable.length,
            questionsToImport: split.importable,
          });
        });
      }

      const summary = lessonPlans.reduce((acc, item) => ({
        totalParsed: acc.totalParsed + Number(item.totalParsed || 0),
        toImport: acc.toImport + Number(item.toImportCount || 0),
        willCreateLessons: acc.willCreateLessons + (item.willCreate ? 1 : 0),
      }), { totalParsed: 0, toImport: 0, willCreateLessons: 0 });

      if (summary.totalParsed === 0) {
        setToast('Không đọc được câu hỏi từ file. Vui lòng kiểm tra định dạng Câu/Đáp án và tô màu đáp án đúng.');
      }

      const invalidFormatCount = allSkipLogs.filter((item) => item.reason === 'Sai định dạng').length;

      setImportSkipLogs(allSkipLogs);
      setImportPreview({
        mode: importMode,
        fileName: file.name || '',
        lessonPlans,
        summary: {
          ...summary,
          skipped: allSkipLogs.length,
          invalidFormatCount,
        },
      });
    } catch (error) {
      doneOpProgress('Phân tích tài liệu thất bại');
      setToast(`Không thể phân tích file: ${error?.response?.data?.message || error.message || 'Lỗi không xác định'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const runImportWithPreview = async () => {
    if (!importPreview) {
      setToast('Vui lòng chọn file để xem trước trước khi import.');
      return;
    }

    if (requireFullImport && Number(importPreview?.summary?.invalidFormatCount || 0) > 0) {
      setToast(`Tài liệu còn ${importPreview.summary.invalidFormatCount} câu sai định dạng. Hãy chuẩn hoá file hoặc tắt chế độ import nghiêm ngặt.`);
      return;
    }

    try {
      setIsImporting(true);
      const totalToImport = (importPreview.lessonPlans || []).reduce((sum, plan) => sum + Number(plan.questionsToImport?.length || 0), 0);
      startOpProgress('Đang import câu hỏi...', Math.max(1, totalToImport));
      let importedQuestions = 0;
      let createdLessons = 0;
      const runtimeSkipLogs = [];

      for (const plan of importPreview.lessonPlans) {
        let lessonId = plan.lessonId;

        if (!lessonId && plan.willCreate) {
          const { lesson } = await findOrCreateLessonForAutoImport(plan.subjectId, plan.lessonNumber, plan.lessonTitle);
          lessonId = String(lesson?.id || '');
          if (lessonId) createdLessons += 1;
        }

        if (!lessonId) {
          runtimeSkipLogs.push(toSkipLog({
            reason: 'Không xác định bài học',
            lessonLabel: plan.lessonLabel,
            questionText: '',
            detail: 'Không tìm thấy hoặc tạo được bài học đích',
          }));
          continue;
        }

        const chunkSize = 5;
        for (let i = 0; i < plan.questionsToImport.length; i += chunkSize) {
          const chunk = plan.questionsToImport.slice(i, i + chunkSize);
          const results = await Promise.allSettled(
            chunk.map((question) => questionsCrud.add({ ...question, lessonId }))
          );

          results.forEach((result, idx) => {
            const currentQuestion = chunk[idx];
            if (result.status === 'fulfilled') {
              importedQuestions += 1;
              stepOpProgress(1);
              return;
            }
            stepOpProgress(1);
            runtimeSkipLogs.push(toSkipLog({
              reason: 'Lỗi khi lưu',
              lessonLabel: plan.lessonLabel,
              questionText: currentQuestion?.text || '',
              detail: result.reason?.response?.data?.message || result.reason?.message || 'Không lưu được câu hỏi',
            }));
          });
        }
      }

      const totalSkipped = importSkipLogs.length + runtimeSkipLogs.length;
      setImportSkipLogs((prev) => [...prev, ...runtimeSkipLogs]);
      await syncFromServer?.();
      setToast(`Đã import ${importedQuestions} câu. Tạo mới ${createdLessons} bài. Bỏ qua ${totalSkipped} mục.`);
      doneOpProgress('Đã hoàn tất import câu hỏi');
      setImportModal(false);
      setImportPreview(null);
      setImportFileName('');
    } catch (error) {
      doneOpProgress('Import câu hỏi thất bại');
      setToast(`Import thất bại: ${error?.response?.data?.message || error.message || 'Không thể import dữ liệu'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportDocx = async (event) => {
    const file = event.target.files?.[0];
    await prepareImportPreview(file);
    event.target.value = '';
  };

  const onImportDrop = async (event) => {
    preventDropDefaults(event);
    const file = event.dataTransfer?.files?.[0];
    await prepareImportPreview(file);
  };

  const escapeCsvCell = (value) => {
    const text = String(value || '');
    if (/[,"\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const downloadTextFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSkipLogs = (format) => {
    if (!importSkipLogs.length) {
      setToast('Hiện chưa có log bỏ qua để export.');
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'csv') {
      const header = ['Reason', 'Lesson', 'Question', 'Detail'];
      const rows = importSkipLogs.map((item) => [
        item.reason || '',
        item.lessonLabel || '',
        item.questionText || '',
        item.detail || '',
      ]);
      const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
      downloadTextFile(csv, `import-skip-logs-${stamp}.csv`, 'text/csv;charset=utf-8');
      return;
    }

    const txt = importSkipLogs.map((item, idx) => (
      `${idx + 1}. [${item.reason || 'Unknown'}]\nBài: ${item.lessonLabel || 'Không xác định'}\nCâu: ${item.questionText || '(trống)'}\nLý do: ${item.detail || ''}\n`
    )).join('\n');
    downloadTextFile(txt, `import-skip-logs-${stamp}.txt`, 'text/plain;charset=utf-8');
  };

  const openEdit = (q) => {
    setEditing(q);
    setQuestionImageFileName('');
    setAnswerImageFileNames({});
    setForm({
      lessonId: q.lessonId,
      type: normalizeQuestionType(q.type || 'single'),
      dragLayout: (Array.isArray(q.dropTargets) && q.dropTargets.some((target) => String(target?.prompt || '').trim())) ? 'table' : 'position',
      text: q.text || q.question || '',
      answerSentence: q.answerSentence || '',
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
        { id: 'slot-1', prompt: '', label: 'Vị trí 1', correctItemId: '', correctItemIds: [] },
        { id: 'slot-2', prompt: '', label: 'Vị trí 2', correctItemId: '', correctItemIds: [] },
      ]).map((target, idx) => ({
        id: target.id || `slot-${idx + 1}`,
        prompt: target.prompt || '',
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
      dragLayout: nextType === 'drag' ? (prev.dragLayout || 'position') : 'position',
      answers: makeDefaultByType(nextType),
      answerSentence: (nextType === 'match') ? prev.answerSentence : '',
      dragItems: (nextType === 'match' || nextType === 'drag')
        ? [{ id: 'item-1', label: '' }, { id: 'item-2', label: '' }]
        : prev.dragItems,
      dropTargets: (nextType === 'match' || nextType === 'drag')
        ? [
          { id: 'slot-1', prompt: '', label: 'Vị trí 1', correctItemId: '', correctItemIds: [] },
          { id: 'slot-2', prompt: '', label: 'Vị trí 2', correctItemId: '', correctItemIds: [] },
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
      dropTargets: [...prev.dropTargets, { id: `slot-${Date.now()}`, prompt: '', label: `Vị trí ${prev.dropTargets.length + 1}`, correctItemId: '', correctItemIds: [] }],
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

  const applyDragTemplate = (templateId) => {
    if (templateId === DRAG_TEMPLATE_SORT) {
      const dragItems = [
        { id: 'item-1', label: 'Tôi' },
        { id: 'item-2', label: 'đi' },
        { id: 'item-3', label: 'học' },
      ];
      const dropTargets = [
        { id: 'slot-1', label: 'Vị trí 1', correctItemId: 'item-1', correctItemIds: ['item-1'] },
        { id: 'slot-2', label: 'Vị trí 2', correctItemId: 'item-2', correctItemIds: ['item-2'] },
        { id: 'slot-3', label: 'Vị trí 3', correctItemId: 'item-3', correctItemIds: ['item-3'] },
      ];

      setForm((prev) => ({
        ...prev,
        type: 'match',
        text: prev.text || 'Sắp xếp các từ sau thành câu đúng.',
        answerSentence: prev.answerSentence || 'Tôi đi học',
        dragItems,
        dropTargets,
      }));
      setToast('Đã áp dụng mẫu ghép câu.');
      return;
    }

    if (templateId === DRAG_TEMPLATE_MATCH) {
      const dragItems = [
        { id: 'item-1', label: 'Dog' },
        { id: 'item-2', label: 'Cat' },
        { id: 'item-3', label: 'Bird' },
      ];
      const dropTargets = [
        { id: 'slot-1', label: 'Con chó', correctItemId: 'item-1', correctItemIds: ['item-1'] },
        { id: 'slot-2', label: 'Con mèo', correctItemId: 'item-2', correctItemIds: ['item-2'] },
        { id: 'slot-3', label: 'Con chim', correctItemId: 'item-3', correctItemIds: ['item-3'] },
      ];

      setForm((prev) => ({
        ...prev,
        type: 'match',
        text: prev.text || 'Bấm vào các từ để ghép thành câu đúng.',
        answerSentence: prev.answerSentence || 'Dog Cat Bird',
        dragItems,
        dropTargets,
      }));
      setToast('Đã áp dụng mẫu: Nối từ.');
    }
  };

  const keepTextareaNewLine = (event) => {
    if (event.key === 'Enter' && !event.nativeEvent?.isComposing) {
      event.stopPropagation();
    }
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

    if (isMatchType(form.type) || isDragType(form.type)) {
      const answerSentence = String(form.answerSentence || '').replace(/\s+/g, ' ').trim();
      if (!isDragType(form.type) && !answerSentence) {
        setToast('Vui lòng nhập câu đáp án chuẩn cho dạng Sắp xếp/Nối từ.');
        return;
      }

      const dragItems = form.dragItems
        .map((item) => ({ ...item, id: String(item.id || '').trim(), label: String(item.label || '').trim() }))
        .filter((item) => item.label);
      let dropTargets = form.dropTargets
        .map((target) => ({
          ...target,
          prompt: String(target.prompt || '').trim(),
          label: String(target.label || '').trim(),
          correctItemIds: (Array.isArray(target.correctItemIds)
            ? target.correctItemIds
            : (target.correctItemId ? [target.correctItemId] : [])
          ).map((itemId) => String(itemId || '').trim()).filter(Boolean),
        }))
        .filter((target) => target.label || target.prompt);

      if (dragItems.length < 2) {
        setToast('Cần ít nhất 2 từ/mục để tạo câu dạng Sắp xếp hoặc Nối từ.');
        return;
      }

      if (isMatchType(form.type)) {
        // Match words keeps only the source words in correct order.
        dropTargets = [];
      }

      if (isDragType(form.type)) {
        const useTableLayout = form.dragLayout === 'table';
        if (!useTableLayout) {
          dropTargets = dropTargets.map((target) => ({
            ...target,
            prompt: '',
          }));
        }

        if (dropTargets.length < 1) {
          setToast('Dạng kéo thả cần ít nhất 1 ô đích.');
          return;
        }
        if (dropTargets.some((target) => target.correctItemIds.length < 1)) {
          setToast('Mỗi ô đích của dạng kéo thả cần ít nhất 1 đáp án đúng.');
          return;
        }
      }

      const payload = {
        lessonId: resolvedLessonId,
        type: isMatchType(form.type) ? 'match' : 'drag',
        text: form.text.trim(),
        answerSentence: isDragType(form.type) ? '' : answerSentence,
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
        startOpProgress(editing ? 'Đang cập nhật câu hỏi...' : 'Đang tạo câu hỏi...', 1);
        if (editing) {
          await questionsCrud.update(editing.id, payload);
          setToast('Đã cập nhật câu hỏi!');
        } else {
          await questionsCrud.add(payload);
          setToast('Đã lưu câu hỏi!');
        }
        doneOpProgress(editing ? 'Đã cập nhật câu hỏi' : 'Đã tạo câu hỏi');
        setModal(false);
      } catch (error) {
        doneOpProgress('Lưu câu hỏi thất bại');
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
      startOpProgress(editing ? 'Đang cập nhật câu hỏi...' : 'Đang tạo câu hỏi...', 1);
      if (editing) {
        await questionsCrud.update(editing.id, payload);
        setToast('Đã cập nhật câu hỏi!');
      } else {
        await questionsCrud.add(payload);
        setToast('Đã lưu câu hỏi!');
      }
      doneOpProgress(editing ? 'Đã cập nhật câu hỏi' : 'Đã tạo câu hỏi');
      setModal(false);
    } catch (error) {
      doneOpProgress('Lưu câu hỏi thất bại');
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
      <Confirm open={!!confirm} title="Xoá câu hỏi" message={confirm?.dedupe ? `Xác nhận xoá ${duplicateDeleteIds.length} câu trùng (giữ lại 1 câu mỗi nhóm)?` : (confirm?.bulk ? `Xác nhận xoá ${selectedQuestionIds.length} câu hỏi đã chọn?` : 'Xác nhận xoá câu hỏi này?')} danger
        onConfirm={async () => {
          if (confirm?.dedupe) {
            await runDeleteDuplicateQuestionsKeepOne();
          } else if (confirm?.bulk) {
            await runBulkDeleteQuestions();
          } else {
            startOpProgress('Đang xoá câu hỏi...', 1);
            await questionsCrud.remove(confirm?.id);
            doneOpProgress('Đã xoá câu hỏi');
            setToast('Đã xoá!');
          }
          setConfirm(null);
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
        title="Import câu hỏi từ tài liệu"
        onClose={() => setImportModal(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportModal(false)} disabled={isImporting}>Đóng</Button>
            <Button variant="primary" onClick={runImportWithPreview} disabled={!importPreview || isImporting} loading={isImporting}>Xác nhận import</Button>
          </>
        }
      >
        <Select
          label="Chế độ import"
          value={importMode}
          onChange={(e) => setImportMode(e.target.value)}
          options={[
            { value: 'single', label: 'Import vào một bài học đã chọn' },
            { value: 'auto', label: 'Tự tách Bài 1, Bài 2... và tự tạo bài học' },
          ]}
        />

        {importMode === 'single' ? (
          <Select
            label="Bài học để lưu câu hỏi *"
            value={importLessonId}
            onChange={(e) => setImportLessonId(e.target.value)}
            options={lessonOptions.map((lesson) => ({ value: lesson.id, label: lesson.name }))}
          />
        ) : (
          <Select
            label="Môn học để tạo bài tự động *"
            value={importSubjectId}
            onChange={(e) => setImportSubjectId(e.target.value)}
            options={(data.subjects || []).map((subject) => ({ value: subject.id, label: subject.name }))}
          />
        )}

        <div className="form-group">
          <label className="form-label">File tài liệu (.docx, .pdf, .txt)</label>
          <label className="upload-trigger" onDragOver={preventDropDefaults} onDrop={onImportDrop}>
            <input className="file-picker-input" type="file" accept=".docx,.pdf,.txt" disabled={isImporting} onChange={handleImportDocx} />
            <span>{isImporting ? 'Đang xử lý...' : 'Kéo thả hoặc chọn file để import'}</span>
          </label>
          <div className="file-picked-name">{importFileName || 'Chưa chọn file nào'}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
            Hỗ trợ định dạng như: "Câu 1:", "Question 1", "1)", "1." cùng đáp án kiểu "A.", "a)", "B)".
            Đáp án đúng có thể đánh dấu bằng * hoặc [x] hoặc (đúng). Ở chế độ tự tách, nên có tiêu đề "Bài 1", "Bài 2"...
          </div>
          <label style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.84rem', color: 'var(--text-2)' }}>
            <input
              type="checkbox"
              checked={requireFullImport}
              onChange={(e) => setRequireFullImport(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--blue)' }}
            />
            Import nghiêm ngặt: chặn import nếu còn câu sai định dạng (tránh thiếu câu)
          </label>
        </div>

        {importPreview && (
          <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Xem trước import</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Badge color="blue">File: {importPreview.fileName}</Badge>
              <Badge color="orange">Bài xử lý: {importPreview.lessonPlans.length}</Badge>
              <Badge color="success">Sẽ import: {importPreview.summary.toImport} câu</Badge>
              <Badge color="gray">Bỏ qua: {importPreview.summary.skipped}</Badge>
              <Badge color={importPreview.summary.invalidFormatCount > 0 ? 'red' : 'green'}>
                Sai định dạng: {importPreview.summary.invalidFormatCount || 0}
              </Badge>
              <Badge color="blue">Sẽ tạo bài mới: {importPreview.summary.willCreateLessons}</Badge>
            </div>

            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px dashed var(--border)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
              {(importPreview.lessonPlans || []).map((plan, idx) => (
                <div key={`plan-${idx}`} style={{ marginBottom: 6, fontSize: '.83rem' }}>
                  <strong>{plan.lessonLabel || `Bài ${idx + 1}`}</strong>
                  <span style={{ marginLeft: 6, color: 'var(--muted)' }}>
                    parsed: {plan.totalParsed} • import: {plan.toImportCount} {plan.willCreate ? '• sẽ tạo mới' : '• đã tồn tại'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>Log bỏ qua chi tiết</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="ghost" size="sm" onClick={() => exportSkipLogs('csv')} disabled={!importSkipLogs.length}>Export CSV</Button>
                <Button variant="ghost" size="sm" onClick={() => exportSkipLogs('txt')} disabled={!importSkipLogs.length}>Export TXT</Button>
              </div>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px dashed var(--border)', borderRadius: 8, padding: 8 }}>
              {importSkipLogs.length === 0 ? (
                <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Không có mục bị bỏ qua trong bước phân tích.</div>
              ) : (
                importSkipLogs.map((log, idx) => (
                  <div key={`skip-${idx}`} style={{ marginBottom: 8, fontSize: '.8rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--danger)' }}>[{log.reason}] {log.lessonLabel || 'Không xác định bài'}</div>
                    {log.questionText ? <div style={{ color: 'var(--text-2)' }}>Câu: {log.questionText}</div> : null}
                    {log.detail ? <div style={{ color: 'var(--muted)' }}>Lý do: {log.detail}</div> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal} title={editing ? 'Sửa câu hỏi' : 'Thêm câu hỏi'} onClose={() => setModal(false)} closeOnOverlay={false}
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Huỷ</Button><Button variant="primary" onClick={saveQuestion}>Lưu</Button></>}>
        <Select label="Bài học *" value={form.lessonId} onChange={e => setForm(f => ({ ...f, lessonId: e.target.value }))}
          options={lessonOptions.map(l => ({ value: l.id, label: l.name }))} />
        <Select label="Loại câu hỏi *" value={form.type} onChange={e => onTypeChange(e.target.value)}
          options={[{value:'single',label:'Một đáp án'},{value:'multiple',label:'Nhiều đáp án'},{value:'truefalse',label:'Đúng / Sai'},{value:'fill',label:'Điền vào chỗ trống'},{value:'drag',label:'Kéo thả'},{value:'match',label:'Nối/Sắp xếp từ'}]} />
        <Textarea label="Nội dung câu hỏi *" placeholder="Nhập câu hỏi..." rows={6} value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} onKeyDown={keepTextareaNewLine} />
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
        {!isMatchType(form.type) && !isDragType(form.type) && form.type !== 'truefalse' && (
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
                    onKeyDown={keepTextareaNewLine}
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
                  onKeyDown={keepTextareaNewLine}
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

        {(isMatchType(form.type) || isDragType(form.type)) && (
          <div style={{ display: 'grid', gap: 12 }}>
            {!isDragType(form.type) && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 10, background: 'var(--bg)' }}>
              <div style={{ fontSize: '.84rem', fontWeight: 600, marginBottom: 8 }}>Mẫu nhanh cho dạng Sắp xếp / Nối từ</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="ghost" size="sm" onClick={() => applyDragTemplate(DRAG_TEMPLATE_SORT)}>Áp dụng mẫu Sắp xếp từ</Button>
                <Button variant="ghost" size="sm" onClick={() => applyDragTemplate(DRAG_TEMPLATE_MATCH)}>Áp dụng mẫu Nối từ</Button>
              </div>
              <div style={{ marginTop: 6, fontSize: '.78rem', color: 'var(--muted)' }}>
                Sau khi áp dụng mẫu, bạn có thể sửa lại nội dung câu hỏi và danh sách từ theo đề thực tế.
              </div>
            </div>
            )}

            <div>
              <label className="form-label">{isMatchType(form.type) ? 'Các từ để nối/sắp xếp' : 'Các mục để kéo'}</label>
              {form.dragItems.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    className="form-input"
                    placeholder={isDragType(form.type) ? `Mục kéo ${idx + 1}` : `Từ ${idx + 1}`}
                    value={item.label}
                    onChange={(e) => setDragItem(item.id, e.target.value)}
                  />
                  {form.dragItems.length > 2 && (
                    <button onClick={() => removeDragItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem' }}>×</button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addDragItem}>{isDragType(form.type) ? '+ Thêm mục kéo' : '+ Thêm từ để nối/sắp xếp'}</Button>
            </div>

            {isDragType(form.type) && (
            <div>
              <Select
                label="Kiểu kéo thả"
                value={form.dragLayout || 'position'}
                onChange={(e) => setForm((prev) => ({ ...prev, dragLayout: e.target.value }))}
                options={[
                  { value: 'position', label: 'Theo vị trí' },
                  { value: 'table', label: 'Theo bảng (2 cột)' },
                ]}
              />
              <label className="form-label">Bảng kéo thả (cột trái phát biểu, cột phải đáp án kéo vào)</label>
              {form.dropTargets.map((target, idx) => (
                <div key={target.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                  {(form.dragLayout || 'position') === 'table' && (
                    <Textarea
                      label={`Phát biểu dòng ${idx + 1}`}
                      rows={3}
                      placeholder="Nhập phát biểu ở cột trái..."
                      value={target.prompt || ''}
                      onChange={(e) => setDropTarget(target.id, 'prompt', e.target.value)}
                      onKeyDown={keepTextareaNewLine}
                      style={{ gridColumn: '1 / -1' }}
                    />
                  )}
                  {(form.dragLayout || 'position') !== 'table' ? (
                    <input
                      className="form-input"
                      placeholder={`Tên vị trí ${idx + 1}`}
                      value={target.label}
                      onChange={(e) => setDropTarget(target.id, 'label', e.target.value)}
                    />
                  ) : (
                    <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Ô đáp án cột phải sẽ tự tạo theo từng dòng.</div>
                  )}
                  {form.dropTargets.length > 1 && (
                    <button onClick={() => removeDropTarget(target.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem' }}>×</button>
                  )}
                  <div style={{ gridColumn: '1 / -1', border: '1px dashed var(--border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: '.8rem', marginBottom: 6, color: 'var(--text-2)' }}>Chọn đáp án đúng cho ô này:</div>
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
                                ? [...new Set([...selectedIds, item.id])]
                                : selectedIds.filter((id) => id !== item.id);
                              setDropTarget(target.id, 'correctItemIds', next);
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
                {(form.dragLayout || 'position') === 'table'
                  ? 'Theo bảng: nhập phát biểu cột trái và kéo đáp án vào cột phải.'
                  : 'Theo vị trí: chỉ cần tên vị trí và kéo đáp án vào từng ô.'}
              </div>
            </div>
            )}

            {!isDragType(form.type) && (
            <Textarea
              label="Câu đáp án chuẩn *"
              placeholder="Ví dụ: A wireless hotspot is a location that provides internet access without using cables."
              rows={3}
              value={form.answerSentence || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, answerSentence: e.target.value }))}
              onKeyDown={keepTextareaNewLine}
            />
            )}

            {isMatchType(form.type) && (
            <div>
              <div style={{ marginTop: 6, fontSize: '.78rem', color: 'var(--muted)' }}>
                User sẽ bấm từng từ ở danh sách để ghép xuống vùng đáp án theo đúng thứ tự câu.
              </div>
            </div>
            )}
          </div>
        )}
      </Modal>
      <div className="table-wrap">
        <div className="table-header">
          <div>
            <div className="table-title">❓ Câu hỏi</div>
            <div style={{ marginTop: 6, fontSize: '.8rem', color: 'var(--muted)' }}>
              Đã chọn: {selectedQuestionIds.length} câu
            </div>
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
            <label style={{ marginTop: 6, marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.84rem', color: 'var(--text-2)' }}>
              <input
                type="checkbox"
                checked={onlyDuplicateQuestions}
                onChange={(e) => setOnlyDuplicateQuestions(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--orange)' }}
              />
              Chỉ hiện câu trùng
            </label>
            <div style={{ marginTop: 6, fontSize: '.8rem', color: 'var(--muted)' }}>
              Câu trùng trong phạm vi lọc hiện tại: {duplicateQuestionTotal}
            </div>
            <div style={{ marginTop: 2, fontSize: '.78rem', color: 'var(--muted)' }}>
              Nhóm trùng: {duplicateGroupCount} | Có thể xoá: {duplicateDeleteIds.length} (giữ 1 mỗi nhóm)
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 620 }}>
              <Select
                label="Cập nhật bài cho mục đã chọn"
                value={bulkLessonId}
                onChange={(e) => setBulkLessonId(e.target.value)}
                options={[{ value: '', label: 'Chọn bài học đích' }, ...lessonOptions.map((l) => ({ value: l.id, label: l.name }))]}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <Button variant="ghost" size="sm" onClick={runBulkUpdateLesson} disabled={!selectedQuestionIds.length || !bulkLessonId}>Cập nhật bài đã chọn</Button>
                <Button variant="danger" size="sm" onClick={() => setConfirm({ bulk: true })} disabled={!selectedQuestionIds.length}>Xoá đã chọn</Button>
                <Button variant="danger" size="sm" onClick={() => setConfirm({ dedupe: true })} disabled={!duplicateDeleteIds.length}>Xoá câu trùng (giữ 1)</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedQuestionIds([])} disabled={!selectedQuestionIds.length}>Bỏ chọn</Button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" icon="⬆" onClick={openImportModal}>Import tài liệu</Button>
            <Button variant="primary" size="sm" icon="+" onClick={openAdd}>Thêm câu hỏi</Button>
          </div>
        </div>
        {opProgress.active && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <div className="progress-label" style={{ marginBottom: 6 }}>
              {opProgress.label} ({Math.min(opProgress.current, opProgress.total)}/{opProgress.total})
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.round((Math.min(opProgress.current, opProgress.total) / Math.max(1, opProgress.total)) * 100)}%` }} />
            </div>
          </div>
        )}
        {questionList.length === 0 ? <EmptyState icon="❓" text="Chưa có câu hỏi" /> : (
          <table className="data-table">
            <thead><tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleSelectAllVisibleQuestions(e.target.checked)}
                  aria-label="Chọn tất cả câu hỏi đang hiển thị"
                />
              </th>
              <th>#</th><th>Nội dung</th><th>Loại</th><th>Ảnh</th><th>Bài học</th><th>Thao tác</th>
            </tr></thead>
            <tbody>
              {questionList.map((q, i) => (
                <tr key={q.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={questionSelectedSet.has(String(q.id))}
                      onChange={(e) => toggleQuestionSelection(q.id, e.target.checked)}
                      aria-label={`Chọn câu hỏi ${i + 1}`}
                    />
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ maxWidth: 260 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.text || q.question}</div>
                    {(duplicateCountByKey[buildDuplicateKey(q)] || 0) > 1 && (
                      <div style={{ marginTop: 4 }}><Badge color="red">Trùng x{duplicateCountByKey[buildDuplicateKey(q)]}</Badge></div>
                    )}
                  </td>
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
  { id: 'faculties', icon: '🏛️', label: 'Ngành học' },
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
      case 'faculties': return <CrudTable title="Ngành học" icon="🏛️" items={data.faculties}
        fields={[{key:'icon',label:'Icon',placeholder:'💻'},{key:'name',label:'Tên ngành học',required:true,placeholder:'Công nghệ Thông tin'},{key:'desc',label:'Mô tả',placeholder:'Số môn học...'}]}
        onAdd={faculties.add} onUpdate={faculties.update} onRemove={faculties.remove} onToggleLock={(id, locked) => faculties.update(id, { locked })} showLockColumn />;
      case 'years': return <YearsPanel data={data} yearsCrud={years} />;
      case 'semesters': return <SemestersPanel data={data} semestersCrud={semesters} />;
      case 'subjects': return <SubjectsPanel data={data} subjectsCrud={subjects} />;
      case 'lessons': return <LessonsPanel data={data} lessonsCrud={lessons}
        subjectId={lessonsSubjectId} setSubjectId={setLessonsSubjectId}
        onlySelectedSubject={lessonsOnlySelected} setOnlySelectedSubject={setLessonsOnlySelected} />;
      case 'questions': return <QuestionsPanel data={data} questionsCrud={questions} lessonsCrud={lessons} syncFromServer={syncFromServer}
        filterSubjectId={qFilterSubjectId} setFilterSubjectId={setQFilterSubjectId}
        filterLessonId={qFilterLessonId} setFilterLessonId={setQFilterLessonId}
        onlySelectedSubject={qOnlySelected} setOnlySelectedSubject={setQOnlySelected} />;
      default: return null;
    }
  };

  return (
    <div className="app-wrapper">
      <Navbar />
      <div className="main-layout admin-main-layout">
        <aside className="admin-nav-shell">
          <div className="admin-nav-head">
            <div className="admin-nav-title">Quản trị hệ thống</div>
            <div className="admin-nav-sub">QuizMaster Admin</div>
          </div>
          <div className="admin-nav-list">
            {SECTIONS.map(s => (
              <button key={s.id} className={`admin-nav-item${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="page-content admin-page-content">
          <div className="page-header admin-header">
            <div className="page-title">⚙️ Admin Dashboard</div>
            <div className="page-sub">Quản lý toàn bộ hệ thống QuizMaster</div>
          </div>
          <div className="admin-main">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}


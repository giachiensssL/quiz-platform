import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/UI";
import { Button } from "../components/UI";

// ── MOCK DATA ──────────────────────────────────────────────────────────────────
const initUsers = [
  { id: 1, name: "Sinh viên A", username: "sinhvienA", status: "active", role: "user", quizzes: 45 },
  { id: 2, name: "Sinh viên B", username: "sinhvienB", status: "active", role: "user", quizzes: 32 },
  { id: 3, name: "Sinh viên C", username: "sinhvienC", status: "blocked", role: "user", quizzes: 0 },
];
const initFaculties = [
  { id: 1, name: "Công nghệ Thông tin" },
  { id: 2, name: "Kinh tế & Quản trị" },
];
const initSubjects = [
  { id: 1, name: "Cấu trúc Dữ liệu", faculty: "CNTT", lessons: 8 },
  { id: 2, name: "Cơ sở Dữ liệu", faculty: "CNTT", lessons: 6 },
];
const initQuestions = [
  { id: 1, text: "Stack hoạt động theo nguyên tắc nào?", type: "Một đáp án", subject: "CTDL" },
  { id: 2, name: "BST luôn có chiều cao O(log n)?", type: "Đúng/Sai", subject: "CTDL" },
];

// ── ADMIN SIDEBAR ──────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "overview", icon: "📊", label: "Tổng quan" },
  { id: "users", icon: "👥", label: "Người dùng" },
  { id: "faculties", icon: "🏛️", label: "Ngành học" },
  { id: "subjects", icon: "📚", label: "Môn học" },
  { id: "questions", icon: "❓", label: "Câu hỏi" },
];

function AdminSidebar({ active, setActive }) {
  return (
    <div className="admin-sidebar">
      <div style={{ fontSize: ".68rem", fontWeight: 700, letterSpacing: ".07em", color: "var(--muted-light)", textTransform: "uppercase", padding: "8px 10px 4px" }}>Quản lý</div>
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          className={`sidebar-btn${active === s.id ? " active" : ""}`}
          onClick={() => setActive(s.id)}
        >
          <span className="sb-icon">{s.icon}</span>{s.label}
        </button>
      ))}
    </div>
  );
}

// ── OVERVIEW ───────────────────────────────────────────────────────────────────
function Overview({ users, subjects, questions }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 className="admin-section-title">Tổng quan hệ thống</h2>
      </div>
      <div className="stat-row">
        {[
          { val: users.length, label: "👥 Người dùng", change: "↑ Hoạt động" },
          { val: subjects.length, label: "📚 Môn học" },
          { val: questions.length, label: "❓ Câu hỏi" },
          { val: users.filter(u => u.status === "active").length, label: "✅ Đang hoạt động" },
        ].map(({ val, label, change }) => (
          <div className="stat-card" key={label}>
            <div className="stat-val">{val}</div>
            <div className="stat-label">{label}</div>
            {change && <div className="stat-change">{change}</div>}
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <div className="table-header"><h3>Người dùng gần đây</h3></div>
        <table className="data-table">
          <thead><tr><th>Tên</th><th>Username</th><th>Trạng thái</th><th>Quiz</th></tr></thead>
          <tbody>
            {users.slice(0, 5).map((u) => (
              <tr key={u.id}>
                <td className="td-name">{u.name}</td>
                <td style={{ color: "var(--muted)" }}>{u.username}</td>
                <td><span className={`badge ${u.status === "active" ? "badge-green" : "badge-red"}`}>{u.status === "active" ? "Hoạt động" : "Đã chặn"}</span></td>
                <td>{u.quizzes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── USERS MANAGEMENT ───────────────────────────────────────────────────────────
function UsersPanel({ users, setUsers }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Bắt buộc";
    if (!form.username.trim()) e.username = "Bắt buộc";
    if (!form.password || form.password.length < 6) e.password = "Ít nhất 6 ký tự";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = () => {
    if (!validate()) return;
    const newUser = { id: Date.now(), ...form, status: "active", role: "user", quizzes: 0 };
    setUsers((u) => [...u, newUser]);
    setModal(false);
    setForm({ name: "", username: "", password: "" });
  };

  const toggleBlock = (id) =>
    setUsers((u) => u.map((x) => x.id === id ? { ...x, status: x.status === "active" ? "blocked" : "active" } : x));

  const deleteUser = (id) => {
    if (!confirm("Xác nhận xoá người dùng này?")) return;
    setUsers((u) => u.filter((x) => x.id !== id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="admin-section-title">Quản lý Người dùng</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Tạo tài khoản</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th><th>Tên</th><th>Username</th><th>Trạng thái</th><th>Quiz</th><th>Thao tác</th></tr></thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id}>
                <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                <td className="td-name">{u.name}</td>
                <td style={{ color: "var(--muted)" }}>{u.username}</td>
                <td><span className={`badge ${u.status === "active" ? "badge-green" : "badge-red"}`}>{u.status === "active" ? "Hoạt động" : "Đã chặn"}</span></td>
                <td>{u.quizzes}</td>
                <td>
                  <div className="td-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => toggleBlock(u.id)}>
                      {u.status === "active" ? "Chặn" : "Mở chặn"}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>Xoá</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title="Tạo tài khoản mới" onClose={() => setModal(false)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(false)}>Huỷ</button>
          <button className="btn btn-primary" onClick={handleCreate}>Tạo tài khoản</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Họ và tên</label>
          <input className={`form-input${errors.name ? " error" : ""}`} placeholder="Nhập họ tên" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          {errors.name && <span className="form-error-msg">⚠ {errors.name}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Tên đăng nhập</label>
          <input className={`form-input${errors.username ? " error" : ""}`} placeholder="Nhập username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
          {errors.username && <span className="form-error-msg">⚠ {errors.username}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Mật khẩu</label>
          <input type="password" className={`form-input${errors.password ? " error" : ""}`} placeholder="Ít nhất 6 ký tự" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          {errors.password && <span className="form-error-msg">⚠ {errors.password}</span>}
        </div>
      </Modal>
    </div>
  );
}

// ── GENERIC CRUD PANEL ─────────────────────────────────────────────────────────
function CRUDPanel({ title, items, setItems, fields, renderRow }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const openNew = () => { setEditing(null); setForm({}); setModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setModal(true); };
  const handleSave = () => {
    if (!form[fields[0].key]?.trim()) return;
    if (editing) {
      setItems((prev) => prev.map((x) => x.id === editing.id ? { ...x, ...form } : x));
    } else {
      setItems((prev) => [...prev, { id: Date.now(), ...form }]);
    }
    setModal(false);
  };
  const handleDelete = (id) => {
    if (!confirm("Xác nhận xoá?")) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="admin-section-title">Quản lý {title}</h2>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Thêm {title}</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>#</th>{fields.map((f) => <th key={f.key}>{f.label}</th>)}<th>Thao tác</th></tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id}>
                <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                {renderRow(item)}
                <td>
                  <div className="td-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(item)}>Sửa</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>Xoá</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty-state"><div className="es-icon">📭</div><p>Chưa có dữ liệu</p></div>}
      </div>

      <Modal open={modal} title={`${editing ? "Sửa" : "Thêm"} ${title}`} onClose={() => setModal(false)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(false)}>Huỷ</button>
          <button className="btn btn-primary" onClick={handleSave}>Lưu</button>
        </>}>
        {fields.map((f) => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            {f.type === "select"
              ? <select className="form-select" value={form[f.key] || ""} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}>
                  <option value="">-- Chọn --</option>
                  {f.options?.map((o) => <option key={o}>{o}</option>)}
                </select>
              : f.type === "textarea"
              ? <textarea className="form-textarea" rows={3} placeholder={f.placeholder} value={form[f.key] || ""} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} />
              : <input className="form-input" placeholder={f.placeholder} value={form[f.key] || ""} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} />
            }
          </div>
        ))}
      </Modal>
    </div>
  );
}

// ── ADMIN PAGE ──────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [section, setSection] = useState("overview");
  const [users, setUsers] = useState(initUsers);
  const [faculties, setFaculties] = useState(initFaculties);
  const [subjects, setSubjects] = useState(initSubjects);
  const [questions, setQuestions] = useState(initQuestions);

  const handleLogout = () => { logout(); navigate("/login"); };

  const renderSection = () => {
    switch (section) {
      case "overview": return <Overview users={users} subjects={subjects} questions={questions} />;
      case "users": return <UsersPanel users={users} setUsers={setUsers} />;
      case "faculties": return (
        <CRUDPanel title="Ngành học" items={faculties} setItems={setFaculties}
          fields={[{ key: "name", label: "Tên ngành học", placeholder: "VD: Công nghệ Thông tin" }]}
          renderRow={(item) => <td className="td-name">{item.name}</td>} />
      );
      case "subjects": return (
        <CRUDPanel title="Môn học" items={subjects} setItems={setSubjects}
          fields={[
            { key: "name", label: "Tên Môn", placeholder: "VD: Cấu trúc Dữ liệu" },
            { key: "faculty", label: "Ngành học", placeholder: "VD: CNTT" },
          ]}
          renderRow={(item) => (<>
            <td className="td-name">{item.name}</td>
            <td><span className="badge badge-blue">{item.faculty}</span></td>
          </>)} />
      );
      case "questions": return (
        <CRUDPanel title="Câu hỏi" items={questions} setItems={setQuestions}
          fields={[
            { key: "text", label: "Nội dung câu hỏi", type: "textarea", placeholder: "Nhập câu hỏi..." },
            { key: "type", label: "Loại câu hỏi", type: "select", options: ["Một đáp án", "Đúng/Sai", "Nhiều đáp án", "Điền vào chỗ trống", "Kéo thả"] },
            { key: "subject", label: "Môn học", placeholder: "VD: CTDL" },
          ]}
          renderRow={(item) => (<>
            <td style={{ maxWidth: 280 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{item.text || item.name}</div></td>
            <td><span className="badge badge-orange">{item.type}</span></td>
            <td><span className="badge badge-blue">{item.subject}</span></td>
          </>)} />
      );
      default: return null;
    }
  };

  return (
    <div className="app-layout">
      {/* Admin Navbar */}
      <nav className="navbar">
        <div className="navbar-brand" onClick={() => navigate("/admin")}>
          QuizMaster<span className="brand-dot" />
          <span style={{ fontSize: ".7rem", fontFamily: "DM Sans, sans-serif", background: "var(--orange-light)", color: "var(--orange-dark)", padding: "2px 7px", borderRadius: "99px", fontWeight: 700, marginLeft: 4 }}>Admin</span>
        </div>
        <div style={{ flex: 1 }} />
        <div className="navbar-right">
          <span style={{ fontSize: ".8rem", color: "var(--muted)" }}>{user?.name}</span>
          <div className="avatar-btn" style={{ background: "linear-gradient(135deg, var(--orange), var(--orange-dark))" }}>A</div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </nav>

      {/* Admin body */}
      <div style={{ paddingTop: "var(--navbar-h)" }}>
        <div className="admin-layout">
          <AdminSidebar active={section} setActive={setSection} />
          <div className="admin-content fade-in">
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  );
}




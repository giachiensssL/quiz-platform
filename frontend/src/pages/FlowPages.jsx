import { useNavigate, useParams, useLocation } from "react-router-dom";
import { AppLayout } from "../components/ProtectedRoute";
import Card from "../components/Card";
import { Breadcrumb } from "../components/UI";

const YEARS = [
  { id: 1, name: "Năm 1", icon: "1️⃣", desc: "Đại cương & cơ sở", count: 2 },
  { id: 2, name: "Năm 2", icon: "2️⃣", desc: "Chuyên ngành cơ bản", count: 2 },
  { id: 3, name: "Năm 3", icon: "3️⃣", desc: "Chuyên ngành nâng cao", count: 2 },
  { id: 4, name: "Năm 4", icon: "4️⃣", desc: "Chuyên sâu & đồ án", count: 2 },
];

export function YearPage() {
  const navigate = useNavigate();
  const { facultyId } = useParams();
  const { state } = useLocation();

  return (
    <AppLayout>
      <div className="inner">
        <button className="back-btn" onClick={() => navigate("/")}>← Quay lại</button>
        <Breadcrumb items={[
          { label: "Trang chủ", onClick: () => navigate("/") },
          { label: state?.facultyName || "Ngành học" },
        ]} />
        <div className="page-hdr">
          <h1>Chọn Năm học</h1>
          <p>Ngành học: <strong>{state?.facultyName}</strong></p>
        </div>
        <div className="cards-grid sm fade-in">
          {YEARS.map((y) => (
            <Card
              key={y.id}
              icon={y.icon}
              title={y.name}
              sub={y.desc}
              badge={`${y.count} học kỳ`}
              onClick={() => navigate(`/semester/${y.id}`, {
                state: { ...state, yearName: y.name }
              })}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const SEMESTERS = [
  { id: 1, name: "Học kỳ 1", icon: "📖", desc: "Kỳ học đầu", count: 5 },
  { id: 2, name: "Học kỳ 2", icon: "📝", desc: "Kỳ học cuối", count: 5 },
];

export function SemesterPage() {
  const navigate = useNavigate();
  const { yearId } = useParams();
  const { state } = useLocation();

  return (
    <AppLayout>
      <div className="inner">
        <button className="back-btn" onClick={() => navigate(-1)}>← Quay lại</button>
        <Breadcrumb items={[
          { label: "Trang chủ", onClick: () => navigate("/") },
          { label: state?.facultyName || "Ngành học", onClick: () => navigate(-2) },
          { label: state?.yearName || "Năm" },
        ]} />
        <div className="page-hdr">
          <h1>Chọn Học kỳ</h1>
          <p>{state?.facultyName} · {state?.yearName}</p>
        </div>
        <div className="cards-grid sm fade-in">
          {SEMESTERS.map((s) => (
            <Card
              key={s.id}
              icon={s.icon}
              title={s.name}
              sub={s.desc}
              badge={`${s.count} môn`}
              onClick={() => navigate(`/subject/${s.id}`, {
                state: { ...state, semesterName: s.name }
              })}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const SUBJECTS = [
  { id: 1, name: "Cấu trúc Dữ liệu & Giải thuật", icon: "🌳", lessons: 8 },
  { id: 2, name: "Lập trình Hướng đối tượng", icon: "🧩", lessons: 6 },
  { id: 3, name: "Cơ sở Dữ liệu", icon: "🗄️", lessons: 10 },
  { id: 4, name: "Mạng Máy tính", icon: "🔗", lessons: 7 },
  { id: 5, name: "Trí tuệ Nhân tạo", icon: "🤖", lessons: 9 },
];

export function SubjectPage() {
  const navigate = useNavigate();
  const { semesterId } = useParams();
  const { state } = useLocation();

  return (
    <AppLayout>
      <div className="inner">
        <button className="back-btn" onClick={() => navigate(-1)}>← Quay lại</button>
        <Breadcrumb items={[
          { label: "Trang chủ", onClick: () => navigate("/") },
          { label: state?.facultyName || "Ngành học", onClick: () => navigate(-3) },
          { label: state?.yearName || "Năm", onClick: () => navigate(-2) },
          { label: state?.semesterName || "Kỳ" },
        ]} />
        <div className="page-hdr">
          <h1>Chọn Môn học</h1>
          <p>{[state?.facultyName, state?.yearName, state?.semesterName].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="cards-grid fade-in">
          {SUBJECTS.map((s, i) => (
            <Card
              key={s.id}
              icon={s.icon}
              iconVariant={i % 3 === 0 ? "orange" : ""}
              title={s.name}
              badge={`${s.lessons} bài`}
              badgeVariant={i % 3 === 0 ? "badge-orange" : "badge-blue"}
              onClick={() => navigate(`/lesson/${s.id}`, {
                state: { ...state, subjectName: s.name }
              })}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const LESSONS = [
  { id: 1, name: "Ôn tập Chương 1: Mảng & Danh sách liên kết", icon: "📋", questions: 10, mins: 15 },
  { id: 2, name: "Ôn tập Chương 2: Stack & Queue", icon: "📦", questions: 15, mins: 20 },
  { id: 3, name: "Ôn tập Chương 3: Cây nhị phân", icon: "🌲", questions: 12, mins: 18 },
  { id: 4, name: "Kiểm tra giữa kỳ", icon: "📑", questions: 30, mins: 45 },
  { id: 5, name: "Ôn tập Chương 4: Đồ thị", icon: "🕸️", questions: 10, mins: 15 },
];

export function LessonPage() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const { state } = useLocation();

  return (
    <AppLayout>
      <div className="inner">
        <button className="back-btn" onClick={() => navigate(-1)}>← Quay lại</button>
        <Breadcrumb items={[
          { label: "Trang chủ", onClick: () => navigate("/") },
          { label: state?.subjectName || "Môn" },
        ]} />
        <div className="page-hdr">
          <h1>{state?.subjectName || "Chọn Bài"}</h1>
          <p>Chọn bài ôn tập để bắt đầu làm quiz</p>
        </div>
        <div className="cards-grid fade-in">
          {LESSONS.map((l) => (
            <Card
              key={l.id}
              icon={l.icon}
              iconVariant="green"
              title={l.name}
              sub={`${l.questions} câu · ${l.mins} phút`}
              badge="Bắt đầu →"
              badgeVariant="badge-green"
              onClick={() => navigate(`/quiz/${l.id}`, {
                state: { ...state, lessonName: l.name, lessonMins: l.mins }
              })}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}


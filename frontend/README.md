# QuizMaster – Frontend

## Cài đặt

```bash
npm install
npm start
```

## Tài khoản demo

| Vai trò | Tên đăng nhập | Mật khẩu |
|---------|--------------|----------|
| Admin   | Janscient125 | Janscient2005 |
| Sinh viên | sinhvien01 | 123456 |
| Sinh viên | sinhvien02 | 123456 |

## Cấu trúc thư mục

```
src/
├── api/          # Axios config + tất cả API calls
├── components/   # Navbar, Sidebar, UI components (Button, Input, Modal...)
├── context/      # AuthContext, DataContext
├── pages/        # Mỗi route là 1 file riêng
│   ├── LoginPage.jsx
│   ├── HomePage.jsx       → /
│   ├── YearPage.jsx       → /year/:facultyId
│   ├── SemesterPage.jsx   → /semester/:yearId
│   ├── SubjectPage.jsx    → /subject/:semesterId
│   ├── LessonPage.jsx     → /lesson/:subjectId
│   ├── QuizPage.jsx       → /quiz/:lessonId
│   ├── LeaderboardPage.jsx
│   ├── ProfilePage.jsx
│   └── admin/
│       └── AdminDashboard.jsx → /admin
└── styles/
    └── global.css
```

## Kết nối backend

Thay `REACT_APP_API_URL` trong `.env`, tất cả API call đã được tách sẵn trong `src/api/api.js`.

## Luồng điều hướng

```
/ (Khoa) → /year/:id (Năm) → /semester/:id (Kỳ) → /subject/:id (Môn) → /lesson/:id (Bài) → /quiz/:id (Làm bài)
```

## Loại câu hỏi hỗ trợ

- `single` – Một đáp án (radio)
- `multiple` – Nhiều đáp án (checkbox)
- `truefalse` – Đúng / Sai
- `fill` – Điền vào chỗ trống
- `drag` – Kéo & thả sắp xếp

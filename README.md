# Hệ thống luyện tập trắc nghiệm

Một demo full-stack gồm backend Node.js + Express, MongoDB/Mongoose và frontend React (Vite). Hệ thống mô phỏng lộ trình: khoa → năm → kỳ → môn → bài → làm bài trắc nghiệm với các loại câu hỏi True/False, Single choice, Multiple choice, Drag & Drop, Fill in the blank.

## Công nghệ

- **Frontend:** React 18 + Vite, React Router, Axios
- **Backend:** Node.js, Express, Mongoose, JWT, bcrypt
- **Database:** MongoDB (collections: faculties, years, semesters, subjects, lessons, questions, answers, users)
- **UI:** Giao diện responsive, theo dõi tiến trình và bảng xếp hạng

## Chạy backend

1. Di chuyển đến thư mục backend:
   ```sh
   cd backend
   ```
2. Cài thư viện:
   ```sh
   npm install
   ```
3. Tạo file `.env` dựa trên `.env.example` (thí dụ):
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/quiz-training
   JWT_SECRET=supersecretquizkey
   JWT_EXPIRES_IN=7d
   ```
4. Chạy seed data (tạo khoa, môn, bài, câu hỏi, tài khoản):
   ```sh
   npm run seed
   ```
5. Khởi chạy server (phiên bản dev có nodemon):
   ```sh
   npm run dev
   ```
   Hoặc `npm start` để chạy production.

### API chính

| Endpoint | Mô tả |
| --- | --- |
| `POST /api/auth/register` | Đăng ký tài khoản mới |
| `POST /api/auth/login` | Đăng nhập + trả JWT |
| `GET /api/faculties` | Lấy danh sách khoa |
| `GET /api/years` | Lấy danh sách năm |
| `GET /api/semesters` | Lấy danh sách kỳ |
| `GET /api/subjects?faculty=&year=&semester=` | Lấy môn theo bộ lọc |
| `GET /api/lessons/:subjectId` | Lấy bài theo môn |
| `GET /api/questions/:lessonId` | Lấy câu hỏi (tự random) |
| `POST /api/submit` | Nộp bài (cần token) |
| `GET /api/leaderboard` | Bảng xếp hạng mới nhất |
| `POST /api/admin/question` | (Admin) Tạo câu hỏi |
| `PUT /api/admin/question/:id` | (Admin) Cập nhật |
| `DELETE /api/admin/question/:id` | (Admin) Xóa |

## Frontend

1. Di chuyển thư mục frontend:
   ```sh
   cd frontend
   ```
2. Cài thư viện:
   ```sh
   npm install
   ```
3. Tạo `.env` hoặc `.env.local` từ `.env.example` (đặt `VITE_API_BASE` trỏ về backend, ví dụ `http://localhost:5000/api`).
4. Chạy chế độ dev:
   ```sh
   npm run dev
   ```
   App sẽ chạy mặc định trên `http://localhost:4173`

### Tính năng

- Trang chủ hướng dẫn lộ trình theo khoa → năm → kỳ → môn → bài học
- Bảng xếp hạng (leaderboard) hiển thị 10 lượt làm bài mới nhất
- Khi vào quiz: timer 5–10 phút, navigation `Next question`, `Submit`, `Xem kết quả`
- Câu hỏi True/False, Single choice, Multiple choice, Drag & Drop, Fill in the blank
- Gửi kết quả qua API, trả về điểm, chi tiết và lịch sử 5 lượt cuối

## Thông tin tài khoản mẫu

- **Admin:** `admin@quiz.local` / `Admin#1234` (có quyền CRUD câu hỏi)
- **Người dùng:** `student@quiz.local` / `Student#2026`

> Sau khi đăng nhập, hãy bấm chọn khoa → năm → kỳ → môn → bài để bắt đầu làm bài. Thời gian tự động giảm, và hệ thống sẽ tự động submit khi hết giờ.

## Gợi ý nâng cao

- Tích hợp MongoDB Atlas nếu không chạy local
- Mở rộng bảng `users.attempts` để lưu lịch sử phức tạp hơn hoặc thêm leaderboard riêng cho từng môn
- Viết test (Jest/Supertest cho backend, Vitest cho frontend) để đảm bảo các luồng quan trọng

---
Mọi câu hỏi vui lòng liên hệ người phát triển để cập nhật dữ liệu hoặc mở rộng câu hỏi mới.

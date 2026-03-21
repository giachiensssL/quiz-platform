require("dotenv").config();
const connectDB = require("../config/db");
const Faculty = require("../models/Faculty");
const Year = require("../models/Year");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");
const User = require("../models/User");

const seed = async () => {
  await connectDB();

  await Promise.all([
    Faculty.deleteMany(),
    Year.deleteMany(),
    Semester.deleteMany(),
    Subject.deleteMany(),
    Lesson.deleteMany(),
    Question.deleteMany(),
    User.deleteMany(),
  ]);

  const faculties = await Faculty.insertMany([
    { name: "Nghệ thuật và truyền thông" },
    { name: "Công nghệ thông tin" },
  ]);

  const [year1, year2] = await Year.insertMany([
    { value: 1, label: "Năm 1" },
    { value: 2, label: "Năm 2" },
  ]);

  const [semester1, semester2] = await Semester.insertMany([
    { value: 1, label: "Kỳ 1" },
    { value: 2, label: "Kỳ 2" },
  ]);

  const [artFaculty, itFaculty] = faculties;

  const subjects = await Subject.insertMany([
    {
      name: "Thiết kế đồ họa",
      faculty: artFaculty._id,
      year: year1._id,
      semester: semester1._id,
    },
    {
      name: "Lập trình web",
      faculty: itFaculty._id,
      year: year1._id,
      semester: semester1._id,
    },
  ]);

  const lessons = await Lesson.insertMany([
    { subject: subjects[0]._id, title: "Màu sắc", order: 1 },
    { subject: subjects[1]._id, title: "HTML & CSS", order: 1 },
    { subject: subjects[1]._id, title: "JavaScript", order: 2 },
  ]);

  await Question.create({
    lessonId: lessons[0]._id,
    type: "true_false",
    question: "Màu đỏ là màu nóng",
    points: 1,
    answers: [
      { text: "Đúng", isCorrect: true },
      { text: "Sai", isCorrect: false },
    ],
  });

  await Question.create({
    lessonId: lessons[1]._id,
    type: "single",
    question: "Thẻ nào là tiêu đề lớn nhất?",
    points: 1,
    answers: [
      { text: "<h1>", isCorrect: true },
      { text: "<p>", isCorrect: false },
      { text: "<div>", isCorrect: false },
    ],
  });

  await Question.create({
    lessonId: lessons[2]._id,
    type: "multiple",
    question: "Cách khai báo biến đúng?",
    points: 1,
    answers: [
      { text: "let", isCorrect: true },
      { text: "const", isCorrect: true },
      { text: "var", isCorrect: true },
      { text: "dim", isCorrect: false },
    ],
  });

  await User.create({
    username: "janscient125",
    password: "Janscient2005",
    role: "admin",
    isBlocked: false,
  });

  console.log("Seed thành công");
  process.exit();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

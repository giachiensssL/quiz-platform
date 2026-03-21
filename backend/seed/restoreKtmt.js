require("dotenv").config();
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const connectDB = require("../config/db");
const Faculty = require("../models/Faculty");
const Year = require("../models/Year");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");

const normalizeType = (type) => {
  const value = String(type || "").toLowerCase();
  if (value === "single") return "single";
  if (value === "multiple") return "multiple";
  if (value === "truefalse" || value === "true_false") return "true_false";
  if (value === "fill") return "fill";
  if (value === "drag" || value === "drag_drop") return "drag_drop";
  return "single";
};

const parseSeed = () => {
  const seedPath = path.resolve(__dirname, "../../frontend/src/data/ktmtSeed.js");
  const source = fs.readFileSync(seedPath, "utf8");
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("Cannot parse KTMT seed file");
  }
  const objectText = source.slice(start, end + 1);
  return vm.runInNewContext(`(${objectText})`);
};

const restoreKtmt = async () => {
  await connectDB();

  const seed = parseSeed();
  const facultyName = seed.facultyName || "Công nghệ thông tin";
  const yearName = seed.yearName || "Năm 1";
  const semesterName = seed.semesterName || "Học kỳ 2";
  const subjectName = seed.subject?.name || "Kiến trúc máy tính";

  let faculty = await Faculty.findOne({ name: new RegExp(`^${facultyName}$`, "i") });
  if (!faculty) {
    faculty = await Faculty.create({ name: facultyName, description: "" });
  }

  let year = await Year.findOne({ label: new RegExp(`^${yearName}$`, "i"), faculty: faculty._id });
  if (!year) {
    const value = Number((yearName.match(/\d+/) || ["1"])[0]);
    year = await Year.create({ value, label: yearName, faculty: faculty._id });
  }

  let semester = await Semester.findOne({ label: new RegExp(`^${semesterName}$`, "i"), year: year._id });
  if (!semester) {
    const value = Number((semesterName.match(/\d+/) || ["1"])[0]);
    semester = await Semester.create({ value, label: semesterName, year: year._id });
  }

  let subject = await Subject.findOne({
    name: new RegExp(`^${subjectName}$`, "i"),
    faculty: faculty._id,
    year: year._id,
    semester: semester._id,
  });
  if (!subject) {
    subject = await Subject.create({
      name: subjectName,
      icon: "💻",
      description: "Ôn tập KTMT",
      faculty: faculty._id,
      year: year._id,
      semester: semester._id,
      code: "KTMT",
    });
  }

  const existingLessons = await Lesson.find({ subject: subject._id }).lean();
  const lessonByTitle = new Map(existingLessons.map((lesson) => [String(lesson.title || "").trim().toLowerCase(), lesson]));

  const seedLessons = Array.isArray(seed.lessons) ? seed.lessons : [];
  let createdLessons = 0;

  for (const [index, lesson] of seedLessons.entries()) {
    const title = String(lesson.name || "").trim();
    if (!title) continue;

    const key = title.toLowerCase();
    if (lessonByTitle.has(key)) continue;

    const created = await Lesson.create({
      subject: subject._id,
      title,
      order: Number(lesson.order || index + 1),
      description: "",
    });
    lessonByTitle.set(key, created.toObject());
    createdLessons += 1;
  }

  const lessonIdBySeedId = new Map();
  for (const lesson of seedLessons) {
    const key = String(lesson.name || "").trim().toLowerCase();
    if (!key) continue;
    const found = lessonByTitle.get(key);
    if (found) {
      lessonIdBySeedId.set(String(lesson.id), String(found._id));
    }
  }

  const lessonIds = [...new Set([...lessonIdBySeedId.values()])];
  const existingQuestions = await Question.find(
    { lessonId: { $in: lessonIds } },
    { lessonId: 1, question: 1 }
  ).lean();

  const questionKeySet = new Set(
    existingQuestions.map((item) => `${String(item.lessonId)}::${String(item.question || "").trim().toLowerCase()}`)
  );

  const seedQuestions = Array.isArray(seed.questions) ? seed.questions : [];
  const toInsert = [];

  for (const question of seedQuestions) {
    const lessonId = lessonIdBySeedId.get(String(question.lessonId));
    if (!lessonId) continue;

    const questionText = String(question.text || question.question || "").trim();
    if (!questionText) continue;

    const dedupeKey = `${lessonId}::${questionText.toLowerCase()}`;
    if (questionKeySet.has(dedupeKey)) continue;

    const answers = (Array.isArray(question.answers) ? question.answers : [])
      .map((answer) => ({
        text: String(answer.text || "").trim(),
        imageUrl: String(answer.imageUrl || ""),
        isCorrect: Boolean(answer.correct ?? answer.isCorrect),
      }))
      .filter((answer) => answer.text || answer.imageUrl);

    const type = normalizeType(question.type);
    toInsert.push({
      lessonId,
      type,
      question: questionText,
      imageUrl: String(question.imageUrl || ""),
      answers,
      points: Number(question.points || 1),
      order: Number(question.order || 0),
      dragItems: Array.isArray(question.dragItems) ? question.dragItems : [],
      dropTargets: Array.isArray(question.dropTargets) ? question.dropTargets : [],
      blanks: type === "fill" ? answers.filter((answer) => answer.isCorrect).map((answer) => answer.text) : [],
    });

    questionKeySet.add(dedupeKey);
  }

  let insertedQuestions = 0;
  if (toInsert.length > 0) {
    const chunkSize = 200;
    for (let index = 0; index < toInsert.length; index += chunkSize) {
      const chunk = toInsert.slice(index, index + chunkSize);
      const inserted = await Question.insertMany(chunk, { ordered: false });
      insertedQuestions += inserted.length;
    }
  }

  const totalLessons = await Lesson.countDocuments({ subject: subject._id });
  const totalQuestions = await Question.countDocuments({ lessonId: { $in: lessonIds } });

  console.log(
    "KTMT_RESTORE_OK",
    JSON.stringify({
      subjectId: String(subject._id),
      createdLessons,
      insertedQuestions,
      totalLessons,
      totalQuestions,
    })
  );
};

restoreKtmt()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("KTMT_RESTORE_FAIL", error.message);
    process.exit(1);
  });

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");

const KEY_FILE = path.resolve(__dirname, "tmdt_answer_key.json");
const DRY_RUN = process.argv.includes("--dry-run");

const OPTION_INDEX = { A: 0, B: 1, C: 2, D: 3 };

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .trim();

const loadKey = () => {
  if (!fs.existsSync(KEY_FILE)) {
    throw new Error(`Không tìm thấy file đáp án: ${KEY_FILE}`);
  }
  return JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
};

const findTmdtSubject = async () => {
  let subject = await Subject.findOne({ code: "TMDT" });
  if (subject) return subject;

  const all = await Subject.find({});
  subject = all.find((item) => normalize(item.name).includes("THUONG MAI DIEN TU")) || null;
  return subject;
};

const apply = async () => {
  const payload = loadKey();
  const lessonMap = payload.lessons || {};

  await connectDB();

  const subject = await findTmdtSubject();
  if (!subject) {
    throw new Error("Không tìm thấy môn Thương mại điện tử trong DB");
  }

  const lessons = await Lesson.find({ subject: subject._id }).sort({ order: 1, createdAt: 1 });
  let updatedQuestions = 0;
  let skippedQuestions = 0;

  for (const lesson of lessons) {
    const lessonNo = String(Number(lesson.order) || 0);
    const answerByQuestion = lessonMap[lessonNo] || {};

    if (!Object.keys(answerByQuestion).length) {
      continue;
    }

    const questions = await Question.find({ lessonId: lesson._id }).sort({ order: 1, createdAt: 1 });
    for (let index = 0; index < questions.length; index += 1) {
      const questionNo = String(index + 1);
      const expectedOption = String(answerByQuestion[questionNo] || "").toUpperCase();
      if (!OPTION_INDEX[expectedOption] && OPTION_INDEX[expectedOption] !== 0) {
        skippedQuestions += 1;
        continue;
      }

      const targetIndex = OPTION_INDEX[expectedOption];
      const answers = Array.isArray(questions[index].answers) ? questions[index].answers : [];
      if (answers.length <= targetIndex) {
        skippedQuestions += 1;
        continue;
      }

      const nextAnswers = answers.map((item, idx) => ({
        text: item.text,
        imageUrl: item.imageUrl || "",
        isCorrect: idx === targetIndex,
      }));

      updatedQuestions += 1;
      if (!DRY_RUN) {
        await Question.findByIdAndUpdate(questions[index]._id, { answers: nextAnswers }, { runValidators: false });
      }
    }
  }

  console.log(DRY_RUN ? "[DRY RUN] Áp đáp án TMĐT" : "Đã áp đáp án TMĐT");
  console.log(`subject=${subject.name}`);
  console.log(`updatedQuestions=${updatedQuestions}`);
  console.log(`skippedQuestions=${skippedQuestions}`);
};

apply()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });

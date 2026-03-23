require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) return fallback;
  return String(args[index + 1] || "").trim();
};

const DRY_RUN = args.includes("--dry-run");
const subjectCode = getArg("--subject").toUpperCase();
const keyFileArg = getArg("--key");
const keyFile = keyFileArg ? path.resolve(process.cwd(), keyFileArg) : "";

const OPTION_INDEX = { A: 0, B: 1, C: 2, D: 3 };

if (!subjectCode) {
  console.error("Thiếu --subject, ví dụ: --subject PLDC");
  process.exit(1);
}

if (!keyFile) {
  console.error("Thiếu --key, ví dụ: --key seed/answer_key_pldc.json");
  process.exit(1);
}

const loadKey = () => {
  if (!fs.existsSync(keyFile)) {
    throw new Error(`Không tìm thấy file đáp án: ${keyFile}`);
  }

  const payload = JSON.parse(fs.readFileSync(keyFile, "utf8"));
  const lessons = payload && payload.lessons ? payload.lessons : payload;
  if (!lessons || typeof lessons !== "object") {
    throw new Error("File đáp án không hợp lệ: thiếu lessons");
  }
  return lessons;
};

const apply = async () => {
  const lessonMap = loadKey();

  await connectDB();

  const subject = await Subject.findOne({ code: subjectCode });
  if (!subject) {
    throw new Error(`Không tìm thấy môn có code ${subjectCode}`);
  }

  const lessons = await Lesson.find({ subject: subject._id }).sort({ order: 1, createdAt: 1 });
  let updatedQuestions = 0;
  let skippedQuestions = 0;

  for (const lesson of lessons) {
    const lessonNo = String(Number(lesson.order) || 0);
    const answerByQuestion = lessonMap[lessonNo] || {};
    if (!Object.keys(answerByQuestion).length) continue;

    const questions = await Question.find({ lessonId: lesson._id }).sort({ order: 1, createdAt: 1 });
    for (let index = 0; index < questions.length; index += 1) {
      const questionNo = String(index + 1);
      const expectedOption = String(answerByQuestion[questionNo] || "").toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(OPTION_INDEX, expectedOption)) {
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

  console.log(DRY_RUN ? `[DRY RUN] Áp đáp án ${subjectCode}` : `Đã áp đáp án ${subjectCode}`);
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
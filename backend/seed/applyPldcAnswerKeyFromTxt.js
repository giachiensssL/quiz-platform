require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");

const KEY_FILE = path.resolve(__dirname, "..", "..", "monhoc", "pldc.txt");
const DRY_RUN = process.argv.includes("--dry-run");

const OPTION_INDEX = { A: 0, B: 1, C: 2, D: 3 };

const parseKeyFile = (content) => {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const byLesson = {};
  let currentLesson = null;

  for (const line of lines) {
    const lessonMatch = line.match(/B\s*[àa]\s*i\s*(\d+)\s*[:]?/i);
    if (lessonMatch) {
      currentLesson = String(Number(lessonMatch[1]));
      if (!byLesson[currentLesson]) byLesson[currentLesson] = {};
      continue;
    }

    if (!currentLesson) continue;
    const qaMatch = line.match(/^(\d{1,2})\s*[\.:\-]?\s*([ABCD])$/i);
    if (!qaMatch) continue;

    const qNo = String(Number(qaMatch[1]));
    const opt = qaMatch[2].toUpperCase();
    byLesson[currentLesson][qNo] = opt;
  }

  return byLesson;
};

const apply = async () => {
  if (!fs.existsSync(KEY_FILE)) {
    throw new Error(`Không tìm thấy file đáp án: ${KEY_FILE}`);
  }

  const lessonKey = parseKeyFile(fs.readFileSync(KEY_FILE, "utf8"));
  const lessonCount = Object.keys(lessonKey).length;
  if (!lessonCount) {
    throw new Error("Không đọc được đáp án hợp lệ nào từ pldc.txt");
  }

  await connectDB();

  const subject = await Subject.findOne({ code: "PLDC" });
  if (!subject) {
    throw new Error("Không tìm thấy môn Pháp luật đại cương (code PLDC)");
  }

  const lessons = await Lesson.find({ subject: subject._id }).sort({ order: 1, createdAt: 1 });
  let updatedQuestions = 0;
  let skippedQuestions = 0;

  for (const lesson of lessons) {
    const lessonNo = String(Number(lesson.order) || 0);
    const qKey = lessonKey[lessonNo] || {};
    if (!Object.keys(qKey).length) continue;

    const questions = await Question.find({ lessonId: lesson._id }).sort({ order: 1, createdAt: 1 });
    for (let index = 0; index < questions.length; index += 1) {
      const qNo = String(index + 1);
      const opt = String(qKey[qNo] || "").toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(OPTION_INDEX, opt)) {
        skippedQuestions += 1;
        continue;
      }

      const answers = Array.isArray(questions[index].answers) ? questions[index].answers : [];
      const target = OPTION_INDEX[opt];
      if (answers.length <= target) {
        skippedQuestions += 1;
        continue;
      }

      const nextAnswers = answers.map((item, i) => ({
        text: item.text,
        imageUrl: item.imageUrl || "",
        isCorrect: i === target,
      }));

      updatedQuestions += 1;
      if (!DRY_RUN) {
        await Question.findByIdAndUpdate(questions[index]._id, { answers: nextAnswers }, { runValidators: false });
      }
    }
  }

  console.log(DRY_RUN ? "[DRY RUN] Áp đáp án PLDC từ pldc.txt" : "Đã áp đáp án PLDC từ pldc.txt");
  console.log(`lessonsInKey=${lessonCount}`);
  console.log(`updatedQuestions=${updatedQuestions}`);
  console.log(`skippedQuestions=${skippedQuestions}`);
};

apply()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });

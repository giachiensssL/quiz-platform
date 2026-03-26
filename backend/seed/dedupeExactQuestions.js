require("dotenv").config();
const connectDB = require("../config/db");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");

const DRY_RUN = process.argv.includes("--dry-run");
const subjectArg = process.argv.find((arg) => arg.startsWith("--subject="));
const SUBJECT_CODE = (subjectArg ? subjectArg.split("=")[1] : "QTH").trim().toUpperCase();

const normalizeText = (value) => String(value || "").trim();

const questionKey = (question) => {
  const answers = Array.isArray(question.answers) ? question.answers : [];
  const answersKey = answers
    .map((answer) => {
      const text = normalizeText(answer?.text);
      const isCorrect = Boolean(answer?.isCorrect) ? "1" : "0";
      return `${text}::${isCorrect}`;
    })
    .join("||");

  return [
    question.type || "",
    normalizeText(question.question),
    answersKey,
  ].join("###");
};

const run = async () => {
  await connectDB();

  const subject = await Subject.findOne({ code: SUBJECT_CODE });
  if (!subject) {
    throw new Error(`Khong tim thay mon voi code ${SUBJECT_CODE}`);
  }

  const lessons = await Lesson.find({ subject: subject._id }).sort({ order: 1, createdAt: 1 });
  if (!lessons.length) {
    console.log(`Khong co bai hoc nao cho mon ${subject.name} (${subject.code})`);
    return;
  }

  console.log(DRY_RUN
    ? `[DRY RUN] Dedupe cau hoi trung khop tuyet doi cho ${subject.name} (${subject.code})`
    : `Dedupe cau hoi trung khop tuyet doi cho ${subject.name} (${subject.code})`);

  let totalDeleted = 0;
  let totalBefore = 0;
  let totalAfter = 0;

  for (const lesson of lessons) {
    const questions = await Question.find({ lessonId: lesson._id }).sort({ createdAt: 1, _id: 1 });
    const before = questions.length;

    const firstByKey = new Map();
    const duplicateIds = [];

    for (const q of questions) {
      const key = questionKey(q);
      if (!firstByKey.has(key)) {
        firstByKey.set(key, q._id.toString());
        continue;
      }
      duplicateIds.push(q._id);
    }

    if (!DRY_RUN && duplicateIds.length) {
      await Question.deleteMany({ _id: { $in: duplicateIds } });
    }

    const deleted = duplicateIds.length;
    const after = before - deleted;

    totalBefore += before;
    totalAfter += after;
    totalDeleted += deleted;

    if (deleted > 0) {
      console.log(`Bai ${lesson.order}: before=${before}, deleted=${deleted}, after=${after}`);
    } else {
      console.log(`Bai ${lesson.order}: before=${before}, deleted=0, after=${after}`);
    }
  }

  console.log(`TOTAL before=${totalBefore}, deleted=${totalDeleted}, after=${totalAfter}`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Dedupe that bai:", error.message);
    process.exit(1);
  });

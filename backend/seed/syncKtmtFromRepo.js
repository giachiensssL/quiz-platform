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

const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE = "KTMT";

const normalizeType = (type) => {
  const value = String(type || "").toLowerCase();
  if (value === "single") return "single";
  if (value === "multiple") return "multiple";
  if (value === "truefalse" || value === "true_false") return "true_false";
  if (value === "fill") return "fill";
  if (value === "drag" || value === "drag_drop") return "drag_drop";
  if (value === "arrange_words") return "arrange_words";
  if (value === "match_words") return "match_words";
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

const syncKtmt = async () => {
  const seed = parseSeed();

  const facultyName = String(seed.facultyName || "Công nghệ thông tin").trim();
  const yearName = String(seed.yearName || "Năm 1").trim();
  const semesterName = String(seed.semesterName || "Học kỳ 2").trim();
  const subjectName = String(seed.subject?.name || "Kiến trúc máy tính").trim();

  // DRY RUN: Only prints what would happen. It does not touch the database.
  if (DRY_RUN) {
    const seedLessons = Array.isArray(seed.lessons) ? seed.lessons : [];
    const seedQuestions = Array.isArray(seed.questions) ? seed.questions : [];
    const lessonCandidates = seedLessons.filter((l) => String(l?.id || "").trim() && String(l?.name || "").trim()).length;
    const questionCandidates = seedQuestions.filter((q) => String(q?.id || "").trim() && String(q?.lessonId || "").trim() && String(q?.text || q?.question || "").trim()).length;

    console.log(
      "KTMT_SYNC_DRY_OK",
      JSON.stringify({
        facultyName,
        yearName,
        semesterName,
        subjectName,
        lessonUpserts: lessonCandidates,
        questionUpserts: questionCandidates,
        note: "Dry run does not connect/write DB. Run without --dry-run to sync into MongoDB.",
      })
    );
    return;
  }

  await connectDB();

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
      icon: seed.subject?.icon || "💻",
      description: "Sync từ repo (KTMT)",
      faculty: faculty._id,
      year: year._id,
      semester: semester._id,
      code: "KTMT",
    });
  } else {
    await Subject.findByIdAndUpdate(
      subject._id,
      {
        icon: seed.subject?.icon || subject.icon || "💻",
        code: subject.code || "KTMT",
      },
      { runValidators: false }
    );
  }

  const seedLessons = Array.isArray(seed.lessons) ? seed.lessons : [];
  const seedQuestions = Array.isArray(seed.questions) ? seed.questions : [];

  let lessonUpserts = 0;
  let questionUpserts = 0;

  const lessonIdBySeedId = new Map();

  for (let idx = 0; idx < seedLessons.length; idx += 1) {
    const item = seedLessons[idx] || {};
    const sourceId = String(item.id || "").trim();
    const title = String(item.name || "").trim();
    if (!sourceId || !title) continue;

    const order = Number(item.order || idx + 1) || idx + 1;
    const payload = {
      subject: subject._id,
      title,
      description: "",
      order,
      locked: Boolean(item.locked),
      source: SOURCE,
      sourceId,
    };

    lessonUpserts += 1;
    const updated = await Lesson.findOneAndUpdate(
      { subject: subject._id, source: SOURCE, sourceId },
      { $set: payload },
      { upsert: true, new: true, runValidators: false }
    );
    lessonIdBySeedId.set(sourceId, String(updated._id));
  }

  for (let idx = 0; idx < seedQuestions.length; idx += 1) {
    const q = seedQuestions[idx] || {};
    const sourceId = String(q.id || "").trim();
    const seedLessonId = String(q.lessonId || "").trim();
    const lessonId = lessonIdBySeedId.get(seedLessonId);
    if (!sourceId || !lessonId) continue;

    const questionText = String(q.text || q.question || "").trim();
    if (!questionText) continue;

    const type = normalizeType(q.type);
    const answers = (Array.isArray(q.answers) ? q.answers : [])
      .map((a) => ({
        text: String(a?.text || "").trim(),
        imageUrl: String(a?.imageUrl || "").trim(),
        isCorrect: Boolean(a?.correct ?? a?.isCorrect),
      }))
      .filter((a) => a.text || a.imageUrl);

    const payload = {
      lessonId,
      source: SOURCE,
      sourceId,
      type,
      question: questionText,
      imageUrl: String(q.imageUrl || "").trim(),
      answers,
      hint: String(q.hint || "").trim(),
      answerSentence: String(q.answerSentence || "").trim(),
      points: Number(q.points || 1) || 1,
      order: Number(q.order || 0) || 0,
      dragItems: Array.isArray(q.dragItems) ? q.dragItems : [],
      dropTargets: Array.isArray(q.dropTargets) ? q.dropTargets : [],
      blanks: type === "fill" ? answers.filter((a) => a.isCorrect).map((a) => a.text) : [],
    };

    questionUpserts += 1;
    await Question.findOneAndUpdate(
      { lessonId, source: SOURCE, sourceId },
      { $set: payload },
      { upsert: true, new: false, runValidators: false }
    );
  }

  const totalLessons = await Lesson.countDocuments({ subject: subject._id });
  const totalQuestions = await Question.countDocuments({ lessonId: { $in: [...new Set([...lessonIdBySeedId.values()])] } });

  console.log(
    "KTMT_SYNC_OK",
    JSON.stringify({
      subjectId: String(subject._id),
      lessonUpserts,
      questionUpserts,
      totalLessons,
      totalQuestions,
    })
  );
};

syncKtmt()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(DRY_RUN ? "KTMT_SYNC_DRY_FAIL" : "KTMT_SYNC_FAIL", error.message);
    process.exit(1);
  });


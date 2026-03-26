require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const Faculty = require("../models/Faculty");
const Year = require("../models/Year");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");

const DRY_RUN = process.argv.includes("--dry-run");
const HTML_PATH = path.resolve(__dirname, "..", "..", "monhoc", "index.html");
const SUBJECT_NAME = "Vật lý";
const SUBJECT_CODE = "VLY";

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const decodeHtmlEntities = (input) =>
  String(input || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/");

const cleanText = (input) =>
  decodeHtmlEntities(
    String(input || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

const extractSectionAll = (html) => {
  const startToken = '<div class="bai-section active" id="section-0">';
  const nextToken = '<div class="bai-section" id="section-1"';
  const start = html.indexOf(startToken);
  if (start < 0) return html;

  const end = html.indexOf(nextToken, start);
  if (end < 0) return html.slice(start);

  return html.slice(start, end);
};

const parseLessonTitles = (sectionHtml) => {
  const headingRegex = /<div[^>]*>\s*📖\s*Bài\s*(\d+)\s*[–-]\s*([^<]+)<\/div>/g;
  const byNo = new Map();
  let match = headingRegex.exec(sectionHtml);

  while (match) {
    const no = Number(match[1]);
    const title = `Bài ${no} - ${String(match[2] || "").trim()}`;
    if (!Number.isNaN(no) && no > 0 && !byNo.has(no)) byNo.set(no, title);
    match = headingRegex.exec(sectionHtml);
  }

  return byNo;
};

const splitQuestionCards = (sectionHtml) => {
  const token = '<div class="question-card"';
  const chunks = [];
  let idx = sectionHtml.indexOf(token);
  while (idx >= 0) {
    const next = sectionHtml.indexOf(token, idx + token.length);
    if (next < 0) {
      chunks.push(sectionHtml.slice(idx));
      break;
    }
    chunks.push(sectionHtml.slice(idx, next));
    idx = next;
  }
  return chunks;
};

const parseQuestionCard = (cardHtml) => {
  const idMatch = cardHtml.match(/id="card_b(\d+)q(\d+)"/i);
  if (!idMatch) return null;

  const lessonNo = Number(idMatch[1]);
  const questionNo = Number(idMatch[2]);
  if (Number.isNaN(lessonNo) || Number.isNaN(questionNo)) return null;

  const correctMatch = cardHtml.match(/data-correct="([A-D])"/i);
  const correctKey = correctMatch ? String(correctMatch[1] || "A").toUpperCase() : "A";

  const questionHtmlMatch = cardHtml.match(/<div class="question-text">([\s\S]*?)<\/div>/i);
  if (!questionHtmlMatch) return null;

  const questionHtml = String(questionHtmlMatch[1] || "");
  const imageMatch = questionHtml.match(/<img[^>]*src="([^"]+)"/i);
  const imageUrl = imageMatch ? String(imageMatch[1] || "").trim() : "";
  const questionText = cleanText(questionHtml.replace(/<img[^>]*>/gi, " "));
  if (!questionText) return null;

  const answers = [];
  const optionRegex = /<li[^>]*id="[^"]*opt([A-D])"[\s\S]*?<span class="option-letter">[\s\S]*?<\/span>\s*<span>([\s\S]*?)<\/span>/gi;
  let optionMatch = optionRegex.exec(cardHtml);
  while (optionMatch) {
    const key = String(optionMatch[1] || "").toUpperCase();
    const text = cleanText(optionMatch[2]);
    if (key && text) {
      answers.push({
        text,
        imageUrl: "",
        isCorrect: key === correctKey,
      });
    }
    optionMatch = optionRegex.exec(cardHtml);
  }

  if (answers.length < 2) return null;
  if (!answers.some((item) => item.isCorrect)) answers[0].isCorrect = true;

  return {
    lessonNo,
    questionNo,
    question: questionText,
    imageUrl,
    type: "single",
    answers,
    hint: "",
    answerSentence: "",
    points: 1,
    dragItems: [],
    dropTargets: [],
    blanks: [],
  };
};

const parseHtmlQuestions = (html) => {
  const section = extractSectionAll(html);
  const titles = parseLessonTitles(section);
  const cards = splitQuestionCards(section);

  const grouped = new Map();
  for (const card of cards) {
    const parsed = parseQuestionCard(card);
    if (!parsed) continue;

    if (!grouped.has(parsed.lessonNo)) grouped.set(parsed.lessonNo, []);
    grouped.get(parsed.lessonNo).push(parsed);
  }

  const lessonNos = Array.from(grouped.keys()).sort((a, b) => a - b);
  const lessons = lessonNos.map((lessonNo) => {
    const items = grouped
      .get(lessonNo)
      .sort((a, b) => a.questionNo - b.questionNo)
      .map((item, idx) => ({ ...item, order: idx + 1 }));

    const title = titles.get(lessonNo) || `Bài ${lessonNo}`;
    return {
      lessonNo,
      title,
      questions: items,
    };
  });

  return lessons;
};

const resolveHierarchy = async () => {
  const faculties = await Faculty.find({}).sort({ createdAt: 1 });
  if (!faculties.length) throw new Error("Không có dữ liệu faculty");

  const preferredFaculty = faculties.find((item) => normalize(item.name).includes("kinh te")) || faculties[0];

  const years = await Year.find({}).sort({ createdAt: 1 });
  const scopedYears = years.filter((item) => !item.faculty || String(item.faculty) === String(preferredFaculty._id));
  let year = scopedYears.find((item) => Number(item.value) === 1) || scopedYears[0] || null;
  if (!year && !DRY_RUN) {
    year = await Year.create({ value: 1, label: "Năm 1", faculty: preferredFaculty._id });
  }

  const semesters = await Semester.find({}).sort({ createdAt: 1 });
  const scopedSemesters = semesters.filter((item) => !item.year || String(item.year) === String(year?._id || ""));
  let semester = scopedSemesters.find((item) => Number(item.value) === 1) || scopedSemesters[0] || null;
  if (!semester && !DRY_RUN) {
    semester = await Semester.create({ value: 1, label: "Kỳ 1", year: year?._id || null });
  }

  return { faculty: preferredFaculty, year, semester };
};

const findOrCreatePhysicsSubject = async (hierarchy) => {
  const subjects = await Subject.find({}).sort({ createdAt: 1 });
  const target = subjects.find((item) => {
    const nName = normalize(item.name);
    const nCode = normalize(item.code);
    return nName.includes("vat ly") || nName.includes("physics") || nCode === "vly" || nCode === "vl";
  });

  if (target) return { subject: target, created: false };

  const payload = {
    name: SUBJECT_NAME,
    code: SUBJECT_CODE,
    icon: "science",
    description: "Import từ bộ câu hỏi Vật lý (monhoc/index.html)",
    faculty: hierarchy.faculty?._id || null,
    year: hierarchy.year?._id || null,
    semester: hierarchy.semester?._id || null,
  };

  if (DRY_RUN) {
    return { subject: { _id: "DRY-SUBJECT", ...payload }, created: true };
  }

  const created = await Subject.create(payload);
  return { subject: created, created: true };
};

const run = async () => {
  if (!fs.existsSync(HTML_PATH)) {
    throw new Error(`Không tìm thấy file: ${HTML_PATH}`);
  }

  const html = fs.readFileSync(HTML_PATH, "utf8");
  const parsedLessons = parseHtmlQuestions(html);
  const totalQuestions = parsedLessons.reduce((sum, lesson) => sum + lesson.questions.length, 0);

  if (!parsedLessons.length || !totalQuestions) {
    throw new Error("Không parse được câu hỏi từ HTML");
  }

  await connectDB();
  const hierarchy = await resolveHierarchy();
  const subjectState = await findOrCreatePhysicsSubject(hierarchy);
  const subject = subjectState.subject;

  console.log(DRY_RUN ? "[DRY RUN] Import Vật lý từ HTML" : "Import Vật lý từ HTML");
  console.log(`- Subject: ${subject.name} (${subject.code || "NO-CODE"})${subjectState.created ? " [CREATE]" : " [USE-EXISTING]"}`);

  const existingLessons = await Lesson.find({ subject: subject._id }).sort({ order: 1, createdAt: 1 });
  const existingLessonIds = existingLessons.map((item) => item._id);
  const existingQuestionCount = existingLessonIds.length
    ? await Question.countDocuments({ lessonId: { $in: existingLessonIds } })
    : 0;

  console.log(`- Existing lessons: ${existingLessons.length}`);
  console.log(`- Existing questions: ${existingQuestionCount}`);
  console.log(`- Parsed lessons: ${parsedLessons.length}`);
  console.log(`- Parsed questions: ${totalQuestions}`);

  if (DRY_RUN) {
    for (const lesson of parsedLessons) {
      console.log(`  + ${lesson.title}: ${lesson.questions.length} câu`);
    }
    console.log("[DRY RUN] Hoàn tất");
    process.exit(0);
  }

  if (existingLessonIds.length) {
    await Question.deleteMany({ lessonId: { $in: existingLessonIds } });
    await Lesson.deleteMany({ subject: subject._id });
  }

  const lessonDocs = [];
  for (const lesson of parsedLessons) {
    const createdLesson = await Lesson.create({
      subject: subject._id,
      title: lesson.title,
      order: lesson.lessonNo,
    });

    lessonDocs.push(createdLesson);

    if (!lesson.questions.length) continue;

    const payloads = lesson.questions.map((item) => ({
      lessonId: createdLesson._id,
      type: item.type,
      question: item.question,
      imageUrl: item.imageUrl || "",
      answers: item.answers,
      hint: item.hint || "",
      answerSentence: item.answerSentence || "",
      points: item.points || 1,
      order: item.order || 0,
      dragItems: item.dragItems || [],
      dropTargets: item.dropTargets || [],
      blanks: item.blanks || [],
    }));

    await Question.insertMany(payloads, { ordered: true });
  }

  const createdQuestionCount = await Question.countDocuments({ lessonId: { $in: lessonDocs.map((item) => item._id) } });

  console.log(`- New lessons: ${lessonDocs.length}`);
  console.log(`- New questions: ${createdQuestionCount}`);
  for (const lesson of parsedLessons) {
    console.log(`  + ${lesson.title}: ${lesson.questions.length} câu`);
  }

  console.log("Import hoàn tất");
  process.exit(0);
};

run().catch((error) => {
  console.error("Import thất bại:", error.message);
  process.exit(1);
});

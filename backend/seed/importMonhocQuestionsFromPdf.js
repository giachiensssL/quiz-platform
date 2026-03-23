require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const connectDB = require("../config/db");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");

const DRY_RUN = process.argv.includes("--dry-run");

const PDF_PLAN = [
  { code: "PLDC", fallbackNames: ["Pháp luật đại cương"], fileContains: "PHAP LUAT DAI CUONG" },
  { code: "QTH", fallbackNames: ["Quản trị học"], fileContains: "QUAN TRI HOC" },
  { code: "TMDT", fallbackNames: ["Thương mại điện tử"], fileContains: "THUONG MAI DIEN TU" },
];

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .trim();

const normalizeWhitespace = (value) => String(value || "").replace(/\r/g, "").replace(/\u00A0/g, " ");

const readPdfText = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const parsed = await pdfParse(buffer);
  return normalizeWhitespace(parsed.text || "");
};

const findPdfFile = (monhocDir, fileContains) => {
  const files = fs.readdirSync(monhocDir).filter((name) => /\.pdf$/i.test(name));
  const expected = normalize(fileContains);
  return files.find((name) => normalize(name).includes(expected)) || null;
};

const splitLessons = (rawText) => {
  const lessonRegex = /(^|\n)\s*B[ÀA]I\s*(\d+)\s*[:\-]?\s*\d*\s*[cC]?/gim;
  const matches = [];
  let match = lessonRegex.exec(rawText);
  while (match) {
    matches.push({ number: Number(match[2]), start: match.index + (match[1] ? match[1].length : 0) });
    match = lessonRegex.exec(rawText);
  }

  const lessons = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const end = next ? next.start : rawText.length;
    const block = rawText.slice(current.start, end);
    lessons.push({ number: current.number, block });
  }

  const map = new Map();
  for (const item of lessons) {
    if (item.number >= 1 && item.number <= 9 && !map.has(item.number)) {
      map.set(item.number, item.block);
    }
  }
  return map;
};

const extractOptionsFromChunk = (chunk) => {
  const source = normalizeWhitespace(chunk);
  const markerRegex = /(^|\s)([ABCD])\.\s*/g;
  const markers = [];
  let match = markerRegex.exec(source);

  while (match) {
    markers.push({ key: match[2].toUpperCase(), index: match.index + match[1].length, contentStart: markerRegex.lastIndex });
    match = markerRegex.exec(source);
  }

  if (!markers.length) return [];

  const options = [];
  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const next = markers[index + 1];
    const end = next ? next.index : source.length;
    const text = source.slice(current.contentStart, end).replace(/\s+/g, " ").trim();
    if (text) options.push({ key: current.key, text });
  }

  return options;
};

const chooseCorrectOptionKey = (options) => {
  const bag = options.map((item) => ({ ...item, normalized: normalize(item.text).replace(/\s+/g, " ") }));

  const strongPatterns = [
    /TAT CA CAC DAP AN( DEU)? DUNG/,
    /TAT CA DEU DUNG/,
    /CA \(1\) VA \(2\) DUNG/,
    /\(1\) VA \(2\) DEU DUNG/,
  ];

  for (const pattern of strongPatterns) {
    const found = bag.find((item) => pattern.test(item.normalized));
    if (found) return found.key;
  }

  return "A";
};

const parseQuestions = (lessonBlock) => {
  const questionRegex = /C[âa]u\s*(\d+)\s*[:\.]\s*([\s\S]*?)(?=\n\s*C[âa]u\s*\d+\s*[:\.]|$)/gi;
  const parsed = [];
  let match = questionRegex.exec(lessonBlock);

  while (match) {
    const body = String(match[2] || "").trim();
    const optionStart = body.search(/(^|\s)A\.\s*/im);
    if (optionStart < 0) {
      match = questionRegex.exec(lessonBlock);
      continue;
    }

    const questionText = body.slice(0, optionStart).replace(/\s+/g, " ").trim();
    const optionsChunk = body.slice(optionStart).trim();
    const options = extractOptionsFromChunk(optionsChunk)
      .filter((item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx)
      .slice(0, 4);
    if (!questionText || options.length < 2) {
      match = questionRegex.exec(lessonBlock);
      continue;
    }

    const correctKey = chooseCorrectOptionKey(options);
    const answers = options.map((item) => ({
      text: item.text,
      imageUrl: "",
      isCorrect: item.key === correctKey,
    }));

    if (!answers.some((item) => item.isCorrect)) {
      answers[0].isCorrect = true;
    }

    parsed.push({
      question: questionText,
      type: "single",
      answers,
      hint: "",
      imageUrl: "",
      points: 1,
    });

    match = questionRegex.exec(lessonBlock);
  }

  return parsed;
};

const ensureLessons = async (subjectId) => {
  const existing = await Lesson.find({ subject: subjectId }).sort({ order: 1, createdAt: 1 });
  const byOrder = new Map(existing.map((lesson) => [Number(lesson.order), lesson]));

  for (let index = 1; index <= 9; index += 1) {
    if (!byOrder.has(index)) {
      if (!DRY_RUN) {
        const created = await Lesson.create({ subject: subjectId, title: `Bài ${index}`, order: index });
        byOrder.set(index, created);
      } else {
        byOrder.set(index, { _id: `DRY-${index}`, order: index, title: `Bài ${index}` });
      }
    }
  }

  return byOrder;
};

const upsertLessonQuestions = async (lessonId, parsedQuestions) => {
  const existingQuestions = await Question.find({ lessonId }).select("_id question");
  const existingByQuestion = new Map(existingQuestions.map((item) => [normalize(item.question), item]));

  let created = 0;
  let updated = 0;

  for (let index = 0; index < parsedQuestions.length; index += 1) {
    const payload = parsedQuestions[index];
    const key = normalize(payload.question);
    const found = existingByQuestion.get(key);

    if (!found) {
      created += 1;
      if (!DRY_RUN) {
        await Question.create({
          lessonId,
          type: payload.type,
          question: payload.question,
          imageUrl: payload.imageUrl,
          answers: payload.answers,
          hint: payload.hint,
          points: payload.points,
          order: index + 1,
        });
      }
      continue;
    }

    updated += 1;
    if (!DRY_RUN) {
      await Question.findByIdAndUpdate(
        found._id,
        {
          type: payload.type,
          question: payload.question,
          imageUrl: payload.imageUrl,
          answers: payload.answers,
          hint: payload.hint,
          points: payload.points,
          order: index + 1,
        },
        { runValidators: false }
      );
    }
  }

  return { created, updated, totalParsed: parsedQuestions.length };
};

const run = async () => {
  await connectDB();

  const monhocDir = path.resolve(__dirname, "..", "..", "monhoc");
  if (!fs.existsSync(monhocDir)) {
    throw new Error(`Không tìm thấy thư mục PDF: ${monhocDir}`);
  }

  console.log(DRY_RUN ? "[DRY RUN] Bắt đầu import câu hỏi từ PDF" : "Bắt đầu import câu hỏi từ PDF");

  for (const item of PDF_PLAN) {
    let subject = await Subject.findOne({ code: item.code });
    if (!subject && Array.isArray(item.fallbackNames) && item.fallbackNames.length) {
      const allSubjects = await Subject.find({});
      const targetNames = item.fallbackNames.map((name) => normalize(name));
      subject = allSubjects.find((entry) => targetNames.includes(normalize(entry.name))) || null;
    }
    if (!subject) {
      console.log(`- [SKIP] Không tìm thấy môn code ${item.code}`);
      continue;
    }

    const fileName = findPdfFile(monhocDir, item.fileContains);
    if (!fileName) {
      console.log(`- [SKIP] Không tìm thấy file PDF cho ${item.code}`);
      continue;
    }

    const fullPath = path.join(monhocDir, fileName);
    const text = await readPdfText(fullPath);
    const lessonBlocks = splitLessons(text);
    const lessonMap = await ensureLessons(subject._id);

    console.log(`- [SUBJECT] ${subject.code} | ${subject.name} | file ${fileName}`);

    for (let lessonNumber = 1; lessonNumber <= 9; lessonNumber += 1) {
      const lesson = lessonMap.get(lessonNumber);
      if (!lesson) continue;

      const block = lessonBlocks.get(lessonNumber) || "";
      const parsedQuestions = parseQuestions(block);
      const stats = await upsertLessonQuestions(lesson._id, parsedQuestions);

      console.log(
        `  Bài ${lessonNumber}: parsed ${stats.totalParsed}, create ${stats.created}, update ${stats.updated}`
      );
    }
  }

  console.log(DRY_RUN ? "[DRY RUN] Hoàn tất import câu hỏi" : "Import câu hỏi hoàn tất");
  process.exit(0);
};

run().catch((error) => {
  console.error("Import câu hỏi thất bại:", error.message);
  process.exit(1);
});

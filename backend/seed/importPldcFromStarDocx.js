require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");

const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE_FILE = path.resolve(__dirname, "..", "..", "monhoc", "_pldc_extracted.txt");
const REPORT_FILE = path.resolve(__dirname, "reports", "pldc_import_qa.csv");
const SUBJECT_CODE = "PLDC";

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/Đ/g, "D")
  .replace(/\s+/g, " ")
  .trim()
  .toUpperCase();

const normalizeWhitespace = (value) => String(value || "")
  .replace(/\r/g, "")
  .replace(/\u00A0/g, " ")
  .replace(/[ \t]+/g, " ");

const addQuestionBreaks = (text) => {
  // Some options end and the next question starts on same line in extracted text.
  return String(text || "")
    .replace(/([^\n])\s+(Câu\s*\d+\s*:?)/gi, "$1\n$2");
};

const splitLessonBlocks = (text) => {
  const map = new Map();
  const lines = addQuestionBreaks(normalizeWhitespace(text)).split("\n");
  let currentLesson = 0;
  let bucket = [];

  const flush = () => {
    if (currentLesson >= 1 && currentLesson <= 9) {
      const block = bucket.join("\n").trim();
      if (block) map.set(currentLesson, block);
    }
  };

  for (const line of lines) {
    const key = normalize(line);
    const lessonMatch = key.match(/^BAI\s*(\d+)\s*:\s*\d+\s*C\b/);
    if (lessonMatch) {
      flush();
      currentLesson = Number(lessonMatch[1]);
      bucket = [];
      continue;
    }

    if (currentLesson) {
      bucket.push(line);
    }
  }

  flush();

  return map;
};

const parseQuestionsInLesson = (lessonBlock) => {
  const source = addQuestionBreaks(lessonBlock || "");
  const lines = source.split("\n");
  const chunks = [];
  let currentNo = 0;
  let currentLines = [];

  const flush = () => {
    if (currentNo > 0 && currentLines.length) {
      chunks.push({ questionNo: currentNo, lines: [...currentLines] });
    }
  };

  for (const rawLine of lines) {
    const line = normalizeWhitespace(rawLine).trim();
    if (!line) {
      currentLines.push("");
      continue;
    }

    const key = normalize(line);
    const m = key.match(/^CAU\s*(\d+)\b\s*:?/);
    if (m) {
      flush();
      currentNo = Number(m[1]);
      currentLines = [line.replace(/^\s*C[âaăÂĂ]?u\s*\d+\s*:?[\s]*/i, "")];
      continue;
    }

    if (currentNo > 0) {
      currentLines.push(line);
    }
  }

  flush();

  const parsed = [];

  for (const chunk of chunks) {
    const questionNo = chunk.questionNo;
    const body = chunk.lines.join("\n").trim();
    let paragraphs = body
      .split(/\n\s*\n+/)
      .map((part) => normalizeWhitespace(part).replace(/\n+/g, " ").trim())
      .filter(Boolean);

    if (paragraphs.length < 5) {
      const nonEmptyLines = chunk.lines
        .map((line) => normalizeWhitespace(line).trim())
        .filter(Boolean);
      paragraphs = nonEmptyLines;
    }

    if (paragraphs.length < 5) continue;

    const optionParts = paragraphs.slice(-4);
    const stemParts = paragraphs.slice(0, -4);
    const questionText = stemParts.join(" ").replace(/\s+/g, " ").trim();

    if (!questionText) continue;

    let starCount = 0;
    const answers = optionParts.map((raw) => {
      const hasStar = /\*/.test(raw);
      if (hasStar) starCount += 1;
      return {
        text: raw.replace(/\*/g, "").replace(/\s+/g, " ").trim(),
        imageUrl: "",
        isCorrect: hasStar,
      };
    }).filter((item) => item.text);

    if (answers.length < 2) continue;

    if (starCount === 0) {
      // Keep question importable but mark first option if no key found.
      answers[0].isCorrect = true;
      starCount = 1;
    }

    parsed.push({
      questionNo,
      question: questionText,
      type: starCount > 1 ? "multiple" : "single",
      answers,
      imageUrl: "",
      hint: "",
      points: 1,
    });
  }

  return parsed;
};

const toCsvCell = (value) => {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
};

const getCorrectAnswerLetters = (answers) => {
  const letters = [];
  for (let i = 0; i < answers.length; i += 1) {
    if (answers[i]?.isCorrect) {
      letters.push(String.fromCharCode(65 + i));
    }
  }
  return letters;
};

const writeQaCsvReport = (rows) => {
  const header = [
    "lesson_no",
    "question_no",
    "type",
    "question",
    "correct_letters",
    "correct_answers",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([
      row.lessonNo,
      row.questionNo,
      row.type,
      row.question,
      row.correctLetters,
      row.correctAnswers,
      row.optionA,
      row.optionB,
      row.optionC,
      row.optionD,
    ].map((cell) => toCsvCell(cell)).join(","));
  }

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${lines.join("\n")}\n`, "utf8");
};

const ensureLessons = async (subjectId) => {
  const existing = await Lesson.find({ subject: subjectId }).sort({ order: 1, createdAt: 1 });
  const byOrder = new Map(existing.map((lesson) => [Number(lesson.order), lesson]));

  for (let i = 1; i <= 9; i += 1) {
    if (!byOrder.has(i)) {
      if (!DRY_RUN) {
        const created = await Lesson.create({ subject: subjectId, title: `Bài ${i}`, order: i });
        byOrder.set(i, created);
      } else {
        byOrder.set(i, { _id: `DRY-${i}`, order: i, title: `Bài ${i}` });
      }
    }
  }

  return byOrder;
};

const upsertLessonQuestions = async (lessonId, parsedQuestions) => {
  const existing = await Question.find({ lessonId }).select("_id question");
  const byQuestion = new Map(existing.map((item) => [normalize(item.question), item]));

  let created = 0;
  let updated = 0;

  for (let idx = 0; idx < parsedQuestions.length; idx += 1) {
    const item = parsedQuestions[idx];
    const key = normalize(item.question);
    const found = byQuestion.get(key);

    const payload = {
      lessonId,
      type: item.type,
      question: item.question,
      imageUrl: item.imageUrl,
      answers: item.answers,
      hint: item.hint,
      points: item.points,
      order: idx + 1,
      answerSentence: "",
      dragItems: [],
      dropTargets: [],
    };

    if (!found) {
      created += 1;
      if (!DRY_RUN) {
        await Question.create(payload);
      }
      continue;
    }

    updated += 1;
    if (!DRY_RUN) {
      await Question.findByIdAndUpdate(found._id, payload, { runValidators: false });
    }
  }

  return { created, updated, totalParsed: parsedQuestions.length };
};

const run = async () => {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Không tìm thấy file nguồn: ${SOURCE_FILE}`);
  }

  const rawText = fs.readFileSync(SOURCE_FILE, "utf8");
  const lessonBlocks = splitLessonBlocks(rawText);
  if (!lessonBlocks.size) {
    throw new Error("Không tách được bài học nào từ file nguồn");
  }

  await connectDB();

  const subject = await Subject.findOne({ code: SUBJECT_CODE });
  if (!subject) {
    throw new Error(`Không tìm thấy môn code ${SUBJECT_CODE}`);
  }

  const lessonMap = await ensureLessons(subject._id);

  console.log(DRY_RUN ? "[DRY RUN] Import PLDC từ file có đánh dấu *" : "Import PLDC từ file có đánh dấu *");
  console.log(`subject=${subject.name} (${subject.code})`);

  let totalParsed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  const qaRows = [];

  for (let lessonNo = 1; lessonNo <= 9; lessonNo += 1) {
    const lesson = lessonMap.get(lessonNo);
    if (!lesson) continue;

    const block = lessonBlocks.get(lessonNo) || "";
    const parsed = parseQuestionsInLesson(block);
    const parsedNoSet = new Set(parsed.map((item) => Number(item.questionNo || 0)).filter((n) => n > 0));
    const missingNos = [];
    for (let n = 1; n <= 30; n += 1) {
      if (!parsedNoSet.has(n)) missingNos.push(n);
    }
    const stats = await upsertLessonQuestions(lesson._id, parsed);

    for (const item of parsed) {
      const correctLetters = getCorrectAnswerLetters(item.answers);
      const correctAnswers = item.answers
        .filter((answer) => answer.isCorrect)
        .map((answer) => answer.text)
        .join(" | ");

      qaRows.push({
        lessonNo,
        questionNo: item.questionNo,
        type: item.type,
        question: item.question,
        correctLetters: correctLetters.join("|"),
        correctAnswers,
        optionA: item.answers[0]?.text || "",
        optionB: item.answers[1]?.text || "",
        optionC: item.answers[2]?.text || "",
        optionD: item.answers[3]?.text || "",
      });
    }

    totalParsed += stats.totalParsed;
    totalCreated += stats.created;
    totalUpdated += stats.updated;

    const missingInfo = missingNos.length ? `, missing=[${missingNos.join(",")}]` : "";
    console.log(`Bài ${lessonNo}: parsed=${stats.totalParsed}, create=${stats.created}, update=${stats.updated}${missingInfo}`);
  }

  writeQaCsvReport(qaRows);

  console.log(`TOTAL parsed=${totalParsed}, create=${totalCreated}, update=${totalUpdated}`);
  console.log(`QA report CSV: ${REPORT_FILE}`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Import thất bại:", error.message);
    process.exit(1);
  });

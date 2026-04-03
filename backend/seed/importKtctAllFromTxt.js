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

const SOURCE_DIR = path.resolve(__dirname, "..", "..", "monhoc", "ktct");
const LESSON_FILES = [1,2,3,4,5].map(n=>({ lessonNo: n, filePath: path.join(SOURCE_DIR, `bai${n}.txt`) }));
const SUBJECT_CODE = "KTCT";
const SUBJECT_NAME = "Kinh tế chính trị Mác - Lênin";
const DRY_RUN = process.argv.includes("--dry-run");

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/Đ/g, "D")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const cleanText = (value) => String(value || "")
  .replace(/\r/g, "")
  .replace(/\u00A0/g, " ")
  .replace(/\*/g, "")
  .replace(/\s+/g, " ")
  .trim();

const splitQuestions = (rawText) => {
  const lines = String(rawText || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let currentNo = 0;
  let currentLines = [];

  const flush = () => {
    if (currentNo > 0) {
      blocks.push({ questionNo: currentNo, lines: [...currentLines] });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const m = line.match(/^Câu\s*(\d+)\s*[:.]/i);
    if (m) {
      flush();
      currentNo = Number(m[1]);
      currentLines = [line.replace(/^Câu\s*\d+\s*[:.]\s*/i, "")];
      continue;
    }

    if (currentNo > 0) {
      currentLines.push(rawLine);
    }
  }

  flush();
  return blocks;
};

const parseChoiceQuestion = (questionText, lines) => {
  const options = [];
  let current = "";

  for (const raw of lines) {
    const line = String(raw || "").trim();
    if (!line) continue;
    if (/^\+/i.test(line)) continue;

    if (/^[A-F]\s*[.)]/i.test(line)) {
      if (current.trim()) options.push(current.trim());
      current = line;
      continue;
    }

    if (current) {
      current = `${current} ${line}`.trim();
    }
  }
  if (current.trim()) options.push(current.trim());

  const answers = options
    .map((raw) => {
      const isCorrect = /\*/.test(raw);
      const text = cleanText(raw.replace(/^[A-F]\s*[.)]\s*/i, ""));
      return { text, imageUrl: "", isCorrect };
    })
    .filter((item) => item.text);

  if (!answers.length) return null;

  let correctCount = answers.filter((item) => item.isCorrect).length;
  if (correctCount === 0) {
    answers[0].isCorrect = true;
    correctCount = 1;
  }

  return {
    type: correctCount > 1 ? "multiple" : "single",
    question: cleanText(questionText),
    answers,
    dragItems: [],
    dropTargets: [],
    answerSentence: "",
  };
};

const parseTrueFalseQuestion = (questionText, lines) => {
  const statements = [];
  let current = null;

  const parseBoolFromLine = (value) => {
    const normalized = normalize(value);
    if (!normalized) return null;
    const hasStar = /\*/.test(value);
    const containsTrue = normalized.includes("dung");
    const containsFalse = normalized.includes("sai");
    if (!containsTrue && !containsFalse) return null;
    if (!hasStar) return null;
    if (containsTrue) return true;
    if (containsFalse) return false;
    return null;
  };

  const splitCandidateSegments = (line) => {
    const marked = String(line || "")
      .replace(/([A-F]\s*[.)])/gi, "\n$1")
      .replace(/(\*\s*(?:Đúng|Sai))/gi, "\n$1");
    return marked.split("\n").map((item) => item.trim()).filter(Boolean);
  };

  for (const raw of lines) {
    const line = String(raw || "").trim();
    if (!line) continue;

    const m = line.match(/^(\d+)\s*[.)]\s*(.+)$/);
    if (m) {
      if (current) statements.push(current);
      current = { text: cleanText(m[2]), correct: null };
      continue;
    }

    if (!current) continue;

    const segments = splitCandidateSegments(line);
    for (const segment of segments) {
      const parsed = parseBoolFromLine(segment);
      if (parsed === null) continue;
      current.correct = parsed;
    }
  }

  if (current) statements.push(current);

  const answers = statements
    .map((item) => ({ text: cleanText(item.text), imageUrl: "", isCorrect: Boolean(item.correct) }))
    .filter((item) => item.text);

  if (!answers.length) return null;

  return {
    type: "true_false",
    question: cleanText(questionText),
    answers,
    dragItems: [],
    dropTargets: [],
    answerSentence: "",
  };
};

const parseDragDropQuestion = (questionText, lines) => {
  const cleanedLines = lines.map((line) => String(line || "").trim()).filter(Boolean);
  const candidatePool = [];
  const targets = [];

  for (const line of cleanedLines) {
    if (line.includes("/") && !/^\d+\s*[.)]/.test(line)) {
      line.split("/").map((item) => cleanText(item)).filter(Boolean).forEach((item) => candidatePool.push(item));
      continue;
    }

    const m = line.match(/^(\d+)\s*[.)]\s*(.+)$/);
    if (m) {
      const rawTarget = m[2] || "";
      const starredInline = [];
      let prompt = rawTarget;
      prompt.replace(/\*([^*]+)/g, (_, token) => {
        const cleaned = cleanText(token);
        if (cleaned) starredInline.push(cleaned.replace(/[()]/g, "").trim());
        return _;
      });
      prompt = cleanText(prompt.replace(/\*([^*]+)/g, "").replace(/[()]/g, ""));

      targets.push({
        prompt,
        values: [...starredInline],
      });
      continue;
    }

    if (!targets.length) continue;

    const value = cleanText(line.replace(/^\*+/, ""));
    if (value) {
      targets[targets.length - 1].values.push(value);
    }
  }

  const unique = (items) => Array.from(new Set(items.map((item) => cleanText(item)).filter(Boolean)));
  const valuesFromTargets = unique(targets.flatMap((item) => item.values || []));
  const dragLabels = unique([...candidatePool, ...valuesFromTargets]);

  const dragItems = dragLabels.map((label, idx) => ({ id: `item-${idx + 1}`, label }));
  const dragByNormalized = new Map(dragItems.map((item) => [normalize(item.label), item.id]));

  const dropTargets = targets.map((target, idx) => {
    const ids = unique(target.values || [])
      .map((value) => dragByNormalized.get(normalize(value)) || "")
      .filter(Boolean);

    return {
      id: `slot-${idx + 1}`,
      prompt: cleanText(target.prompt),
      label: `Vị trí ${idx + 1}`,
      correctItemId: ids[0] || "",
      correctItemIds: ids,
    };
  }).filter((item) => item.correctItemIds.length > 0);

  if (dragItems.length < 2 || dropTargets.length < 1) return null;

  return {
    type: "drag_drop",
    question: cleanText(questionText),
    answers: dragItems.map((item) => ({ text: item.label, imageUrl: "", isCorrect: true })),
    dragItems,
    dropTargets,
    answerSentence: "",
  };
};

const parseQuestionBlock = (block) => {
  const allLines = Array.isArray(block?.lines) ? block.lines : [];
  if (!allLines.length) return null;

  const head = cleanText(allLines[0] || "");
  const tail = allLines.slice(1);
  const combined = `${head}\n${tail.join("\n")}`;
  const normalizedCombined = normalize(combined);

  if (normalizedCombined.includes("keo tha")) {
    return parseDragDropQuestion(head, tail);
  }

  const hasStatementPattern = tail.some((line) => /^\s*\d+\s*[.)]/.test(String(line || "").trim()));
  const hasTrueFalseWords = tail.some((line) => /đúng|sai/i.test(String(line || "")));
  if (hasStatementPattern && hasTrueFalseWords) {
    const parsed = parseTrueFalseQuestion(head, tail);
    if (parsed) return parsed;
  }

  return parseChoiceQuestion(head, tail);
};

const ensureSubject = async () => {
  let subject = await Subject.findOne({ code: SUBJECT_CODE });
  if (!subject) {
    subject = await Subject.findOne({ name: new RegExp('kinh\\s*te\\s*chinh\\s*tri','i') });
  }

  if (subject || DRY_RUN) return subject;

  const faculty = await Faculty.findOne().sort({ createdAt: 1 });
  const year = await Year.findOne().sort({ createdAt: 1 });
  const semester = await Semester.findOne().sort({ createdAt: 1 });
  if (!faculty || !year || !semester) {
    throw new Error('Không đủ khoa/năm/học kỳ để tạo môn KTCT');
  }

  return Subject.create({
    name: SUBJECT_NAME,
    code: SUBJECT_CODE,
    icon: '📘',
    description: 'Ôn tập Kinh tế chính trị',
    faculty: faculty._id,
    year: year._id,
    semester: semester._id,
  });
};

const ensureLesson = async (subjectId, lessonNo) => {
  let lesson = await Lesson.findOne({ subject: subjectId, order: lessonNo });
  if (lesson || DRY_RUN) return lesson;

  return Lesson.create({ subject: subjectId, title: `Bài ${lessonNo}`, order: lessonNo, description: `Nhập từ file bai${lessonNo}.txt` });
};

const upsertLessonQuestions = async (lessonId, blocks) => {
  const payloads = [];
  let skipped = 0;

  for (let idx = 0; idx < blocks.length; idx += 1) {
    const parsed = parseQuestionBlock(blocks[idx]);
    if (!parsed || !parsed.question || !Array.isArray(parsed.answers) || !parsed.answers.length) {
      skipped += 1;
      continue;
    }

    payloads.push({
      lessonId,
      type: parsed.type,
      question: parsed.question,
      imageUrl: '',
      answers: parsed.answers,
      hint: '',
      points: 1,
      order: idx + 1,
      answerSentence: parsed.answerSentence || '',
      dragItems: parsed.dragItems || [],
      dropTargets: parsed.dropTargets || [],
      blanks: parsed.type === 'fill' ? parsed.answers.filter(a=>a.isCorrect).map(a=>a.text) : [],
    });
  }

  if (DRY_RUN) return { created: payloads.length, updated: 0, removed: 0, skipped };

  const existingCount = await Question.countDocuments({ lessonId });
  await Question.deleteMany({ lessonId });
  if (payloads.length) await Question.insertMany(payloads, { ordered: true });
  return { created: payloads.length, updated: 0, removed: existingCount, skipped };
};

const run = async () => {
  for (const item of LESSON_FILES) {
    if (!fs.existsSync(item.filePath)) {
      throw new Error(`Thiếu file: ${item.filePath}`);
    }
  }

  await connectDB();
  const subject = await ensureSubject();
  if (!subject) throw new Error('Không xác định được môn KTCT');

  let totalCreated=0, totalUpdated=0, totalSkipped=0;

  for (const item of LESSON_FILES) {
    const raw = fs.readFileSync(item.filePath, 'utf8');
    const blocks = splitQuestions(raw);
    const lesson = await ensureLesson(subject._id, item.lessonNo);
    if (!lesson) throw new Error(`Không xác định bài ${item.lessonNo}`);
    const stats = await upsertLessonQuestions(lesson._id, blocks);
    totalCreated += stats.created; totalUpdated += stats.updated; totalSkipped += stats.skipped;
    console.log(`Bài ${item.lessonNo}: blocks=${blocks.length}, removed=${stats.removed||0}, created=${stats.created}, skipped=${stats.skipped}`);
  }

  console.log(DRY_RUN?"[DRY RUN] Import KTCT hoàn tất":"Import KTCT hoàn tất");
  console.log(`TOTAL created=${totalCreated}, updated=${totalUpdated}, skipped=${totalSkipped}`);
};

run().then(()=>process.exit(0)).catch(e=>{ console.error('Import KTCT failed:', e.message); process.exit(1); });

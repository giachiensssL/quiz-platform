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

const SOURCE_FILE = path.resolve(__dirname, "..", "..", "monhoc", "ktct", "bai1.txt");
const SUBJECT_CODE = "KTCT";
const SUBJECT_NAME = "Kinh tế chính trị Mác - Lênin";
const LESSON_ORDER = 1;
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

const ensureSubjectAndLesson = async () => {
  let subject = await Subject.findOne({ code: SUBJECT_CODE });
  if (!subject) {
    subject = await Subject.findOne({ name: new RegExp("kinh\\s*te\\s*chinh\\s*tri", "i") });
  }

  if (!subject) {
    const faculty = await Faculty.findOne().sort({ createdAt: 1 });
    const year = await Year.findOne().sort({ createdAt: 1 });
    const semester = await Semester.findOne().sort({ createdAt: 1 });

    if (!faculty || !year || !semester) {
      throw new Error("Không đủ dữ liệu khoa/năm học/học kỳ để tạo môn KTCT");
    }

    if (!DRY_RUN) {
      subject = await Subject.create({
        name: SUBJECT_NAME,
        code: SUBJECT_CODE,
        icon: "📘",
        description: "Ôn tập Kinh tế chính trị",
        faculty: faculty._id,
        year: year._id,
        semester: semester._id,
      });
    } else {
      subject = { _id: "DRY-SUBJECT" };
    }
  }

  let lesson = await Lesson.findOne({ subject: subject._id, order: LESSON_ORDER });
  if (!lesson) {
    if (!DRY_RUN) {
      lesson = await Lesson.create({
        subject: subject._id,
        title: "Bài 1",
        order: LESSON_ORDER,
        description: "Nhập từ file bai1.txt",
      });
    } else {
      lesson = { _id: "DRY-LESSON" };
    }
  }

  return { subject, lesson };
};

const run = async () => {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Không tìm thấy file nguồn: ${SOURCE_FILE}`);
  }

  const rawText = fs.readFileSync(SOURCE_FILE, "utf8");
  const blocks = splitQuestions(rawText);
  if (!blocks.length) throw new Error("Không tách được câu hỏi từ file bai1.txt");

  await connectDB();
  const { subject, lesson } = await ensureSubjectAndLesson();

  const existing = await Question.find({ lessonId: lesson._id }).select("_id question");
  const existingByKey = new Map(existing.map((item) => [normalize(item.question), item]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < blocks.length; i += 1) {
    const parsed = parseQuestionBlock(blocks[i]);
    if (!parsed || !parsed.question || !Array.isArray(parsed.answers) || !parsed.answers.length) {
      skipped += 1;
      continue;
    }

    const payload = {
      lessonId: lesson._id,
      type: parsed.type,
      question: parsed.question,
      imageUrl: "",
      answers: parsed.answers,
      hint: "",
      points: 1,
      order: i + 1,
      answerSentence: parsed.answerSentence || "",
      dragItems: parsed.dragItems || [],
      dropTargets: parsed.dropTargets || [],
      blanks: parsed.type === "fill"
        ? parsed.answers.filter((item) => item.isCorrect).map((item) => item.text)
        : [],
    };

    const key = normalize(parsed.question);
    const found = existingByKey.get(key);

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

  console.log(DRY_RUN ? "[DRY RUN] Import KTCT Bài 1" : "Import KTCT Bài 1");
  console.log(`subject=${subject.name || SUBJECT_NAME} (${subject.code || SUBJECT_CODE})`);
  console.log(`lesson=${lesson.title || "Bài 1"}`);
  console.log(`totalBlocks=${blocks.length}, created=${created}, updated=${updated}, skipped=${skipped}`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Import KTCT thất bại:", error.message);
    process.exit(1);
  });

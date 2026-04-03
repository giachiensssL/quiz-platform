require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Subject = require('../models/Subject');
const Lesson = require('../models/Lesson');
const Question = require('../models/Question');

const SOURCE_DIR = path.resolve(__dirname, '..', '..', 'monhoc', 'ktct');

const normalize = (s) => String(s || '').trim();

const parseFile = (text) => {
  // Split by question markers like "Câu 1:" or new line starting with "Câu"
  const parts = text.split(/\n(?=Câu\s+\d+:)/g);
  const questions = [];
  for (const part of parts) {
    const m = part.match(/^Câu\s*(\d+):\s*([\s\S]*)$/);
    if (!m) continue;
    const rest = m[2].trim();
    // split options lines starting with e.g. A. or A)

      if (parts.length >= 2) {
        const prompt = stripStars(parts[0]);
        const answer = stripStars(parts.slice(1).join(" "));
        if (prompt && answer) pairs.push({ prompt, answer });
      }
      continue;
    }

    const answerLabelMatch = line.match(/^Đáp án\s*[:：]\s*(.+)$/i);
    if (answerLabelMatch && pairs.length) {
      const answer = stripStars(answerLabelMatch[1]);
      if (answer) pairs[pairs.length - 1].answer = answer;
    }

    const inlineLabelMatch = line.match(/^(.+?)\s+[—-]\s*\*\s*(.+)$/);
    if (inlineLabelMatch) {
      const prompt = stripStars(inlineLabelMatch[1]);
      const answer = stripStars(inlineLabelMatch[2]);
      if (prompt && answer) pairs.push({ prompt, answer });
    }
  }

  if (!pairs.length) return null;

  const uniqueAnswers = Array.from(new Set(pairs.map((item) => cleanText(item.answer)).filter(Boolean)));
  const dragItems = uniqueAnswers.map((label, idx) => ({ id: `item-${idx + 1}`, label }));
  const idByNorm = new Map(dragItems.map((item) => [normalize(item.label), item.id]));

  const dropTargets = pairs.map((item, idx) => {
    const id = idByNorm.get(normalize(item.answer)) || "";
    return {
      id: `slot-${idx + 1}`,
      prompt: cleanText(item.prompt),
      label: `Vị trí ${idx + 1}`,
      correctItemId: id,
      correctItemIds: id ? [id] : [],
    };
  }).filter((item) => item.correctItemIds.length > 0);

  if (dragItems.length < 2 || dropTargets.length < 1) return null;

  return {
    type: "drag_drop",
    question: stripStars(questionText),
    answers: dragItems.map((item) => ({ text: item.label, imageUrl: "", isCorrect: true })),
    dragItems,
    dropTargets,
    answerSentence: "",
  };
};

const parseDragPosition = (questionText, lines) => {
  const groups = [];
  let current = null;

  const pushCurrent = () => {
    if (current && current.prompt) groups.push(current);
  };

  for (const rawLine of lines) {
    const line = cleanText(rawLine);
    if (!line) continue;

    const heading = line.match(/^(\d+)\s*[.)]\s*(.+)$/);
    if (heading) {
      pushCurrent();
      const rawPrompt = stripStars(heading[2]);
      const inlineAnswers = [];
      rawPrompt.replace(/\*\s*([^*]+)/g, (_, token) => {
        const normalized = stripAnswerLabel(stripStars(token));
        if (normalized) inlineAnswers.push(normalized);
        return _;
      });
      const prompt = cleanText(rawPrompt.replace(/\*\s*([^*]+)/g, " "));
      current = { prompt, answers: inlineAnswers };
      continue;
    }

    if (!current) continue;

    if (/^\*/.test(line)) {
      const answer = stripAnswerLabel(stripStars(line));
      if (answer) current.answers.push(answer);
      continue;
    }

    const arrowMatch = line.match(/(?:->|—>|=>|→)\s*\*?\s*(.+)$/i);
    if (arrowMatch) {
      const answer = stripAnswerLabel(stripStars(arrowMatch[1]));
      if (answer) current.answers.push(answer);
      continue;
    }

    if (/^[-_⸻]+$/.test(line)) continue;
    if (/^(?:h[aã]y\s*ch[oọ]n|tr[ảa]\s*l[ờo]i\s*:|đ[aá]p\s*[aá]n\s*:)/i.test(line)) continue;

    // Position drag sample can list correct entries as plain lines under each heading.
    const plain = stripIndexMarker(stripAnswerLabel(stripStars(line)));
    if (plain) {
      current.answers.push(plain);
    }
  }

  pushCurrent();

  if (!groups.length) return null;

  const uniqueAnswers = Array.from(new Set(groups.flatMap((group) => group.answers).map((item) => cleanText(item)).filter(Boolean)));
  const dragItems = uniqueAnswers.map((label, idx) => ({ id: `item-${idx + 1}`, label }));
  const idByNorm = new Map(dragItems.map((item) => [normalize(item.label), item.id]));

  const dropTargets = groups.map((group, idx) => {
    const ids = Array.from(new Set(group.answers.map((item) => idByNorm.get(normalize(item)) || "").filter(Boolean)));
    return {
      id: `slot-${idx + 1}`,
      prompt: cleanText(group.prompt),
      label: `Vị trí ${idx + 1}`,
      correctItemId: ids[0] || "",
      correctItemIds: ids,
    };
  }).filter((item) => item.correctItemIds.length > 0);

  if (dragItems.length < 2 || dropTargets.length < 1) return null;

  return {
    type: "drag_drop",
    question: stripStars(questionText),
    answers: dragItems.map((item) => ({ text: item.label, imageUrl: "", isCorrect: true })),
    dragItems,
    dropTargets,
    answerSentence: "",
  };
};

const parseDragInlineMappings = (questionText, lines) => {
  const candidates = [];
  const mappings = [];
  let pendingSlot = null;

  for (const rawLine of lines) {
    const line = cleanText(rawLine);
    if (!line) continue;

    if ((line.includes("|") || line.includes("/")) && !/^\d+\s*[.)]/.test(line)) {
      line.split(/[|/]/).map((item) => cleanText(item)).filter(Boolean).forEach((item) => candidates.push(item));
      continue;
    }

    const answerOnly = line.match(/^(\d+)\.(\d+)\s*(.+)$/);
    if (answerOnly && pendingSlot && Number(answerOnly[1]) === pendingSlot.slotNo) {
      mappings.push({
        prompt: cleanText(pendingSlot.prompt || `Vị trí ${mappings.length + 1}`),
        answer: stripIndexMarker(stripAnswerLabel(stripStars(answerOnly[3]))),
      });
      pendingSlot = null;
      continue;
    }

    const numbered = line.match(/^(\d+)\s*[.)]\s*(.+)$/);
    if (!numbered) continue;
    const slotNo = Number(numbered[1]);
    const segment = numbered[2];

    let answer = "";
    let prompt = segment;

    const arrow = segment.match(/(?:->|—>|=>|→)\s*\*?\s*(.+)$/i);
    if (arrow) {
      answer = stripAnswerLabel(stripStars(arrow[1]));
      prompt = cleanText(segment.replace(/(?:->|—>|=>|→)\s*\*?\s*.+$/i, ""));
    } else {
      const starAfter = segment.match(/\*\s*([^*]+)$/);
      if (starAfter) {
        answer = stripAnswerLabel(stripStars(starAfter[1]));
        prompt = cleanText(segment.replace(/\*\s*([^*]+)$/, ""));
      } else {
        const indexedInline = segment.match(/^(.*?)\s+(\d+)\.(\d+)\s*(.+)$/);
        if (indexedInline && Number(indexedInline[2]) === slotNo) {
          prompt = cleanText(indexedInline[1]);
          answer = stripIndexMarker(stripAnswerLabel(stripStars(indexedInline[4])));
        }

        const trailing = segment.match(/(.+?)\*\s*$/);
        if (!answer && trailing) {
          answer = stripAnswerLabel(stripStars(trailing[1]));
          prompt = cleanText(segment.replace(/(.+?)\*\s*$/, ""));
        }
      }
    }

    if (answer) {
      mappings.push({
        prompt: cleanText(prompt || `Vị trí ${mappings.length + 1}`),
        answer: stripIndexMarker(cleanText(answer.replace(/^[()\[\]{}\s]+|[()\[\]{}\s]+$/g, ""))),
      });
      pendingSlot = null;
    } else {
      pendingSlot = {
        slotNo,
        prompt: cleanText(prompt || segment),
      };
    }
  }

  if (!mappings.length) return null;

  const uniqueAnswers = Array.from(new Set([...candidates, ...mappings.map((item) => item.answer)].map((item) => cleanText(item)).filter(Boolean)));
  const dragItems = uniqueAnswers.map((label, idx) => ({ id: `item-${idx + 1}`, label }));
  const idByNorm = new Map(dragItems.map((item) => [normalize(item.label), item.id]));

  const dropTargets = mappings.map((item, idx) => {
    const id = idByNorm.get(normalize(item.answer)) || "";
    return {
      id: `slot-${idx + 1}`,
      prompt: cleanText(item.prompt),
      label: `Vị trí ${idx + 1}`,
      correctItemId: id,
      correctItemIds: id ? [id] : [],
    };
  }).filter((item) => item.correctItemIds.length > 0);

  if (dragItems.length < 2 || dropTargets.length < 1) return null;

  return {
    type: "drag_drop",
    question: stripStars(questionText),
    answers: dragItems.map((item) => ({ text: item.label, imageUrl: "", isCorrect: true })),
    dragItems,
    dropTargets,
    answerSentence: "",
  };
};

const parseDragGroupedByHeadings = (questionText, lines) => {
  const groups = [];
  let current = null;

  const pushCurrent = () => {
    if (current && current.prompt && current.answers.length) groups.push(current);
  };

  for (const rawLine of lines) {
    const line = cleanText(rawLine);
    if (!line) continue;

    const headingByColon = line.match(/^(.+?)\s*:\s*$/);
    const headingByNumber = line.match(/^\d+\)\s*(.+)$/);
    const headingByQuestion = line.match(/^(.+\?)\s*$/);
    const isHeading = headingByColon || headingByNumber || headingByQuestion;
    if (isHeading) {
      pushCurrent();
      const prompt = cleanText(String((headingByColon?.[1] || headingByNumber?.[1] || headingByQuestion?.[1] || "")).replace(/^\d+\s*[.)]\s*/, ""));
      current = { prompt, answers: [] };
      continue;
    }

    const answerOnly = line.match(/^[•\-*]\s*(.+)$/);
    if (answerOnly && current) {
      const answer = stripAnswerLabel(stripStars(answerOnly[1]));
      if (answer) current.answers.push(answer);
      continue;
    }

    const trailingStar = line.match(/^(.+?)\*\s*$/);
    if (trailingStar && current) {
      const answer = stripAnswerLabel(stripStars(trailingStar[1]));
      if (answer) current.answers.push(answer);
      continue;
    }

    if (current && !/^[-_⸻]+$/.test(line) && !/^(?:h[aã]y\s*ch[oọ]n|tr[ảa]\s*l[ờo]i\s*:|đ[aá]p\s*[aá]n\s*:)/i.test(line)) {
      const plain = stripIndexMarker(stripAnswerLabel(stripStars(line)));
      if (plain) current.answers.push(plain);
    }
  }

  pushCurrent();

  if (!groups.length) return null;

  const uniqueAnswers = Array.from(new Set(groups.flatMap((group) => group.answers).map((item) => cleanText(item)).filter(Boolean)));
  const dragItems = uniqueAnswers.map((label, idx) => ({ id: `item-${idx + 1}`, label }));
  const idByNorm = new Map(dragItems.map((item) => [normalize(item.label), item.id]));

  const dropTargets = groups.map((group, idx) => {
    const ids = Array.from(new Set(group.answers.map((item) => idByNorm.get(normalize(item)) || "").filter(Boolean)));
    return {
      id: `slot-${idx + 1}`,
      prompt: cleanText(group.prompt),
      label: `Vị trí ${idx + 1}`,
      correctItemId: ids[0] || "",
      correctItemIds: ids,
    };
  }).filter((item) => item.correctItemIds.length > 0);

  if (dragItems.length < 2 || dropTargets.length < 1) return null;

  return {
    type: "drag_drop",
    question: stripStars(questionText),
    answers: dragItems.map((item) => ({ text: item.label, imageUrl: "", isCorrect: true })),
    dragItems,
    dropTargets,
    answerSentence: "",
  };
};

const splitQuestionStem = (allLines) => {
  const lines = Array.isArray(allLines) ? allLines.map((line) => cleanText(line)).filter((line) => line !== "") : [];
  if (!lines.length) return { questionText: "", bodyLines: [] };

  const structuralStart = (line) => (
    /^\+/.test(line)
    || /^\*/.test(line)
    || /^\*?\s*[A-Z]\s*[.):]/.test(line)
    || /^\d+\s*[.)]/.test(line)
    || /^đáp\s*án\s*:/i.test(line)
    || /^Trả\s*lời\s*:/i.test(line)
    || /\||\//.test(line)
  );

  if (lines[0]) {
    const firstIsOnlyPrompt = !structuralStart(lines[0]);
    if (firstIsOnlyPrompt) {
      let cursor = 1;
      while (cursor < lines.length && !structuralStart(lines[cursor])) {
        lines[0] = `${lines[0]} ${lines[cursor]}`.trim();
        cursor += 1;
      }
      return { questionText: lines[0], bodyLines: lines.slice(cursor) };
    }
  }

  return { questionText: lines[0], bodyLines: lines.slice(1) };
};

const parseChoice = (questionText, lines) => {
  const optionLines = [];
  let current = "";

  for (const rawLine of lines) {
    const line = cleanText(rawLine);
    if (!line) continue;

    if (/^\+/.test(line)) continue;

    if (/^\*?\s*[A-Z]\s*[.):]/.test(line)) {
      if (current) optionLines.push(current);
      current = line;
      continue;
    }

    if (current) {
      current = `${current} ${line}`.trim();
    }
  }
  if (current) optionLines.push(current);

  const answers = optionLines
    .map((item) => {
      const marked = /\*/.test(item);
      const noLabel = item.replace(/^\*?\s*[A-Z]\s*[.):]\s*/i, "");
      return {
        text: stripStars(noLabel),
        imageUrl: "",
        isCorrect: marked,
      };
    })
    .filter((item) => item.text);

  if (!answers.length) {
    // Fallback for lines like "Đáp án: ..." or "Trả lời: A...."
    const joined = cleanText(lines.join(" "));
    const fallback = joined.match(/(?:đáp\s*án|tra\s*loi|trả\s*lời)\s*[:：]\s*(.+)$/i);
    if (!fallback) return null;
    answers.push({ text: stripStars(fallback[1]), imageUrl: "", isCorrect: true });
  }

  let correctCount = answers.filter((item) => item.isCorrect).length;
  if (correctCount === 0) {
    answers[0].isCorrect = true;
    correctCount = 1;
  }

  return {
    type: correctCount > 1 ? "multiple" : "single",
    question: stripStars(questionText),
    answers,
    dragItems: [],
    dropTargets: [],
    answerSentence: "",
  };
};

const parseQuestion = (block) => {
  const allLines = Array.isArray(block?.lines) ? block.lines : [];
  if (!allLines.length) return null;

  const split = splitQuestionStem(allLines);
  const questionText = cleanText(split.questionText || allLines[0] || "");
  const bodyLines = split.bodyLines;
  const normalizedAll = normalize([questionText, ...bodyLines].join("\n"));

  const tableLike = /—>|->|=>|dap an\s*:/.test(normalizedAll);
  const positionLike = /keo tha/.test(normalizedAll) && bodyLines.some((line) => /^\s*\d+\s*[.)]/.test(cleanText(line)));
  const tfKeywordLines = bodyLines.filter((line) => /\bđúng\b|\bsai\b/i.test(String(line || "")));
  const tfLike = tfKeywordLines.length >= 2
    && /ch[oọ]n|điền|dung|sai/i.test(normalizedAll)
    && !/keo tha/.test(normalizedAll);

  if (tfLike) {
    const parsed = parseTrueFalse(questionText, bodyLines);
    if (parsed) return parsed;
  }

  if (tableLike) {
    const parsed = parseDragTable(questionText, bodyLines);
    if (parsed) return parsed;
  }

  if (positionLike) {
    const parsed = parseDragPosition(questionText, bodyLines);
    if (parsed) return parsed;
  }

  if (/keo tha/.test(normalizedAll)) {
    const inlineMap = parseDragInlineMappings(questionText, bodyLines);
    if (inlineMap) return inlineMap;
  }

  if (/keo tha/.test(normalizedAll)) {
    const grouped = parseDragGroupedByHeadings(questionText, bodyLines);
    if (grouped) return grouped;
  }

  if (tfKeywordLines.length >= 2) {
    const parsed = parseTrueFalse(questionText, bodyLines);
    if (parsed) return parsed;
  }

  return parseChoice(questionText, bodyLines);
};

const ensureSubject = async () => {
  let subject = await Subject.findOne({ code: SUBJECT_CODE });
  if (!subject) {
    subject = await Subject.findOne({ name: new RegExp("kinh\\s*te\\s*chinh\\s*tri", "i") });
  }

  if (subject || DRY_RUN) return subject;

  const faculty = await Faculty.findOne().sort({ createdAt: 1 });
  const year = await Year.findOne().sort({ createdAt: 1 });
  const semester = await Semester.findOne().sort({ createdAt: 1 });
  if (!faculty || !year || !semester) {
    throw new Error("Không đủ khoa/năm học/học kỳ để tạo môn KTCT");
  }

  return Subject.create({
    name: SUBJECT_NAME,
    code: SUBJECT_CODE,
    icon: "📘",
    description: "Ôn tập Kinh tế chính trị",
    faculty: faculty._id,
    year: year._id,
    semester: semester._id,
  });
};

const ensureLesson = async (subjectId, lessonNo) => {
  let lesson = await Lesson.findOne({ subject: subjectId, order: lessonNo });
  if (lesson || DRY_RUN) return lesson;

  return Lesson.create({
    subject: subjectId,
    title: `Bài ${lessonNo}`,
    order: lessonNo,
    description: `Nhập từ file bai${lessonNo}.txt`,
  });
};

const upsertLessonQuestions = async (lessonId, questionBlocks) => {
  const payloads = [];
  let skipped = 0;

  for (let idx = 0; idx < questionBlocks.length; idx += 1) {
    const parsed = parseQuestion(questionBlocks[idx]);
    if (!parsed || !parsed.question || !Array.isArray(parsed.answers) || !parsed.answers.length) {
      skipped += 1;
      if (VERBOSE_SKIPPED) {
        const sample = cleanText((questionBlocks[idx]?.lines || []).slice(0, 3).join(" | "));
        console.log(`  [SKIP] q=${questionBlocks[idx]?.questionNo || idx + 1} sample=${sample.slice(0, 240)}`);
      }
      continue;
    }

    payloads.push({
      lessonId,
      type: parsed.type,
      question: parsed.question,
      imageUrl: "",
      answers: parsed.answers,
      hint: "",
      points: 1,
      order: idx + 1,
      answerSentence: parsed.answerSentence || "",
      dragItems: parsed.dragItems || [],
      dropTargets: parsed.dropTargets || [],
      blanks: parsed.type === "fill"
        ? parsed.answers.filter((item) => item.isCorrect).map((item) => item.text)
        : [],
    });
  }

  if (DRY_RUN) {
    return { created: payloads.length, updated: 0, removed: 0, skipped };
  }

  const existingCount = await Question.countDocuments({ lessonId });
  await Question.deleteMany({ lessonId });
  if (payloads.length) {
    await Question.insertMany(payloads, { ordered: true });
  }

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
  if (!subject) {
    throw new Error("Không xác định được môn KTCT");
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const lessonFile of LESSON_FILES) {
    const raw = fs.readFileSync(lessonFile.filePath, "utf8");
    const blocks = parseQuestionBlocks(raw);

    const lesson = await ensureLesson(subject._id, lessonFile.lessonNo);
    if (!lesson) {
      throw new Error(`Không xác định được bài ${lessonFile.lessonNo}`);
    }

    const stats = await upsertLessonQuestions(lesson._id, blocks);
    totalCreated += stats.created;
    totalUpdated += stats.updated;
    totalSkipped += stats.skipped;

    console.log(`Bài ${lessonFile.lessonNo}: blocks=${blocks.length}, removed=${stats.removed || 0}, created=${stats.created}, updated=${stats.updated}, skipped=${stats.skipped}`);
  }

  console.log(DRY_RUN ? "[DRY RUN] Import KTCT hoàn tất" : "Import KTCT hoàn tất");
  console.log(`subject=${subject.name} (${subject.code || SUBJECT_CODE})`);
  console.log(`TOTAL created=${totalCreated}, updated=${totalUpdated}, skipped=${totalSkipped}`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Import KTCT thất bại:", error.message);
    process.exit(1);
  });

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const connectDB = require("../config/db");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");
const Faculty = require("../models/Faculty");
const Year = require("../models/Year");
const Semester = require("../models/Semester");

const MONHOC_DIR = path.resolve(__dirname, "..", "..", "monhoc");
const SEED_DIR = path.resolve(__dirname, "..", "seed");

const SUBJECTS_TO_DEPLOY = [
  { name: "Thương mại điện tử", code: "TMDT", file: "tmdt.txt", seedScript: "importTmdtFromStarTxt.js" },
  { name: "Vật lý", code: "VLY", file: "index.html", seedScript: "importVatLyFromHtml.js" },
  { name: "Quản trị học", code: "QTH", file: "qth.txt", seedScript: "importQthFromStarTxt.js" },
  { name: "Pháp luật đại cương", code: "PLDC", file: "PHAP_LUAT_DAI_CUONG.docx", seedScript: "importPldcFromStarDocx.js" },
  { name: "Ngoại ngữ 2", code: "NN2", file: "NGOAI_NGU_2_dap_an.json", seedScript: null } // I'll handle manually or create script
];

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

async function ensureHierarchy() {
  let faculty = await Faculty.findOne({ name: /Kinh tế/i });
  if (!faculty) faculty = (await Faculty.find({}))[0];
  if (!faculty) faculty = await Faculty.create({ name: "Kinh tế", description: "Khoa Kinh tế" });

  let year = await Year.findOne({ value: 1, faculty: faculty._id });
  if (!year) year = await Year.create({ value: 1, label: "Năm 1", faculty: faculty._id });

  let semester = await Semester.findOne({ value: 1, year: year._id });
  if (!semester) semester = await Semester.create({ value: 1, label: "Kỳ 1", year: year._id });

  return { faculty, year, semester };
}

async function ensureSubject(s, hierarchy) {
  let subject = await Subject.findOne({ code: s.code });
  if (!subject) {
    subject = await Subject.create({
      name: s.name,
      code: s.code,
      icon: "science",
      faculty: hierarchy.faculty._id,
      year: hierarchy.year._id,
      semester: hierarchy.semester._id
    });
    console.log(`Created subject: ${s.name} (${s.code})`);
  }
  return subject;
}

async function extractPldcDocx() {
  const docxPath = path.join(MONHOC_DIR, "PHAP_LUAT_DAI_CUONG.docx");
  const outputPath = path.join(MONHOC_DIR, "_pldc_extracted.txt");
  
  if (!fs.existsSync(docxPath)) {
    console.warn(`[SKIP] PLDC Docx not found at ${docxPath}`);
    return;
  }

  console.log(`Extracting text from ${docxPath}...`);
  const result = await mammoth.extractRawText({ path: docxPath });
  const text = result.value;
  fs.writeFileSync(outputPath, text, "utf8");
  console.log(`Extracted text saved to ${outputPath}`);
}

async function importNn2(subject) {
  const jsonPath = path.join(MONHOC_DIR, "NGOAI_NGU_2_dap_an.json");
  if (!fs.existsSync(jsonPath)) {
    console.warn(`[SKIP] NN2 JSON not found at ${jsonPath}`);
    return;
  }

  console.log("Importing NN2 from JSON...");
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  
  // Clean sweep
  const existingLessons = await Lesson.find({ subject: subject._id });
  const ids = existingLessons.map(l => l._id);
  await Question.deleteMany({ lessonId: { $in: ids } });
  await Lesson.deleteMany({ subject: subject._id });

  for (let i = 0; i < data.lessons.length; i++) {
    const l = data.lessons[i];
    const createdLesson = await Lesson.create({
      subject: subject._id,
      title: l.lesson || `Bài ${i + 1}`,
      order: i + 1
    });

    const questionPayloads = l.questions.map((q, idx) => {
      const answers = [];
      if (q.options) {
        for (const [key, text] of Object.entries(q.options)) {
          answers.push({
            text,
            isCorrect: key === q.answer
          });
        }
      }
      
      let type = q.type === "fill_in_blank" ? "fill" : "single";
      
      const payload = {
        lessonId: createdLesson._id,
        type,
        question: (q.passage ? `${q.passage}\n\n` : "") + (q.instruction ? `*${q.instruction}*\n` : "") + q.question,
        answers,
        points: 1,
        order: idx + 1
      };

      if (type === "fill") {
        payload.blanks = Array.isArray(q.answer) ? q.answer : [q.answer];
      }
      
      return payload;
    });

    await Question.insertMany(questionPayloads);
    console.log(`  + Imported ${l.questions.length} questions for ${createdLesson.title}`);
  }
}

async function run() {
  await connectDB();
  const hierarchy = await ensureHierarchy();

  // 1. Rename is already done via command line, but let's extract PLDC
  await extractPldcDocx();

  // 2. Loop subjects
  for (const s of SUBJECTS_TO_DEPLOY) {
    const subjectDoc = await ensureSubject(s, hierarchy);
    
    if (s.code === "NN2") {
      await importNn2(subjectDoc);
    } else if (s.seedScript) {
      console.log(`Running seed script: ${s.seedScript} for ${s.name}...`);
      const scriptPath = path.join(SEED_DIR, s.seedScript);
      
      // We'll run it in-process if we can, or via execSync
      // Running it via spawnSync is easier to avoid env contamination
      const { spawnSync } = require("child_process");
      const result = spawnSync("node", [scriptPath], { stdio: "inherit", cwd: SEED_DIR });
      if (result.status !== 0) {
        console.error(`Error running ${s.seedScript}: exit code ${result.status}`);
      }
    }
  }

  console.log("All data deployed successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error("Deploy failed:", err);
  process.exit(1);
});

require("dotenv").config();
const connectDB = require("../config/db");
const Faculty = require("../models/Faculty");
const Year = require("../models/Year");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const { inferSubjectIcon } = require("../utils/subjectIcon");

const DRY_RUN = process.argv.includes("--dry-run");

const SUBJECT_PLAN = [
  {
    name: "Pháp luật đại cương",
    code: "PLDC",
    facultyKeywords: ["luật", "pháp", "kinh tế", "quản trị", "thương mại"],
    yearValues: [1, 2],
    semesterValues: [1, 2],
    lessons: 9,
  },
  {
    name: "Quản trị học",
    code: "QTH",
    facultyKeywords: ["quản trị", "kinh tế", "thương mại", "doanh"],
    yearValues: [1, 2],
    semesterValues: [1, 2],
    lessons: 9,
  },
  {
    name: "Thương mại điện tử",
    code: "TMDT",
    facultyKeywords: ["thương mại", "kinh tế", "quản trị", "công nghệ"],
    yearValues: [2, 1, 3],
    semesterValues: [1, 2],
    lessons: 9,
  },
];

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .trim();

const byCreatedAt = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);

const pickBestFaculty = (faculties, keywords) => {
  if (!Array.isArray(faculties) || !faculties.length) return null;
  const targetKeywords = (keywords || []).map(normalize).filter(Boolean);
  if (!targetKeywords.length) return faculties.slice().sort(byCreatedAt)[0];

  let best = null;
  let bestScore = -1;
  for (const faculty of faculties) {
    const name = normalize(faculty.name);
    let score = 0;
    for (const keyword of targetKeywords) {
      if (name.includes(keyword)) score += 1;
    }
    if (score > bestScore) {
      best = faculty;
      bestScore = score;
    }
  }
  if (best && bestScore > 0) return best;
  return faculties.slice().sort(byCreatedAt)[0];
};

const pickBestYear = (years, facultyId, preferredValues) => {
  if (!Array.isArray(years) || !years.length) return null;
  const scoped = years.filter((year) => !year.faculty || String(year.faculty) === String(facultyId));
  const pool = scoped.length ? scoped : years;

  for (const value of preferredValues || []) {
    const found = pool.find((year) => Number(year.value) === Number(value));
    if (found) return found;
  }
  return pool.slice().sort(byCreatedAt)[0] || null;
};

const pickBestSemester = (semesters, yearId, preferredValues) => {
  if (!Array.isArray(semesters) || !semesters.length) return null;
  const scoped = semesters.filter((semester) => !semester.year || String(semester.year) === String(yearId));
  const pool = scoped.length ? scoped : semesters;

  for (const value of preferredValues || []) {
    const found = pool.find((semester) => Number(semester.value) === Number(value));
    if (found) return found;
  }
  return pool.slice().sort(byCreatedAt)[0] || null;
};

const ensureYear = async (years, facultyId, preferredValues) => {
  const found = pickBestYear(years, facultyId, preferredValues);
  if (found) return found;

  const value = Number((preferredValues || [1])[0]) || 1;
  const created = await Year.create({ value, label: `Năm ${value}`, faculty: facultyId || null });
  return created;
};

const ensureSemester = async (semesters, yearId, preferredValues) => {
  const found = pickBestSemester(semesters, yearId, preferredValues);
  if (found) return found;

  const value = Number((preferredValues || [1])[0]) || 1;
  const created = await Semester.create({ value, label: `Kỳ ${value}`, year: yearId || null });
  return created;
};

const findSubjectByName = async (name) => {
  const all = await Subject.find({}).select("name faculty year semester code icon");
  const target = normalize(name);
  return all.find((item) => normalize(item.name) === target) || null;
};

const ensureLessons = async (subjectId, count) => {
  const existing = await Lesson.find({ subject: subjectId }).sort({ order: 1, createdAt: 1 });
  const normalizedTitles = new Set(existing.map((lesson) => normalize(lesson.title)));

  const toCreate = [];
  for (let index = 1; index <= count; index += 1) {
    const title = `Bài ${index}`;
    if (!normalizedTitles.has(normalize(title))) {
      toCreate.push({ subject: subjectId, title, order: index });
    }
  }

  if (!toCreate.length) {
    return { created: 0, total: existing.length };
  }

  if (!DRY_RUN) {
    await Lesson.insertMany(toCreate);
  }

  return { created: toCreate.length, total: existing.length + toCreate.length };
};

const upsertSubjectsFromPlan = async () => {
  await connectDB();

  const faculties = await Faculty.find({}).sort({ createdAt: 1 });
  if (!faculties.length) {
    throw new Error("Chưa có dữ liệu ngành học. Hãy tạo ít nhất 1 ngành trước khi import môn.");
  }

  let years = await Year.find({}).sort({ createdAt: 1 });
  let semesters = await Semester.find({}).sort({ createdAt: 1 });

  console.log(DRY_RUN ? "[DRY RUN] Xem trước import môn học" : "Bắt đầu import môn học");

  for (const item of SUBJECT_PLAN) {
    const faculty = pickBestFaculty(faculties, item.facultyKeywords);
    if (!faculty) {
      throw new Error(`Không xác định được ngành cho môn ${item.name}`);
    }

    const year = await ensureYear(years, faculty._id, item.yearValues || [1]);
    years = await Year.find({}).sort({ createdAt: 1 });
    const semester = await ensureSemester(semesters, year._id, item.semesterValues || [1]);
    semesters = await Semester.find({}).sort({ createdAt: 1 });

    const payload = {
      name: item.name,
      code: item.code,
      icon: inferSubjectIcon(item.name),
      faculty: faculty._id,
      year: year._id,
      semester: semester._id,
      description: `Import từ bộ câu hỏi PDF: ${item.name}`,
    };

    const existing = await findSubjectByName(item.name);
    let subjectId = null;
    if (!existing) {
      if (!DRY_RUN) {
        const created = await Subject.create(payload);
        subjectId = created._id;
      }
      console.log(`- [CREATE] ${item.name} -> ${faculty.name} / ${year.label || `Năm ${year.value}`} / ${semester.label || `Kỳ ${semester.value}`}`);
    } else {
      subjectId = existing._id;
      if (!DRY_RUN) {
        await Subject.findByIdAndUpdate(existing._id, payload, { new: false, runValidators: false });
      }
      console.log(`- [UPDATE] ${item.name} -> ${faculty.name} / ${year.label || `Năm ${year.value}`} / ${semester.label || `Kỳ ${semester.value}`}`);
    }

    if (subjectId) {
      const lessonStats = await ensureLessons(subjectId, item.lessons || 9);
      console.log(`  Lessons: +${lessonStats.created}, total ${lessonStats.total}`);
    } else {
      console.log(`  Lessons: sẽ tạo ${(item.lessons || 9)} bài khi chạy không có --dry-run`);
    }
  }

  console.log(DRY_RUN ? "[DRY RUN] Hoàn tất xem trước" : "Import môn học hoàn tất");
  process.exit(0);
};

upsertSubjectsFromPlan().catch((error) => {
  console.error("Import thất bại:", error.message);
  process.exit(1);
});

require("dotenv").config();
const connectDB = require("../config/db");
const Faculty = require("../models/Faculty");
const Year = require("../models/Year");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");

const PLAN = [
  { code: "PLDC", name: "Pháp luật đại cương", yearValue: 1, semesterValue: 1 },
  { code: "QTH", name: "Quản trị học", yearValue: 1, semesterValue: 2 },
  { code: "TMDT", name: "Thương mại điện tử", yearValue: 2, semesterValue: 1 },
];

const FACULTY_NAME = "Kinh tế và Quản trị";

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .toLowerCase()
  .trim();

const ensureFaculty = async () => {
  const all = await Faculty.find({}).sort({ createdAt: 1 });
  const found = all.find((f) => normalize(f.name) === normalize(FACULTY_NAME));
  if (found) return found;
  return Faculty.create({ name: FACULTY_NAME, description: "Ngành kinh tế, quản trị và thương mại" });
};

const ensureYear = async (facultyId, value) => {
  const year = await Year.findOne({ faculty: facultyId, value });
  if (year) return year;
  return Year.create({ faculty: facultyId, value, label: `Năm ${value}` });
};

const ensureSemester = async (yearId, value) => {
  const semester = await Semester.findOne({ year: yearId, value });
  if (semester) return semester;
  return Semester.create({ year: yearId, value, label: `Học kỳ ${value}` });
};

const run = async () => {
  await connectDB();
  const faculty = await ensureFaculty();

  for (const item of PLAN) {
    let subject = await Subject.findOne({ code: item.code });
    if (!subject) {
      const allSubjects = await Subject.find({});
      subject = allSubjects.find((s) => normalize(s.name) === normalize(item.name)) || null;
    }

    if (!subject) {
      console.log(`- [SKIP] Không tìm thấy môn ${item.code}`);
      continue;
    }

    const year = await ensureYear(faculty._id, item.yearValue);
    const semester = await ensureSemester(year._id, item.semesterValue);

    await Subject.findByIdAndUpdate(subject._id, {
      faculty: faculty._id,
      year: year._id,
      semester: semester._id,
      code: item.code,
      name: item.name,
    }, { runValidators: false });

    console.log(`- [OK] ${item.code} -> ${faculty.name} / ${year.label} / ${semester.label}`);
  }

  process.exit(0);
};

run().catch((error) => {
  console.error("Align subject failed:", error.message);
  process.exit(1);
});

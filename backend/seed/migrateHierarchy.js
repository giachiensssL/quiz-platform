require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Year = require("../models/Year");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");

const isDryRun = process.argv.includes("--dry-run");

const pickMostFrequent = (values) => {
  const count = new Map();
  values.forEach((value) => {
    const key = String(value);
    count.set(key, (count.get(key) || 0) + 1);
  });

  let winner = null;
  let max = 0;
  for (const [key, value] of count.entries()) {
    if (value > max) {
      winner = key;
      max = value;
    }
  }

  return { winner, max, distinct: count.size };
};

const buildRelationMaps = (subjects) => {
  const yearToFaculties = new Map();
  const semesterToYears = new Map();

  subjects.forEach((subject) => {
    const yearId = subject?.year ? String(subject.year) : "";
    const facultyId = subject?.faculty ? String(subject.faculty) : "";
    const semesterId = subject?.semester ? String(subject.semester) : "";

    if (yearId && facultyId) {
      if (!yearToFaculties.has(yearId)) yearToFaculties.set(yearId, []);
      yearToFaculties.get(yearId).push(facultyId);
    }

    if (semesterId && yearId) {
      if (!semesterToYears.has(semesterId)) semesterToYears.set(semesterId, []);
      semesterToYears.get(semesterId).push(yearId);
    }
  });

  return { yearToFaculties, semesterToYears };
};

const migrate = async () => {
  await connectDB();

  const subjects = await Subject.find({}, { faculty: 1, year: 1, semester: 1 }).lean();
  const years = await Year.find({}, { faculty: 1 }).lean();
  const semesters = await Semester.find({}, { year: 1 }).lean();

  const { yearToFaculties, semesterToYears } = buildRelationMaps(subjects);

  const yearUpdates = [];
  const yearConflicts = [];

  years.forEach((year) => {
    if (year.faculty) return;

    const linkedFacultyIds = yearToFaculties.get(String(year._id)) || [];
    if (!linkedFacultyIds.length) return;

    const picked = pickMostFrequent(linkedFacultyIds);
    if (!picked.winner) return;

    if (picked.distinct > 1) {
      yearConflicts.push({
        yearId: String(year._id),
        pickedFacultyId: picked.winner,
        totalLinks: linkedFacultyIds.length,
        distinctFaculties: picked.distinct,
      });
    }

    yearUpdates.push({
      updateOne: {
        filter: { _id: year._id, $or: [{ faculty: null }, { faculty: { $exists: false } }] },
        update: { $set: { faculty: picked.winner } },
      },
    });
  });

  const semesterUpdates = [];
  const semesterConflicts = [];

  semesters.forEach((semester) => {
    if (semester.year) return;

    const linkedYearIds = semesterToYears.get(String(semester._id)) || [];
    if (!linkedYearIds.length) return;

    const picked = pickMostFrequent(linkedYearIds);
    if (!picked.winner) return;

    if (picked.distinct > 1) {
      semesterConflicts.push({
        semesterId: String(semester._id),
        pickedYearId: picked.winner,
        totalLinks: linkedYearIds.length,
        distinctYears: picked.distinct,
      });
    }

    semesterUpdates.push({
      updateOne: {
        filter: { _id: semester._id, $or: [{ year: null }, { year: { $exists: false } }] },
        update: { $set: { year: picked.winner } },
      },
    });
  });

  console.log("[hierarchy-migration] mode:", isDryRun ? "dry-run" : "apply");
  console.log("[hierarchy-migration] subjects scanned:", subjects.length);
  console.log("[hierarchy-migration] year candidates:", yearUpdates.length);
  console.log("[hierarchy-migration] semester candidates:", semesterUpdates.length);

  if (yearConflicts.length) {
    console.log("[hierarchy-migration] years with mixed faculties (picked most frequent):", yearConflicts.length);
  }
  if (semesterConflicts.length) {
    console.log("[hierarchy-migration] semesters with mixed years (picked most frequent):", semesterConflicts.length);
  }

  if (!isDryRun) {
    if (yearUpdates.length) {
      const yearResult = await Year.bulkWrite(yearUpdates, { ordered: false });
      console.log("[hierarchy-migration] years modified:", yearResult.modifiedCount || 0);
    } else {
      console.log("[hierarchy-migration] years modified: 0");
    }

    if (semesterUpdates.length) {
      const semesterResult = await Semester.bulkWrite(semesterUpdates, { ordered: false });
      console.log("[hierarchy-migration] semesters modified:", semesterResult.modifiedCount || 0);
    } else {
      console.log("[hierarchy-migration] semesters modified: 0");
    }
  } else {
    console.log("[hierarchy-migration] no data written in dry-run mode");
  }
};

migrate()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[hierarchy-migration] failed:", error.message);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore close errors
    }
    process.exit(1);
  });

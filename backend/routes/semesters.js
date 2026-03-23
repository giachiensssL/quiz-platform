const express = require("express");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const { protect } = require("../middleware/auth");
const { getUserLockSets } = require("../utils/accessControl");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const locks = getUserLockSets(req.user);
    const filters = {};
    if (locks.semesters.size) {
      filters._id = { $nin: [...locks.semesters] };
    }
    if (locks.years.size) {
      filters.year = { $nin: [...locks.years] };
    }

    const semesters = await Semester.find(filters).sort({ value: 1 });
    res.json(semesters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:yearId", protect, async (req, res) => {
  try {
    const locks = getUserLockSets(req.user);
    if (locks.years.has(String(req.params.yearId))) {
      return res.json([]);
    }

    const semesterFilters = { year: req.params.yearId };
    if (locks.semesters.size) {
      semesterFilters._id = { $nin: [...locks.semesters] };
    }

    const directSemesters = await Semester.find(semesterFilters).sort({ value: 1 });
    if (directSemesters.length) {
      return res.json(directSemesters);
    }

    const subjectFilters = { year: req.params.yearId };
    if (locks.semesters.size) {
      subjectFilters.semester = { $nin: [...locks.semesters] };
    }
    if (locks.subjects.size) {
      subjectFilters._id = { $nin: [...locks.subjects] };
    }

    const subjects = await Subject.find(subjectFilters).select("semester").lean();
    const semesterIds = [...new Set(subjects.map((item) => item.semester?.toString()).filter(Boolean))];
    const finalSemesterIds = semesterIds.filter((id) => !locks.semesters.has(String(id)));
    const semesters = await Semester.find({ _id: { $in: finalSemesterIds } }).sort({ value: 1 });
    res.json(semesters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

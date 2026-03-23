const express = require("express");
const Year = require("../models/Year");
const Subject = require("../models/Subject");
const { protect } = require("../middleware/auth");
const { getUserLockSets } = require("../utils/accessControl");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const locks = getUserLockSets(req.user);
    const filters = {};
    if (locks.years.size) {
      filters._id = { $nin: [...locks.years] };
    }
    if (locks.faculties.size) {
      filters.faculty = { $nin: [...locks.faculties] };
    }

    const years = await Year.find(filters).sort({ value: 1 });
    res.json(years);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:facultyId", protect, async (req, res) => {
  try {
    const locks = getUserLockSets(req.user);
    if (locks.faculties.has(String(req.params.facultyId))) {
      return res.json([]);
    }

    const yearFilters = { faculty: req.params.facultyId };
    if (locks.years.size) {
      yearFilters._id = { $nin: [...locks.years] };
    }

    const directYears = await Year.find(yearFilters).sort({ value: 1 });
    if (directYears.length) {
      return res.json(directYears);
    }

    const subjectFilters = { faculty: req.params.facultyId };
    if (locks.years.size) {
      subjectFilters.year = { $nin: [...locks.years] };
    }
    if (locks.semesters.size) {
      subjectFilters.semester = { $nin: [...locks.semesters] };
    }
    if (locks.subjects.size) {
      subjectFilters._id = { $nin: [...locks.subjects] };
    }

    const subjects = await Subject.find(subjectFilters).select("year").lean();
    const yearIds = [...new Set(subjects.map((item) => item.year?.toString()).filter(Boolean))];
    const finalYearIds = yearIds.filter((id) => !locks.years.has(String(id)));
    const years = await Year.find({ _id: { $in: finalYearIds } }).sort({ value: 1 });
    res.json(years);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

const express = require("express");
const Subject = require("../models/Subject");
const { protect } = require("../middleware/auth");
const { getUserLockSets } = require("../utils/accessControl");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const locks = getUserLockSets(req.user);
    const filters = {};
    if (req.query.faculty) filters.faculty = req.query.faculty;
    if (req.query.year) filters.year = req.query.year;
    if (req.query.semester) filters.semester = req.query.semester;

    if (!req.query.faculty && locks.faculties.size) {
      filters.faculty = { $nin: [...locks.faculties] };
    }
    if (!req.query.year && locks.years.size) {
      filters.year = { $nin: [...locks.years] };
    }
    if (!req.query.semester && locks.semesters.size) {
      filters.semester = { $nin: [...locks.semesters] };
    }
    if (locks.subjects.size) filters._id = { $nin: [...locks.subjects] };

    if (req.query.faculty && locks.faculties.has(String(req.query.faculty))) {
      return res.json([]);
    }
    if (req.query.year && locks.years.has(String(req.query.year))) {
      return res.json([]);
    }
    if (req.query.semester && locks.semesters.has(String(req.query.semester))) {
      return res.json([]);
    }

    const subjects = await Subject.find(filters)
      .populate("faculty", "name")
      .populate("year", "value label")
      .populate("semester", "value label")
      .sort({ name: 1 });

    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:semesterId", protect, async (req, res) => {
  try {
    const locks = getUserLockSets(req.user);
    if (locks.semesters.has(String(req.params.semesterId))) {
      return res.json([]);
    }

    const filters = { semester: req.params.semesterId };
    if (req.query.facultyId) filters.faculty = req.query.facultyId;
    if (req.query.yearId) filters.year = req.query.yearId;
    if (!req.query.facultyId && locks.faculties.size) filters.faculty = { $nin: [...locks.faculties] };
    if (!req.query.yearId && locks.years.size) filters.year = { $nin: [...locks.years] };
    if (locks.subjects.size) filters._id = { $nin: [...locks.subjects] };

    if (req.query.facultyId && locks.faculties.has(String(req.query.facultyId))) {
      return res.json([]);
    }
    if (req.query.yearId && locks.years.has(String(req.query.yearId))) {
      return res.json([]);
    }

    const subjects = await Subject.find(filters)
      .populate("faculty", "name")
      .populate("year", "value label")
      .populate("semester", "value label")
      .sort({ name: 1 });

    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

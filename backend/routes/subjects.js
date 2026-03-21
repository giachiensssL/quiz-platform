const express = require("express");
const Subject = require("../models/Subject");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filters = {};
    if (req.query.faculty) filters.faculty = req.query.faculty;
    if (req.query.year) filters.year = req.query.year;
    if (req.query.semester) filters.semester = req.query.semester;

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

router.get("/:semesterId", async (req, res) => {
  try {
    const filters = { semester: req.params.semesterId };
    if (req.query.facultyId) filters.faculty = req.query.facultyId;
    if (req.query.yearId) filters.year = req.query.yearId;

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

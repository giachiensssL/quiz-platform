const express = require("express");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const semesters = await Semester.find().sort({ value: 1 });
    res.json(semesters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:yearId", async (req, res) => {
  try {
    const directSemesters = await Semester.find({ year: req.params.yearId }).sort({ value: 1 });
    if (directSemesters.length) {
      return res.json(directSemesters);
    }

    const subjects = await Subject.find({ year: req.params.yearId }).select("semester").lean();
    const semesterIds = [...new Set(subjects.map((item) => item.semester?.toString()).filter(Boolean))];
    const semesters = await Semester.find({ _id: { $in: semesterIds } }).sort({ value: 1 });
    res.json(semesters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

const express = require("express");
const Lesson = require("../models/Lesson");

const router = express.Router();

router.get("/:subjectId", async (req, res) => {
  try {
    const lessons = await Lesson.find({ subject: req.params.subjectId }).sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

const express = require("express");
const Question = require("../models/Question");

const router = express.Router();

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

router.get("/", async (req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 }).lean();
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:lessonId", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 9, 20);
    const questions = await Question.find({ lessonId: req.params.lessonId }).sort({ order: 1, createdAt: 1 }).lean();
    const randomized = shuffle(questions).slice(0, limit);
    res.json(randomized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

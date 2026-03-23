const express = require("express");
const Question = require("../models/Question");
const Lesson = require("../models/Lesson");
const { protect } = require("../middleware/auth");
const { getUserLockSets, resolveBlockedSubjectIds, isLessonAccessibleForUser } = require("../utils/accessControl");

const router = express.Router();

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

router.get("/", protect, async (req, res) => {
  try {
    const lockSets = getUserLockSets(req.user);
    const blockedSubjectIds = await resolveBlockedSubjectIds(lockSets);

    const lessonFilters = {};
    const or = [];
    if (lockSets.lessons.size) {
      or.push({ _id: { $in: [...lockSets.lessons] } });
    }
    if (blockedSubjectIds.size) {
      or.push({ subject: { $in: [...blockedSubjectIds] } });
    }
    if (or.length) {
      lessonFilters.$or = or;
    }

    let blockedLessonIds = [];
    if (lessonFilters.$or) {
      const blockedLessons = await Lesson.find(lessonFilters).select("_id").lean();
      blockedLessonIds = blockedLessons.map((item) => String(item._id));
    }

    const questionFilters = blockedLessonIds.length ? { lessonId: { $nin: blockedLessonIds } } : {};
    const questions = await Question.find(questionFilters).sort({ createdAt: -1 }).lean();
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:lessonId", protect, async (req, res) => {
  try {
    const allowed = await isLessonAccessibleForUser(req.user, req.params.lessonId);
    if (!allowed) {
      return res.status(403).json({ message: "Bài học này đã bị khóa với tài khoản của bạn" });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 9, 20);
    const questions = await Question.find({ lessonId: req.params.lessonId }).sort({ order: 1, createdAt: 1 }).lean();
    const randomized = shuffle(questions).slice(0, limit);
    res.json(randomized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

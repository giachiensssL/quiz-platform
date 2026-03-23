const express = require("express");
const Lesson = require("../models/Lesson");
const { protect } = require("../middleware/auth");
const { getUserLockSets, resolveBlockedSubjectIds } = require("../utils/accessControl");

const router = express.Router();

router.get("/:subjectId", protect, async (req, res) => {
  try {
    const locks = getUserLockSets(req.user);
    const blockedSubjectIds = await resolveBlockedSubjectIds(locks);
    if (blockedSubjectIds.has(String(req.params.subjectId))) {
      return res.json([]);
    }

    const filters = { subject: req.params.subjectId };
    if (locks.lessons.size) {
      filters._id = { $nin: [...locks.lessons] };
    }

    const lessons = await Lesson.find(filters).sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

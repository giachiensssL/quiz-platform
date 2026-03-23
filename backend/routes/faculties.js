const express = require("express");
const Faculty = require("../models/Faculty");
const { protect } = require("../middleware/auth");
const { getUserLockSets } = require("../utils/accessControl");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const locks = getUserLockSets(req.user);
    const filters = {};
    if (locks.faculties.size) {
      filters._id = { $nin: [...locks.faculties] };
    }

    const faculties = await Faculty.find(filters).sort({ name: 1 });
    res.json(faculties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

const express = require("express");
const Year = require("../models/Year");
const Subject = require("../models/Subject");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const years = await Year.find().sort({ value: 1 });
    res.json(years);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:facultyId", async (req, res) => {
  try {
    const directYears = await Year.find({ faculty: req.params.facultyId }).sort({ value: 1 });
    if (directYears.length) {
      return res.json(directYears);
    }

    const subjects = await Subject.find({ faculty: req.params.facultyId }).select("year").lean();
    const yearIds = [...new Set(subjects.map((item) => item.year?.toString()).filter(Boolean))];
    const years = await Year.find({ _id: { $in: yearIds } }).sort({ value: 1 });
    res.json(years);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

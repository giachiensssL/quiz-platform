const express = require("express");
const Faculty = require("../models/Faculty");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const faculties = await Faculty.find().sort({ name: 1 });
    res.json(faculties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

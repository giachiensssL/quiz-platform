const express = require("express");
const User = require("../models/User");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Lấy danh sách lịch sử làm bài của chính người dùng hiện tại
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("attempts");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Trả về danh sách attempts đã được sắp xếp theo thời gian mới nhất
    const history = [...(user.attempts || [])].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lấy chi tiết một lần làm bài cụ thể
router.get("/attempt/:attemptId", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const attempt = user.attempts.id(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({ message: "Không tìm thấy lần làm bài này" });
    }

    res.json(attempt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

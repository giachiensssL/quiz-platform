const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `avatar-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh (jpg, jpeg, png, webp)"));
  },
});

const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

const signAccessToken = (user) => {
  return jwt.sign({ id: user._id, username: user.username, role: user.role, sv: Number(user.sessionVersion || 0) }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });
};

const signRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username, type: "refresh", sv: Number(user.sessionVersion || 0) },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
};

const issueTokens = async (user, options = {}) => {
  const { previousRefreshToken = null, rotateSession = false } = options;
  if (rotateSession) {
    user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  }

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const retained = (user.refreshTokens || []).filter((item) => item !== previousRefreshToken);
  user.refreshTokens = [refreshToken, ...retained].slice(0, 10);
  await user.save();

  return {
    token,
    refreshToken,
    role: user.role,
    user: {
      id: user._id,
      username: user.username,
      fullName: user.fullName || "",
      avatar: user.avatar || "",
      role: user.role,
    },
  };
};

const computeStreakDays = (attempts = []) => {
  if (!Array.isArray(attempts) || !attempts.length) return 0;

  const uniqueDays = Array.from(new Set(
    attempts
      .map((item) => {
        const raw = item?.createdAt || item?.updatedAt;
        if (!raw) return "";
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return "";
        return date.toISOString().slice(0, 10);
      })
      .filter(Boolean)
  )).sort((a, b) => (a < b ? 1 : -1));

  if (!uniqueDays.length) return 0;

  let streak = 1;
  let cursor = new Date(`${uniqueDays[0]}T00:00:00.000Z`);

  for (let i = 1; i < uniqueDays.length; i += 1) {
    const next = new Date(`${uniqueDays[i]}T00:00:00.000Z`);
    const diffDays = Math.round((cursor.getTime() - next.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      streak += 1;
      cursor = next;
      continue;
    }
    break;
  }

  return streak;
};

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Vui lòng nhập username và mật khẩu" });
    }

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Sai username hoặc mật khẩu" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Sai username hoặc mật khẩu" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Tài khoản của bạn đã bị khóa" });
    }

    const payload = await issueTokens(user, { rotateSession: true });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Thiếu refresh token" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Refresh token không hợp lệ" });
    }

    const user = await User.findById(decoded.id);
    if (!user || !(user.refreshTokens || []).includes(refreshToken)) {
      return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ" });
    }

    if (Number(decoded.sv || 0) !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ message: "Phiên đăng nhập đã hết hiệu lực" });
    }

    const payload = await issueTokens(user, { previousRefreshToken: refreshToken, rotateSession: false });
    return res.json(payload);
  } catch (error) {
    return res.status(401).json({ message: "Không thể làm mới phiên đăng nhập" });
  }
});

router.post("/logout", verifyToken, async (req, res) => {
  try {
    req.user.refreshTokens = [];
    req.user.sessionVersion = Number(req.user.sessionVersion || 0) + 1;
    await req.user.save();

    return res.json({ message: "Đăng xuất thành công" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({ path: "attempts.lesson", select: "title" })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const attempts = Array.isArray(user.attempts) ? user.attempts : [];
    const totalAttempts = attempts.length;
    const totalScore = attempts.reduce((sum, item) => sum + Number(item?.score || 0), 0);
    const totalCorrect = attempts.reduce((sum, item) => sum + Number(item?.correct || 0), 0);
    const totalIncorrect = attempts.reduce((sum, item) => sum + Number(item?.incorrect || 0), 0);
    const totalAnswered = totalCorrect + totalIncorrect;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const bestScore = attempts.reduce((max, item) => Math.max(max, Number(item?.score || 0)), 0);

    const recentActivities = [...attempts]
      .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
      .slice(0, 5)
      .map((item) => {
        const correct = Number(item?.correct || 0);
        const incorrect = Number(item?.incorrect || 0);
        const answered = correct + incorrect;
        const activityAccuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
        return {
          id: String(item?._id || ""),
          lessonName: item?.lesson?.title || "Bài học",
          score: Number(item?.score || 0),
          total: Number(item?.total || 0),
          correct,
          incorrect,
          accuracy: activityAccuracy,
          createdAt: item?.createdAt || null,
        };
      });

    return res.json({
      user: {
        id: String(user._id),
        username: user.username,
        fullName: user.fullName || "",
        email: user.email || "",
        avatar: user.avatar || "",
        role: user.role,
        createdAt: user.createdAt,
      },
      stats: {
        totalAttempts,
        accuracy,
        totalScore,
        bestScore,
        streakDays: computeStreakDays(attempts),
      },
      recentActivities,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/profile", verifyToken, upload.single("avatar"), async (req, res) => {
  try {
    const { fullName } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (fullName !== undefined) {
      user.fullName = fullName.trim();
    }

    if (req.file) {
      // Remove old avatar if exists
      if (user.avatar && user.avatar.startsWith("/uploads/")) {
        const oldPath = path.join(__dirname, "..", user.avatar);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.error("Error removing old avatar:", e);
          }
        }
      }
      user.avatar = `/uploads/${req.file.filename}`;
    }

    await user.save();

    return res.json({
      message: "Cập nhật hồ sơ thành công",
      user: {
        id: String(user._id),
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;

const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

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
  user.refreshTokens = [refreshToken, ...retained].slice(0, 1);
  await user.save();

  return {
    token,
    refreshToken,
    role: user.role,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
    },
  };
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

module.exports = router;

const express = require("express");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

const SESSION_TTL_MS = 90 * 1000;
const sessions = new Map();
let totalVisits = 0;
let peakOnline = 0;

const cleanupSessions = () => {
  const now = Date.now();
  for (const [sessionId, info] of sessions.entries()) {
    if (now - info.lastSeenAt > SESSION_TTL_MS) sessions.delete(sessionId);
  }
};

const normalizeSessionId = (value) => String(value || "").trim();

router.post("/track", (req, res) => {
  cleanupSessions();
  const sessionId = normalizeSessionId(req.body?.sessionId);
  if (!sessionId) return res.status(400).json({ message: "Thiếu sessionId" });

  const now = Date.now();
  if (!sessions.has(sessionId)) {
    totalVisits += 1;
    sessions.set(sessionId, { firstSeenAt: now, lastSeenAt: now, path: String(req.body?.path || "") });
  } else {
    const prev = sessions.get(sessionId);
    sessions.set(sessionId, { ...prev, lastSeenAt: now, path: String(req.body?.path || prev.path || "") });
  }

  if (sessions.size > peakOnline) peakOnline = sessions.size;
  return res.json({ totalVisits, onlineUsers: sessions.size, peakOnline });
});

router.post("/heartbeat", (req, res) => {
  cleanupSessions();
  const sessionId = normalizeSessionId(req.body?.sessionId);
  if (!sessionId) return res.status(400).json({ message: "Thiếu sessionId" });

  const info = sessions.get(sessionId);
  if (!info) {
    const now = Date.now();
    totalVisits += 1;
    sessions.set(sessionId, { firstSeenAt: now, lastSeenAt: now, path: String(req.body?.path || "") });
  } else {
    sessions.set(sessionId, { ...info, lastSeenAt: Date.now() });
  }

  if (sessions.size > peakOnline) peakOnline = sessions.size;
  return res.json({ totalVisits, onlineUsers: sessions.size, peakOnline });
});

router.post("/leave", (req, res) => {
  const sessionId = normalizeSessionId(req.body?.sessionId);
  if (sessionId) sessions.delete(sessionId);
  cleanupSessions();
  return res.json({ totalVisits, onlineUsers: sessions.size, peakOnline });
});

router.get("/summary", verifyToken, isAdmin, (req, res) => {
  cleanupSessions();
  return res.json({
    totalVisits,
    onlineUsers: sessions.size,
    peakOnline,
    trackedSessions: sessions.size,
  });
});

module.exports = router;

require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { WebSocketServer } = require("ws");
const connectDB = require("./config/db");
const User = require("./models/User");
const path = require("path");
const fs = require("fs");
const { setWebSocketServer } = require("./realtime");

const authRoutes = require("./routes/auth");
const facultyRoutes = require("./routes/faculties");
const subjectRoutes = require("./routes/subjects");
const lessonRoutes = require("./routes/lessons");
const questionRoutes = require("./routes/questions");
const submitRoutes = require("./routes/submit");
const adminRoutes = require("./routes/admin");
const leaderboardRoutes = require("./routes/leaderboard");
const yearRoutes = require("./routes/years");
const semesterRoutes = require("./routes/semesters");
const analyticsRoutes = require("./routes/analytics");
const resultsRoutes = require("./routes/results");
const vipRoutes = require("./routes/vip");

const app = express();
const server = http.createServer(app);
// Base64 payload can be ~33% larger than source file. 140mb fits ~100mb input with overhead.
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "140mb";
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const localOriginPatterns = [
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
  /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return localOriginPatterns.some((pattern) => pattern.test(origin));
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Quá nhiều yêu cầu, vui lòng thử lại sau." },
});

const enableRateLimit = String(
  process.env.ENABLE_RATE_LIMIT || (process.env.NODE_ENV === "production" ? "true" : "false")
).toLowerCase() === "true";

app.use(helmet());
if (enableRateLimit) {
  app.use(limiter);
}
app.use(cors(corsOptions));
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use(morgan("tiny"));
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// Serve uploads
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

app.use("/api/auth", authRoutes);
app.use("/api/faculties", facultyRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/submit", submitRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/years", yearRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/vip", vipRoutes);

app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);

  if (err?.name === "CastError") {
    return res.status(400).json({ message: "Dữ liệu liên kết không hợp lệ. Vui lòng chọn lại danh mục." });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc." });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: "Môn học đã tồn tại trong danh mục đã chọn." });
  }

  const statusCode = Number(err.statusCode || err.status || 500);
  return res.status(statusCode).json({ message: err.message || "Lỗi hệ thống" });
});

const ensureDefaultAdmin = async () => {
  const adminUsernameRaw = (process.env.ADMIN_USERNAME || "Janscient125").trim();
  const adminUsername = adminUsernameRaw.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Janscient2005";
  const resetOnBoot = String(process.env.ADMIN_RESET_ON_BOOT || "false").toLowerCase() === "true";

  await User.updateMany({ role: "admin", username: { $ne: adminUsername } }, { $set: { role: "user" } });

  const existing = await User.findOne({ username: adminUsername });

  if (!existing) {
    await User.create({ username: adminUsername, password: adminPassword, role: "admin", isBlocked: false });
    console.log(`Default admin created: ${adminUsernameRaw}`);
    return;
  }

  if (resetOnBoot) {
    existing.password = adminPassword;
  }

  existing.username = adminUsername;
  existing.role = "admin";
  existing.isBlocked = false;
  await existing.save();
  console.log(`Default admin synced: ${adminUsernameRaw}`);
};

const PORT = process.env.PORT || 5001;
connectDB()
  .then(async () => {
    await ensureDefaultAdmin();
    const wsServer = new WebSocketServer({ server, path: "/ws" });
    wsServer.on("connection", (socket) => {
      socket.send(JSON.stringify({ event: "connected", timestamp: Date.now() }));
    });
    setWebSocketServer(wsServer);

    server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("Backend startup failed", error);
    process.exit(1);
  });

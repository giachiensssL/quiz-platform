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

const app = express();
const server = http.createServer(app);
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "8mb";
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
};

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Quá nhiều yêu cầu, vui lòng thử lại sau." },
});

app.use(helmet());
app.use(limiter);
app.use(cors(corsOptions));
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use(morgan("tiny"));
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

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

app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const statusCode = Number(err.statusCode || err.status || 500);
  return res.status(statusCode).json({ message: err.message || "Lỗi hệ thống" });
});

const ensureDefaultAdmin = async () => {
  const adminUsernameRaw = (process.env.ADMIN_USERNAME || "Janscient125").trim();
  const adminUsername = adminUsernameRaw.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Janscient2005";
  const resetOnBoot = String(process.env.ADMIN_RESET_ON_BOOT || "false").toLowerCase() === "true";

  try {
    await User.collection.dropIndex("email_1");
    console.log("Dropped legacy index: users.email_1");
  } catch (error) {
    if (error.codeName !== "IndexNotFound") {
      console.warn("Skip dropping legacy index email_1:", error.message);
    }
  }

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

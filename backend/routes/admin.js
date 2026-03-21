const express = require("express");
const User = require("../models/User");
const Faculty = require("../models/Faculty");
const Year = require("../models/Year");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { broadcast } = require("../realtime");
const { inferSubjectIcon } = require("../utils/subjectIcon");

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "Janscient125").trim().toLowerCase();
const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};
const notifyCatalogUpdated = () => {
  broadcast("catalog-updated", { source: "admin" });
};

const TYPE_MAP = {
  single: "single",
  single_choice: "single",
  multiple: "multiple",
  multiple_choice: "multiple",
  truefalse: "true_false",
  true_false: "true_false",
  "true/false": "true_false",
  fill: "fill",
  fill_blank: "fill",
  drag: "drag_drop",
  "drag-drop": "drag_drop",
  drag_drop: "drag_drop",
};

const normalizeType = (rawType) => TYPE_MAP[String(rawType || "").trim().toLowerCase()] || null;

const sanitizeAnswers = (answers, type) => {
  const normalized = (Array.isArray(answers) ? answers : [])
    .map((item) => ({
      text: String(item?.text || "").trim(),
      imageUrl: String(item?.imageUrl || "").trim(),
      isCorrect: Boolean(item?.isCorrect),
    }))
    .filter((item) => item.text || item.imageUrl);

  if (type === "true_false") {
    if (normalized.length < 1) {
      throw badRequest("Câu hỏi đúng/sai phải có ít nhất 1 ý");
    }
  }

  if (type === "single") {
    const correctCount = normalized.filter((item) => item.isCorrect).length;
    if (correctCount !== 1) {
      throw badRequest("Câu hỏi một đáp án đúng chỉ được có 1 đáp án đúng");
    }
  }

  if (type === "multiple") {
    if (normalized.length < 2) {
      throw badRequest("Câu hỏi nhiều đáp án đúng phải có tối thiểu 2 đáp án");
    }
    const correctCount = normalized.filter((item) => item.isCorrect).length;
    if (correctCount < 1) {
      throw badRequest("Câu hỏi nhiều đáp án đúng phải có ít nhất 1 đáp án đúng");
    }
  }

  if (type === "fill" && normalized.length < 1) {
    throw badRequest("Câu hỏi điền khuyết cần ít nhất 1 đáp án chuẩn");
  }

  return normalized;
};

const sanitizeDragItems = (dragItems) => {
  return (Array.isArray(dragItems) ? dragItems : [])
    .map((item, idx) => ({
      id: String(item?.id || `item-${idx + 1}`).trim(),
      label: String(item?.label || "").trim(),
    }))
    .filter((item) => item.id && item.label);
};

const sanitizeDropTargets = (dropTargets, dragItems) => {
  const validDragIds = new Set((Array.isArray(dragItems) ? dragItems : []).map((item) => item.id));
  return (Array.isArray(dropTargets) ? dropTargets : [])
    .map((target, idx) => {
      const rawIds = Array.isArray(target?.correctItemIds)
        ? target.correctItemIds
        : (target?.correctItemId ? [target.correctItemId] : []);
      const correctItemIds = [...new Set(rawIds.map((id) => String(id || "").trim()).filter((id) => validDragIds.has(id)))];
      return {
        id: String(target?.id || `slot-${idx + 1}`).trim(),
        label: String(target?.label || `Vị trí ${idx + 1}`).trim(),
        correctItemId: correctItemIds[0] || "",
        correctItemIds,
      };
    })
    .filter((target) => target.id && target.label);
};

const buildQuestionPayload = (body) => {
  const lessonId = body.lessonId || body.lesson;
  const question = String(body.question || body.text || "").trim();
  const type = normalizeType(body.type);

  if (!lessonId) {
    throw badRequest("Thiếu lessonId");
  }
  if (!question) {
    throw badRequest("Thiếu nội dung câu hỏi");
  }
  if (!type) {
    throw badRequest("Loại câu hỏi không hợp lệ");
  }

  const answers = sanitizeAnswers(body.answers, type);
  const dragItems = sanitizeDragItems(body.dragItems);
  const dropTargets = sanitizeDropTargets(body.dropTargets, dragItems);
  const points = Number(body.points || 1);
  const imageUrl = String(body.imageUrl || "").trim();

  if (type === "drag_drop") {
    if (dragItems.length < 2) {
      throw badRequest("Câu kéo thả cần ít nhất 2 mục kéo");
    }
    if (dropTargets.length < 1) {
      throw badRequest("Câu kéo thả cần ít nhất 1 ô đích");
    }
    if (dropTargets.some((target) => target.correctItemIds.length < 1)) {
      throw badRequest("Mỗi ô đích phải có ít nhất 1 đáp án đúng");
    }
  }

  return {
    lessonId,
    question,
    imageUrl,
    type,
    answers,
    points: Number.isNaN(points) ? 1 : points,
    hint: String(body.hint || ""),
    order: Number(body.order || 0) || 0,
    dragItems,
    dropTargets,
    blanks: type === "fill" ? answers.filter((item) => item.isCorrect).map((item) => item.text) : [],
  };
};

router.use(verifyToken, isAdmin);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await User.find({}, { refreshTokens: 0 }).sort({ createdAt: -1 });
    res.json(users);
  })
);

router.post(
  "/create-user",
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "user").trim().toLowerCase();
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc mật khẩu" });
    }

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ" });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ message: "Username phải từ 3 đến 30 ký tự" });
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ message: "Username chỉ được chứa chữ, số và . _ -" });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Email không hợp lệ" });
    }

    const normalized = username.trim().toLowerCase();
    if (normalized === ADMIN_USERNAME) {
      return res.status(400).json({ message: "Không thể tạo thêm tài khoản admin" });
    }

    const existing = await User.findOne({ username: normalized });
    if (existing) {
      return res.status(400).json({ message: "Username đã tồn tại" });
    }

    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: "Email đã tồn tại" });
      }
    }

    const user = await User.create({
      username: normalized,
      fullName,
      email: email || undefined,
      password,
      role,
      isBlocked: false,
      attempts: [],
      refreshTokens: [],
    });

    res.status(201).json({
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt,
    });
  })
);

router.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (user.username === ADMIN_USERNAME && req.body?.role && req.body.role !== "admin") {
      return res.status(400).json({ message: "Không thể đổi quyền tài khoản admin hệ thống" });
    }

    if (req.body?.role) {
      const nextRole = String(req.body.role).trim().toLowerCase();
      if (!["user", "admin"].includes(nextRole)) {
        return res.status(400).json({ message: "Vai trò không hợp lệ" });
      }
      user.role = nextRole;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "fullName")) {
      user.fullName = String(req.body.fullName || "").trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "email")) {
      const email = String(req.body.email || "").trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Email không hợp lệ" });
      }
      if (email) {
        const duplicate = await User.findOne({ email, _id: { $ne: user._id } });
        if (duplicate) {
          return res.status(400).json({ message: "Email đã tồn tại" });
        }
      }
      user.email = email || undefined;
    }

    await user.save();
    return res.json({
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt,
    });
  })
);

router.patch(
  "/users/:id/reset-password",
  asyncHandler(async (req, res) => {
    const newPassword = String(req.body?.password || "");
    if (newPassword.trim().length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ message: "Đặt lại mật khẩu thành công" });
  })
);

router.patch(
  "/users/:id/block",
  asyncHandler(async (req, res) => {
    const { blocked } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (user.username === ADMIN_USERNAME || user.role === "admin") {
      return res.status(400).json({ message: "Không thể khóa tài khoản admin" });
    }

    user.isBlocked = Boolean(blocked);
    await user.save();

    res.json({ message: user.isBlocked ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản" });
  })
);

router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: "Không thể xoá tài khoản đang đăng nhập" });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    if (target.username === ADMIN_USERNAME || target.role === "admin") {
      return res.status(400).json({ message: "Không thể xoá tài khoản admin" });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Đã xoá người dùng" });
  })
);

router.get(
  "/faculties",
  asyncHandler(async (req, res) => {
    const data = await Faculty.find().sort({ name: 1 });
    res.json(data);
  })
);

router.post(
  "/faculties",
  asyncHandler(async (req, res) => {
    const created = await Faculty.create({ name: req.body.name, description: req.body.description || "" });
    notifyCatalogUpdated();
    res.status(201).json(created);
  })
);

router.put(
  "/faculties/:id",
  asyncHandler(async (req, res) => {
    const updated = await Faculty.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: false });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy khoa" });
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.delete(
  "/faculties/:id",
  asyncHandler(async (req, res) => {
    await Faculty.findByIdAndDelete(req.params.id);
    notifyCatalogUpdated();
    res.json({ message: "Đã xoá khoa" });
  })
);

router.get(
  "/years",
  asyncHandler(async (req, res) => {
    const data = await Year.find().populate("faculty", "name").sort({ value: 1 });
    res.json(data);
  })
);

router.post(
  "/years",
  asyncHandler(async (req, res) => {
    const created = await Year.create({
      value: req.body.value,
      label: req.body.label || `Năm ${req.body.value}`,
      faculty: req.body.faculty || null,
    });
    notifyCatalogUpdated();
    res.status(201).json(created);
  })
);

router.put(
  "/years/:id",
  asyncHandler(async (req, res) => {
    const updated = await Year.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: false });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy năm học" });
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.delete(
  "/years/:id",
  asyncHandler(async (req, res) => {
    await Year.findByIdAndDelete(req.params.id);
    notifyCatalogUpdated();
    res.json({ message: "Đã xoá năm học" });
  })
);

router.get(
  "/semesters",
  asyncHandler(async (req, res) => {
    const data = await Semester.find().populate("year", "value label").sort({ value: 1 });
    res.json(data);
  })
);

router.post(
  "/semesters",
  asyncHandler(async (req, res) => {
    const created = await Semester.create({
      value: req.body.value,
      label: req.body.label || `Kỳ ${req.body.value}`,
      year: req.body.year || null,
    });
    notifyCatalogUpdated();
    res.status(201).json(created);
  })
);

router.put(
  "/semesters/:id",
  asyncHandler(async (req, res) => {
    const updated = await Semester.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: false });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy học kỳ" });
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.delete(
  "/semesters/:id",
  asyncHandler(async (req, res) => {
    await Semester.findByIdAndDelete(req.params.id);
    notifyCatalogUpdated();
    res.json({ message: "Đã xoá kỳ học" });
  })
);

router.get(
  "/subjects",
  asyncHandler(async (req, res) => {
    const data = await Subject.find().populate("faculty year semester").sort({ name: 1 });
    res.json(data);
  })
);

router.post(
  "/subjects",
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const created = await Subject.create({
      ...req.body,
      name,
      icon: inferSubjectIcon(name),
    });
    notifyCatalogUpdated();
    res.status(201).json(created);
  })
);

router.put(
  "/subjects/:id",
  asyncHandler(async (req, res) => {
    const current = await Subject.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Không tìm thấy môn học" });

    const incomingName = String(req.body?.name ?? current.name ?? "").trim();
    const safeName = incomingName || String(current.name || "").trim() || "Môn học";
    const updated = await Subject.findByIdAndUpdate(
      req.params.id,
      { ...req.body, name: safeName, icon: inferSubjectIcon(safeName) },
      { new: true, runValidators: false }
    );
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.delete(
  "/subjects/:id",
  asyncHandler(async (req, res) => {
    await Lesson.deleteMany({ subject: req.params.id });
    await Subject.findByIdAndDelete(req.params.id);
    notifyCatalogUpdated();
    res.json({ message: "Đã xoá môn học" });
  })
);

router.get(
  "/lessons",
  asyncHandler(async (req, res) => {
    const data = await Lesson.find().populate("subject", "name").sort({ order: 1 });
    res.json(data);
  })
);

router.post(
  "/lessons",
  asyncHandler(async (req, res) => {
    const created = await Lesson.create(req.body);
    notifyCatalogUpdated();
    res.status(201).json(created);
  })
);

router.put(
  "/lessons/:id",
  asyncHandler(async (req, res) => {
    const current = await Lesson.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Không tìm thấy bài học" });

    const incomingTitle = String(req.body?.title ?? current.title ?? "").trim();
    const safeTitle = incomingTitle || String(current.title || "").trim() || "Bài học";

    const updated = await Lesson.findByIdAndUpdate(
      req.params.id,
      { ...req.body, title: safeTitle },
      { new: true, runValidators: false }
    );
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.delete(
  "/lessons/:id",
  asyncHandler(async (req, res) => {
    await Question.deleteMany({ lessonId: req.params.id });
    await Lesson.findByIdAndDelete(req.params.id);
    notifyCatalogUpdated();
    res.json({ message: "Đã xoá bài học" });
  })
);

router.get(
  "/questions",
  asyncHandler(async (req, res) => {
    const data = await Question.find().populate("lessonId", "title").sort({ createdAt: -1 });
    res.json(data);
  })
);

router.post(
  "/questions",
  asyncHandler(async (req, res) => {
    const payload = buildQuestionPayload(req.body);
    const question = await Question.create(payload);
    notifyCatalogUpdated();
    res.status(201).json(question);
  })
);

router.post(
  "/question",
  asyncHandler(async (req, res) => {
    const payload = buildQuestionPayload(req.body);
    const question = await Question.create(payload);
    notifyCatalogUpdated();
    res.status(201).json(question);
  })
);

router.put(
  "/questions/:id",
  asyncHandler(async (req, res) => {
    const payload = buildQuestionPayload(req.body);
    const updated = await Question.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy câu hỏi" });
    }
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.put(
  "/question/:id",
  asyncHandler(async (req, res) => {
    const payload = buildQuestionPayload(req.body);
    const updated = await Question.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy câu hỏi" });
    }
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.delete(
  "/questions/:id",
  asyncHandler(async (req, res) => {
    await Question.findByIdAndDelete(req.params.id);
    notifyCatalogUpdated();
    res.json({ message: "Đã xoá câu hỏi" });
  })
);

router.delete(
  "/question/:id",
  asyncHandler(async (req, res) => {
    await Question.findByIdAndDelete(req.params.id);
    notifyCatalogUpdated();
    res.json({ message: "Đã xoá câu hỏi" });
  })
);

module.exports = router;
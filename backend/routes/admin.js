const express = require("express");
const { isValidObjectId } = require("mongoose");
const User = require("../models/User");
const Faculty = require("../models/Faculty");
const Year = require("../models/Year");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");
const Question = require("../models/Question");
const pdfParse = require("pdf-parse");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { broadcast } = require("../realtime");
const { inferSubjectIcon } = require("../utils/subjectIcon");
const { normalizeAccessLocks } = require("../utils/accessControl");

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

const sanitizeRefId = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  return isValidObjectId(normalized) ? normalized : undefined;
};

const normalizeLooseText = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

const collectHighlightedTextsFromPdf = async (buffer) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { getDocument, Util } = pdfjs;
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;
  const highlightedRaw = [];

  const pointInRect = (x, y, rect, tol = 1.5) => (
    x >= (rect.xMin - tol)
    && x <= (rect.xMax + tol)
    && y >= (rect.yMin - tol)
    && y <= (rect.yMax + tol)
  );

  const toViewportRect = (viewport, quadPoints) => {
    const xs = [];
    const ys = [];

    for (let i = 0; i < quadPoints.length; i += 2) {
      const x = Number(quadPoints[i]);
      const y = Number(quadPoints[i + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const [vx, vy] = viewport.convertToViewportPoint(x, y);
      xs.push(vx);
      ys.push(vy);
    }

    if (!xs.length || !ys.length) return null;
    return {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
    };
  };

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const annotations = await page.getAnnotations({ intent: "display" });

    const textItems = (textContent.items || [])
      .map((item) => {
        const str = String(item?.str || "").trim();
        if (!str) return null;

        const transformed = Util.transform(viewport.transform, item.transform);
        const x = Number(transformed[4] || 0);
        const y = Number(transformed[5] || 0);
        const width = Number(item.width || 0);
        const height = Math.max(Number(item.height || 0), Math.hypot(transformed[2] || 0, transformed[3] || 0) || 0);
        return {
          str,
          centerX: x + width / 2,
          centerY: y - height / 2,
        };
      })
      .filter(Boolean);

    const highlightRects = [];
    (annotations || []).forEach((annotation) => {
      if (annotation?.subtype !== "Highlight") return;
      const quadPoints = Array.isArray(annotation?.quadPoints) ? annotation.quadPoints : [];
      if (quadPoints.length >= 8) {
        for (let i = 0; i <= quadPoints.length - 8; i += 8) {
          const rect = toViewportRect(viewport, quadPoints.slice(i, i + 8));
          if (rect) highlightRects.push(rect);
        }
        return;
      }

      if (Array.isArray(annotation?.rect) && annotation.rect.length === 4) {
        const rect = toViewportRect(viewport, [
          annotation.rect[0], annotation.rect[1],
          annotation.rect[2], annotation.rect[1],
          annotation.rect[2], annotation.rect[3],
          annotation.rect[0], annotation.rect[3],
        ]);
        if (rect) highlightRects.push(rect);
      }
    });

    if (!highlightRects.length) continue;

    const captured = textItems
      .filter((item) => highlightRects.some((rect) => pointInRect(item.centerX, item.centerY, rect)))
      .map((item) => item.str)
      .filter(Boolean);

    if (captured.length) {
      highlightedRaw.push(captured.join(" "));
      captured.forEach((part) => highlightedRaw.push(part));
    }
  }

  const seen = new Set();
  return highlightedRaw
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = normalizeLooseText(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const buildAccessLocksPayload = (rawLocks = {}) => {
  return normalizeAccessLocks(rawLocks);
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
  arrange: "arrange_words",
  arrange_words: "arrange_words",
  sort_words: "arrange_words",
  match: "match_words",
  match_words: "match_words",
  connect_words: "match_words",
  "drag-drop": "drag_drop",
  drag_drop: "drag_drop",
};

const normalizeType = (rawType) => TYPE_MAP[String(rawType || "").trim().toLowerCase()] || null;
const normalizeSentence = (value) => String(value || "").replace(/\s+/g, " ").trim();

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

const deriveDragDropFromLegacyAnswers = (answers) => {
  const ordered = (Array.isArray(answers) ? answers : []).filter((item) => item.text || item.imageUrl);
  if (ordered.length < 2) {
    return { dragItems: [], dropTargets: [] };
  }

  const dragItems = ordered.map((item, idx) => ({
    id: `item-${idx + 1}`,
    label: String(item.text || item.imageUrl || `Muc ${idx + 1}`).trim(),
  }));

  const dropTargets = dragItems.map((item, idx) => ({
    id: `slot-${idx + 1}`,
    label: `Vi tri ${idx + 1}`,
    correctItemId: item.id,
    correctItemIds: [item.id],
  }));

  return { dragItems, dropTargets };
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
  let dragItems = sanitizeDragItems(body.dragItems);
  let dropTargets = sanitizeDropTargets(body.dropTargets, dragItems);
  const points = Number(body.points || 1);
  const imageUrl = String(body.imageUrl || "").trim();
  let answerSentence = normalizeSentence(body.answerSentence || body.expectedSentence || "");

  if (type === "drag_drop" || type === "arrange_words" || type === "match_words") {
    if (dragItems.length < 2 || dropTargets.length < 1) {
      const fallback = deriveDragDropFromLegacyAnswers(answers);
      if (dragItems.length < 2) {
        dragItems = fallback.dragItems;
      }
      if (type !== "match_words" && dropTargets.length < 1) {
        dropTargets = fallback.dropTargets;
      }
    }

    if (dragItems.length < 2) {
      throw badRequest("Câu kéo thả cần ít nhất 2 mục kéo");
    }
    if (type !== "match_words" && dropTargets.length < 1) {
      throw badRequest("Câu kéo thả cần ít nhất 1 ô đích");
    }
    if (type !== "match_words" && dropTargets.some((target) => target.correctItemIds.length < 1)) {
      throw badRequest("Mỗi ô đích phải có ít nhất 1 đáp án đúng");
    }

    if (type === "arrange_words") {
      const hasStrictOrder = dropTargets.length >= 2
        && dropTargets.every((target, idx) => target.correctItemIds.length === 1
          && target.correctItemIds[0] === `item-${idx + 1}`);
      if (!hasStrictOrder) {
        const arrangedTargets = dragItems.map((item, idx) => ({
          id: `slot-${idx + 1}`,
          label: `Vị trí ${idx + 1}`,
          correctItemId: item.id,
          correctItemIds: [item.id],
        }));
        dropTargets = arrangedTargets;
      }
      if (!answerSentence) {
        answerSentence = normalizeSentence(dragItems.map((item) => item.label).join(" "));
      }
    }

    if (type === "match_words") {
      // Match words now stores only the canonical word sequence in dragItems.
      // Drop targets are not required for this mode.
      dropTargets = [];
      if (!answerSentence) {
        answerSentence = normalizeSentence(dragItems.map((item) => item.label).join(" "));
      }
    }

    if ((type === "arrange_words" || type === "match_words") && !answerSentence) {
      throw badRequest("Vui lòng nhập câu đáp án chuẩn cho dạng Sắp xếp từ/Nối từ");
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
    answerSentence,
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
    const users = await User.find({}, { refreshTokens: 0, password: 0 }).sort({ createdAt: -1 });
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
      accessLocks: buildAccessLocksPayload({}),
      attempts: [],
      refreshTokens: [],
    });

    res.status(201).json({
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      plainPassword: user.plainPassword || "",
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

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "username")) {
      const nextUsername = String(req.body.username || "").trim().toLowerCase();
      if (!nextUsername) {
        return res.status(400).json({ message: "Username không được để trống" });
      }
      if (nextUsername.length < 3 || nextUsername.length > 30) {
        return res.status(400).json({ message: "Username phải từ 3 đến 30 ký tự" });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(nextUsername)) {
        return res.status(400).json({ message: "Username chỉ được chứa chữ, số và . _ -" });
      }
      if (nextUsername !== String(user.username || "").toLowerCase()) {
        const existingUser = await User.findOne({ username: nextUsername, _id: { $ne: user._id } });
        if (existingUser) {
          return res.status(400).json({ message: "Username đã tồn tại" });
        }
      }
      user.username = nextUsername;
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

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "password")) {
      const nextPassword = String(req.body.password || "");
      if (nextPassword.trim().length < 6) {
        return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
      }
      user.password = nextPassword;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "accessLocks")) {
      user.accessLocks = buildAccessLocksPayload(req.body.accessLocks);
    }

    await user.save();
    return res.json({
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      plainPassword: user.plainPassword || "",
      role: user.role,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt,
    });
  })
);

router.get(
  "/users/:id/access-locks",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id, { username: 1, role: 1, accessLocks: 1 });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    return res.json({
      userId: String(user._id),
      username: user.username,
      role: user.role,
      accessLocks: buildAccessLocksPayload(user.accessLocks || {}),
    });
  })
);

router.patch(
  "/users/:id/access-locks",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (user.username === ADMIN_USERNAME || user.role === "admin") {
      return res.status(400).json({ message: "Không thể khóa truy cập cho tài khoản admin" });
    }

    user.accessLocks = buildAccessLocksPayload(req.body?.accessLocks || {});
    await user.save();

    return res.json({
      message: "Đã cập nhật danh sách khóa truy cập theo tài khoản",
      accessLocks: buildAccessLocksPayload(user.accessLocks || {}),
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

    return res.json({ message: "Đặt lại mật khẩu thành công", plainPassword: user.plainPassword || "" });
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
    if (!updated) return res.status(404).json({ message: "Không tìm thấy ngành học" });
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.delete(
  "/faculties/:id",
  asyncHandler(async (req, res) => {
    await Faculty.findByIdAndDelete(req.params.id);
    notifyCatalogUpdated();
    res.json({ message: "Đã xoá ngành học" });
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
    const facultyId = sanitizeRefId(req.body?.faculty);
    const yearId = sanitizeRefId(req.body?.year);
    const semesterId = sanitizeRefId(req.body?.semester);

    if (!facultyId || !yearId || !semesterId) {
      return res.status(400).json({ message: "Thiếu hoặc sai định dạng ngành/năm học/học kỳ" });
    }

    const created = await Subject.create({
      ...req.body,
      name,
      icon: inferSubjectIcon(name),
      faculty: facultyId,
      year: yearId,
      semester: semesterId,
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
    const facultyId = sanitizeRefId(req.body?.faculty) || String(current.faculty || "");
    const yearId = sanitizeRefId(req.body?.year) || String(current.year || "");
    const semesterId = sanitizeRefId(req.body?.semester) || String(current.semester || "");

    if (!isValidObjectId(facultyId) || !isValidObjectId(yearId) || !isValidObjectId(semesterId)) {
      return res.status(400).json({ message: "Ngành/Năm học/Học kỳ không hợp lệ" });
    }

    const updated = await Subject.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        name: safeName,
        icon: inferSubjectIcon(safeName),
        faculty: facultyId,
        year: yearId,
        semester: semesterId,
      },
      { new: true, runValidators: false }
    );
    notifyCatalogUpdated();
    res.json(updated);
  })
);

router.delete(
  "/subjects/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID môn học không hợp lệ" });
    }
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

router.post(
  "/import/extract-text",
  asyncHandler(async (req, res) => {
    const fileName = String(req.body?.fileName || "").trim();
    const fileContentBase64 = String(req.body?.fileContentBase64 || "").trim();

    if (!fileName) {
      throw badRequest("Thiếu tên file");
    }
    if (!fileContentBase64) {
      throw badRequest("Thiếu nội dung file");
    }

    const lowerName = fileName.toLowerCase();
    if (!lowerName.endsWith(".pdf")) {
      throw badRequest("Hiện tại chỉ hỗ trợ trích nội dung tự động từ file PDF");
    }

    let buffer;
    try {
      buffer = Buffer.from(fileContentBase64, "base64");
    } catch {
      throw badRequest("Nội dung file không hợp lệ");
    }

    if (!buffer || !buffer.length) {
      throw badRequest("File rỗng hoặc không đọc được");
    }

    const maxBytes = Number(process.env.IMPORT_MAX_FILE_BYTES || 100 * 1024 * 1024);
    if (buffer.length > maxBytes) {
      const error = new Error("File quá lớn. Vui lòng giảm dung lượng trước khi import");
      error.statusCode = 413;
      throw error;
    }

    const parsed = await pdfParse(buffer);
    const text = String(parsed?.text || "").trim();
    let highlightedTexts = [];

    try {
      highlightedTexts = await collectHighlightedTextsFromPdf(buffer);
    } catch (error) {
      highlightedTexts = [];
      console.warn("PDF highlight extraction skipped:", error.message);
    }

    if (!text) {
      throw badRequest("Không đọc được nội dung văn bản từ file PDF");
    }

    res.json({
      fileName,
      pages: Number(parsed?.numpages || 0),
      text,
      highlightedTexts,
    });
  })
);

module.exports = router;


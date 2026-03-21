require("dotenv").config();

const API_BASE = process.env.TEST_API_BASE_URL || "http://localhost:5001/api";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Janscient125";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Janscient2005";

const nowTag = Date.now();

const toJson = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const api = async (path, { method = "GET", token, body } = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await toJson(res);
  if (!res.ok) {
    throw new Error(`[${method}] ${path} failed (${res.status}): ${payload?.message || payload?.raw || "Unknown error"}`);
  }
  return payload;
};

const indexEvaluationByQuestion = (evaluation) => {
  const map = new Map();
  (Array.isArray(evaluation) ? evaluation : []).forEach((item) => {
    map.set(String(item.questionId), item);
  });
  return map;
};

const run = async () => {
  const report = [];
  const created = {
    facultyId: null,
    yearId: null,
    semesterId: null,
    subjectId: null,
    lessonId: null,
  };

  let token = "";

  try {
    const login = await api("/auth/login", {
      method: "POST",
      body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    });
    token = login.token;
    if (!token) throw new Error("Login succeeded but no token returned");

    const faculty = await api("/admin/faculties", {
      method: "POST",
      token,
      body: { name: `Regression Faculty ${nowTag}`, description: "Auto regression test" },
    });
    created.facultyId = String(faculty._id);

    const year = await api("/admin/years", {
      method: "POST",
      token,
      body: { value: 99, label: `Nam Regression ${nowTag}`, faculty: created.facultyId },
    });
    created.yearId = String(year._id);

    const semester = await api("/admin/semesters", {
      method: "POST",
      token,
      body: { value: 1, label: `Ky Regression ${nowTag}`, year: created.yearId },
    });
    created.semesterId = String(semester._id);

    const subject = await api("/admin/subjects", {
      method: "POST",
      token,
      body: {
        name: `Lap trinh Regression ${nowTag}`,
        description: "Subject for API scoring regression",
        faculty: created.facultyId,
        year: created.yearId,
        semester: created.semesterId,
      },
    });
    created.subjectId = String(subject._id);

    const lesson = await api("/admin/lessons", {
      method: "POST",
      token,
      body: {
        subject: created.subjectId,
        title: `Lesson Regression ${nowTag}`,
        description: "Auto-generated lesson",
        order: 1,
      },
    });
    created.lessonId = String(lesson._id);

    const qSingle = await api("/admin/questions", {
      method: "POST",
      token,
      body: {
        lessonId: created.lessonId,
        type: "single",
        text: "Single test question",
        points: 1,
        answers: [
          { text: "Correct single", isCorrect: true },
          { text: "Wrong single", isCorrect: false },
        ],
      },
    });

    const qMultiple = await api("/admin/questions", {
      method: "POST",
      token,
      body: {
        lessonId: created.lessonId,
        type: "multiple",
        text: "Multiple test question",
        points: 1,
        answers: [
          { text: "Correct multiple 1", isCorrect: true },
          { text: "Correct multiple 2", isCorrect: true },
          { text: "Wrong multiple", isCorrect: false },
        ],
      },
    });

    const qTrueFalse = await api("/admin/questions", {
      method: "POST",
      token,
      body: {
        lessonId: created.lessonId,
        type: "truefalse",
        text: "True/false multi statement test",
        points: 1,
        answers: [
          { text: "Statement A", isCorrect: true },
          { text: "Statement B", isCorrect: false },
          { text: "Statement C", isCorrect: true },
        ],
      },
    });

    const qFill = await api("/admin/questions", {
      method: "POST",
      token,
      body: {
        lessonId: created.lessonId,
        type: "fill",
        text: "Fill test question",
        points: 1,
        answers: [
          { text: "nodejs", isCorrect: true },
          { text: "node.js", isCorrect: true },
        ],
      },
    });

    const qDrag = await api("/admin/questions", {
      method: "POST",
      token,
      body: {
        lessonId: created.lessonId,
        type: "drag",
        text: "Drag order test question",
        points: 1,
        answers: [
          { text: "First", isCorrect: true, order: 1 },
          { text: "Second", isCorrect: true, order: 2 },
          { text: "Third", isCorrect: true, order: 3 },
        ],
      },
    });

    const getCorrectAnswerId = (question) => String((question.answers || []).find((a) => a.isCorrect)?._id || "");
    const getWrongAnswerId = (question) => String((question.answers || []).find((a) => !a.isCorrect)?._id || "");

    const correctSubmit = await api("/submit", {
      method: "POST",
      token,
      body: {
        lessonId: created.lessonId,
        answers: [
          { questionId: String(qSingle._id), answer: getCorrectAnswerId(qSingle) },
          {
            questionId: String(qMultiple._id),
            answer: (qMultiple.answers || []).filter((a) => a.isCorrect).map((a) => String(a._id)),
          },
          {
            questionId: String(qTrueFalse._id),
            answer: {
              0: true,
              1: false,
              2: true,
            },
          },
          { questionId: String(qFill._id), answer: "nodejs" },
          { questionId: String(qDrag._id), answer: ["First", "Second", "Third"] },
        ],
        timeSpent: 42,
      },
    });

    const wrongSubmit = await api("/submit", {
      method: "POST",
      token,
      body: {
        lessonId: created.lessonId,
        answers: [
          { questionId: String(qSingle._id), answer: getWrongAnswerId(qSingle) },
          { questionId: String(qMultiple._id), answer: [getWrongAnswerId(qMultiple)] },
          {
            questionId: String(qTrueFalse._id),
            answer: {
              0: false,
              1: true,
              2: false,
            },
          },
          { questionId: String(qFill._id), answer: "java" },
          { questionId: String(qDrag._id), answer: ["Third", "Second", "First"] },
        ],
        timeSpent: 73,
      },
    });

    const correctMap = indexEvaluationByQuestion(correctSubmit.evaluation);
    const wrongMap = indexEvaluationByQuestion(wrongSubmit.evaluation);

    const cases = [
      { type: "single", questionId: String(qSingle._id) },
      { type: "multiple", questionId: String(qMultiple._id) },
      { type: "truefalse", questionId: String(qTrueFalse._id) },
      { type: "fill", questionId: String(qFill._id) },
      { type: "drag", questionId: String(qDrag._id) },
    ];

    cases.forEach((testCase) => {
      const correctItem = correctMap.get(testCase.questionId);
      const wrongItem = wrongMap.get(testCase.questionId);
      const pass = Boolean(correctItem?.isCorrect) && wrongItem?.isCorrect === false;

      report.push({
        type: testCase.type,
        pass,
        details: pass
          ? "correct=true and wrong=false"
          : `correct=${String(correctItem?.isCorrect)} wrong=${String(wrongItem?.isCorrect)}`,
      });
    });

    report.push({
      type: "score(total)",
      pass: Number(correctSubmit.score) === 5 && Number(wrongSubmit.score) === 0,
      details: `correctScore=${correctSubmit.score}, wrongScore=${wrongSubmit.score}`,
    });
  } finally {
    if (token && created.lessonId) {
      try {
        await api(`/admin/lessons/${created.lessonId}`, { method: "DELETE", token });
      } catch {
        // ignore cleanup error
      }
    }
    if (token && created.subjectId) {
      try {
        await api(`/admin/subjects/${created.subjectId}`, { method: "DELETE", token });
      } catch {
        // ignore cleanup error
      }
    }
    if (token && created.semesterId) {
      try {
        await api(`/admin/semesters/${created.semesterId}`, { method: "DELETE", token });
      } catch {
        // ignore cleanup error
      }
    }
    if (token && created.yearId) {
      try {
        await api(`/admin/years/${created.yearId}`, { method: "DELETE", token });
      } catch {
        // ignore cleanup error
      }
    }
    if (token && created.facultyId) {
      try {
        await api(`/admin/faculties/${created.facultyId}`, { method: "DELETE", token });
      } catch {
        // ignore cleanup error
      }
    }
  }

  console.log("\n=== Regression Scoring Report ===");
  report.forEach((item) => {
    console.log(`[${item.pass ? "PASS" : "FAIL"}] ${item.type} -> ${item.details}`);
  });

  const failed = report.filter((item) => !item.pass);
  if (failed.length) {
    console.error(`\nRegression failed: ${failed.length} case(s) failed.`);
    process.exit(1);
  }

  console.log("\nRegression passed: all scoring checks are consistent.");
};

run().catch((error) => {
  console.error("Regression test execution failed:", error.message);
  process.exit(1);
});

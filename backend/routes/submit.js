const express = require("express");
const Question = require("../models/Question");
const { protect } = require("../middleware/auth");
const { broadcast } = require("../realtime");
const { isLessonAccessibleForUser } = require("../utils/accessControl");

const router = express.Router();

const normalize = (value) => `${value ?? ""}`.trim().toLowerCase();
const normalizeSentence = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

const normalizeAnswer = (answer) => {
  if (typeof answer === "string") return normalize(answer);
  if (Array.isArray(answer)) return answer.map((item) => normalize(item));
  return answer;
};

const normalizeType = (type) => {
  const value = normalize(type);
  const map = {
    single: "single",
    single_choice: "single",
    multiple: "multiple",
    multiple_choice: "multiple",
    truefalse: "true_false",
    true_false: "true_false",
    fill: "fill",
    fill_blank: "fill",
    drag: "drag_drop",
    arrange: "arrange_words",
    arrange_words: "arrange_words",
    sort_words: "arrange_words",
    match: "match_words",
    match_words: "match_words",
    connect_words: "match_words",
    drag_drop: "drag_drop",
    "drag-drop": "drag_drop",
  };
  return map[value] || value;
};

const findAnswerById = (options, candidateId) => {
  if (!candidateId) return null;
  return options.find((item) => String(item?._id) === String(candidateId) || String(item?.id) === String(candidateId));
};

router.post("/", protect, async (req, res) => {
  try {
    const { lessonId, answers = [], timeSpent = 0 } = req.body;
    if (!lessonId) {
      return res.status(400).json({ message: "lessonId is required" });
    }

    const lessonAllowed = await isLessonAccessibleForUser(req.user, lessonId);
    if (!lessonAllowed) {
      return res.status(403).json({ message: "Bài học này đã bị khóa với tài khoản của bạn" });
    }

    const questions = await Question.find({ lessonId }).lean();

    if (!questions.length) {
      return res.status(400).json({ message: "No questions found for lesson" });
    }

    const evaluation = [];
    let score = 0;
    let correctCount = 0;
    const totalScore = questions.reduce((sum, question) => sum + (question.points || 1), 0);

    questions.forEach((question) => {
      const userAnswer = answers.find((item) => item.questionId === question._id.toString());
      const type = normalizeType(question.type);
      const answerOptions = Array.isArray(question.answers) ? question.answers : [];

      let isCorrect = false;
      let correctResponse = null;

      if (type === "single") {
        const right = answerOptions.find((item) => item.isCorrect);
        correctResponse = right?.text || "";
        if (userAnswer && userAnswer.answer != null) {
          const selected = findAnswerById(answerOptions, userAnswer.answer);
          const selectedText = selected?.text || userAnswer.answer;
          isCorrect = normalize(selectedText) === normalize(correctResponse);
        }
      }

      if (type === "true_false") {
        if (userAnswer && userAnswer.answer && typeof userAnswer.answer === "object" && !Array.isArray(userAnswer.answer)) {
          // Multi-statement T/F
          const boolMap = userAnswer.answer;
          const totalUnits = answerOptions.length || 1;
          const correctUnits = answerOptions.reduce((sum, answerOption, idx) => {
            // Strictly check if the user selected a boolean value
            const userChoice = boolMap[idx];
            if (userChoice !== true && userChoice !== false) return sum; // Not answered
            
            return sum + (userChoice === Boolean(answerOption.isCorrect) ? 1 : 0);
          }, 0);

          isCorrect = correctUnits === totalUnits && Object.keys(boolMap).length > 0;
          correctResponse = answerOptions.map((item) => Boolean(item.isCorrect));
        } else {
          // Single-choice T/F fallback
          const right = answerOptions.find((item) => item.isCorrect);
          correctResponse = right?.text || "";
          if (userAnswer && userAnswer.answer != null) {
            const selected = findAnswerById(answerOptions, userAnswer.answer);
            const selectedText = selected?.text || userAnswer.answer;
            isCorrect = normalize(selectedText) === normalize(correctResponse);
          }
        }
      }

      if (type === "multiple") {
        const correctValues = answerOptions.filter((item) => item.isCorrect).map((item) => normalize(item.text));
        correctResponse = correctValues;
        if (userAnswer && Array.isArray(userAnswer.answer)) {
          const answered = userAnswer.answer.map((item) => {
            const selected = findAnswerById(answerOptions, item);
            return normalize(selected?.text || item);
          });
          const matchCount = correctValues.filter((value) => answered.includes(value)).length;
          isCorrect = matchCount === correctValues.length && answered.length === correctValues.length;
        }
      }

      if (type === "fill") {
        const valid = answerOptions.filter((item) => item.isCorrect).map((item) => normalize(item.text));
        correctResponse = valid;
        if (userAnswer && userAnswer.answer != null) {
          if (Array.isArray(userAnswer.answer)) {
            const input = userAnswer.answer.map((item) => normalize(item));
            isCorrect = input.length === valid.length && input.every((item, index) => item === valid[index]);
          } else {
            const input = normalize(userAnswer.answer);
            isCorrect = valid.includes(input);
          }
        }
      }

      // True/False evaluation logic moved and unified above to avoid redundancy.

      if (type === "arrange_words") {
        const dragItems = (Array.isArray(question.dragItems) && question.dragItems.length > 0)
          ? question.dragItems
          : (Array.isArray(question.answers) ? question.answers.map((a, idx) => ({ id: a.id || String(idx + 1), label: a.text })) : []);

        const labelById = Object.fromEntries(dragItems.map((item) => [String(item.id || "").trim(), String(item.label || item.text || "").trim()]));
        const expectedSentence = normalizeSentence(question.answerSentence || "");

        if (expectedSentence) {
          correctResponse = expectedSentence;
          if (userAnswer && userAnswer.answer) {
            const actualSentence = normalizeSentence(
              (Array.isArray(userAnswer.answer) ? userAnswer.answer : [userAnswer.answer])
                .map((item) => labelById[String(item || "").trim()] || "")
                .filter(Boolean)
                .join(" ")
            );
            isCorrect = actualSentence === expectedSentence;
          }
        } else {
        const expectedOrderById = dragItems
          .map((item) => String(item.id || "").trim())
          .filter(Boolean);
        correctResponse = expectedOrderById;

        if (userAnswer && userAnswer.answer) {
          const actualOrder = (Array.isArray(userAnswer.answer) ? userAnswer.answer : [userAnswer.answer])
            .map((item) => String(item || "").trim())
            .filter(Boolean);
          isCorrect = expectedOrderById.length === actualOrder.length
            && expectedOrderById.every((id, idx) => id === actualOrder[idx]);
        }
        }
      }

      if (type === "match_words") {
        const dragItems = (Array.isArray(question.dragItems) && question.dragItems.length > 0)
          ? question.dragItems
          : (Array.isArray(question.answers) ? question.answers.map((a, idx) => ({ id: a.id || String(idx + 1), label: a.text })) : []);

        const labelById = Object.fromEntries(dragItems.map((item) => [String(item.id || "").trim(), String(item.label || item.text || "").trim()]));
        const expectedSentence = normalizeSentence(question.answerSentence || "");
        const expectedOrderById = dragItems.map((item) => String(item.id || "").trim()).filter(Boolean);
        correctResponse = expectedSentence || expectedOrderById;

        if (userAnswer && userAnswer.answer) {
          const actualOrder = (Array.isArray(userAnswer.answer) ? userAnswer.answer : [userAnswer.answer])
            .map((item) => String(item || "").trim())
            .filter(Boolean);
          if (expectedSentence) {
            const actualSentence = normalizeSentence(actualOrder.map((id) => labelById[id] || "").filter(Boolean).join(" "));
            isCorrect = actualSentence === expectedSentence;
          } else {
            isCorrect = expectedOrderById.length === actualOrder.length
              && expectedOrderById.every((id, idx) => id === actualOrder[idx]);
          }
        }
      }

      if (type === "drag_drop") {
        correctResponse = question.dropTargets?.map((target) => ({
          target: target.id,
          correctItemId: target.correctItemId,
          correctItemIds: Array.isArray(target.correctItemIds) && target.correctItemIds.length > 0
            ? target.correctItemIds
            : (target.correctItemId ? [target.correctItemId] : []),
        }));

        if (userAnswer && userAnswer.answer) {
          if (Array.isArray(userAnswer.answer)) {
            const expectedOrder = [...answerOptions]
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((item) => normalize(item.text));
            const actualOrder = userAnswer.answer.map((item) => normalize(item));
            isCorrect = expectedOrder.length === actualOrder.length
              && expectedOrder.every((value, idx) => value === actualOrder[idx]);
          } else if (question.dropTargets?.length && typeof userAnswer.answer === "object") {
            isCorrect = question.dropTargets.every((target) => {
              const expected = Array.isArray(target.correctItemIds) && target.correctItemIds.length > 0
                ? target.correctItemIds.map((id) => normalize(id)).filter(Boolean)
                : [normalize(target.correctItemId)].filter(Boolean);
              const actualRaw = userAnswer.answer[target.id];
              const actual = (Array.isArray(actualRaw) ? actualRaw : [actualRaw])
                .map((id) => normalize(id))
                .filter(Boolean);
              if (expected.length !== actual.length) return false;
              return expected.every((id) => actual.includes(id));
            });
          }
        }
      }

      if (isCorrect) {
        score += question.points || 1;
        correctCount += 1;
      }

      evaluation.push({
        questionId: question._id,
        type,
        isCorrect,
        correctAnswer: correctResponse,
        userAnswer: normalizeAnswer(userAnswer?.answer),
        points: question.points || 1,
      });
    });

    req.user.attempts.push({
      lesson: lessonId,
      score,
      total: totalScore,
      correct: correctCount,
      incorrect: questions.length - correctCount,
      timeSpent,
      details: evaluation,
    });
    await req.user.save();

    broadcast("leaderboard-updated", { userId: String(req.user._id) });

    res.json({
      score,
      total: totalScore,
      correct: correctCount,
      incorrect: questions.length - correctCount,
      evaluation,
      history: req.user.attempts.slice(-5).reverse(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

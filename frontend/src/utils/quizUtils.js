export const TYPE_LABELS = {
  single: "Một đáp án",
  multiple: "Nhiều đáp án",
  truefalse: "Đúng / Sai",
  fill: "Điền vào chỗ trống",
  arrange: "Nối/Sắp xếp từ",
  match: "Nối/Sắp xếp từ",
  drag: "Kéo thả",
};

export const isAnswerCorrect = (answer) => Boolean(answer?.correct ?? answer?.isCorrect);
export const isDragQuestionType = (type) => type === "drag";
export const isArrangeQuestionType = (type) => type === 'arrange';
export const isMatchQuestionType = (type) => type === "match" || type === "arrange";
export const optionLabel = (index) => String.fromCharCode(65 + index);
export const sameId = (left, right) => String(left ?? "") === String(right ?? "");
export const normalizeSentence = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

export const evaluateQuestion = (question, userAnswer) => {
  if (question.type === "single") {
    const ok = isAnswerCorrect(question.answers.find((a) => sameId(a.id, userAnswer)));
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  if (question.type === "multiple") {
    const selectedIds = Array.isArray(userAnswer) ? userAnswer.map((id) => String(id)) : [];
    const ok =
      Array.isArray(userAnswer) &&
      question.answers.filter((a) => isAnswerCorrect(a)).every((a) => selectedIds.includes(String(a.id))) &&
      question.answers.filter((a) => !isAnswerCorrect(a)).every((a) => !selectedIds.includes(String(a.id)));
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  if (question.type === "fill") {
    const expected = question.answers.map((a) => String(a.text || "").toLowerCase().trim()).filter(Boolean);
    const ok = expected.includes(String(userAnswer || "").toLowerCase().trim());
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  if (question.type === "truefalse") {
    const picks = userAnswer || {};
    const totalUnits = question.answers.length || 1;
    const earnedUnits = question.answers.reduce((sum, answer, idx) => {
      const expected = isAnswerCorrect(answer);
      return sum + (picks[idx] === expected ? 1 : 0);
    }, 0);
    return { earnedUnits, totalUnits, fullyCorrect: earnedUnits === totalUnits };
  }

  if (isDragQuestionType(question.type)) {
    const targets = Array.isArray(question.dropTargets) ? question.dropTargets : [];
    const answerMap = userAnswer && typeof userAnswer === "object" && !Array.isArray(userAnswer) ? userAnswer : {};
    const totalUnits = targets.length || 1;
    const earnedUnits = targets.reduce((sum, target) => {
      const expected = Array.isArray(target.correctItemIds)
        ? target.correctItemIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [String(target.correctItemId || "").trim()].filter(Boolean);
      const actualRaw = answerMap[target.id];
      const actual = (Array.isArray(actualRaw) ? actualRaw : [actualRaw])
        .map((id) => String(id || "").trim())
        .filter(Boolean);
      if (expected.length !== actual.length) return sum;
      return sum + (expected.every((id) => actual.includes(id)) ? 1 : 0);
    }, 0);
    return { earnedUnits, totalUnits, fullyCorrect: earnedUnits === totalUnits && targets.length > 0 };
  }

  if (isMatchQuestionType(question.type)) {
    const labelById = Object.fromEntries(
      (Array.isArray(question.dragItems) ? question.dragItems : []).map((item) => [
        String(item.id || ""),
        item.label || String(item.id || ""),
      ])
    );
    const expectedSentence = normalizeSentence(question.answerSentence || "");
    const actualSentence = normalizeSentence(
      (Array.isArray(userAnswer) ? userAnswer : [])
        .map((id) => labelById[String(id)] || "")
        .filter(Boolean)
        .join(" ")
    );
    const ok = actualSentence === expectedSentence;
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  return { earnedUnits: 0, totalUnits: 1, fullyCorrect: false };
};

export const buildComparison = (question, userAnswer) => {
  const chosenItems = [];
  const correctItems = [];

  if (question.type === "single" || question.type === "multiple") {
    const selectedIds = Array.isArray(userAnswer) ? userAnswer.map(String) : [String(userAnswer)];
    question.answers.forEach((a, i) => {
      const label = optionLabel(i);
      const text = a.text || "";
      if (selectedIds.includes(String(a.id))) chosenItems.push({ label, text });
      if (isAnswerCorrect(a)) correctItems.push({ label, text });
    });
  } else if (question.type === "fill") {
    chosenItems.push({ label: "Văn bản", text: String(userAnswer || "") });
    question.answers.forEach((a, i) => {
      if (isAnswerCorrect(a)) correctItems.push({ label: `Đáp án ${i + 1}`, text: a.text });
    });
  } else if (question.type === "truefalse") {
    const picks = userAnswer || {};
    question.answers.forEach((a, i) => {
      const label = `Ý ${i + 1}`;
      const pick = picks[i];
      const correct = isAnswerCorrect(a);
      chosenItems.push({ label, text: pick === true ? "Đúng" : pick === false ? "Sai" : "Chưa chọn" });
      correctItems.push({ label, text: correct ? "Đúng" : "Sai" });
    });
  } else if (isDragQuestionType(question.type)) {
    const labelById = Object.fromEntries(
      (Array.isArray(question.dragItems) ? question.dragItems : []).map((item) => [
        String(item.id || ""),
        item.label || String(item.id || ""),
      ])
    );
    const targets = Array.isArray(question.dropTargets) ? question.dropTargets : [];
    const answerMap = userAnswer && typeof userAnswer === "object" && !Array.isArray(userAnswer) ? userAnswer : {};

    targets.forEach((target) => {
      const actualRaw = answerMap[target.id];
      const actual = (Array.isArray(actualRaw) ? actualRaw : [actualRaw]).map(String).filter(Boolean);
      const expected = Array.isArray(target.correctItemIds)
        ? target.correctItemIds.map(String).filter(Boolean)
        : [String(target.correctItemId || "")].filter(Boolean);

      const actualLabels = actual.map((id) => labelById[id] || "?");
      const expectedLabels = expected.map((id) => labelById[id] || "?");

      chosenItems.push({ label: target.label || "Vị trí", text: actualLabels.join(", ") || "(Trống)" });
      correctItems.push({ label: target.label || "Vị trí", text: expectedLabels.join(", ") });
    });
  } else if (isMatchQuestionType(question.type)) {
    const labelById = Object.fromEntries(
      (Array.isArray(question.dragItems) ? question.dragItems : []).map((item) => [
        String(item.id || ""),
        item.label || String(item.id || ""),
      ])
    );
    const actualOrder = (Array.isArray(userAnswer) ? userAnswer : []).map(String).filter(Boolean);
    const actualSentence = actualOrder.map((id) => labelById[id] || "").join(" ");
    chosenItems.push({ label: "Câu ghép", text: actualSentence || "(Trống)" });
    correctItems.push({ label: "Câu đúng", text: question.answerSentence || "" });
  }

  return { chosenItems, correctItems };
};

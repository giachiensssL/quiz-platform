import mammoth from 'mammoth';

const QUESTION_HEADER_PATTERNS = [
  /^(?:cau|câu)\s*(?:hoi|hỏi)?\s*(?:so|số)?\s*\d+\s*[:.)-]?\s*(.*)$/i,
  /^(?:cau|câu|question)\s*\d+\s*[:.)-]?\s*(.*)$/i,
  /^(?:q)\s*\d+\s*[:.)-]?\s*(.*)$/i,
  /^\d+\s*[).:\-]\s*(.*)$/,
];

const QUESTION_MARKER_RE = /(?:^|\n)\s*(?:câu|cau|question|q)\s*(?:hỏi|hoi)?\s*(?:số|so)?\s*\d+\s*[:.)-]?/gim;
const OPTION_RE = /^(?:[-*•]\s*)?([A-H]|\d+)[\s]*[\).:\-\/]?[\s]*(.*)$/i;
const SIMPLE_OPTION_RE = /^(?:[-*•]\s*)?([A-H])[\s]+(.+)$/i;
const ANSWER_KEY_RE = /^(?:dap an(?:\s+dung)?|đáp án(?:\s+đúng)?|answer(?:\s+key)?|ans|key)(?:\s*(?:la|là|is))?\s*[:\-]?\s*(.+)$/i;
const FILL_HINT_RE = /_{2,}|\.{3,}|\(\s*\.\.\.\s*\)/;
const ORDER_KEYWORDS = ['sap xep', 'sắp xếp', 'thu tu', 'thứ tự', 'keo tha', 'kéo thả', 'arrange', 'order'];

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeLoose = (value) => normalizeText(value).toLowerCase();
const removeLeadingBullet = (line) => String(line || '').replace(/^(?:[-*•]\s*)+/, '').trim();

const decodeHtmlEntities = (html) => {
  return String(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
};

const htmlToPlainText = (html) => {
  return decodeHtmlEntities(String(html || ''))
    .replace(/<a\b[^>]*>/gi, ' [[LINK]] ')
    .replace(/<\/a>/gi, ' [[\/LINK]] ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const getQuestionHeaderText = (line) => {
  const normalized = removeLeadingBullet(line);
  for (const pattern of QUESTION_HEADER_PATTERNS) {
    const matched = normalized.match(pattern);
    if (matched) return normalizeText(matched[1]);
  }
  return null;
};

const extractInlineOptions = (line) => {
  const source = String(line || '');
  const regex = /(^|\s)([A-H])[\).:\-]\s*([^]+?)(?=(\s+[A-H][\).:\-]\s*)|$)/gi;
  const matches = [];
  let m;
  while ((m = regex.exec(source))) {
    const label = String(m[2] || '').toUpperCase();
    const raw = normalizeText(m[3] || '');
    if (label && raw) matches.push({ label, raw });
  }
  return matches;
};

const extractAnswerLabels = (raw) => {
  const labels = String(raw || '').toUpperCase().match(/[A-H]|\d+/g) || [];
  return [...new Set(labels)];
};

const extractAnswerTextValues = (raw) => {
  return String(raw || '')
    .split(/[;,|/]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const extractCorrect = (raw) => {
  const text = String(raw || '');
  const lower = text.toLowerCase();
  const correct =
    /^\s*[*+]\s*/.test(text)
    || /\[\[link\]\]/i.test(text)
    || /\[(x|\u2713)\]/i.test(text)
    || /(\(|\[)\s*(dung|đúng|true|correct)\s*(\)|\])/i.test(lower)
    || /\u2705/.test(text);

  const cleaned = text
    .replace(/^\s*[*+]\s*/, '')
    .replace(/\[\[\/?link\]\]/ig, '')
    .replace(/\[(x|\u2713)\]/ig, '')
    .replace(/(\(|\[)\s*(dung|đúng|true|correct)\s*(\)|\])/ig, '')
    .replace(/\u2705/g, '')
    .trim();

  return { cleaned, correct };
};

const splitQuestionBlocks = (rawText) => {
  const lines = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => removeLeadingBullet(line))
    .filter(Boolean);

  const blocks = [];
  let current = null;

  lines.forEach((line) => {
    const headerText = getQuestionHeaderText(line);
    if (headerText !== null) {
      if (current) blocks.push(current);
      current = { head: headerText, lines: [] };
      return;
    }
    if (current) current.lines.push(line);
  });

  if (current) blocks.push(current);
  if (!blocks.length && lines.length) blocks.push({ head: '', lines });
  return blocks;
};

const inferType = (questionText, parsedOptions, answerTexts) => {
  const lowerQuestion = normalizeLoose(questionText);
  const hasOrderKeyword = ORDER_KEYWORDS.some((kw) => lowerQuestion.includes(kw));
  if (hasOrderKeyword && parsedOptions.length >= 2) return 'drag';

  if (FILL_HINT_RE.test(questionText)) return 'fill';
  if (answerTexts.length && !parsedOptions.length) return 'fill';

  const lowerOptions = parsedOptions.map((item) => normalizeLoose(item.text));
  if (
    parsedOptions.length === 2
    && lowerOptions.some((t) => t.includes('đúng') || t.includes('dung') || t.includes('true'))
    && lowerOptions.some((t) => t.includes('sai') || t.includes('false'))
  ) {
    return 'truefalse';
  }

  const correctCount = parsedOptions.filter((item) => item.correct).length;
  return correctCount > 1 ? 'multiple' : 'single';
};

const parseBlock = (block) => {
  const optionRows = [];
  const questionRows = [];
  let answerLabels = [];
  let answerTexts = [];

  (block.lines || []).forEach((line) => {
    const answerKey = line.match(ANSWER_KEY_RE);
    if (answerKey) {
      answerLabels = extractAnswerLabels(answerKey[1]);
      answerTexts = extractAnswerTextValues(answerKey[1]);
      return;
    }

    const opt = removeLeadingBullet(line).match(OPTION_RE);
    if (opt && normalizeText(opt[2])) {
      optionRows.push({ label: String(opt[1]).toUpperCase(), raw: opt[2] });
      return;
    }

    const simple = removeLeadingBullet(line).match(SIMPLE_OPTION_RE);
    if (simple) {
      optionRows.push({ label: String(simple[1]).toUpperCase(), raw: simple[2] });
      return;
    }

    const inline = extractInlineOptions(line);
    if (inline.length >= 2) {
      optionRows.push(...inline);
      return;
    }

    if (optionRows.length) {
      optionRows[optionRows.length - 1].raw = `${optionRows[optionRows.length - 1].raw} ${line}`;
    } else {
      questionRows.push(line);
    }
  });

  const text = normalizeText([block.head, ...questionRows].filter(Boolean).join(' '));
  if (!text) return null;

  const parsedOptions = optionRows
    .map((item) => {
      const { cleaned, correct } = extractCorrect(item.raw);
      return { label: item.label, text: normalizeText(cleaned), imageUrl: '', correct };
    })
    .filter((item) => item.text);

  if (answerLabels.length) {
    parsedOptions.forEach((item) => {
      item.correct = answerLabels.includes(item.label);
    });
  }

  const type = inferType(text, parsedOptions, answerTexts);

  if (type === 'fill') {
    const fillAnswers = (answerTexts.length ? answerTexts : parsedOptions.filter((item) => item.correct).map((item) => item.text))
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .map((item) => ({ text: item, imageUrl: '', correct: true }));

    if (!fillAnswers.length) return null;
    return { text, type: 'fill', imageUrl: '', answers: fillAnswers };
  }

  if (parsedOptions.length < 2) return null;

  const hasCorrect = parsedOptions.some((item) => item.correct);
  if (!hasCorrect) parsedOptions[0].correct = true;

  if (type === 'drag') {
    const answers = parsedOptions.map((item, idx) => ({
      text: item.text,
      imageUrl: '',
      correct: true,
      order: idx + 1,
    }));
    const dragItems = parsedOptions.map((item, idx) => ({ id: `item-${idx + 1}`, label: item.text }));
    const dropTargets = parsedOptions.map((_, idx) => ({
      id: `slot-${idx + 1}`,
      label: `Vi tri ${idx + 1}`,
      correctItemId: `item-${idx + 1}`,
    }));

    return { text, type: 'drag', imageUrl: '', answers, dragItems, dropTargets };
  }

  const finalType = type === 'truefalse' ? 'truefalse' : inferType(text, parsedOptions, answerTexts);
  return {
    text,
    type: finalType,
    imageUrl: '',
    answers: parsedOptions.map(({ label, ...rest }) => rest),
  };
};

const dedupeQuestions = (items) => {
  // Keep original order and only remove immediate exact duplicates produced by mixed parse paths.
  const out = [];
  let lastKey = '';
  (items || []).forEach((item) => {
    const key = `${normalizeLoose(item.text)}|${item.type}|${(item.answers || []).map((a) => normalizeLoose(a.text)).join('|')}`;
    if (key !== lastKey) {
      out.push(item);
      lastKey = key;
    }
  });
  return out;
};

const parseFromText = (text) => {
  let parsed = dedupeQuestions(splitQuestionBlocks(text).map(parseBlock).filter(Boolean));
  if (!parsed.length) {
    parsed = parseByRegexFallback(text);
  }
  return parsed;
};

const parseByRegexFallback = (rawText) => {
  const source = String(rawText || '').replace(/\r\n/g, '\n');
  const markerMatches = [...source.matchAll(QUESTION_MARKER_RE)].map((m) => m.index || 0);

  if (!markerMatches.length) {
    return dedupeQuestions(splitQuestionBlocks(source).map(parseBlock).filter(Boolean));
  }

  const segments = [];
  for (let i = 0; i < markerMatches.length; i += 1) {
    const start = markerMatches[i];
    const end = i + 1 < markerMatches.length ? markerMatches[i + 1] : source.length;
    const part = source.slice(start, end).trim();
    if (part) segments.push(part);
  }

  const parsed = segments
    .flatMap((segment) => splitQuestionBlocks(segment).map(parseBlock))
    .filter(Boolean);

  return dedupeQuestions(parsed);
};

const countQuestionMarkers = (text) => {
  const source = String(text || '');
  if (!source.trim()) return 0;
  return [...source.matchAll(QUESTION_MARKER_RE)].length;
};

export const parseDocxQuestionsWithReport = async (file) => {
  const arrayBuffer = await file.arrayBuffer();

  const rawResult = await mammoth.extractRawText({ arrayBuffer });
  const rawText = String(rawResult?.value || '');

  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const htmlPlain = htmlToPlainText(htmlResult.value);

  const rawParsed = parseFromText(rawText);
  const htmlParsed = parseFromText(htmlPlain);

  const useHtml = htmlParsed.length > rawParsed.length;
  const parsed = useHtml ? htmlParsed : rawParsed;
  const sourceText = useHtml ? htmlPlain : rawText;

  const candidateCount = Math.max(countQuestionMarkers(sourceText), parsed.length);
  const invalidCount = Math.max(0, candidateCount - parsed.length);

  return {
    questions: parsed,
    candidateCount,
    validCount: parsed.length,
    invalidCount,
    source: useHtml ? 'html' : 'raw',
  };
};

export const parseDocxQuestions = async (file, options = {}) => {
  const report = await parseDocxQuestionsWithReport(file);
  if (options.strict && report.invalidCount > 0) {
    throw new Error(`File Word có ${report.invalidCount}/${report.candidateCount} câu sai định dạng (nguồn parse: ${report.source}). Vui lòng chuẩn hóa trước khi import.`);
  }
  return report.questions;
};

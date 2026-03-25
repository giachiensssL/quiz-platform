import mammoth from 'mammoth';

const QUESTION_HEADER_PATTERNS = [
  /^(?:cau|câu)\s*(?:hoi|hỏi)?\s*(?:so|số)?\s*\d+\s*[:.)-]?\s*(.*)$/i,
  /^(?:cau|câu|question)\s*\d+\s*[:.)-]?\s*(.*)$/i,
  /^(?:q)\s*\d+\s*[:.)-]?\s*(.*)$/i,
];
const NUMERIC_QUESTION_HEADER_RE = /^\d+\s*[).:\-]\s*(.*)$/;

const QUESTION_MARKER_RE = /(?:^|\n)\s*(?:câu|cau|question|q)\s*(?:hỏi|hoi)?\s*(?:số|so)?\s*\d+\s*[:.)-]?/gim;
const OPTION_RE = /^(?:[-*•]\s*)?([A-H]|\d+)[\s]*[\).:\-\/]?[\s]*(.*)$/i;
const SIMPLE_OPTION_RE = /^(?:[-*•]\s*)?([A-H])[\s]+(.+)$/i;
const ANSWER_KEY_RE = /^(?:dap an(?:\s+dung)?|đáp án(?:\s+đúng)?|answer(?:\s+key)?|ans|key)(?:\s*(?:la|là|is))?\s*[:\-]?\s*(.+)$/i;
const FILL_HINT_RE = /_{2,}|\.{3,}|\(\s*\.\.\.\s*\)/;
const TRUE_FALSE_PROMPT_RE = /(đúng|dung|true).*(sai|false)|(sai|false).*(đúng|dung|true)/i;
const ORDER_KEYWORDS = ['sap xep', 'sắp xếp', 'thu tu', 'thứ tự', 'keo tha', 'kéo thả', 'arrange', 'order'];
const SORT_WORD_KEYWORDS = ['sap xep tu', 'sắp xếp từ', 'xep tu', 'xếp từ', 'arrange words', 'word order'];
const DRAG_KEYWORDS = ['keo tha', 'kéo thả', 'drag', 'drop'];
const HIGHLIGHT_TOKEN_OPEN = '[[HL]]';
const HIGHLIGHT_TOKEN_CLOSE = '[[/HL]]';
const IMAGE_TOKEN_RE = /\[\[IMG:([^\]]+)\]\]/gi;
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/gi;
const STAR_MARKER_RE = /[*+＊﹡∗✱✳✻★☆]/;
const LESSON_HEADER_PATTERNS = [
  /^(?:bai|bài|lesson)\s*(\d{1,2})\s*[:.)\-]?\s*(.*)$/i,
  /^(\d{1,2})\s*[:.)\-]\s*(?:bai|bài|lesson)\s*(.*)$/i,
];

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeLoose = (value) => normalizeText(value).toLowerCase();
const removeLeadingBullet = (line) => String(line || '').replace(/^(?:[-*•]\s*)+/, '').trim();
const stripStarMarkers = (value) => String(value || '')
  .replace(/^\s*(?:[*+＊﹡∗✱✳✻★☆])+\s*/, '')
  .replace(/\s*(?:[*+＊﹡∗✱✳✻★☆])+\s*$/, '')
  .replace(/\s*\(\s*(?:[*+＊﹡∗✱✳✻★☆])\s*\)\s*/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const decodeXmlEntities = (value) => String(value || '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const extractTextAndImages = (value) => {
  const source = String(value || '');
  const imageUrls = [];

  const tokenCleared = source
    .replace(IMAGE_TOKEN_RE, (_, url) => {
      const normalized = normalizeText(url);
      if (normalized) imageUrls.push(normalized);
      return ' ';
    })
    .replace(MARKDOWN_IMAGE_RE, (_, url) => {
      const normalized = normalizeText(url);
      if (normalized) imageUrls.push(normalized);
      return ' ';
    });

  return {
    text: normalizeText(tokenCleared),
    imageUrls,
  };
};

const extractSlashSegments = (value) => {
  const source = String(value || '').trim();
  if (!source || source.includes('://')) return [];
  if ((source.match(/\//g) || []).length < 2) return [];
  return source
    .split('/')
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const dedupeStrings = (items) => {
  const seen = new Set();
  const output = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = normalizeLoose(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalizeText(item));
  });
  return output;
};

const extractHighlightedAnswersFromDocx = async (arrayBuffer) => {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXmlFile = zip.file('word/document.xml');
    if (!documentXmlFile) return [];
    const stylesXmlFile = zip.file('word/styles.xml');
    const highlightedStyleIds = new Set();

    if (stylesXmlFile) {
      const stylesXml = await stylesXmlFile.async('string');
      const styleBlocks = stylesXml.match(/<w:style\b[\s\S]*?<\/w:style>/g) || [];
      styleBlocks.forEach((block) => {
        const idMatch = block.match(/w:styleId="([^"]+)"/i);
        const styleId = String(idMatch?.[1] || '').trim();
        if (!styleId) return;
        const hasHighlight = /<w:highlight\b/i.test(block)
          || /<w:shd\b[\s\S]*?w:(?:fill|val)="(?!auto|none|000000|FFFFFF)[^"]+"/i.test(block)
          || /<w:color\b[\s\S]*?w:val="(?!auto|000000)[^"]+"/i.test(block);
        if (hasHighlight) highlightedStyleIds.add(styleId);
      });
    }

    const documentXml = await documentXmlFile.async('string');
    const paragraphs = documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
    const highlighted = [];

    paragraphs.forEach((paragraphXml) => {
      const runs = paragraphXml.match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
      let activeSegment = '';

      runs.forEach((runXml) => {
        const styleRef = String((runXml.match(/<w:rStyle\b[\s\S]*?w:val="([^"]+)"\s*\/?\s*>/i) || [])[1] || '').trim();
        const isHighlighted = /<w:highlight\b/i.test(runXml)
          || /<w:shd\b[\s\S]*?w:(?:fill|val)="(?!auto|none|000000|FFFFFF)[^"]+"/i.test(runXml)
          || /<w:color\b[\s\S]*?w:val="(?!auto|000000)[^"]+"/i.test(runXml)
          || (styleRef && highlightedStyleIds.has(styleRef));

        const runText = (runXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [])
          .map((textTag) => {
            const matched = textTag.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/i);
            return decodeXmlEntities(matched?.[1] || '');
          })
          .join('');

        const normalizedRunText = normalizeText(runText);
        if (!normalizedRunText) {
          if (!isHighlighted && activeSegment) {
            highlighted.push(activeSegment);
            activeSegment = '';
          }
          return;
        }

        if (isHighlighted) {
          activeSegment = normalizeText(`${activeSegment} ${normalizedRunText}`);
        } else if (activeSegment) {
          highlighted.push(activeSegment);
          activeSegment = '';
        }
      });

      if (activeSegment) {
        highlighted.push(activeSegment);
      }
    });

    return dedupeStrings(highlighted);
  } catch {
    return [];
  }
};

const buildHighlightMatcher = (rawHighlighted = []) => {
  const highlighted = [...new Set((Array.isArray(rawHighlighted) ? rawHighlighted : [])
    .map((item) => normalizeLoose(item))
    .filter(Boolean))];

  if (!highlighted.length) return () => false;

  return (value) => {
    const option = normalizeLoose(value);
    if (!option) return false;
    return highlighted.some((token) => (
      token === option
      || option.includes(token)
      || token.includes(option)
      || (token.length >= 5 && option.length >= 5 && token.replace(/\s+/g, '') === option.replace(/\s+/g, ''))
    ));
  };
};

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
  const markHighlightedSpan = String(html || '').replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (match, attrs, content) => {
    const styleMatch = String(attrs || '').match(/style\s*=\s*"([^"]+)"|style\s*=\s*'([^']+)'/i);
    const classMatch = String(attrs || '').match(/class\s*=\s*"([^"]+)"|class\s*=\s*'([^']+)'/i);
    const styleRaw = String(styleMatch?.[1] || styleMatch?.[2] || '').toLowerCase();
    const classRaw = String(classMatch?.[1] || classMatch?.[2] || '').toLowerCase();
    const looksHighlighted = /(background|mso-highlight|highlight|color)\s*:/.test(styleRaw)
      || /(highlight|mark|yellow|answer-key)/.test(classRaw);
    if (!looksHighlighted) return match;
    return `${HIGHLIGHT_TOKEN_OPEN}${content}${HIGHLIGHT_TOKEN_CLOSE}`;
  });

  return decodeHtmlEntities(markHighlightedSpan)
    .replace(/<img\b[^>]*src\s*=\s*"([^"]+)"[^>]*>/gi, ' [[IMG:$1]] ')
    .replace(/<img\b[^>]*src\s*=\s*'([^']+)'[^>]*>/gi, ' [[IMG:$1]] ')
    .replace(/<a\b[^>]*>/gi, ' [[LINK]] ')
    .replace(/<\/a>/gi, ' [[\/LINK]] ')
    .replace(/<mark\b[^>]*>/gi, ` ${HIGHLIGHT_TOKEN_OPEN}`)
    .replace(/<\/mark>/gi, `${HIGHLIGHT_TOKEN_CLOSE} `)
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

const extractLessonHeader = (line) => {
  const normalized = removeLeadingBullet(line);
  for (const pattern of LESSON_HEADER_PATTERNS) {
    const matched = normalized.match(pattern);
    if (!matched) continue;
    const lessonNumber = Number(matched[1]);
    if (!Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 12) continue;
    return {
      lessonNumber,
      title: normalizeText(matched[2] || ''),
    };
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

const extractOrderKeys = (raw) => {
  const labels = String(raw || '').toUpperCase().match(/[A-H]|\d+/g) || [];
  return labels.filter(Boolean);
};

const TRUE_FALSE_VALUE_RE = /^(?:d|đ|t|s|f|true|false|dung|đúng|sai|0|1)$/i;

const looksLikeDelimitedTrueFalseSequence = (value) => {
  const source = String(value || '').trim();
  if (!source || !source.includes(',')) return false;
  const parts = source.split(',').map((item) => normalizeText(item)).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((item) => TRUE_FALSE_VALUE_RE.test(item));
};

const extractAnswerTextValues = (raw) => {
  const source = String(raw || '');
  const splitByComma = looksLikeDelimitedTrueFalseSequence(source);
  const splitter = splitByComma ? /[;,|/]+|\s*[,]+\s*|\s{2,}/ : /[;|/]+|\s{2,}/;
  return source
    .split(splitter)
    .map((item) => normalizeText(stripStarMarkers(item)))
    .filter(Boolean);
};

const parseTrueFalseToken = (raw) => {
  const token = normalizeLoose(raw);
  if (!token) return null;
  if (['d', 'đ', 't', 'true', 'đúng', 'dung', '1'].includes(token)) return true;
  if (['s', 'f', 'false', 'sai', '0'].includes(token)) return false;
  return null;
};

const isInstructionLine = (line) => {
  const value = normalizeLoose(line);
  if (!value) return true;
  return value.includes('chọn đáp án')
    || value.includes('chon dap an')
    || value.includes('đúng hoặc sai')
    || value.includes('dung hoac sai')
    || value.includes('đánh dấu đúng sai')
    || value.includes('danh dau dung sai');
};

const extractCorrect = (raw) => {
  const text = String(raw || '');
  const lower = text.toLowerCase();
  const correct =
    /^\s*(?:[*+＊﹡∗✱✳✻★☆])\s*/.test(text)
    || /\s(?:[*+＊﹡∗✱✳✻★☆])\s*$/.test(text)
    || /\(\s*(?:[*+＊﹡∗✱✳✻★☆])\s*\)/.test(text)
    || STAR_MARKER_RE.test(text)
    || text.includes(HIGHLIGHT_TOKEN_OPEN)
    || /\[\[link\]\]/i.test(text)
    || /\[(x|\u2713)\]/i.test(text)
    || /(\(|\[)\s*(dung|đúng|true|correct)\s*(\)|\])/i.test(lower)
    || /\u2705/.test(text);

  const cleaned = text
    .replace(/^\s*(?:[*+＊﹡∗✱✳✻★☆])\s*/, '')
    .replace(/\s*(?:[*+＊﹡∗✱✳✻★☆])\s*$/, '')
    .replace(/\(\s*(?:[*+＊﹡∗✱✳✻★☆])\s*\)/g, '')
    .replace(new RegExp(HIGHLIGHT_TOKEN_OPEN.replace(/[\[\]]/g, '\\$&'), 'g'), '')
    .replace(new RegExp(HIGHLIGHT_TOKEN_CLOSE.replace(/[\[\]]/g, '\\$&'), 'g'), '')
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
    const normalized = removeLeadingBullet(line);
    const numericHeader = normalized.match(NUMERIC_QUESTION_HEADER_RE);
    let headerText = getQuestionHeaderText(line);

    // Heuristic: inside an existing block, lines like "1) ..." are often options,
    // not the next question header. Only split when line clearly looks like a question stem.
    if (!headerText && numericHeader) {
      const candidate = normalizeText(numericHeader[1]);
      const questionLeadRe = /^(?:cho|hãy|hay|xác định|chon|chọn|which|what|find|tính|compute)\b/i;
      const looksQuestionLike = candidate.includes('?')
        || FILL_HINT_RE.test(candidate)
        || TRUE_FALSE_PROMPT_RE.test(candidate)
        || questionLeadRe.test(candidate);

      const currentText = current
        ? normalizeText([current.head, ...(current.lines || [])].join(' '))
        : '';
      const currentIsTrueFalse = TRUE_FALSE_PROMPT_RE.test(currentText);

      if (!current || (looksQuestionLike && !currentIsTrueFalse)) {
        headerText = candidate;
      }
    }

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

const splitLessonSections = (rawText) => {
  const source = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = source.split('\n');

  const sections = [];
  let current = null;

  lines.forEach((line) => {
    const lessonHeader = extractLessonHeader(line);
    if (lessonHeader) {
      if (current) {
        current.text = current.lines.join('\n').trim();
        sections.push(current);
      }
      current = {
        lessonNumber: lessonHeader.lessonNumber,
        title: lessonHeader.title,
        lines: [],
      };
      return;
    }

    if (current) current.lines.push(line);
  });

  if (current) {
    current.text = current.lines.join('\n').trim();
    sections.push(current);
  }

  return sections.filter((section) => section.text);
};

const inferType = (questionText, parsedOptions, answerTexts) => {
  const lowerQuestion = normalizeLoose(questionText);
  const hasSortWordKeyword = SORT_WORD_KEYWORDS.some((kw) => lowerQuestion.includes(kw));
  const hasDragKeyword = DRAG_KEYWORDS.some((kw) => lowerQuestion.includes(kw));
  const hasOrderKeyword = ORDER_KEYWORDS.some((kw) => lowerQuestion.includes(kw));
  if (hasSortWordKeyword && parsedOptions.length >= 2) return 'match';
  if ((hasDragKeyword || hasOrderKeyword) && parsedOptions.length >= 2) return 'drag';

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

const createParseIssue = (reason, block, details) => {
  const head = normalizeText(block?.head || '');
  const sample = normalizeText((block?.lines || []).slice(0, 2).join(' '));
  return {
    reason,
    message: details,
    questionHead: head,
    sample,
  };
};

const parseBlockDetailed = (block, context = {}) => {
  const isHighlightedAnswer = typeof context?.isHighlightedAnswer === 'function'
    ? context.isHighlightedAnswer
    : () => false;
  const optionRows = [];
  const questionRows = [];
  const questionImageCandidates = [];
  let answerLabels = [];
  let answerTexts = [];
  let answerKeyRaw = '';

  const headExtract = extractTextAndImages(block.head || '');
  questionImageCandidates.push(...headExtract.imageUrls);
  const cleanedHead = headExtract.text;

  (block.lines || []).forEach((line) => {
    const extracted = extractTextAndImages(line);
    const cleanedLine = extracted.text;
    const lineImages = extracted.imageUrls;

    if (!cleanedLine && lineImages.length) {
      if (!optionRows.length) questionImageCandidates.push(...lineImages);
      return;
    }

    const answerKey = cleanedLine.match(ANSWER_KEY_RE);
    if (answerKey) {
      answerKeyRaw = answerKey[1];
      answerLabels = extractAnswerLabels(answerKey[1]);
      answerTexts = extractAnswerTextValues(answerKey[1]);
      return;
    }

    const opt = removeLeadingBullet(cleanedLine).match(OPTION_RE);
    if (opt && normalizeText(opt[2])) {
      optionRows.push({ label: String(opt[1]).toUpperCase(), raw: opt[2] });
      return;
    }

    const simple = removeLeadingBullet(cleanedLine).match(SIMPLE_OPTION_RE);
    if (simple) {
      optionRows.push({ label: String(simple[1]).toUpperCase(), raw: simple[2] });
      return;
    }

    const inline = extractInlineOptions(cleanedLine);
    if (inline.length >= 2) {
      optionRows.push(...inline);
      return;
    }

    if (optionRows.length) {
      optionRows[optionRows.length - 1].raw = `${optionRows[optionRows.length - 1].raw} ${cleanedLine}`;
    } else {
      questionRows.push(cleanedLine);
      if (lineImages.length) questionImageCandidates.push(...lineImages);
    }
  });

  const text = normalizeText([cleanedHead, ...questionRows].filter(Boolean).join(' '));
  const questionImageUrl = normalizeText(questionImageCandidates[0] || '');
  const slashSegments = extractSlashSegments([cleanedHead, ...questionRows].join(' '));
  if (!text) {
    return { question: null, issue: createParseIssue('empty_question', block, 'Thiếu nội dung câu hỏi') };
  }

  const parsedOptions = optionRows
    .map((item) => {
      const { cleaned, correct } = extractCorrect(item.raw);
      const normalized = normalizeText(cleaned);
      return {
        label: item.label,
        text: normalized,
        imageUrl: '',
        correct: Boolean(correct || isHighlightedAnswer(normalized)),
      };
    })
    .filter((item) => item.text);

  if (answerLabels.length) {
    parsedOptions.forEach((item) => {
      item.correct = answerLabels.includes(item.label);
    });
  }

  const type = inferType(text, parsedOptions, answerTexts);
  const orderKeys = extractOrderKeys(answerKeyRaw);

  if (type === 'fill') {
    const fillAnswers = (answerTexts.length ? answerTexts : parsedOptions.filter((item) => item.correct).map((item) => item.text))
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .map((item) => ({ text: item, imageUrl: '', correct: true }));

    if (!fillAnswers.length) {
      return { question: null, issue: createParseIssue('fill_without_answers', block, 'Câu điền khuyết không có đáp án hợp lệ') };
    }
    return { question: { text, type: 'fill', imageUrl: questionImageUrl, answers: fillAnswers }, issue: null };
  }

  const trueFalsePrompt = TRUE_FALSE_PROMPT_RE.test(text);
  if (trueFalsePrompt) {
    const numberedStatementOptions = parsedOptions.filter((item) => /^\d+$/.test(item.label));
    const hasExplicitTrueFalseChoices = parsedOptions.some((item) => {
      const optionText = normalizeLoose(item.text);
      return optionText.includes('đúng')
        || optionText.includes('dung')
        || optionText.includes('true')
        || optionText.includes('sai')
        || optionText.includes('false');
    });

    const statementSource = !hasExplicitTrueFalseChoices && numberedStatementOptions.length >= 2
      ? numberedStatementOptions.map((item) => item.text)
      : questionRows
        .map((line) => normalizeText(line))
        .filter((line) => line && !isInstructionLine(line));

    const pairMatches = [...String(answerKeyRaw || '').matchAll(/(?:^|[;,|\/\s])([A-H]|\d+)\s*[:=\-.]\s*(đúng|dung|sai|true|false|đ|d|s|t|f|0|1)(?=$|[;,|\/\s])/gi)];
    const pairMap = new Map(pairMatches.map((m) => [String(m[1] || '').toUpperCase(), parseTrueFalseToken(m[2])])) ;
    const statementLines = questionRows
      .map((line) => normalizeText(line))
      .filter((line) => line && !isInstructionLine(line));

    const tfTokens = answerTexts
      .map((token) => parseTrueFalseToken(token))
      .filter((token) => token !== null);

    if (statementSource.length >= 2) {
      const fallbackAnswers = statementSource.map((line, idx) => {
        const label = numberedStatementOptions[idx]?.label ? String(numberedStatementOptions[idx].label).toUpperCase() : null;
        const mapped = label && pairMap.has(label) ? pairMap.get(label) : undefined;
        return {
        text: line,
        imageUrl: '',
        correct: mapped !== undefined ? mapped : (tfTokens[idx] !== undefined ? tfTokens[idx] : false),
      };
      });
      const hasExplicit = tfTokens.length > 0 || pairMap.size > 0;
      if (!hasExplicit) {
        return { question: null, issue: createParseIssue('missing_truefalse_key', block, 'Dạng Đúng/Sai theo nhiều ý chưa có khóa đáp án rõ ràng') };
      }
      return { question: { text, type: 'truefalse', imageUrl: questionImageUrl, answers: fallbackAnswers }, issue: null };
    }

    const singleTf = parseTrueFalseToken(answerTexts[0]);
    if (singleTf !== null) {
      const tfOptions = [
        { text: 'Đúng', imageUrl: '', correct: singleTf === true },
        { text: 'Sai', imageUrl: '', correct: singleTf === false },
      ];
      return { question: { text, type: 'truefalse', imageUrl: questionImageUrl, answers: tfOptions }, issue: null };
    }
  }

  if (slashSegments.length >= 2 && answerTexts.length >= 1) {
    const dragItems = slashSegments.map((item, idx) => ({ id: `item-${idx + 1}`, label: item }));
    const answerSentence = normalizeText(answerTexts.join(' '));
    if (answerSentence) {
      return {
        question: {
          text,
          type: 'match',
          imageUrl: questionImageUrl,
          answerSentence,
          answers: slashSegments.map((item) => ({ text: item, imageUrl: '', correct: true })),
          dragItems,
          dropTargets: [],
        },
        issue: null,
      };
    }
  }

  if (parsedOptions.length < 2) {
    return { question: null, issue: createParseIssue('insufficient_options', block, 'Không đủ đáp án lựa chọn (ít hơn 2)') };
  }

  const hasCorrect = parsedOptions.some((item) => item.correct);
  if (!hasCorrect) {
    return { question: null, issue: createParseIssue('missing_correct_answer', block, 'Không xác định được đáp án đúng (không thấy highlight/đáp án)') };
  }

  if (type === 'drag') {
    const optionByLabel = new Map(parsedOptions.map((item) => [String(item.label || '').toUpperCase(), item]));
    const orderedOptions = orderKeys.length >= 2
      ? orderKeys.map((key) => optionByLabel.get(String(key).toUpperCase())).filter(Boolean)
      : [];
    const sequence = orderedOptions.length >= 2 ? orderedOptions : parsedOptions;

    const answers = parsedOptions.map((item, idx) => ({
      text: item.text,
      imageUrl: '',
      correct: true,
      order: idx + 1,
    }));
    const dragItems = parsedOptions.map((item, idx) => ({ id: `item-${idx + 1}`, label: item.text }));
    const dragItemIdByText = new Map(dragItems.map((item) => [normalizeLoose(item.label), item.id]));
    const dropTargets = sequence.map((item, idx) => ({
      id: `slot-${idx + 1}`,
      label: `Vi tri ${idx + 1}`,
      correctItemId: dragItemIdByText.get(normalizeLoose(item.text)) || `item-${idx + 1}`,
    }));

    return { question: { text, type: 'drag', imageUrl: questionImageUrl, answers, dragItems, dropTargets }, issue: null };
  }

  if (type === 'match') {
    const optionByLabel = new Map(parsedOptions.map((item) => [String(item.label || '').toUpperCase(), item]));
    const orderedOptions = orderKeys.length >= 2
      ? orderKeys.map((key) => optionByLabel.get(String(key).toUpperCase())).filter(Boolean)
      : [];
    const sequence = orderedOptions.length >= 2 ? orderedOptions : parsedOptions;
    const dragItems = sequence.map((item, idx) => ({ id: `item-${idx + 1}`, label: item.text }));
    const sentenceFromKey = normalizeText(answerTexts.join(' '));
    const answerSentence = sentenceFromKey || normalizeText(sequence.map((item) => item.text).join(' '));

    if (dragItems.length < 2 || !answerSentence) {
      return { question: null, issue: createParseIssue('insufficient_match_items', block, 'Dạng Sắp xếp từ/Nối từ cần ít nhất 2 từ và đáp án chuẩn') };
    }

    return {
      question: {
        text,
        type: 'match',
        imageUrl: questionImageUrl,
        answerSentence,
        answers: sequence.map((item) => ({ text: item.text, imageUrl: '', correct: true })),
        dragItems,
        dropTargets: [],
      },
      issue: null,
    };
  }

  const finalType = type === 'truefalse' ? 'truefalse' : inferType(text, parsedOptions, answerTexts);
  return {
    question: {
      text,
      type: finalType,
      imageUrl: questionImageUrl,
      answers: parsedOptions.map(({ label, ...rest }) => rest),
    },
    issue: null,
  };
};

const parseBlock = (block) => parseBlockDetailed(block).question;

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

const parseWithDetails = (text, options = {}) => {
  const isHighlightedAnswer = buildHighlightMatcher(options?.highlightedAnswers);
  const blocks = splitQuestionBlocks(text);
  const detailed = blocks.map((block) => parseBlockDetailed(block, { isHighlightedAnswer }));
  const questions = dedupeQuestions(detailed.map((item) => item.question).filter(Boolean));
  const invalidDetails = detailed.filter((item) => !item.question && item.issue).map((item) => item.issue);
  return { questions, invalidDetails };
};

const parseFromText = (text) => {
  let parsed = parseWithDetails(text).questions;
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

export const parseQuestionsFromTextWithReport = (text, options = {}) => {
  const sourceText = String(text || '');
  const details = parseWithDetails(sourceText, options);
  const questions = details.questions.length ? details.questions : parseByRegexFallback(sourceText);
  const candidateCount = Math.max(countQuestionMarkers(sourceText), questions.length);
  const invalidCount = Math.max(0, candidateCount - questions.length);

  return {
    questions,
    candidateCount,
    validCount: questions.length,
    invalidCount,
    invalidDetails: details.invalidDetails,
    source: 'text',
    sourceText,
  };
};

export const parseQuestionsFromText = (text, options = {}) => {
  const report = parseQuestionsFromTextWithReport(text, options);
  if (options.strict && report.invalidCount > 0) {
    throw new Error(`Tài liệu có ${report.invalidCount}/${report.candidateCount} câu sai định dạng. Vui lòng chuẩn hóa trước khi import.`);
  }
  return report.questions;
};

export const parseLessonsFromTextWithReport = (text, options = {}) => {
  const sourceText = String(text || '');
  const sections = splitLessonSections(sourceText);

  if (!sections.length) {
    const fallback = parseQuestionsFromTextWithReport(sourceText, options);
    return {
      lessons: fallback.questions.length
        ? [{ lessonNumber: null, title: '', questions: fallback.questions }]
        : [],
      candidateCount: fallback.candidateCount,
      validCount: fallback.validCount,
      invalidCount: fallback.invalidCount,
      invalidDetails: fallback.invalidDetails || [],
      sourceText,
    };
  }

  const invalidDetails = [];
  const lessons = sections
    .map((section) => {
      const parsedDetails = parseWithDetails(section.text, options);
      parsedDetails.invalidDetails.forEach((item) => {
        invalidDetails.push({
          ...item,
          lessonNumber: section.lessonNumber,
          lessonTitle: section.title,
        });
      });
      return {
        lessonNumber: section.lessonNumber,
        title: section.title,
        questions: parsedDetails.questions,
      };
    })
    .filter((section) => section.questions.length > 0);

  const candidateCount = sections.reduce((sum, section) => sum + countQuestionMarkers(section.text), 0);
  const validCount = lessons.reduce((sum, section) => sum + section.questions.length, 0);
  const invalidCount = Math.max(0, candidateCount - validCount);

  return {
    lessons,
    candidateCount,
    validCount,
    invalidCount,
    invalidDetails,
    sourceText,
  };
};

export const parseDocxQuestionsWithReport = async (file, options = {}) => {
  const arrayBuffer = await file.arrayBuffer();
  const extractedHighlightedAnswers = await extractHighlightedAnswersFromDocx(arrayBuffer);
  const mergedOptions = {
    ...options,
    highlightedAnswers: dedupeStrings([
      ...(Array.isArray(options?.highlightedAnswers) ? options.highlightedAnswers : []),
      ...extractedHighlightedAnswers,
    ]),
  };

  const rawResult = await mammoth.extractRawText({ arrayBuffer });
  const rawText = String(rawResult?.value || '');

  const htmlResult = await mammoth.convertToHtml({
    arrayBuffer,
    convertImage: mammoth.images.inline(async (element) => {
      const base64 = await element.read('base64');
      return {
        src: `data:${element.contentType};base64,${base64}`,
      };
    }),
  });
  const htmlPlain = htmlToPlainText(htmlResult.value);

  const rawDetails = parseWithDetails(rawText, mergedOptions);
  const htmlDetails = parseWithDetails(htmlPlain, mergedOptions);
  const rawParsed = rawDetails.questions;
  const htmlParsed = htmlDetails.questions;

  const useHtml = htmlParsed.length > rawParsed.length;
  const parsed = useHtml ? htmlParsed : rawParsed;
  const sourceText = useHtml ? htmlPlain : rawText;
  const invalidDetails = useHtml ? htmlDetails.invalidDetails : rawDetails.invalidDetails;

  const candidateCount = Math.max(countQuestionMarkers(sourceText), parsed.length);
  const invalidCount = Math.max(0, candidateCount - parsed.length);

  return {
    questions: parsed,
    candidateCount,
    validCount: parsed.length,
    invalidCount,
    invalidDetails,
    source: useHtml ? 'html' : 'raw',
    sourceText,
    highlightedAnswers: mergedOptions.highlightedAnswers,
  };
};

export const parseDocxQuestions = async (file, options = {}) => {
  const report = await parseDocxQuestionsWithReport(file, options);
  if (options.strict && report.invalidCount > 0) {
    throw new Error(`File Word có ${report.invalidCount}/${report.candidateCount} câu sai định dạng (nguồn parse: ${report.source}). Vui lòng chuẩn hóa trước khi import.`);
  }
  return report.questions;
};

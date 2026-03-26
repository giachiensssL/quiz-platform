import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { resultsAPI } from '../api/api';
import Navbar from '../components/Navbar';
import { Button, EmptyState } from '../components/UI';

const TYPE_LABELS = {
  single:'Một đáp án',
  multiple:'Nhiều đáp án',
  truefalse:'Đúng / Sai',
  fill:'Điền vào chỗ trống',
  arrange:'Nối/Sắp xếp từ',
  match:'Nối/Sắp xếp từ',
  drag:'Kéo thả',
};
const TIME_PER_QUESTION_SECONDS = 90;
const PRACTICE_TARGET_QUESTIONS = 50;
const PRACTICE_DURATION_SECONDS = 45 * 60;
const COMPARE_TEXT_LIMIT = 120;
const isAnswerCorrect = (answer) => Boolean(answer?.correct ?? answer?.isCorrect);
const isDragQuestionType = (type) => type === 'drag';
const isArrangeQuestionType = () => false;
const isMatchQuestionType = (type) => type === 'match' || type === 'arrange';
const optionLabel = (index) => String.fromCharCode(65 + index);
const sameId = (left, right) => String(left ?? '') === String(right ?? '');
const normalizeSentence = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const formatTime = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const shuffleArray = (items) => {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
};

const safeStorageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return '';
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in restricted browser mode.
  }
};

const shouldShuffleAnswers = (type) => type === 'single' || type === 'multiple';

const cloneQuestionForAttempt = (question) => {
  const nextQuestion = {
    ...question,
    answers: Array.isArray(question?.answers) ? [...question.answers] : [],
  };

  if (shouldShuffleAnswers(nextQuestion.type) && nextQuestion.answers.length > 1) {
    nextQuestion.answers = shuffleArray(nextQuestion.answers);
  }

  return nextQuestion;
};

const getQuestionAttemptSignature = (questions) => {
  const questionPart = questions.map((q) => String(q.id ?? '')).join(',');
  const answerPart = questions
    .map((q) => {
      if (!Array.isArray(q.answers) || q.answers.length <= 1) {
        return `${String(q.id ?? '')}:`;
      }
      const answerOrder = q.answers
        .map((a, idx) => String(a?.id ?? a?.text ?? idx))
        .join('|');
      return `${String(q.id ?? '')}:${answerOrder}`;
    })
    .join(';');

  return `${questionPart}__${answerPart}`;
};

const buildShuffledAttempt = (baseQuestions, storageKey) => {
  if (!Array.isArray(baseQuestions) || baseQuestions.length === 0) return [];

  const previousSignature = safeStorageGet(storageKey);
  let picked = null;
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const shuffledQuestions = shuffleArray(baseQuestions).map(cloneQuestionForAttempt);
    const signature = getQuestionAttemptSignature(shuffledQuestions);
    if (signature !== previousSignature || attempt === maxAttempts - 1) {
      picked = { shuffledQuestions, signature };
      break;
    }
  }

  if (!picked) {
    const fallback = shuffleArray(baseQuestions).map(cloneQuestionForAttempt);
    const fallbackSignature = getQuestionAttemptSignature(fallback);
    safeStorageSet(storageKey, fallbackSignature);
    return fallback;
  }

  safeStorageSet(storageKey, picked.signature);
  return picked.shuffledQuestions;
};

const distributeQuestionQuota = (buckets, targetTotal) => {
  const target = Math.max(0, Number(targetTotal) || 0);
  if (!Array.isArray(buckets) || !buckets.length || target === 0) return new Map();

  const quota = new Map(buckets.map((bucket) => [bucket.lessonId, 0]));
  let remaining = Math.min(target, buckets.reduce((sum, bucket) => sum + bucket.questions.length, 0));

  while (remaining > 0) {
    let changed = false;
    for (const bucket of buckets) {
      if (remaining <= 0) break;
      const current = quota.get(bucket.lessonId) || 0;
      if (current < bucket.questions.length) {
        quota.set(bucket.lessonId, current + 1);
        remaining -= 1;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return quota;
};

const buildPracticeQuestions = (allQuestions, lessons, subjectId) => {
  const lessonBuckets = lessons
    .map((lesson) => ({
      lessonId: String(lesson.id),
      order: Number(lesson.order || lesson.id || 0),
      questions: allQuestions.filter((question) => String(question.lessonId) === String(lesson.id)),
    }))
    .filter((bucket) => bucket.questions.length > 0)
    .sort((a, b) => a.order - b.order);

  const quota = distributeQuestionQuota(lessonBuckets, PRACTICE_TARGET_QUESTIONS);
  const picked = [];

  for (const bucket of lessonBuckets) {
    const need = quota.get(bucket.lessonId) || 0;
    if (need <= 0) continue;
    const sampled = shuffleArray(bucket.questions).slice(0, need);
    picked.push(...sampled);
  }

  return shuffleArray(picked).map((question, idx) => ({
    ...question,
    id: `practice-${subjectId}-${idx + 1}-${String(question.id)}`,
    originalQuestionId: question.id,
  }));
};

const evaluateQuestion = (question, userAnswer) => {
  if (question.type === 'single') {
    const ok = isAnswerCorrect(question.answers.find((a) => sameId(a.id, userAnswer)));
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  if (question.type === 'multiple') {
    const selectedIds = Array.isArray(userAnswer) ? userAnswer.map((id) => String(id)) : [];
    const ok = Array.isArray(userAnswer)
      && question.answers.filter((a) => isAnswerCorrect(a)).every((a) => selectedIds.includes(String(a.id)))
      && question.answers.filter((a) => !isAnswerCorrect(a)).every((a) => !selectedIds.includes(String(a.id)));
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  if (question.type === 'fill') {
    const expected = question.answers.map((a) => String(a.text || '').toLowerCase().trim()).filter(Boolean);
    const ok = expected.includes(String(userAnswer || '').toLowerCase().trim());
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  if (question.type === 'truefalse') {
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
    const answerMap = (userAnswer && typeof userAnswer === 'object' && !Array.isArray(userAnswer)) ? userAnswer : {};
    const totalUnits = targets.length || 1;
    const earnedUnits = targets.reduce((sum, target) => {
      const expected = Array.isArray(target.correctItemIds)
        ? target.correctItemIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [String(target.correctItemId || '').trim()].filter(Boolean);
      const actualRaw = answerMap[target.id];
      const actual = (Array.isArray(actualRaw) ? actualRaw : [actualRaw]).map((id) => String(id || '').trim()).filter(Boolean);
      if (expected.length !== actual.length) return sum;
      return sum + (expected.every((id) => actual.includes(id)) ? 1 : 0);
    }, 0);
    return { earnedUnits, totalUnits, fullyCorrect: earnedUnits === totalUnits && targets.length > 0 };
  }

  if (isArrangeQuestionType(question.type)) {
    const labelById = Object.fromEntries((Array.isArray(question.dragItems) ? question.dragItems : []).map((item) => [String(item.id || ''), item.label || String(item.id || '')]));
    const expectedSentence = normalizeSentence(question.answerSentence || '');

    if (expectedSentence) {
      const actualSentence = normalizeSentence(
        (Array.isArray(userAnswer) ? userAnswer : [])
          .map((id) => labelById[String(id)] || '')
          .filter(Boolean)
          .join(' ')
      );
      const ok = actualSentence === expectedSentence;
      return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
    }

    const expectedOrder = (Array.isArray(question.dragItems) && question.dragItems.length
      ? question.dragItems.map((item) => String(item.id || '').trim())
      : [...(question.answers || [])]
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((a) => String(a.id || a.text || '').trim())
    ).filter(Boolean);

    const actualOrder = (Array.isArray(userAnswer) ? userAnswer : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    const ok = expectedOrder.length === actualOrder.length && expectedOrder.every((value, idx) => value === actualOrder[idx]);
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  if (isMatchQuestionType(question.type)) {
    const labelById = Object.fromEntries((Array.isArray(question.dragItems) ? question.dragItems : []).map((item) => [String(item.id || ''), item.label || String(item.id || '')]));
    const expectedSentence = normalizeSentence(question.answerSentence || '');
    const actualSentence = normalizeSentence(
      (Array.isArray(userAnswer) ? userAnswer : [])
        .map((id) => labelById[String(id)] || '')
        .filter(Boolean)
        .join(' ')
    );

    if (expectedSentence) {
      const ok = actualSentence === expectedSentence;
      return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
    }

    const expectedOrder = (Array.isArray(question.dragItems) ? question.dragItems : []).map((item) => String(item.id || '').trim()).filter(Boolean);
    const actualOrder = (Array.isArray(userAnswer) ? userAnswer : []).map((item) => String(item || '').trim()).filter(Boolean);
    const ok = expectedOrder.length > 0 && expectedOrder.length === actualOrder.length && expectedOrder.every((value, idx) => value === actualOrder[idx]);
    return { earnedUnits: ok ? 1 : 0, totalUnits: 1, fullyCorrect: ok };
  }

  return { earnedUnits: 0, totalUnits: 1, fullyCorrect: false };
};

const buildComparison = (question, userAnswer) => {
  if (question.type === 'single') {
    const correctIndex = question.answers.findIndex((a) => isAnswerCorrect(a));
    const userIndex = question.answers.findIndex((a) => sameId(a.id, userAnswer));
    const chosenItems = userIndex >= 0
      ? [{
          label: optionLabel(userIndex),
          text: question.answers[userIndex]?.text || '(đáp án ảnh)',
          imageUrl: question.answers[userIndex]?.imageUrl || '',
        }]
      : [];
    const correctItems = correctIndex >= 0
      ? [{
          label: optionLabel(correctIndex),
          text: question.answers[correctIndex]?.text || '(đáp án ảnh)',
          imageUrl: question.answers[correctIndex]?.imageUrl || '',
        }]
      : [];
    return { chosenItems, correctItems };
  }

  if (question.type === 'multiple') {
    const selected = Array.isArray(userAnswer) ? userAnswer.map((id) => String(id)) : [];
    const chosenItems = question.answers
      .map((a, idx) => ({ a, idx }))
      .filter(({ a }) => selected.includes(String(a.id)))
      .map(({ a, idx }) => ({
        label: optionLabel(idx),
        text: a.text || '(đáp án ảnh)',
        imageUrl: a.imageUrl || '',
      }));

    const correctItems = question.answers
      .map((a, idx) => ({ a, idx }))
      .filter(({ a }) => isAnswerCorrect(a))
      .map(({ a, idx }) => ({
        label: optionLabel(idx),
        text: a.text || '(đáp án ảnh)',
        imageUrl: a.imageUrl || '',
      }));

    return { chosenItems, correctItems };
  }

  if (question.type === 'truefalse') {
    const picks = userAnswer || {};
    const chosenItems = question.answers.map((a, idx) => ({
      label: `Ý ${idx + 1}`,
      text: (picks[idx] === undefined) ? 'Chưa chọn' : (picks[idx] ? 'Đúng' : 'Sai'),
      imageUrl: a.imageUrl || '',
    }));
    const correctItems = question.answers.map((a, idx) => ({
      label: `Ý ${idx + 1}`,
      text: isAnswerCorrect(a) ? 'Đúng' : 'Sai',
      imageUrl: a.imageUrl || '',
    }));
    return { chosenItems, correctItems };
  }

  if (question.type === 'fill') {
    return {
      chosenItems: [{ label: 'Trả lời', text: String(userAnswer || '').trim() || 'Chưa nhập', imageUrl: '' }],
      correctItems: [{ label: 'Đáp án', text: question.answers.map((a) => a.text).join(' | ') || 'Không xác định', imageUrl: '' }],
    };
  }

  if (isDragQuestionType(question.type)) {
    const dragItems = Array.isArray(question.dragItems) ? question.dragItems : [];
    const labelById = Object.fromEntries(dragItems.map((item) => [String(item.id), item.label || String(item.id)]));
    const answerMap = (userAnswer && typeof userAnswer === 'object' && !Array.isArray(userAnswer)) ? userAnswer : {};
    const targets = Array.isArray(question.dropTargets) ? question.dropTargets : [];

    const chosenItems = targets.map((target) => {
      const actualRaw = answerMap[target.id];
      const actualIds = (Array.isArray(actualRaw) ? actualRaw : [actualRaw]).map((id) => String(id || '')).filter(Boolean);
      const actualText = actualIds.length ? actualIds.map((id) => labelById[id] || id).join(' | ') : 'Chưa kéo';
      return {
        label: target.label || target.id,
        text: actualText,
        imageUrl: '',
      };
    });

    const correctItems = targets.map((target) => {
      const expectedIds = Array.isArray(target.correctItemIds)
        ? target.correctItemIds.map((id) => String(id || '')).filter(Boolean)
        : [String(target.correctItemId || '')].filter(Boolean);
      return {
        label: target.label || target.id,
        text: expectedIds.length ? expectedIds.map((id) => labelById[id] || id).join(' | ') : 'Không xác định',
        imageUrl: '',
      };
    });

    return { chosenItems, correctItems };
  }

  if (isArrangeQuestionType(question.type)) {
    const labelById = {
      ...Object.fromEntries((Array.isArray(question.dragItems) ? question.dragItems : []).map((item) => [String(item.id), item.label || String(item.id)])),
      ...Object.fromEntries((Array.isArray(question.answers) ? question.answers : []).map((item) => [String(item.id), item.text || String(item.id)])),
    };
    const targets = Array.isArray(question.dropTargets) ? question.dropTargets : [];
    const answerOrder = (Array.isArray(userAnswer) ? userAnswer : []).map((id) => labelById[String(id)] || String(id));
    const expectedOrder = (Array.isArray(question.dragItems) && question.dragItems.length
      ? question.dragItems.map((item) => item.label || String(item.id || ''))
      : [...(question.answers || [])]
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((a) => a.text)
    );
    const expectedSentence = String(question.answerSentence || '').trim();

    return {
      chosenItems: [{ label: 'Thứ tự', text: answerOrder.length ? answerOrder.join(' → ') : 'Chưa sắp xếp', imageUrl: '' }],
      correctItems: [{
        label: 'Đúng',
        text: expectedSentence || expectedOrder.join(' → ') || 'Không xác định',
        imageUrl: '',
      }],
    };
  }

  if (isMatchQuestionType(question.type)) {
    const dragItems = Array.isArray(question.dragItems) ? question.dragItems : [];
    const labelById = Object.fromEntries(dragItems.map((item) => [String(item.id), item.label || String(item.id)]));
    const chosenOrder = (Array.isArray(userAnswer) ? userAnswer : []).map((id) => labelById[String(id)] || String(id));
    const correctOrder = dragItems.map((item) => item.label || String(item.id || ''));
    const expectedSentence = String(question.answerSentence || '').trim();

    const chosenItems = [{
      label: 'Câu ghép',
      text: chosenOrder.length ? chosenOrder.join(' ') : 'Chưa ghép',
      imageUrl: '',
    }];

    const correctItems = [{
      label: 'Đáp án đúng',
      text: expectedSentence || (correctOrder.length ? correctOrder.join(' ') : 'Không xác định'),
      imageUrl: '',
    }];

    return { chosenItems, correctItems };
  }

  return { chosenItems: [], correctItems: [] };
};

function ExpandableText({ text, limit = COMPARE_TEXT_LIMIT }) {
  const [expanded, setExpanded] = useState(false);
  const safe = String(text || '');
  const tooLong = safe.length > limit;
  const display = expanded || !tooLong ? safe : `${safe.slice(0, limit)}...`;

  return (
    <div>
      <span>{display}</span>
      {tooLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginLeft: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--blue)',
            cursor: 'pointer',
            fontSize: '.76rem',
            fontWeight: 600,
          }}
        >
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </div>
  );
}

function CompareAnswerBlock({ title, items }) {
  return (
    <div style={{ marginTop: 6, fontSize: '.78rem' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {items.length === 0 && <div style={{ color: 'var(--muted)' }}>Không có</div>}
      {items.map((item, idx) => (
        <div key={`${title}-${idx}`} style={{ marginBottom: 6, padding: 6, border: '1px dashed var(--border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--text-2)', marginBottom: 4 }}>
            {item.label}: <ExpandableText text={item.text} />
          </div>
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={`${title}-${item.label}`}
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SingleChoice({ q, answer, onAnswer, submitted, onOpenImage }) {
  return (
    <div className="answers-list">
      {q.answers.map((a,i) => {
        let cls='answer-row';
        if(submitted){if(isAnswerCorrect(a))cls+=' correct';else if(sameId(answer, a.id))cls+=' wrong';cls+=' disabled';}
        else if(sameId(answer, a.id))cls+=' selected';
        return (
          <div key={`${a.id}-${i}`} className={cls} onClick={()=>!submitted&&onAnswer(String(a.id))}>
            <div className="opt-key">{optionLabel(i)}</div>
            <span className="opt-text" style={{ display: 'grid', gap: 6 }}>
              {a.text}
              {a.imageUrl && <img src={a.imageUrl} alt={`option-${i + 1}`} onClick={(e) => { e.stopPropagation(); onOpenImage?.(a.imageUrl); }} style={{ maxHeight: 140, maxWidth: '100%', objectFit: 'contain', borderRadius: 8, cursor: 'zoom-in' }} />}
            </span>
            {submitted&&isAnswerCorrect(a)&&<span className="opt-mark">✓</span>}
            {submitted&&sameId(answer, a.id)&&!isAnswerCorrect(a)&&<span className="opt-mark">✗</span>}
          </div>
        );
      })}
    </div>
  );
}

function MultiChoice({ q, answer=[], onAnswer, submitted, onOpenImage }) {
  const selectedIds = Array.isArray(answer) ? answer.map((id) => String(id)) : [];
  const toggle=(id)=>{
    if(submitted)return;
    const idStr = String(id);
    const next = selectedIds.includes(idStr)
      ? selectedIds.filter((x)=>x!==idStr)
      : [...selectedIds,idStr];
    onAnswer(next);
  };
  return (
    <div className="answers-list">
      <div style={{fontSize:'.75rem',color:'var(--muted)',marginBottom:6}}>Có thể chọn nhiều đáp án</div>
      {q.answers.map((a,i)=>{
        let cls='answer-row';
        if(submitted){if(isAnswerCorrect(a))cls+=' correct';else if(selectedIds.includes(String(a.id)))cls+=' wrong';cls+=' disabled';}
        else if(selectedIds.includes(String(a.id)))cls+=' selected';
        return (
          <div key={`${a.id}-${i}`} className={cls} onClick={()=>toggle(a.id)}>
            <div className="opt-key" style={{borderRadius:4}}>{optionLabel(i)}</div>
            <span className="opt-text" style={{ display: 'grid', gap: 6 }}>
              {a.text}
              {a.imageUrl && <img src={a.imageUrl} alt={`option-${i + 1}`} onClick={(e) => { e.stopPropagation(); onOpenImage?.(a.imageUrl); }} style={{ maxHeight: 140, maxWidth: '100%', objectFit: 'contain', borderRadius: 8, cursor: 'zoom-in' }} />}
            </span>
            {submitted&&isAnswerCorrect(a)&&<span className="opt-mark">✓</span>}
          </div>
        );
      })}
    </div>
  );
}

function TrueFalse({ q, answer = {}, onAnswer, submitted, onOpenImage }) {
  const tfItems = Array.isArray(q.answers) ? q.answers : [];
  const pick = (idx, value) => {
    if (submitted) return;
    onAnswer({ ...(answer || {}), [idx]: value });
  };

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
      {tfItems.map((item, idx) => {
        const selected = (answer || {})[idx];
        const actual = isAnswerCorrect(item);
        const isCorrectPick = selected === actual;
        return (
          <div key={`${idx}-${item.text}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: '.9rem' }}>
              {idx + 1}. {item.text}
              {item.imageUrl && <div style={{ marginTop: 6 }}><img src={item.imageUrl} alt={`tf-${idx + 1}`} onClick={() => onOpenImage?.(item.imageUrl)} style={{ maxHeight: 140, maxWidth: '100%', objectFit: 'contain', borderRadius: 8, cursor: 'zoom-in' }} /></div>}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className={`btn btn-sm ${selected === true ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => pick(idx, true)}
                disabled={submitted}
              >
                Đúng
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selected === false ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => pick(idx, false)}
                disabled={submitted}
              >
                Sai
              </button>
            </div>
            {submitted && (
              <div style={{ marginTop: 6, fontSize: '.78rem', color: isCorrectPick ? 'var(--success)' : 'var(--danger)' }}>
                {isCorrectPick ? '✓ Chính xác' : `✗ Đáp án đúng: ${actual ? 'Đúng' : 'Sai'}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FillBlank({ q, answer='', onAnswer, submitted }) {
  const correct=q.answers.map(a=>String(a.text || '').toLowerCase().trim()).filter(Boolean);
  const isOk=correct.includes(String(answer || '').toLowerCase().trim());
  return (
    <div style={{marginTop:16}}>
      <input className="form-input fill-input"
        style={submitted?{borderColor:isOk?'var(--success)':'var(--danger)',background:isOk?'var(--success-bg)':'var(--danger-bg)'}:{}}
        placeholder="Nhập câu trả lời của bạn..." value={answer}
        onChange={e=>!submitted&&onAnswer(e.target.value)} disabled={submitted} />
      {submitted&&<div style={{marginTop:8,fontSize:'.8rem',color:isOk?'var(--success)':'var(--muted)'}}>
        {isOk?'✓ Chính xác!':'Gợi ý: '+q.answers.map(a=>a.text).join(', ')}
      </div>}
    </div>
  );
}

function ArrangeWords({ q, answer, onAnswer, submitted }) {
  const items = (Array.isArray(q.dragItems) && q.dragItems.length)
    ? q.dragItems.map((item, idx) => ({ id: String(item.id || `item-${idx + 1}`), label: item.label || '' })).filter((item) => item.label)
    : [...(q.answers || [])]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item, idx) => ({ id: String(item.id || `item-${idx + 1}`), label: item.text || '' }))
        .filter((item) => item.label);

  const [selectedIds, setSelectedIds] = useState(() => (Array.isArray(answer) ? answer.map((id) => String(id)) : []));

  useEffect(() => {
    setSelectedIds(Array.isArray(answer) ? answer.map((id) => String(id)) : []);
  }, [answer]);

  const remaining = items.filter((item) => !selectedIds.includes(item.id));
  const selected = selectedIds.map((id) => items.find((item) => item.id === id)).filter(Boolean);

  const pick = (itemId) => {
    if (submitted) return;
    if (selectedIds.includes(itemId)) return;
    const next = [...selectedIds, itemId];
    setSelectedIds(next);
    onAnswer(next);
  };

  const remove = (itemId) => {
    if (submitted) return;
    const next = selectedIds.filter((id) => id !== itemId);
    setSelectedIds(next);
    onAnswer(next);
  };

  return (
    <div>
      <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 8 }}>
        Bấm vào các mục theo đúng thứ tự để ghép thành câu hoàn chỉnh.
      </div>
      <div className="drag-pool">
        {remaining.length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Đã chọn hết</span>}
        {remaining.map((item) => (
          <button key={item.id} type="button" className="drag-chip" style={{ cursor: submitted ? 'default' : 'pointer', touchAction: 'manipulation' }} onClick={() => pick(item.id)} disabled={submitted}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="drop-zone" style={{ minHeight: 54 }}>
        {selected.length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Chưa ghép từ nào...</span>}
        {selected.map((item, idx) => (
          <div key={`${item.id}-${idx}`} className="drag-chip" style={{ cursor: 'default' }}>
            <span style={{ marginRight: 5, color: 'var(--muted)', fontSize: '.7rem' }}>{idx + 1}.</span>
            {item.label}
            {!submitted && <button onClick={() => remove(item.id)} style={{ marginLeft: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '.85rem', touchAction: 'manipulation' }}>×</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchWords({ q, answer, onAnswer, submitted }) {
  const items = (Array.isArray(q.dragItems) ? q.dragItems : [])
    .map((item, idx) => ({ id: String(item.id || `item-${idx + 1}`), label: item.label || '' }))
    .filter((item) => item.label);
  const [selectedIds, setSelectedIds] = useState(() => (Array.isArray(answer) ? answer.map((id) => String(id)) : []));
  const [wordPool, setWordPool] = useState(() => shuffleArray(items));

  useEffect(() => {
    setSelectedIds(Array.isArray(answer) ? answer.map((id) => String(id)) : []);
  }, [answer]);

  useEffect(() => {
    setWordPool(shuffleArray(items));
  }, [q.id]);

  const availableItems = wordPool.filter((item) => !selectedIds.includes(item.id));
  const selectedWords = selectedIds.map((id) => wordPool.find((item) => item.id === id) || items.find((item) => item.id === id)).filter(Boolean);

  const pickWord = (itemId) => {
    if (submitted) return;
    if (selectedIds.includes(itemId)) return;
    const next = [...selectedIds, itemId];
    setSelectedIds(next);
    onAnswer(next);
  };

  const removeWord = (itemId) => {
    if (submitted) return;
    const next = selectedIds.filter((id) => id !== itemId);
    setSelectedIds(next);
    onAnswer(next);
  };

  return (
    <div>
      <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 8 }}>
        Dạng nối từ: bấm vào các từ để ghép xuống phần đáp án.
      </div>
      <div className="drag-pool">
        {availableItems.length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Đã chọn hết từ</span>}
        {availableItems.map((item) => (
          <button key={item.id} type="button" className="drag-chip" style={{ cursor: submitted ? 'default' : 'pointer', touchAction: 'manipulation' }} onClick={() => pickWord(item.id)} disabled={submitted}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="drop-zone" style={{ minHeight: 56, marginTop: 10, alignItems: 'flex-start' }}>
        <div style={{ width: '100%', marginBottom: 6, fontWeight: 600, fontSize: '.84rem' }}>Answer:</div>
        {selectedWords.length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Chưa ghép từ nào...</span>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {selectedWords.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="drag-chip" style={{ cursor: 'default' }}>
              {item.label}
              {!submitted && <button onClick={() => removeWord(item.id)} style={{ marginLeft: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '.85rem', touchAction: 'manipulation' }}>×</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DragDropQuestion({ q, answer, onAnswer, submitted }) {
  const items = (Array.isArray(q.dragItems) ? q.dragItems : [])
    .map((item, idx) => ({ id: String(item.id || `item-${idx + 1}`), label: item.label || '' }))
    .filter((item) => item.label);
  const targets = Array.isArray(q.dropTargets) ? q.dropTargets : [];
  const [slotMap, setSlotMap] = useState(() => {
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      return Object.fromEntries(targets.map((target) => [target.id, (Array.isArray(answer[target.id]) ? answer[target.id] : [answer[target.id]]).map((id) => String(id || '')).filter(Boolean)]));
    }
    return Object.fromEntries(targets.map((target) => [target.id, []]));
  });
  const [overSlot, setOverSlot] = useState('');
  const [touchDrag, setTouchDrag] = useState({ active: false, itemId: '', x: 0, y: 0 });

  useEffect(() => {
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      setSlotMap(Object.fromEntries(targets.map((target) => [target.id, (Array.isArray(answer[target.id]) ? answer[target.id] : [answer[target.id]]).map((id) => String(id || '')).filter(Boolean)])));
      return;
    }
    setSlotMap(Object.fromEntries(targets.map((target) => [target.id, []])));
  }, [answer, q.id]);

  const usedIds = Object.values(slotMap).flat();
  const availableItems = items.filter((item) => !usedIds.includes(item.id));
  const isTableLayout = targets.some((target) => String(target?.prompt || '').trim());

  const pushAnswer = (nextMap) => {
    setSlotMap(nextMap);
    onAnswer(nextMap);
  };

  const placeItemToSlot = (itemId, slotId) => {
    if (submitted || !itemId || !slotId) return;
    const nextMap = Object.fromEntries(Object.entries(slotMap).map(([id, values]) => [id, [...values].filter(Boolean)]));
    const currentSlotId = Object.keys(nextMap).find((id) => nextMap[id].includes(itemId));
    if (currentSlotId) {
      nextMap[currentSlotId] = nextMap[currentSlotId].filter((id) => id !== itemId);
    }
    nextMap[slotId] = [...(nextMap[slotId] || []), itemId];
    pushAnswer(nextMap);
  };

  const handleDropToSlot = (event, slotId) => {
    event.preventDefault();
    setOverSlot('');
    if (submitted) return;

    const itemId = String(event.dataTransfer.getData('text/item-id') || '');
    if (!itemId) return;
    placeItemToSlot(itemId, slotId);
  };

  useEffect(() => {
    if (!touchDrag.active || submitted) return undefined;

    const handleTouchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      event.preventDefault();
      const x = touch.clientX;
      const y = touch.clientY;
      const hovered = document.elementFromPoint(x, y)?.closest?.('[data-drop-slot-id]');
      const slotId = hovered?.getAttribute('data-drop-slot-id') || '';
      setOverSlot(slotId);
      setTouchDrag((prev) => ({ ...prev, x, y }));
    };

    const handleTouchEnd = (event) => {
      const touch = event.changedTouches?.[0];
      let slotId = '';
      if (touch) {
        const hovered = document.elementFromPoint(touch.clientX, touch.clientY)?.closest?.('[data-drop-slot-id]');
        slotId = hovered?.getAttribute('data-drop-slot-id') || '';
      }
      if (slotId) {
        placeItemToSlot(touchDrag.itemId, slotId);
      }
      setTouchDrag({ active: false, itemId: '', x: 0, y: 0 });
      setOverSlot('');
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [touchDrag.active, touchDrag.itemId, submitted, slotMap]);

  const removeFromSlot = (slotId, itemId) => {
    if (submitted) return;
    const nextMap = {
      ...slotMap,
      [slotId]: (slotMap[slotId] || []).filter((id) => id !== itemId),
    };
    pushAnswer(nextMap);
  };

  const renderSlot = (target) => (
    <div
      className={`drop-zone${overSlot === target.id ? ' over' : ''}`}
      data-drop-slot-id={target.id}
      onDragOver={(e) => { e.preventDefault(); setOverSlot(target.id); }}
      onDragLeave={() => setOverSlot('')}
      onDrop={(e) => handleDropToSlot(e, target.id)}
      style={{ minHeight: 52, alignItems: 'flex-start' }}
    >
      {!isTableLayout && <div style={{ width: '100%', marginBottom: 6, fontWeight: 600, fontSize: '.84rem' }}>{target.label || target.id}</div>}
      {(slotMap[target.id] || []).length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Kéo mục vào ô này...</span>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(slotMap[target.id] || []).map((itemId, idx) => {
          const item = items.find((x) => String(x.id) === String(itemId));
          return (
            <div key={`${target.id}-${itemId}-${idx}`} className="drag-chip" style={{ cursor: 'default' }}>
              {item?.label || itemId}
              {!submitted && <button onClick={() => removeFromSlot(target.id, itemId)} style={{ marginLeft: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '.85rem', touchAction: 'manipulation' }}>×</button>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 8 }}>
        Kéo các mục ở khung trên vào ô đích tương ứng.
      </div>
      <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 8 }}>
        Trên điện thoại: nhấn giữ mục kéo rồi rê ngón tay vào ô đích để thả.
      </div>
      <div className="drag-pool">
        {availableItems.length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Đã dùng hết mục kéo</span>}
        {availableItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="drag-chip"
            draggable={!submitted}
            onDragStart={(e) => e.dataTransfer.setData('text/item-id', item.id)}
            onTouchStart={(e) => {
              if (submitted) return;
              const touch = e.touches?.[0];
              if (!touch) return;
              setTouchDrag({ active: true, itemId: item.id, x: touch.clientX, y: touch.clientY });
            }}
            style={{
              cursor: submitted ? 'default' : 'pointer',
              touchAction: 'none',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isTableLayout ? (
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {targets.map((target, idx) => (
                <tr key={target.id}>
                  <td style={{ border: '1px solid var(--border)', padding: 10, verticalAlign: 'top', width: '72%' }}>
                    <div style={{ whiteSpace: 'pre-line', lineHeight: 1.45 }}>{target.prompt || `Phát biểu ${idx + 1}`}</div>
                  </td>
                  <td style={{ border: '1px solid var(--border)', padding: 8, verticalAlign: 'top', width: '28%' }}>
                    {renderSlot(target)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          {targets.map((target) => (
            <div key={target.id}>{renderSlot(target)}</div>
          ))}
        </div>
      )}

      {touchDrag.active && (
        <div
          style={{
            position: 'fixed',
            left: touchDrag.x + 12,
            top: touchDrag.y + 12,
            zIndex: 9999,
            pointerEvents: 'none',
            padding: '8px 10px',
            borderRadius: 999,
            border: '1px solid var(--blue)',
            background: 'var(--surface)',
            boxShadow: '0 6px 16px rgba(0,0,0,.15)',
            fontSize: '.84rem',
            fontWeight: 600,
          }}
        >
          {items.find((item) => item.id === touchDrag.itemId)?.label || ''}
        </div>
      )}
    </div>
  );
}

export default function QuizPage() {
  const { lessonId, subjectId } = useParams();
  const navigate = useNavigate();
  const { data } = useData();
  const practiceMode = !lessonId && Boolean(subjectId);
  const practiceSubject = practiceMode
    ? data.subjects.find((item) => String(item.id) === String(subjectId))
    : null;
  const lesson = data.lessons.find((l) => String(l.id) === String(lessonId));
  const subject = practiceMode
    ? practiceSubject
    : data.subjects.find((s) => s.id === lesson?.subjectId);
  const practiceLessons = useMemo(() => {
    if (!practiceMode) return [];
    return data.lessons.filter((item) => String(item.subjectId) === String(subjectId) && !item.locked);
  }, [data.lessons, practiceMode, subjectId]);
  const baseQuestions = useMemo(() => {
    if (practiceMode) {
      const practiceLessonIds = new Set(practiceLessons.map((item) => String(item.id)));
      return data.questions.filter((item) => practiceLessonIds.has(String(item.lessonId)));
    }
    return data.questions.filter((item) => String(item.lessonId) === String(lessonId));
  }, [data.questions, lessonId, practiceLessons, practiceMode]);
  const [questions, setQuestions] = useState([]);
  const [qIdx,setQIdx]=useState(0);
  const [answers,setAnswers]=useState({});
  const [submitted,setSubmitted]=useState(false);
  const [showResult,setShowResult]=useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timeoutTriggered, setTimeoutTriggered] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);
  const [serverSubmitted, setServerSubmitted] = useState(false);
  const attemptLessonRef = useRef(null);
  const q=questions[qIdx];
  const progress=questions.length?((qIdx+1)/questions.length)*100:0;
  const handleAnswer=useCallback((val)=>setAnswers(prev=>({...prev,[qIdx]:val})),[qIdx]);

  const startNewAttempt = useCallback(() => {
    const attemptScope = practiceMode ? `practice_${subjectId}` : `lesson_${lessonId}`;
    const key = `qm_last_attempt_signature_${attemptScope}`;
    const attemptQuestions = practiceMode
      ? buildPracticeQuestions(baseQuestions, practiceLessons, subjectId)
      : baseQuestions;
    const next = buildShuffledAttempt(attemptQuestions, key);
    setQuestions(next);
    setQIdx(0);
    setAnswers({});
    setSubmitted(false);
    setShowResult(false);
    setTimeoutTriggered(false);
    setServerSubmitted(false);
    setRemainingSeconds(practiceMode ? PRACTICE_DURATION_SECONDS : (next.length * TIME_PER_QUESTION_SECONDS));
  }, [practiceMode, subjectId, lessonId, baseQuestions, practiceLessons]);

  useEffect(() => {
    const attemptId = practiceMode ? `practice:${subjectId}` : `lesson:${lessonId}`;
    const lessonChanged = attemptLessonRef.current !== attemptId;
    if (lessonChanged) {
      attemptLessonRef.current = attemptId;
      setQuestions([]);
      setQIdx(0);
      setAnswers({});
      setSubmitted(false);
      setShowResult(false);
      setTimeoutTriggered(false);
      setServerSubmitted(false);
      setRemainingSeconds(0);
    }

    // Start exactly once per lesson attempt when data becomes available.
    if (baseQuestions.length > 0 && questions.length === 0) {
      startNewAttempt();
    }
  }, [practiceMode, subjectId, lessonId, baseQuestions.length, questions.length, startNewAttempt]);

  useEffect(() => {
    if (showResult || questions.length === 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeoutTriggered(true);
          setShowResult(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showResult, questions.length]);

  useEffect(() => {
    if (!showResult || serverSubmitted || !lessonId || !questions.length || practiceMode) return;
    const token = localStorage.getItem('qm_token');
    if (!token || token === 'admin-token' || token.startsWith('token-')) return;

    const toSubmitAnswer = (question, answerValue) => {
      if (question.type === 'single') {
        return answerValue != null ? String(answerValue) : '';
      }
      if (question.type === 'multiple') {
        const selectedIds = Array.isArray(answerValue) ? answerValue : [];
        return selectedIds.map((id) => String(id));
      }
      if (question.type === 'fill') {
        return String(answerValue || '');
      }
      if (question.type === 'truefalse') {
        return answerValue || {};
      }
      if (isDragQuestionType(question.type)) {
        if (answerValue && typeof answerValue === 'object' && !Array.isArray(answerValue)) {
          return answerValue;
        }
        return {};
      }
      if (isArrangeQuestionType(question.type)) {
        return Array.isArray(answerValue) ? answerValue : [];
      }
      if (isMatchQuestionType(question.type)) {
        return Array.isArray(answerValue) ? answerValue : [];
      }
      return answerValue;
    };

    const submitResult = async () => {
      try {
        setIsSubmittingResult(true);
        const payloadAnswers = questions.map((question, idx) => ({
          questionId: String(question.id),
          answer: toSubmitAnswer(question, answers[idx]),
        }));

        const totalQuizSeconds = questions.length * TIME_PER_QUESTION_SECONDS;
        const spent = Math.max(0, totalQuizSeconds - remainingSeconds);

        await resultsAPI.submit({
          lessonId: String(lessonId),
          answers: payloadAnswers,
          timeSpent: spent,
        });
        setServerSubmitted(true);

        let currentUser = {};
        try {
          currentUser = JSON.parse(localStorage.getItem('qm_user') || '{}') || {};
        } catch {
          currentUser = {};
        }

        // Keep user on result screen; leaderboard is opened manually from navigation.
      } catch {
        // Keep local result view even if submit API fails.
      } finally {
        setIsSubmittingResult(false);
      }
    };

    submitResult();
  }, [answers, lessonId, practiceMode, questions, remainingSeconds, serverSubmitted, showResult]);

  const openPreview = (src) => {
    if (!src) return;
    setPreviewImage(src);
  };

  const closePreview = () => setPreviewImage('');

  if (!practiceMode && lesson?.locked) {
    return (
      <div className="app-wrapper"><Navbar/>
        <div className="page-content" style={{paddingTop:60}}>
          <Button variant="ghost" onClick={()=>navigate(-1)} style={{marginBottom:12}}>← Quay lại</Button>
          <EmptyState icon="🔒" text="Bài học này đang bị khoá" />
        </div>
      </div>
    );
  }

  if (practiceMode && !practiceSubject) {
    return (
      <div className="app-wrapper"><Navbar/>
        <div className="page-content" style={{textAlign:'center',paddingTop:60}}>
          <div style={{fontSize:'2.5rem'}}>📚</div>
          <p style={{color:'var(--muted)',marginTop:12}}>Không tìm thấy môn học để luyện thi.</p>
          <Button variant="ghost" onClick={()=>navigate('/practice')} style={{marginTop:16}}>← Quay lại Luyện thi</Button>
        </div>
      </div>
    );
  }

  if(!questions.length) return (
    <div className="app-wrapper"><Navbar/>
      <div className="page-content" style={{textAlign:'center',paddingTop:60}}>
        <div style={{fontSize:'2.5rem'}}>📭</div>
        <p style={{color:'var(--muted)',marginTop:12}}>{practiceMode ? 'Môn học này chưa đủ dữ liệu để tạo đề luyện.' : 'Bài học chưa có câu hỏi.'}</p>
        <Button variant="ghost" onClick={()=>navigate(practiceMode ? '/practice' : -1)} style={{marginTop:16}}>
          {practiceMode ? '← Quay lại Luyện thi' : '← Quay lại'}
        </Button>
      </div>
    </div>
  );

  if(showResult){
    const details = questions.map((question, index) => {
      const result = evaluateQuestion(question, answers[index]);
      const compare = buildComparison(question, answers[index]);
      return {
        question,
        index,
        compare,
        ...result,
      };
    });

    const summary = details.reduce((acc, item) => {
      const questionPoints = Number(item.question?.points || 1);
      return {
        earnedUnits: acc.earnedUnits + item.earnedUnits,
        totalUnits: acc.totalUnits + item.totalUnits,
        fullyCorrect: acc.fullyCorrect + (item.fullyCorrect ? 1 : 0),
        earnedScore: acc.earnedScore + (item.fullyCorrect ? questionPoints : 0),
        totalScore: acc.totalScore + questionPoints,
      };
    }, { earnedUnits: 0, totalUnits: 0, fullyCorrect: 0, earnedScore: 0, totalScore: 0 });

    const chosenCorrect = details
      .filter((item) => item.fullyCorrect)
      .map((item) => ({
        label: `Câu ${item.index + 1}`,
        text: (item.compare.chosenItems || []).map((x) => `${x.label}: ${x.text}`).join(' | ') || 'Không chọn',
      }));

    const chosenWrong = details
      .filter((item) => !item.fullyCorrect)
      .map((item) => ({
        label: `Câu ${item.index + 1}`,
        text: (item.compare.chosenItems || []).map((x) => `${x.label}: ${x.text}`).join(' | ') || 'Không chọn',
      }));

    const pct = summary.totalScore ? Math.round((summary.earnedScore / summary.totalScore) * 100) : 0;
    return (
      <div className="app-wrapper"><Navbar/>
        <div className="page-content quiz-result-view">
          <div className="result-shell result-shell-full">
            <div className="result-card">
              <div className="result-top-summary">
              <div className={`score-ring${pct>=70?' pass':''}`}><span className="score-num">{pct}%</span></div>
              <div style={{fontSize:'1.3rem',fontWeight:700,marginBottom:8}}>{pct>=70?'🎉 Xuất sắc!':pct>=50?'👍 Khá tốt!':'📚 Cần ôn thêm!'}</div>
              <p style={{color:'var(--muted)',fontSize:'.875rem',marginBottom:24}}>
                Đúng {summary.fullyCorrect}/{questions.length} câu • Điểm {summary.earnedScore}/{summary.totalScore} • {practiceMode ? `Luyện thi ${subject?.name || ''}` : lesson?.name}
              </p>
              {isSubmittingResult && (
                <div style={{ marginBottom: 14, fontSize: '.82rem', color: 'var(--muted)' }}>
                  Đang đồng bộ kết quả lên server...
                </div>
              )}
              {timeoutTriggered && (
                <div style={{ marginBottom: 14, fontSize: '.82rem', color: 'var(--danger)' }}>
                  Hết thời gian làm bài. Hệ thống đã tự nộp kết quả.
                </div>
              )}
              <div className="stat-row" style={{marginBottom:24}}>
                {[['Đúng',summary.fullyCorrect,'var(--success)'],['Sai',questions.length-summary.fullyCorrect,'var(--danger)'],['Điểm',`${summary.earnedScore}/${summary.totalScore}`,'var(--blue)']].map(([l,v,c])=>(
                  <div key={l} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'14px 10px',textAlign:'center'}}>
                    <div style={{fontSize:'1.5rem',fontWeight:800,color:c}}>{v}</div>
                    <div style={{fontSize:'.75rem',color:'var(--muted)',marginTop:3}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <Button variant="ghost" onClick={()=>navigate(practiceMode ? '/practice' : -1)}>
                  {practiceMode ? '← Về chọn môn luyện thi' : '← Về danh sách bài'}
                </Button>
                <Button variant="primary" onClick={startNewAttempt}>{practiceMode ? 'Làm đề mới' : 'Làm lại'}</Button>
              </div>
              </div>

              <div className="result-detail-scroll">
                <div className="result-picked-grid">
                  <div className="result-picked-box result-picked-correct">
                    <div className="result-picked-title">Đáp án user đã chọn đúng</div>
                    <div className="result-picked-list">
                      {chosenCorrect.length === 0 && <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Chưa có câu nào đúng.</div>}
                      {chosenCorrect.map((item) => (
                        <div key={`ok-${item.label}`} style={{ fontSize: '.8rem', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{item.label}:</span> <ExpandableText text={item.text} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="result-picked-box result-picked-wrong">
                    <div className="result-picked-title">Đáp án user đã chọn sai</div>
                    <div className="result-picked-list">
                      {chosenWrong.length === 0 && <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Không có đáp án sai.</div>}
                      {chosenWrong.map((item) => (
                        <div key={`wrong-${item.label}`} style={{ fontSize: '.8rem', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{item.label}:</span> <ExpandableText text={item.text} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="result-compare-wrap">
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Đối chiếu kết quả từng câu</div>
                  <div className="result-compare-scroll">
                    {details.map((item) => (
                      <div
                        key={item.question.id || item.index}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          background: item.fullyCorrect ? 'var(--success-bg)' : 'var(--danger-bg)',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          Câu {item.index + 1}: {item.question.text || item.question.question}
                        </div>
                        <div style={{ fontSize: '.8rem', color: item.fullyCorrect ? 'var(--success)' : 'var(--danger)' }}>
                          {item.fullyCorrect ? 'Đúng' : 'Sai'}
                          {item.question.type === 'truefalse' && ` (${item.earnedUnits}/${item.totalUnits} ý đúng)`}
                        </div>
                        <CompareAnswerBlock title="User chọn" items={item.compare.chosenItems || []} />
                        <CompareAnswerBlock title="Đáp án đúng" items={item.compare.correctItems || []} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCorrect=(()=>{
    if(!submitted)return null;
    return evaluateQuestion(q, answers[qIdx]).fullyCorrect;
  })();

  const currentResult = (() => {
    if (!submitted || !q) return null;
    return evaluateQuestion(q, answers[qIdx]);
  })();

  const canCheckCurrent = (() => {
    if (!q) return false;
    const current = answers[qIdx];
    if (q.type === 'truefalse') {
      return q.answers.every((_, idx) => typeof (current || {})[idx] === 'boolean');
    }
    if (q.type === 'fill') {
      return typeof current === 'string' && current.trim().length > 0;
    }
    if (q.type === 'multiple') {
      return Array.isArray(current) && current.length > 0;
    }
    if (q.type === 'single') {
      return current !== undefined;
    }
    if (isDragQuestionType(q.type)) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return false;
      const targets = Array.isArray(q.dropTargets) ? q.dropTargets : [];
      if (!targets.length) return false;
      return targets.every((target) => Array.isArray(current[target.id]) && current[target.id].length > 0);
    }
    if (isArrangeQuestionType(q.type) || isMatchQuestionType(q.type)) {
      return Array.isArray(current) && current.length > 0;
    }
    return null;
  })();

  return (
    <div className="app-wrapper"><Navbar/>
      <div className="quiz-shell">
        <aside className="quiz-sidepanel">
          <div className="quiz-side-block">
            <div className="quiz-side-label">Bài học</div>
            <div className="quiz-side-title">{practiceMode ? `Luyện thi ${subject?.name || ''}` : lesson?.name}</div>
            <div className="quiz-side-meta">{practiceMode ? `${questions.length} câu • 45 phút` : (subject?.name || 'Quiz Practice')}</div>
          </div>

          <div className="quiz-side-block">
            <div className="quiz-side-label">Tiến trình</div>
            <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}/></div>
            <div className="quiz-side-meta">Câu {qIdx + 1}/{questions.length}</div>
          </div>

          <div className="quiz-side-block">
            <div className="quiz-side-label">Thời gian</div>
            <div className={`quiz-time${remainingSeconds <= 30 ? ' warn' : ''}`}>⏱ {formatTime(remainingSeconds)}</div>
          </div>

          <div className="quiz-side-block quiz-side-block-grow">
            <div className="quiz-side-label">Danh sách câu</div>
            <div className="quiz-dot-grid">
              {questions.map((_,i)=>{
                const answered = answers[i] !== undefined;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`quiz-dot${i===qIdx?' cur':''}${answered?' done':''}`}
                    onClick={()=>{setQIdx(i);setSubmitted(false);}}
                  >
                    {i+1}
                  </button>
                );
              })}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={()=>navigate(practiceMode ? '/practice' : -1)}>✕ Thoát</Button>
        </aside>

        <div className="quiz-main-panel">
          <div className="quiz-topbar">
            <div>
              <div style={{fontWeight:700,fontSize:'.9rem'}}>Câu {qIdx+1}</div>
              <div style={{fontSize:'.75rem',color:'var(--muted)',marginTop:2}}>{practiceMode ? `Luyện thi • ${subject?.name || ''}` : lesson?.name}</div>
            </div>
            <div className="quiz-progress-block">
              <div className="progress-label">Tiến trình</div>
              <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}/></div>
            </div>
          </div>
          <div className="question-card">
            <div className="q-type-pill">✦ {TYPE_LABELS[q.type]}</div>
            <div className="q-text">{q.text || q.question}</div>
            {q.imageUrl && (
              <div style={{ marginTop: 14 }}>
                <img
                  src={q.imageUrl}
                  alt="question"
                  onClick={() => openPreview(q.imageUrl)}
                  style={{ width: '100%', maxHeight: 280, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 10, cursor: 'zoom-in' }}
                />
              </div>
            )}
            {q.type==='single'&&<SingleChoice q={q} answer={answers[qIdx]} onAnswer={handleAnswer} submitted={submitted} onOpenImage={openPreview}/>} 
            {q.type==='multiple'&&<MultiChoice q={q} answer={answers[qIdx]} onAnswer={handleAnswer} submitted={submitted} onOpenImage={openPreview}/>} 
            {q.type==='truefalse'&&<TrueFalse q={q} answer={answers[qIdx]} onAnswer={handleAnswer} submitted={submitted} onOpenImage={openPreview}/>} 
            {q.type==='fill'&&<FillBlank q={q} answer={answers[qIdx]||''} onAnswer={handleAnswer} submitted={submitted}/>}
            {isDragQuestionType(q.type)&&<DragDropQuestion key={qIdx} q={q} answer={answers[qIdx]} onAnswer={handleAnswer} submitted={submitted}/>} 
            {isArrangeQuestionType(q.type)&&<ArrangeWords key={qIdx} q={q} answer={answers[qIdx]} onAnswer={handleAnswer} submitted={submitted}/>} 
            {isMatchQuestionType(q.type)&&<MatchWords key={qIdx} q={q} answer={answers[qIdx]} onAnswer={handleAnswer} submitted={submitted}/>} 
            {submitted&&isCorrect!==null&&(
              <div className={`quiz-feedback${isCorrect?' ok':' fail'}`}>
                {q.type === 'truefalse'
                  ? `Bạn đúng ${currentResult?.earnedUnits || 0}/${currentResult?.totalUnits || 0} ý nhỏ.`
                  : isCorrect
                    ? '✓ Chính xác! Câu trả lời của bạn đúng.'
                    : '✗ Chưa đúng. Xem đáp án được đánh dấu màu xanh.'}
              </div>
            )}
            <div className="quiz-nav">
              <Button variant="ghost" onClick={()=>{if(submitted)setSubmitted(false);if(qIdx>0)setQIdx(i=>i-1);}} disabled={qIdx===0}>← Câu trước</Button>
              <div style={{display:'flex',gap:8}}>
                {!submitted&&<Button variant="ghost" onClick={()=>setSubmitted(true)} disabled={!canCheckCurrent}>Kiểm tra</Button>}
                {qIdx<questions.length-1?<Button variant="primary" onClick={()=>{if(submitted)setSubmitted(false);setQIdx(i=>i+1);}}>Câu tiếp →</Button>:<Button variant="secondary" onClick={()=>setShowResult(true)}>Nộp bài ✓</Button>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewImage && (
        <div
          onClick={closePreview}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ position: 'relative', maxWidth: '95vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={closePreview}
              style={{
                position: 'absolute',
                top: -10,
                right: -10,
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 'none',
                background: '#fff',
                color: '#111',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              X
            </button>
            <img
              src={previewImage}
              alt="preview"
              style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10, background: '#fff' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";

// ── QUESTION TYPES ────────────────────────────────────────────────────────────

function SingleChoice({ q, answer, onAnswer, submitted }) {
  return (
    <div className="answers">
      {q.options.map((opt, i) => {
        let cls = "answer-opt";
        if (submitted) {
          cls += " locked";
          if (i === q.correct) cls += " correct";
          else if (answer === i) cls += " wrong";
        } else if (answer === i) cls += " selected";
        return (
          <button key={i} className={cls} onClick={() => !submitted && onAnswer(i)}>
            <div className="opt-key">{String.fromCharCode(65 + i)}</div>
            <span className="opt-text">{opt}</span>
            {submitted && i === q.correct && <span className="opt-icon">✓</span>}
            {submitted && answer === i && i !== q.correct && <span className="opt-icon">✗</span>}
          </button>
        );
      })}
    </div>
  );
}

function TrueFalse({ q, answer, onAnswer, submitted }) {
  const opts = ["Đúng", "Sai"];
  return (
    <div className="answers">
      {opts.map((opt, i) => {
        let cls = "answer-opt";
        if (submitted) {
          cls += " locked";
          if (i === q.correct) cls += " correct";
          else if (answer === i) cls += " wrong";
        } else if (answer === i) cls += " selected";
        return (
          <button key={i} className={cls} onClick={() => !submitted && onAnswer(i)}>
            <div className="opt-key">{i === 0 ? "T" : "F"}</div>
            <span className="opt-text">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultiChoice({ q, answer = [], onAnswer, submitted }) {
  const toggle = (i) => {
    if (submitted) return;
    const next = answer.includes(i) ? answer.filter((x) => x !== i) : [...answer, i];
    onAnswer(next);
  };
  return (
    <div>
      <p style={{ fontSize: ".8rem", color: "var(--muted)", marginBottom: 12 }}>* Chọn tất cả đáp án đúng</p>
      <div className="answers">
        {q.options.map((opt, i) => {
          const checked = (answer || []).includes(i);
          let cls = "answer-opt";
          if (submitted) {
            cls += " locked";
            if (q.correct.includes(i)) cls += " correct";
            else if (checked) cls += " wrong";
          } else if (checked) cls += " selected";
          return (
            <button key={i} className={cls} onClick={() => toggle(i)}>
              <div className="opt-key" style={{ borderRadius: 4 }}>{checked ? "✓" : " "}</div>
              <span className="opt-text">{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FillBlank({ q, answer = "", onAnswer, submitted }) {
  const parts = q.sentence.split("___");
  return (
    <div className="fill-sentence">
      <span>{parts[0]}</span>
      <input
        className="fill-blank-input"
        value={answer}
        onChange={(e) => !submitted && onAnswer(e.target.value)}
        placeholder="..."
        disabled={submitted}
        style={submitted
          ? { borderColor: answer.trim().toLowerCase() === q.correct.toLowerCase() ? "var(--success)" : "var(--danger)" }
          : {}}
      />
      {parts[1] && <span>{parts[1]}</span>}
      {submitted && (
        <span style={{ fontSize: ".825rem", color: answer.trim().toLowerCase() === q.correct.toLowerCase() ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
          {answer.trim().toLowerCase() === q.correct.toLowerCase() ? "✓ Chính xác" : `✗ Đúng là: "${q.correct}"`}
        </span>
      )}
    </div>
  );
}

function DragDrop({ q, answer = {}, onAnswer, submitted }) {
  const [dragging, setDragging] = useState(null);
  const placed = Object.values(answer);
  const pool = q.items.filter((item) => !placed.includes(item));

  const handleDrop = (zone, e) => {
    e.preventDefault();
    const item = e.dataTransfer.getData("text");
    const prev = { ...answer };
    Object.keys(prev).forEach((k) => { if (prev[k] === item) delete prev[k]; });
    onAnswer({ ...prev, [zone]: item });
    setDragging(null);
  };
  const removeFromZone = (zone) => {
    const prev = { ...answer };
    delete prev[zone];
    onAnswer(prev);
  };

  return (
    <div className="drag-layout" style={{ marginTop: 14 }}>
      <p style={{ fontSize: ".8rem", color: "var(--muted)" }}>Kéo các thẻ vào vị trí phù hợp:</p>
      <div className="drag-source">
        {pool.map((item) => (
          <div
            key={item}
            className={`drag-chip${dragging === item ? " dragging" : ""}`}
            draggable={!submitted}
            onDragStart={(e) => { e.dataTransfer.setData("text", item); setDragging(item); }}
            onDragEnd={() => setDragging(null)}
          >{item}</div>
        ))}
        {pool.length === 0 && <span style={{ fontSize: ".8rem", color: "var(--muted)" }}>Tất cả đã được đặt</span>}
      </div>
      <div className="drop-targets">
        {q.zones.map((zone) => (
          <div key={zone} className="drop-row">
            <span className="drop-label">{zone}</span>
            <div
              className={`drop-zone${dragging ? " over" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => !submitted && handleDrop(zone, e)}
            >
              {answer[zone]
                ? <div className="drag-chip" style={{ cursor: submitted ? "default" : "pointer" }}
                    onClick={() => !submitted && removeFromZone(zone)}>
                    {answer[zone]} {!submitted && <span style={{ marginLeft: 6, color: "var(--danger)" }}>×</span>}
                  </div>
                : <span>Kéo vào đây...</span>}
            </div>
            {submitted && (
              <span style={{ fontSize: ".8rem", fontWeight: 700, color: answer[zone] === q.correctMap[zone] ? "var(--success)" : "var(--danger)" }}>
                {answer[zone] === q.correctMap[zone] ? "✓" : `✗ ${q.correctMap[zone]}`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QUESTION RENDERER ──────────────────────────────────────────────────────────
function QuestionRenderer({ q, answer, onAnswer, submitted }) {
  switch (q.type) {
    case "true_false": return <TrueFalse q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} />;
    case "multi": return <MultiChoice q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} />;
    case "fill": return <FillBlank q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} />;
    case "drag": return <DragDrop q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} />;
    default: return <SingleChoice q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} />;
  }
}

const TYPE_LABELS = {
  single: "Một đáp án",
  true_false: "Đúng / Sai",
  multi: "Nhiều đáp án",
  fill: "Điền vào chỗ trống",
  drag: "Kéo & Thả",
};

// ── QUIZCARD (main) ────────────────────────────────────────────────────────────
export default function QuizCard({ questions, title, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [seconds, setSeconds] = useState(questions.reduce((a, q) => a + (q.timeLimit || 30), 0));
  const timerRef = useRef();

  useEffect(() => {
    if (!submitted) {
      timerRef.current = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [submitted]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const q = questions[idx];
  const progress = ((idx + 1) / questions.length) * 100;
  const hasAnswer = answers[idx] !== undefined && answers[idx] !== "" && (typeof answers[idx] !== "object" || Object.keys(answers[idx]).length > 0);

  const handleSubmit = useCallback(() => {
    clearInterval(timerRef.current);
    setSubmitted(true);
    setShowResult(true);
  }, []);

  // score calculation
  const calcScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      const a = answers[i];
      if (q.type === "single" || q.type === "true_false") { if (a === q.correct) correct++; }
      else if (q.type === "multi") {
        if (JSON.stringify((a || []).sort()) === JSON.stringify([...q.correct].sort())) correct++;
      } else if (q.type === "fill") {
        if ((a || "").trim().toLowerCase() === q.correct.toLowerCase()) correct++;
      } else if (q.type === "drag") {
        if (q.zones.every((z) => a?.[z] === q.correctMap[z])) correct++;
      }
    });
    return correct;
  };

  if (showResult) {
    const score = calcScore();
    const pct = Math.round((score / questions.length) * 100);
    const grade = pct >= 80 ? "great" : pct >= 50 ? "" : "fail";
    return (
      <div className="result-wrap fade-in">
        <div className={`score-ring ${grade}`}>
          <span className="score-num">{pct}%</span>
        </div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>
          {pct >= 80 ? "🎉 Xuất sắc!" : pct >= 50 ? "👍 Khá tốt!" : "📚 Cần ôn thêm"}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: 6 }}>
          Bạn trả lời đúng <strong>{score}/{questions.length}</strong> câu
        </p>
        <div className="stat-row" style={{ marginTop: 20 }}>
          {[
            { val: score, label: "Câu đúng", color: "var(--success)" },
            { val: questions.length - score, label: "Câu sai", color: "var(--danger)" },
            { val: fmt(Math.max(0, questions.reduce((a,q)=>a+(q.timeLimit||30),0) - seconds)), label: "Thời gian" },
          ].map(({ val, label, color }) => (
            <div className="stat-card" key={label}>
              <div className="stat-val" style={{ color: color || "var(--text)" }}>{val}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
          <button className="btn btn-outline" onClick={onFinish}>← Về trang chủ</button>
          <button className="btn btn-primary" onClick={() => { setIdx(0); setAnswers({}); setSubmitted(false); setShowResult(false); setSeconds(questions.reduce((a,q)=>a+(q.timeLimit||30),0)); }}>
            Làm lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-shell fade-in">
      {/* Top bar */}
      <div className="quiz-topbar">
        <div className="q-counter">
          Câu <strong>{idx + 1}</strong><span>/{questions.length}</span>
        </div>
        <div className="progress-wrap">
          <div className="progress-label">Tiến trình</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div style={{ fontVariantNumeric: "tabular-nums", fontSize: ".9rem", fontWeight: 700, color: seconds < 60 ? "var(--danger)" : "var(--text)", background: seconds < 60 ? "var(--danger-bg)" : "var(--bg-2)", padding: "6px 12px", borderRadius: "var(--radius-sm)" }}>
          ⏱ {fmt(seconds)}
        </div>
      </div>

      {/* Question */}
      <div className="question-card">
        <div className="q-tag">{TYPE_LABELS[q.type] || q.type}</div>
        <div className="q-text">{q.text}</div>
        <QuestionRenderer q={q} answer={answers[idx]} onAnswer={(v) => setAnswers((a) => ({ ...a, [idx]: v }))} submitted={submitted} />
        {submitted && q.type !== "fill" && q.type !== "drag" && (
          <div className={`feedback-box ${answers[idx] === q.correct || (Array.isArray(q.correct) && JSON.stringify((answers[idx]||[]).sort())=== JSON.stringify([...q.correct].sort())) ? "correct" : "wrong"}`}>
            {answers[idx] === q.correct ? "✓ Chính xác!" : `✗ Đáp án: ${Array.isArray(q.correct) ? q.options?.filter((_,i)=>q.correct.includes(i)).join(", ") : q.options?.[q.correct] || q.correct}`}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="quiz-footer">
        <button className="btn btn-outline" onClick={() => idx > 0 && setIdx((i) => i - 1)} disabled={idx === 0}>
          ← Trước
        </button>
        <div className="quiz-nav">
          {!submitted && (
            <button className="btn btn-ghost btn-sm" onClick={handleSubmit}>Nộp bài ngay</button>
          )}
          {idx < questions.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setIdx((i) => i + 1)}>
              Tiếp theo →
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={handleSubmit}>
              Nộp bài ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

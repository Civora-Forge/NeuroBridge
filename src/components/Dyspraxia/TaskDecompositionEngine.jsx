/**
 * TaskDecompositionEngine.jsx — Module A: Dynamic Task Decomposition
 *
 * UX principles (OCD + DCD intersection):
 *  • One step revealed at a time — prevents "Spaghetti Head" overload
 *  • Voice-to-text input so motor difficulties don't block usage
 *  • Anxiety + Fatigue sliders feed the φ:(Q,C)→G mapping on the backend
 *  • No progress counters visible while working — only soft encouragement
 *  • Global Undo: the previous step can always be returned to
 *  • No "all-or-nothing" — skipping a step is explicitly allowed
 */

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./DyspraxiaModule.module.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000";

const LEVEL_LABELS = {
  anxiety: ["Calm", "Slight worry", "Noticeable", "Anxious", "Very anxious", "High anxiety", "Distressed", "Very distressed", "Overwhelmed", "Extreme"],
  fatigue: ["Energised", "Fresh", "Awake", "Mild tiredness", "Moderately tired", "Tired", "Very tired", "Exhausted", "Drained", "Cannot continue"],
};

const WAITING_SUPPORT = [
  "Roll your shoulders once and let them soften.",
  "Take one slow breath in, then a longer breath out.",
  "Wiggle your fingers and relax your hands.",
  "Look around and name two neutral objects.",
  "Sit back into your chair and feel the support.",
  "Say: ‘I only need the next small step.’",
];

function LevelSlider({ id, label, value, onChange }) {
  const descriptor = LEVEL_LABELS[id]?.[value - 1] ?? "";
  return (
    <div className={styles.levelSlider}>
      <div className={styles.levelHeader}>
        <label htmlFor={id} className={styles.fieldLabel}>{label}</label>
        <span className={styles.levelDescriptor} aria-live="polite">
          {value}/10 — {descriptor}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.rangeInput}
        aria-valuetext={`${value} — ${descriptor}`}
      />
      <div className={styles.rangeTickRow} aria-hidden="true">
        <span>Low</span><span>High</span>
      </div>
    </div>
  );
}

// ─── Voice Input ──────────────────────────────────────────────────────────────
function useVoiceInput(onResult) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Voice input not supported in this browser."); return; }

    const rec = new SR();
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };
    rec.onerror = () => { setError("Could not hear that. Please try again."); setIsListening(false); };
    rec.onend   = () => setIsListening(false);

    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
    setError("");
  }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, error, start, stop };
}

// ─── Progressive Step Reveal ──────────────────────────────────────────────────
function StepReveal({ steps, goal, onRestart }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [history, setHistory]       = useState([]);  // for global Undo
  const [done, setDone]             = useState(false);

  const step = steps[currentIdx];
  const isLast = currentIdx === steps.length - 1;

  function advance(action) {
    setHistory((h) => [...h, { idx: currentIdx, action }]);
    if (isLast) { setDone(true); return; }
    setCurrentIdx((i) => i + 1);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCurrentIdx(prev.idx);
    setDone(false);
  }

  if (done) {
    return (
      <div className={styles.stepDone} role="status" aria-live="polite">
        <span className={styles.stepDoneIcon} aria-hidden="true">✓</span>
        <p className={styles.stepDoneTitle}>You completed: <strong>{goal}</strong></p>
        <p className={styles.stepDoneNote}>
          Take a moment. There's no rush to start the next thing.
        </p>
        <div className={styles.stepActions}>
          <button className={styles.primaryButton} onClick={onRestart}>
            Start a new task
          </button>
          <button className={styles.secondaryButton} onClick={undo}>
            ↩ Undo last step
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stepReveal}>
      {/* Step counter is deliberately de-emphasised — just a subtle hint */}
      <p className={styles.stepCounter} aria-live="polite" aria-atomic="true">
        Step {currentIdx + 1} of {steps.length}
      </p>

      <div className={styles.stepCard} role="region" aria-label="Current step" aria-live="polite">
        <p className={styles.stepText}>{step}</p>
      </div>

      <div className={styles.stepActions}>
        <button
          className={styles.primaryButton}
          onClick={() => advance("done")}
          aria-label="Mark step as done and move to next"
        >
          Done ✓
        </button>
        <button
          className={styles.secondaryButton}
          onClick={() => advance("skip")}
          aria-label="Skip this step"
        >
          Skip
        </button>
        <button
          className={styles.undoButton}
          onClick={undo}
          disabled={history.length === 0}
          aria-label="Undo previous step"
        >
          ↩ Undo
        </button>
      </div>

      <p className={styles.stepEncourage} aria-live="polite">
        Take your time. There is no deadline here.
      </p>
    </div>
  );
}

function LoadingSupport({ waitSeconds }) {
  const idx = Math.floor(waitSeconds / 6) % WAITING_SUPPORT.length;
  const rotateIn = 6 - (waitSeconds % 6);

  return (
    <div className={styles.stepDone} role="status" aria-live="polite">
      <p className={styles.stepDoneTitle}>Preparing your step-by-step plan…</p>
      <p className={styles.stepDoneNote}>{WAITING_SUPPORT[idx]}</p>
      <p className={styles.helperSmall}>Next support prompt in {rotateIn}s</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TaskDecompositionEngine() {
  const [goal, setGoal]           = useState("");
  const [anxiety, setAnxiety]     = useState(5);
  const [fatigue, setFatigue]     = useState(5);
  const [loading, setLoading]     = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [steps, setSteps]         = useState(null);
  const [error, setError]         = useState("");
  const [currentGoal, setCurrentGoal] = useState("");

  const handleVoiceResult = useCallback((transcript) => setGoal(transcript), []);
  const { isListening, error: voiceError, start: startVoice, stop: stopVoice } = useVoiceInput(handleVoiceResult);

  useEffect(() => {
    if (!loading) {
      setWaitSeconds(0);
      return;
    }
    const id = setInterval(() => setWaitSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  async function handleDecompose() {
    const trimmed = goal.trim();
    if (!trimmed) { setError("Please describe what you want to do."); return; }
    setError("");
    setLoading(true);
    setSteps(null);

    try {
      const res = await fetch(`${API_BASE}/api/dyspraxia/decompose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed, anxietyLevel: anxiety, fatigueLevel: fatigue }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setSteps(data.steps ?? []);
      setCurrentGoal(trimmed);
    } catch (e) {
      setError(e.message || "Could not reach the server. Check the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  function handleRestart() {
    setSteps(null);
    setGoal("");
    setCurrentGoal("");
  }

  // ── Showing step-by-step view ────────────────────────────────────────────
  if (steps !== null) {
    return (
      <section className={styles.card} aria-labelledby="decompose-active-title">
        <h2 id="decompose-active-title" className={styles.sectionTitle}>
          Breaking down: <em>{currentGoal}</em>
        </h2>
        <button className={styles.secondaryButton} onClick={handleRestart} style={{ justifySelf: "start" }}>
          ← Start over
        </button>
        <StepReveal steps={steps} goal={currentGoal} onRestart={handleRestart} />
      </section>
    );
  }

  // ── Goal input view ──────────────────────────────────────────────────────
  return (
    <section className={styles.card} aria-labelledby="decompose-title">
      <h2 id="decompose-title" className={styles.sectionTitle}>Task Decomposition</h2>
      <p className={styles.helper}>
        Tell me what you want to do — by typing or speaking. I will break it into small,
        manageable steps matched to how you feel right now.
      </p>

      {/* Goal input */}
      <div className={styles.voiceRow}>
        <label className={styles.fieldLabel} htmlFor="decompose-goal">
          What do you want to do?
        </label>
        <div className={styles.voiceInputGroup}>
          <input
            id="decompose-goal"
            className={styles.fieldInput}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='e.g. "Clean the kitchen" or "Pack my bag"'
            onKeyDown={(e) => e.key === "Enter" && handleDecompose()}
          />
          <button
            className={isListening ? styles.micButtonActive : styles.micButton}
            onClick={isListening ? stopVoice : startVoice}
            aria-label={isListening ? "Stop listening" : "Use voice input"}
            aria-pressed={isListening}
            type="button"
          >
            {isListening ? "🔴 Listening…" : "🎤 Speak"}
          </button>
        </div>
        {voiceError && <p className={styles.errorText} role="alert">{voiceError}</p>}
      </div>

      {/* Anxiety + Fatigue sliders (φ context vector) */}
      <LevelSlider id="anxiety" label="How anxious do you feel?" value={anxiety} onChange={setAnxiety} />
      <LevelSlider id="fatigue" label="How tired do you feel?"   value={fatigue} onChange={setFatigue} />

      <p className={styles.helperSmall}>
        The steps will be adjusted to match your current state — higher anxiety or
        fatigue means smaller, simpler steps.
      </p>

      {error && <p className={styles.errorText} role="alert">{error}</p>}

      <button
        className={styles.primaryButton}
        onClick={handleDecompose}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? "Breaking it down…" : "Break this down for me"}
      </button>

      {loading && <LoadingSupport waitSeconds={waitSeconds} />}
    </section>
  );
}

/**
 * TaskBreakdown.jsx — OCD + DCD Accessible Task Breakdown
 *
 * Clinical rationale for design choices:
 *
 *  PROGRESSIVE REVEAL: Showing all steps simultaneously creates "Spaghetti Head"
 *  cognitive overload for DCD users and hyperactivates OCD scanning behaviour.
 *  One step at a time reduces decision paralysis.
 *
 *  ANTI-COMPULSIVE FRICTION: If a micro-step is checked/unchecked more than 3 times
 *  within a 5-minute window, the screen is temporarily locked with "Trust your memory."
 *  This directly interrupts the OCD checking cycle without shame language.
 *
 *  GLOBAL UNDO: The last check action is always reversible. This removes the
 *  "irreversibility anxiety" that prevents OCD users from committing to a step.
 *
 *  NO PROGRESS BARS: Rigid percentage counters reinforce all-or-nothing thinking.
 *  Replaced with soft encouragement that activates only when the user is moving forward.
 *
 *  NO STREAKS / COUNTS: Number-heavy UIs become checking targets for OCD users.
 */

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { createEntry } from "@/lib/moduleApi";
import styles from "./DyspraxiaModule.module.css";

const INITIAL_TASKS = [
  {
    id: "task-cooking",
    name: "Cooking Pasta",
    icon: "🍳",
    steps: [
      {
        id: "step-water",
        title: "Boil water",
        icon: "💧",
        microSteps: [
          { id: "ms-pot",   label: "Fill pot halfway with water" },
          { id: "ms-stove", label: "Place pot on stove" },
          { id: "ms-heat",  label: "Turn heat to high" },
        ],
      },
      {
        id: "step-pasta",
        title: "Cook pasta",
        icon: "🍝",
        microSteps: [
          { id: "ms-add",   label: "Add pasta to boiling water" },
          { id: "ms-stir",  label: "Stir once to prevent sticking" },
          { id: "ms-timer", label: "Set an 8-minute timer" },
        ],
      },
    ],
  },
  {
    id: "task-bag",
    name: "Pack School Bag",
    icon: "🎒",
    steps: [
      {
        id: "step-books",
        title: "Heavy items first",
        icon: "📚",
        microSteps: [
          { id: "ms-book",   label: "Put books against the back panel" },
          { id: "ms-laptop", label: "Slide laptop into its sleeve" },
        ],
      },
      {
        id: "step-small",
        title: "Smaller items",
        icon: "🖊️",
        microSteps: [
          { id: "ms-pencil", label: "Insert pencil pouch" },
          { id: "ms-bottle", label: "Store water bottle upright" },
        ],
      },
    ],
  },
];

const CHECK_WINDOW_MS  = 5 * 60 * 1000;
const CHECK_LOCK_LIMIT = 3;
const WAIT_SUPPORT_DURATION_SEC = 120;
const WAIT_PROMPTS = [
  "Take one slow breath and release your shoulders.",
  "Check posture: both feet grounded, jaw relaxed.",
  "Name one thing you can smell or hear right now.",
  "Hands soft, breathing steady — no rush.",
  "You only need this moment, not the whole task.",
];

function useCheckLock() {
  const log = useRef({});
  const [lockedStep, setLockedStep] = useState(null);

  const recordCheck = useCallback((stepId) => {
    const now = Date.now();
    const prev = (log.current[stepId] ?? []).filter((t) => now - t < CHECK_WINDOW_MS);
    prev.push(now);
    log.current[stepId] = prev;
    if (prev.length > CHECK_LOCK_LIMIT) {
      setLockedStep(stepId);
      return false;
    }
    return true;
  }, []);

  const unlock = useCallback(() => setLockedStep(null), []);
  return { lockedStep, recordCheck, unlock };
}

function TrustMemoryOverlay({ onDismiss }) {
  return (
    <div className={styles.trustOverlay} role="alertdialog" aria-modal="true" aria-labelledby="trust-title">
      <div className={styles.trustCard}>
        <p className={styles.trustIcon} aria-hidden="true">🧠</p>
        <h3 id="trust-title" className={styles.trustTitle}>Trust your memory.</h3>
        <p className={styles.trustBody}>
          You have checked this step several times. That is the OCD speaking, not a real
          problem. The step is done. Your memory is reliable.
        </p>
        <p className={styles.trustBody}>
          Take a slow breath, then continue when you are ready.
        </p>
        <button className={styles.primaryButton} onClick={onDismiss}>
          I trust myself — continue
        </button>
      </div>
    </div>
  );
}

function MicroStepCard({ microStep, parentTask, parentStep, checked, onToggle }) {
  const isChecked = Boolean(checked[microStep.id]);
  return (
    <div className={`${styles.microStepCard} ${isChecked ? styles.microStepDone : ""}`}>
      <button
        className={`${styles.microStepToggle} ${isChecked ? styles.microStepToggleChecked : ""}`}
        onClick={() => onToggle(microStep.id, parentTask, parentStep, !isChecked)}
        aria-pressed={isChecked}
        aria-label={`${isChecked ? "Unmark" : "Mark"}: ${microStep.label}`}
      >
        <span className={styles.checkMark} aria-hidden="true">{isChecked ? "✓" : " "}</span>
      </button>
      <span className={`${styles.microStepLabel} ${isChecked ? styles.microStepLabelDone : ""}`}>
        {microStep.label}
      </span>
    </div>
  );
}

export default function TaskBreakdown() {
  const [tasks, setTasks]               = useState(INITIAL_TASKS);
  const [activeTaskId, setActiveTaskId] = useState(INITIAL_TASKS[0].id);
  const [checked, setChecked]           = useState({});
  const [undoStack, setUndoStack]       = useState([]);
  const [customStepText, setCustomStepText] = useState("");
  const [visibleStepIdx, setVisibleStepIdx] = useState(0);
  const [waitingMode, setWaitingMode] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const { lockedStep, recordCheck, unlock } = useCheckLock();

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? tasks[0],
    [tasks, activeTaskId],
  );

  const allMicroSteps = useMemo(
    () => activeTask.steps.flatMap((s) => s.microSteps),
    [activeTask],
  );

  const checkedCount  = useMemo(() => allMicroSteps.filter((ms) => checked[ms.id]).length, [allMicroSteps, checked]);
  const showEncourage = checkedCount > 0 && checkedCount < allMicroSteps.length;
  const allDone       = allMicroSteps.length > 0 && checkedCount === allMicroSteps.length;

  async function toggleMicroStep(stepId, taskName, stepName, nextState) {
    if (!recordCheck(stepId)) return;
    setUndoStack((s) => [...s.slice(-19), { stepId, prevState: checked[stepId] ?? false }]);
    setChecked((prev) => ({ ...prev, [stepId]: nextState }));
    await createEntry("/api/dyspraxia/task-breakdown", "dyspraxia-task-breakdown-log", {
      task: taskName, step: stepName, micro_step_id: stepId, completed: nextState,
    });
  }

  function handleUndo() {
    if (!undoStack.length) return;
    const { stepId, prevState } = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setChecked((prev) => ({ ...prev, [stepId]: prevState }));
  }

  function switchTask(id) { setActiveTaskId(id); setVisibleStepIdx(0); }

  function addCustomMicroStep() {
    const text = customStepText.trim();
    if (!text || !activeTask.steps[0]) return;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== activeTask.id) return task;
        const [first, ...rest] = task.steps;
        return { ...task, steps: [{ ...first, microSteps: [...first.microSteps, { id: `custom-${Date.now()}`, label: text }] }, ...rest] };
      }),
    );
    setCustomStepText("");
  }

  const currentStep = activeTask.steps[visibleStepIdx];
  const hasPrev = visibleStepIdx > 0;
  const hasNext = visibleStepIdx < activeTask.steps.length - 1;

  const hasWaitLikeStep = currentStep?.microSteps?.some((ms) => /timer|boil|wait|rest/i.test(ms.label));
  const waitPromptIdx = Math.floor(waitSeconds / 10) % WAIT_PROMPTS.length;
  const waitRemaining = Math.max(WAIT_SUPPORT_DURATION_SEC - waitSeconds, 0);

  useEffect(() => {
    setWaitingMode(false);
    setWaitSeconds(0);
  }, [activeTaskId, visibleStepIdx]);

  useEffect(() => {
    if (!waitingMode) return;
    const id = setInterval(() => {
      setWaitSeconds((s) => {
        if (s + 1 >= WAIT_SUPPORT_DURATION_SEC) {
          setWaitingMode(false);
          return WAIT_SUPPORT_DURATION_SEC;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [waitingMode]);

  return (
    <>
      {lockedStep && <TrustMemoryOverlay onDismiss={unlock} />}
      <section className={styles.card} aria-labelledby="task-breakdown-title">
        <h2 id="task-breakdown-title" className={styles.sectionTitle}>Task Breakdown Guides</h2>
        <p className={styles.helper}>One section at a time. Use the arrows when you are ready to move on.</p>

        <div className={styles.tabRow} role="tablist" aria-label="Choose task">
          {tasks.map((task) => {
            const selected = task.id === activeTask.id;
            return (
              <button key={task.id} className={selected ? styles.tabButtonActive : styles.tabButton}
                onClick={() => switchTask(task.id)} role="tab" aria-selected={selected}>
                <span aria-hidden="true">{task.icon}</span> {task.name}
              </button>
            );
          })}
        </div>

        {showEncourage && <p className={styles.encourageText} role="status" aria-live="polite">You are making progress. Keep going at your own pace.</p>}
        {allDone       && <p className={styles.encourageTextDone} role="status" aria-live="polite">All steps done. Well done — take a moment to rest.</p>}

        {currentStep && (
          <article className={styles.nestedStepCard} aria-labelledby={`step-${currentStep.id}`}>
            <h3 id={`step-${currentStep.id}`} className={styles.nestedStepTitle}>
              <span aria-hidden="true">{currentStep.icon}</span> {currentStep.title}
            </h3>
            <div className={styles.microStepList}>
              {currentStep.microSteps.map((ms) => (
                <MicroStepCard key={ms.id} microStep={ms} parentTask={activeTask.name}
                  parentStep={currentStep.title} checked={checked} onToggle={toggleMicroStep} />
              ))}
            </div>

            {hasWaitLikeStep && (
              <div className={styles.stepDone} style={{ marginTop: "0.75rem" }}>
                <p className={styles.stepDoneTitle}>Need to wait? Use guided wait support.</p>
                {!waitingMode ? (
                  <div className={styles.stepActions}>
                    <button className={styles.secondaryButton} onClick={() => setWaitingMode(true)}>
                      Start 2-minute support
                    </button>
                  </div>
                ) : (
                  <>
                    <p className={styles.stepDoneNote}>{WAIT_PROMPTS[waitPromptIdx]}</p>
                    <p className={styles.helperSmall}>Support timer: {String(Math.floor(waitRemaining / 60)).padStart(2, "0")}:{String(waitRemaining % 60).padStart(2, "0")}</p>
                    <div className={styles.stepActions}>
                      <button className={styles.secondaryButton} onClick={() => setWaitingMode(false)}>
                        End support now
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </article>
        )}

        <div className={styles.stepNavRow}>
          <button className={styles.secondaryButton} onClick={() => setVisibleStepIdx((i) => i - 1)}
            disabled={!hasPrev} aria-label="Previous section">← Previous</button>
          <span className={styles.stepNavCount} aria-live="polite">
            Section {visibleStepIdx + 1} of {activeTask.steps.length}
          </span>
          <button className={styles.primaryButton} onClick={() => setVisibleStepIdx((i) => i + 1)}
            disabled={!hasNext} aria-label="Next section">Next →</button>
        </div>

        <button className={styles.undoButton} onClick={handleUndo} disabled={!undoStack.length} aria-label="Undo last check">
          ↩ Undo last check
        </button>

        <div className={styles.inlineForm}>
          <label className={styles.fieldLabel}>
            Add a custom step to the first section
            <input className={styles.fieldInput} value={customStepText}
              onChange={(e) => setCustomStepText(e.target.value)}
              placeholder="e.g. Place colander in sink before draining"
              onKeyDown={(e) => e.key === "Enter" && addCustomMicroStep()} />
          </label>
          <button className={styles.secondaryButton} onClick={addCustomMicroStep}>Add step</button>
        </div>
      </section>
    </>
  );
}

import { useMemo, useState, useEffect, useCallback } from "react";
import GamifiedMotorExercises from "./GamifiedMotorExercises";
import TaskBreakdown from "./TaskBreakdown";
import RoutineScheduler from "./RoutineScheduler";
import SpatialAwarenessTrainer from "./SpatialAwarenessTrainer";
import FrustrationMoodTracker from "./FrustrationMoodTracker";
import TaskDecompositionEngine from "./TaskDecompositionEngine";
import {
  startJITAIMonitor,
  stopJITAIMonitor,
  subscribeToJITAI,
  JITAI_EVENTS,
} from "@/lib/jitaiService";
import styles from "./DyspraxiaModule.module.css";

const TABS = [
  { id: "decompose", label: "Task Decompose" },
  { id: "motor",    label: "Motor Exercises" },
  { id: "tasks",    label: "Task Breakdown" },
  { id: "routine",  label: "Routine Scheduler" },
  { id: "spatial",  label: "Spatial Trainer" },
  { id: "mood",     label: "Mood Tracker" },
];

/* ── JITAI overlay copy map ─────────────────────────────── */
const JITAI_COPY = {
  [JITAI_EVENTS.SENSORY_CIRCUIT_BREAKER]: {
    headline: "Sensory Check-In",
    body: "Your body might be overwhelmed right now. That is completely okay. Take a slow look around and name 3 things you can see before continuing.",
    cta: "I am ready to continue",
  },
  [JITAI_EVENTS.MOTOR_REST]: {
    headline: "Rest Your Hands",
    body: "You have been moving a lot. Let your hands rest in your lap for a moment. There is no rush — everything will still be here.",
    cta: "I rested — continue",
  },
  [JITAI_EVENTS.ERP_DELAY_PROMPT]: {
    headline: "Gentle Pause",
    body: "Notice the urge to check or redo. You do not need to act on it right now. Just observe it, then decide.",
    cta: "Noted — continue",
  },
  [JITAI_EVENTS.GROUNDING]: {
    headline: "Grounding Moment",
    body: "Press both feet flat on the floor. Feel the pressure. Take one deep breath in through your nose, out through your mouth.",
    cta: "Done — I am grounded",
  },
};

/* ── JITAI overlay component ────────────────────────────── */
function JITAIOverlay({ event, onDismiss }) {
  const copy = JITAI_COPY[event] ?? {
    headline: "Take a moment",
    body: "Pause, breathe, and come back when you are ready.",
    cta: "Continue",
  };

  return (
    <div className={styles.jitaiOverlay} role="dialog" aria-modal="true" aria-label={copy.headline}>
      <div className={styles.jitaiCard}>
        <p className={styles.jitaiHeadline}>{copy.headline}</p>
        <p className={styles.jitaiBody}>{copy.body}</p>
        <div className={styles.jitaiActions}>
          <button className={styles.tabButtonActive} onClick={onDismiss}>
            {copy.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main module ────────────────────────────────────────── */
export default function DyspraxiaModule() {
  const [activeTab, setActiveTab]   = useState("decompose");
  const [jitaiEvent, setJitaiEvent] = useState(null);

  /* Start biometric monitor on mount, clean up on unmount */
  useEffect(() => {
    startJITAIMonitor();
    const unsub = subscribeToJITAI(({ intervention }) => {
      if (intervention) {
        setJitaiEvent(intervention);
      }
    });
    return () => {
      unsub();
      stopJITAIMonitor();
    };
  }, []);

  const dismissJITAI = useCallback(() => setJitaiEvent(null), []);

  const content = useMemo(() => {
    if (activeTab === "decompose") return <TaskDecompositionEngine />;
    if (activeTab === "motor")    return <GamifiedMotorExercises />;
    if (activeTab === "tasks")    return <TaskBreakdown />;
    if (activeTab === "routine")  return <RoutineScheduler />;
    if (activeTab === "spatial")  return <SpatialAwarenessTrainer />;
    return <FrustrationMoodTracker />;
  }, [activeTab]);

  return (
    <div className={styles.moduleShell}>
      {/* JITAI circuit-breaker overlay — rendered above everything */}
      {jitaiEvent && (
        <JITAIOverlay event={jitaiEvent} onDismiss={dismissJITAI} />
      )}

      <header className={styles.moduleHeader}>
        <h1>Dyspraxia Module</h1>
        <p>Motor-friendly tools with guided routines, task decomposition, and compassionate pacing.</p>
      </header>

      <nav className={styles.tabRow} aria-label="Dyspraxia module sections">
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              className={selected ? styles.tabButtonActive : styles.tabButton}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={selected}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {content}
    </div>
  );
}

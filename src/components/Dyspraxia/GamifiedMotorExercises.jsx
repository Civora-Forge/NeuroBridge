import { useEffect, useMemo, useState } from "react";
import styles from "./DyspraxiaModule.module.css";

const randomPercent = () => Math.floor(Math.random() * 70) + 10;

export default function GamifiedMotorExercises() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [target, setTarget] = useState({ x: 30, y: 30 });
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lastMovedAt, setLastMovedAt] = useState(Date.now());
  const [bestReaction, setBestReaction] = useState(null);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const moveId = setInterval(() => {
      setTarget({ x: randomPercent(), y: randomPercent() });
      setLastMovedAt(Date.now());
    }, 900);

    const timerId = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          setIsPlaying(false);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      clearInterval(moveId);
      clearInterval(timerId);
    };
  }, [isPlaying]);

  const accuracy = useMemo(() => (attempts === 0 ? 0 : Math.round((hits / attempts) * 100)), [hits, attempts]);

  const startGame = () => {
    setHits(0);
    setAttempts(0);
    setBestReaction(null);
    setSecondsLeft(30);
    setIsPlaying(true);
  };

  const registerMiss = () => {
    if (isPlaying) {
      setAttempts((previous) => previous + 1);
    }
  };

  const hitTarget = (event) => {
    event.stopPropagation();
    if (!isPlaying) {
      return;
    }

    const reaction = Date.now() - lastMovedAt;
    setBestReaction((previous) => (previous === null ? reaction : Math.min(previous, reaction)));
    setHits((previous) => previous + 1);
    setAttempts((previous) => previous + 1);
    setTarget({ x: randomPercent(), y: randomPercent() });
    setLastMovedAt(Date.now());
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([30]);
    }
  };

  // Show the session summary card after a round ends (not during)
  const showSummary = !isPlaying && attempts > 0;

  return (
    <section className={styles.card} aria-labelledby="motor-title">
      <h2 id="motor-title" className={styles.sectionTitle}>Motor Coordination Practice</h2>
      <p className={styles.helper}>
        Tap the target when it appears. Take your time — this is practice, not a test.
      </p>

      {/* Only show time remaining during active play — no live score to obsess over */}
      {isPlaying && (
        <p className={styles.liveTimer} aria-live="polite" aria-atomic="true">
          {secondsLeft}s remaining
        </p>
      )}

      <div className={styles.gameArena} onClick={registerMiss} role="application"
        aria-label="Tap coordination practice area">
        {isPlaying && (
          <button
            className={styles.targetButton}
            style={{ left: `${target.x}%`, top: `${target.y}%` }}
            onClick={hitTarget}
            aria-label="Tap this target"
          >
            Tap
          </button>
        )}
        {!isPlaying && !showSummary && (
          <p className={styles.arenaPrompt} aria-hidden="true">Press start when ready</p>
        )}
      </div>

      {/* End-of-session summary — compassionate, non-comparative */}
      {showSummary && (
        <div className={styles.sessionSummary} role="status" aria-live="polite">
          <p className={styles.summaryLine}>
            {accuracy >= 70
              ? `Great coordination — you hit ${hits} out of ${attempts} targets.`
              : accuracy >= 40
              ? `Good effort — ${hits} hits. Coordination improves with gentle practice.`
              : `You showed up and practised. That is what matters.`}
          </p>
          {bestReaction && (
            <p className={styles.summarySubLine}>
              Fastest tap: {bestReaction}ms — your reflexes are working.
            </p>
          )}
        </div>
      )}

      <button className={styles.primaryButton} onClick={startGame}>
        {showSummary ? "Practice again" : "Start practice"}
      </button>
    </section>
  );
}

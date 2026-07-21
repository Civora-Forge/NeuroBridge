import { useMemo, useState } from "react";
import styles from "./DyspraxiaModule.module.css";

const COLORS = ["routineBlockA", "routineBlockB", "routineBlockC", "routineBlockD"];

export default function RoutineScheduler() {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("08:00");
  const [reminderMinutes, setReminderMinutes] = useState(1);
  const [routines, setRoutines] = useState([
    { id: "r1", title: "Stretch", time: "07:30", colorClass: COLORS[0] },
    { id: "r2", title: "Breakfast", time: "08:00", colorClass: COLORS[1] },
  ]);

  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => a.time.localeCompare(b.time)),
    [routines],
  );

  const addRoutine = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    const colorClass = COLORS[routines.length % COLORS.length];
    const newRoutine = { id: `routine-${Date.now()}`, title: trimmed, time, colorClass };
    setRoutines((previous) => [...previous, newRoutine]);

    const timeoutMs = Math.max(10, reminderMinutes) * 60 * 1000;
    window.setTimeout(() => {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([120, 80, 120]);
      }
      window.alert(`Routine reminder: ${trimmed}`);
    }, timeoutMs);

    setTitle("");
  };

  return (
    <section className={styles.card} aria-labelledby="routine-title">
      <h2 id="routine-title" className={styles.sectionTitle}>Routine Scheduler</h2>
      <p className={styles.helper}>Large color-coded blocks with haptic reminder support.</p>

      <div className={styles.formGrid}>
        <label className={styles.fieldLabel}>
          Routine name
          <input className={styles.fieldInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Morning medication" />
        </label>
        <label className={styles.fieldLabel}>
          Time
          <input className={styles.fieldInput} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label className={styles.fieldLabel}>
          Reminder after (minutes)
          <input
            className={styles.fieldInput}
            type="number"
            min={1}
            max={240}
            value={reminderMinutes}
            onChange={(event) => setReminderMinutes(Number(event.target.value))}
          />
        </label>
      </div>

      <button className={styles.primaryButton} onClick={addRoutine}>Add routine block</button>

      <div className={styles.timeline}>
        {sortedRoutines.map((routine) => (
          <article key={routine.id} className={`${styles.routineBlock} ${styles[routine.colorClass]}`}>
            <p className={styles.routineTime}>{routine.time}</p>
            <p className={styles.routineTitle}>{routine.title}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

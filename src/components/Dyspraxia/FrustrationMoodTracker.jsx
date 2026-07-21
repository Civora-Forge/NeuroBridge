import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createEntry, getEntries } from "@/lib/moduleApi";
import styles from "./DyspraxiaModule.module.css";

const TASK_OPTIONS = ["Virtual Pegboard", "Writing", "Dressing", "Meal Prep", "Walking Route"];
const EMOJIS = [
  { level: 1, icon: "😌", label: "Calm" },
  { level: 2, icon: "🙂", label: "Okay" },
  { level: 3, icon: "😐", label: "Neutral" },
  { level: 4, icon: "😣", label: "Frustrated" },
  { level: 5, icon: "😫", label: "Very Frustrated" },
];

export default function FrustrationMoodTracker() {
  const [task, setTask] = useState(TASK_OPTIONS[0]);
  const [frustration, setFrustration] = useState(3);
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    getEntries("/api/dyspraxia/mood", "dyspraxia-mood-entries").then(setEntries);
  }, []);

  const chartData = useMemo(
    () => entries.map((entry, index) => ({ sample: index + 1, frustration: Number(entry.frustration ?? 0) })),
    [entries],
  );

  const saveEntry = async () => {
    const payload = { task, frustration, note: note.trim() };
    const created = await createEntry("/api/dyspraxia/mood", "dyspraxia-mood-entries", payload);
    setEntries((previous) => [created, ...previous]);
    setNote("");
  };

  return (
    <section className={styles.card} aria-labelledby="frustration-title">
      <h2 id="frustration-title" className={styles.sectionTitle}>Frustration / Mood Tracker</h2>

      <label className={styles.fieldLabel}>
        Motor task
        <select className={styles.fieldInput} value={task} onChange={(event) => setTask(event.target.value)}>
          {TASK_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <div className={styles.emojiRow} role="group" aria-label="Frustration level">
        {EMOJIS.map((emoji) => {
          const selected = frustration === emoji.level;
          return (
            <button
              key={emoji.level}
              className={selected ? styles.emojiButtonActive : styles.emojiButton}
              onClick={() => setFrustration(emoji.level)}
              aria-pressed={selected}
            >
              <span aria-hidden="true">{emoji.icon}</span>
              <span>{emoji.label}</span>
            </button>
          );
        })}
      </div>

      <label className={styles.fieldLabel}>
        Quick note
        <textarea
          className={styles.fieldTextarea}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What made this task easier or harder?"
        />
      </label>

      <button className={styles.primaryButton} onClick={saveEntry}>Log mood</button>

      <div className={styles.chartContainer}>
        <h3 className={styles.chartTitle}>Frustration trend</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sample" />
            <YAxis domain={[1, 5]} />
            <Tooltip />
            <Area type="monotone" dataKey="frustration" stroke="hsl(var(--mode-dyspraxia))" fill="hsl(var(--mode-dyspraxia) / 0.35)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

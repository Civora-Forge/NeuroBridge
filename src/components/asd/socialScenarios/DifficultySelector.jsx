import { cn } from "@/lib/utils";
import { DIFFICULTY_IDS } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import { DIFFICULTY_TONE } from "./tones";

export default function DifficultySelector({ value, onChange, className, disabled }) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm",
        className,
      )}
      role="group"
      aria-label="Difficulty level"
    >
      {DIFFICULTY_IDS.map((id) => {
        const tone = DIFFICULTY_TONE[id] ?? DIFFICULTY_TONE.easy;
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            disabled={disabled}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? cn("text-white shadow-sm", tone.button) : "text-slate-600 hover:bg-slate-50",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            {tone.label}
          </button>
        );
      })}
    </div>
  );
}

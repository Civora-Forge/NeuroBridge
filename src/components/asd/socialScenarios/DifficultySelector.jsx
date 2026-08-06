import { cn } from "@/lib/utils";
import { DIFFICULTY_IDS } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";

const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function DifficultySelector({ value, onChange, className, disabled }) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-green-100 bg-white p-1 shadow-sm",
        className,
      )}
      role="group"
      aria-label="Difficulty level"
    >
      {DIFFICULTY_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          disabled={disabled}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === id
              ? "bg-green-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-green-50 hover:text-green-700",
            disabled && "opacity-60 cursor-not-allowed",
          )}
        >
          {DIFFICULTY_LABELS[id]}
        </button>
      ))}
    </div>
  );
}

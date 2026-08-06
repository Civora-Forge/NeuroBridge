import { cn } from "@/lib/utils";
import { SCENARIO_CATEGORIES } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import { CATEGORY_TONES, CATEGORY_EMOJI } from "./tones";

export default function CategoryFilter({ value, onChange, className }) {
  const options = [{ id: "all", label: "All" }, ...SCENARIO_CATEGORIES];
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Scenario category">
      {options.map(({ id, label }) => {
        const tone = id === "all" ? null : CATEGORY_TONES[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors border",
              active
                ? id === "all"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : cn("text-white", tone.button)
                : id === "all"
                  ? "bg-white text-slate-600 border-emerald-100 hover:border-emerald-300 hover:text-emerald-700"
                  : cn("bg-white text-slate-600", tone.border, "hover:brightness-95"),
            )}
          >
            {tone && <span className="mr-1">{CATEGORY_EMOJI[id]}</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}

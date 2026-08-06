import { cn } from "@/lib/utils";
import { SCENARIO_CATEGORIES } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";

export default function CategoryFilter({ value, onChange, className }) {
  const options = [{ id: "all", label: "All" }, ...SCENARIO_CATEGORIES];
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Scenario category">
      {options.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors border",
            value === id
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-slate-600 border-green-100 hover:border-green-300 hover:text-green-700",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

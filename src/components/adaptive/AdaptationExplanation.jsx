import { Brain } from "lucide-react";

/** A small, optional explanation for a real, already-visible configuration change. */
export default function AdaptationExplanation({ explanation, className = "" }) {
  if (!explanation) return null;

  return (
    <aside
      className={`rounded-2xl border border-sky-200 bg-sky-50/85 px-4 py-3 text-sm text-sky-950 ${className}`}
      aria-label={explanation.title}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
          <Brain size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-black">{explanation.title}</p>
          <p className="mt-0.5 leading-relaxed text-sky-900/80">{explanation.message}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-bold text-sky-800">Why this changed</summary>
            <p className="mt-1 text-xs leading-relaxed text-sky-900/75">
              The next session is using a different setup based on what you have shared and, when available, previous practice.
            </p>
            <ul className="mt-2 space-y-1 text-xs font-semibold text-sky-950">
              {explanation.appliedChanges.map((change) => <li key={change}>{change}</li>)}
            </ul>
          </details>
        </div>
      </div>
    </aside>
  );
}

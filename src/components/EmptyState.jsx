/**
 * EmptyState.jsx — one shared "nothing here yet" pattern, replacing the
 * several hand-rolled empty-state blocks found across the app. Keeps the
 * copy plain and gives a single, obvious next action instead of none.
 */
export default function EmptyState({ title, description, actionLabel, actionHref, icon, className = "" }) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm ${className}`}>
      {icon && <div className="mb-3 flex justify-center text-3xl">{icon}</div>}
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:shadow-md transition-all"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

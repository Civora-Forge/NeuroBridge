/**
 * AdaptiveSupportCard.jsx — Persistent, non-intrusive adaptive support widget
 *
 * Replaces the intrusive Adaptive Engine popup with a small always-visible
 * status card.
 *
 * Two states:
 *   - neutral:          a quiet "Adaptive Support" indicator (default)
 *   - recommendation:   a "Personalized Support" offer derived from the live
 *                       Adaptive Engine plan, with one primary action
 *
 * The card never blocks content, never auto-executes, and its copy is sourced
 * from the plan (via the intervention resolver metadata) — never from UI-side
 * inference and never in diagnostic language.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { Sparkles, X, ChevronRight } from "lucide-react";
import { getInterventionMeta } from "@/components/interventions/InterventionResolver";

/** Cause-free single-line headlines per recommendation type. */
export const RECOMMENDATION_HEADLINES = {
  guided_breathing: "A short pause might help.",
  sensory_reset: "A little quiet might help.",
  grounding_exercise: "A gentle pause might help.",
  grounding_activity: "A gentle pause might help.",
  calm_space: "A calm pause might help.",
  transition_support: "Small steps might help.",
  fallback: "A gentle pause might help.",
};

/** Display-only time hints per recommendation type. */
const RECOMMENDATION_DURATIONS = {
  guided_breathing: "2 min",
  sensory_reset: "2 min",
  grounding_exercise: "2 min",
  grounding_activity: "2 min",
};

/**
 * Compute the copy shown on the recommendation state from a plan-derived
 * recommendation. Merges resolver metadata (canonical title/description) with
 * the display headline.
 */
export function recommendationCopy(recommendation) {
  if (!recommendation) return null;
  const meta = getInterventionMeta(recommendation.id);
  const duration = RECOMMENDATION_DURATIONS[recommendation.id];
  return {
    headline: RECOMMENDATION_HEADLINES[recommendation.id] ?? RECOMMENDATION_HEADLINES.fallback,
    title: recommendation.title || meta?.title || "Support",
    detail: recommendation.description || meta?.description || "",
    duration: duration ?? null,
  };
}

/**
 * @param {object} props
 * @param {object|null} props.recommendation - Plan-derived recommendation,
 *   or null for the neutral state.
 * @param {(recommendationId: string) => void} [props.onStartSupport]
 * @param {(recommendationId: string) => void} [props.onDismiss]
 */
export default function AdaptiveSupportCard({
  recommendation,
  onStartSupport,
  onDismiss,
}) {
  const active = Boolean(recommendation);
  const copy = recommendationCopy(recommendation);

  return (
    <div
      data-adaptive-support-card="true"
      data-adaptive-card-state={active ? "recommendation" : "neutral"}
      className="fixed bottom-4 right-4 z-[90] w-[min(21rem,calc(100vw-2rem))]"
      role="status"
      aria-live="polite"
    >
      <div className="neuro-card shadow-lg p-3 flex flex-col gap-2 transition-colors">
        <div className="flex items-start gap-2">
          <span
            className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
              active ? "bg-primary/15 text-primary" : "text-primary/70"
            }`}
            aria-hidden="true"
          >
            <Sparkles className="h-3 w-3" />
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {active ? "Personalized Support" : "Adaptive Support"}
            </p>

            {!active ? (
              <p className="text-sm text-foreground leading-snug mt-1">
                I&apos;m keeping an eye on what might make things easier for
                you.
              </p>
            ) : (
              <div className="mt-1">
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {copy.headline}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  {copy.title}
                  {copy.duration ? (
                    <span className="text-muted-foreground/80"> · {copy.duration}</span>
                  ) : null}
                </p>
              </div>
            )}
          </div>

          {active && (
            <button
              type="button"
              aria-label="Dismiss support suggestion"
              onClick={() => onDismiss?.(recommendation.id)}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {active && (
          <button
            type="button"
            onClick={() => onStartSupport?.(recommendation.id)}
            className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Start Support
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
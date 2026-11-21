/**
 * ContextualHelpIntervention.jsx — Contextual help when an activity keeps
 * going wrong (the frustration response of the shared context-to-state
 * inference).
 *
 * Offered only as a user-started support card; the user picks the kind of
 * help that fits. Fixed, non-clinical guidance only: no text input, nothing
 * stored, nothing sent anywhere. The chosen help type is reported to
 * `onComplete` so the intervention outcome is explainable.
 */

import { useState } from "react";
import { ArrowLeft, Footprints, Lightbulb, Route, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CONTEXTUAL_HELP_OPTIONS = Object.freeze([
  {
    id: "smaller_step",
    title: "Make the next step smaller",
    icon: Footprints,
    tips: [
      "Name only the very next physical action — not the whole task.",
      "If it takes more than two minutes, split it again.",
      "Do just that one piece, then decide what comes next.",
    ],
  },
  {
    id: "explain_differently",
    title: "Look at it a different way",
    icon: Lightbulb,
    tips: [
      "Read the instructions one line at a time and pause after each.",
      "Try a small example first, before the real thing.",
      "Say out loud what you are trying to do — it often shows the stuck part.",
    ],
  },
  {
    id: "another_route",
    title: "Try another approach",
    icon: Route,
    tips: [
      "Skip this part for now and do one you know you can finish.",
      "Change how you do it: list instead of paragraph, picture instead of words.",
      "If you keep undoing the same thing, the first version may already be good enough.",
    ],
  },
  {
    id: "come_back_later",
    title: "Come back to it later",
    icon: Clock,
    tips: [
      "Your progress stays where it is.",
      "Note where you stopped, then step away for a few minutes.",
      "Coming back fresh is a strategy, not a failure.",
    ],
  },
]);

/** Framing per variant; the help options themselves are shared. */
const VARIANT_COPY = Object.freeze({
  frustration: {
    heading: "What would help right now?",
    intro: "It looks like this has been taking a few tries. Pick whatever fits — or skip it.",
  },
  continuity: {
    heading: "Lost your place?",
    intro: "You've switched pages a few times in the last minute. Pick what would help you get back on track — or skip it.",
  },
});

export default function ContextualHelpIntervention({ onComplete, onCancel, variant = "frustration" }) {
  const copy = VARIANT_COPY[variant] ?? VARIANT_COPY.frustration;
  const [choice, setChoice] = useState(null);
  const option = CONTEXTUAL_HELP_OPTIONS.find((item) => item.id === choice) ?? null;

  if (option) {
    const Icon = option.icon;
    return (
      <div className="space-y-5 py-2" data-contextual-help-choice={option.id}>
        <button
          type="button"
          onClick={() => setChoice(null)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={14} /> Other kinds of help
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Icon size={18} />
          </span>
          <h2 className="text-xl font-bold text-slate-800">{option.title}</h2>
        </div>
        <ol className="space-y-2">
          {option.tips.map((tip, index) => (
            <li key={tip} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-700">
              <span className="font-bold text-indigo-600">{index + 1}</span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            onClick={() => onComplete?.({ completed: true, helpType: option.id })}
            className="w-full max-w-xs h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md"
          >
            <CheckCircle2 size={16} className="mr-2" /> Back to my activity
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold text-slate-800">{copy.heading}</h2>
        <p className="mx-auto max-w-md text-sm text-slate-600">{copy.intro}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CONTEXTUAL_HELP_OPTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setChoice(item.id)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
            >
              <Icon size={18} className="shrink-0 text-indigo-600" />
              {item.title}
            </button>
          );
        })}
      </div>
      <div className="text-center">
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="text-xs text-slate-500 underline underline-offset-4 hover:text-slate-800"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

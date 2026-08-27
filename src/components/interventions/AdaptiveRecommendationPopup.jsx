/**
 * AdaptiveRecommendationPopup.jsx — Child/Teen-Friendly Adaptive Support Popup
 *
 * Responsibilities:
 *   - Displays non-intrusive prompt when Adaptive Engine recommends support
 *   - Child/teen-friendly title ("Let's make things a little easier")
 *   - Displays recommended intervention title & friendly explanation
 *   - Primary CTA: [ Start Support ] -> opens Role 3 intervention modal
 *   - Secondary CTA: [ Not right now ] -> clean dismissal
 *   - Zero technical jargon (no "cognitive state", "classifier", "policy evaluator")
 */

import { useState } from "react";
import { Sparkles, X, Heart, Wind, Moon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInterventionMeta } from "./InterventionResolver";

export default function AdaptiveRecommendationPopup({
  recommendationId = "guided_breathing",
  titleOverride,
  descriptionOverride,
  onStartSupport,
  onDismiss,
}) {
  const [dismissed, setDismissed] = useState(false);
  const meta = getInterventionMeta(recommendationId);

  const displayTitle = titleOverride || meta.title;
  const displayDescription = descriptionOverride || meta.description;

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleStart = () => {
    onStartSupport?.(recommendationId);
  };

  const isASD = meta.domain === "asd" || recommendationId.includes("sensory") || recommendationId.includes("asd");

  return (
    <aside
      aria-label="Adaptive support recommendation"
      className="fixed bottom-5 right-5 z-50 max-w-sm w-full p-2 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div
        className={`p-4 sm:p-5 rounded-2xl border-2 shadow-[6px_6px_0_rgba(30,42,94,0.08)] bg-white/95 backdrop-blur-md space-y-3 ${
          isASD
            ? "border-[#B2DFDB] shadow-[4px_4px_0_#D5F5EC]"
            : "border-[#C7D2FE] shadow-[6px_6px_0_#DDE8FC]"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isASD ? "bg-[#D5F5EC] text-[#0D9488]" : "bg-[#DDE8FC] text-[#4F6BF6]"
              }`}
            >
              {isASD ? <Moon size={16} /> : <Wind size={16} />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Let's make things a little easier
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss recommendation"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-1 pl-1">
          <h3
            className={`text-base font-bold tracking-tight ${
              isASD ? "text-[#134E4A]" : "text-[#1E2A5E]"
            }`}
          >
            {displayTitle}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {displayDescription}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleStart}
            className={`flex-1 h-9 text-xs font-bold rounded-xl gap-1.5 shadow-sm ${
              isASD
                ? "bg-[#0D9488] hover:bg-[#0F766E] text-white"
                : "bg-[#4F6BF6] hover:bg-[#3B51D4] text-white"
            }`}
          >
            <span>Start Support</span>
            <ArrowRight size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-9 text-xs text-slate-500 hover:text-slate-800 rounded-xl px-2.5"
          >
            Not right now
          </Button>
        </div>
      </div>
    </aside>
  );
}

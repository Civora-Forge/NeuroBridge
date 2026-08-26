/**
 * AmbientAnxietyPrompt.jsx — Non-intrusive ambient reset indicator for active NeuroBridge pages
 *
 * Appears subtly when passive friction index is elevated without blocking the user's current workflow.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Wind, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useContextStateOptional } from "@/context/ContextProvider";
import { useAuth } from "@/context/AuthContext";
import { adaptContextToAnxietyEvidence } from "./domain/anxietyContextAdapter";
import { reasonAnxietyPattern } from "./domain/anxietyReasoner";
import { deriveAnxietyState } from "./domain/anxietyStateEngine";
import { recordDismissal, getRecentDismissalCount } from "./adaptation/anxietyPersonalization";

export default function AmbientAnxietyPrompt() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || "anon";

  const contextState = useContextStateOptional();
  const snapshot = contextState?.context || {};

  const [dismissed, setDismissed] = useState(false);

  const evidenceResult = useMemo(() => adaptContextToAnxietyEvidence(snapshot), [snapshot]);
  const state = useMemo(() => deriveAnxietyState({ contextSnapshot: snapshot }), [snapshot]);
  const reasoning = useMemo(() => reasonAnxietyPattern(state), [state]);

  const recentDismissals = getRecentDismissalCount(userId);

  if (dismissed || reasoning.responseTier < 2 || recentDismissals >= 3) {
    return null;
  }

  const handleDismiss = () => {
    recordDismissal(userId, reasoning.pattern);
    setDismissed(true);
  };

  const handleAccept = () => {
    navigate("/anxiety");
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-3.5 rounded-2xl border border-[#C7D2FE] bg-white/95 backdrop-blur-md shadow-[6px_6px_0_#DDE8FC] flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#DDE8FC] text-[#4F6BF6] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Wind size={18} />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-bold text-[#1E2A5E]">Need a quick 1-minute reset?</p>
          <p className="text-[11px] text-[#6B7BA8] leading-tight">
            NeuroBridge noticed some tension. A short pause can help recharge focus.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs px-2.5 rounded-lg bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE] font-bold"
              onClick={handleAccept}
            >
              Take a Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-[#6B7BA8] hover:text-[#4F6BF6]"
              onClick={handleDismiss}
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-[#6B7BA8] hover:text-[#4F6BF6] p-0.5 rounded-md"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

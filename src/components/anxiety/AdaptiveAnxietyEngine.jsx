/**
 * AdaptiveAnxietyEngine.jsx — Low-Cognitive-Load, Context-Aware Adaptive Anxiety System
 *
 * Responsibilities:
 *   - Primary User Experience: Zero mandatory forms, sliders, or symptom checkboxes.
 *   - Passive Context Driven: Consumes real ContextSnapshot telemetry from ContextProvider.
 *   - Graduated Autonomy: Quiet at baseline (Level 0), subtle prompts when friction rises (Level 1/2),
 *     automatic intervention launch upon 1-tap confirmation.
 *   - 1-Tap Semantic Clarification when needed: [Body] [Thoughts] [Getting started].
 *   - 1-Tap Outcome Feedback: [Better] [Same] [Worse].
 *   - Isolated Evaluator Demo Drawer exposing the full adaptive pipeline.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Wind,
  Lightbulb,
  Zap,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Smile,
  Meh,
  Frown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useContextStateOptional } from "@/context/ContextProvider";
import { useToast } from "@/hooks/use-toast";

import CompanionSticker from "@/components/neurobridge/CompanionSticker";
import AdaptiveGreeting from "@/components/neurobridge/AdaptiveGreeting";

// Domain & Adaptation imports
import {
  EpisodeStatus,
  AnxietyPatternType,
  InterventionId,
} from "./domain/anxietyTypes";
import { deriveAnxietyState } from "./domain/anxietyStateEngine";
import { reasonAnxietyPattern } from "./domain/anxietyReasoner";
import { createEpisode, updateEpisode } from "./domain/anxietyEpisodeEngine";
import { planInterventions } from "./planning/anxietyPlanner";
import { createOutcomeRecord } from "./adaptation/anxietyOutcomeModel";
import {
  recordOutcome,
  recordDismissal,
  loadUserOutcomes,
} from "./adaptation/anxietyPersonalization";

// Intervention Execution Components
import BreathingExecution from "./interventions/BreathingExecution";
import GroundingExecution from "./interventions/GroundingExecution";
import ReframeExecution from "./interventions/ReframeExecution";
import MicroActionExecution from "./interventions/MicroActionExecution";

// Demo Scenarios & Snapshots
import { DEMO_SCENARIO_RUNNERS } from "./demo/anxietyDemoScenarios";

export default function AdaptiveAnxietyEngine() {
  const { user } = useAuth();
  const userId = user?.id || "default_user";
  const { toast } = useToast();

  // Read passive live ContextSnapshot from ContextProvider
  const contextState = useContextStateOptional();
  const liveSnapshot = contextState?.context || null;

  // Active snapshot: live snapshot by default, or simulated demo snapshot if selected
  const [activeSnapshot, setActiveSnapshot] = useState(null);
  const [selectedClarification, setSelectedClarification] = useState(null);
  const [activeDemoScenario, setActiveDemoScenario] = useState(null);

  // Execution & Flow State
  const [activeInterventionId, setActiveInterventionId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [pendingOutcomeRecord, setPendingOutcomeRecord] = useState(null);
  const [lastCompletedOutcome, setLastCompletedOutcome] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Evaluator Debug Drawer
  const [showEvaluatorDrawer, setShowEvaluatorDrawer] = useState(false);

  // Version tick to trigger re-planning after outcome saves
  const [outcomesVersion, setOutcomesVersion] = useState(0);

  // Current snapshot to use (demo override or live passive context)
  const currentSnapshot = activeSnapshot || liveSnapshot || {};

  // 1. Derive Multi-Dimensional State from Passive Context + Optional Clarification
  const derivedState = useMemo(() => {
    return deriveAnxietyState({
      contextSnapshot: currentSnapshot,
      semanticClarification: selectedClarification,
      userBaseline: { taskSwitchFrequency: 0.2, correctionRate: 0.1 },
    });
  }, [currentSnapshot, selectedClarification]);

  // 2. Reason over State & Graduated Autonomy
  const reasoningResult = useMemo(() => {
    return reasonAnxietyPattern(derivedState);
  }, [derivedState]);

  // 3. Plan & Auto-Rank Interventions
  const planResult = useMemo(() => {
    return planInterventions(derivedState, reasoningResult, null, userId);
  }, [derivedState, reasoningResult, userId, outcomesVersion]);

  // Handle Demo Scenario Click
  const handleRunDemoScenario = (scenarioRunner) => {
    const result = scenarioRunner.run(userId);
    setActiveDemoScenario(result);
    setActiveSnapshot(result.rawSnapshot);
    setSelectedClarification(null);
    setActiveInterventionId(null);
    setPendingOutcomeRecord(null);
    setIsDismissed(false);

    toast({
      title: `Loaded ${result.title}`,
      description: "Passive context signals fed into production adapter & reasoning pipeline.",
    });
  };

  const handleResetToLiveContext = () => {
    setActiveDemoScenario(null);
    setActiveSnapshot(null);
    setSelectedClarification(null);
    setActiveInterventionId(null);
    setPendingOutcomeRecord(null);
    setIsDismissed(false);
  };

  // Start the auto-selected intervention
  const handleStartIntervention = (candidateId) => {
    setSessionStartTime(Date.now());
    setActiveInterventionId(candidateId || planResult.recommendedIntervention.id);
    setPendingOutcomeRecord(null);
  };

  // Handle Dismissal ("Not now" / "Keep working")
  const handleDismissPrompt = () => {
    recordDismissal(userId, reasoningResult.pattern);
    setIsDismissed(true);
    toast({
      title: "Prompt dismissed",
      description: "NeuroBridge will stay quiet and adapt future prompt timing.",
    });
  };

  // Execution Finished
  const handleExecutionFinished = (executionData) => {
    const durationSeconds = executionData.durationSeconds || 60;
    setPendingOutcomeRecord({
      interventionId: activeInterventionId,
      patternType: reasoningResult.pattern,
      completed: executionData.completed !== false,
      abandoned: executionData.abandoned === true,
      durationSeconds,
      stateSnapshot: derivedState,
    });
    setActiveInterventionId(null);
  };

  // 1-Tap Outcome Feedback ([Better] [Same] [Worse])
  const handleSelectOutcome = (subjectiveOutcome) => {
    if (!pendingOutcomeRecord) return;

    const outcomeRecord = createOutcomeRecord({
      userId,
      interventionId: pendingOutcomeRecord.interventionId,
      patternType: pendingOutcomeRecord.patternType,
      subjectiveOutcome,
      completed: pendingOutcomeRecord.completed,
      abandoned: pendingOutcomeRecord.abandoned,
      durationSeconds: pendingOutcomeRecord.durationSeconds,
      stateSnapshot: pendingOutcomeRecord.stateSnapshot,
    });

    recordOutcome(outcomeRecord, userId);
    setOutcomesVersion((v) => v + 1);
    setLastCompletedOutcome(outcomeRecord);
    setPendingOutcomeRecord(null);
    setSelectedClarification(null);
    setIsDismissed(true);

    toast({
      title: "Feedback Recorded",
      description: `Saved "${subjectiveOutcome}" response. Personalized candidate weights updated.`,
    });
  };

  // Auto-trigger intervention if semantic clarification was selected
  const handleSelectClarification = (type) => {
    setSelectedClarification(type);
    // After setting clarification, plan updates automatically; start immediately
    const tempState = deriveAnxietyState({
      contextSnapshot: currentSnapshot,
      semanticClarification: type,
    });
    const tempReasoning = reasonAnxietyPattern(tempState);
    const tempPlan = planInterventions(tempState, tempReasoning, null, userId);
    handleStartIntervention(tempPlan.recommendedIntervention.id);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4 sm:py-8">
      {/* ── Evaluator Demo Drawer (Collapsible / Non-Intrusive) ── */}
      <div className="border border-[#C7D2FE] rounded-2xl p-3 bg-[#F0F4FF]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-mono border-[#C7D2FE] text-[#6B7BA8]">
              Evaluator Tools
            </Badge>
            <span className="text-xs text-[#6B7BA8]">
              Simulate passive ContextSnapshots & inspect dataflow
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-[#6B7BA8] hover:text-[#4F6BF6]"
            onClick={() => setShowEvaluatorDrawer(!showEvaluatorDrawer)}
          >
            {showEvaluatorDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showEvaluatorDrawer ? "Hide Pipeline" : "Inspect Adaptive Pipeline"}
          </Button>
        </div>

        {showEvaluatorDrawer && (
          <div className="mt-3 space-y-3 pt-3 border-t border-[#C7D2FE] text-xs">
            {/* Scenario Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {DEMO_SCENARIO_RUNNERS.map((runner, idx) => (
                <Button
                  key={runner.id}
                  variant={activeDemoScenario?.scenarioId === runner.id ? "default" : "outline"}
                  size="sm"
                  className={`h-7 text-xs px-2.5 rounded-lg ${
                    activeDemoScenario?.scenarioId === runner.id
                      ? "bg-[#4F6BF6] text-white"
                      : "border-[#C7D2FE] text-[#6B7BA8] hover:border-[#4F6BF6] hover:text-[#4F6BF6]"
                  }`}
                  onClick={() => handleRunDemoScenario(runner)}
                >
                  {idx + 1}. {runner.title.split(":")[0]}
                </Button>
              ))}
              {activeDemoScenario && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-[#6B7BA8] hover:text-[#4F6BF6]"
                  onClick={handleResetToLiveContext}
                >
                  <RotateCcw size={12} className="mr-1" /> Reset to Live
                </Button>
              )}
            </div>

            {/* Pipeline Data Breakdown */}
            <div className="p-2.5 rounded-xl bg-white border border-[#C7D2FE] font-mono text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#6B7BA8]">1. Active Context:</span>
                <span className="font-bold text-[#1E2A5E]">
                  {activeDemoScenario ? activeDemoScenario.title : "Live Passive Telemetry"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7BA8]">2. Active Evidence:</span>
                <span className="text-[#4F6BF6] font-bold">
                  {derivedState.activeEvidence?.length || 0} friction signals (Deviation: {Math.round(derivedState.behavioralDeviation.value * 100)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7BA8]">3. Inferred Pattern:</span>
                <span className="font-bold text-[#1E2A5E]">{reasoningResult.pattern}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7BA8]">4. Response Tier:</span>
                <span className="font-bold text-[#1E2A5E]">
                  Tier {reasoningResult.responseTier} ({reasoningResult.responseTier === 0 ? "Quiet" : reasoningResult.responseTier === 1 ? "Subtle" : reasoningResult.responseTier === 2 ? "Gentle" : "Active"})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7BA8]">5. Auto-Ranked Action:</span>
                <span className="font-bold text-[#34D399]">
                  {planResult.recommendedIntervention.title} ({Math.round(planResult.recommendedIntervention.score * 100)}% fit)
                </span>
              </div>
              {planResult.personalizationNote && (
                <div className="pt-1 text-[10px] text-[#4F6BF6] border-t border-[#C7D2FE]">
                  ★ Personalization: {planResult.personalizationNote}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Active Intervention Execution View ── */}
      {activeInterventionId && (
        <div className="animate-in fade-in zoom-in-95 duration-200">
          {activeInterventionId === InterventionId.PHYSIOLOGICAL_BREATHING && (
            <BreathingExecution
              onComplete={handleExecutionFinished}
              onCancel={handleExecutionFinished}
            />
          )}
          {activeInterventionId === InterventionId.PHYSIOLOGICAL_GROUNDING && (
            <GroundingExecution
              onComplete={handleExecutionFinished}
              onCancel={handleExecutionFinished}
            />
          )}
          {activeInterventionId === InterventionId.COGNITIVE_REFRAME && (
            <ReframeExecution
              initialThought=""
              onComplete={handleExecutionFinished}
              onCancel={handleExecutionFinished}
            />
          )}
          {activeInterventionId === InterventionId.BEHAVIORAL_MICRO_ACTION && (
            <MicroActionExecution
              initialTask=""
              onComplete={handleExecutionFinished}
              onCancel={handleExecutionFinished}
            />
          )}
        </div>
      )}

      {/* ── 1-Tap Post-Session Feedback View ── */}
      {pendingOutcomeRecord && (
        <Card className="border-[#C7D2FE] shadow-[6px_6px_0_#DDE8FC] bg-gradient-to-b from-[#DDE8FC] to-white text-center p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300 rounded-2xl">
          <div className="flex justify-center">
            <CompanionSticker variant="recovery-sunrise" mood="recovery" size={56} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#1E2A5E]">How are you feeling now?</h2>
            <p className="text-xs text-[#6B7BA8]">
              Single tap helps NeuroBridge adapt future reset recommendations for you.
            </p>
          </div>

          {/* 3 Large Tap Targets: Better / Same / Worse */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              size="lg"
              variant="outline"
              className="h-20 flex-col gap-1.5 border-2 border-[#34D399] hover:bg-[#34D399]/10 hover:border-[#34D399] transition-all rounded-2xl shadow-[2px_2px_0_#DDE8FC]"
              onClick={() => handleSelectOutcome("better")}
            >
              <Smile size={24} className="text-[#34D399]" />
              <span className="font-bold text-[#34D399] text-sm">Better</span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-20 flex-col gap-1.5 border-2 border-[#94A3B8] hover:bg-slate-50 hover:border-[#64748B] transition-all rounded-2xl shadow-[2px_2px_0_#DDE8FC]"
              onClick={() => handleSelectOutcome("same")}
            >
              <Meh size={24} className="text-[#64748B]" />
              <span className="font-bold text-[#64748B] text-sm">Same</span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-20 flex-col gap-1.5 border-2 border-[#FBBF24] hover:bg-[#FBBF24]/10 hover:border-[#FBBF24] transition-all rounded-2xl shadow-[2px_2px_0_#DDE8FC]"
              onClick={() => handleSelectOutcome("worse")}
            >
              <Frown size={24} className="text-[#FBBF24]" />
              <span className="font-bold text-[#FBBF24] text-sm">Worse</span>
            </Button>
          </div>
        </Card>
      )}

      {/* ── Primary Low-Cognitive-Load UX (Zero Forms) ── */}
      {!activeInterventionId && !pendingOutcomeRecord && (
        <div className="space-y-4">
          {/* Level 0: Baseline / Calm Status */}
          {reasoningResult.responseTier === 0 || isDismissed ? (
            <Card className="border-[#C7D2FE] shadow-[4px_4px_0_#DDE8FC] text-center p-8 space-y-6 rounded-2xl bg-white">
              <div className="flex justify-center">
                <CompanionSticker variant="calm-cloud" mood="calm" size={64} />
              </div>
              <div className="space-y-2 max-w-sm mx-auto">
                <h2 className="text-xl font-bold text-[#1E2A5E]">You're doing okay</h2>
                <p className="text-sm text-[#6B7BA8] leading-relaxed">
                  NeuroBridge is quietly watching. If things start feeling tense, support is ready.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-[#6B7BA8] hover:text-[#4F6BF6] rounded-xl border-[#C7D2FE] hover:border-[#4F6BF6]"
                  onClick={() => handleStartIntervention(InterventionId.PHYSIOLOGICAL_BREATHING)}
                >
                  I'd like a quick 1-minute reset
                </Button>
              </div>
            </Card>
          ) : reasoningResult.needsClarification ? (
            /* Ambiguous Friction -> 1-Tap Semantic Clarification */
            <Card className="border-[#C7D2FE] shadow-[6px_6px_0_#DDE8FC] p-6 space-y-5 rounded-2xl bg-white">
              <div className="flex items-center gap-3">
                <CompanionSticker variant="concern" mood="concern" size={40} animate={false} />
                <div>
                  <h2 className="text-base font-bold text-[#1E2A5E]">
                    What feels hardest right now?
                  </h2>
                  <p className="text-xs text-[#6B7BA8]">
                    Single tap immediately starts the right calming exercise.
                  </p>
                </div>
              </div>

              {/* 3 Intuitive Tap Targets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Button
                  variant="outline"
                  className="h-20 flex-col items-start justify-center p-3 text-left border-2 border-[#F87171]/40 hover:bg-[#F87171]/5 hover:border-[#F87171] rounded-xl shadow-[2px_2px_0_#DDE8FC] transition-all"
                  onClick={() => handleSelectClarification("body")}
                >
                  <span className="font-bold text-[#E11D48] text-sm flex items-center gap-1.5">
                    <Wind size={15} /> Body / Tension
                  </span>
                  <span className="text-[11px] text-[#6B7BA8] mt-0.5">
                    Racing pulse, chest tight, physical jitters
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex-col items-start justify-center p-3 text-left border-2 border-[#FBBF24]/40 hover:bg-[#FBBF24]/5 hover:border-[#FBBF24] rounded-xl shadow-[2px_2px_0_#DDE8FC] transition-all"
                  onClick={() => handleSelectClarification("thoughts")}
                >
                  <span className="font-bold text-[#D97706] text-sm flex items-center gap-1.5">
                    <Lightbulb size={15} /> Looping Thoughts
                  </span>
                  <span className="text-[11px] text-[#6B7BA8] mt-0.5">
                    'What if' spirals, second-guessing
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex-col items-start justify-center p-3 text-left border-2 border-[#818CF8]/40 hover:bg-[#818CF8]/5 hover:border-[#818CF8] rounded-xl shadow-[2px_2px_0_#DDE8FC] transition-all"
                  onClick={() => handleSelectClarification("getting_started")}
                >
                  <span className="font-bold text-[#4F46E5] text-sm flex items-center gap-1.5">
                    <Zap size={15} /> Getting Started
                  </span>
                  <span className="text-[11px] text-[#6B7BA8] mt-0.5">
                    Task paralysis, freeze, stuck
                  </span>
                </Button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDismissPrompt}
                  className="text-xs text-[#6B7BA8] hover:text-[#4F6BF6] underline underline-offset-4"
                >
                  Keep working / Not now
                </button>
              </div>
            </Card>
          ) : (
            /* Level 1/2/3 Contextual Prompt Card */
            <Card className="border-[#C7D2FE] shadow-[6px_6px_0_#DDE8FC] p-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-2xl bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CompanionSticker
                    variant={reasoningResult.responseTier >= 3 ? "concern" : "grounding-tree"}
                    mood={reasoningResult.responseTier >= 3 ? "concern" : "grounding"}
                    size={40}
                    animate={false}
                  />
                  <div>
                    <h2 className="text-base font-bold text-[#1E2A5E]">
                      {reasoningResult.responseTier >= 3
                        ? "Let's slow things down for a minute"
                        : "Need a quick 1-minute reset?"}
                    </h2>
                    <p className="text-xs text-[#6B7BA8] mt-0.5">
                      {reasoningResult.rationale}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs font-semibold flex-shrink-0 bg-[#DDE8FC] text-[#4F6BF6] border-[#C7D2FE]">
                  {planResult.recommendedIntervention.title}
                </Badge>
              </div>

              {/* Personalized Adaptation Note if present */}
              {planResult.personalizationNote && (
                <div className="p-3 rounded-xl bg-[#4F6BF6]/5 text-xs text-[#4F6BF6] font-medium flex items-center gap-2 border border-[#C7D2FE]">
                  <ShieldCheck size={16} className="flex-shrink-0" />
                  <span>{planResult.personalizationNote}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button
                  size="lg"
                  className="text-sm font-bold shadow-[3px_3px_0_#C7D2FE] gap-2 bg-[#4F6BF6] text-white hover:bg-[#3B51D4]"
                  onClick={() => handleStartIntervention(planResult.recommendedIntervention.id)}
                >
                  Start {planResult.recommendedIntervention.title}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-sm border-[#C7D2FE] text-[#6B7BA8] hover:text-[#4F6BF6] hover:border-[#4F6BF6]"
                  onClick={handleDismissPrompt}
                >
                  Keep working / Not now
                </Button>
              </div>
            </Card>
          )}

          {/* Last Completed Outcome Confirmation */}
          {lastCompletedOutcome && (
            <Alert className="bg-[#34D399]/5 border-[#34D399]/30 rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
              <AlertTitle className="text-xs font-semibold text-[#065F46]">
                Personalized Adaptation Stored
              </AlertTitle>
              <AlertDescription className="text-xs text-[#6B7BA8] mt-0.5">
                Outcome recorded for pattern <span className="font-semibold text-[#1E2A5E]">{lastCompletedOutcome.patternType}</span>. NeuroBridge will prioritize {lastCompletedOutcome.interventionId.replace(/_/g, " ")} for future matching episodes.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

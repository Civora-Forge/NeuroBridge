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
  Brain,
  Wind,
  ListChecks,
  Lightbulb,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Sliders,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Activity,
  Heart,
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
      <div className="border rounded-2xl p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-mono">
              Evaluator Tools
            </Badge>
            <span className="text-xs text-muted-foreground">
              Simulate passive ContextSnapshots & inspect dataflow
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowEvaluatorDrawer(!showEvaluatorDrawer)}
          >
            {showEvaluatorDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showEvaluatorDrawer ? "Hide Pipeline" : "Inspect Adaptive Pipeline"}
          </Button>
        </div>

        {showEvaluatorDrawer && (
          <div className="mt-3 space-y-3 pt-3 border-t text-xs">
            {/* Scenario Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {DEMO_SCENARIO_RUNNERS.map((runner, idx) => (
                <Button
                  key={runner.id}
                  variant={activeDemoScenario?.scenarioId === runner.id ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-2.5 rounded-lg"
                  onClick={() => handleRunDemoScenario(runner)}
                >
                  {idx + 1}. {runner.title.split(":")[0]}
                </Button>
              ))}
              {activeDemoScenario && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={handleResetToLiveContext}
                >
                  <RotateCcw size={12} className="mr-1" /> Reset to Live
                </Button>
              )}
            </div>

            {/* Pipeline Data Breakdown */}
            <div className="p-2.5 rounded-xl bg-background border font-mono text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">1. Active Context:</span>
                <span className="font-bold text-foreground">
                  {activeDemoScenario ? activeDemoScenario.title : "Live Passive Telemetry"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">2. Active Evidence:</span>
                <span className="text-primary font-bold">
                  {derivedState.activeEvidence?.length || 0} friction signals (Deviation: {Math.round(derivedState.behavioralDeviation.value * 100)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">3. Inferred Pattern:</span>
                <span className="font-bold text-foreground">{reasoningResult.pattern}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">4. Response Tier:</span>
                <span className="font-bold">
                  Tier {reasoningResult.responseTier} ({reasoningResult.responseTier === 0 ? "Quiet" : reasoningResult.responseTier === 1 ? "Subtle" : reasoningResult.responseTier === 2 ? "Gentle" : "Active"})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">5. Auto-Ranked Action:</span>
                <span className="font-bold text-emerald-600">
                  {planResult.recommendedIntervention.title} ({Math.round(planResult.recommendedIntervention.score * 100)}% fit)
                </span>
              </div>
              {planResult.personalizationNote && (
                <div className="pt-1 text-[10px] text-primary border-t">
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
        <Card className="border-primary/40 shadow-xl bg-gradient-to-b from-primary/5 to-background text-center p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">How are you feeling now?</h2>
            <p className="text-xs text-muted-foreground">
              Single tap helps NeuroBridge adapt future reset recommendations for you.
            </p>
          </div>

          {/* 3 Large Tap Targets: Better / Same / Worse */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              size="lg"
              variant="outline"
              className="h-20 flex-col gap-1.5 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-500 transition-all rounded-2xl"
              onClick={() => handleSelectOutcome("better")}
            >
              <Smile size={24} className="text-emerald-600" />
              <span className="font-bold text-emerald-700 text-sm">Better</span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-20 flex-col gap-1.5 border-slate-300 hover:bg-slate-50 hover:border-slate-500 transition-all rounded-2xl"
              onClick={() => handleSelectOutcome("same")}
            >
              <Meh size={24} className="text-slate-600" />
              <span className="font-bold text-slate-700 text-sm">Same</span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-20 flex-col gap-1.5 border-amber-300 hover:bg-amber-50 hover:border-amber-500 transition-all rounded-2xl"
              onClick={() => handleSelectOutcome("worse")}
            >
              <Frown size={24} className="text-amber-600" />
              <span className="font-bold text-amber-700 text-sm">Worse</span>
            </Button>
          </div>
        </Card>
      )}

      {/* ── Primary Low-Cognitive-Load UX (Zero Forms) ── */}
      {!activeInterventionId && !pendingOutcomeRecord && (
        <div className="space-y-4">
          {/* Level 0: Baseline / Calm Status */}
          {reasoningResult.responseTier === 0 || isDismissed ? (
            <Card className="border-border/60 shadow-sm text-center p-8 space-y-6">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner">
                <Wind size={32} />
              </div>
              <div className="space-y-2 max-w-sm mx-auto">
                <h2 className="text-xl font-bold text-slate-800">You're doing okay</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  NeuroBridge is quietly observing in the background. If things start feeling difficult or tense, support is ready.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground rounded-xl"
                  onClick={() => handleStartIntervention(InterventionId.PHYSIOLOGICAL_BREATHING)}
                >
                  I'd like a quick 1-minute reset
                </Button>
              </div>
            </Card>
          ) : reasoningResult.needsClarification ? (
            /* Ambiguous Friction -> 1-Tap Semantic Clarification */
            <Card className="border-primary/40 shadow-lg p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Activity size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    What feels hardest right now?
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Single tap immediately starts the right calming exercise.
                  </p>
                </div>
              </div>

              {/* 3 Intuitive Tap Targets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Button
                  variant="outline"
                  className="h-20 flex-col items-start justify-center p-3 text-left border-rose-200 hover:bg-rose-50/70 hover:border-rose-400 rounded-xl"
                  onClick={() => handleSelectClarification("body")}
                >
                  <span className="font-bold text-rose-700 text-sm flex items-center gap-1.5">
                    <Wind size={15} /> Body / Tension
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Racing pulse, chest tight, physical jitters
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex-col items-start justify-center p-3 text-left border-amber-200 hover:bg-amber-50/70 hover:border-amber-400 rounded-xl"
                  onClick={() => handleSelectClarification("thoughts")}
                >
                  <span className="font-bold text-amber-700 text-sm flex items-center gap-1.5">
                    <Lightbulb size={15} /> Looping Thoughts
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    'What if' spirals, second-guessing
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex-col items-start justify-center p-3 text-left border-indigo-200 hover:bg-indigo-50/70 hover:border-indigo-400 rounded-xl"
                  onClick={() => handleSelectClarification("getting_started")}
                >
                  <span className="font-bold text-indigo-700 text-sm flex items-center gap-1.5">
                    <Zap size={15} /> Getting Started
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Task paralysis, freeze, stuck
                  </span>
                </Button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDismissPrompt}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Keep working / Not now
                </button>
              </div>
            </Card>
          ) : (
            /* Level 1/2/3 Contextual Prompt Card */
            <Card className="border-primary/40 shadow-lg p-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {reasoningResult.responseTier >= 3
                        ? "Let's slow things down for a minute"
                        : "Need a quick 1-minute reset?"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {reasoningResult.rationale}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs font-semibold flex-shrink-0">
                  {planResult.recommendedIntervention.title}
                </Badge>
              </div>

              {/* Personalized Adaptation Note if present */}
              {planResult.personalizationNote && (
                <div className="p-3 rounded-xl bg-primary/10 text-xs text-primary font-medium flex items-center gap-2">
                  <ShieldCheck size={16} className="flex-shrink-0" />
                  <span>{planResult.personalizationNote}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button
                  size="lg"
                  className="text-sm font-bold shadow-md gap-2"
                  onClick={() => handleStartIntervention(planResult.recommendedIntervention.id)}
                >
                  Start {planResult.recommendedIntervention.title}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-sm"
                  onClick={handleDismissPrompt}
                >
                  Keep working / Not now
                </Button>
              </div>
            </Card>
          )}

          {/* Last Completed Outcome Confirmation */}
          {lastCompletedOutcome && (
            <Alert className="bg-emerald-500/10 border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-xs font-semibold text-emerald-700">
                Personalized Adaptation Stored
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                Outcome recorded for pattern <span className="font-semibold text-foreground">{lastCompletedOutcome.patternType}</span>. NeuroBridge will prioritize {lastCompletedOutcome.interventionId.replace(/_/g, " ")} for future matching episodes.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

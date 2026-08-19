/**
 * AdaptiveAnxietyEngine.jsx — Primary user interface for the Adaptive Anxiety Engine
 *
 * Demonstrates the complete cognitive loop:
 *   Context/Input → Inferred Multi-Dimensional State → Pattern Reasoning →
 *   Intervention Planning/Ranking → Interactive Execution → Outcome Quality Capture →
 *   State-Specific Personalization
 */

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Brain,
  Wind,
  ListChecks,
  Lightbulb,
  Zap,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sliders,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Domain & Adaptation imports
import {
  EpisodeStatus,
  AnxietyPatternType,
  InterventionId,
  CONTEXT_TAGS,
} from "./domain/anxietyTypes";
import { deriveAnxietyState } from "./domain/anxietyStateEngine";
import { reasonAnxietyPattern } from "./domain/anxietyReasoner";
import { createEpisode, updateEpisode } from "./domain/anxietyEpisodeEngine";
import { planInterventions } from "./planning/anxietyPlanner";
import { createOutcomeRecord } from "./adaptation/anxietyOutcomeModel";
import {
  recordOutcome,
  loadUserOutcomes,
  clearUserOutcomes,
} from "./adaptation/anxietyPersonalization";

// Intervention Execution Components
import BreathingExecution from "./interventions/BreathingExecution";
import GroundingExecution from "./interventions/GroundingExecution";
import ReframeExecution from "./interventions/ReframeExecution";
import MicroActionExecution from "./interventions/MicroActionExecution";

// Demo Scenarios
import { DEMO_SCENARIO_RUNNERS } from "./demo/anxietyDemoScenarios";

export default function AdaptiveAnxietyEngine() {
  const { user } = useAuth();
  const userId = user?.id || "default_user";
  const { toast } = useToast();

  // User Input State
  const [severity, setSeverity] = useState(4);
  const [selectedTags, setSelectedTags] = useState([]);
  const [triggerText, setTriggerText] = useState("");
  const [history, setHistory] = useState([]);

  // Execution & Flow State
  const [activeInterventionId, setActiveInterventionId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [preSeverityForSession, setPreSeverityForSession] = useState(null);
  const [postSeverityInput, setPostSeverityInput] = useState(3);
  const [pendingOutcomeRecord, setPendingOutcomeRecord] = useState(null);
  const [lastCompletedOutcome, setLastCompletedOutcome] = useState(null);

  // Episode tracking
  const [currentEpisode, setCurrentEpisode] = useState(null);

  // UI expanders
  const [showEvidence, setShowEvidence] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [activeDemoScenario, setActiveDemoScenario] = useState(null);

  // Toggle contextual tags
  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Derive Multi-Dimensional State
  const derivedState = useMemo(() => {
    return deriveAnxietyState(
      {
        severity,
        selectedTags,
        triggerText,
      },
      history
    );
  }, [severity, selectedTags, triggerText, history]);

  // Derive Pattern Reasoning
  const reasoningResult = useMemo(() => {
    return reasonAnxietyPattern(derivedState);
  }, [derivedState]);

  // Synchronize or initialize Episode
  useEffect(() => {
    setCurrentEpisode((prev) => updateEpisode(prev, derivedState));
  }, [derivedState]);

  // Plan & Rank Interventions (uses personalized outcome history)
  const [outcomesVersion, setOutcomesVersion] = useState(0);
  const planResult = useMemo(() => {
    return planInterventions(derivedState, reasoningResult, currentEpisode, userId);
  }, [derivedState, reasoningResult, currentEpisode, userId, outcomesVersion]);

  // Load Scenario from Demo Runner
  const handleRunDemoScenario = (scenarioRunner) => {
    const result = scenarioRunner.run(userId);
    setActiveDemoScenario(result);
    setSeverity(result.input.severity);
    setSelectedTags(result.input.selectedTags || []);
    setTriggerText(result.input.triggerText || "");
    setHistory(result.history || []);
    setActiveInterventionId(null);
    setPendingOutcomeRecord(null);
    setLastCompletedOutcome(null);

    toast({
      title: `Loaded ${result.title}`,
      description: "State, reasoning, and ranking recomputed with deterministic scenario data.",
    });
  };

  // Start Intervention
  const handleStartIntervention = (candidateId) => {
    setPreSeverityForSession(severity);
    setSessionStartTime(Date.now());
    setActiveInterventionId(candidateId);
    setPendingOutcomeRecord(null);
  };

  // Complete Active Intervention Execution Component
  const handleExecutionFinished = (executionData) => {
    const durationSeconds = executionData.durationSeconds || 60;
    const defaultPostSeverity = Math.max(0, preSeverityForSession - 3);
    setPostSeverityInput(defaultPostSeverity);

    setPendingOutcomeRecord({
      interventionId: activeInterventionId,
      patternType: reasoningResult.pattern,
      preSeverity: preSeverityForSession,
      completed: executionData.completed !== false,
      abandoned: executionData.abandoned === true,
      durationSeconds,
      stateSnapshot: derivedState,
    });
    setActiveInterventionId(null);
  };

  // Finalize Outcome with User Post-Rating
  const handleConfirmPostSeverity = () => {
    if (!pendingOutcomeRecord) return;

    const outcomeRecord = createOutcomeRecord({
      userId,
      interventionId: pendingOutcomeRecord.interventionId,
      patternType: pendingOutcomeRecord.patternType,
      preSeverity: pendingOutcomeRecord.preSeverity,
      postSeverity: postSeverityInput,
      completed: pendingOutcomeRecord.completed,
      abandoned: pendingOutcomeRecord.abandoned,
      durationSeconds: pendingOutcomeRecord.durationSeconds,
      stateSnapshot: pendingOutcomeRecord.stateSnapshot,
    });

    recordOutcome(outcomeRecord, userId);
    setOutcomesVersion((v) => v + 1);
    setLastCompletedOutcome(outcomeRecord);

    // Update episode
    setCurrentEpisode((prev) =>
      updateEpisode(prev, derivedState, {
        interventionId: outcomeRecord.interventionId,
        delta: outcomeRecord.delta,
        postSeverity: outcomeRecord.postSeverity,
        completed: outcomeRecord.completed,
      })
    );

    // Update severity to the post rating and log into history
    setHistory((prev) => [
      {
        severity: outcomeRecord.postSeverity,
        level: outcomeRecord.postSeverity,
        loggedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setSeverity(outcomeRecord.postSeverity);
    setPendingOutcomeRecord(null);

    toast({
      title: "Outcome Recorded & Learning Updated",
      description: `Recorded ${outcomeRecord.delta >= 0 ? `-${outcomeRecord.delta}` : `+${Math.abs(outcomeRecord.delta)}`} change in distress. Personalized candidate weights updated.`,
    });
  };

  // Pattern color styling helpers
  const getPatternBadgeVariant = (pattern) => {
    switch (pattern) {
      case AnxietyPatternType.PHYSIOLOGICAL_ESCALATION:
        return "bg-rose-500/10 text-rose-600 border-rose-200";
      case AnxietyPatternType.COGNITIVE_WORRY_LOOP:
        return "bg-amber-500/10 text-amber-600 border-amber-200";
      case AnxietyPatternType.AVOIDANCE_DRIVEN:
        return "bg-indigo-500/10 text-indigo-600 border-indigo-200";
      case AnxietyPatternType.SENSORY_OVERWHELM:
        return "bg-teal-500/10 text-teal-600 border-teal-200";
      case AnxietyPatternType.STABLE_BASELINE:
        return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
      default:
        return "bg-slate-500/10 text-slate-600 border-slate-200";
    }
  };

  const getEpisodeBadgeVariant = (status) => {
    switch (status) {
      case EpisodeStatus.ESCALATING:
        return "bg-rose-500/10 text-rose-600 border-rose-300";
      case EpisodeStatus.ACTIVE:
        return "bg-amber-500/10 text-amber-600 border-amber-300";
      case EpisodeStatus.RECOVERING:
        return "bg-blue-500/10 text-blue-600 border-blue-300";
      case EpisodeStatus.RESOLVED:
      case EpisodeStatus.BASELINE:
        return "bg-emerald-500/10 text-emerald-600 border-emerald-300";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header & Demo Scenario Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Brain className="text-primary h-7 w-7" /> Adaptive Anxiety Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            State-aware reasoning, multi-dimensional inference, and closed-loop personalized adaptation.
          </p>
        </div>

        {/* Demo Scenario Selectors */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
            Demo Scenarios:
          </span>
          {DEMO_SCENARIO_RUNNERS.map((item, idx) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2.5 rounded-lg border-primary/20 hover:bg-primary/10"
              onClick={() => handleRunDemoScenario(item)}
            >
              {idx + 1}. {item.id.replace("scenario_", "S")}
            </Button>
          ))}
        </div>
      </div>

      {/* Demo Scenario Banner if active */}
      {activeDemoScenario && (
        <Alert className="bg-primary/5 border-primary/30">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertTitle className="text-sm font-semibold">{activeDemoScenario.title}</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground mt-1">
            Demonstrating deterministic production engine behavior. Expected pattern:{" "}
            <span className="font-semibold text-foreground">
              {activeDemoScenario.expectedPattern || activeDemoScenario.scenarioId}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Active Intervention Execution Modal/Container */}
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
              initialThought={triggerText}
              onComplete={handleExecutionFinished}
              onCancel={handleExecutionFinished}
            />
          )}
          {activeInterventionId === InterventionId.BEHAVIORAL_MICRO_ACTION && (
            <MicroActionExecution
              initialTask={triggerText}
              onComplete={handleExecutionFinished}
              onCancel={handleExecutionFinished}
            />
          )}
        </div>
      )}

      {/* Post-Intervention Rating Card */}
      {pendingOutcomeRecord && (
        <Card className="border-primary/40 shadow-lg bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <CheckCircle2 size={20} /> How do you feel after the session?
            </CardTitle>
            <CardDescription>
              Session completed. Rate your current anxiety level to measure reduction and update your personalized adaptation weights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-medium">
                <span>Before session: {pendingOutcomeRecord.preSeverity}/10</span>
                <span className="font-bold text-primary">Current rating: {postSeverityInput}/10</span>
              </div>
              <Slider
                value={[postSeverityInput]}
                min={0}
                max={10}
                step={1}
                onValueChange={(val) => setPostSeverityInput(val[0])}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0 = Completely calm</span>
                <span>10 = Extreme distress</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-background border text-sm">
              <span className="text-muted-foreground">Change in distress:</span>
              <span
                className={`font-bold ${
                  pendingOutcomeRecord.preSeverity - postSeverityInput > 0
                    ? "text-emerald-600 flex items-center gap-1"
                    : "text-slate-600"
                }`}
              >
                {pendingOutcomeRecord.preSeverity - postSeverityInput > 0 && <TrendingDown size={16} />}
                {pendingOutcomeRecord.preSeverity - postSeverityInput > 0
                  ? `-${pendingOutcomeRecord.preSeverity - postSeverityInput} points reduction`
                  : "0 points change"}
              </span>
            </div>

            <Button onClick={handleConfirmPostSeverity} className="w-full">
              Save Outcome & Update Personalization
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Flow: Check-In & State Derivation */}
      {!activeInterventionId && !pendingOutcomeRecord && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Perception / Check-in Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders size={18} /> Context & Check-In
                </CardTitle>
                <CardDescription>
                  Report current distress level and active symptoms.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 1. Severity Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold">Anxiety Intensity</label>
                    <Badge variant="outline" className="text-sm font-bold">
                      {severity}/10
                    </Badge>
                  </div>
                  <Slider
                    value={[severity]}
                    min={0}
                    max={10}
                    step={1}
                    onValueChange={(val) => setSeverity(val[0])}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>0 (Calm)</span>
                    <span>5 (Moderate)</span>
                    <span>10 (Peak)</span>
                  </div>
                </div>

                {/* 2. Symptom & Context Tag Toggles */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Context Signals:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(CONTEXT_TAGS).map((tag) => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all text-left ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary font-medium shadow-sm"
                              : "bg-background hover:bg-muted border-border text-muted-foreground"
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Trigger text */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trigger or Context Notes:
                  </label>
                  <Input
                    value={triggerText}
                    onChange={(e) => setTriggerText(e.target.value)}
                    placeholder="e.g., Presentation starting in 15 minutes / Feeling behind on deadlines..."
                    className="text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Inferred Dimensions Box */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Activity size={16} className="text-primary" /> Inferred State Dimensions
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs font-mono">
                    Conf: {Math.round(derivedState.overallConfidence * 100)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                {/* 5 Inferred Dimensions */}
                {[
                  { label: "Arousal (Physical)", dim: derivedState.arousal, color: "bg-rose-500" },
                  { label: "Rumination (Worry)", dim: derivedState.rumination, color: "bg-amber-500" },
                  { label: "Avoidance (Paralysis)", dim: derivedState.avoidance, color: "bg-indigo-500" },
                  { label: "Cognitive Load", dim: derivedState.cognitiveLoad, color: "bg-teal-500" },
                  { label: "Escalation Velocity", dim: derivedState.escalation, color: "bg-purple-500" },
                ].map(({ label, dim, color }) => (
                  <div key={label} className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <span>{label}</span>
                      <span>{Math.round(dim.value * 100)}%</span>
                    </div>
                    <Progress value={dim.value * 100} className="h-1.5" />
                  </div>
                ))}

                {/* Expandable Evidence */}
                <div className="pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowEvidence(!showEvidence)}
                    className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                  >
                    {showEvidence ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showEvidence ? "Hide state evidence details" : "View state evidence & signals"}
                  </button>

                  {showEvidence && (
                    <div className="mt-2 space-y-2 p-2.5 rounded-lg bg-muted/60 text-xs font-mono">
                      <div>
                        <p className="font-bold text-foreground">Severity:</p>
                        <p className="text-muted-foreground">{derivedState.severity.evidence.join("; ")}</p>
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Arousal:</p>
                        <p className="text-muted-foreground">{derivedState.arousal.evidence.join("; ")}</p>
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Rumination:</p>
                        <p className="text-muted-foreground">{derivedState.rumination.evidence.join("; ")}</p>
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Avoidance:</p>
                        <p className="text-muted-foreground">{derivedState.avoidance.evidence.join("; ")}</p>
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Escalation Velocity:</p>
                        <p className="text-muted-foreground">{derivedState.escalation.evidence.join("; ")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Reasoning & Adaptive Decision Engine (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Reasoning & Pattern Card */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Inferred Pattern & Reasoning
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs font-bold ${getPatternBadgeVariant(reasoningResult.pattern)}`}>
                      {reasoningResult.pattern.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" className={`text-xs font-semibold ${getEpisodeBadgeVariant(currentEpisode?.status)}`}>
                      Episode: {currentEpisode?.status || "ACTIVE"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium leading-relaxed">
                  {reasoningResult.rationale}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-xs text-muted-foreground font-semibold mr-1">Dominant Factors:</span>
                  {reasoningResult.dominantFactors.map((factor) => (
                    <Badge key={factor} variant="secondary" className="text-xs capitalize">
                      {factor.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 2. Recommendation Card */}
            <Card className="border-primary/40 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles size={15} /> Recommended Adaptive Action
                  </span>
                  <Badge variant="secondary" className="text-xs font-bold">
                    Fit Score: {Math.round(planResult.recommendedIntervention.score * 100)}%
                  </Badge>
                </div>
                <CardTitle className="text-xl mt-1">
                  {planResult.recommendedIntervention.title}
                </CardTitle>
                <CardDescription>
                  {planResult.recommendedIntervention.shortDesc}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Why this fits */}
                <div className="p-3 rounded-xl bg-muted/60 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-foreground">Why this fits:</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {planResult.fitReason}
                  </p>
                </div>

                {/* Personalized adaptation note if present */}
                {planResult.personalizationNote && (
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1 text-xs">
                    <p className="font-semibold text-primary flex items-center gap-1">
                      <ShieldCheck size={14} /> Personalized Adaptation Applied:
                    </p>
                    <p className="text-foreground">{planResult.personalizationNote}</p>
                  </div>
                )}

                {/* Action button */}
                {planResult.isMonitorOnly ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <p className="text-sm font-semibold text-emerald-700">
                      ✓ No Intervention Required
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current state is within baseline limits. Continue your activity calmly while monitoring.
                    </p>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="w-full text-base font-bold shadow-md gap-2"
                    onClick={() => handleStartIntervention(planResult.recommendedIntervention.id)}
                  >
                    Start {planResult.recommendedIntervention.title}
                  </Button>
                )}

                {/* Expandable Alternatives */}
                <div className="pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAlternatives(!showAlternatives)}
                    className="text-xs text-muted-foreground font-medium flex items-center gap-1 hover:text-foreground"
                  >
                    {showAlternatives ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showAlternatives ? "Hide alternative candidates" : "Show all evaluated candidates"}
                  </button>

                  {showAlternatives && (
                    <div className="mt-3 space-y-2">
                      {planResult.allCandidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border text-xs bg-background/80"
                        >
                          <div>
                            <p className="font-semibold text-foreground">{candidate.title}</p>
                            <p className="text-muted-foreground text-[11px]">{candidate.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary">
                              {Math.round(candidate.score * 100)}%
                            </span>
                            {candidate.id !== InterventionId.NO_INTERVENTION && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2"
                                onClick={() => handleStartIntervention(candidate.id)}
                              >
                                Select
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Outcome Confirmation Card (if recently finished) */}
            {lastCompletedOutcome && (
              <Alert className="bg-emerald-500/10 border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-sm font-semibold text-emerald-700">
                  Adaptive Learning Cycle Recorded
                </AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground mt-1">
                  Previous distress was {lastCompletedOutcome.preSeverity}/10, reduced to {lastCompletedOutcome.postSeverity}/10 ({lastCompletedOutcome.delta > 0 ? `-${lastCompletedOutcome.delta}` : "0"} delta). The adaptation engine recorded this outcome for pattern{" "}
                  <span className="font-semibold text-foreground">{lastCompletedOutcome.patternType}</span>.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

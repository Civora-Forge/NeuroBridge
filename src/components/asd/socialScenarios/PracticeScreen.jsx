import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  MessageSquareText,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentMoment } from "@/support/modules/socialScenarioSimulator/scenarioEngineService";
import { SESSION_STATUS } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import ConversationTimeline from "./ConversationTimeline";
import QuickReplies from "./QuickReplies";
import FeedbackPanel from "./FeedbackPanel";
import { DIFFICULTY_TONE, toneFor } from "./tones";

function StepTracker({ momentCount, momentIndex, status, pendingUnexpected }) {
  const steps = [];
  for (let i = 0; i < momentCount; i += 1) {
    const state = i < momentIndex ? "done" : i === momentIndex && status !== SESSION_STATUS.COMPLETED ? "current" : "todo";
    steps.push({ index: i + 1, state });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, position) => (
        <div key={step.index} className="flex items-center gap-2">
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
              step.state === "done" && "bg-emerald-500 border-emerald-500 text-white",
              step.state === "current" && "bg-green-100 border-green-500 text-green-700 ring-2 ring-green-400/40",
              step.state === "todo" && "bg-white border-slate-200 text-slate-400",
            )}
          >
            {step.state === "done" ? <CheckCircle2 className="h-4 w-4" /> : step.index}
          </div>
          {pendingUnexpected && step.state === "current" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-9 h-9 rounded-full bg-violet-100 border-2 border-violet-300 text-violet-600 flex items-center justify-center"
                title="Unexpected turn"
              >
                <Zap className="h-4 w-4" />
              </motion.div>
              {position < steps.length - 1 && <div className="h-px w-4 bg-violet-300" />}
            </>
          )}
          {position < steps.length - 1 && <div className="h-px w-4 bg-slate-200" />}
        </div>
      ))}
    </div>
  );
}

export default function PracticeScreen({
  scenario,
  session,
  messages,
  quickReplies,
  isTyping,
  error,
  progress,
  savedSession,
  onResumeSaved,
  onStart,
  onSend,
  onChooseOption,
  onPause,
  onResume,
  onRestart,
  onFinishEarly,
  onExit,
  onBack,
  report,
  adaptation,
  largeText = false,
  reduceMotion = false,
}) {
  const [draft, setDraft] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  const tone = toneFor(scenario);
  const difficulty = DIFFICULTY_TONE[scenario?.difficulty] ?? DIFFICULTY_TONE.easy;

  const currentMoment = useMemo(
    () => (session ? getCurrentMoment(scenario, session) : null),
    [scenario, session],
  );

  const motionProps = reduceMotion
    ? { initial: false, animate: {}, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: "easeOut" } };

  if (report) {
    return <FeedbackPanel report={report} scenario={scenario} onRestart={onRestart} onBack={onBack} />;
  }

  if (!session && savedSession) {
    return (
      <Card className="border-2 border-amber-300 bg-amber-50/70">
        <CardHeader>
          <CardTitle className="text-amber-900">Resume “{savedSession.scenarioTitle}”?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-amber-700">
            You have an in-progress conversation. Continue where you left off or start over.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={onResumeSaved}>
              <Play className="h-4 w-4 mr-2" /> Resume conversation
            </Button>
            <Button variant="outline" onClick={onStart}>
              Start over
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <motion.div {...motionProps} className="space-y-5">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> All scenarios
          </Button>
        </div>
        <Card className={cn("overflow-hidden border-2", tone.border)}>
          <div className={cn("h-1.5 w-full bg-gradient-to-r", tone.gradient)} />
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-2xl border", tone.bg, tone.border)}>
                {["🎓", "💼", "🛒", "💬"][["college", "workplace", "daily_life", "relationships"].indexOf(scenario.category)] ?? "🗣️"}
              </span>
              <div>
                <CardTitle className="text-slate-900">{scenario.title}</CardTitle>
                <CardDescription>{scenario.description}</CardDescription>
              </div>
              <Badge className={cn("border-transparent ml-auto", difficulty.badge)}>{difficulty.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={cn("text-slate-600 leading-relaxed", largeText && "text-base")}>{scenario.context}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={cn("rounded-2xl border-2 p-4", tone.bg, tone.border)}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your partner</p>
                <p className={cn("font-bold mt-1", tone.text)}>{scenario.npc?.name}</p>
                <p className="text-sm text-slate-600">{scenario.npc?.role}</p>
              </div>
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Goals for this practice</p>
                <ul className="mt-1 space-y-1">
                  {scenario.objectives?.map((objective) => (
                    <li key={objective} className="flex gap-2 text-sm text-slate-600">
                      <span className={tone.text}>•</span>
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {error && <Alert variant="destructive">{error}</Alert>}
            <Button className={cn("w-full sm:w-auto text-white", tone.button)} size="lg" onClick={onStart}>
              <Play className="h-4 w-4 mr-2" /> Start conversation
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const isActive = session.status === SESSION_STATUS.ACTIVE;
  const isPaused = session.status === SESSION_STATUS.PAUSED;

  const currentPrompt = session.pendingUnexpected
    ? session.pendingUnexpected
    : currentMoment?.prompt ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> All scenarios
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{scenario.title}</span>
          <Badge className={cn("border-transparent", difficulty.badge)}>{difficulty.label}</Badge>
          {adaptation?.active && (
            <Badge className="border-transparent bg-violet-100 text-violet-700">
              <Sparkles className="h-3 w-3 mr-1" /> Adapted for you
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StepTracker
            momentCount={session.momentCount}
            momentIndex={session.momentIndex}
            status={session.status}
            pendingUnexpected={session.pendingUnexpected}
          />
          <span className="text-xs text-slate-400">{progress.percent}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress.percent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={session.pendingUnexpected ? "unexpected" : `step-${session.momentIndex}`}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "rounded-2xl border-2 p-5 space-y-2 shadow-sm",
            session.pendingUnexpected
              ? "border-violet-300 bg-violet-50/70"
              : isPaused
                ? "border-amber-300 bg-amber-50/70"
                : cn("bg-white", tone.border),
          )}
        >
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", session.pendingUnexpected ? "text-violet-600" : "text-slate-500")}>
              {session.pendingUnexpected ? "Unexpected turn" : isPaused ? "Paused — current step" : "Your partner says"}
            </p>
            {isPaused && <Badge className="border-transparent bg-amber-100 text-amber-700">Paused</Badge>}
          </div>
          <p className={cn("font-bold text-slate-900", largeText ? "text-2xl" : "text-xl")}>{currentPrompt}</p>
          {!session.pendingUnexpected && (
            <p className={cn("text-sm text-slate-500", largeText && "text-base")}>
              <span className={tone.text}>{(scenario.npc?.name ?? "").split(" ")[0]}</span> · {scenario.npc?.role}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {adaptation?.degraded && (
        <Alert className="border-slate-200 bg-slate-50">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          <AlertTitle className="text-slate-700 text-sm">Adaptive engine unavailable</AlertTitle>
          <AlertDescription className="text-slate-500 text-sm">
            Practicing with the default experience. Your progress is still saved.
          </AlertDescription>
        </Alert>
      )}

      {isActive && !session.pendingUnexpected && (
        <QuickReplies replies={quickReplies} onSelect={onChooseOption} disabled={isTyping} largeText={largeText} />
      )}

      {isActive && (
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (draft.trim() && !isTyping) {
                  onSend(draft.trim());
                  setDraft("");
                }
              }
            }}
            placeholder={session.pendingUnexpected ? "How do you respond to this surprise?" : "Type your own reply…"}
            rows={2}
            className="resize-none"
            aria-label="Your reply"
          />
          <Button
            className="h-auto bg-green-600 hover:bg-green-700 text-white"
            disabled={!draft.trim() || isTyping}
            onClick={() => {
              onSend(draft.trim());
              setDraft("");
            }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!isActive && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 text-center">
          <p className="text-sm font-semibold text-amber-800">Session paused</p>
          <Button className="mt-2 bg-amber-500 hover:bg-amber-600 text-white" onClick={onResume}>
            <Play className="h-4 w-4 mr-2" /> Resume
          </Button>
        </div>
      )}

      <Collapsible open={showTranscript} onOpenChange={setShowTranscript} className="rounded-2xl border border-green-100 bg-white shadow-sm">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:text-green-700">
          <span className="inline-flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" /> Conversation transcript ({messages.length})
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", showTranscript && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <ConversationTimeline messages={messages} isTyping={isTyping} largeText={largeText} />
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onFinishEarly} disabled={!isActive}>
          <Undo2 className="h-4 w-4 mr-2" /> Finish early
        </Button>
        <Button variant="outline" size="sm" onClick={onRestart}>
          <RotateCcw className="h-4 w-4 mr-2" /> Restart
        </Button>
        <Button variant="ghost" size="sm" className="text-slate-500" onClick={onExit}>
          <X className="h-4 w-4 mr-2" /> Exit without saving
        </Button>
      </div>
    </div>
  );
}

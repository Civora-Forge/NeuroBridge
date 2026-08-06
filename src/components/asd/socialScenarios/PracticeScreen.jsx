import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Pause, Play, RotateCcw, Send, ShieldCheck, Sparkles, Undo2, X } from "lucide-react";
import ConversationTimeline from "./ConversationTimeline";
import QuickReplies from "./QuickReplies";
import FeedbackPanel from "./FeedbackPanel";
import { SESSION_STATUS } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";

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

  if (report) {
    return <FeedbackPanel report={report} onRestart={onRestart} onBack={onBack} />;
  }

  if (!session && savedSession) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <CardHeader>
          <CardTitle className="text-amber-900">Resume “{savedSession.scenarioTitle}”?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-amber-700">
            You have an in-progress conversation. You can continue where you left off or start over.
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
      <div className="space-y-5">
        <Card className="border-green-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-slate-900">{scenario.title}</CardTitle>
              <Badge className="border-transparent bg-green-100 text-green-700">{scenario.difficulty}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">{scenario.context}</p>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Your partner</h4>
              <p className="text-sm text-slate-600">
                <span className="font-medium text-green-700">{scenario.npc?.name}</span> — {scenario.npc?.role}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Goals for this practice</h4>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {scenario.objectives?.map((objective) => (
                  <li key={objective} className="flex gap-2">
                    <span className="text-green-500">•</span>
                    {objective}
                  </li>
                ))}
              </ul>
            </div>
            {error && <Alert variant="destructive">{error}</Alert>}
            <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white" onClick={onStart}>
              <Play className="h-4 w-4 mr-2" /> Start conversation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayMessages = session.pendingUnexpected
    ? [
        ...messages,
        {
          id: "unexpected-pending",
          role: "npc",
          text: session.pendingUnexpected,
          kind: "chat",
        },
      ]
    : messages;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Scenarios
        </Button>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{scenario.title}</span>
          <Badge className="border-transparent bg-green-100 text-green-700">{session.difficulty}</Badge>
          {adaptation?.active && (
            <Badge className="border-transparent bg-violet-100 text-violet-700">
              <Sparkles className="h-3 w-3 mr-1" /> Adapted for you
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>
            Step {progress.current} of {progress.total}
          </span>
          <span>{progress.percent}%</span>
        </div>
        <Progress value={progress.percent} className="h-2 [&>div]:bg-green-500" />
      </div>

      <ConversationTimeline messages={displayMessages} isTyping={isTyping} largeText={largeText} />

      {adaptation?.degraded && (
        <Alert className="border-slate-200 bg-slate-50">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          <AlertTitle className="text-slate-700 text-sm">Adaptive engine unavailable</AlertTitle>
          <AlertDescription className="text-slate-500 text-sm">
            Practicing with the default experience. Your progress is still saved.
          </AlertDescription>
        </Alert>
      )}

      <QuickReplies
        replies={quickReplies}
        onSelect={onChooseOption}
        disabled={!session || isTyping}
        largeText={largeText}
      />

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
          placeholder="Type your reply…"
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

      <div className="flex flex-wrap gap-2">
        {session.status === SESSION_STATUS.PAUSED ? (
          <Button variant="outline" size="sm" onClick={onResume}>
            <Play className="h-4 w-4 mr-2" /> Resume
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onPause}>
            <Pause className="h-4 w-4 mr-2" /> Pause
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onFinishEarly}>
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

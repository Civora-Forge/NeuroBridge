import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Activity, Brain, Cloud, MessageSquare, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { contextEventBus, ContextEvents, isDebugEnabled } from "@/adaptive/context";
import { useContextStateOptional } from "@/context/ContextProvider";

const DEMO_MESSAGE = "This is too much text. I can't concentrate.";

function PipelineLog({ entries }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No pipeline events yet.</p>;
  }

  return (
    <div className="max-h-32 space-y-1 overflow-y-auto font-mono text-[10px]">
      {entries.map((entry, i) => (
        <div key={`${entry.stage}-${i}`} className="text-muted-foreground">
          <span className="text-primary">{entry.stage}</span>
          {entry.detail ? ` — ${entry.detail}` : ""}
        </div>
      ))}
    </div>
  );
}

function ContextSection({ title, icon: Icon, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * Developer/demo overlay for hackathon judges — shows live Unified Context pipeline state.
 * Visible when VITE_CONTEXT_DEBUG=true, DEV mode, or ?contextDebug=1 in URL.
 */
export default function ContextInspector() {
  const ctx = useContextStateOptional();
  const [searchParams] = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [pipelineLog, setPipelineLog] = useState([]);
  const [demoRunning, setDemoRunning] = useState(false);

  const debugEnabled =
    isDebugEnabled() || searchParams.get("contextDebug") === "1";

  useEffect(() => {
    if (!debugEnabled) return;

    setVisible(true);

    const appendLog = (stage, detail) => {
      setPipelineLog((prev) => [...prev.slice(-19), { stage, detail, at: Date.now() }]);
    };

    const unsubs = [
      contextEventBus.subscribe(ContextEvents.SIGNAL_RECEIVED, (signal) => {
        appendLog("SignalReceived", `${signal.source} (${signal.type})`);
      }),
      contextEventBus.subscribe(ContextEvents.CONVERSATION_UPDATED, (payload) => {
        appendLog("AnalyzerResult", `${payload.analysis?.intent} / ${payload.analysis?.sentiment}`);
      }),
      contextEventBus.subscribe(ContextEvents.MOOD_UPDATED, (payload) => {
        appendLog("MoodUpdate", `${payload.mood?.value || payload.mood?.primaryMood} (${payload.mood?.confidence})`);
      }),
      contextEventBus.subscribe(ContextEvents.CONTEXT_UPDATED, (payload) => {
        appendLog(
          "ContextUpdated",
          payload.materialChanges?.join(", ") || payload.category
        );
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [debugEnabled]);

  if (!debugEnabled || !visible) return null;

  const context = ctx?.context;
  const mood = context?.mood;
  const activity = context?.activity;
  const environment = context?.environment;
  const conversation = context?.conversation;
  const metadata = context?.metadata;

  const runDemo = async () => {
    if (!ctx?.processUserMessage) return;
    setDemoRunning(true);
    try {
      await ctx.processUserMessage(DEMO_MESSAGE, { useAI: false });
    } finally {
      setDemoRunning(false);
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[9999] w-[min(420px,calc(100vw-2rem))]",
        "rounded-lg border bg-background/95 shadow-xl backdrop-blur"
      )}
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold">Context Inspector (Demo)</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => ctx?.refreshContext?.()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVisible(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-4 text-sm">
          <ContextSection title="Current Activity" icon={Activity}>
            <Badge variant="secondary">{activity?.activity || "—"}</Badge>
            <span className="ml-2 text-muted-foreground">({activity?.currentModule})</span>
          </ContextSection>

          <ContextSection title="Current Mood" icon={Brain}>
            <Badge>{mood?.primaryMood || "unknown"}</Badge>
            <span className="ml-2 text-muted-foreground">
              confidence: {mood?.confidence ?? "—"}
            </span>
            {mood?.sources?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {mood.sources.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </ContextSection>

          <ContextSection title="Environment" icon={Cloud}>
            {environment?.timeOfDay} · {environment?.dayOfWeek} ·{" "}
            {environment?.isOnline ? "online" : "offline"} · {environment?.device?.deviceType}
          </ContextSection>

          <ContextSection title="Conversation" icon={MessageSquare}>
            {conversation?.detectedIntent || "—"} / urgency: {conversation?.urgency || "—"}
            {conversation?.lastUserMessage && (
              <p className="mt-1 text-xs text-muted-foreground">
                [{conversation.lastUserMessage.length} chars analyzed]
              </p>
            )}
          </ContextSection>

          <Separator />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Freshness</span>
              <p>{metadata?.freshnessIndex ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Overall confidence</span>
              <p>{metadata?.overallConfidence ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Last update</span>
              <p>
                {ctx?.lastUpdated
                  ? formatDistanceToNow(new Date(ctx.lastUpdated), { addSuffix: true })
                  : "—"}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Pipeline log</p>
            <PipelineLog entries={pipelineLog} />
          </div>

          <Button
            size="sm"
            className="w-full"
            disabled={demoRunning || !ctx?.processUserMessage}
            onClick={runDemo}
          >
            {demoRunning ? "Running demo…" : "Run demo message"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Brain, ListChecks, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TrackerPanel from "./TrackerPanel";
import GroundingPanel from "./GroundingPanel";
import AnalyzerPanel from "./AnalyzerPanel";
import PanicModePanel from "./PanicModePanel";
import ReframePanel from "./ReframePanel";
import {
  LOG_STORAGE_KEY,
  REFRAME_STORAGE_KEY,
  analyzeLogs,
  clampLevel,
  formatDateTimeInput,
  generateReframe,
} from "./anxietyUtils";
import { loadWardNotes, pushWardActivity, pushWardAlert, pushWardNote } from "@/lib/careSyncStore";
import { MOCK_WARD_ACTIVITY } from "@/context/AuthContext";
import { DISORDERS } from "@/lib/disorders";

function normalizeReframe(result, originalThought) {
  const noKeywordMatch = result?.matched === false;

  const distortionTag =
    result?.pattern ||
    result?.distortionTag ||
    (noKeywordMatch ? "Needs guardian review" : "General anxiety narrative");
  const counterStatement =
    result?.balancedThought ||
    result?.counterStatement ||
    (noKeywordMatch
      ? "I couldn't confidently match this thought to a coping pattern yet."
      : "I can pause, check facts, and respond with a calmer thought.");
  const actionStep =
    result?.reinforcement ||
    result?.actionStep ||
    (noKeywordMatch
      ? "This has been shared to your guardian for a personalized reframe."
      : "Take 3 slow breaths, then write one helpful next step.");
  const evidencePrompt =
    result?.evidencePrompt ||
    (noKeywordMatch
      ? "What context should your guardian know to help you best?"
      : "What facts support this thought, and what facts support a more balanced view?");

  const usedFallback = noKeywordMatch || !result?.pattern || !result?.balancedThought || !result?.reinforcement;

  return {
    originalThought,
    distortionTag,
    counterStatement,
    actionStep,
    evidencePrompt,
    usedFallback,
    keywordMatched: result?.matched !== false,
    matchLabel: result?.matchLabel || null,
  };
}

export default function AnxietyModule() {
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id || "anon";

  const logStorageKey = `${LOG_STORAGE_KEY}_${userId}`;
  const reframeStorageKey = `${REFRAME_STORAGE_KEY}_${userId}`;

  const [logs, setLogs] = useState(() => {
    try {
      const raw = localStorage.getItem(logStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [reframes, setReframes] = useState(() => {
    try {
      const raw = localStorage.getItem(reframeStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [level, setLevel] = useState(4);
  const [trigger, setTrigger] = useState("");
  const [location, setLocation] = useState("");
  const [loggedAt, setLoggedAt] = useState(formatDateTimeInput(new Date()));
  const [thoughtInput, setThoughtInput] = useState("");
  const [autoBreathingToken, setAutoBreathingToken] = useState(0);
  const [guardianNotes, setGuardianNotes] = useState([]);

  useEffect(() => {
    localStorage.setItem(logStorageKey, JSON.stringify(logs));
  }, [logStorageKey, logs]);

  useEffect(() => {
    localStorage.setItem(reframeStorageKey, JSON.stringify(reframes));
  }, [reframeStorageKey, reframes]);

  useEffect(() => {
    try {
      const nextLogs = JSON.parse(localStorage.getItem(logStorageKey) || "[]");
      setLogs(Array.isArray(nextLogs) ? nextLogs : []);
    } catch {
      setLogs([]);
    }

    try {
      const nextReframes = JSON.parse(localStorage.getItem(reframeStorageKey) || "[]");
      const migrated = Array.isArray(nextReframes)
        ? nextReframes.map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }

            const normalized = normalizeReframe(
              {
                pattern: entry.pattern || entry.distortionTag,
                balancedThought: entry.balancedThought || entry.counterStatement,
                reinforcement: entry.reinforcement || entry.actionStep,
                evidencePrompt: entry.evidencePrompt,
              },
              entry.originalThought || "",
            );

            return {
              ...entry,
              distortionTag: normalized.distortionTag,
              counterStatement: normalized.counterStatement,
              actionStep: normalized.actionStep,
              evidencePrompt: normalized.evidencePrompt,
            };
          }).filter(Boolean)
        : [];
      setReframes(migrated);
    } catch {
      setReframes([]);
    }
  }, [logStorageKey, reframeStorageKey]);

  useEffect(() => {
    if (!userId || userId === "anon") {
      return;
    }

    const refreshNotes = () => {
      setGuardianNotes(
        loadWardNotes(userId, MOCK_WARD_ACTIVITY[userId]?.journalNotes || []).filter(
          (note) => note.from === "guardian",
        ),
      );
    };

    refreshNotes();
    const timer = setInterval(refreshNotes, 2000);
    window.addEventListener("storage", refreshNotes);

    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", refreshNotes);
    };
  }, [userId]);

  const analytics = useMemo(() => analyzeLogs(logs), [logs]);
  const wardHasAnxietyEnabled = useMemo(() => {
    const disorders = Array.isArray(user?.disorders) ? user.disorders : [];
    return disorders.includes(DISORDERS.ANXIETY) || disorders.includes("anxiety");
  }, [user?.disorders]);

  const addLog = () => {
    if (!trigger.trim()) {
      toast({ title: "Trigger required", description: "Please provide trigger text before logging.", variant: "destructive" });
      return;
    }

    const entry = {
      id: crypto.randomUUID(),
      level: clampLevel(level),
      trigger: trigger.trim(),
      location: location.trim() || "Unknown",
      loggedAt: loggedAt ? new Date(loggedAt).toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setLogs((prev) => [entry, ...prev]);
    pushWardActivity(userId, {
      event: `Anxiety log added (${entry.level}/10): ${entry.trigger}`,
      type: entry.level >= 7 ? "alert" : "neutral",
    });
    if (entry.level >= 8) {
      pushWardAlert(userId, {
        level: "high",
        message: `High anxiety logged (${entry.level}/10): ${entry.trigger}`,
      });
    }
    setTrigger("");
    setLocation("");
    setLoggedAt(formatDateTimeInput(new Date()));
    toast({ title: "Log recorded", description: "Anxiety entry saved locally." });
  };

  const createReframe = () => {
    if (!thoughtInput.trim()) {
      toast({ title: "Thought required", description: "Enter a thought before generating reframe.", variant: "destructive" });
      return;
    }

    const cleanedThought = thoughtInput.trim();
    const result = generateReframe(cleanedThought);
    const normalized = normalizeReframe(result, cleanedThought);

    const entry = {
      id: crypto.randomUUID(),
      originalThought: normalized.originalThought,
      distortionTag: normalized.distortionTag,
      counterStatement: normalized.counterStatement,
      actionStep: normalized.actionStep,
      evidencePrompt: normalized.evidencePrompt,
      matchLabel: normalized.matchLabel,
      createdAt: new Date().toISOString(),
    };

    setReframes((prev) => [entry, ...prev]);
    pushWardActivity(userId, {
      event: "CBT reframe completed in Anxiety module.",
      type: "positive",
    });

    if (!normalized.keywordMatched && wardHasAnxietyEnabled) {
      pushWardNote(userId, {
        from: "ward",
        text: `I need guardian help reframing this anxiety thought: "${cleanedThought}"`,
      });
      pushWardAlert(userId, {
        level: "low",
        message: "Ward requested guardian support: no keyword match for anxiety reframe.",
        source: "anxiety-reframe",
        kind: "guardian-support",
      });
    }

    setThoughtInput("");
    toast({
      title: normalized.keywordMatched ? "Reframe generated" : "Shared with guardian",
      description: normalized.keywordMatched
        ? "Keyword-matched coping response stored locally."
        : wardHasAnxietyEnabled
        ? "No keyword match found. Thought shared for guardian-written reframe."
        : "No keyword match found. Add anxiety in conditions to enable guardian fallback.",
    });
  };

  const activatePanicFlow = () => {
    setAutoBreathingToken((value) => value + 1);
    pushWardActivity(userId, {
      event: "Panic mode activated.",
      type: "alert",
    });
    pushWardAlert(userId, {
      level: "medium",
      message: "Panic mode was triggered in Anxiety toolkit.",
    });
    toast({ title: "Panic mode enabled", description: "Grounding tab primed with breathing guidance." });
  };

  return (
    <div className="space-y-6">
      {guardianNotes.length > 0 && (
        <Alert>
          <BookOpen className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Shared Journal from Guardian</p>
              {guardianNotes.slice(0, 3).map((note) => (
                <p key={note.id} className="text-sm">• {note.text} <span className="text-muted-foreground">({note.ts})</span></p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="tracker" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="tracker" className="border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Brain size={14} className="mr-1" /> Tracker</TabsTrigger>
          <TabsTrigger value="grounding" className="border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ListChecks size={14} className="mr-1" /> Grounding</TabsTrigger>
          <TabsTrigger value="panic" className="border data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"><AlertTriangle size={14} className="mr-1" /> Panic Mode</TabsTrigger>
          <TabsTrigger value="analyzer" className="border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ShieldCheck size={14} className="mr-1" /> Analyzer</TabsTrigger>
          <TabsTrigger value="reframe" className="border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">CBT Reframe</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker">
          <TrackerPanel
            level={level}
            setLevel={setLevel}
            trigger={trigger}
            setTrigger={setTrigger}
            location={location}
            setLocation={setLocation}
            loggedAt={loggedAt}
            setLoggedAt={setLoggedAt}
            logs={logs}
            onAddLog={addLog}
          />
        </TabsContent>

        <TabsContent value="grounding">
          <GroundingPanel autoBreathingToken={autoBreathingToken} />
        </TabsContent>

        <TabsContent value="panic">
          <PanicModePanel onActivate={activatePanicFlow} />
        </TabsContent>

        <TabsContent value="analyzer">
          <AnalyzerPanel analytics={analytics} targetId={userId} />
        </TabsContent>

        <TabsContent value="reframe">
          <ReframePanel
            thoughtInput={thoughtInput}
            setThoughtInput={setThoughtInput}
            reframes={reframes}
            onGenerate={createReframe}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

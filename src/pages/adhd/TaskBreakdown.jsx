"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BarChart3,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  ClipboardCheck,
  Clock3,
  Cloud,
  GripVertical,
  Heart,
  Info,
  Lightbulb,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  WandSparkles,
  Zap,
} from "lucide-react";

import { useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";

import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

import { useInterventionLifecycle } from "@/support/execution";

import {
  getInterventionHistory as getLocalInterventionHistory,
} from "@/support/lifecycle/interventionLifecycle";

import {
  getRole4InterventionHistory,
} from "@/support/persistence/role4Repository";

import {
  buildTaskBreakdownOutcome,
  calculateTaskBreakdownEvidence,
  generateTaskBreakdown,
  getTaskBreakdownProgress,
} from "@/support/modules/taskBreakdown/taskBreakdownService";

import {
  TASK_BREAKDOWN_MODULE_ID,
  TASK_BREAKDOWN_PRIORITIES,
  TASK_BREAKDOWN_STYLES,
} from "@/support/modules/taskBreakdown/taskBreakdownTypes";

const placeholders = [
  "Study for tomorrow",
  "Reply to emails",
  "Finish my presentation",
  "Clean my room",
  "Start that project",
];

function formatDate(timestamp) {
  if (!timestamp) return "Recent";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function TrendRow({ bucket, color }) {
  const percent = Math.round(
    (bucket.fullCompletionRate ?? 0) * 100
  );

  return (
    <div className="grid grid-cols-[68px_minmax(100px,1fr)_auto] items-center gap-3">
      <span className="text-[11px] font-extrabold text-[#5e6276]">
        {bucket.label}
      </span>

      <div
        className="h-[10px] overflow-hidden rounded-full bg-[#eceef3]"
        aria-label={`${bucket.label}: ${percent}% completed`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <span className="whitespace-nowrap text-[10px] font-bold text-[#717588]">
        {bucket.completed}/{bucket.sessions} finished
      </span>
    </div>
  );
}

function HistoryList({ sessions }) {
  if (!sessions.length) {
    return (
      <div className="mt-3 rounded-[14px] border border-[#eeeaf6] bg-[#faf9fd] px-3 py-3">
        <p className="text-[10px] font-medium leading-4 text-[#858a99]">
          Nothing here yet — your finished plans will start showing up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {sessions.slice(0, 8).map((session) => (
        <div
          key={session.id}
          className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-xl border border-[#eee9fa] bg-gradient-to-r from-[#faf8ff] to-[#f8fbf6] px-3 py-2 text-[9.5px] text-[#64617b]"
        >
          <span>{formatDate(session.timestamp)}</span>

          <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[#5f6074]">
            {session.stepCount} steps
          </span>

          <span className="truncate">{session.style}</span>

          <span className="font-black capitalize">
            {session.status.replace("_", " ")}{" "}
            {Math.round(session.completionRatio * 100)}%
          </span>

          {session.rating && (
            <span className="font-black text-[#7556db]">
              {session.rating}/5
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function AdaptivePanel({
  evidence,
  historyLoading,
  historyError,
  historyOpen,
  setHistoryOpen,
  onUseRecommendation,
  onChooseOwn,
  isDev,
  onSeed,
  seedStatus,
}) {
  const recommendation = evidence.recommendation;

  const smaller =
    recommendation?.direction === "smaller";

  const larger =
    recommendation?.direction === "larger";

  const insightTitle = recommendation
    ? smaller
      ? "Smaller plans have been easier to finish"
      : larger
        ? "A little more structure seems to help"
        : recommendation.title
    : "Still figuring out your sweet spot";

  const insightDescription = recommendation
    ? recommendation.description
    : "Use Task Breakdown a few more times and I’ll start noticing which plan size feels easiest to actually finish.";

  return (
    <aside className="space-y-[14px] lg:sticky lg:top-4">
      <section className="relative overflow-hidden rounded-[25px] border border-[#ece7f7] bg-white p-[18px] shadow-[0_10px_28px_rgba(80,63,128,0.055)]">
        <div className="pointer-events-none absolute -right-7 -top-7 h-[88px] w-[88px] rounded-full bg-[#f7f3ff]" />

        <div className="pointer-events-none absolute right-[56px] top-[70px]">
          <Sparkles
            size={15}
            className="text-[#d8c3ff]"
          />
        </div>

        <div className="pointer-events-none absolute right-5 top-[95px]">
          <Star
            size={12}
            className="text-[#e4c244]"
          />
        </div>

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[#f1ebff] text-[#7757df] shadow-[0_3px_8px_rgba(118,83,223,.08)]">
              <Brain size={20} strokeWidth={2.3} />

              <span className="absolute -right-1 -top-1 grid h-3 w-3 place-items-center rounded-full bg-[#fff7c7]">
                <Sparkles
                  size={8}
                  className="text-[#d5ad28]"
                />
              </span>
            </span>

            <div className="min-w-0">
              <h2 className="whitespace-nowrap text-[17px] font-black tracking-[-0.03em] text-[#20243f]">
                Something I noticed...
              </h2>

              <p className="mt-[2px] text-[10.8px] font-medium text-[#7b8295]">
                Based on your own past task breakdowns
              </p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e2efd9] bg-[#eff8e9] px-3 py-1.5 text-[9.5px] font-black text-[#538b50]">
            Live
            <ChevronDown size={10} />
          </span>
        </div>

        {recommendation ? (
          <button
            type="button"
            onClick={onUseRecommendation}
            className={`relative mt-4 flex w-full items-center gap-3 overflow-hidden rounded-[19px] border bg-white px-4 py-4 text-left transition hover:-translate-y-[1px] hover:shadow-[0_8px_18px_rgba(87,145,78,0.08)] ${
              smaller
                ? "border-[#dfeeda]"
                : "border-[#e9e2f8]"
            }`}
          >
            <div className="pointer-events-none absolute -bottom-8 -right-6 h-20 w-20 rounded-full bg-white/70" />

            <div className="pointer-events-none absolute right-11 top-3">
              <Sparkles
                size={11}
                className={
                  smaller
                    ? "text-[#b8d9ad]"
                    : "text-[#d5c3f5]"
                }
              />
            </div>

            <span
              className={`relative grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full ${
                smaller
                  ? "bg-[#e3f1dc] text-[#5f9c58]"
                  : "bg-[#ebe3ff] text-[#7454d9]"
              }`}
            >
              <SlidersHorizontal
                size={18}
                strokeWidth={2.2}
              />
            </span>

            <span className="relative min-w-0 flex-1">
              <span
                className={`block text-[12.5px] font-black leading-4 ${
                  smaller
                    ? "text-[#31583a]"
                    : "text-[#51458a]"
                }`}
              >
                {insightTitle}
              </span>

              <span className="mt-1 block text-[10.5px] font-medium leading-[1.55] text-[#6f7b73]">
                {insightDescription}
              </span>
            </span>

            <ChevronRight
              size={15}
              className={
                smaller
                  ? "relative shrink-0 text-[#6ba265]"
                  : "relative shrink-0 text-[#7757df]"
              }
            />
          </button>
        ) : (
          <div className="relative mt-4 overflow-hidden rounded-[19px] border border-[#e9e4f5] bg-gradient-to-r from-[#f7f3ff] via-[#faf8ff] to-[#f5f9f1] px-4 py-4">
            <div className="pointer-events-none absolute -right-7 -bottom-8 h-[76px] w-[76px] rounded-full bg-white/60" />

            <div className="relative flex gap-3">
              <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full bg-white text-[#7556db] shadow-sm">
                <WandSparkles size={18} />
              </span>

              <div>
                <p className="text-[12.5px] font-black text-[#34304e]">
                  Still figuring out your sweet spot
                </p>

                <p className="mt-1 text-[10.5px] font-medium leading-[1.55] text-[#777d8d]">
                  Use Task Breakdown a few more times and I’ll start noticing
                  which plan size feels easiest to actually finish.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 rounded-[17px] border border-[#f0eff5] bg-gradient-to-br from-[#fcfcfe] to-[#fafbfd] px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#edf6e9] text-[#65965f]">
                <BarChart3 size={13} />
              </span>

              <h3 className="text-[11px] font-black text-[#2e324a]">
                What&apos;s been working
              </h3>
            </div>

            <Star
              size={13}
              className="text-[#e0bd3d]"
            />
          </div>

          {evidence.hasComparableEvidence ? (
            <div className="mt-3 space-y-3">
              <TrendRow
                bucket={evidence.smaller}
                color="bg-gradient-to-r from-[#70ae66] to-[#86be77]"
              />

              <TrendRow
                bucket={evidence.detailed}
                color="bg-gradient-to-r from-[#7655e7] to-[#9a7bed]"
              />
            </div>
          ) : (
            <p className="mt-2 text-[10px] font-medium leading-4 text-[#898e9d]">
              Once there are enough finished plans to compare, your trend will
              show up here.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-[#ececf2] pt-3">
          <button
            type="button"
            onClick={() =>
              setHistoryOpen((open) => !open)
            }
            className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left text-[11px] font-black text-[#7355df] transition hover:bg-[#faf8ff]"
          >
            <BarChart3 size={15} />

            <span className="flex-1">
              See what I&apos;m learning from
            </span>

            <ChevronRight
              size={13}
              className={`transition-transform ${
                historyOpen ? "rotate-90" : ""
              }`}
            />
          </button>

          {historyOpen && (
            <HistoryList sessions={evidence.sessions} />
          )}

          {historyLoading && (
            <p className="mt-2 text-[9px] text-[#7d7a91]">
              Checking your history...
            </p>
          )}

          {historyError && (
            <p
              role="status"
              className="mt-2 rounded-lg border border-[#f3e2b7] bg-[#fff9eb] px-2 py-1.5 text-[9px] text-amber-800"
            >
              Cloud history couldn&apos;t refresh, so I&apos;m using the saved
              history on this device.
            </p>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={onChooseOwn}
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-[18px] border border-[#ebe4fb] bg-white px-4 py-3.5 text-left transition hover:-translate-y-[1px]"
      >
        <div className="pointer-events-none absolute -right-5 -bottom-6 h-16 w-16 rounded-full bg-white/60" />

        <span className="relative grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-white text-[#7655df] shadow-sm transition group-hover:rotate-6">
          <Lightbulb size={17} />
        </span>

        <span className="relative">
          <span className="block text-[11px] font-black text-[#34304e]">
            Your call ✨
          </span>

          <span className="block text-[9.5px] text-[#7a7892]">
            You can always pick a different setup.
          </span>
        </span>
      </button>

      <section className="relative overflow-hidden rounded-[21px] border border-[#eeeaf4] bg-gradient-to-br from-white to-[#fdfcff] px-4 py-4 shadow-[0_8px_20px_rgba(69,57,103,0.04)]">
        <div className="pointer-events-none absolute -bottom-8 -right-7 h-20 w-20 rounded-full bg-[#f5f1ff]" />

        <div className="pointer-events-none absolute right-8 top-2">
          <Sparkles
            size={12}
            className="text-[#d5c3f4]"
          />
        </div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#fff5cf] text-[#d3a82b]">
              <Lightbulb size={13} />
            </span>

            <h3 className="text-[14px] font-black text-[#252a42]">
              Why I&apos;m suggesting this
            </h3>
          </div>

          <Info
            size={14}
            className="text-[#969bad]"
          />
        </div>

        <p className="relative mt-3 text-[10.5px] font-medium leading-[1.6] text-[#747b8e]">
          {recommendation?.explanation ??
            "I’m still learning which plan size works best for you. Once there’s enough history, this will reflect your own completion patterns."}
        </p>

        {isDev && (
          <div className="relative mt-3 border-t border-dashed border-[#e2ddef] pt-2">
            <button
              type="button"
              onClick={onSeed}
              className="text-[8px] text-[#b0a6c7] hover:text-[#7455d5]"
            >
              Load development demo history
            </button>

            {seedStatus && (
              <p className="mt-1 text-[8px] text-[#aaa1c2]">
                {seedStatus}
              </p>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}

const TaskBreakdown = ({
  planId = null,
  contextSnapshotId = null,
  triggerSource = "manual",
  selectionMode = "explicit_request",
}) => {
  const location = useLocation();
  const { user } = useAuth();

  const aiData = location.state || null;

  const [bigTask, setBigTask] = useState(
    aiData?.original_task || ""
  );

  const [selectedStyle, setSelectedStyle] =
    useState("Standard");

  const [selectedPriority, setSelectedPriority] =
    useState("Important");

  const [userConfigured, setUserConfigured] =
    useState(false);

  const [planningOpen, setPlanningOpen] =
    useState(false);

  const [steps, setSteps] = useState(
    aiData?.steps || []
  );

  const [completedSteps, setCompletedSteps] =
    useState(new Set());

  const [editingId, setEditingId] =
    useState(null);

  const [timerActive, setTimerActive] =
    useState(false);

  const [timerSecLeft, setTimerSecLeft] =
    useState(0);

  const [timerUsed, setTimerUsed] =
    useState(false);

  const [stepEdits, setStepEdits] =
    useState(0);

  const [stepReorders, setStepReorders] =
    useState(0);

  const [
    actualGeneratedConfiguration,
    setActualGeneratedConfiguration,
  ] = useState(null);

  const [
    sessionStartedAt,
    setSessionStartedAt,
  ] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] =
    useState(false);
  const [historyError, setHistoryError] =
    useState(false);

  const [historyOpen, setHistoryOpen] =
    useState(false);

  const [seedStatus, setSeedStatus] =
    useState(null);

  const [
    placeholderIndex,
    setPlaceholderIndex,
  ] = useState(0);

  const sessionKeyRef = useRef(null);
  const completionSentRef = useRef(false);

  const refreshHistory = useCallback(async () => {
    if (!user?.id) {
      setHistory([]);
      return;
    }

    const localHistory =
      getLocalInterventionHistory(user.id, {
        moduleId: TASK_BREAKDOWN_MODULE_ID,
      });

    setHistory(localHistory);
    setHistoryLoading(true);
    setHistoryError(false);

    try {
      const persistedHistory =
        await getRole4InterventionHistory(
          user.id,
          {
            moduleId: TASK_BREAKDOWN_MODULE_ID,
          }
        );

      setHistory(persistedHistory);
    } catch {
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(
        (index) =>
          (index + 1) % placeholders.length
      );
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!timerActive || timerSecLeft <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setTimerSecLeft(
        (seconds) => seconds - 1
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [timerActive, timerSecLeft]);

  const evidence = useMemo(
    () =>
      calculateTaskBreakdownEvidence(history),
    [history]
  );

  const defaultStyle =
    !userConfigured &&
    evidence.recommendation?.recommendedStyle
      ? evidence.recommendation.recommendedStyle
      : selectedStyle;

  const lifecycle =
    useInterventionLifecycle({
      userId: user?.id ?? null,
      moduleId: TASK_BREAKDOWN_MODULE_ID,
      planId,
      contextSnapshotId,
      triggerSource,
      selectionMode,
      configuration:
        actualGeneratedConfiguration ?? {
          actualGeneratedStyle: defaultStyle,
          priority: selectedPriority,
          actualGeneratedStepCount: 0,
          timerUsed: false,
        },
    });

  const progressDetails =
    getTaskBreakdownProgress(
      steps,
      completedSteps
    );

  const progress = Math.round(
    progressDetails.completionRate * 100
  );

  const durationMs = () =>
    sessionStartedAt
      ? Date.now() - sessionStartedAt
      : 0;

  const outcome = (
    completedIds = completedSteps
  ) =>
    buildTaskBreakdownOutcome({
      steps,
      completedStepIds: completedIds,
      actualGeneratedConfiguration,
      timerUsed,
      stepEdits,
      stepReorders,
      durationMs: durationMs(),
    });

  const startBreakdown = async () => {
    if (lifecycle.hasStarted) {
      return {
        ok: true,
        interventionId:
          lifecycle.interventionId,
      };
    }

    if (!user?.id) {
      return {
        ok: false,
      };
    }

    const result =
      await lifecycle.start({
        idempotencyKey:
          sessionKeyRef.current,
      });

    if (result.ok) {
      setSessionStartedAt(Date.now());
    }

    return result;
  };

  const discardActiveBreakdown =
    async () => {
      if (
        !lifecycle.hasStarted ||
        lifecycle.isTerminal ||
        progressDetails.completionRate === 1
      ) {
        return true;
      }

      const result =
        await lifecycle.abandon(
          "user_reset",
          {
            completedUnits:
              progressDetails.completedUnits,
            totalUnits:
              progressDetails.totalUnits,
            progressRatio:
              progressDetails.completionRate,
            elapsedMs: durationMs(),
            configuration:
              actualGeneratedConfiguration,
          },
          outcome()
        );

      if (result.ok) {
        await refreshHistory();
      }

      return result.ok;
    };

  const resetBreakdown = async () => {
    if (
      !(await discardActiveBreakdown())
    ) {
      return;
    }

    setSteps([]);
    setCompletedSteps(new Set());
    setEditingId(null);
    setTimerActive(false);
    setTimerSecLeft(0);
    setTimerUsed(false);
    setStepEdits(0);
    setStepReorders(0);

    setActualGeneratedConfiguration(null);

    setSessionStartedAt(null);

    completionSentRef.current = false;
    sessionKeyRef.current = null;

    lifecycle.reset();
  };

  const generateBreakdown = async () => {
    if (!bigTask.trim()) return;

    if (
      !(await discardActiveBreakdown())
    ) {
      return;
    }

    const generated =
      generateTaskBreakdown(bigTask, {
        selectedStyle: defaultStyle,
        priority: selectedPriority,
      });

    const configuration = {
      actualGeneratedStyle: defaultStyle,
      priority: selectedPriority,
      actualGeneratedStepCount:
        generated.length,
      timerUsed: false,
    };

    setSteps(generated);
    setCompletedSteps(new Set());

    setActualGeneratedConfiguration(
      configuration
    );

    setTimerUsed(false);
    setStepEdits(0);
    setStepReorders(0);
    setSessionStartedAt(null);

    completionSentRef.current = false;

    sessionKeyRef.current =
      `task-breakdown-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    lifecycle.reset();
  };

  const toggleStep = async (id) => {
    const updated = new Set(
      completedSteps
    );

    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }

    setCompletedSteps(updated);

    if (!user?.id) return;

    const started =
      await startBreakdown();

    if (
      !started.ok ||
      lifecycle.isTerminal
    ) {
      return;
    }

    const nextProgress =
      getTaskBreakdownProgress(
        steps,
        updated
      );

    await lifecycle.progress({
      progressType: "task_step_update",
      completedUnits:
        nextProgress.completedUnits,
      totalUnits:
        nextProgress.totalUnits,
      progressRatio:
        nextProgress.completionRate,
      elapsedMs: durationMs(),
      configuration:
        actualGeneratedConfiguration,
      details: {
        stepId: id,
        completed: updated.has(id),
      },
    });

    if (
      nextProgress.completionRate === 1 &&
      !completionSentRef.current
    ) {
      completionSentRef.current = true;

      const result =
        await lifecycle.complete(
          outcome(updated)
        );

      if (result.ok) {
        await refreshHistory();
      }
    }
  };

  const startTimer = async () => {
    const next = steps.find(
      (step) =>
        !completedSteps.has(step.id)
    );

    if (!next) return;

    if (
      user?.id &&
      !(await startBreakdown()).ok
    ) {
      return;
    }

    setTimerActive(true);
    setTimerUsed(true);

    setTimerSecLeft(
      (next.time || 5) * 60
    );
  };

  const markAllComplete = async () => {
    const updated = new Set(
      steps.map((step) => step.id)
    );

    setCompletedSteps(updated);

    if (
      !user?.id ||
      lifecycle.isTerminal ||
      completionSentRef.current
    ) {
      return;
    }

    const started =
      await startBreakdown();

    if (!started.ok) return;

    completionSentRef.current = true;

    const result =
      await lifecycle.complete(
        outcome(updated)
      );

    if (result.ok) {
      await refreshHistory();
    }
  };

  const addStep = () => {
    setSteps((current) => [
      ...current,
      {
        id: `step-${Date.now()}`,
        text: "Add one small next action.",
        time: 5,
      },
    ]);

    setStepEdits(
      (count) => count + 1
    );
  };

  const moveStep = (
    id,
    direction
  ) => {
    const index = steps.findIndex(
      (step) => step.id === id
    );

    const target =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      index < 0 ||
      target < 0 ||
      target >= steps.length
    ) {
      return;
    }

    const next = [...steps];

    [next[index], next[target]] = [
      next[target],
      next[index],
    ];

    setSteps(next);

    setStepReorders(
      (count) => count + 1
    );
  };

  const seedDemoHistory = async () => {
    if (
      !user?.id ||
      !import.meta.env.DEV
    ) {
      return;
    }

    setSeedStatus(
      "Saving demo outcomes..."
    );

    try {
      const {
        abandonSupportModule,
        completeSupportModule,
        executeSupportModule,
      } = await import(
        "@/support/execution"
      );

      const demoSessions = [
        {
          style: "Bare Minimum",
          completed: 4,
        },
        {
          style: "Bare Minimum",
          completed: 4,
        },
        {
          style: "Hero Mode",
          completed: 1,
        },
        {
          style: "Hero Mode",
          completed: 2,
        },
      ];

      for (
        const [
          index,
          demo,
        ] of demoSessions.entries()
      ) {
        const generated =
          generateTaskBreakdown(
            "Demo task",
            {
              selectedStyle:
                demo.style,
              priority: "Important",
            }
          );

        const configuration = {
          actualGeneratedStyle:
            demo.style,
          priority: "Important",
          actualGeneratedStepCount:
            generated.length,
          timerUsed: false,
        };

        const started =
          await executeSupportModule({
            userId: user.id,
            moduleId:
              TASK_BREAKDOWN_MODULE_ID,
            contextSnapshotId: null,
            triggerSource: "manual",
            selectionMode:
              "explicit_request",
            configuration,
            metadata: {
              idempotencyKey:
                `task-breakdown-demo-${Date.now()}-${index}`,
            },
          });

        if (!started.ok) {
          continue;
        }

        const completedStepIds =
          new Set(
            generated
              .slice(
                0,
                demo.completed
              )
              .map(
                (step) => step.id
              )
          );

        const savedOutcome =
          buildTaskBreakdownOutcome({
            steps: generated,
            completedStepIds,
            actualGeneratedConfiguration:
              configuration,
            timerUsed: false,
            stepEdits: 0,
            stepReorders: 0,
            durationMs:
              generated.length *
              300000,
          });

        if (
          demo.completed ===
          generated.length
        ) {
          await completeSupportModule({
            userId: user.id,
            moduleId:
              TASK_BREAKDOWN_MODULE_ID,
            interventionId:
              started.interventionId,
            outcome: savedOutcome,
          });
        } else {
          await abandonSupportModule({
            userId: user.id,
            moduleId:
              TASK_BREAKDOWN_MODULE_ID,
            interventionId:
              started.interventionId,
            metadata: {
              reason:
                "demo_incomplete",
            },
            outcome: savedOutcome,
          });
        }
      }

      await refreshHistory();

      setSeedStatus(
        "Done — the panel is now reading those saved outcomes."
      );
    } catch {
      setSeedStatus(
        "Could not save demo history."
      );
    }
  };

  const timerDisplay =
    `${Math.floor(
      timerSecLeft / 60
    )
      .toString()
      .padStart(2, "0")}:` +
    `${(
      timerSecLeft % 60
    )
      .toString()
      .padStart(2, "0")}`;

  return (
    <SupportToolThemeProvider theme="adhd_focus">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="relative min-h-screen overflow-hidden bg-[#fffefa] px-4 py-4 text-[#1d2033]">
          <div className="pointer-events-none absolute left-[3%] top-[180px] h-20 w-20 rounded-full bg-[#f5f9e9]" />
          <div className="pointer-events-none absolute right-[5%] top-[520px] h-24 w-24 rounded-full bg-[#f8f2ff]" />
          <div className="pointer-events-none absolute bottom-[5%] left-[20%] h-16 w-16 rounded-full bg-[#fff8d9]" />

          <div className="mx-auto w-full max-w-[1180px]">
            <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.62fr)_minmax(360px,.95fr)]">
              <section className="min-w-0">
                <header className="relative mb-[18px] min-h-[122px] pr-0 lg:pr-[220px]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#dfead9] bg-[#edf6e7] px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#47764c]">
                    <Sparkles size={12} />
                    Clear the runway
                  </div>

                  <h1 className="mt-2.5 text-[43px] font-black leading-[0.95] tracking-[-0.045em] text-[#1d2033]">
                    Task{" "}
                    <span className="text-[#69aa65]">
                      breakdown
                    </span>
                  </h1>

                  <p className="mt-2 text-[15px] font-medium text-[#455067]">
                    Big task? We'll make it feel a little lighter!
                  </p>

                  <div className="pointer-events-none absolute right-[18px] top-0 hidden h-[120px] w-[195px] lg:block">
                    <div className="absolute right-[25px] top-[1px] grid h-[100px] w-[86px] place-items-center rounded-[24px] border-[5px] border-[#7653df] bg-[#fbf9ff]">
                      <Check
                        size={42}
                        strokeWidth={3}
                        className="text-[#7653df]"
                      />
                    </div>

                    <div className="absolute right-[43px] top-[-7px] h-[14px] w-[48px] rounded-full border-[4px] border-[#7653df] bg-[#fffefa]" />

                    <Pencil
                      className="absolute left-[13px] top-[40px] -rotate-12 text-[#e5b33d]"
                      size={36}
                      strokeWidth={1.8}
                    />

                    <Sparkles
                      className="absolute right-0 top-[8px] text-[#e7be31]"
                      size={23}
                    />

                    <Heart
                      className="absolute bottom-[1px] right-[1px] text-[#bf93ec]"
                      size={28}
                    />

                    <Star
                      className="absolute bottom-[7px] left-[54px] text-[#95c984]"
                      size={14}
                    />
                  </div>
                </header>

                <section className="relative overflow-hidden rounded-[25px] border border-[#d3e6cf] bg-gradient-to-br from-white via-[#fefffc] to-[#f8fff4] px-[22px] py-[20px] shadow-[0_9px_22px_rgba(77,130,73,0.05)]">
                  <div className="absolute -left-[22px] top-[12px] h-[46px] w-[46px] rounded-full border-[4px] border-[#e5efb4]" />

                  <Cloud
                    className="pointer-events-none absolute -bottom-2 right-8 text-[#edf6e8]"
                    size={74}
                    strokeWidth={1.4}
                  />

                  <div className="pointer-events-none absolute right-5 top-4 flex gap-2">
                    <Sparkles
                      className="text-[#6baa64]"
                      size={19}
                    />

                    <Star
                      className="mt-5 text-[#e2bc3a]"
                      size={13}
                    />
                  </div>

                  <div className="flex gap-3.5">
                    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#87c274] to-[#61a15c] text-[17px] font-black text-white shadow-[0_4px_9px_rgba(91,157,80,.24)]">
                      1
                    </span>

                    <div className="relative min-w-0 flex-1">
                      <h2 className="pt-[3px] text-[17px] font-black tracking-[-0.02em] text-[#1d2033]">
                        What&apos;s the thing?
                      </h2>

                      <p className="mt-2 text-[13px] font-medium leading-5 text-[#505a70]">
                        No need to plan it perfectly. Just name what&apos;s on your mind.
                      </p>

                      <div className="relative mt-4">
                        <textarea
                          value={bigTask}
                          onChange={(event) =>
                            setBigTask(
                              event.target.value
                            )
                          }
                          rows={1}
                          placeholder={`e.g. ${placeholders[placeholderIndex]}`}
                          className="min-h-[48px] w-full resize-none rounded-[15px] border-2 border-[#ded9cc] bg-[#fffefb] px-4 py-[13px] pr-12 text-[13.5px] font-semibold text-[#1d2033] shadow-[0_3px_0_#edf1e5] outline-none placeholder:font-medium placeholder:text-[#a0a7b9] focus:border-[#77bb75] focus:ring-2 focus:ring-[#e9f6e7]"
                        />

                        <Pencil
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#69a967]"
                          size={20}
                        />
                      </div>

                      {user?.id && (
                        <div className="mt-3 flex min-h-[40px] items-center justify-between rounded-[15px] border border-[#e5efdf] bg-gradient-to-r from-[#f1faed] via-[#f7fbf4] to-[#f4f1ff] px-3.5 py-2">
                          <span className="flex min-w-0 items-center gap-2 text-[11.3px] font-medium text-[#667269]">
                            <WandSparkles
                              size={15}
                              className="shrink-0 text-[#65ac60]"
                            />

                            <span className="truncate sm:whitespace-normal">
                              {evidence.recommendation
                                ? evidence.recommendation.direction ===
                                  "smaller"
                                  ? "I can keep this one lighter based on what you've been finishing lately."
                                  : "I can shape this one around what has been working for you."
                                : "Use this a few times and I'll start spotting what works best for you."}
                            </span>
                          </span>

                          <Info
                            size={14}
                            className="shrink-0 text-[#876ce5]"
                          />
                        </div>
                      )}

                      {planningOpen && (
                        <div className="mt-3 grid gap-2 rounded-[15px] border border-[#e3ddf2] bg-[#faf8ff] p-3 sm:grid-cols-2">
                          <label className="text-[10px] font-black text-[#625d79]">
                            Breakdown style

                            <select
                              value={defaultStyle}
                              onChange={(event) => {
                                setSelectedStyle(
                                  event.target.value
                                );

                                setUserConfigured(true);
                              }}
                              className="mt-1.5 block w-full rounded-lg border border-[#d8d1ec] bg-white px-2.5 py-2 text-[12px] font-semibold text-[#4f4c65] outline-none"
                            >
                              {TASK_BREAKDOWN_STYLES.map(
                                (style) => (
                                  <option key={style}>
                                    {style}
                                  </option>
                                )
                              )}
                            </select>
                          </label>

                          <label className="text-[10px] font-black text-[#625d79]">
                            Priority

                            <select
                              value={selectedPriority}
                              onChange={(event) => {
                                setSelectedPriority(
                                  event.target.value
                                );

                                setUserConfigured(true);
                              }}
                              className="mt-1.5 block w-full rounded-lg border border-[#d8d1ec] bg-white px-2.5 py-2 text-[12px] font-semibold text-[#4f4c65] outline-none"
                            >
                              {TASK_BREAKDOWN_PRIORITIES.map(
                                (priority) => (
                                  <option key={priority}>
                                    {priority}
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                        </div>
                      )}

                      <div className="mt-3.5 flex items-center gap-4">
                        <button
                          type="button"
                          onClick={generateBreakdown}
                          disabled={!bigTask.trim()}
                          className="inline-flex h-[42px] items-center gap-2 rounded-[13px] bg-gradient-to-r from-[#71b662] to-[#559d58] px-4 text-[12.5px] font-black text-white shadow-[0_4px_0_#d8e9d1] transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Rocket size={16} />
                          Make it smaller
                          <ChevronRight size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPlanningOpen(
                              (open) => !open
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-black text-[#6f52d5]"
                        >
                          Tweak it yourself

                          {planningOpen ? (
                            <ChevronUp size={12} />
                          ) : (
                            <ChevronDown size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {steps.length > 0 && (
                  <section className="relative mt-[14px] overflow-hidden rounded-[25px] border border-[#e2e4eb] bg-white px-[18px] py-[18px] shadow-[0_8px_20px_rgba(60,65,95,.04)]">
                    <div className="pointer-events-none absolute -right-7 -top-7 h-20 w-20 rounded-full bg-[#f4efff]" />

                    <Sparkles
                      size={14}
                      className="pointer-events-none absolute right-10 top-7 text-[#d7ba3e]"
                    />

                    <Heart
                      size={16}
                      className="pointer-events-none absolute right-16 top-12 text-[#c89bee]"
                    />

                    <div className="relative mb-3 flex items-center gap-3">
                      <span className="grid h-[36px] w-[36px] place-items-center rounded-full bg-gradient-to-br from-[#8dc576] to-[#62a05e] text-[15px] font-black text-white shadow-[0_4px_8px_rgba(83,143,84,.2)]">
                        2
                      </span>

                      <div>
                        <h2 className="text-[16px] font-black tracking-[-0.02em]">
                          Your game plan
                        </h2>

                        <p className="mt-0.5 text-[9.5px] font-medium text-[#8a8e9c]">
                          One small thing at a time.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-[#efedf8] bg-gradient-to-br from-[#f5f3ff] via-[#f8f7ff] to-[#f4f8ff] p-2.5">
                      <div className="mb-2 flex items-center gap-3 px-1">
                        <p className="min-w-0 flex-1 truncate text-[13px] font-black text-[#35384f]">
                          {bigTask}
                        </p>

                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black ${
                            evidence.recommendation &&
                            !userConfigured
                              ? "bg-[#e4f2dc] text-[#579253]"
                              : "bg-white text-[#67667d]"
                          }`}
                        >
                          {steps.length} little steps
                        </span>

                        <MoreVertical
                          size={15}
                          className="text-[#75758a]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        {steps.map((step, index) => {
                          const done =
                            completedSteps.has(
                              step.id
                            );

                          return (
                            <div
                              key={step.id}
                              className={`flex min-h-[36px] items-center gap-2.5 rounded-[11px] border px-2.5 py-1 transition ${
                                done
                                  ? "border-[#d4e8d0] bg-[#f6fcf4]"
                                  : "border-[#ecebf1] bg-white hover:border-[#ddd7f2] hover:shadow-[0_3px_8px_rgba(90,77,145,.04)]"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  toggleStep(step.id)
                                }
                                disabled={
                                  lifecycle.isTerminal
                                }
                                aria-label={`Mark step ${
                                  index + 1
                                } ${
                                  done
                                    ? "incomplete"
                                    : "complete"
                                }`}
                                className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[4px] border ${
                                  done
                                    ? "border-[#66a460] bg-[#66a460] text-white"
                                    : "border-[#aaaebe]"
                                }`}
                              >
                                {done && (
                                  <Check
                                    size={10}
                                    strokeWidth={3}
                                  />
                                )}
                              </button>

                              <span className="w-4 shrink-0 text-[10.5px] font-semibold text-[#777b8c]">
                                {index + 1}.
                              </span>

                              <div className="min-w-0 flex-1">
                                {editingId ===
                                step.id ? (
                                  <input
                                    autoFocus
                                    value={step.text}
                                    onChange={(
                                      event
                                    ) => {
                                      const text =
                                        event.target
                                          .value;

                                      setSteps(
                                        (current) =>
                                          current.map(
                                            (item) =>
                                              item.id ===
                                              step.id
                                                ? {
                                                    ...item,
                                                    text,
                                                  }
                                                : item
                                          )
                                      );

                                      setStepEdits(
                                        (count) =>
                                          count + 1
                                      );
                                    }}
                                    onBlur={() =>
                                      setEditingId(
                                        null
                                      )
                                    }
                                    className="w-full rounded border border-[#b9a9e8] px-1.5 py-0.5 text-[11.5px] outline-none"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingId(
                                        step.id
                                      )
                                    }
                                    disabled={
                                      lifecycle.isTerminal
                                    }
                                    className={`w-full truncate text-left text-[11.5px] ${
                                      done
                                        ? "text-[#999baa] line-through"
                                        : "font-medium text-[#484b5e]"
                                    }`}
                                  >
                                    {step.text}
                                  </button>
                                )}
                              </div>

                              <GripVertical
                                size={12}
                                className="text-[#a1a0b4]"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  moveStep(
                                    step.id,
                                    "up"
                                  )
                                }
                                disabled={
                                  index === 0 ||
                                  lifecycle.isTerminal
                                }
                                className="text-[#8c8ca0] disabled:opacity-20"
                              >
                                <ChevronUp size={11} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  moveStep(
                                    step.id,
                                    "down"
                                  )
                                }
                                disabled={
                                  index ===
                                    steps.length - 1 ||
                                  lifecycle.isTerminal
                                }
                                className="text-[#8c8ca0] disabled:opacity-20"
                              >
                                <ChevronDown
                                  size={11}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditingId(
                                    step.id
                                  )
                                }
                                disabled={
                                  lifecycle.isTerminal
                                }
                                className="text-[#77758e] disabled:opacity-20"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={addStep}
                        disabled={
                          lifecycle.isTerminal
                        }
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#e6ddfa] bg-[#f3efff] px-3.5 text-[10.5px] font-black text-[#7055d5] transition hover:-translate-y-[1px]"
                      >
                        <Plus size={14} />
                        Add one
                      </button>

                      <button
                        type="button"
                        onClick={startTimer}
                        disabled={
                          lifecycle.isTerminal ||
                          completedSteps.size ===
                            steps.length
                        }
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#e6ddfa] bg-[#f3efff] px-3.5 text-[10.5px] font-black text-[#7055d5] transition hover:-translate-y-[1px]"
                      >
                        <Clock3 size={13} />
                        Focus on the next one
                      </button>

                      <button
                        type="button"
                        onClick={markAllComplete}
                        disabled={
                          !user?.id ||
                          lifecycle.isTerminal ||
                          completedSteps.size ===
                            steps.length
                        }
                        className="ml-auto inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#e7e7eb] bg-[#f6f6f8] px-4 text-[10.5px] font-black text-[#9696a2] transition enabled:hover:border-[#d9ead3] enabled:hover:bg-[#eef8eb] enabled:hover:text-[#579253] disabled:opacity-50"
                      >
                        <Check size={14} />
                        All done ✨
                      </button>

                      <button
                        type="button"
                        onClick={startBreakdown}
                        disabled={
                          !user?.id ||
                          lifecycle.hasStarted ||
                          lifecycle.isTerminal
                        }
                        className="sr-only"
                      >
                        <Play size={14} />
                        Start this breakdown
                      </button>

                      <button
                        type="button"
                        onClick={resetBreakdown}
                        className="sr-only"
                      >
                        <RotateCcw size={14} />
                        Reset
                      </button>
                    </div>

                    {timerActive && (
                      <div className="relative mt-4 overflow-hidden rounded-xl border border-[#efd788] bg-gradient-to-r from-[#fff9df] to-[#fffdf1] px-4 py-3">
                        <Sun
                          size={22}
                          className="pointer-events-none absolute right-14 top-2 text-[#f2d66e]"
                        />

                        <div className="relative flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 font-mono text-sm font-black text-[#765a0e]">
                            <Clock3 size={16} />
                            {timerDisplay}
                          </span>

                          <span className="font-sans text-[10px] font-bold text-[#8d7a42]">
                            Just this step. Nothing else.
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setTimerActive(false)
                            }
                            className="font-sans text-xs font-bold text-[#806d32]"
                          >
                            Stop
                          </button>
                        </div>
                      </div>
                    )}

                    {!user?.id && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg bg-[#fff5f1] px-3 py-2 text-[10px] text-[#89524a]"
                      >
                        Sign in if you want NeuroBridge to learn what works for you over time.
                      </p>
                    )}

                    {lifecycle.error && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg bg-[#fff0f0] px-3 py-2 text-[10px] text-red-700"
                      >
                        {lifecycle.error}
                      </p>
                    )}

                    {lifecycle.isTerminal &&
                      (lifecycle.status ===
                        "completed" ||
                        lifecycle.status ===
                          "partially_completed") && (
                        <TaskBreakdownRating
                          lifecycle={lifecycle}
                          onRated={refreshHistory}
                        />
                      )}
                  </section>
                )}
              </section>

              <AdaptivePanel
                evidence={evidence}
                historyLoading={historyLoading}
                historyError={historyError}
                historyOpen={historyOpen}
                setHistoryOpen={setHistoryOpen}
                onUseRecommendation={() => {
                  if (
                    !evidence.recommendation
                  ) {
                    return;
                  }

                  setSelectedStyle(
                    evidence
                      .recommendation
                      .recommendedStyle
                  );

                  setUserConfigured(false);
                  setPlanningOpen(false);
                }}
                onChooseOwn={() => {
                  setUserConfigured(true);
                  setPlanningOpen(true);
                }}
                isDev={Boolean(
                  import.meta.env.DEV &&
                    user?.id
                )}
                onSeed={seedDemoHistory}
                seedStatus={seedStatus}
              />
            </div>
          </div>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
};

function TaskBreakdownRating({
  lifecycle,
  onRated,
}) {
  const [rating, setRating] =
    useState(null);

  const [submitted, setSubmitted] =
    useState(false);

  const submit = async () => {
    if (!rating) return;

    const result =
      await lifecycle.rate({
        rating,
      });

    if (result.ok) {
      setSubmitted(true);
      await onRated?.();
    }
  };

  return (
    <div className="relative mt-4 overflow-hidden rounded-[18px] border border-[#ddd7f4] bg-gradient-to-r from-[#f8f6ff] via-[#fbf9ff] to-[#f4faef] p-4">
      <div className="pointer-events-none absolute -right-6 -bottom-7 h-16 w-16 rounded-full bg-white/60" />

      <Sparkles
        size={14}
        className="absolute right-4 top-4 text-[#d4b844]"
      />

      <Heart
        size={14}
        className="absolute right-9 top-7 text-[#c89bee]"
      />

      <div className="relative">
        <p className="text-[11px] font-black text-[#40376d]">
          Nice — how did that feel?
        </p>

        <p className="mt-1 text-[9.5px] text-[#77728d]">
          Your answer helps shape future breakdowns.
        </p>

        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4, 5].map(
            (value) => (
              <button
                type="button"
                key={value}
                aria-label={`Rate ${value}`}
                onClick={() =>
                  setRating(value)
                }
                className={`grid h-7 w-7 place-items-center rounded-full border text-[10px] font-black transition ${
                  rating === value
                    ? "border-[#6d58ba] bg-[#6d58ba] text-white"
                    : "border-[#cfc4eb] bg-white text-[#6d58ba] hover:bg-[#eee8ff]"
                }`}
              >
                {value}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          disabled={!rating || submitted}
          onClick={submit}
          className="mt-3 rounded-lg bg-gradient-to-r from-[#7458c8] to-[#6d58ba] px-3 py-2 text-[10px] font-black text-white shadow-[0_3px_0_#d2c6ef] disabled:opacity-50"
        >
          {submitted
            ? "Saved ✨"
            : "Save this"}
        </button>
      </div>
    </div>
  );
}

export default TaskBreakdown;

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useLocation } from 'react-router-dom';

import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Coffee,
  Heart,
  Leaf,
  Moon,
  Play,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

import SupportToolThemeProvider from '@/theme/SupportToolThemeProvider';
import SupportToolLayout from '@/components/support/SupportToolLayout';

import { useInterventionLifecycle } from '@/support/execution';

import {
  buildFocusSessionOutcome,
  completionRatio,
  deriveFocusDurationTrends,
  deriveFocusSessionStats,
  getFocusSessionHistory,
  seedFocusSessionDemoHistory,
  validateFocusSessionConfiguration,
} from '@/support/modules/focusSession/focusSessionService';

import {
  FOCUS_SESSION_MODULE_ID,
} from '@/support/modules/focusSession/focusSessionTypes';

import { getSupportEvidenceAsync } from '@/support/evidence';
import { getRole4Repository } from '@/support/persistence/role4Repository';

import {
  recommendFocusConfiguration,
} from '@backend/adaptive/reasoning/focusConfiguration';

import { useFeatureAdaptation } from '@/hooks/useFeatureAdaptation';
import { useContextStateOptional } from '@/context/ContextProvider';

import useFocusSessionControlStore from '@/stores/focusSessionControlStore';

const PRESETS = [
  {
    label: '15 min Sprint',
    minutes: 15,
    eyebrow: 'Quick',
    detail: 'Sprint',
  },
  {
    label: '25 min Classic',
    minutes: 25,
    eyebrow: 'Standard',
    detail: 'Classic',
  },
  {
    label: '45 min Deep Dive',
    minutes: 45,
    eyebrow: 'Extended',
    detail: 'Deep Dive',
  },
];

const MODES = [
  {
    id: 'focus',
    label: 'Focus',
    icon: Sun,
  },
  {
    id: 'shortBreak',
    label: 'Short break',
    icon: Coffee,
  },
  {
    id: 'longBreak',
    label: 'Long break',
    icon: Moon,
  },
];

const DEFAULT_MODE_MINUTES = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

const BREAK_TIPS = [
  'Stretch your arms and legs.',
  'Drink some water.',
  'Look at something 20 feet away for 20 seconds.',
  'Take five deep breaths.',
  'Walk around for a minute.',
];

const CALM_BREAK_TIPS = [
  'Take five slow breaths, focusing on the exhale.',
  'Rest your hands in your lap and soften your shoulders.',
  'Look at something calm and breathe slowly.',
  'Close your eyes and notice one sound nearby.',
  'Press your feet into the floor and relax your jaw.',
];

const BrainMascot = () => (
  <img
    src="/focus-mascot.svg"
    alt="Calm brain wearing green headphones"
    className="h-[110px] w-[140px] object-contain"
  />
);

const CircularProgress = ({
  progress,
  children,
}) => {
  const size = 238;
  const strokeWidth = 12;

  const radius =
    (size - strokeWidth) / 2;

  const circumference =
    radius * 2 * Math.PI;

  const strokeDashoffset =
    circumference -
    progress * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        className="absolute -rotate-90 transform"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#DCE9D5"
          strokeWidth={strokeWidth}
          fill="none"
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#76A969"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={
            circumference
          }
          strokeDashoffset={
            strokeDashoffset
          }
          className="transition-all duration-500"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};

const ModeSelector = ({
  mode,
  setMode,
  setFocusMinutes,
  setSecondsLeft,
}) => {
  const handleModeChange = (id) => {
    setMode(id);

    const mins =
      DEFAULT_MODE_MINUTES[id] ?? 25;

    setFocusMinutes(mins);
    setSecondsLeft(mins * 60);
  };

  return (
    <div className="inline-flex max-w-full items-center gap-1 rounded-[18px] border border-[#e1e5df] bg-white p-1 shadow-sm">
      {MODES.map((item) => {
        const Icon = item.icon;
        const active =
          mode === item.id;

        return (
          <button
            type="button"
            key={item.id}
            onClick={() =>
              handleModeChange(item.id)
            }
            className={`flex items-center gap-2 rounded-[14px] px-4 py-2 text-[12px] font-bold transition ${
              active
                ? 'bg-gradient-to-r from-[#6CAD5D] to-[#4F984B] text-white shadow-[0_3px_8px_rgba(70,135,68,.16)]'
                : 'text-[#4F566D] hover:bg-[#F3F8F1]'
            }`}
          >
            <Icon size={14} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

const PresetSelector = ({
  selected,
  onSelect,
}) => (
  <div>
    <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#4F8D46]">
      Session length
    </p>

    <div className="grid grid-cols-3 gap-3">
      {PRESETS.map((preset) => {
        const selectedPreset =
          selected === preset.minutes;

        return (
          <button
            type="button"
            key={preset.minutes}
            onClick={() =>
              onSelect(
                preset.minutes,
              )
            }
            className={`rounded-[15px] border px-3 py-3.5 text-center transition ${
              selectedPreset
                ? 'border-[#70A865] bg-[#F2F8EE] shadow-[0_3px_0_#DCE9D5]'
                : 'border-[#E4E6E2] bg-white hover:border-[#9FCB95] hover:bg-[#F8FCF6]'
            }`}
          >
            <span
              className={`block text-[11px] font-black ${
                selectedPreset
                  ? 'text-[#31552F]'
                  : 'text-[#252B3F]'
              }`}
            >
              {preset.eyebrow}{' '}
              {preset.minutes} min
            </span>

            <span className="mt-1 block text-[10px] font-medium text-[#6B7185]">
              {preset.detail}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

const FocusTrendRow = ({
  row,
  best,
}) => {
  const percent =
    row.sessions > 0
      ? Math.round(
          row.completionRate * 100,
        )
      : 0;

  return (
    <div className="grid grid-cols-[90px_minmax(100px,1fr)_auto] items-center gap-3">
      <span className="text-[11px] font-bold text-[#42485C]">
        {row.minutes} min sessions
      </span>

      <div className="h-[10px] overflow-hidden rounded-full bg-[#ECEBF1]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            best
              ? 'bg-gradient-to-r from-[#6FAE61] to-[#83BB72]'
              : 'bg-[#D9D8E1]'
          }`}
          style={{
            width: `${percent}%`,
          }}
        />
      </div>

      <span className="whitespace-nowrap text-[10.5px] font-medium text-[#686E81]">
        {row.completed}/
        {row.sessions} completed
      </span>
    </div>
  );
};

const ChevronRightVisual = () => (
  <span className="text-[28px] font-light leading-none text-[#4F9148]">
    ›
  </span>
);

const AdaptiveFocusPanel = ({
  trends,
  engineRecommendation,
  adaptiveConfig,
  onUseDuration,
}) => {
  const learnedDuration =
    trends.best?.minutes ??
    engineRecommendation
      ?.plannedDurationMinutes ??
    null;

  const hasRecommendation =
    Boolean(learnedDuration);

  return (
    <section className="rounded-[22px] border border-[#EAE7F2] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(63,56,91,.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-[40px] w-[40px] place-items-center rounded-full bg-[#F1EBFF] text-[#7858E0]">
            ☁
          </span>

          <div>
            <h2 className="text-[18px] font-black tracking-[-0.025em] text-[#20243E]">
              Adapting for you
            </h2>

            <p className="mt-1 text-[11px] font-medium text-[#7A8093]">
              Based on your past focus sessions
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF8E9] px-3 py-1.5 text-[10px] font-black text-[#52884C]">
          Live
          <ChevronDown size={11} />
        </span>
      </div>

      {hasRecommendation ? (
        <button
          type="button"
          onClick={() =>
            onUseDuration(
              learnedDuration,
            )
          }
          className="mt-4 flex w-full items-center gap-4 rounded-[18px] border border-[#DDEDD7] bg-gradient-to-r from-[#EFF8EB] via-[#F5FAF2] to-[#F8FCF6] px-4 py-4 text-left transition hover:-translate-y-[1px] hover:shadow-[0_6px_16px_rgba(82,135,73,.08)]"
        >
          <span className="grid h-[45px] w-[45px] shrink-0 place-items-center rounded-full bg-[#DFF0D8] text-[#599551]">
            <BarChart3 size={22} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black text-[#27552F]">
              {learnedDuration} minute
              sessions work best
            </span>

            <span className="mt-1 block text-[11px] font-medium leading-[1.45] text-[#646F67]">
              {trends.best
                ? `You tend to complete ${learnedDuration} minute sessions more often, so we'll set that as your default.`
                : adaptiveConfig?.active
                  ? `Your recent focus history suggests a ${learnedDuration} minute block may fit you better.`
                  : `Your recent focus sessions suggest ${learnedDuration} minutes may work better.`}
            </span>
          </span>

          <ChevronRightVisual />
        </button>
      ) : (
        <div className="mt-4 flex gap-4 rounded-[18px] border border-[#E9E4F5] bg-gradient-to-r from-[#F7F3FF] to-[#F4F9F1] px-4 py-4">
          <span className="grid h-[45px] w-[45px] shrink-0 place-items-center rounded-full bg-white text-[#7858E0] shadow-sm">
            <Sparkles size={21} />
          </span>

          <div>
            <p className="text-[13px] font-black text-[#34304E]">
              Still learning your focus rhythm
            </p>

            <p className="mt-1 text-[11px] font-medium leading-[1.45] text-[#777D8D]">
              Finish a few focus sessions and I&apos;ll start noticing which block length works best for you.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

const FocusTrendsPanel = ({
  trends,
}) => (
  <section className="rounded-[22px] border border-[#E4DEF5] bg-gradient-to-br from-[#FCFAFF] to-[#F8F6FE] px-5 py-5 shadow-[0_6px_18px_rgba(92,71,148,.05)]">
    <div className="mb-4 flex items-center gap-2">
      <BarChart3
        size={18}
        className="text-[#805DE3]"
      />

      <h3 className="text-[11px] font-black uppercase tracking-[0.17em] text-[#387B3F]">
        Your focus trends
      </h3>
    </div>

    <div className="space-y-4">
      {trends.rows.map((row) => (
        <FocusTrendRow
          key={row.minutes}
          row={row}
          best={
            trends.best?.minutes ===
            row.minutes
          }
        />
      ))}
    </div>
  </section>
);

const TodayPanel = ({
  sessions,
  totalMinutes,
  streak,
  weeklyMinutes,
}) => {
  const goalProgress =
    Math.min(
      100,
      Math.round(
        (totalMinutes / 100) * 100,
      ),
    );

  return (
    <section className="flex items-center justify-between rounded-[22px] border border-[#DAD7F5] bg-gradient-to-r from-[#FBF9FF] to-[#F7F5FF] px-5 py-4 shadow-[0_5px_16px_rgba(87,70,150,.05)]">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#805DE3]">
          <CalendarDays size={16} />
          Today
        </p>

        <p className="mt-2 text-[14px] font-black text-[#252A43]">
          {sessions} session
          {sessions === 1 ? '' : 's'} |{' '}
          {totalMinutes} min
        </p>

        <p className="mt-1 text-[11px] font-medium text-[#8A8EA0]">
          Streak: {streak} days | This week:{' '}
          {weeklyMinutes} min
        </p>
      </div>

      <div className="relative grid h-[62px] w-[62px] place-items-center rounded-full border-[7px] border-[#E0DAFF]">
        <div
          className="absolute inset-[-7px] rounded-full border-[7px] border-transparent border-t-[#805DE3]"
          style={{
            transform: `rotate(${
              Math.max(
                0,
                goalProgress - 25,
              ) * 1.8
            }deg)`,
          }}
        />

        <span className="text-[14px] font-black text-[#262B44]">
          {goalProgress}%
        </span>
      </div>
    </section>
  );
};

const SimplePlanPanel = () => (
  <section className="relative overflow-hidden rounded-[22px] border border-[#DCEBD6] bg-gradient-to-br from-[#F9FFF6] to-[#F1FAEC] px-5 py-4 shadow-[0_5px_16px_rgba(83,132,69,.05)]">
    <div className="flex items-center gap-2">
      <ClipboardList
        size={17}
        className="text-[#5E9A55]"
      />

      <h3 className="text-[11px] font-black uppercase tracking-[0.17em] text-[#4F8B49]">
        A simple plan
      </h3>
    </div>

    <ol className="mt-3 space-y-2 text-[12px] font-medium text-[#4F566D]">
      <li className="flex items-center gap-3">
        <span className="grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-[#6EA65D] text-[10px] font-black text-white">
          1
        </span>
        Choose one thing to focus on.
      </li>

      <li className="flex items-center gap-3">
        <span className="grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-[#6EA65D] text-[10px] font-black text-white">
          2
        </span>
        Start the timer and work until it ends.
      </li>

      <li className="flex items-center gap-3">
        <span className="grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-[#6EA65D] text-[10px] font-black text-white">
          3
        </span>
        Take a break, then decide on the next block.
      </li>
    </ol>

    <img
      src="/focus-plant.svg"
      alt=""
      className="absolute bottom-2 right-3 h-[82px] w-[68px] object-contain opacity-90"
    />

    <Sparkles
      size={16}
      className="absolute right-[78px] top-[47px] text-[#E0B938]"
    />
  </section>
);

const CelebrationBanner = ({
  onStartBreak,
  onSkip,
  intent,
  focusMinutes,
}) => (
  <div className="rounded-[18px] border border-[#DCEBD5] bg-gradient-to-r from-[#EFF8EB] to-[#F7FBF4] p-4">
    <p className="text-[13px] font-black text-[#31552F]">
      Block complete ✨
    </p>

    <p className="mt-1 text-[11px] text-[#6F786D]">
      You protected {focusMinutes} minutes.
      {intent
        ? ` "${intent}" moved forward.`
        : ''}
    </p>

    <div className="mt-3 flex gap-2">
      <button
        type="button"
        onClick={onStartBreak}
        className="rounded-xl bg-[#68A15C] px-4 py-2 text-[11px] font-black text-white"
      >
        Take 5-min break
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="rounded-xl border border-[#DFE2DC] bg-white px-4 py-2 text-[11px] font-bold text-[#555D70]"
      >
        Start next block
      </button>
    </div>
  </div>
);

const BreakMode = ({
  secondsLeft,
  tip,
  onEnd,
}) => {
  const minutes = Math.floor(
    secondsLeft / 60,
  )
    .toString()
    .padStart(2, '0');

  const seconds =
    (secondsLeft % 60)
      .toString()
      .padStart(2, '0');

  return (
    <div className="rounded-[18px] border border-[#DDECD6] bg-gradient-to-r from-[#EFF8EB] to-[#F7FBF3] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#4E884A]">
        Break
      </p>

      <div className="mt-1 text-3xl font-black text-[#242A3F]">
        {minutes}:{seconds}
      </div>

      <p className="mt-1 text-[11px] text-[#6D756F]">
        {tip}
      </p>

      <button
        type="button"
        onClick={onEnd}
        className="mt-3 rounded-xl bg-[#68A15C] px-4 py-2 text-[11px] font-black text-white"
      >
        Back to focus
      </button>
    </div>
  );
};

const FocusSessions = () => {
  const location = useLocation();

  const aiData =
    location.state || null;

  const focusCommand =
    aiData?.focusSessionCommand;

  const navigationConfiguration =
    aiData?.configuration;

  const initialConfiguration =
    validateFocusSessionConfiguration(
      navigationConfiguration,
    );

  const initialFocusMinutes =
    navigationConfiguration
      ?.plannedDurationMinutes ??
    focusCommand?.session
      ?.duration_minutes ??
    aiData?.duration_minutes ??
    25;

  const initialBreakMinutes =
    navigationConfiguration
      ?.breakDurationMinutes ??
    5;

  const { user } = useAuth();

  const context =
    useContextStateOptional()
      ?.context ?? null;

  const adaptation =
    useFeatureAdaptation(
      'support.focus_session',
      {
        getAppSnapshot: () =>
          context,
        userId: user?.id ?? null,
      },
    );

  const adaptiveConfig =
    adaptation.configuration;

  const [phase, setPhase] =
    useState('setup');

  const [mode, setMode] =
    useState('focus');

  const [
    focusMinutes,
    setFocusMinutes,
  ] = useState(
    initialFocusMinutes,
  );

  const [
    secondsLeft,
    setSecondsLeft,
  ] = useState(
    initialFocusMinutes * 60,
  );

  const [intent] =
    useState(
      focusCommand?.session?.intent ||
        aiData?.intent ||
        '',
    );

  const [tag] =
    useState('');

  const [
    breakSecondsLeft,
    setBreakSecondsLeft,
  ] = useState(
    initialBreakMinutes * 60,
  );

  const [
    durationRecommendation,
    setDurationRecommendation,
  ] = useState(null);

  const [
    recommendationDismissed,
    setRecommendationDismissed,
  ] = useState(false);

  const [
    breakTip,
    setBreakTip,
  ] = useState('');

  const [
    focusHistory,
    setFocusHistory,
  ] = useState([]);

  const pauseCountRef =
    useRef(0);

  const resumeCountRef =
    useRef(0);

  const milestonesRef =
    useRef(new Set());

  const completedRef =
    useRef(false);

  const startedAtRef =
    useRef(null);

  const lifecycle =
    useInterventionLifecycle({
      userId: user?.id ?? null,
      moduleId:
        FOCUS_SESSION_MODULE_ID,
      planId:
        aiData?.planId ?? null,
      contextSnapshotId:
        aiData?.contextSnapshotId ??
        null,
      triggerSource:
        aiData?.interventionId
          ? 'system'
          : 'manual',
      selectionMode:
        aiData?.interventionId
          ? 'adaptive_ranking'
          : 'explicit_request',
      configuration: {
        ...initialConfiguration,
        plannedDurationMinutes:
          focusMinutes,
        mode,
      },
      existingInterventionId:
        aiData?.interventionId ??
        null,
    });

  const trends = useMemo(
    () =>
      deriveFocusDurationTrends(
        focusHistory,
      ),
    [focusHistory],
  );

  const focusStats = useMemo(
    () => deriveFocusSessionStats(focusHistory),
    [focusHistory],
  );

  const refreshFocusHistory =
    useCallback(async () => {
        if (!user?.id) {
          setFocusHistory([]);
          setDurationRecommendation(
            null,
        );
        return;
      }

      try {
        const repository =
          await getRole4Repository(user.id);

        const [history, evidence] =
          await Promise.all([
            getFocusSessionHistory(
              user.id,
              { repository },
            ),
            getSupportEvidenceAsync(
              user.id,
              [
                FOCUS_SESSION_MODULE_ID,
              ],
              { repository },
            ),
          ]);

        setFocusHistory(history);

        const recommendation =
          recommendFocusConfiguration(
            evidence,
          );

        setDurationRecommendation(
          recommendation ??
            null,
        );
      } catch {
        setFocusHistory([]);
      }
    }, [user?.id]);

  useEffect(() => {
    refreshFocusHistory();
  }, [refreshFocusHistory]);

  const effectiveFocusMinutes =
    phase === 'setup' &&
    adaptiveConfig?.active
      ? Math.min(
          adaptiveConfig
            .focusMinutes,
          initialFocusMinutes,
        )
      : initialFocusMinutes;

  const effectiveBreakMinutes =
    phase === 'setup' &&
    adaptiveConfig?.active
      ? adaptiveConfig
          .breakMinutes
      : initialBreakMinutes;

  const calmBreakTips =
    adaptiveConfig
      ?.calmBreakTips ?? false;

  const effectiveAdaptationActive =
    phase === 'setup' &&
    adaptiveConfig?.active;

  useEffect(() => {
    if (phase !== 'running') {
      return undefined;
    }

    const interval =
      setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);

            setPhase(
              'celebration',
            );

            if (
              !completedRef.current &&
              user?.id
            ) {
              completedRef.current =
                true;

              void lifecycle
                .complete(
                  buildFocusSessionOutcome(
                    {
                      configuration:
                        {
                          ...initialConfiguration,
                          plannedDurationMinutes:
                            focusMinutes,
                          mode,
                        },
                      secondsRemaining: 0,
                      pauseCount:
                        pauseCountRef.current,
                      resumeCount:
                        resumeCountRef.current,
                      completedNaturally:
                        true,
                    },
                  ),
                )
                .then((result) => {
                  if (result.ok) {
                    return refreshFocusHistory();
                  }
                  return null;
                });
            }

            return 0;
          }

          return prev - 1;
        });
      }, 1000);

    return () =>
      clearInterval(interval);
  }, [
    phase,
    focusMinutes,
    mode,
    lifecycle,
    user?.id,
    initialConfiguration,
    refreshFocusHistory,
  ]);

  useEffect(() => {
    if (phase !== 'break') {
      return undefined;
    }

    const interval =
      setInterval(() => {
        setBreakSecondsLeft(
          (prev) => {
            if (prev <= 1) {
              clearInterval(
                interval,
              );

              setPhase('setup');

              return 0;
            }

            return prev - 1;
          },
        );
      }, 1000);

    return () =>
      clearInterval(interval);
  }, [phase]);

  const selectPreset =
    useCallback(
      async (minutes) => {
        setFocusMinutes(
          minutes,
        );

        setSecondsLeft(
          minutes * 60,
        );

        setRecommendationDismissed(
          false,
        );

        if (!user?.id) {
          return;
        }

        await refreshFocusHistory();
      },
      [user?.id, refreshFocusHistory],
    );

  const startSession =
    async () => {
      const blockMinutes =
        effectiveAdaptationActive
          ? Math.min(
              effectiveFocusMinutes,
              focusMinutes,
            )
          : focusMinutes;

      setFocusMinutes(
        blockMinutes,
      );

      setSecondsLeft(
        blockMinutes * 60,
      );

      pauseCountRef.current =
        0;

      resumeCountRef.current =
        0;

      milestonesRef.current =
        new Set();

      completedRef.current =
        false;

      startedAtRef.current =
        Date.now();

      if (
        user?.id &&
        !lifecycle.hasStarted
      ) {
        const started =
          await lifecycle.start(
            {},
            {
              ...initialConfiguration,
              plannedDurationMinutes:
                blockMinutes,
              mode,
            },
          );

        if (!started.ok) {
          return;
        }
      }

      setPhase('running');
    };

  const togglePause =
    async () => {
      if (
        phase === 'running'
      ) {
        pauseCountRef.current +=
          1;

        if (user?.id) {
          await lifecycle.pause({
            pauseCount:
              pauseCountRef.current,
          });
        }

        setPhase('paused');
      } else {
        resumeCountRef.current +=
          1;

        if (user?.id) {
          await lifecycle.resume({
            resumeCount:
              resumeCountRef.current,
          });
        }

        setPhase('running');
      }
    };

  const resetToSetup =
    async () => {
      if (
        user?.id &&
        (phase === 'running' ||
          phase === 'paused') &&
        !lifecycle.isTerminal &&
        !completedRef.current
      ) {
        await lifecycle.abandon(
          'user_reset',
          {
            completionRatio:
              completionRatio(
                focusMinutes * 60,
                secondsLeft,
              ),
          },
          buildFocusSessionOutcome(
            {
              configuration: {
                ...initialConfiguration,
                plannedDurationMinutes:
                  focusMinutes,
                mode,
              },
              secondsRemaining:
                secondsLeft,
              pauseCount:
                pauseCountRef.current,
              resumeCount:
                resumeCountRef.current,
            },
          ),
        );

        await refreshFocusHistory();
      }

      setPhase('setup');

      setSecondsLeft(
        focusMinutes * 60,
      );

      setBreakSecondsLeft(
        initialBreakMinutes *
          60,
      );

      lifecycle.reset();
    };

  const applyAgentCommand =
    useCallback(
      (command) => {
        if (!command) return;

        switch (
          command.command
        ) {
          case 'start':
            if (
              phase ===
              'setup'
            ) {
              startSession();
            }
            break;

          case 'pause':
            if (
              phase ===
              'running'
            ) {
              togglePause();
            }
            break;

          case 'resume':
            if (
              phase ===
              'paused'
            ) {
              togglePause();
            }
            break;

          case 'stop':
            if (
              phase ===
                'running' ||
              phase ===
                'paused'
            ) {
              resetToSetup();
            }
            break;

          case 'set_duration':
            if (
              command.session
                ?.duration_minutes
            ) {
              setFocusMinutes(
                command.session
                  .duration_minutes,
              );

              setSecondsLeft(
                command.session
                  .duration_minutes *
                  60,
              );
            }
            break;

          default:
            break;
        }
      },
      [phase],
    );

  const appliedNavCommandRef =
    useRef(false);

  useEffect(() => {
    if (
      focusCommand &&
      !appliedNavCommandRef.current
    ) {
      appliedNavCommandRef.current =
        true;

      applyAgentCommand(
        focusCommand,
      );
    }
  }, [
    focusCommand,
    applyAgentCommand,
  ]);

  const pendingAgentCommand =
    useFocusSessionControlStore(
      (state) =>
        state.pendingCommand,
    );

  useEffect(() => {
    if (!pendingAgentCommand) {
      return;
    }

    applyAgentCommand(
      pendingAgentCommand,
    );

    useFocusSessionControlStore
      .getState()
      .consume();
  }, [
    pendingAgentCommand,
    applyAgentCommand,
  ]);

  const startBreak = () => {
    setBreakSecondsLeft(
      effectiveBreakMinutes *
        60,
    );

    const pool =
      calmBreakTips
        ? CALM_BREAK_TIPS
        : BREAK_TIPS;

    setBreakTip(
      pool[
        Math.floor(
          Math.random() *
            pool.length,
        )
      ],
    );

    setPhase('break');
  };

  const useRecommendedDuration =
    (minutes) => {
      setFocusMinutes(minutes);

      setSecondsLeft(
        minutes * 60,
      );

      setRecommendationDismissed(
        false,
      );
    };

  const seedDevelopmentHistory =
    async () => {
      if (!user?.id) return;
      await seedFocusSessionDemoHistory(
        user.id,
      );
      await refreshFocusHistory();
    };

  const totalSeconds =
    focusMinutes * 60;

  const elapsed =
    totalSeconds -
    secondsLeft;

  const progress =
    totalSeconds > 0
      ? elapsed / totalSeconds
      : 0;

  useEffect(() => {
    if (
      phase !== 'running' ||
      !user?.id ||
      !lifecycle.hasStarted
    ) {
      return;
    }

    const ratio =
      completionRatio(
        totalSeconds,
        secondsLeft,
      );

    const milestone =
      [0.25, 0.5, 0.75].find(
        (point) =>
          ratio >= point &&
          !milestonesRef.current.has(
            point,
          ),
      );

    if (milestone) {
      milestonesRef.current.add(
        milestone,
      );

      lifecycle.progress({
        progressType:
          'focus_milestone',
        progressRatio:
          milestone,
        completedUnits:
          Math.round(
            milestone * 4,
          ),
        totalUnits: 4,
        elapsedMs:
          Math.max(
            0,
            Date.now() -
              (startedAtRef.current ??
                Date.now()),
          ),
      });
    }
  }, [
    phase,
    secondsLeft,
    totalSeconds,
    user?.id,
    lifecycle,
  ]);

  const minutes =
    Math.floor(
      secondsLeft / 60,
    )
      .toString()
      .padStart(2, '0');

  const seconds =
    (secondsLeft % 60)
      .toString()
      .padStart(2, '0');

  return (
    <SupportToolThemeProvider theme="adhd_focus">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="min-h-screen bg-[#FFFEFA] px-4 py-5 text-[#20243E]">
          <div className="mx-auto w-full max-w-[1220px]">
            <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.62fr)_minmax(350px,.95fr)]">
              <section>
                <header className="relative mb-5 min-h-[126px] pr-0 lg:pr-[285px]">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF7E8] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-[#398044]">
                    <Leaf size={14} />
                    Focus better, your way
                  </div>

                  <h1 className="mt-3 text-[48px] font-black leading-[0.92] tracking-[-0.045em] text-[#20243E]">
                    Focus{' '}
                    <span className="text-[#4B9B50]">
                      Session
                    </span>
                  </h1>

                  <p className="mt-3 text-[16px] font-medium text-[#515B72]">
                    One block. Real progress.
                  </p>

                  <div className="absolute right-[12px] top-0 hidden items-start gap-2 lg:flex">
                    <BrainMascot />

                    <div className="mt-6 rounded-[18px] border border-[#E3E6DD] bg-white px-4 py-4 text-center text-[11px] font-black leading-[1.35] text-[#2D334A] shadow-[0_5px_15px_rgba(58,60,82,.06)]">
                      You&apos;ve
                      <br />
                      got this!
                      <Heart
                        size={13}
                        className="mx-auto mt-1 text-[#589A53]"
                        fill="currentColor"
                      />
                    </div>
                  </div>
                </header>

                <section className="rounded-[22px] border border-[#E2E5DF] bg-white p-[18px] shadow-[0_8px_24px_rgba(55,68,59,.055)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.17em] text-[#4F8B49]">
                        <span className="text-lg">
                          ◉
                        </span>
                        Current block
                      </p>

                      <p className="mt-1 text-[13px] font-black text-[#30364C]">
                        {mode ===
                        'focus'
                          ? 'A single task, at a steady pace.'
                          : 'Step away briefly and reset.'}
                      </p>
                    </div>

                    <ModeSelector
                      mode={mode}
                      setMode={setMode}
                      setFocusMinutes={
                        setFocusMinutes
                      }
                      setSecondsLeft={
                        setSecondsLeft
                      }
                    />
                  </div>

                  <div className="relative mt-4 overflow-hidden rounded-[19px] border border-[#D7E8D0] bg-gradient-to-br from-[#FCFFFB] to-[#F7FCF4] px-4 py-3">
                    <div className="absolute left-8 top-[50%] -translate-y-1/2 rounded-[18px] bg-[#EFF7EA] px-4 py-3 text-center text-[12px] font-black leading-[1.25] text-[#3F7041]">
                      Small steps
                      <br />
                      add up!
                    </div>

                    <img
                      src="/focus-plant.svg"
                      alt=""
                      className="absolute bottom-4 left-8 h-[82px] w-[65px] object-contain"
                    />

                    <Sparkles
                      size={18}
                      className="absolute bottom-[88px] left-[74px] text-[#E4BD38]"
                    />

                    <div className="flex justify-center">
                      <CircularProgress
                        progress={
                          progress
                        }
                      >
                        <div className="text-[47px] font-black tracking-[0.08em] text-[#15192F]">
                          {minutes}:
                          {seconds}
                        </div>

                        <div className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#29451E]">
                          {phase ===
                          'running'
                            ? 'Focusing'
                            : phase ===
                                'paused'
                              ? 'Paused'
                              : 'Ready'}
                        </div>

                        {tag && (
                          <div className="mt-3 rounded-full border border-[#BCD7B4] bg-[#F9FFF7] px-3 py-1 text-[10px] font-bold text-[#4E7D49]">
                            #{tag}
                          </div>
                        )}
                      </CircularProgress>
                    </div>

                    <div className="absolute right-5 top-[38%] rounded-[17px] border border-[#E5E7E2] bg-white px-4 py-3 text-center text-[11px] font-black leading-[1.3] text-[#2E344B] shadow-sm">
                      One block.
                      <br />
                      Real progress.
                    </div>

                    <div className="absolute bottom-[8px] right-[28px] rotate-[4deg] opacity-80">
                      <ClipboardList
                        size={52}
                        className="text-[#609B57]"
                        strokeWidth={1.6}
                      />

                      <Check
                        size={13}
                        className="absolute left-[14px] top-[15px] text-[#609B57]"
                      />
                    </div>

                    <Sparkles
                      size={16}
                      className="absolute bottom-7 right-5 text-[#5BA156]"
                    />

                    <Sparkles
                      size={13}
                      className="absolute right-[82px] top-[62px] text-[#E4BD38]"
                    />
                  </div>

                  <div className="mt-4">
                    <PresetSelector
                      selected={
                        focusMinutes
                      }
                      onSelect={
                        selectPreset
                      }
                    />
                  </div>

                  {phase ===
                    'celebration' && (
                    <div className="mt-3">
                      <CelebrationBanner
                        onStartBreak={
                          startBreak
                        }
                        onSkip={
                          resetToSetup
                        }
                        intent={intent}
                        focusMinutes={
                          focusMinutes
                        }
                      />
                    </div>
                  )}

                  {phase === 'break' && (
                    <div className="mt-3">
                      <BreakMode
                        secondsLeft={
                          breakSecondsLeft
                        }
                        tip={breakTip}
                        onEnd={
                          resetToSetup
                        }
                      />
                    </div>
                  )}

                  <div className="mt-4 flex gap-3">
                    {phase === 'setup' ? (
                      <>
                        <button
                          type="button"
                          aria-label="Start"
                          onClick={
                            startSession
                          }
                          className="flex h-[52px] flex-1 items-center justify-center rounded-[14px] bg-gradient-to-r from-[#2F6746] to-[#28603E] text-[16px] font-black text-white shadow-[0_4px_0_#D6E7D1] transition hover:-translate-y-[1px]"
                        >
                          <Play
                            size={18}
                            className="mr-2"
                            fill="currentColor"
                          />
                          Start Focus
                          Session
                        </button>

                        <button
                          type="button"
                          aria-label="Session settings"
                          className="grid w-[62px] place-items-center rounded-[14px] border border-[#D5E8CF] bg-[#F5FBF2] text-[#4F924B]"
                        >
                          <SlidersHorizontal
                            size={21}
                          />
                        </button>
                      </>
                    ) : phase ===
                        'running' ||
                      phase ===
                        'paused' ? (
                      <>
                        <button
                          type="button"
                          onClick={
                            togglePause
                          }
                          className="flex h-[52px] flex-1 items-center justify-center rounded-[14px] bg-gradient-to-r from-[#559951] to-[#438847] text-[14px] font-black text-white"
                        >
                          {phase ===
                          'running'
                            ? 'Pause'
                            : 'Resume'}
                        </button>

                        <button
                          type="button"
                          onClick={
                            resetToSetup
                          }
                          className="rounded-[14px] border border-[#E1E3DF] bg-white px-5 text-[13px] font-bold text-[#555D70]"
                        >
                          End
                        </button>
                      </>
                    ) : null}
                  </div>

                  {!user?.id && (
                    <p className="mt-3 rounded-xl bg-[#FFF8EA] px-3 py-2 text-[10px] text-[#806A35]">
                      Sign in to save Focus
                      Session outcomes and
                      let NeuroBridge learn
                      what works for you.
                    </p>
                  )}
                </section>
              </section>

              <aside className="space-y-3.5">
                <AdaptiveFocusPanel
                  trends={trends}
                  engineRecommendation={
                    durationRecommendation
                  }
                  adaptiveConfig={
                    adaptiveConfig
                  }
                  onUseDuration={
                    useRecommendedDuration
                  }
                />

                <FocusTrendsPanel
                  trends={trends}
                />

                <TodayPanel
                  sessions={
                    focusStats.todaySessions
                  }
                  totalMinutes={
                    focusStats.todayFocusedMinutes
                  }
                  streak={focusStats.streak}
                  weeklyMinutes={
                    focusStats.weeklyFocusedMinutes
                  }
                />

                {import.meta.env.DEV &&
                  user?.id && (
                    <button
                      type="button"
                      onClick={seedDevelopmentHistory}
                      className="text-[8px] text-[#B0A6C7] hover:text-[#7455D5]"
                    >
                      Load development demo history
                    </button>
                  )}

                <SimplePlanPanel />
              </aside>
            </div>
          </div>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
};

export default FocusSessions;

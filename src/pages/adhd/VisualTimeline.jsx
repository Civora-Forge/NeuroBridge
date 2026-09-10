"use client";

import { useMemo, useRef, useState } from "react";
import {
  BatteryMedium,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Coffee,
  ListTodo,
  Play,
  Plus,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useContextStateOptional } from "@/context/ContextProvider";
import { useFeatureAdaptation } from "@/hooks/useFeatureAdaptation";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

/* -------------------------------------------------------------------------- */
/*                                   utils                                    */
/* -------------------------------------------------------------------------- */

const toMinutes = (time) => {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};

const toTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

const todayKey = (date = new Date()) =>
  date.toISOString().slice(0, 10);

const samples = [
  {
    id: 1,
    label: "Morning routine",
    start: "07:00",
    end: "08:00",
    category: "morning",
  },
  {
    id: 2,
    label: "Deep work",
    start: "09:00",
    end: "11:00",
    category: "study",
  },
  {
    id: 3,
    label: "Break",
    start: "11:00",
    end: "11:30",
    category: "break",
  },
];

/* -------------------------------------------------------------------------- */
/*                               visual system                                */
/* -------------------------------------------------------------------------- */

const styles = {
  morning: {
    name: "Morning",
    card: "border-[#f0dfa7] bg-[#fffdf5]",
    pill: "bg-[#fff1b8] text-[#735b05]",
    accent: "#e9b91a",
    progress: "bg-[#efbe24]",
    Icon: Sun,
    message: "Start gently.",
  },

  study: {
    name: "Focus",
    card: "border-[#ddd1fa] bg-[#fbf9ff]",
    pill: "bg-[#eee5ff] text-[#6541bc]",
    accent: "#7b56dd",
    progress: "bg-[#7b56dd]",
    Icon: Target,
    message: "One thing only.",
  },

  break: {
    name: "Reset",
    card: "border-[#c8e7e9] bg-[#f7fdfd]",
    pill: "bg-[#d8f2f2] text-[#237278]",
    accent: "#36aeb4",
    progress: "bg-[#3eb6ba]",
    Icon: Coffee,
    message: "Recharge first.",
  },
};

/* -------------------------------------------------------------------------- */
/*                              decorative hero                               */
/* -------------------------------------------------------------------------- */

function TimelineHeroVisual() {
  return (
    <div className="hidden items-center gap-3 lg:flex">
      <div className="relative h-[92px] w-[130px]">
        <div className="absolute left-4 top-2 h-[78px] w-[2px] rounded-full bg-[#d9d3ea]" />
        <div className="absolute left-[9px] top-2 flex items-center gap-3"><span className="h-3 w-3 rounded-full border-[3px] border-[#e3b526] bg-[#fdfcf8]" /><span className="h-6 w-[72px] rounded-[9px] bg-[#fff0b8]" /></div>
        <div className="absolute left-[9px] top-[37px] flex items-center gap-3"><span className="h-3 w-3 rounded-full border-[3px] border-[#7652da] bg-[#fdfcf8]" /><span className="h-6 w-[91px] rounded-[9px] bg-[#ece4ff]" /></div>
        <div className="absolute left-[9px] top-[72px] flex items-center gap-3"><span className="h-3 w-3 rounded-full border-[3px] border-[#42afb3] bg-[#fdfcf8]" /><span className="h-6 w-[58px] rounded-[9px] bg-[#dff3f3]" /></div>
      </div>
      <div className="rounded-[18px] border border-[#e4e0ea] bg-white px-4 py-3 shadow-[0_4px_14px_rgba(40,40,70,.04)]"><div className="flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-[#6abe7e] opacity-30" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#55ad6a]" /></span><span className="text-[9px] font-black uppercase tracking-[.12em] text-[#89908d]">Day in motion</span></div><p className="mt-2 text-[12px] font-black text-[#30364a]">See it. Start it.</p><p className="mt-0.5 text-[9px] font-medium text-[#979ba6]">No need to hold it all in your head.</p></div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               timeline block                               */
/* -------------------------------------------------------------------------- */

function TimelineBlock({
  block,
  now,
  update,
  snooze,
  remove,
  compact,
}) {
  const style = styles[block.category] || styles.morning;
  const Icon = style.Icon;

  const start = toMinutes(block.start);
  const end = toMinutes(block.end);

  const active =
    !block.done &&
    now >= start &&
    now < end;

  const progress = block.done
    ? 100
    : block.started || active
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((now - start) /
                Math.max(1, end - start)) *
                100,
            ),
          ),
        )
      : 0;

  return (
    <article
      className={`group relative grid grid-cols-[62px_minmax(0,1fr)] gap-4 sm:grid-cols-[76px_minmax(0,1fr)] ${
        compact ? "pb-2" : "pb-4"
      }`}
    >
      {/* RAIL */}
      <div className="relative">
        <time className="block pr-3 text-right text-[11px] font-black text-[#3f4658]">
          {block.start}
        </time>

        <span
          className="absolute right-[-7px] top-[24px] z-10 h-[15px] w-[15px] rounded-full border-[4px] bg-[#fffefa]"
          style={{ borderColor: style.accent }}
        />

        <span className="absolute bottom-[-24px] right-0 top-[40px] border-l border-dashed border-[#d8dce3]" />

        <time className="absolute bottom-1 right-3 text-[10px] font-semibold text-[#a0a5b0]">
          {block.end}
        </time>
      </div>

      {/* CARD */}
      <section
        className={`
          relative overflow-hidden rounded-[22px] border
          ${style.card}
          ${
            compact
              ? "px-5 py-4"
              : "px-5 py-5 sm:px-6"
          }
          ${
            active
              ? "shadow-[0_10px_30px_rgba(93,70,180,.10)] ring-2 ring-[#ddd1ff]"
              : "shadow-[0_4px_16px_rgba(35,40,70,.045)]"
          }
          transition
        `}
      >
        {/* subtle art wash */}
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-[150px] w-[150px] rounded-full opacity-30"
          style={{
            background: `radial-gradient(circle, ${style.accent}22 0%, transparent 70%)`,
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black ${style.pill}`}
              >
                {style.name}
              </span>

              {active && (
                <span className="rounded-full bg-[#20263a] px-2.5 py-1 text-[9px] font-black tracking-[.08em] text-white">
                  NOW
                </span>
              )}

              {block.done && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#def3e4] px-2.5 py-1 text-[9px] font-black text-[#32834a]">
                  <Check size={11} strokeWidth={3} />
                  DONE
                </span>
              )}
            </div>

            <h2
              className={`mt-3 font-black tracking-[-0.035em] text-[#182039] ${
                compact
                  ? "text-[18px]"
                  : "text-[21px] sm:text-[23px]"
              }`}
            >
              {block.label}
            </h2>

            <p className="mt-1 text-[11px] font-medium text-[#7b8190]">
              {style.message} · {block.start}–{block.end}
            </p>
          </div>

          <div
            className="hidden h-[60px] w-[60px] shrink-0 place-items-center rounded-[20px] sm:grid"
            style={{
              color: style.accent,
              backgroundColor: `${style.accent}12`,
            }}
          >
            <Icon size={29} strokeWidth={1.65} />
          </div>
        </div>

        {/* continuous progress instead of 10 noisy segments */}
        <div className="relative z-10 mt-5 h-[6px] overflow-hidden rounded-full bg-white">
          <div
            className={`h-full rounded-full transition-all duration-300 ${style.progress}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ACTION BAR */}
        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
          {!block.done && (
            <button
              onClick={() =>
                update(block.id, {
                  started: !block.started,
                })
              }
              className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] bg-[#22283a] px-4 text-[11px] font-black text-white transition hover:-translate-y-0.5"
            >
              <Play
                size={13}
                fill="currentColor"
              />
              {block.started ? "Stop" : "Start"}
            </button>
          )}

          {!block.done && (
            <button
              onClick={() =>
                update(block.id, {
                  done: true,
                  started: false,
                })
              }
              className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-[#cfe7d5] bg-white px-4 text-[11px] font-black text-[#378b50]"
            >
              <CheckCircle2 size={14} />
              Mark done
            </button>
          )}

          {!block.done && (
            <button
              onClick={() => snooze(block.id)}
              className="min-h-[38px] rounded-[12px] px-3 text-[11px] font-bold text-[#747b8b] transition hover:bg-white"
            >
              Snooze 10m
            </button>
          )}

          <button
            onClick={() => remove(block.id)}
            aria-label={`Remove ${block.label}`}
            className="ml-auto grid h-[36px] w-[36px] place-items-center rounded-[11px] text-[#c995a2] transition hover:bg-[#fff0f3] hover:text-[#dc5f7e]"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </section>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*                               add block bar                                */
/* -------------------------------------------------------------------------- */

function AddBlockBar({
  entry,
  setEntry,
  start,
  setStart,
  end,
  setEnd,
  onSubmit,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[22px] border border-[#e3dfeb] bg-white p-2 shadow-[0_5px_18px_rgba(40,40,70,.05)]"
    >
      <div className="grid gap-2 lg:grid-cols-[42px_minmax(0,1fr)_108px_auto_108px_auto] lg:items-center">
        <span className="hidden h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#fff0b9] text-[#d39700] lg:grid">
          <Zap
            size={19}
            fill="currentColor"
          />
        </span>

        <input
          value={entry}
          onChange={(event) =>
            setEntry(event.target.value)
          }
          placeholder="Add block: Email prof for 20 minutes"
          className="min-h-[44px] min-w-0 rounded-[14px] bg-[#faf9fc] px-4 text-[13px] outline-none placeholder:text-[#aaaeb9] focus:bg-white focus:ring-2 focus:ring-[#dfd4fa]"
        />

        <input
          aria-label="Start time"
          type="time"
          value={start}
          onChange={(event) =>
            setStart(event.target.value)
          }
          className="min-h-[44px] rounded-[14px] bg-[#faf9fc] px-3 text-[12px] outline-none"
        />

        <span className="hidden text-center text-[11px] font-semibold text-[#a2a5af] lg:block">
          →
        </span>

        <input
          aria-label="End time"
          type="time"
          value={end}
          onChange={(event) =>
            setEnd(event.target.value)
          }
          className="min-h-[44px] rounded-[14px] bg-[#faf9fc] px-3 text-[12px] outline-none"
        />

        <button className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#7652da] px-5 text-[12px] font-black text-white shadow-[0_5px_12px_rgba(110,75,210,.20)]">
          <Plus size={15} />
          Add
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 brain dump                                 */
/* -------------------------------------------------------------------------- */

function BrainDump({
  dump,
  setDump,
  dumpEntry,
  setDumpEntry,
}) {
  const add = () => {
    if (!dumpEntry.trim()) return;

    setDump((items) => [
      ...items,
      {
        id: Date.now(),
        text: dumpEntry.trim(),
      },
    ]);

    setDumpEntry("");
  };

  return (
    <section className="rounded-[22px] border border-[#f1dce5] bg-[#fffafd] p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain
              size={17}
              className="text-[#d95d8d]"
            />

            <h2 className="text-[15px] font-black">
              Brain dump
            </h2>
          </div>

          <p className="mt-1 text-[10px] text-[#a17f8d]">
            Park it here. Deal with it later.
          </p>
        </div>

        <span className="rounded-full bg-[#ffeaf2] px-2.5 py-1 text-[9px] font-black text-[#c45480]">
          {dump.length}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={dumpEntry}
          onChange={(event) =>
            setDumpEntry(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Jot it down. Get it out."
          className="min-h-[42px] min-w-0 flex-1 rounded-[12px] border border-[#eedde4] bg-white px-3 text-[11px] outline-none focus:border-[#dc87a9]"
        />

        <button
          onClick={add}
          className="grid h-[42px] w-[42px] place-items-center rounded-[12px] bg-[#df668f] text-white"
          aria-label="Add brain dump item"
        >
          <Plus size={17} />
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {dump.map((item) => (
          <div
            key={item.id}
            className="group flex min-h-[36px] items-center gap-2 rounded-[11px] bg-white px-3 text-[10px]"
          >
            <Circle
              size={10}
              className="text-[#e9b5c8]"
            />

            <span className="min-w-0 flex-1 truncate text-[#53596a]">
              {item.text}
            </span>

            <button
              onClick={() =>
                setDump((items) =>
                  items.filter(
                    (entryItem) =>
                      entryItem.id !== item.id,
                  ),
                )
              }
              className="text-[9px] font-bold text-[#be778e] opacity-60 group-hover:opacity-100"
            >
              Clear
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  snapshot                                  */
/* -------------------------------------------------------------------------- */

function Snapshot({
  completion,
  completed,
  total,
  planned,
  doneMinutes,
}) {
  return (
    <section className="rounded-[22px] border border-[#dde9d8] bg-[#fbfff9] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-black">
            Today
          </h2>

          <p className="mt-1 text-[10px] text-[#82907f]">
            Keep the score simple.
          </p>
        </div>

        <div
          className="grid h-[50px] w-[50px] place-items-center rounded-full p-[5px]"
          style={{
            background: `conic-gradient(#5fb777 ${
              completion * 3.6
            }deg, #e6eee3 0deg)`,
          }}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-[#fbfff9] text-[10px] font-black text-[#3d8050]">
            {completion}%
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x divide-[#e5ece2] text-center">
        <div className="px-2">
          <p className="text-[20px] font-black text-[#273044]">
            {completed}
          </p>
          <p className="mt-1 text-[9px] font-semibold text-[#969caa]">
            done
          </p>
        </div>

        <div className="px-2">
          <p className="text-[20px] font-black text-[#273044]">
            {total}
          </p>
          <p className="mt-1 text-[9px] font-semibold text-[#969caa]">
            planned
          </p>
        </div>

        <div className="px-2">
          <p className="text-[20px] font-black text-[#273044]">
            {doneMinutes}
          </p>
          <p className="mt-1 text-[9px] font-semibold text-[#969caa]">
            min done
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-[12px] bg-white px-3 py-2.5 text-[10px]">
        <span className="inline-flex items-center gap-1.5 text-[#7b838f]">
          <Clock3 size={13} />
          Planned
        </span>

        <strong className="text-[#3f4658]">
          {planned} min
        </strong>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   page                                     */
/* -------------------------------------------------------------------------- */

export default function VisualTimeline() {
  const [view, setView] = useState("day");
  const [density, setDensity] =
    useState("comfortable");

  const { user } = useAuth();
  const context = useContextStateOptional()?.context ?? null;
  const adaptation = useFeatureAdaptation("support.visual_timeline", {
    getAppSnapshot: () => context,
    userId: user?.id ?? null,
  });
  const adaptiveConfig = adaptation.configuration;
  const effectiveDensity = adaptiveConfig?.densityReduced
    ? "compact"
    : density;

  const [blocks, setBlocks] = useState(
    samples.map((block) => ({
      ...block,
      done: false,
      started: false,
    })),
  );

  const [dump, setDump] = useState([
    {
      id: "b1",
      text: "Buy groceries",
    },
    {
      id: "b2",
      text: "Email prof about project",
    },
  ]);

  const [entry, setEntry] = useState("");
  const [dumpEntry, setDumpEntry] =
    useState("");

  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("12:30");

  const id = useRef(100);

  const now =
    new Date().getHours() * 60 +
    new Date().getMinutes();

  const sortedBlocks = useMemo(
    () =>
      [...blocks].sort(
        (a, b) => toMinutes(a.start) - toMinutes(b.start),
      ),
    [blocks],
  );

  const update = (blockId, patch) =>
    setBlocks((items) =>
      items.map((block) =>
        block.id === blockId
          ? {
              ...block,
              ...patch,
            }
          : block,
      ),
    );

  const snooze = (blockId) =>
    setBlocks((items) =>
      items.map((block) =>
        block.id === blockId
          ? {
              ...block,
              start: toTime(
                toMinutes(block.start) + 10,
              ),
              end: toTime(
                toMinutes(block.end) + 10,
              ),
            }
          : block,
      ),
    );

  const completed = blocks.filter(
    (block) => block.done,
  ).length;

  const planned = blocks.reduce(
    (total, block) =>
      total +
      toMinutes(block.end) -
      toMinutes(block.start),
    0,
  );

  const doneMinutes = blocks
    .filter((block) => block.done)
    .reduce(
      (total, block) =>
        total +
        toMinutes(block.end) -
        toMinutes(block.start),
      0,
    );

  const completion = blocks.length
    ? Math.round(
        (completed / blocks.length) * 100,
      )
    : 0;

  const week = useMemo(
    () =>
      Array.from(
        {
          length: 7,
        },
        (_, index) => {
          const date = new Date();

          date.setDate(
            date.getDate() -
              ((date.getDay() + 6) % 7) +
              index,
          );

          return {
            key: todayKey(date),
            label: date.toLocaleDateString(
              undefined,
              {
                weekday: "short",
                day: "numeric",
              },
            ),
          };
        },
      ),
    [],
  );

  const addBlock = (event) => {
    event.preventDefault();

    if (!entry.trim()) return;

    setBlocks((items) => [
      ...items,
      {
        id: ++id.current,
        label: entry.trim(),
        start,
        end,
        category: "study",
        done: false,
        started: false,
      },
    ]);

    setEntry("");
  };

  const addPreset = (type) => {
    if (type === "morning") {
      setBlocks((items) => [
        ...items,
        {
          id: ++id.current,
          label: "Morning routine",
          start: "07:00",
          end: "08:00",
          category: "morning",
          done: false,
          started: false,
        },
      ]);
    } else {
      setBlocks((items) => [
        ...items,
        {
          id: ++id.current,
          label: "Focus block",
          start: "09:00",
          end: "10:00",
          category: "study",
          done: false,
          started: false,
        },
      ]);
    }
  };

  return (
    <SupportToolThemeProvider theme="adhd_focus">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="min-h-screen w-full bg-[#fdfcf8] text-[#171d2f]">
          <div className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">

            {/* ============================================================ */}
            {/* HERO                                                         */}
            {/* ============================================================ */}

            <header className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.17em] text-[#8a6b13]">
                  <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#fff0b5] text-[#d39e00]">
                    <Zap
                      size={14}
                      fill="currentColor"
                    />
                  </span>
                  Time made visible
                </p>

                <h1 className="mt-3 text-[40px] font-black leading-[1] tracking-[-0.055em] text-[#161d30] sm:text-[48px]">
                  Your day,
                  <span className="text-[#7854d9]">
                    {" "}
                    at a glance.
                  </span>
                </h1>

                <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-[#6b7283]">
                  Give each task a visible place. Then
                  focus only on the block in front of you.
                </p>
              </div>

              <div className="hidden items-center gap-5 lg:flex">
                <TimelineHeroVisual />

                <div className="h-[74px] border-l border-[#e6e2e9]" />

                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#a0a3ad]">
                    Right now
                  </p>

                  <p className="mt-1 text-[29px] font-black tracking-[-.04em] text-[#20263a]">
                    {toTime(now)}
                  </p>

                  <p className="mt-1 text-[10px] font-semibold text-[#778071]">
                    One thing at a time.
                  </p>
                </div>
              </div>
            </header>

            {/* ============================================================ */}
            {/* NAV + PRESETS                                                */}
            {/* ============================================================ */}

            <section className="mt-7 flex flex-wrap items-center justify-between gap-4 border-y border-[#ece9e4] py-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView("day")}
                  className={`min-h-[38px] rounded-[12px] px-4 text-[11px] font-black ${
                    view === "day"
                      ? "bg-[#22283a] text-white"
                      : "text-[#818694] hover:bg-white"
                  }`}
                >
                  Today
                </button>

                <button
                  onClick={() => setView("week")}
                  className={`min-h-[38px] rounded-[12px] px-4 text-[11px] font-black ${
                    view === "week"
                      ? "bg-[#22283a] text-white"
                      : "text-[#818694] hover:bg-white"
                  }`}
                >
                  Week
                </button>
              </div>

              {view === "day" && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[9px] font-black uppercase tracking-[.12em] text-[#a5a8b1]">
                    Quick add
                  </span>

                  <button
                    onClick={() =>
                      addPreset("morning")
                    }
                    className="inline-flex h-[36px] items-center gap-1.5 rounded-full border border-[#ead99f] bg-[#fffdf4] px-3 text-[10px] font-black text-[#6e5c24]"
                  >
                    <Sun size={13} />
                    Morning
                  </button>

                  <button
                    onClick={() =>
                      addPreset("study")
                    }
                    className="inline-flex h-[36px] items-center gap-1.5 rounded-full border border-[#ddd0f7] bg-[#fbf9ff] px-3 text-[10px] font-black text-[#6649aa]"
                  >
                    <Target size={13} />
                    Focus
                  </button>

                  <select
                    value={effectiveDensity}
                    onChange={(event) =>
                      setDensity(event.target.value)
                    }
                    aria-label="Timeline density"
                    className="ml-2 h-[36px] rounded-full border border-[#e1dfe5] bg-white px-3 text-[10px] font-bold text-[#737987]"
                  >
                    <option value="comfortable">
                      🙂 Comfortable
                    </option>
                    <option value="compact">
                      Compact
                    </option>
                  </select>
                </div>
              )}
            </section>

            {view === "week" ? (
              /* ========================================================== */
              /* WEEK                                                       */
              /* ========================================================== */

              <section className="mt-7">
                <div>
                  <h2 className="text-[20px] font-black">
                    Week at a glance
                  </h2>

                  <p className="mt-1 text-[11px] text-[#8d929f]">
                    A lightweight capacity view.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                  {week.map((day) => {
                    const today =
                      day.key === todayKey();

                    return (
                      <div
                        key={day.key}
                        className={`rounded-[18px] border p-4 ${
                          today
                            ? "border-[#cfc0ef] bg-[#faf7ff]"
                            : "border-[#e7e5e0] bg-white"
                        }`}
                      >
                        <p
                          className={`text-[10px] font-black ${
                            today
                              ? "text-[#7555bc]"
                              : "text-[#8b909d]"
                          }`}
                        >
                          {day.label}
                        </p>

                        <p className="mt-6 text-[30px] font-black tracking-[-.04em] text-[#242b3f]">
                          {today
                            ? blocks.length
                            : 0}
                        </p>

                        <p className="mt-1 text-[9px] font-semibold text-[#a1a5af]">
                          blocks planned
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <>
                {/* ======================================================== */}
                {/* ADD BAR                                                  */}
                {/* ======================================================== */}

                {adaptiveConfig?.active && (
                  <section className="mt-6">
                    <div className="rounded-[18px] border border-[#e6ddf7] bg-[#faf7ff] px-4 py-3 text-[11px] leading-relaxed">
                      <p className="font-black text-[#6b4fc0]">
                        Adapted for you:{" "}
                        {adaptiveConfig.mode === "reduced_density"
                          ? "lower visual density"
                          : adaptiveConfig.mode === "calm_layout"
                          ? "a calmer layout, one thing at a time"
                          : "a gentler day view"}
                      </p>
                      {adaptation.reason && (
                        <p className="mt-0.5 text-[#8b7cb9]">
                          {adaptation.reason}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                <section className="mt-6">
                  <AddBlockBar
                    entry={entry}
                    setEntry={setEntry}
                    start={start}
                    setStart={setStart}
                    end={end}
                    setEnd={setEnd}
                    onSubmit={addBlock}
                  />
                </section>

                {/* ======================================================== */}
                {/* MAIN WORKSPACE                                           */}
                {/* ======================================================== */}

                <section className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">

                  {/* TIMELINE */}
                  <div>
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h2 className="text-[18px] font-black tracking-[-.02em]">
                          Today&apos;s timeline
                        </h2>

                        <p className="mt-1 text-[10px] text-[#989ca7]">
                          {blocks.length} blocks ·{" "}
                          {planned} minutes planned
                        </p>
                      </div>

                      <ListTodo
                        size={19}
                        className="text-[#a7a3b3]"
                      />
                    </div>

                    <div
                      className={
                        effectiveDensity === "compact"
                          ? "space-y-1"
                          : "space-y-2"
                      }
                    >
                      {sortedBlocks.map((block) => (
                        <TimelineBlock
                          key={block.id}
                          block={block}
                          now={now}
                          update={update}
                          snooze={snooze}
                          compact={
                            effectiveDensity === "compact"
                          }
                          remove={(blockId) =>
                            setBlocks((items) =>
                              items.filter(
                                (item) =>
                                  item.id !== blockId,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>

                    {blocks.length === 0 && (
                      <div className="rounded-[22px] border border-dashed border-[#dcd9e0] bg-white px-6 py-14 text-center">
                        <Clock3
                          size={25}
                          className="mx-auto text-[#aaa7b1]"
                        />

                        <p className="mt-3 text-[12px] font-bold text-[#737887]">
                          Your timeline is clear.
                        </p>

                        <p className="mt-1 text-[10px] text-[#a1a5ae]">
                          Add only what deserves a place.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* SIDE PANEL */}
                  <aside className="space-y-4 lg:sticky lg:top-6">
                    <Snapshot
                      completion={completion}
                      completed={completed}
                      total={blocks.length}
                      planned={planned}
                      doneMinutes={doneMinutes}
                    />

                    <BrainDump
                      dump={dump}
                      setDump={setDump}
                      dumpEntry={dumpEntry}
                      setDumpEntry={setDumpEntry}
                    />

                    <section className={`relative overflow-hidden rounded-[22px] border ${
                      adaptiveConfig?.calmLayout
                        ? "border-[#cfc0ef] ring-2 ring-[#ddd1ff]"
                        : "border-[#ddd4f3]"
                    } bg-gradient-to-br from-[#fdfbff] via-[#faf7ff] to-[#f5f1ff] p-5`}>
                      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#8b68e8]/10 blur-2xl" />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#ece4ff] text-[#7452d4]"><Sparkles size={17} /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8a72be]">Gentle reminder</p><h3 className="mt-0.5 text-[16px] font-black tracking-[-.025em] text-[#252b3e]">Just the next block.</h3></div></div></div>
                        <p className="mt-4 text-[11px] leading-5 text-[#73788a]">You do not need to finish the whole day right now. Give your attention to what is directly in front of you.</p>
                        <div className="mt-5 rounded-[16px] border border-[#e7e0f5] bg-white/80 p-3.5"><p className="text-[9px] font-black uppercase tracking-[.13em] text-[#aaa0c2]">Up next</p>{(() => { const nextBlock = sortedBlocks.find((block) => !block.done && toMinutes(block.end) > now) || sortedBlocks.find((block) => !block.done); if (!nextBlock) return <div className="mt-2 flex items-center gap-2 text-[12px] font-bold text-[#43835a]"><CheckCircle2 size={15} />Your timeline is clear.</div>; const nextStyle = styles[nextBlock.category] || styles.morning; const NextIcon = nextStyle.Icon; return <div className="mt-2 flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px]" style={{ color: nextStyle.accent, backgroundColor: `${nextStyle.accent}14` }}><NextIcon size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-black text-[#30364a]">{nextBlock.label}</p><p className="mt-0.5 text-[9px] font-semibold text-[#9a9eaa]">{nextBlock.start}-{nextBlock.end}</p></div><ChevronRight size={16} className="shrink-0 text-[#9b86ca]" /></div>; })()}</div>
                        <p className="mt-4 text-[10px] font-semibold italic text-[#8b819d]">Progress counts even when the day is imperfect.</p>
                      </div>
                    </section>
                  </aside>
                </section>
              </>
            )}
          </div>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}

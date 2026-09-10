import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  getGardenState,
  fetchGardenStateAsync,
  advanceGardenDays,
  resetGardenState,
  getGrowthStageTitle,
} from "@/stores/gardenStore";
import TreeVisualization from "@/components/garden/TreeVisualization";
import GardenHistory from "@/components/garden/GardenHistory";
import FeatureSpotlightCard from "@/components/dashboard/FeatureSpotlightCard";
import { composeHomeModules } from "@/data/modulesRegistry";
import { getTopUsedModules } from "@/lib/moduleUsage";
import { getModeKeyForRoute, modeStyles } from "@/lib/moduleColor";
import { recordWellbeingInteraction, WELLBEING_INTERACTION_TYPES } from "@/services/wellbeingService";
import { contextEventBus } from "@/adaptive/context/events/contextEventBus";
import {
  Sprout,
  Leaf,
  Flower2,
  Sparkles,
  ArrowRight,
  Heart,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GardenPage() {
  const navigate = useNavigate();
  const { user, enabledModules, enabledFeatures } = useAuth();
  const userId = user?.id || "default";
  const userName = user?.name ? user.name.split(" ")[0] : "Friend";

  const [garden, setGarden] = useState(() => getGardenState(userId));
  const [isLoading, setIsLoading] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Every enabled tool, deterministically composed — same list Home used to
  // show in full. We only spotlight the top two; the rest stay reachable as
  // compact links below, never hidden.
  const allModules = useMemo(
    () => composeHomeModules([...enabledModules, ...enabledFeatures]),
    [enabledModules, enabledFeatures],
  );

  const spotlightModules = useMemo(() => {
    if (allModules.length === 0) return [];
    const ranked = getTopUsedModules(allModules.map((m) => m.id), 2);
    return ranked
      .map(({ id, reason }) => {
        const module = allModules.find((m) => m.id === id);
        return module ? { ...module, reason } : null;
      })
      .filter(Boolean);
  }, [allModules]);

  const remainingModules = useMemo(
    () => allModules.filter((m) => !spotlightModules.some((s) => s.id === m.id)),
    [allModules, spotlightModules],
  );

  useEffect(() => {
    let active = true;
    setGarden(getGardenState(userId));

    setIsLoading(true);
    fetchGardenStateAsync(userId)
      .then((remoteState) => {
        if (active && remoteState) {
          setGarden(remoteState);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const unsub = contextEventBus.subscribe("WELLBEING_INTERACTION_RECORDED", () => {
      setGarden(getGardenState(userId));
    });

    return () => {
      active = false;
      if (typeof unsub === "function") unsub();
    };
  }, [userId]);

  function handleLogActivity() {
    // Record a meaningful self-care interaction using the centralized wellbeing service
    const result = recordWellbeingInteraction({
      userId,
      interactionType: WELLBEING_INTERACTION_TYPES.SELF_CARE_ACTION,
      source: "wellbeing_garden_cta",
      metadata: { action: "nurture_checkin" },
    });

    setGarden(result.gardenState || getGardenState(userId));
    setFeedbackToast(
      result.contributedToGrowth
        ? "Garden nourished for today! 🌱"
        : "You've already nourished your tree today! Every step counts."
    );

    setTimeout(() => {
      setFeedbackToast(null);
    }, 3000);
  }

  function handleAdvanceDayDev() {
    const updated = advanceGardenDays(userId, 1);
    setGarden(updated);
  }

  function handleAdvanceSeasonDev() {
    const updated = advanceGardenDays(userId, 30);
    setGarden(updated);
  }

  function handleResetDev() {
    const reset = resetGardenState(userId);
    setGarden(reset);
  }

  const seasonProgressPercent = Math.min(100, Math.round((garden.currentDayInSeason / 30) * 100));
  const daysRemaining = Math.max(0, 30 - garden.currentDayInSeason);

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 md:py-6 space-y-6 md:space-y-8 select-none">
      {/* ── Top Header Section ─────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#163323] dark:text-emerald-50">
              Good morning, {userName}
            </h1>
            <span className="inline-flex text-emerald-600 dark:text-emerald-400">
              <Sprout className="w-6 h-6" />
            </span>
          </div>
          <p className="text-sm text-[#4b725c] dark:text-emerald-300/80 mt-1">
            Every step you take is care for a brighter tomorrow.
          </p>
        </div>

        {/* Reassuring Pill Badge */}
        <div className="self-start sm:self-auto bg-[#edf7f0] dark:bg-emerald-950/70 border border-[#d2ebd9] dark:border-emerald-800/50 px-4 py-2 rounded-full flex items-center gap-2 text-xs font-medium text-[#2d5e45] dark:text-emerald-300 shadow-sm">
          <span>&ldquo;Progress, not perfection.&rdquo;</span>
          <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        </div>
      </header>

      {/* ── Main Garden Centerpiece (2-Column Grid) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* ── Left Column: Large Centered Tree Centerpiece ── */}
        <div className="lg:col-span-7 bg-[#fbfdfc] dark:bg-[#14261c]/80 border border-[#e4ede6] dark:border-emerald-800/40 rounded-[32px] p-6 sm:p-8 flex flex-col items-center justify-between min-h-[420px] shadow-[0_2px_16px_rgba(45,94,69,0.03)] relative overflow-hidden">
          {/* Subtle natural ambient background glow */}
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-100/40 dark:bg-emerald-900/15 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full flex-1 flex items-center justify-center relative z-10 py-2">
            <TreeVisualization
              leaves={garden.leaves}
              flowers={garden.flowers}
              dayInSeason={garden.currentDayInSeason}
              season={garden.season}
            />
          </div>

          {/* Under-Tree Message Capsule */}
          <div className="relative z-10 mt-4 bg-white/95 dark:bg-[#1c3326]/95 border border-[#d8eae0] dark:border-emerald-700/40 px-5 py-2 rounded-full shadow-sm flex items-center gap-2 text-xs font-medium text-[#2d5e45] dark:text-emerald-200">
            <Sprout className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>Your garden is growing with you.</span>
          </div>
        </div>

        {/* ── Right Column: Info Panel, Metrics & CTA ── */}
        <div className="lg:col-span-5 bg-white/95 dark:bg-[#16291e]/90 border border-[#e4ede6] dark:border-emerald-800/40 rounded-[32px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_2px_16px_rgba(45,94,69,0.03)] space-y-6">
          {/* Progress Header & Bar */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-base sm:text-lg font-bold text-[#163323] dark:text-emerald-100">
                Day {garden.currentDayInSeason} of 30
              </span>
              <span className="text-xs font-semibold text-[#3b7a57] dark:text-emerald-400">
                {seasonProgressPercent}%
              </span>
            </div>

            {/* Restrained Calm Progress Track */}
            <div
              role="progressbar"
              aria-valuenow={seasonProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Season ${garden.season} progress: ${seasonProgressPercent}% completed`}
              className="w-full h-3 bg-[#e8f2ec] dark:bg-emerald-950/80 rounded-full overflow-hidden p-0.5"
            >
              <motion.div
                className="h-full rounded-full bg-[#438865] dark:bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${seasonProgressPercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Compact 3-Pill Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Leaves Metric */}
            <div className="bg-[#f7faf8] dark:bg-[#1a3124]/70 border border-[#e4ede6] dark:border-emerald-800/30 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="w-7 h-7 rounded-xl bg-[#edf7f0] dark:bg-emerald-900/50 flex items-center justify-center text-[#3b7a57] dark:text-emerald-300 mb-2">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl font-black text-[#163323] dark:text-emerald-100 leading-tight">
                  {garden.leaves}
                </div>
                <div className="text-[11px] font-bold text-[#2d5e45] dark:text-emerald-300">
                  Leaves
                </div>
                <div className="text-[10px] text-[#638774] dark:text-emerald-400/70 truncate">
                  Growing steadily
                </div>
              </div>
            </div>

            {/* Flowers Metric */}
            <div className="bg-[#fdf8fa] dark:bg-[#281d24]/60 border border-[#f5e4ec] dark:border-pink-900/30 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="w-7 h-7 rounded-xl bg-[#fce7f3] dark:bg-pink-950/60 flex items-center justify-center text-[#db2777] dark:text-pink-300 mb-2">
                <Flower2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl font-black text-[#831843] dark:text-pink-100 leading-tight">
                  {garden.flowers}
                </div>
                <div className="text-[11px] font-bold text-[#9d174d] dark:text-pink-300">
                  Flowers
                </div>
                <div className="text-[10px] text-[#9f617b] dark:text-pink-400/70 truncate">
                  {garden.flowers > 0 ? "A new bloom" : "Blooms every 7d"}
                </div>
              </div>
            </div>

            {/* Season Metric */}
            <div className="bg-[#fbf9f5] dark:bg-[#292318]/60 border border-[#f0e8dc] dark:border-amber-900/30 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="w-7 h-7 rounded-xl bg-[#fef3c7] dark:bg-amber-950/60 flex items-center justify-center text-[#d97706] dark:text-amber-300 mb-2">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xl font-black text-[#78350f] dark:text-amber-100 leading-tight">
                  S{garden.season}
                </div>
                <div className="text-[11px] font-bold text-[#92400e] dark:text-amber-300">
                  Season {garden.season}
                </div>
                <div className="text-[10px] text-[#927252] dark:text-amber-400/70 truncate">
                  {daysRemaining} {daysRemaining === 1 ? "day to go" : "days to go"}
                </div>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="space-y-3">
            <button
              onClick={handleLogActivity}
              className="w-full bg-[#3b7a57] hover:bg-[#326749] text-white font-semibold py-3.5 px-5 rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 text-sm group focus:outline-none focus:ring-2 focus:ring-[#3b7a57] focus:ring-offset-2"
            >
              <Sprout className="w-4 h-4 text-emerald-200" />
              <span>Log a Wellbeing Activity</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Toast Feedback */}
            <AnimatePresence>
              {feedbackToast && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-2.5 rounded-xl bg-[#edf7f0] border border-[#cbe0d3] text-xs font-medium text-[#2d5e45] text-center flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{feedbackToast}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Encouragement Card (Subtle & Calming) */}
          <div className="bg-[#f7faf8] dark:bg-[#14241b]/60 border border-[#e4ede6] dark:border-emerald-800/30 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#edf7f0] dark:bg-emerald-900/50 flex items-center justify-center text-[#3b7a57] dark:text-emerald-300 flex-shrink-0">
              <Sprout className="w-4 h-4" />
            </div>
            <div className="text-xs text-[#355c47] dark:text-emerald-300 leading-snug">
              <p className="font-semibold">Even a small step counts.</p>
              <p className="text-[#597e6b] dark:text-emerald-400/80 text-[11px]">You don&apos;t have to be perfect.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Spotlighted Tools (top 2, picked from what you actually use) ── */}
      {allModules.length === 0 ? (
        <section className="rounded-[28px] border border-[#e4ede6] dark:border-emerald-800/40 bg-[#fbfdfc] dark:bg-[#14261c]/80 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#163323] dark:text-emerald-50">No tools enabled yet</p>
            <p className="text-sm text-[#4b725c] dark:text-emerald-300/80 mt-1">
              Complete onboarding to build your toolkit — your garden will still grow while you do.
            </p>
          </div>
          <Link
            to="/onboarding/disorders"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[#3b7a57] hover:bg-[#326749] shadow-sm hover:shadow transition-all flex-shrink-0"
          >
            Start onboarding <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      ) : (
        <section aria-labelledby="spotlight-heading">
          <p id="spotlight-heading" className="text-xs font-bold uppercase tracking-wider text-[#638774] dark:text-emerald-400/70 mb-3">
            Your tools right now
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {spotlightModules.map((module, index) => (
              <FeatureSpotlightCard
                key={module.id}
                title={module.title}
                description={module.description}
                icon={module.icon}
                launchRoute={module.launchRoute}
                reason={module.reason}
                index={index}
              />
            ))}
          </div>

          {remainingModules.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {remainingModules.map((module) => {
                const c = modeStyles(getModeKeyForRoute(module.launchRoute));
                return (
                  <Link
                    key={module.id}
                    to={module.launchRoute}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm hover:shadow transition-all hover:-translate-y-0.5"
                    style={{ ...c.bgSofter, ...c.borderSoft, ...c.text }}
                  >
                    {module.title}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Garden History Gallery Section ─────── */}
      <GardenHistory history={garden.history} />

      {/* ── Development Simulation Controls (Isolated from production UX) ── */}
      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowDevTools(!showDevTools)}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1.5"
          >
            <span>Developer / Simulation Panel</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDevTools ? "rotate-90" : ""}`} />
          </button>

          {showDevTools && (
            <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={handleAdvanceDayDev}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                +1 Day (Simulate Next Day)
              </button>
              <button
                onClick={handleAdvanceSeasonDev}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                +30 Days (Complete Season)
              </button>
              <button
                onClick={handleResetDev}
                className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Reset Garden State
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

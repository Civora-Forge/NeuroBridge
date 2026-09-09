import React from "react";
import { ArrowRight, Leaf, Flower2, Sparkles, Trees } from "lucide-react";
import { motion } from "framer-motion";

/**
 * GardenHistory Component
 *
 * Renders previous completed 30-day season trees in a clean, minimal card gallery.
 *
 * @param {{ history: Array<{ season: number, completedAt: string, totalEngagementDays: number, totalLeaves: number, totalFlowers: number, stageTitle: string, summary: string }> }} props
 */
export default function GardenHistory({ history = [] }) {
  const hasCompletedSeasons = Array.isArray(history) && history.length > 0;

  return (
    <section aria-labelledby="garden-history-heading" className="w-full mt-10">
      {/* ── Section Header ──────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2
            id="garden-history-heading"
            className="text-xl font-bold tracking-tight text-[#1e3a2b] dark:text-emerald-100 flex items-center gap-2"
          >
            Your Garden History
          </h2>
          <p className="text-xs text-[#527964] dark:text-emerald-300/80 mt-0.5">
            A look at the seasons you've grown through.
          </p>
        </div>

        {hasCompletedSeasons && (
          <span className="text-xs font-medium text-[#3b7a57] dark:text-emerald-400 bg-[#edf7f0] dark:bg-emerald-950/60 border border-[#d2ebd9] dark:border-emerald-800/40 px-3 py-1 rounded-full">
            {history.length} {history.length === 1 ? "Season" : "Seasons"} Completed
          </span>
        )}
      </div>

      {/* ── Seasons Horizontal Grid ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasCompletedSeasons ? (
          history.map((item, index) => {
            const dateStr = item.completedAt
              ? new Date(item.completedAt).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })
              : `Season ${item.season}`;

            return (
              <motion.div
                key={`season-card-${item.season}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="bg-white/95 dark:bg-[#1a2e22]/90 border border-[#e4ede6] dark:border-emerald-800/40 rounded-3xl p-4 shadow-sm hover:border-[#b8dbc3] dark:hover:border-emerald-600/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-xs font-bold text-[#2d5e45] dark:text-emerald-200 mb-2">
                    {dateStr}
                  </h3>

                  {/* Mini Tree Illustration Preview */}
                  <div className="w-full h-28 rounded-2xl bg-gradient-to-b from-[#f2f8f4] to-[#e4f1e8] dark:from-[#16271c] dark:to-[#1a2f23] border border-[#dcebe0]/80 dark:border-emerald-900/40 flex items-center justify-center p-2 mb-3 relative overflow-hidden">
                    <svg viewBox="0 0 100 90" className="w-20 h-auto">
                      {/* Base Mound */}
                      <ellipse cx="50" cy="80" rx="35" ry="7" fill="#694b37" opacity="0.6" />
                      <ellipse cx="50" cy="78" rx="28" ry="4" fill="#a7d4b4" opacity="0.7" />
                      {/* Trunk */}
                      <path
                        d="M47 80 C48 65 46 55 50 40 C54 55 52 65 53 80 Z"
                        fill="#7a5840"
                      />
                      {/* Branches */}
                      <path d="M49 60 Q40 50 35 44 M51 58 Q60 48 65 42" stroke="#7a5840" strokeWidth="2.5" strokeLinecap="round" />
                      {/* Leaf Foliage Circles */}
                      <circle cx="50" cy="36" r="14" fill="#3b7a57" />
                      <circle cx="38" cy="42" r="11" fill="#4d966d" />
                      <circle cx="62" cy="40" r="11" fill="#4d966d" />
                      <circle cx="50" cy="28" r="9" fill="#5fae80" />
                      {/* Blossom Dots */}
                      {item.totalFlowers > 0 && (
                        <>
                          <circle cx="42" cy="38" r="2.8" fill="#f472b6" />
                          <circle cx="58" cy="35" r="2.8" fill="#f472b6" />
                          <circle cx="50" cy="26" r="2.5" fill="#f472b6" />
                        </>
                      )}
                    </svg>
                  </div>
                </div>

                {/* Metrics Badges */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[#2d5e45] dark:text-emerald-300">
                    <Leaf className="w-3 h-3 text-[#3b7a57]" />
                    <span>{item.totalLeaves || 6}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[#be185d] dark:text-pink-300">
                    <Flower2 className="w-3 h-3 text-[#ec4899]" />
                    <span>{item.totalFlowers || 0}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[#92400e] dark:text-amber-300">
                    <Sparkles className="w-3 h-3 text-[#d97706]" />
                    <span>S{item.season}</span>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : null}

        {/* ── Empty State / Upcoming Season Placeholder ── */}
        <div className="bg-[#fafcfb] dark:bg-[#15241b]/60 border border-dashed border-[#cbe0d3] dark:border-emerald-800/40 rounded-3xl p-6 flex flex-col items-center justify-center text-center min-h-[180px]">
          <div className="w-10 h-10 rounded-full bg-[#edf7f0] dark:bg-emerald-950/80 border border-[#d2ebd9] dark:border-emerald-800/50 flex items-center justify-center mb-3 text-[#3b7a57] dark:text-emerald-300">
            <Trees className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-[#1e3a2b] dark:text-emerald-200">
            {hasCompletedSeasons ? "A new season awaits..." : "Your first season is still growing."}
          </p>
          <p className="text-[11px] text-[#527964] dark:text-emerald-400/80 mt-1 max-w-[150px]">
            {hasCompletedSeasons ? "Keep caring for your current tree." : "Completed 30-day trees will be preserved here."}
          </p>
        </div>
      </div>
    </section>
  );
}

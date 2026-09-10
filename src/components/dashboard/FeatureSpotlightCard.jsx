import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Clock, Timer, Brain, Activity, Leaf, BookOpen, Calculator, Shield,
  Hand, Ear, Zap, Headphones, Mic, PenTool, User, Map, BarChart2, Wind,
  Smile, MessageCircle, MessagesSquare, TrendingUp, Layers, BookOpenText,
  ArrowUpRight,
} from "lucide-react";
import { getModeKeyForRoute, modeStyles } from "@/lib/moduleColor";

const ICONS = {
  Clock, Timer, Brain, Activity, Leaf, BookOpen, Calculator, Shield,
  Hand, Ear, Zap, Headphones, Mic, PenTool, User, Map, BarChart2, Wind,
  Smile, MessageCircle, MessagesSquare, TrendingUp, Layers, BookOpenText,
};

// A small warm accent per support area — paired with the lucide icon, never
// used alone, so recognition doesn't depend on reading the card's text.
const EMOJI_BY_MODE = {
  adhd: "⚡", dyslexia: "📖", dyscalculia: "🔢", ocd: "🔄",
  dyspraxia: "🤸", apd: "🎧", anxiety: "💨", depression: "🌤️", asd: "🌿",
};

/**
 * A single spotlighted tool on the dashboard. Icon-first, one short line of
 * text, and a plain-language "why you're seeing this" chip — built for a
 * glance, not a read.
 */
export default function FeatureSpotlightCard({ title, description, icon = "Activity", launchRoute = "/", reason, index = 0 }) {
  const Icon = ICONS[icon] || Activity;
  const modeKey = getModeKeyForRoute(launchRoute);
  const c = modeStyles(modeKey);
  const emoji = EMOJI_BY_MODE[modeKey] || "✨";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
    >
      <Link
        to={launchRoute}
        aria-label={`Open ${title}`}
        className="group relative flex flex-col gap-4 rounded-[28px] border bg-card p-6 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{ ...c.borderSoft, "--tw-ring-color": `hsl(var(--mode-${modeKey}))` }}
      >
        {/* Ambient color wash — decorative, never the only signal */}
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-60 group-hover:scale-110 transition-transform duration-500 pointer-events-none"
          style={c.bgSofter}
          aria-hidden="true"
        />

        {reason && (
          <span
            className="relative z-10 self-start text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
            style={{ ...c.bgSoft, ...c.text }}
          >
            {reason}
          </span>
        )}

        <div className="relative z-10 flex items-center gap-4">
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={c.bg}
          >
            <Icon className="w-8 h-8 text-white" aria-hidden="true" strokeWidth={2.25} />
            <span
              className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white dark:bg-card border-2 flex items-center justify-center text-sm shadow-sm"
              style={c.borderSoft}
              aria-hidden="true"
            >
              {emoji}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-lg text-foreground leading-tight">{title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug line-clamp-2">{description}</p>
          </div>
        </div>

        <div
          className="relative z-10 mt-auto inline-flex items-center gap-1.5 self-start rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform group-hover:translate-x-0.5"
          style={c.bg}
        >
          Open now
          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
        </div>
      </Link>
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock3, Heart, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_TONE, CATEGORY_EMOJI, toneFor } from "./tones";

export default function ScenarioCard({
  scenario,
  isFavorite = false,
  onToggleFavorite,
  onSelect,
  hasSavedSession = false,
  largeText = false,
}) {
  const tone = toneFor(scenario);
  const difficulty = DIFFICULTY_TONE[scenario.difficulty] ?? DIFFICULTY_TONE.easy;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className={cn(
        "group relative flex flex-col rounded-2xl border-2 p-5 gap-3 overflow-hidden",
        "bg-white shadow-sm transition-shadow hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]",
        tone.border,
      )}
    >
      <div className={cn("absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity", tone.bg)} />

      <div className="flex items-start justify-between gap-2 relative">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-2xl border", tone.bg, tone.border)}>
          {CATEGORY_EMOJI[scenario.category] ?? "🗣️"}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8 text-rose-400 hover:text-rose-500 hover:bg-rose-50"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite?.(scenario.id);
          }}
        >
          <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </Button>
      </div>

      <div className="relative">
        <h3 className={cn("font-bold text-slate-900", largeText ? "text-xl" : "text-base")}>{scenario.title}</h3>
        <p className={cn("text-slate-500 mt-1", largeText ? "text-base" : "text-sm")}>{scenario.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 relative">
        <Badge className={cn("border-transparent", difficulty.badge)}>{difficulty.label}</Badge>
        <span className={cn("inline-flex items-center gap-1 text-xs text-slate-400", largeText && "text-sm")}>
          <Clock3 className="h-3.5 w-3.5" /> ~{scenario.estimatedDurationMinutes} min
        </span>
        <span className={cn("inline-flex items-center gap-1 text-xs text-slate-400", largeText && "text-sm")}>
          <Layers className="h-3.5 w-3.5" /> {scenario.moments?.length ?? 0} steps
        </span>
      </div>

      <div className="mt-auto pt-1 relative">
        {hasSavedSession ? (
          <Button className={cn("w-full text-white", "bg-amber-500 hover:bg-amber-600")} onClick={() => onSelect(scenario.id)}>
            Continue in progress…
          </Button>
        ) : (
          <Button className={cn("w-full text-white", tone.button)} onClick={() => onSelect(scenario.id)}>
            Start practicing
          </Button>
        )}
      </div>
    </motion.article>
  );
}

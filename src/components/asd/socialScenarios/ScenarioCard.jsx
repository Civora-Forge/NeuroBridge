import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Clock, Heart, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const DIFFICULTY_TONE = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

export default function ScenarioCard({
  scenario,
  isFavorite = false,
  onToggleFavorite,
  onSelect,
  hasSavedSession = false,
  largeText = false,
}) {
  return (
    <Card
      className={cn(
        "flex flex-col bg-white border-green-100 hover:border-green-300 hover:shadow-[0_8px_24px_rgba(34,197,94,0.12)] transition-all",
        largeText && "text-lg",
      )}
    >
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className={cn("font-bold text-slate-900", largeText ? "text-xl" : "text-base")}>
              {scenario.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{scenario.description}</p>
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border-transparent", DIFFICULTY_TONE[scenario.difficulty] ?? "bg-slate-100 text-slate-600")}>
            {scenario.difficulty}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" /> ~{scenario.estimatedDurationMinutes} min
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <MessageSquare className="h-3.5 w-3.5" /> {scenario.moments?.length ?? 0} moments
          </span>
        </div>
      </CardContent>
      <CardFooter className="mt-auto pt-2">
        {hasSavedSession ? (
          <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={() => onSelect(scenario)}>
            Continue in progress…
          </Button>
        ) : (
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => onSelect(scenario)}>
            Start practicing
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { History, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCENARIO_CATEGORIES } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import CategoryFilter from "./CategoryFilter";
import DifficultySelector from "./DifficultySelector";
import ScenarioCard from "./ScenarioCard";
import { StatsRow } from "./HistoryPanel";

export default function Dashboard({
  stats,
  scenarios,
  category,
  onCategoryChange,
  difficulty,
  onDifficultyChange,
  favorites,
  onToggleFavorite,
  onSelectScenario,
  savedScenario,
  onResume,
  onOpenHistory,
  largeText = false,
}) {
  return (
    <div className="space-y-6">
      <StatsRow
        completedCount={stats.completedCount}
        averageScore={stats.averageScore}
        streak={stats.streak}
      />

      {savedScenario && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-amber-800">You have a conversation in progress</p>
              <p className="text-sm text-amber-700">
                “{savedScenario.title}” · pick up right where you left off.
              </p>
            </div>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={onResume}>
              <PlayCircle className="h-4 w-4 mr-2" /> Resume
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoryFilter value={category} onChange={onCategoryChange} />
        <div className="flex items-center gap-2">
          <DifficultySelector value={difficulty} onChange={onDifficultyChange} />
          <Button variant="outline" size="sm" onClick={onOpenHistory}>
            <History className="h-4 w-4 mr-2" /> History
          </Button>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <Card className="border-green-100">
          <CardContent className="pt-6 text-center text-sm text-slate-500">
            No scenarios found in this category.
          </CardContent>
        </Card>
      ) : (
        <div className={cn("grid gap-4", largeText ? "sm:grid-cols-1 lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              isFavorite={favorites.includes(scenario.id)}
              hasSavedSession={savedScenario?.id === scenario.id}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelectScenario}
              largeText={largeText}
            />
          ))}
        </div>
      )}
    </div>
  );
}

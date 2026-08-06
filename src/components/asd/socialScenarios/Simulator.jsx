import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
import { useScenarioAdaptation } from "@/hooks/useScenarioAdaptation";
import { useScenarioPractice } from "@/hooks/useScenarioPractice";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { SCENARIO_CATEGORIES } from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import {
  getScenarioById,
  getScenariosByCategory,
} from "@/support/modules/socialScenarioSimulator/scenarioLibrary";
import {
  getAverageScore,
  getCompletedScenarioCount,
  getPracticeStreak,
  getScenarioState,
  loadActiveSession,
  listCompletedSessions,
  toggleFavoriteScenario,
} from "@/support/modules/socialScenarioSimulator/scenarioStore";
import Dashboard from "./Dashboard";
import PracticeScreen from "./PracticeScreen";
import HistoryPanel from "./HistoryPanel";
import AccessibilityControls from "./AccessibilityControls";

const VIEWS = {
  DASHBOARD: "dashboard",
  PRACTICE: "practice",
  HISTORY: "history",
};

export default function Simulator() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [view, setView] = useState(VIEWS.DASHBOARD);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("easy");
  const [stats, setStats] = useState({ completedCount: 0, averageScore: null, streak: null });
  const [favorites, setFavorites] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [adaptationSignals, setAdaptationSignals] = useState(null);

  const accessibility = useAccessibilitySettings(user);
  const scenario = selectedScenarioId ? getScenarioById(selectedScenarioId) : null;

  const practice = useScenarioPractice({
    userId,
    scenario,
    difficulty,
    signals: adaptationSignals,
  });

  const adaptation = useScenarioAdaptation({
    userId,
    user,
    session: practice.session,
    userPreferences: useMemo(() => buildUserPreferencesFragment(user), [user]),
  });

  useEffect(() => {
    setAdaptationSignals(adaptation.signals ?? null);
  }, [adaptation.signals]);

  const refreshStats = useCallback(() => {
    setStats({
      completedCount: getCompletedScenarioCount(userId),
      averageScore: getAverageScore(userId),
      streak: getPracticeStreak(userId),
    });
    setFavorites(getScenarioState(userId).favorites);
    setActiveSession(loadActiveSession(userId));
    setRecentSessions(listCompletedSessions(userId, { limit: 8 }));
  }, [userId]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (practice.report) {
      refreshStats();
    }
  }, [practice.report, refreshStats]);

  const handleSelectScenario = useCallback(
    (nextId) => {
      practice.reset();
      setSelectedScenarioId(nextId);
      setView(VIEWS.PRACTICE);
    },
    [practice],
  );

  const handleBack = useCallback(() => {
    practice.reset();
    setSelectedScenarioId(null);
    setView(VIEWS.DASHBOARD);
    refreshStats();
  }, [practice, refreshStats]);

  const handleResumeFromDashboard = useCallback(() => {
    if (!activeSession) return;
    setSelectedScenarioId(activeSession.scenarioId);
    setView(VIEWS.PRACTICE);
  }, [activeSession]);

  const handleToggleFavorite = useCallback(
    (scenarioId) => {
      if (!userId) return;
      const result = toggleFavoriteScenario(userId, scenarioId);
      setFavorites(result.favorites);
    },
    [userId],
  );

  const savedScenario = activeSession ? getScenarioById(activeSession.scenarioId) : null;

  const scenarios = useMemo(() => {
    if (category === "all") {
      return SCENARIO_CATEGORIES.flatMap(({ id }) => getScenariosByCategory(id));
    }
    return getScenariosByCategory(category);
  }, [category]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black text-slate-900">Social Scenario Simulator</h1>
        <p className="text-sm text-slate-500">
          Practise real conversations in a calm, private space. Pick a scenario, talk to your
          partner, and get gentle feedback that helps you grow.
        </p>
        <AccessibilityControls
          settings={accessibility.settings}
          onToggleLargeText={accessibility.toggleLargeText}
          onToggleReduceMotion={accessibility.toggleReduceMotion}
          onToggleFocusIndicators={accessibility.toggleFocusIndicators}
        />
      </div>

      {view === VIEWS.DASHBOARD && (
        <Dashboard
          stats={stats}
          scenarios={scenarios}
          category={category}
          onCategoryChange={setCategory}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onSelectScenario={handleSelectScenario}
          savedScenario={savedScenario}
          onResume={handleResumeFromDashboard}
          onOpenHistory={() => setView(VIEWS.HISTORY)}
          largeText={accessibility.largeText}
        />
      )}

      {view === VIEWS.PRACTICE && scenario && (
        <PracticeScreen
          scenario={scenario}
          session={practice.session}
          messages={practice.session?.messages ?? []}
          quickReplies={practice.quickReplies}
          isTyping={practice.isTyping}
          error={practice.error}
          progress={practice.progress}
          savedSession={practice.savedSession}
          onResumeSaved={practice.restoreSaved}
          onStart={practice.start}
          onSend={practice.sendMessage}
          onChooseOption={practice.chooseOption}
          onPause={practice.pause}
          onResume={practice.resume}
          onRestart={practice.restart}
          onFinishEarly={practice.finishEarly}
          onExit={practice.exitEarly}
          onBack={handleBack}
          report={practice.report}
          adaptation={adaptation}
          largeText={accessibility.largeText}
          reduceMotion={accessibility.reduceMotion}
        />
      )}

      {view === VIEWS.HISTORY && (
        <HistoryPanel sessions={recentSessions} onBack={() => setView(VIEWS.DASHBOARD)} />
      )}
    </div>
  );
}

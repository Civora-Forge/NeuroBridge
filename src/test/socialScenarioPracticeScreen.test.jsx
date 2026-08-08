import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "@/components/asd/socialScenarios/Dashboard";
import ScenarioCard from "@/components/asd/socialScenarios/ScenarioCard";
import FeedbackPanel from "@/components/asd/socialScenarios/FeedbackPanel";
import PracticeScreen from "@/components/asd/socialScenarios/PracticeScreen";
import { getScenarioById, getScenariosByCategory } from "@/support/modules/socialScenarioSimulator/scenarioLibrary";
import {
  beginScenarioSession,
  createScenarioSession,
} from "@/support/modules/socialScenarioSimulator/scenarioEngineService";

function noop() {}

describe("Social scenario UI smoke tests", () => {
  const scenario = getScenarioById("college.asking-seminar-question");

  it("renders a ScenarioCard", () => {
    render(
      <ScenarioCard scenario={scenario} onToggleFavorite={noop} onSelect={noop} />,
    );
    expect(screen.getByRole("button", { name: /start practicing/i })).toBeTruthy();
    expect(screen.getByText(scenario.title)).toBeTruthy();
  });

  it("renders the Dashboard grid with scenarios", () => {
    render(
      <Dashboard
        stats={{ completedCount: 0, averageScore: null, streak: null }}
        scenarios={getScenariosByCategory("college")}
        category="all"
        onCategoryChange={noop}
        difficulty="easy"
        onDifficultyChange={noop}
        favorites={[]}
        onToggleFavorite={noop}
        onSelectScenario={noop}
        savedScenario={null}
        onResume={noop}
        onOpenHistory={noop}
      />,
    );
    expect(screen.getAllByRole("button", { name: /start practicing/i }).length).toBe(3);
  });

  it("renders FeedbackPanel with a score report", () => {
    render(
      <FeedbackPanel
        report={{
          communicationScore: 72,
          subscores: { clarity: 70, listening: 75, empathy: 70, boundary: 73, rapport: 72 },
          encouragement: "Nice work!",
          strengths: ["You acknowledged the other person."],
          alternatives: ["Try a shorter reply."],
          summary: "Two replies recorded.",
        }}
        scenario={scenario}
        onRestart={noop}
        onBack={noop}
      />,
    );
    expect(screen.getByText(/practice complete/i)).toBeTruthy();
    expect(screen.getByText("72")).toBeTruthy();
  });

  it("renders PracticeScreen intro card for a fresh scenario", () => {
    render(
      <PracticeScreen
        scenario={scenario}
        session={null}
        messages={[]}
        quickReplies={[]}
        isTyping={false}
        error={null}
        progress={{ percent: 0, current: 0, total: scenario.moments.length }}
        savedSession={null}
        onResumeSaved={noop}
        onStart={noop}
        onSend={noop}
        onChooseOption={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onFinishEarly={noop}
        onExit={noop}
        onBack={noop}
        report={null}
        adaptation={{}}
      />,
    );
    expect(screen.getByRole("button", { name: /start conversation/i })).toBeTruthy();
    expect(screen.getByText(scenario.context)).toBeTruthy();
  });

  it("renders an active session with prompt and quick replies", () => {
    const created = createScenarioSession({ scenario, userId: "u", difficulty: "easy" });
    const session = beginScenarioSession(created);
    render(
      <PracticeScreen
        scenario={scenario}
        session={session}
        messages={session.messages}
        quickReplies={session.messages?.length ? ["Yes, I have a question about the reading."] : []}
        isTyping={false}
        error={null}
        progress={{ percent: 33, current: 1, total: 3 }}
        savedSession={null}
        onResumeSaved={noop}
        onStart={noop}
        onSend={noop}
        onChooseOption={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onFinishEarly={noop}
        onExit={noop}
        onBack={noop}
        report={null}
        adaptation={{}}
      />,
    );
    expect(screen.getByText(/your partner says/i)).toBeTruthy();
    expect(screen.getByText("Yes, I have a question about the reading.")).toBeTruthy();
  });
});

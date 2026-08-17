import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ConversationView from "../components/ConversationView";
import { getFallbackScenario } from "../services/scenarioGenerator";
import { SESSION_STATUS, RESPONSE_SOURCE } from "../types/communicationTypes";

function makeEngine(overrides = {}) {
  return {
    view: "conversation",
    busy: false,
    a11y: { largeText: false, reduceMotion: false },
    adaptation: { active: false, signals: {} },
    session: {
      status: SESSION_STATUS.ACTIVE,
      turnCount: 0,
      turnLimit: 8,
      hintsEnabled: false,
      turns: [],
      scenario: getFallbackScenario({ domain: "small_talk", effectiveDifficulty: 3 }),
    },
    submitReply: vi.fn().mockResolvedValue({}),
    endEarly: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

describe("ConversationView", () => {
  it("renders the scenario opening and lets the user type a reply", () => {
    render(<ConversationView engine={makeEngine()} />);
    expect(screen.getByText(/started the conversation/i)).toBeInTheDocument();
    const input = screen.getByLabelText("Your reply");
    fireEvent.change(input, { target: { value: "Hi there!" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("Your reply")).toBeInTheDocument();
  });

  it("submits the typed reply as text on Enter", () => {
    const engine = makeEngine();
    render(<ConversationView engine={engine} />);
    const input = screen.getByLabelText("Your reply");
    fireEvent.change(input, { target: { value: "Hi there!" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(engine.submitReply).toHaveBeenCalledWith("Hi there!", { source: RESPONSE_SOURCE.TEXT });
  });

  it("does not submit empty text", () => {
    const engine = makeEngine();
    render(<ConversationView engine={engine} />);
    const input = screen.getByLabelText("Your reply");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(engine.submitReply).not.toHaveBeenCalled();
  });

  it("renders the exchange history", () => {
    const engine = makeEngine({
      session: {
        ...makeEngine().session,
        turnCount: 1,
        turns: [
          { id: "u1", speaker: "user", text: "Hello!", source: RESPONSE_SOURCE.TEXT, timestamp: "now" },
          { id: "n1", speaker: "npc", text: "Hi! What brings you here?", source: "fallback", timestamp: "now" },
        ],
      },
    });
    render(<ConversationView engine={engine} />);
    expect(screen.getByText("Hello!")).toBeInTheDocument();
    expect(screen.getByText(/Hi! What brings you here?/)).toBeInTheDocument();
  });

  it("offers pause and end-practice controls", () => {
    const engine = makeEngine();
    render(<ConversationView engine={engine} />);
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(engine.pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /end practice/i }));
    expect(engine.endEarly).toHaveBeenCalled();
  });

  it("hides the mic when voice input is unsupported (text fallback always present)", () => {
    render(<ConversationView engine={makeEngine()} />);
    expect(screen.queryByRole("button", { name: /start speaking/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your reply")).toBeInTheDocument();
  });
});

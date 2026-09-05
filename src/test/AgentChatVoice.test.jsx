import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgentChat from "@/components/AgentChat";

// jsdom doesn't implement scrollIntoView — AgentChat calls it on every message-list update.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const sendMessage = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", _supabase: true }, isAuthenticated: true }),
}));

vi.mock("@/stores/agentStore", () => ({
  default: () => ({
    isOpen: true,
    closeChat: vi.fn(),
    toggleChat: vi.fn(),
    messages: [],
    isLoading: false,
    sendMessage,
    error: null,
    clearError: vi.fn(),
    pendingConfirmation: null,
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
  }),
}));

let voiceState;
vi.mock("@/hooks/useAgentVoice", () => ({
  default: () => voiceState,
}));

function resetVoiceState() {
  voiceState = {
    isListening: false,
    transcript: "",
    interimTranscript: "",
    voiceError: null,
    voiceSupported: true,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    cancelListening: vi.fn(),
    isSpeaking: false,
    ttsSupported: true,
    voiceResponsesEnabled: false,
    toggleVoiceResponses: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
  };
}

beforeEach(() => {
  sendMessage.mockClear();
  resetVoiceState();
});

function renderChat() {
  return render(
    <MemoryRouter>
      <AgentChat />
    </MemoryRouter>
  );
}

describe("AgentChat — agent execution after transcription", () => {
  it("automatically sends the transcript to the agent once listening stops", () => {
    const { rerender } = renderChat();

    voiceState = { ...voiceState, isListening: true };
    rerender(
      <MemoryRouter>
        <AgentChat />
      </MemoryRouter>
    );

    voiceState = { ...voiceState, isListening: false, transcript: "start my focus session" };
    rerender(
      <MemoryRouter>
        <AgentChat />
      </MemoryRouter>
    );

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("start my focus session", "user-1");
  });

  it("does not call the agent if listening stops with an empty transcript (silence/cancel)", () => {
    const { rerender } = renderChat();

    voiceState = { ...voiceState, isListening: true };
    rerender(
      <MemoryRouter>
        <AgentChat />
      </MemoryRouter>
    );

    voiceState = { ...voiceState, isListening: false, transcript: "" };
    rerender(
      <MemoryRouter>
        <AgentChat />
      </MemoryRouter>
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("shows the microphone-unsupported state gracefully instead of crashing", () => {
    voiceState = { ...voiceState, voiceSupported: false };
    expect(() => renderChat()).not.toThrow();
  });
});

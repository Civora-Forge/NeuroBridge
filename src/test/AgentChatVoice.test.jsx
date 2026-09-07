import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgentChat from "@/components/AgentChat";

// jsdom doesn't implement scrollIntoView — AgentChat calls it on every message-list update.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const sendMessage = vi.fn();
const abortActiveStream = vi.fn();

let authState;
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState,
}));

let storeMessages = [];
vi.mock("@/stores/agentStore", () => ({
  default: () => ({
    isOpen: true,
    closeChat: vi.fn(),
    toggleChat: vi.fn(),
    messages: storeMessages,
    isLoading: false,
    sendMessage,
    error: null,
    clearError: vi.fn(),
    pendingConfirmation: null,
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
    abortActiveStream,
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
  abortActiveStream.mockClear();
  resetVoiceState();
  storeMessages = [];
  authState = { user: { id: "user-1", _supabase: true }, isAuthenticated: true };
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
    expect(sendMessage).toHaveBeenCalledWith("start my focus session", { id: "user-1", _supabase: true });
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

  it("explains WHY the mic is unavailable in unsupported browsers (e.g. Firefox/Zen), instead of silently hiding it", () => {
    voiceState = { ...voiceState, voiceSupported: false };
    const { getByLabelText, queryByLabelText } = renderChat();
    expect(queryByLabelText("Speak your message")).toBeNull();
    const disabledMic = getByLabelText(/voice input isn't supported in this browser/i);
    expect(disabledMic).toBeDisabled();
  });

  it("does not call the agent if the transcript is whitespace-only", () => {
    const { rerender } = renderChat();
    voiceState = { ...voiceState, isListening: true };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    voiceState = { ...voiceState, isListening: false, transcript: "   " };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends a transcript containing punctuation verbatim, as real natural language — not stripped or matched against a command list", () => {
    const { rerender } = renderChat();
    voiceState = { ...voiceState, isListening: true };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    voiceState = { ...voiceState, isListening: false, transcript: "Can you check what I've been focusing on lately?" };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    expect(sendMessage).toHaveBeenCalledWith("Can you check what I've been focusing on lately?", { id: "user-1", _supabase: true });
  });

  it("sends a long, multi-clause transcript in full, without truncating it before it reaches the agent", () => {
    const longTranscript =
      "I can't start my history assignment, and I also want to check my OCD progress, " +
      "and maybe start a focus session afterwards if I have time, because I've been putting this off for a while.";
    const { rerender } = renderChat();
    voiceState = { ...voiceState, isListening: true };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    voiceState = { ...voiceState, isListening: false, transcript: longTranscript };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    expect(sendMessage).toHaveBeenCalledWith(longTranscript, { id: "user-1", _supabase: true });
  });

  it("sends confirmation-like spoken language ('yes, go ahead') as plain text through the normal pipeline, not as a special voice command", () => {
    const { rerender } = renderChat();
    voiceState = { ...voiceState, isListening: true };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    voiceState = { ...voiceState, isListening: false, transcript: "yes, go ahead" };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    // No special interception: it's just another sendMessage call, exactly like typed text.
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("yes, go ahead", { id: "user-1", _supabase: true });
  });
});

describe("AgentChat — demo mode", () => {
  it("still enables chat input for a demo (non-Supabase) account", () => {
    authState = { user: { id: "nb-user-042", _supabase: false }, isAuthenticated: true };
    const { getByPlaceholderText } = renderChat();
    expect(getByPlaceholderText("How can I help you right now?")).not.toBeDisabled();
  });

  it("shows an informational (non-blocking) demo-mode note, not the sign-in gate", () => {
    authState = { user: { id: "nb-user-042", _supabase: false }, isAuthenticated: true };
    const { getByText, queryByText } = renderChat();
    expect(getByText(/you're in demo mode/i)).toBeTruthy();
    expect(queryByText(/use a demo access account/i)).toBeNull();
  });

  it("blocks and shows the sign-in gate when there is no user at all", () => {
    authState = { user: null, isAuthenticated: false };
    const { getByPlaceholderText, getByText } = renderChat();
    expect(getByPlaceholderText("Sign in to chat with the assistant")).toBeDisabled();
    expect(getByText(/use a demo access account/i)).toBeTruthy();
  });
});

describe("AgentChat — stream cleanup on unmount", () => {
  it("aborts any active stream when the component unmounts", () => {
    const { unmount } = renderChat();
    expect(abortActiveStream).not.toHaveBeenCalled();
    unmount();
    expect(abortActiveStream).toHaveBeenCalledTimes(1);
  });
});

describe("AgentChat — accessible execution status while streaming", () => {
  it("renders the backend-driven status label with aria-live, not raw JSON", () => {
    storeMessages = [
      { id: "s1", role: "user", content: "show my ocd progress" },
      { id: "s2", role: "model", content: "", streaming: true, statusLabel: "Checking your OCD progress", action_payload: null },
    ];
    const { getByText } = renderChat();
    const status = getByText("Checking your OCD progress");
    expect(status.closest('[aria-live="polite"]')).toBeTruthy();
  });

  it("shows finalized content normally once streaming is done, no status label", () => {
    storeMessages = [
      { id: "s2", role: "model", content: "You have 1 exposure hierarchy.", streaming: false, action_payload: null },
    ];
    const { getByText, queryByText } = renderChat();
    expect(getByText("You have 1 exposure hierarchy.")).toBeTruthy();
    expect(queryByText(/checking/i)).toBeNull();
  });
});

describe("AgentChat — text-to-speech reads the real finalized answer, not the empty placeholder", () => {
  it("does not speak while the message is still streaming (empty placeholder), then speaks the real content once finalized", () => {
    voiceState = { ...voiceState, voiceResponsesEnabled: true };
    storeMessages = [
      { id: "u1", role: "user", content: "show my ocd progress" },
      { id: "s2", role: "model", content: "", streaming: true, statusLabel: "Checking your OCD progress", action_payload: null },
    ];
    const { rerender } = renderChat();
    expect(voiceState.speak).not.toHaveBeenCalled();

    // Same array index/message id transitions from streaming placeholder to the real answer.
    storeMessages = [
      { id: "u1", role: "user", content: "show my ocd progress" },
      { id: "s2", role: "model", content: "You have 1 hierarchy.", streaming: false, action_payload: null },
    ];
    rerender(
      <MemoryRouter>
        <AgentChat />
      </MemoryRouter>
    );

    expect(voiceState.speak).toHaveBeenCalledTimes(1);
    expect(voiceState.speak).toHaveBeenCalledWith("You have 1 hierarchy.");
  });

  it("never re-speaks the same finalized message on an unrelated re-render", () => {
    voiceState = { ...voiceState, voiceResponsesEnabled: true };
    storeMessages = [
      { id: "s2", role: "model", content: "Done.", streaming: false, action_payload: null },
    ];
    const { rerender } = renderChat();
    expect(voiceState.speak).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <AgentChat />
      </MemoryRouter>
    );
    expect(voiceState.speak).toHaveBeenCalledTimes(1);
  });
});

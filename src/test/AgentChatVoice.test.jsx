import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgentChat from "@/components/AgentChat";
import { findNavTarget } from "@/lib/findNavTarget";
import focusSessionControlStore from "@/stores/focusSessionControlStore";

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/lib/findNavTarget", () => ({ findNavTarget: vi.fn() }));

// jsdom doesn't implement scrollIntoView — AgentChat calls it on every message-list update.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const sendMessage = vi.fn();
const abortActiveStream = vi.fn();
const confirmPendingAction = vi.fn();
const cancelPendingAction = vi.fn();

let authState;
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState,
}));

let storeMessages = [];
let pendingConfirmationState = null;
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
    pendingConfirmation: pendingConfirmationState,
    confirmPendingAction,
    cancelPendingAction,
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
  confirmPendingAction.mockClear();
  cancelPendingAction.mockClear();
  mockNavigate.mockClear();
  findNavTarget.mockReset();
  resetVoiceState();
  storeMessages = [];
  pendingConfirmationState = null;
  authState = { user: { id: "user-1", _supabase: true }, isAuthenticated: true };
});

function renderChat({ initialPath = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
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

describe("AgentChat — hands-free voice confirmation ('yes'/'no' instead of clicking)", () => {
  it("routes a clear affirmative reply to confirmPendingAction instead of sending a new agent message", () => {
    pendingConfirmationState = { messageIndex: 0, tool_name: "create_exposure", tool_args: {} };
    const { rerender } = renderChat();
    voiceState = { ...voiceState, isListening: true };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);
    voiceState = { ...voiceState, isListening: false, transcript: "yes, do it" };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    expect(confirmPendingAction).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("routes a clear negative reply to cancelPendingAction instead of sending a new agent message", () => {
    pendingConfirmationState = { messageIndex: 0, tool_name: "create_exposure", tool_args: {} };
    const { rerender } = renderChat();
    voiceState = { ...voiceState, isListening: true };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);
    voiceState = { ...voiceState, isListening: false, transcript: "no, cancel that" };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    expect(cancelPendingAction).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("still sends an ambiguous reply as a normal agent message — never silently confirms or cancels", () => {
    pendingConfirmationState = { messageIndex: 0, tool_name: "create_exposure", tool_args: {} };
    const { rerender } = renderChat();
    voiceState = { ...voiceState, isListening: true };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);
    voiceState = { ...voiceState, isListening: false, transcript: "actually make it about door handles instead" };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(confirmPendingAction).not.toHaveBeenCalled();
    expect(cancelPendingAction).not.toHaveBeenCalled();
  });

  it("does not apply the yes/no shortcut when nothing is actually pending confirmation", () => {
    pendingConfirmationState = null;
    const { rerender } = renderChat();
    voiceState = { ...voiceState, isListening: true };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);
    voiceState = { ...voiceState, isListening: false, transcript: "yes" };
    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);

    expect(sendMessage).toHaveBeenCalledWith("yes", { id: "user-1", _supabase: true });
    expect(confirmPendingAction).not.toHaveBeenCalled();
  });
});

describe("AgentChat — cursor-then-navigate for real agent actions (not just a chatbot button)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("glides the cursor to the real on-screen target then navigates, for a finalized NAVIGATE_WITH_DATA action", () => {
    findNavTarget.mockReturnValue({ getBoundingClientRect: () => ({ left: 100, top: 100, width: 20, height: 20 }) });
    storeMessages = [
      {
        id: "m1", role: "model", content: "Here's your focus session.", streaming: false,
        action_payload: { type: "NAVIGATE_WITH_DATA", path: "/adhd/focus", card_type: "FOCUS_SESSION", data: { duration_minutes: 25 } },
      },
    ];
    vi.useFakeTimers();
    renderChat();
    act(() => { vi.advanceTimersByTime(1000); });

    expect(findNavTarget).toHaveBeenCalledWith("/adhd/focus");
    expect(mockNavigate).toHaveBeenCalledWith("/adhd/focus", { state: { duration_minutes: 25 } });
  });

  it("navigates immediately with no animation when the real target isn't on screen — never blocks on it", () => {
    findNavTarget.mockReturnValue(null);
    storeMessages = [
      {
        id: "m1", role: "model", content: "Taking you there.", streaming: false,
        action_payload: { type: "NAVIGATE", path: "/anxiety" },
      },
    ];
    renderChat();

    expect(mockNavigate).toHaveBeenCalledWith("/anxiety", { state: undefined });
  });

  it("never auto-navigates for a PENDING_CONFIRMATION action — the write still waits for an explicit confirm", () => {
    findNavTarget.mockReturnValue({ getBoundingClientRect: () => ({ left: 100, top: 100, width: 20, height: 20 }) });
    storeMessages = [
      {
        id: "m1", role: "model", content: "Ready to add it. Should I proceed?", streaming: false,
        action_payload: { type: "PENDING_CONFIRMATION", tool_name: "create_exposure", tool_args: {} },
      },
    ];
    vi.useFakeTimers();
    renderChat();
    act(() => { vi.advanceTimersByTime(2000); });

    expect(findNavTarget).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not re-trigger navigation for the same message on an unrelated re-render", () => {
    findNavTarget.mockReturnValue(null);
    storeMessages = [
      {
        id: "m1", role: "model", content: "Taking you there.", streaming: false,
        action_payload: { type: "NAVIGATE", path: "/anxiety" },
      },
    ];
    const { rerender } = renderChat();
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    rerender(<MemoryRouter><AgentChat /></MemoryRouter>);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not navigate while the message is still streaming (no action yet, nothing real to act on)", () => {
    storeMessages = [
      { id: "m1", role: "model", content: "", streaming: true, statusLabel: "Working...", action_payload: null },
    ];
    renderChat();

    expect(findNavTarget).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("AgentChat — FOCUS_SESSION_CONTROL routing (operate the real timer, not a chatbot card)", () => {
  beforeEach(() => {
    focusSessionControlStore.setState({ pendingCommand: null });
  });

  it("dispatches directly to the real, already-mounted Focus Session page instead of navigating, when already there", () => {
    storeMessages = [
      {
        id: "m1", role: "model", content: "Pausing.", streaming: false,
        action_payload: { type: "FOCUS_SESSION_CONTROL", command: "pause", path: "/adhd/focus", session: { status: "PAUSED" } },
      },
    ];
    renderChat({ initialPath: "/adhd/focus" });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(findNavTarget).not.toHaveBeenCalled();
    expect(focusSessionControlStore.getState().pendingCommand).toMatchObject({ command: "pause" });
  });

  it("navigates there first, carrying the command along, when not already on the Focus Session page", () => {
    findNavTarget.mockReturnValue(null);
    storeMessages = [
      {
        id: "m1", role: "model", content: "Starting your focus session.", streaming: false,
        action_payload: { type: "FOCUS_SESSION_CONTROL", command: "start", path: "/adhd/focus", session: { duration_minutes: 25 } },
      },
    ];
    renderChat({ initialPath: "/" });

    expect(mockNavigate).toHaveBeenCalledWith("/adhd/focus", {
      state: { focusSessionCommand: { command: "start", session: { duration_minutes: 25 } } },
    });
    // The command travels via navigation state, not the live store, since nothing is mounted yet to consume it.
    expect(focusSessionControlStore.getState().pendingCommand).toBeNull();
  });

  it("never auto-navigates or dispatches for a PENDING_CONFIRMATION action, even for a focus-session-shaped write", () => {
    storeMessages = [
      {
        id: "m1", role: "model", content: "Should I proceed?", streaming: false,
        action_payload: { type: "PENDING_CONFIRMATION", tool_name: "create_exposure", tool_args: {} },
      },
    ];
    renderChat({ initialPath: "/adhd/focus" });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(focusSessionControlStore.getState().pendingCommand).toBeNull();
  });
});

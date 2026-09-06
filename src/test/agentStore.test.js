import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock("@/support/persistence/role4Store", () => ({
  listInterventions: vi.fn(() => []),
}));

import { supabase } from "@/lib/supabaseClient";
import useAgentStore from "@/stores/agentStore";

const initialState = useAgentStore.getState();
const realUser = { id: "user-1", _supabase: true };
const demoUser = { id: "nb-user-042", _supabase: false };

beforeEach(() => {
  useAgentStore.setState({
    ...initialState,
    isOpen: false,
    messages: [],
    isLoading: false,
    conversationId: null,
    error: null,
    pendingConfirmation: null,
    isSignedIn: true,
  });
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  localStorage.clear();
});

describe("agentStore.sendMessage — real Supabase accounts", () => {
  it("blocks the request and flags signed-out when there is no Supabase session", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    await useAgentStore.getState().sendMessage("hello", realUser);

    const state = useAgentStore.getState();
    expect(state.isSignedIn).toBe(false);
    expect(state.error).toMatch(/sign in/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("attaches the session token as a Bearer header and appends the reply", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok-123" } } });
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ conversation_id: 42, content: "Hi there", action_payload: null }),
    });

    await useAgentStore.getState().sendMessage("hello", realUser);

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer tok-123");

    const state = useAgentStore.getState();
    expect(state.conversationId).toBe(42);
    expect(state.messages.at(-1)).toMatchObject({ role: "model", content: "Hi there" });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("surfaces a PENDING_CONFIRMATION action for the confirmation card to render", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok-123" } } });
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        conversation_id: 42,
        content: "Shall I add this?",
        action_payload: { type: "PENDING_CONFIRMATION", tool_name: "create_exposure", tool_args: { description: "x" } },
      }),
    });

    await useAgentStore.getState().sendMessage("add an exposure", realUser);

    const state = useAgentStore.getState();
    expect(state.pendingConfirmation).toMatchObject({ tool_name: "create_exposure" });
  });

  it("sets a retryable error message on network failure", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok-123" } } });
    fetch.mockRejectedValue(new Error("network down"));

    await useAgentStore.getState().sendMessage("hello", realUser);

    const state = useAgentStore.getState();
    expect(state.error).toMatch(/trouble connecting/i);
    expect(state.isLoading).toBe(false);
  });

  it("marks the user signed-out on a 401 response without a generic error", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: "expired" } } });
    fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await useAgentStore.getState().sendMessage("hello", realUser);

    const state = useAgentStore.getState();
    expect(state.isSignedIn).toBe(false);
    expect(state.error).toMatch(/session has expired/i);
  });

  it("surfaces a friendly error on a 429 (rate limit) response", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok-123" } } });
    fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ detail: "Demo mode is limited..." }) });

    await useAgentStore.getState().sendMessage("hello", realUser);

    const state = useAgentStore.getState();
    expect(state.error).toMatch(/demo mode is limited/i);
  });
});

describe("agentStore.sendMessage — demo accounts", () => {
  it("constructs a namespaced demo bearer token instead of calling Supabase", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ conversation_id: 7, content: "Hi", action_payload: null }),
    });

    await useAgentStore.getState().sendMessage("hello", demoUser);

    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toMatch(/^Bearer demo:nb-user-042:.+/);
  });

  it("reuses the same demo session id across multiple messages (persisted in localStorage)", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ conversation_id: 7, content: "Hi", action_payload: null }),
    });

    await useAgentStore.getState().sendMessage("first", demoUser);
    await useAgentStore.getState().sendMessage("second", demoUser);

    const firstAuth = fetch.mock.calls[0][1].headers.Authorization;
    const secondAuth = fetch.mock.calls[1][1].headers.Authorization;
    expect(firstAuth).toBe(secondAuth);
  });

  it("blocks the request only when there is truly no user at all", async () => {
    await useAgentStore.getState().sendMessage("hello", null);

    const state = useAgentStore.getState();
    expect(state.isSignedIn).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("agentStore.confirmPendingAction / cancelPendingAction", () => {
  it("executes the confirmed tool via /tool/execute and clears pendingConfirmation", async () => {
    useAgentStore.setState({
      conversationId: 42,
      pendingConfirmation: { messageIndex: 0, tool_name: "create_exposure", tool_args: { description: "x" } },
    });
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok-123" } } });
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "executed", message: "Done." }) });

    await useAgentStore.getState().confirmPendingAction(realUser);

    const [url] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/agent\/tool\/execute$/);

    const state = useAgentStore.getState();
    expect(state.pendingConfirmation).toBeNull();
    expect(state.messages.at(-1)).toMatchObject({ content: "Done." });
  });

  it("works for demo accounts too, using the demo bearer token", async () => {
    useAgentStore.setState({
      conversationId: 42,
      pendingConfirmation: { messageIndex: 0, tool_name: "create_exposure", tool_args: { description: "x" } },
    });
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "executed", message: "Done." }) });

    await useAgentStore.getState().confirmPendingAction(demoUser);

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toMatch(/^Bearer demo:nb-user-042:.+/);
    expect(useAgentStore.getState().pendingConfirmation).toBeNull();
  });

  it("cancelPendingAction clears the pending action without calling the backend", () => {
    useAgentStore.setState({
      pendingConfirmation: { messageIndex: 0, tool_name: "create_exposure", tool_args: {} },
    });

    useAgentStore.getState().cancelPendingAction();

    const state = useAgentStore.getState();
    expect(state.pendingConfirmation).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import useFocusSessionControlStore from "@/stores/focusSessionControlStore";

describe("focusSessionControlStore — a command bus, not a second timer", () => {
  beforeEach(() => {
    useFocusSessionControlStore.setState({ pendingCommand: null });
  });

  it("starts with no pending command", () => {
    expect(useFocusSessionControlStore.getState().pendingCommand).toBeNull();
  });

  it("dispatch sets a pending command carrying exactly what was passed", () => {
    useFocusSessionControlStore.getState().dispatch({ command: "pause" });
    const pending = useFocusSessionControlStore.getState().pendingCommand;
    expect(pending.command).toBe("pause");
    expect(pending._dispatchedAt).toBeTypeOf("number");
  });

  it("consume clears the pending command", () => {
    useFocusSessionControlStore.getState().dispatch({ command: "stop" });
    useFocusSessionControlStore.getState().consume();
    expect(useFocusSessionControlStore.getState().pendingCommand).toBeNull();
  });
});

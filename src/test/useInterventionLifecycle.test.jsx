import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getInterventionHistory } from "@/support/lifecycle/interventionLifecycle";
import { useInterventionLifecycle } from "@/support/execution";

const baseProps = {
  userId: "hook-user",
  moduleId: "support.task_breakdown",
  contextSnapshotId: "hook-context",
  triggerSource: "manual",
  selectionMode: "explicit_request",
  configuration: { style: "gentle" },
};

describe("useInterventionLifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with neutral state and starts one intervention", async () => {
    const { result } = renderHook(() => useInterventionLifecycle(baseProps));

    expect(result.current.interventionId).toBeNull();
    expect(result.current.hasStarted).toBe(false);
    let started;
    await act(async () => {
      started = await result.current.start();
    });

    expect(started.ok).toBe(true);
    expect(result.current.hasStarted).toBe(true);
    expect(result.current.status).toBe("running");
  });

  it("exposes loading while a start is pending and prevents duplicate starts", async () => {
    const { result } = renderHook(() => useInterventionLifecycle(baseProps));
    let pending;
    act(() => {
      pending = result.current.start();
    });
    expect(result.current.isStarting).toBe(true);
    const duplicate = await result.current.start();
    await act(async () => {
      await pending;
    });

    expect(duplicate.reasonCodes).toContain("duplicate_start");
    expect(getInterventionHistory(baseProps.userId)).toHaveLength(1);
  });

  it("updates progress, completes, rates, and blocks duplicate terminal actions", async () => {
    const { result } = renderHook(() => useInterventionLifecycle(baseProps));
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.progress({ completedUnits: 1, totalUnits: 2 }); });
    await act(async () => { await result.current.complete({ durationMs: 5000 }); });
    let rating;
    await act(async () => { rating = await result.current.rate({ rating: 5 }); });
    const duplicateTerminal = await result.current.abandon("too late");

    expect(result.current.isTerminal).toBe(true);
    expect(rating.ok).toBe(true);
    expect(duplicateTerminal.reasonCodes).toContain("terminal_intervention");
  });

  it("supports abandonment and structured start failures", async () => {
    const { result, rerender } = renderHook((props) => useInterventionLifecycle(props), { initialProps: baseProps });
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.abandon("stopped"); });
    expect(result.current.status).toBe("abandoned");

    rerender({ ...baseProps, userId: "hook-user-two", moduleId: "support.unknown" });
    let failure;
    await act(async () => { failure = await result.current.start(); });
    expect(failure.reasonCodes).toContain("invalid_module_id");
    expect(result.current.error).toBe("Unknown canonical support module");
  });

  it("resets local state on user change without abandoning an existing intervention on unmount", async () => {
    const first = renderHook(() => useInterventionLifecycle(baseProps));
    await act(async () => { await first.result.current.start(); });
    const interventionId = first.result.current.interventionId;
    first.unmount();

    expect(getInterventionHistory(baseProps.userId)[0].intervention.id).toBe(interventionId);
    expect(getInterventionHistory(baseProps.userId)[0].intervention.status).toBe("started");

    const second = renderHook((props) => useInterventionLifecycle(props), { initialProps: baseProps });
    await act(async () => { await second.result.current.start(); });
    second.rerender({ ...baseProps, userId: "new-user" });
    expect(second.result.current.interventionId).toBeNull();
    expect(second.result.current.status).toBeNull();
  });
});

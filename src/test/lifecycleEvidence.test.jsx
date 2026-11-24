/**
 * lifecycleEvidence.test.jsx — the central support-module lifecycle hook
 * reports task outcomes to the shared context-to-state inference.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useInterventionLifecycle } from "@/support/execution";
import { clearInteractionEvidence, getInteractionEvidenceSnapshot } from "@/adaptive/context/interactionEvidence.js";

const props = {
  userId: "evidence-user",
  moduleId: "support.task_breakdown",
  contextSnapshotId: "ctx",
  triggerSource: "manual",
  selectionMode: "explicit_request",
};

const events = () => getInteractionEvidenceSnapshot().taskEvents.map((e) => [e.type, e.moduleId, e.retry === true]);

beforeEach(() => {
  localStorage.clear();
  clearInteractionEvidence();
});

describe("lifecycle → task evidence", () => {
  it("records start, abandon and a retried start for the module", async () => {
    const first = renderHook(() => useInterventionLifecycle(props));
    await act(async () => { await first.result.current.start(); });
    await act(async () => { await first.result.current.abandon("too_hard"); });
    const second = renderHook(() => useInterventionLifecycle(props));
    await act(async () => { await second.result.current.start(); });
    expect(events()).toEqual([
      ["started", "support.task_breakdown", false],
      ["abandoned", "support.task_breakdown", false],
      ["started", "support.task_breakdown", true],
    ]);
  });

  it("records completion with its duration", async () => {
    const hook = renderHook(() => useInterventionLifecycle(props));
    await act(async () => { await hook.result.current.start(); });
    await act(async () => { await hook.result.current.complete({}); });
    const completed = getInteractionEvidenceSnapshot().taskEvents.find((e) => e.type === "completed");
    expect(completed).toBeDefined();
    expect(completed.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records nothing for commands that were refused", async () => {
    const hook = renderHook(() => useInterventionLifecycle(props));
    await act(async () => { await hook.result.current.complete({}); }); // not started → refused
    expect(getInteractionEvidenceSnapshot().taskEvents).toHaveLength(0);
  });
});

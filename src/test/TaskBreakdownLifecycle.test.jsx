import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TaskBreakdown from "@/pages/adhd/TaskBreakdown";
import { getInterventionHistory } from "@/support/lifecycle/interventionLifecycle";

const auth = vi.hoisted(() => ({ user: { id: "task-breakdown-user" } }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: auth.user }),
}));

async function generate(task = "Prepare confidential presentation") {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: task } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Break into steps" }));
  await screen.findByRole("button", { name: "Start this breakdown" });
}

describe("TaskBreakdown lifecycle integration", () => {
  beforeEach(() => {
    auth.user = { id: "task-breakdown-user" };
    localStorage.clear();
  });

  afterEach(cleanup);

  it("does not persist generation and starts only after the explicit start action", async () => {
    render(<MemoryRouter><TaskBreakdown /></MemoryRouter>);
    await generate();

    expect(getInterventionHistory(auth.user.id)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Start this breakdown" }));

    await waitFor(() => expect(getInterventionHistory(auth.user.id)).toHaveLength(1));
    const history = getInterventionHistory(auth.user.id)[0];
    expect(history.intervention.moduleId).toBe("support.task_breakdown");
    expect(JSON.stringify(history)).not.toContain("Prepare confidential presentation");
  });

  it("starts on the first checked step and completes only after every step", async () => {
    render(<MemoryRouter><TaskBreakdown /></MemoryRouter>);
    await generate();

    const steps = Array.from({ length: 5 }, (_, index) =>
      screen.getByRole("button", { name: `Mark step ${index + 1} complete` }),
    );
    fireEvent.click(steps[0]);
    await waitFor(() => expect(getInterventionHistory(auth.user.id)).toHaveLength(1));
    expect(getInterventionHistory(auth.user.id)[0].intervention.status).not.toBe("completed");

    for (const step of steps.slice(1)) {
      fireEvent.click(step);
      await waitFor(() => expect(getInterventionHistory(auth.user.id)[0].lifecycleEvents.length).toBeGreaterThan(3));
    }

    await waitFor(() => expect(getInterventionHistory(auth.user.id)[0].intervention.status).toBe("completed"));
    const outcome = getInterventionHistory(auth.user.id)[0].outcomes[0];
    expect(outcome.metrics).toMatchObject({ stepsCreated: 5, stepsCompleted: 5, completionRate: 1 });
    expect(JSON.stringify(outcome)).not.toContain("Prepare confidential presentation");
  });

  it("keeps unauthenticated checklists local and explains the limitation", async () => {
    auth.user = null;
    render(<MemoryRouter><TaskBreakdown /></MemoryRouter>);
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Mark step 1 complete" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Sign in to save this breakdown");
    expect(getInterventionHistory("task-breakdown-user")).toEqual([]);
  });
});

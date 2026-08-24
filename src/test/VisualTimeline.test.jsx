import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VisualTimeline from "@/pages/adhd/VisualTimeline";

describe("Visual Timeline", () => {
  it("keeps blocks, controls, brain dump, and snapshot interactions live", async () => {
    render(<VisualTimeline />);

    fireEvent.change(screen.getByPlaceholderText("Add block: Email prof for 20 minutes"), { target: { value: "Email professor" } });
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "12:00" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "12:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add", exact: true }));

    const addedBlock = () => screen.getByText("Email professor").closest("article");
    expect(addedBlock()).not.toBeNull();
    fireEvent.click(within(addedBlock()).getByRole("button", { name: /Snooze 10m/ }));
    await waitFor(() => expect(within(addedBlock()).getByText("12:10")).toBeInTheDocument());
    fireEvent.click(within(addedBlock()).getByRole("button", { name: "Start" }));
    await waitFor(() => expect(within(addedBlock()).getByRole("button", { name: "Stop" })).toBeInTheDocument());
    fireEvent.click(within(addedBlock()).getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(within(addedBlock()).queryByRole("button", { name: "Mark done" })).not.toBeInTheDocument());
    fireEvent.click(within(addedBlock()).getByRole("button", { name: "Remove Email professor" }));
    expect(screen.queryByText("Email professor")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Jot it down. Get it out."), { target: { value: "Email professor about project" } });
    fireEvent.click(screen.getByRole("button", { name: "Add brain dump item" }));
    const dumpItem = screen.getByText("Email professor about project").parentElement;
    fireEvent.click(within(dumpItem).getByRole("button", { name: "Clear" }));
    expect(screen.queryByText("Email professor about project")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByText("Week at a glance")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.change(screen.getByDisplayValue("🙂 Comfortable"), { target: { value: "compact" } });
    expect(screen.getByDisplayValue("Compact")).toBeInTheDocument();
  });
});

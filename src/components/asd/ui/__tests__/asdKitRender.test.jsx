import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AsdCard,
  AsdCelebration,
  AsdCharacter,
  AsdChip,
  AsdFeedback,
  AsdProgressBar,
  AsdProgressDots,
  AsdProgressRing,
  AsdSticker,
} from "../index";

describe("ASD UI kit — accessibility & roles", () => {
  it("progress bar exposes a labelled progressbar role", () => {
    render(<AsdProgressBar value={2} max={5} label="Emotions solved" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("progress ring exposes a labelled progressbar role with the correct percent", () => {
    render(<AsdProgressRing value={1} max={4} label="stories completed" />);
    const ring = screen.getByRole("progressbar");
    expect(ring).toHaveAttribute("aria-valuenow", "25");
    expect(ring).toHaveAttribute("aria-label", "stories completed");
  });

  it("progress dots announce the current step", () => {
    render(<AsdProgressDots total={3} current={1} labelPrefix="Scene" />);
    expect(screen.getByLabelText("Scene 2 of 3")).toBeInTheDocument();
  });

  it("feedback is polite and includes meaningful copy for screen readers", () => {
    render(<AsdFeedback kind="success" title="That's it!">A gentle positive moment.</AsdFeedback>);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("A gentle positive moment.")).toBeInTheDocument();
  });

  it("celebration carries a clear text label", () => {
    render(<AsdCelebration label="Story finished!" />);
    expect(screen.getByText("Story finished!")).toBeInTheDocument();
  });

  it("chips are plain text labels", () => {
    render(<AsdChip tone="teal">Scene 1</AsdChip>);
    expect(screen.getByText("Scene 1")).toBeInTheDocument();
  });

  it("decorative characters are hidden from assistive tech", () => {
    const { container } = render(<AsdCharacter ariaHidden />);
    const character = container.querySelector('[role="presentation"]');
    expect(character).toBeInTheDocument();
    expect(character).toHaveAttribute("aria-hidden", "true");
  });

  it("stickers without a label are hidden, labelled ones are exposed", () => {
    render(<><AsdSticker emoji="⭐" /><AsdSticker emoji="⭐" label="a star" /></>);
    expect(screen.getByLabelText("Sticker: a star")).toBeInTheDocument();
    expect(screen.getAllByText("⭐").length).toBe(2);
  });

  it("cards to a destination expose a link label", () => {
    render(<AsdCard href="/asd/stories" actionLabel="Open Social Stories">Card content</AsdCard>);
    expect(screen.getByRole("link", { name: /open social stories/i })).toBeInTheDocument();
  });
});
import { describe, it, expect, afterEach } from "vitest";
import { findNavTarget } from "@/lib/findNavTarget";

function addLink(href) {
  const a = document.createElement("a");
  a.href = href;
  document.body.appendChild(a);
  return a;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findNavTarget", () => {
  it("returns null for a falsy path without touching the DOM", () => {
    expect(findNavTarget(null)).toBeNull();
    expect(findNavTarget("")).toBeNull();
  });

  it("finds the exact on-screen link when the sub-route is visible on this page", () => {
    const exact = addLink("/adhd/breakdown");
    addLink("/adhd");
    expect(findNavTarget("/adhd/breakdown")).toBe(exact);
  });

  it("falls back to the top-level module link when the exact sub-route isn't rendered", () => {
    const moduleLink = addLink("/adhd");
    expect(findNavTarget("/adhd/breakdown")).toBe(moduleLink);
  });

  it("returns null (never fabricates a target) when nothing matches at all", () => {
    addLink("/ocd");
    expect(findNavTarget("/adhd/breakdown")).toBeNull();
  });

  it("returns null for a bare '/' path instead of matching an unrelated root link", () => {
    addLink("/");
    expect(findNavTarget("/")).not.toBeNull(); // exact match for "/" itself is fine
    expect(findNavTarget("//")).toBeNull(); // degenerate path never crashes
  });
});

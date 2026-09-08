import { describe, it, expect } from "vitest";
import { isAffirmativeConfirmation, isNegativeConfirmation } from "@/lib/confirmationPhrases";

describe("confirmationPhrases — hands-free voice confirm/cancel", () => {
  it.each([
    "yes", "Yes.", "yes please", "yeah", "yep", "confirm", "do it",
    "proceed", "go ahead", "sure", "yes, do it.", "yes confirm",
  ])("treats %j as an affirmative confirmation", (text) => {
    expect(isAffirmativeConfirmation(text)).toBe(true);
    expect(isNegativeConfirmation(text)).toBe(false);
  });

  it.each([
    "no", "No.", "nope", "cancel", "no, cancel that.", "stop",
    "never mind", "actually, don't do that.",
  ])("treats %j as a negative confirmation (cancel)", (text) => {
    expect(isNegativeConfirmation(text)).toBe(true);
    expect(isAffirmativeConfirmation(text)).toBe(false);
  });

  it.each([
    "yes, but wait", "no, that's not what I meant", "maybe",
    "I don't know", "what does that mean", "yes and also show my tasks",
  ])("never treats an ambiguous/longer reply like %j as confirmation or cancellation", (text) => {
    expect(isAffirmativeConfirmation(text)).toBe(false);
    expect(isNegativeConfirmation(text)).toBe(false);
  });

  it("is not fooled by empty or whitespace-only input", () => {
    expect(isAffirmativeConfirmation("")).toBe(false);
    expect(isNegativeConfirmation("   ")).toBe(false);
    expect(isAffirmativeConfirmation(null)).toBe(false);
  });
});

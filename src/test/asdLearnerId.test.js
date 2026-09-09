import { describe, expect, it, beforeEach } from "vitest";
import {
  resolveASDLearnerId,
  normalizeWardId,
} from "@/support/asdLearnerId";

describe("asdLearnerId — single source for the hub and feature progress keys", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the canonical nb-user-* id when the user id is already canonical", () => {
    expect(resolveASDLearnerId({ id: "nb-user-042" }, "user")).toBe("nb-user-042");
  });

  it("resolves the first linked ward for a guardian", () => {
    expect(
      resolveASDLearnerId({ linkedWardIds: ["nb-user-088", "nb-user-011"] }, "guardian"),
    ).toBe("nb-user-088");
  });

  it("falls back to the default ward for a guardian with no linked wards", () => {
    expect(resolveASDLearnerId({ linkedWardIds: [] }, "guardian")).toBe("nb-user-088");
  });

  it("maps a care-link id to its ward", () => {
    expect(resolveASDLearnerId({ careLinkId: "CL-ARUN-0042" }, "user")).toBe("nb-user-042");
  });

  it("maps known email fallbacks", () => {
    expect(resolveASDLearnerId({ email: "riya@example.com" }, "user")).toBe("nb-user-088");
    expect(resolveASDLearnerId({ email: "meera@example.com" }, "user")).toBe("nb-user-011");
  });

  it("honours a runtime-synced ward id set earlier in the session", () => {
    window.localStorage.setItem("nb_runtime_sync_ward_id", "nb-user-011");
    expect(resolveASDLearnerId({ id: "nb-user-042" }, "user")).toBe("nb-user-011");
  });

  it("returns null without a user", () => {
    expect(resolveASDLearnerId(null, "user")).toBeNull();
  });

  it("normalizes care-link ids and rejects unknown ids", () => {
    expect(normalizeWardId("CL-MEERA-0011")).toBe("nb-user-011");
    expect(normalizeWardId("nb-user-088")).toBe("nb-user-088");
    expect(normalizeWardId("gibberish")).toBeNull();
  });
});
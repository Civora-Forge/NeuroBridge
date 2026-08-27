import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import InterventionResolver, {
  resolveInterventionDefinition,
  getInterventionMeta,
  INTERVENTION_REGISTRY,
} from "@/components/interventions/InterventionResolver";

describe("InterventionResolver", () => {
  it("resolves canonical Anxiety recommendation IDs correctly", () => {
    const breathing = resolveInterventionDefinition("guided_breathing");
    expect(breathing.id).toBe("guided_breathing");
    expect(breathing.title).toBe("Guided Breathing");
    expect(breathing.domain).toBe("anxiety");

    const grounding = resolveInterventionDefinition("grounding_exercise");
    expect(grounding.id).toBe("grounding_exercise");
    expect(grounding.title).toBe("5-4-3-2-1 Grounding");

    const calm = resolveInterventionDefinition("calm_space");
    expect(calm.id).toBe("calm_space");
    expect(calm.title).toBe("Calm Space");
  });

  it("resolves canonical ASD recommendation IDs correctly", () => {
    const sensory = resolveInterventionDefinition("sensory_reset");
    expect(sensory.id).toBe("sensory_reset");
    expect(sensory.title).toBe("Sensory Reset");
    expect(sensory.domain).toBe("asd");

    const groundingActivity = resolveInterventionDefinition("grounding_activity");
    expect(groundingActivity.id).toBe("grounding_activity");
    expect(groundingActivity.title).toBe("Grounding Activity");

    const transition = resolveInterventionDefinition("transition_support");
    expect(transition.id).toBe("transition_support");
    expect(transition.title).toBe("Now · Next · Then");
  });

  it("resolves known aliases and fuzzy terms cleanly", () => {
    expect(resolveInterventionDefinition("box_breathing").id).toBe("guided_breathing");
    expect(resolveInterventionDefinition("physiological_breathing").id).toBe("guided_breathing");
    expect(resolveInterventionDefinition("pacing").id).toBe("guided_breathing");

    expect(resolveInterventionDefinition("low_stimulation").id).toBe("sensory_reset");
    expect(resolveInterventionDefinition("overwhelm").id).toBe("sensory_reset");

    expect(resolveInterventionDefinition("54321_grounding").id).toBe("grounding_exercise");
    expect(resolveInterventionDefinition("anxiety_grounding").id).toBe("grounding_exercise");

    expect(resolveInterventionDefinition("asd_grounding").id).toBe("grounding_activity");
    expect(resolveInterventionDefinition("regulation").id).toBe("grounding_activity");

    expect(resolveInterventionDefinition("routine_support").id).toBe("transition_support");
    expect(resolveInterventionDefinition("schedule_transition").id).toBe("transition_support");
  });

  it("gracefully falls back to SafeFallbackIntervention on unknown or invalid recommendation IDs", () => {
    const unknown = resolveInterventionDefinition("completely_unknown_recommendation_xyz");
    expect(unknown.id).toBe("fallback");
    expect(unknown.title).toBe("Gentle Pause");

    const nullDef = resolveInterventionDefinition(null);
    expect(nullDef.id).toBe("fallback");

    const undefinedDef = resolveInterventionDefinition(undefined);
    expect(undefinedDef.id).toBe("fallback");
  });

  it("returns metadata correctly via getInterventionMeta", () => {
    const meta = getInterventionMeta("guided_breathing");
    expect(meta.title).toBe("Guided Breathing");
    expect(meta.description).toContain("breathe");
    expect(meta.domain).toBe("anxiety");
  });

  it("renders the resolved component through InterventionResolver", () => {
    const { container } = render(
      <InterventionResolver recommendationId="sensory_reset" onComplete={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText("Sensory Reset")).toBeInTheDocument();
    expect(screen.getByText("A quiet place for your senses to rest.")).toBeInTheDocument();
  });
});

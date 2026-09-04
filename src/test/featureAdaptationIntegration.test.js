import { describe, expect, it } from 'vitest';
import {
  deriveFeatureSignals,
  buildFocusConfig,
  buildReadingConfig,
  buildTaskBreakdownConfig,
  buildGentleActivityConfig,
  buildAnxietyConfig,
  buildReframingConfig,
  buildGroundingConfig,
  buildTimelineConfig,
  buildEvidenceJournalConfig,
  getFeatureConfigBuilder,
} from '@/adaptive/featureConfiguration';
import { deriveModuleAdjustments } from '@/components/adaptive/AdaptiveUIRuntime.jsx';
import { buildModuleContext } from '@/support/framework/moduleContextAdapter';
import { decide } from '@backend/adaptive/engine/adaptiveEngine';
import { generateTaskBreakdown, getTaskBreakdownProgress } from '@/support/modules/taskBreakdown/taskBreakdownService';

/* A module-scoped engine decision surfaces as an `adjustments` list of
 * { type, target, ... } action objects (see `useModuleAdaptation`). These
 * integration scenarios verify that the decisions really translate into the
 * native parameters each wired feature consumes. */

const adj = (type, targets) => [{ type, target: targets?.[0] ?? 'speed', value: 0.6 }];

describe('deriveFeatureSignals', () => {
  it('maps action types to boolean signals and stays inactive without decisions', () => {
    expect(deriveFeatureSignals(adj('DECREASE'))).toMatchObject({ slowPace: true, active: true });
    expect(deriveFeatureSignals(adj('SIMPLIFY'))).toMatchObject({ simplify: true, reduce: false });
    expect(deriveFeatureSignals(adj('REDUCE'))).toMatchObject({ reduce: true, simplify: false });
    expect(deriveFeatureSignals(adj('GUIDE'))).toMatchObject({ guide: true });
    expect(deriveFeatureSignals([])).toMatchObject({ active: false, slowPace: false, simplify: false, reduce: false });
  });
});

describe('Focus Session wiring (support.focus_session)', () => {
  it('shortens the block and lengthens the break on overload without exceeding the chosen duration', () => {
    const cfg = buildFocusConfig({ signals: deriveFeatureSignals(adj('DECREASE')), focusMinutes: 25 });
    expect(cfg.active).toBe(true);
    expect(cfg.mode).toBe('short_gentle_blocks');
    expect(cfg.focusMinutes).toBeLessThan(25);
    expect(cfg.focusMinutes).toBe(15);
    expect(cfg.breakMinutes).toBe(8);
    expect(cfg.calmBreakTips).toBe(true);
  });

  it('only relaxes — a 15-minute choice stays 15 under the same decision', () => {
    const cfg = buildFocusConfig({ signals: deriveFeatureSignals(adj('DECREASE')), focusMinutes: 15 });
    expect(cfg.focusMinutes).toBe(15);
  });

  it('exposes a simplified mode under scatter with reduced distractions', () => {
    const cfg = buildFocusConfig({ signals: deriveFeatureSignals(adj('SIMPLIFY')) });
    expect(cfg.mode).toBe('simplified');
    expect(cfg.reducedDistractions).toBe(true);
    expect(cfg.calmBreakTips).toBe(true);
    expect(cfg.focusMinutes).toBe(25);
  });
});

describe('Adaptive Reading wiring (dyslexia.adaptive-reading)', () => {
  it('slows TTS pacing and enables the ruler on overload', () => {
    const cfg = buildReadingConfig({ signals: deriveFeatureSignals(adj('DECREASE')), estimatedMinutes: 5 });
    expect(cfg.mode).toBe('slow_paced_reading');
    expect(cfg.playbackRate).toBe(0.75);
    expect(cfg.enableReadingRuler).toBe(true);
    expect(cfg.enableFocusMode).toBe(false);
    expect(cfg.suggestedSessionMinutes).toBe(3);
  });

  it('turns on focus mode and the ruler, and shortens words-per-line, under scatter', () => {
    const cfg = buildReadingConfig({ signals: deriveFeatureSignals(adj('SIMPLIFY')) });
    expect(cfg.mode).toBe('focus_layout');
    expect(cfg.enableFocusMode).toBe(true);
    expect(cfg.enableReadingRuler).toBe(true);
    expect(cfg.reducedWordsPerLine).toBe(true);
  });

  it('clamps the playback rate inside the TTS range the player honours', () => {
    const slow = buildReadingConfig({ signals: deriveFeatureSignals(adj('DECREASE')) });
    const fast = buildReadingConfig({ signals: deriveFeatureSignals(adj('INCREASE')) });
    expect(slow.playbackRate).toBeGreaterThanOrEqual(0.25);
    expect(slow.playbackRate).toBeLessThanOrEqual(2);
    expect(fast.playbackRate).toBeLessThanOrEqual(2);
  });
});

describe('Dyslexia module registry fix (regression)', () => {
  it('resolves the canonical reading module context with real module policies', () => {
    const context = buildModuleContext('dyslexia.adaptive-reading');
    expect(context.moduleId).toBe('dyslexia.adaptive-reading');
    expect(context.modulePolicies.length).toBeGreaterThanOrEqual(3);
    expect(context.supportedAdaptationDimensions).toContain('PACING');
  });

  it('flows module decisions through the engine into non-UI adjustments (no inert config)', () => {
    const context = buildModuleContext('dyslexia.adaptive-reading');
    const { plan } = decide({
      contextSnapshot: {
        mood: { primaryMood: 'overwhelmed', confidence: 0.9 },
        behavior: { taskSwitchFrequency: 1 },
      },
      moduleContext: context,
    }, { decisionTraceId: 'dyslexia-regression-overload' });

    const adjustments = deriveModuleAdjustments(plan);
    expect(adjustments.length).toBeGreaterThan(0);
    expect(adjustments.some((a) => a.target === 'PACING' && a.type === 'DECREASE')).toBe(true);
    expect(adjustments.some((a) => a.target === 'UI')).toBe(false);

    const cfg = buildReadingConfig({ signals: deriveFeatureSignals(adjustments), estimatedMinutes: 5 });
    expect(cfg.active).toBe(true);
    expect(cfg.mode).toBe('slow_paced_reading');
    expect(cfg.playbackRate).toBe(0.75);
  });

  it('engages the content reduction path on fatigue, not just overload', () => {
    const context = buildModuleContext('dyslexia.adaptive-reading');
    const { plan } = decide({
      contextSnapshot: {
        mood: { primaryMood: 'sad', confidence: 0.9 },
        behavior: { taskSwitchFrequency: 0.1 },
      },
      moduleContext: context,
    }, { decisionTraceId: 'dyslexia-regression-fatigue' });

    const adjustments = deriveModuleAdjustments(plan);
    expect(adjustments.some((a) => a.target === 'CONTENT' && a.type === 'REDUCE')).toBe(true);
    const cfg = buildReadingConfig({ signals: deriveFeatureSignals(adjustments), estimatedMinutes: 5 });
    expect(cfg.active).toBe(true);
    expect(cfg.reducedWordsPerLine).toBe(true);
  });
});

describe('Task Breakdown wiring (support.task_breakdown)', () => {
  it('selects the lighter native style and yields genuinely fewer, tiny steps on overload', () => {
    const cfg = buildTaskBreakdownConfig({ signals: deriveFeatureSignals(adj('DECOMPOSE')) });
    expect(cfg.mode).toBe('smaller_steps');
    expect(cfg.smallerSteps).toBe(true);
    expect(cfg.suggestedStyle).toBe('Bare Minimum');
    expect(cfg.stepCount).toBeLessThanOrEqual(5);

    const standard = getTaskBreakdownProgress(generateTaskBreakdown('Study', { selectedStyle: 'Standard' }));
    const adapted = getTaskBreakdownProgress(generateTaskBreakdown('Study', { selectedStyle: cfg.suggestedStyle }));
    expect(adapted.totalUnits).toBeLessThan(standard.totalUnits);
    expect(adapted.totalUnits).toBe(4);
  });

  it('keeps pacing gentle with a one-step focus under low energy', () => {
    const cfg = buildTaskBreakdownConfig({ signals: deriveFeatureSignals(adj('SIMPLIFY')) });
    expect(cfg.mode).toBe('gentle_pacing');
    expect(cfg.gentlePacing).toBe(true);
    expect(cfg.showOneStep).toBe(true);
    expect(cfg.suggestedStyle).toBe('Standard');
  });

  it('never asks for fewer than the floor the generator supports', () => {
    const cfg = buildTaskBreakdownConfig({ signals: deriveFeatureSignals(adj('DECOMPOSE')), requestedStepCount: 3 });
    expect(cfg.stepCount).toBeGreaterThanOrEqual(3);
  });
});

describe('Gentle Activity / MVH wiring (support.gentle_activity)', () => {
  it('signals slower pacing and reassurance on low energy', () => {
    const cfg = buildGentleActivityConfig({ signals: deriveFeatureSignals(adj('DECREASE')), totalSteps: 5 });
    expect(cfg.mode).toBe('gentle_slow_pace');
    expect(cfg.pacingHint).toBe('slower');
    expect(cfg.reassureCopy).toBe(true);
    expect(cfg.visibleSteps).toBe(5);
  });

  it('reduces the visible step scope on overload so fewer actions complete the session', () => {
    const cfg = buildGentleActivityConfig({ signals: deriveFeatureSignals(adj('DECOMPOSE')), totalSteps: 5 });
    expect(cfg.mode).toBe('reduced_step_scope');
    expect(cfg.reducedScope).toBe(true);
    expect(cfg.visibleSteps).toBe(3);
    expect(cfg.visibleSteps).toBeLessThanOrEqual(cfg.visibleSteps + 0);
    expect(cfg.visibleSteps).toBeLessThan(5);
  });
});

describe('Anxiety Hub wiring (anxiety.hub)', () => {
  it('promotes the breathing intervention under the breathing_on_stress GUIDE decision', () => {
    const cfg = buildAnxietyConfig({ signals: deriveFeatureSignals(adj('GUIDE')) });
    expect(cfg.active).toBe(true);
    expect(cfg.mode).toBe('promote_breathing');
    expect(cfg.promoteBreathing).toBe(true);
    expect(cfg.recommendedIntervention).toBe('guided_breathing');
    expect(cfg.calmReassurance).toBe(true);
  });
});

describe('Cognitive Reframing wiring (support.cognitive_reframing)', () => {
  it('asks fewer, lighter questions on overload', () => {
    const cfg = buildReframingConfig({ signals: deriveFeatureSignals(adj('SIMPLIFY')), totalQuestions: 3 });
    expect(cfg.active).toBe(true);
    expect(cfg.mode).toBe('small_reframes');
    expect(cfg.visibleQuestions).toBe(2);
    expect(cfg.guidedPrompts).toBe(false);
  });

  it('guides the reflection with prompts and reassurance under rumination', () => {
    const cfg = buildReframingConfig({ signals: deriveFeatureSignals(adj('GUIDE')), totalQuestions: 3 });
    expect(cfg.mode).toBe('guided_reframe');
    expect(cfg.guidedPrompts).toBe(true);
    expect(cfg.reassureCopy).toBe(true);
    expect(cfg.visibleQuestions).toBe(3);
  });

  it('never hides every question — a 3-question module keeps at least one', () => {
    const cfg = buildReframingConfig({ signals: deriveFeatureSignals(adj('SIMPLIFY')), totalQuestions: 3 });
    expect(cfg.visibleQuestions).toBeGreaterThanOrEqual(1);
  });
});

describe('Anxiety Dissolver / Grounding wiring (support.grounding)', () => {
  it('promotes the breathing techniques first when guidance invites breathing', () => {
    const cfg = buildGroundingConfig({ signals: deriveFeatureSignals(adj('GUIDE')) });
    expect(cfg.active).toBe(true);
    expect(cfg.mode).toBe('breathing_first');
    expect(cfg.breathingFirst).toBe(true);
    expect(cfg.guidedBreathing).toBe(true);
    expect(cfg.breathingTechniqueIds).toEqual(['4-7-8', 'box_breathing']);
  });

  it('slows the pacing with reassurance under a panic-level decision', () => {
    const cfg = buildGroundingConfig({ signals: deriveFeatureSignals(adj('DECREASE')) });
    expect(cfg.mode).toBe('quiet_slow_pace');
    expect(cfg.slowPacing).toBe(true);
    expect(cfg.reassureCopy).toBe(true);
    expect(cfg.breathingFirst).toBe(false);
  });
});

describe('Visual Timeline wiring (support.visual_timeline)', () => {
  it('reduces visual density on overload without touching the calm layout', () => {
    const cfg = buildTimelineConfig({ signals: deriveFeatureSignals(adj('REDUCE')) });
    expect(cfg.active).toBe(true);
    expect(cfg.mode).toBe('reduced_density');
    expect(cfg.densityReduced).toBe(true);
    expect(cfg.calmLayout).toBe(false);
  });

  it('only activates the calm layout under a SIMPLIFY distress decision', () => {
    const cfg = buildTimelineConfig({ signals: deriveFeatureSignals(adj('SIMPLIFY')) });
    expect(cfg.mode).toBe('calm_layout');
    expect(cfg.calmLayout).toBe(true);
    expect(cfg.densityReduced).toBe(false);
  });
});

describe('Evidence Journal wiring (support.evidence_journal)', () => {
  it('prioritises the starred wins first when the low-mood REORDER decision fires', () => {
    const cfg = buildEvidenceJournalConfig({ signals: deriveFeatureSignals(adj('REORDER')) });
    expect(cfg.active).toBe(true);
    expect(cfg.mode).toBe('wins_first');
    expect(cfg.winsFirst).toBe(true);
    expect(cfg.highlightWins).toBe(true);
  });

  it('stays neutral without a reorder decision', () => {
    const cfg = buildEvidenceJournalConfig({ signals: deriveFeatureSignals([]) });
    expect(cfg.active).toBe(false);
    expect(cfg.winsFirst).toBe(false);
  });
});

describe('config builder registry', () => {
  it('resolves a builder for every wired canonical module id', () => {
    for (const id of [
      'support.focus_session',
      'support.task_breakdown',
      'support.gentle_activity',
      'dyslexia.adaptive-reading',
      'anxiety.hub',
      'support.cognitive_reframing',
      'support.grounding',
      'support.visual_timeline',
      'support.evidence_journal',
    ]) {
      expect(getFeatureConfigBuilder(id)).toBeTypeOf('function');
    }
    expect(getFeatureConfigBuilder('support.social_connection')).toBeNull();
  });
});

describe('inactive decisions never force change', () => {
  it('every builder stays inactive and neutral when no decision is active', () => {
    expect(buildFocusConfig({}).active).toBe(false);
    expect(buildReadingConfig({}).active).toBe(false);
    expect(buildTaskBreakdownConfig({}).active).toBe(false);
    expect(buildGentleActivityConfig({}).active).toBe(false);
    expect(buildAnxietyConfig({}).active).toBe(false);
    expect(buildReframingConfig({}).active).toBe(false);
    expect(buildGroundingConfig({}).active).toBe(false);
    expect(buildTimelineConfig({}).active).toBe(false);
    expect(buildEvidenceJournalConfig({}).active).toBe(false);
  });
});
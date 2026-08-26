import { describe, expect, it } from 'vitest';
import { buildCognitiveReframingOutcome } from '@/support/modules/cognitiveReframing/cognitiveReframingService';
describe('Cognitive Reframing lifecycle', () => { it('requires confirmation for completion and persists only stages', () => { expect(buildCognitiveReframingOutcome({ stagesCompleted: 2 }).completionStatus).toBe('partially_completed'); expect(buildCognitiveReframingOutcome({ stagesCompleted: 3, confirmed: true }).metrics).toMatchObject({ stagesCompleted: 3, totalStages: 3 }); }); });

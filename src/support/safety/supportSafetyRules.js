export const MODULE_SAFETY_POLICIES = {
  'support.task_breakdown': 'structured_low_risk', 'support.focus_session': 'structured_low_risk', 'support.visual_timeline': 'structured_low_risk', 'support.mood_checkin': 'structured_low_risk', 'support.accountability_session': 'structured_low_risk', 'support.gentle_activity': 'structured_low_risk',
  'support.cognitive_reframing': 'sensitive_free_text', 'support.evidence_journal': 'sensitive_free_text', 'support.social_connection': 'social_action', 'support.grounding': 'grounding_support',
};
export const persistencePolicy = (level, userId) => ({ persistRawText: false, persistSanitizedSummary: false, persistAggregateMetrics: level === 'safe' && Boolean(userId), retentionMode: level === 'blocked' || level === 'high_risk' ? 'blocked' : userId ? 'user_scoped' : 'ephemeral' });

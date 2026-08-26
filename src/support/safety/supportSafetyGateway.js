import { assessSupportSafety } from '@/support/framework/interventionSelection';
import { MODULE_SAFETY_POLICIES, persistencePolicy } from './supportSafetyRules';
import { SUPPORT_SAFETY_VERSION, SupportInputType, SupportSafetyLevel } from './supportSafetyTypes';

export function assessSupportInput({ userId = null, moduleId, action = 'start', inputType = SupportInputType.STRUCTURED, text = '', metadata = {} } = {}) {
  if (!Object.values(SupportInputType).includes(inputType) || !MODULE_SAFETY_POLICIES[moduleId]) return { allowed: false, level: SupportSafetyLevel.BLOCKED, action, reasonCodes: ['unknown_input_or_module'], requiresConfirmation: false, requiresEscalation: false, persistencePolicy: persistencePolicy('blocked', userId), version: SUPPORT_SAFETY_VERSION };
  const safety = assessSupportSafety({ explicitRequest: inputType === SupportInputType.STRUCTURED ? '' : String(text), context: metadata.safetyContext ?? {} });
  if (!safety.allowed) return { allowed: false, level: SupportSafetyLevel.HIGH_RISK, action, reasonCodes: safety.reasonCodes, requiresConfirmation: false, requiresEscalation: true, persistencePolicy: persistencePolicy('high_risk', userId), version: SUPPORT_SAFETY_VERSION };
  const sensitive = inputType === SupportInputType.FREE_TEXT || MODULE_SAFETY_POLICIES[moduleId] === 'sensitive_free_text';
  return { allowed: true, level: sensitive ? SupportSafetyLevel.SENSITIVE : SupportSafetyLevel.SAFE, action, reasonCodes: safety.reasonCodes, requiresConfirmation: sensitive, requiresEscalation: false, ...(sensitive && String(text).trim() ? { safeInput: String(text).trim().slice(0, 500) } : {}), persistencePolicy: persistencePolicy(sensitive ? 'sensitive' : 'safe', userId), version: SUPPORT_SAFETY_VERSION };
}

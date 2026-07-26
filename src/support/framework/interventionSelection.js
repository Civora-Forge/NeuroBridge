import { getSupportModules } from "@/support/framework/supportModuleRegistry";
import { listInterventions, listInterventionOutcomes, listUserMemories } from "@/support/persistence/role4Store";
import {
  InterventionStatus,
  MemoryType,
  SafetyLevel,
} from "@/support/schemas/supportSchemas";

const DEFAULT_RECENT_HOURS = 24;
const REQUEST_SYNONYMS = {
  overwhelmed: ["overwhelm", "panic", "stress", "sensory_overload"],
  anxious: ["panic", "stress", "anxiety", "overwhelm"],
  panic: ["panic", "grounding", "calming"],
  focus: ["focus", "distraction", "task_switching"],
  reading: ["reading_fatigue", "tts", "accessibility"],
  math: ["number_anxiety", "number_confusion", "working_memory"],
  task: ["planning", "task_start", "task_breakdown"],
  exposure: ["exposure", "avoidance", "uncertainty"],
};

function nowMs(optionsNow) {
  return optionsNow ? new Date(optionsNow).getTime() : Date.now();
}

function hoursAgo(timestamp, nowValue) {
  const ts = new Date(timestamp).getTime();
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return (nowValue - ts) / (60 * 60 * 1000);
}

function tokenize(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter(Boolean);
}

function getContextTags(context = {}) {
  const values = [
    context.mood?.primaryMood,
    context.emotion?.label,
    context.conversation?.detectedIntent,
    context.conversation?.urgency,
    context.task?.intent,
    context.activity?.activity,
    context.activity?.currentModule,
  ];
  return values.flatMap(tokenize);
}

function getRequestTags(explicitRequest = "") {
  const tokens = tokenize(explicitRequest);
  const expanded = new Set(tokens);
  tokens.forEach((token) => {
    (REQUEST_SYNONYMS[token] || []).forEach((tag) => expanded.add(tag));
  });
  return [...expanded];
}

function getPreferenceHints(memories) {
  const preferred = new Set();
  const avoided = new Set();
  memories.forEach((memory) => {
    if (memory.archivedAt) return;
    if ([MemoryType.PREFERENCE, MemoryType.SUCCESSFUL_STRATEGY].includes(memory.type)) {
      preferred.add(memory.key);
    }
    if (memory.type === MemoryType.INEFFECTIVE_STRATEGY || memory.value?.avoid === true) {
      avoided.add(memory.key);
    }
  });
  return { preferred, avoided };
}

function countRecentInterventions(userId, moduleId, nowValue, windowHours) {
  return listInterventions(userId).filter(
    (record) => record.moduleId === moduleId && hoursAgo(record.createdAt, nowValue) <= windowHours,
  ).length;
}

function calculateOutcomeAdjustment(userId, module) {
  const outcomes = listInterventionOutcomes(userId).filter(
    (outcome) =>
      outcome.moduleId === module.id ||
      module.interventionTypes.includes(outcome.interventionType),
  );
  if (outcomes.length === 0) return 0;
  const recent = outcomes.slice(0, 10);
  const score = recent.reduce((sum, outcome) => {
    if (outcome.completed === true || outcome.status === InterventionStatus.COMPLETED) return sum + 1.2;
    if (outcome.rating >= 4) return sum + 1;
    if (outcome.status === InterventionStatus.ABANDONED || outcome.status === InterventionStatus.DISMISSED) return sum - 1;
    if (outcome.rating && outcome.rating <= 2) return sum - 0.8;
    return sum;
  }, 0);
  return score / recent.length;
}

export function assessSupportSafety({ explicitRequest = "", context = {} } = {}) {
  const combined = `${explicitRequest} ${JSON.stringify(context)}`.toLowerCase();
  const asksForDiagnosis = /\b(diagnose|diagnosis|do i have|am i autistic|am i ocd|cure|medication|prescribe)\b/.test(combined);
  const crisis = /\b(suicide|self[- ]?harm|kill myself|end my life)\b/.test(combined);

  if (crisis) {
    return {
      level: SafetyLevel.ESCALATE,
      allowed: false,
      reasonCodes: ["crisis_language_detected"],
      message: "This request needs immediate human support rather than an automated support module.",
    };
  }

  if (asksForDiagnosis) {
    return {
      level: SafetyLevel.CAUTION,
      allowed: true,
      reasonCodes: ["clinical_claim_guardrail"],
      message: "Modules may offer support strategies, but they cannot diagnose, cure, prescribe, or make clinical claims.",
    };
  }

  return {
    level: SafetyLevel.STANDARD,
    allowed: true,
    reasonCodes: [],
    message: "Standard support selection allowed.",
  };
}

export function checkModuleEligibility(module, options = {}) {
  const {
    userId,
    userProfile = {},
    currentContext = {},
    explicitRequest = "",
    now,
  } = options;
  if (!userId) {
    return { eligible: false, score: 0, reasonCodes: [], blockedReasons: ["missing_user_id"] };
  }

  const safety = assessSupportSafety({ explicitRequest, context: currentContext });
  if (!safety.allowed) {
    return {
      eligible: false,
      score: 0,
      reasonCodes: safety.reasonCodes,
      blockedReasons: ["safety_escalation_required"],
      safety,
    };
  }

  const enabled = new Set(userProfile.enabledModules || userProfile.enabledFeatures || []);
  const disorders = new Set(userProfile.disorders || []);
  const hasExplicitAccess = enabled.size === 0 || enabled.has(module.id);
  const hasDisorderAccess =
    disorders.size === 0 || module.disorders.length === 0 || module.disorders.some((disorder) => disorders.has(disorder));
  const hasRoleAccess = module.supportedRoles.includes(userProfile.role || "user");
  const nowValue = nowMs(now);
  const recentCount = countRecentInterventions(userId, module.id, nowValue, module.repetitionLimit.windowHours);

  const blockedReasons = [];
  if (!hasExplicitAccess) blockedReasons.push("module_not_enabled");
  if (!hasDisorderAccess) blockedReasons.push("profile_not_matched");
  if (!hasRoleAccess) blockedReasons.push("role_not_supported");
  if (recentCount >= module.repetitionLimit.maxCount) blockedReasons.push("repetition_limit_reached");

  const contextTags = getContextTags(currentContext);
  const requestTags = getRequestTags(explicitRequest);
  const memories = listUserMemories(userId);
  const { preferred, avoided } = getPreferenceHints(memories);
  const reasonCodes = [];
  let score = 1;

  const matchingContextTags = module.tags.filter((tag) => contextTags.includes(tag));
  if (matchingContextTags.length > 0) {
    score += matchingContextTags.length * 2;
    reasonCodes.push("context_match");
  }

  const matchingRequestTags = module.tags.filter((tag) => requestTags.includes(tag));
  const matchingRequestTypes = module.interventionTypes.filter((type) => requestTags.includes(type));
  if (matchingRequestTags.length > 0 || matchingRequestTypes.length > 0) {
    score += (matchingRequestTags.length + matchingRequestTypes.length) * 3;
    reasonCodes.push("explicit_request_match");
  }

  const preferredMatch = module.interventionTypes.some((type) => preferred.has(type)) || preferred.has(module.id);
  if (preferredMatch) {
    score += 2;
    reasonCodes.push("user_preference_match");
  }

  const avoidedMatch = module.interventionTypes.some((type) => avoided.has(type)) || avoided.has(module.id);
  if (avoidedMatch) {
    score -= 3;
    reasonCodes.push("user_avoidance_match");
  }

  const outcomeAdjustment = calculateOutcomeAdjustment(userId, module);
  if (outcomeAdjustment > 0) reasonCodes.push("positive_previous_outcomes");
  if (outcomeAdjustment < 0) reasonCodes.push("negative_previous_outcomes");
  score += outcomeAdjustment;

  if (safety.reasonCodes.length > 0) {
    reasonCodes.push(...safety.reasonCodes);
  }

  return {
    eligible: blockedReasons.length === 0,
    score: Number(score.toFixed(2)),
    reasonCodes,
    blockedReasons,
    safety,
    recentCount,
  };
}

export function rankSupportModules(options = {}) {
  const modules = options.modules || getSupportModules();
  return modules
    .map((module) => ({
      module,
      eligibility: checkModuleEligibility(module, options),
    }))
    .sort((left, right) => {
      if (left.eligibility.eligible !== right.eligibility.eligible) {
        return left.eligibility.eligible ? -1 : 1;
      }
      return right.eligibility.score - left.eligibility.score || left.module.id.localeCompare(right.module.id);
    });
}

export function selectIntervention(options = {}) {
  const rankedModules = rankSupportModules(options);
  const selected = rankedModules.find((entry) => entry.eligibility.eligible);
  const fallback = rankedModules.find((entry) => !entry.eligibility.blockedReasons.includes("safety_escalation_required"));

  if (!selected && !fallback) {
    const safety = assessSupportSafety(options);
    return {
      selectedModule: null,
      rankedModules,
      fallbackUsed: false,
      safety,
      reasonCodes: [...safety.reasonCodes, "no_safe_module_available"],
    };
  }

  const chosen = selected || fallback;
  return {
    selectedModule: chosen.module,
    rankedModules,
    fallbackUsed: !selected,
    safety: chosen.eligibility.safety,
    reasonCodes: chosen.eligibility.reasonCodes.length > 0 ? chosen.eligibility.reasonCodes : ["deterministic_default"],
  };
}

import { buildFocusSessionHints, buildGentleActivityHints, buildTaskBreakdownHints } from "./personalizationRules";

const MODULE_HINT_RULES = {
  "support.task_breakdown": buildTaskBreakdownHints,
  "support.focus_session": buildFocusSessionHints,
  "support.gentle_activity": buildGentleActivityHints,
};

export function getModuleHintRule(moduleId) {
  return MODULE_HINT_RULES[moduleId] ?? null;
}

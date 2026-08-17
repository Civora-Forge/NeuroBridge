/**
 * scenarioGenerator.js — Builds scenarios for the Social Communication
 * Simulator. Primary path uses the Gemini provider; every failure degrades to
 * a deterministic, parametrised fallback so the feature ALWAYS runs. The
 * fallback is generated from domain templates combined with difficulty,
 * hint availability and a variant seed — it is not a fixed complete list.
 */

import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_LEVELS,
  SCENARIO_SOURCE,
  TURN_LIMIT_FOR,
  getDomainById,
} from "../types/communicationTypes";
import { generateScenarioContent } from "./aiService";

// ─────────────────────────────────────────────
//  Deterministic domain templates (fallback path)
// ─────────────────────────────────────────────
const DOMAIN_TEMPLATES = Object.freeze({
  initiating: Object.freeze({
    setting: "a college club meeting",
    role: "a student you have met once before",
    personality: "friendly and open",
    goal: "start a short conversation and get to know them a little.",
    openings: [
      "Hey, you're in the photography group too, right? I think I saw you last week.",
      "Hi! You came in just as the meeting was starting. How did you find the room?",
      "Oh hey, we sat next to each other at lunch on Monday. How's your week going?",
    ],
    suggested: [
      "Hi, yes! I'm new here. How long have you been in the group?",
      "Hi! I found it fine, the signs were helpful. Are you in this group often?",
      "Yeah, it's been okay so far. How about yours?",
    ],
  }),
  requesting_help: Object.freeze({
    setting: "a library help desk",
    role: "the librarian at the front desk",
    personality: "calm and helpful",
    goal: "ask for help clearly and get what you need.",
    openings: [
      "Hi there, can I help you with something?",
      "Hello, you look like you're searching for something. Need a hand?",
      "Hi! Are you looking for a specific book or a quiet place?",
    ],
    suggested: [
      "Hi, yes please. I can't find the books for my project — could you show me where they are?",
      "Yes, thank you. I need help finding a quiet study room for an hour. Is that possible?",
      "Hi. I'm looking for a book the teacher mentioned. Could you point me in the right direction?",
    ],
  }),
  expressing_preference: Object.freeze({
    setting: "choosing a place to eat with a friend",
    role: "your friend",
    personality: "easygoing",
    goal: "say what you would prefer without pressure.",
    openings: [
      "Where do you want to eat today? Any ideas?",
      "I'm fine with anything — you pick! What sounds good to you?",
      "Do you feel like getting a quick bite after class?",
    ],
    suggested: [
      "I'd rather get something quick and not too noisy, like the sandwich place. What do you think?",
      "Actually, I'd prefer somewhere quiet. How about the café by the park?",
      "I'm okay with a quick bite, but I'd rather skip the busy food court. Does the coffee shop work?",
    ],
  }),
  disagreeing: Object.freeze({
    setting: "a group planning session at work or school",
    role: "a teammate",
    personality: "enthusiastic but open to ideas",
    goal: "share a different view politely and stay part of the discussion.",
    openings: [
      "I think we should present the whole plan on the first slide. What do you think?",
      "Honestly, I'd keep the poster really simple and colourful. Agreed?",
      "I was thinking we should start the project by writing the report first.",
    ],
    suggested: [
      "I see what you mean, but I think it might be clearer if we split it into two slides. Could we try that?",
      "That's a fair idea. I'd prefer a simpler layout so it's easier to read. How about a middle ground?",
      "I hear you. I'd rather start with a quick plan first — could we sketch it together?",
    ],
  }),
  saying_no: Object.freeze({
    setting: "a friend asking a favour at the weekend",
    role: "a friend",
    personality: "persistent but not mean",
    goal: "decline the request while keeping the friendship friendly.",
    openings: [
      "Hey, could you cover my shift this Saturday? I know it's short notice.",
      "You're free tonight, right? Could you help me move a few boxes?",
      "Can you lend me your laptop for the weekend? I really need it.",
    ],
    suggested: [
      "I'm not able to this weekend, sorry. I hope you find someone — maybe ask again next time.",
      "I can't tonight, but I could help for a short while tomorrow if that works?",
      "I'd rather not lend it out, but I can help you back up your files if that helps.",
    ],
  }),
  clarifying: Object.freeze({
    setting: "a quick chat about arrangements",
    role: "a friend or colleague",
    personality: "a little vague",
    goal: "ask for the details you are unsure about.",
    openings: [
      "So we'll meet there at the usual time. You know the plan, right?",
      "Just send me the thing when you get a chance. You know what I mean.",
      "Let's go with the first option — it should be fine. Right?",
    ],
    suggested: [
      "Sorry, just to make sure — which place and what time did you mean?",
      "Could you tell me what 'the thing' is, so I send the right one?",
      "I want to get this right — which option was the first one again?",
    ],
  }),
  small_talk: Object.freeze({
    setting: "waiting together in a queue",
    role: "someone you don't know",
    personality: "pleasant",
    goal: "have a short, comfortable chat while you wait.",
    openings: [
      "This queue is longer than I expected. Are you getting the coffee too?",
      "Busy day today, huh? Is it always like this around this time?",
      "I haven't seen you here before. Do you come here often?",
    ],
    suggested: [
      "Yeah, it is pretty long! The coffee here is worth it though. Do you come often?",
      "It is busy. This is my first time here — is there anything you'd recommend?",
      "Not sure yet, I'm still deciding. What are you getting?",
    ],
  }),
  receiving_feedback: Object.freeze({
    setting: "a review at the end of a task",
    role: "your teacher or manager",
    personality: "supportive",
    goal: "receive feedback calmly and respond in a way that keeps things positive.",
    openings: [
      "Thanks for the work on this. The result was good — I'd just like a little more detail next time. How do you feel about it?",
      "That went really well overall. One small thing: try to double-check the spelling next time. What do you think?",
      "Nice job getting it done. Next time, could you let me know a bit earlier if you're stuck?",
    ],
    suggested: [
      "Thank you. I'll add more detail next time — could you show me what you mean?",
      "That's fair, I'll double-check the spelling. Thanks for letting me know.",
      "Sure, I can do that. I'll message you earlier if I get stuck. Thanks for the feedback.",
    ],
  }),
});

function pick(template, variantSeed) {
  const index = Math.abs(Math.trunc(variantSeed) % template.length);
  return template[index];
}

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export function buildScenarioConfig({
  difficulty = DEFAULT_DIFFICULTY,
  domain = "small_talk",
  contextHint = "",
  signals = {},
  variantSeed = 0,
} = {}) {
  const numericDifficulty = Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5
    ? difficulty
    : DEFAULT_DIFFICULTY;

  const resolvedDomain = getDomainById(domain) ? domain : "small_talk";
  const effectiveDifficulty = Math.max(1, numericDifficulty - (signals.simplify ? 1 : 0));
  const hintsEnabled = DIFFICULTY_LEVELS[effectiveDifficulty]?.hints === true || signals.provideHints === true;

  return {
    domain: resolvedDomain,
    difficulty: numericDifficulty,
    effectiveDifficulty,
    turnLimit: TURN_LIMIT_FOR(effectiveDifficulty),
    contextHint,
    hintsEnabled,
    variantSeed,
    aiEnabled: true,
  };
}

export function getFallbackScenario(config = {}) {
  const {
    domain = "small_talk",
    effectiveDifficulty = DEFAULT_DIFFICULTY,
    turnLimit = TURN_LIMIT_FOR(effectiveDifficulty),
    contextHint = "",
    hintsEnabled = DIFFICULTY_LEVELS[effectiveDifficulty]?.hints === true,
    variantSeed = 0,
  } = config;

  const template = DOMAIN_TEMPLATES[domain] ?? DOMAIN_TEMPLATES.small_talk;
  const opening = pick(template.openings, variantSeed);
  const suggested = template.suggested;

  return {
    id: `fallback-${domain}-${effectiveDifficulty}-v${variantSeed % 10}`,
    domain,
    title: `${template.setting.charAt(0).toUpperCase() + template.setting.slice(1)} chat`,
    setting: template.setting,
    goal: template.goal,
    context: `${template.setting.charAt(0).toUpperCase() + template.setting.slice(1)} — a friendly practice conversation.`,
    npc: {
      name: "Alex",
      role: template.role,
      personality: template.personality,
    },
    openingLine: opening,
    suggestedResponses: suggested,
    hint: hintsEnabled
      ? "A friendly reply can start with 'Hi' or 'Thanks' and then ask a short question."
      : "",
    difficulty: effectiveDifficulty,
    source: SCENARIO_SOURCE.FALLBACK,
    turnLimit,
  };
}

/**
 * Generate a scenario, preferring the AI provider and always degrading to the
 * deterministic fallback. Returns an object with `scenario`, `source` and
 * `aiAvailable`. Never throws.
 */
export async function generateScenario(config = {}, { apiKey } = {}) {
  const resolved = buildScenarioConfig(config);

  let aiScenario = null;
  let aiError = null;
  if (resolved.aiEnabled && apiKey) {
    try {
      aiScenario = await generateScenarioContent({ config: resolved, apiKey });
    } catch (error) {
      aiError = error?.message ?? String(error);
    }
  }

  if (aiScenario && typeof aiScenario === "object") {
    return {
      scenario: {
        id: `ai-${Date.now()}`,
        ...aiScenario,
        domain: resolved.domain,
        difficulty: resolved.effectiveDifficulty,
        source: SCENARIO_SOURCE.AI,
        turnLimit: resolved.turnLimit,
      },
      source: SCENARIO_SOURCE.AI,
      aiAvailable: true,
      aiError: null,
    };
  }

  return {
    scenario: getFallbackScenario({
      ...resolved,
      variantSeed: resolved.variantSeed + (config?.fallbackIndex ?? 0),
    }),
    source: SCENARIO_SOURCE.FALLBACK,
    aiAvailable: false,
    aiError,
  };
}

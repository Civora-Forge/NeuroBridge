export const LOG_STORAGE_KEY = "anxiety-tracker-logs-v2";
export const REFRAME_STORAGE_KEY = "anxiety-reframe-history-v1";

export const GROUNDING_STEPS = [
  "Name 5 things you can see",
  "Name 4 things you can feel",
  "Name 3 things you can hear",
  "Name 2 things you can smell",
  "Name 1 thing you can taste",
];

export const PMR_STEPS = [
  "Hands and forearms: tense 5 seconds, release 10 seconds.",
  "Shoulders: lift toward ears for 5 seconds, release slowly.",
  "Jaw and face: squeeze lightly for 5 seconds, then soften.",
  "Core: tighten abdomen for 5 seconds, then let go.",
  "Legs and feet: flex for 5 seconds, release fully.",
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "just",
  "very",
  "have",
  "been",
  "into",
  "about",
  "when",
  "what",
  "your",
  "will",
  "would",
  "could",
  "they",
  "them",
  "were",
]);

export const formatDateTimeInput = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatClock = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

export const clampLevel = (value) => Math.max(0, Math.min(10, Number(value)));

export const getTimeWindow = (isoDate) => {
  const hour = new Date(isoDate).getHours();
  if (hour >= 5 && hour <= 11) return "Morning";
  if (hour >= 12 && hour <= 16) return "Afternoon";
  if (hour >= 17 && hour <= 21) return "Evening";
  return "Night";
};

const tokenize = (text) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

export const analyzeLogs = (logs) => {
  const windows = {
    Morning: { total: 0, count: 0 },
    Afternoon: { total: 0, count: 0 },
    Evening: { total: 0, count: 0 },
    Night: { total: 0, count: 0 },
  };

  const triggerCounts = {};
  const keywordCounts = {};
  const keywordWindowCounts = {};
  const locationCounts = {};

  logs.forEach((entry) => {
    const window = getTimeWindow(entry.loggedAt);
    windows[window].total += entry.level;
    windows[window].count += 1;

    const trigger = entry.trigger.trim().toLowerCase();
    triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;

    tokenize(entry.trigger).forEach((keyword) => {
      keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      if (!keywordWindowCounts[keyword]) {
        keywordWindowCounts[keyword] = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
      }
      keywordWindowCounts[keyword][window] += 1;
    });

    const normalizedLocation = (entry.location || "unspecified").toLowerCase();
    locationCounts[normalizedLocation] = (locationCounts[normalizedLocation] || 0) + 1;
  });

  const averageByTimeOfDay = Object.entries(windows).map(([key, value]) => ({
    key,
    average: value.count ? Number((value.total / value.count).toFixed(2)) : 0,
    count: value.count,
  }));

  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([keyword, count]) => ({ keyword, count }));

  const mostFrequentTrigger =
    Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Not enough data";

  const highestAnxietyWindow =
    averageByTimeOfDay.filter((item) => item.count > 0).sort((a, b) => b.average - a.average)[0]?.key || "Not enough data";

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyLogs = logs.filter((entry) => new Date(entry.loggedAt).getTime() >= weekAgo);
  const weeklyAverage = weeklyLogs.length
    ? Number((weeklyLogs.reduce((sum, entry) => sum + entry.level, 0) / weeklyLogs.length).toFixed(2))
    : 0;

  const topLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Not enough data";

  let predictedRisk = "Log at least 3 entries to generate a risk prediction.";
  const strongestWindow = averageByTimeOfDay.filter((item) => item.count >= 2).sort((a, b) => b.average - a.average)[0];
  if (strongestWindow && strongestWindow.average >= 6.5) {
    predictedRisk = `${strongestWindow.key} appears elevated based on current anxiety averages.`;
  }

  const topKeyword = topKeywords[0];
  if (topKeyword && topKeyword.count >= 3) {
    const dominantWindow = Object.entries(keywordWindowCounts[topKeyword.keyword] || {}).sort((a, b) => b[1] - a[1])[0];
    if (dominantWindow?.[1] >= 2) {
      predictedRisk = `${dominantWindow[0]} may be high-risk when "${topKeyword.keyword}" trigger patterns show up.`;
    }
  }

  const dayBuckets = {};
  logs.forEach((entry) => {
    const dayKey = new Date(entry.loggedAt).toISOString().slice(0, 10);
    if (!dayBuckets[dayKey]) dayBuckets[dayKey] = { total: 0, count: 0 };
    dayBuckets[dayKey].total += entry.level;
    dayBuckets[dayKey].count += 1;
  });

  const last7Days = Object.entries(dayBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([date, value]) => ({ date, average: Number((value.total / value.count).toFixed(2)) }));

  return {
    averageByTimeOfDay,
    topKeywords,
    mostFrequentTrigger,
    highestAnxietyWindow,
    weeklyAverage,
    predictedRisk,
    topLocation,
    last7Days,
  };
};

export const generateReframe = (thought) => {
  const value = thought.trim();
  if (!value) return null;

  const reframeProfiles = [
    {
      name: "Presentation fear",
      regex: /(presentation|presenting|speech|public speaking|stage|audience|seminar|meeting|class talk|oral exam|pitch)/i,
      pattern: "Performance anxiety",
      evidencePrompt: "What 2 things usually go okay when you present, even if you're nervous?",
      balancedThought: "Nerves are normal before speaking. I can focus on one point at a time.",
      reinforcement: "Use a short opening line, slow your first sentence, and continue step by step.",
    },
    {
      name: "Exam or test stress",
      regex: /(exam|test|quiz|grades|marks|result|board exam|interview|viva)/i,
      pattern: "Future-focused anxiety",
      evidencePrompt: "What preparation have you already completed that supports a workable outcome?",
      balancedThought: "I don’t need perfect certainty; I can use the preparation I have right now.",
      reinforcement: "Break revision into 20-minute blocks and complete just one block now.",
    },
    {
      name: "Deadline pressure",
      regex: /(deadline|due date|late|submission|project|assignment|workload|too much work|behind schedule)/i,
      pattern: "Overwhelm projection",
      evidencePrompt: "Which one task matters most in the next 30 minutes?",
      balancedThought: "This feels heavy, but I can reduce pressure by doing one clear step first.",
      reinforcement: "Write top 3 tasks, start with the smallest high-impact task.",
    },
    {
      name: "Social fear",
      regex: /(people will judge|judg|embarrass|awkward|stupid|everyone.*watching|social|rejected|left out|ignored|humiliat|criticized)/i,
      pattern: "Mind reading",
      evidencePrompt: "What proof do you have about what others think, and what is just a fear?",
      balancedThought: "I cannot know everyone’s thoughts. Most people are focused on themselves.",
      reinforcement: "Choose one safe social action: eye contact, one sentence, then pause.",
    },
    {
      name: "Conflict anxiety",
      regex: /(fight|argument|conflict|scold|shout|yell|anger at home|parent upset|relationship tension)/i,
      pattern: "Threat anticipation",
      evidencePrompt: "What part is in your control, and what part belongs to the other person?",
      balancedThought: "Conflict is uncomfortable, but I can stay calm and choose respectful words.",
      reinforcement: "Use one boundary sentence and request a calmer follow-up conversation.",
    },
    {
      name: "Separation and attachment fear",
      regex: /(alone at home|away from|missing|separation|abandon|left me|not replying|no response|ghosted)/i,
      pattern: "Abandonment prediction",
      evidencePrompt: "What are 2 alternative explanations besides being abandoned?",
      balancedThought: "Distance or delay does not always mean rejection.",
      reinforcement: "Send one clear message, then do a grounding task before checking again.",
    },
    {
      name: "Catastrophizing",
      regex: /(disaster|catastrophe|ruined|worst|terrible|everything will fail|it will all go wrong|i'm doomed|end of everything)/i,
      pattern: "Catastrophizing",
      evidencePrompt: "What is the most likely outcome if this goes imperfectly, not perfectly?",
      balancedThought: "This is hard, but not a disaster. I can handle the next part.",
      reinforcement: "Write the next smallest action and do only that action now.",
    },
    {
      name: "All-or-nothing",
      regex: /(always|never|everyone|nobody|completely|totally|every time|no one|all ruined)/i,
      pattern: "All-or-nothing thinking",
      evidencePrompt: "Can you name one exception where this thought was not 100% true?",
      balancedThought: "This feels intense now, but reality is usually more mixed than absolute.",
      reinforcement: "Replace absolute words with 'sometimes' and 'right now'.",
    },
    {
      name: "Need for certainty/control",
      regex: /(uncertain|uncertainty|don't know|what will happen|out of control|can't control|need to know|not sure)/i,
      pattern: "Intolerance of uncertainty",
      evidencePrompt: "What can you control in the next hour, even if you can’t control everything?",
      balancedThought: "I can tolerate some uncertainty and still take useful actions.",
      reinforcement: "List controllables vs uncontrollables, then act on one controllable.",
    },
    {
      name: "Hopelessness",
      regex: /(can't|cannot|impossible|no point|hopeless|i give up|nothing helps|no way out)/i,
      pattern: "Hopeless prediction",
      evidencePrompt: "What challenge have you survived before that shows some coping ability?",
      balancedThought: "I may not fix everything now, but I can do one helpful step.",
      reinforcement: "Set a 2-minute timer and begin one tiny task.",
    },
    {
      name: "Panic sensations",
      regex: /(panic|heart racing|palpitation|can't breathe|shortness of breath|choking|dizzy|faint|shaky|sweating|chest tight|numb)/i,
      pattern: "Threat amplification",
      evidencePrompt: "Have these body sensations eased before when you slowed breathing?",
      balancedThought: "My body is in alarm mode. This sensation is intense but temporary.",
      reinforcement: "Exhale longer than inhale for 60-90 seconds and ground with 5-4-3-2-1.",
    },
    {
      name: "Health anxiety",
      regex: /(illness|disease|cancer|heart attack|symptom|medical|doctor visit|hospital|health scare|i am sick)/i,
      pattern: "Health threat overestimation",
      evidencePrompt: "What medical facts do you have right now versus feared assumptions?",
      balancedThought: "Concern for health is understandable, and I can respond with facts, not panic.",
      reinforcement: "Note symptoms once, follow your care plan, and avoid repeated checking loops.",
    },
    {
      name: "Contamination fear",
      regex: /(germ|dirty|contaminat|infection|unclean|sanitize|wash again|touching surfaces)/i,
      pattern: "Contamination threat bias",
      evidencePrompt: "What is a reasonable hygiene action versus anxiety-driven repetition?",
      balancedThought: "I can practice normal safety without chasing perfect certainty.",
      reinforcement: "Do one planned hygiene step and delay re-checking for 10 minutes.",
    },
    {
      name: "Perfection pressure",
      regex: /(perfect|mistake|mess(ed)? up|failed|failure|not good enough|must be best|flawless)/i,
      pattern: "Perfectionism",
      evidencePrompt: "What would 'good enough' look like for this exact situation?",
      balancedThought: "Progress matters more than perfection. One mistake does not erase effort.",
      reinforcement: "Define one realistic success criterion and stop when it is met.",
    },
    {
      name: "Overthinking",
      regex: /(overthink|overthinking|ruminat|what if|replay|looping thoughts|spiral|can't stop thinking|mind racing)/i,
      pattern: "Rumination loop",
      evidencePrompt: "Is this thought helping you act, or only repeating fear?",
      balancedThought: "I can notice this loop and return attention to the present task.",
      reinforcement: "Write one worry sentence once, then shift to a timed grounding task.",
    },
    {
      name: "Sleep-related anxiety",
      regex: /(can't sleep|insomnia|sleep|night worry|wake up|no sleep|restless night)/i,
      pattern: "Nighttime worry cycle",
      evidencePrompt: "What helps your body feel safer at night, even a little?",
      balancedThought: "Rest can come in waves; I can still support my body with calm routines.",
      reinforcement: "Dim screens, do 4-7-8 breathing for 3 cycles, and avoid clock-checking.",
    },
    {
      name: "Safety or travel fear",
      regex: /(travel|bus|train|flight|driving|road|accident|crowd|public place|outside feels unsafe)/i,
      pattern: "Safety overestimation",
      evidencePrompt: "What safety steps are already in place for this situation?",
      balancedThought: "I can prepare for safety without assuming the worst will happen.",
      reinforcement: "Plan route, carry one comfort item, and focus on the next checkpoint.",
    },
    {
      name: "Financial stress",
      regex: /(money|fees|rent|bills|debt|loan|cost|expenses|can't afford|financial)/i,
      pattern: "Scarcity alarm",
      evidencePrompt: "What is one concrete money action you can take today?",
      balancedThought: "Money stress is real, and I can reduce uncertainty one step at a time.",
      reinforcement: "List essentials, postpone non-essentials, and make one support call/message.",
    },
    {
      name: "New situations or change",
      regex: /(new place|new school|new job|change|transition|first day|unfamiliar|starting something)/i,
      pattern: "Novelty threat bias",
      evidencePrompt: "What part of this change is difficult, and what part is manageable today?",
      balancedThought: "New situations can feel unsafe at first, and I can adapt gradually.",
      reinforcement: "Prepare one script and one routine anchor for the new setting.",
    },
    {
      name: "Anger/frustration",
      regex: /(angry|frustrat|irritat|annoyed|mad)/i,
      pattern: "Emotional overload",
      evidencePrompt: "What boundary or need is underneath this frustration?",
      balancedThought: "My frustration signals a need. I can respond without attacking myself or others.",
      reinforcement: "Pause, unclench shoulders, and state one need clearly and calmly.",
    },
    {
      name: "Sadness/low mood",
      regex: /(sad|empty|low|worthless|alone|lonely)/i,
      pattern: "Negative filtering",
      evidencePrompt: "What small sign of support or strength also exists right now?",
      balancedThought: "This low feeling is real and it can pass; I still have options for support.",
      reinforcement: "Do one nurturing action now: hydrate, sunlight, or message someone safe.",
    },
    {
      name: "Digital/social media anxiety",
      regex: /(social media|instagram|whatsapp|seen zone|left on read|likes|followers|online status|phone check)/i,
      pattern: "Comparison anxiety",
      evidencePrompt: "What are you assuming from online signals that may be incomplete?",
      balancedThought: "Online activity does not fully define my worth or relationships.",
      reinforcement: "Take a 20-minute app break and do one offline grounding activity.",
    },
    {
      name: "General anxiety language",
      regex: /(anxious|anxiety|nervous|worried|scared|afraid|tense|stress(ed)?)/i,
      pattern: "General anxiety narrative",
      evidencePrompt: "What facts support this worry, and what facts support a calmer interpretation?",
      balancedThought: "Anxiety is present, and I can still choose a grounded next step.",
      reinforcement: "Slow breathing for 60 seconds, then complete one tiny task.",
    },
  ];

  const matched = reframeProfiles.find((profile) => profile.regex.test(value));
  if (!matched) {
    return {
      matched: false,
      matchLabel: null,
      pattern: null,
      evidencePrompt: null,
      balancedThought: null,
      reinforcement: null,
    };
  }

  return {
    matched: true,
    matchLabel: matched.name,
    evidencePrompt: matched.evidencePrompt,
    balancedThought: matched.balancedThought,
    reinforcement: matched.reinforcement,
    pattern: matched.pattern,
  };
};

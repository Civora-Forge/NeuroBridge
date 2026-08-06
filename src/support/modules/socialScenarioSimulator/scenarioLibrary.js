/**
 * scenarioLibrary.js — The Social Scenario Simulator's scripted content.
 *
 * Twelve scenarios across four categories (College, Workplace, Daily Life,
 * Relationships), three per category. Each scenario is a safe conversation to
 * practice: the AI partner plays the NPC, the engine matches the user's reply
 * to the closest scripted option, and the feedback service turns each turn
 * into a communication score with gentle, constructive notes.
 *
 * Data contract per scenario:
 *   id, category, title, description, difficulty, estimatedDurationMinutes,
 *   tags, objectives[], npc { name, role }, context, unexpectedPrompt,
 *   alternativePool[], moments[]
 *
 * A moment = { prompt, options[], fallback }.
 * An option = { text, keywords[], reply, cue, suggestion, quality }.
 */

import { QUALITY_PRESETS, SCENARIO_CATEGORIES } from "./socialScenarioTypes";

/** Low floor quality for the "no exact match" path — honest but never harsh. */
const FALLBACK_QUALITY = QUALITY_PRESETS.fallback;

export const SCENARIO_LIBRARY = [
  // ────────────────────────── COLLEGE ──────────────────────────
  {
    id: "college.asking-seminar-question",
    category: "college",
    title: "Asking a Question in Seminar",
    description: "You are in a small seminar and did not fully understand one part of the lesson.",
    difficulty: "easy",
    estimatedDurationMinutes: 6,
    tags: ["communication", "asking_questions", "confidence"],
    objectives: ["Signal that you want to speak", "Ask a clear question", "Close the exchange warmly"],
    npc: { name: "Dr. Chen", role: "professor" },
    context:
      "You are in a small seminar. The professor finishes explaining a chapter and pauses, looking around the room. You did not fully understand one part, and you have a few minutes before the end.",
    unexpectedPrompt:
      "Actually — hold on. Did you mean the reading or the lecture? I want to make sure I answer the right thing.",
    alternativePool: [
      "I'd like to ask about the study design — could you go over that part again?",
      "Could you repeat the section about the participants, please?",
    ],
    moments: [
      {
        prompt: "We have a few minutes left. I noticed you looked uncertain while I was explaining — did anything need a bit more detail?",
        options: [
          {
            text: "Yes, I have a question about the reading.",
            keywords: ["question", "reading"],
            reply: "Of course — go ahead. Which part felt unclear?",
            cue: "You signalled clearly that you wanted to speak, so the professor invited you in.",
            suggestion: "Opening with 'yes, I have a question' is a reliable way to enter a conversation.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I'm okay for now, thank you.",
            keywords: ["okay", "thank"],
            reply: "No problem at all. You can email me anytime if it comes up again later.",
            cue: "You declined politely and thanked the professor, which keeps the door open.",
            suggestion: "Adding 'thank you' keeps even a short reply warm and respectful.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "Take your time — there is no rush at all. Just raise your hand when you feel ready.",
          cue: "The professor stayed patient while you found your words.",
          suggestion: "Even a small 'yes' or 'no, thank you' helps the other person understand where you stand.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "So what exactly was unclear? I want to make sure everyone leaves on the same page.",
        options: [
          {
            text: "Could you explain the part about the study design again?",
            keywords: ["study", "design", "explain"],
            reply: "Of course. Let me walk through the study design once more — the key is who was in each group.",
            cue: "You named the exact topic, which made it easy for the professor to help you.",
            suggestion: "Naming the specific part ('the study design') gets you a precise answer.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Sorry, I'm not sure how to put it.",
            keywords: ["sorry", "not sure"],
            reply: "That's completely fine — sometimes it helps to point at the spot on the page.",
            cue: "It is okay to not have perfect words; the professor offered a way to help.",
            suggestion: "Try 'the part on page 12' when the right word is hard to find.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "No problem. Why don't we look at the diagram together and you can show me the part?",
          cue: "You did not have to have a perfect question — the professor offered a visual anchor.",
          suggestion: "Pointing at something specific (a page, a diagram) can replace the words you are reaching for.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Great question — thank you for asking. That is exactly the part that trips people up.",
        options: [
          {
            text: "Thank you, that makes sense now.",
            keywords: ["thank", "makes sense"],
            reply: "Wonderful — I'm glad it's clear. See you next session!",
            cue: "You closed the exchange with a clear 'thank you', a natural conversation ending.",
            suggestion: "Ending with a short thank-you signals that you got what you needed.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Cool.",
            keywords: ["cool"],
            reply: "Great. Have a good rest of your week!",
            cue: "A short positive reply still works, though a 'thank you' goes further.",
            suggestion: "Try adding one more word, like 'thank you' — it helps the other person feel heard.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "No worries at all. I'll also send the notes to everyone by email tonight.",
          cue: "The professor made sure you had a backup even without a long reply.",
          suggestion: "A brief 'thanks' at the end leaves the conversation feeling complete.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
  {
    id: "college.group-project",
    category: "college",
    title: "Group Project: Sharing Your Idea",
    description: "A study group is planning a project and you have an idea worth sharing.",
    difficulty: "medium",
    estimatedDurationMinutes: 8,
    tags: ["group_work", "communication", "confidence"],
    objectives: ["Offer a concrete idea", "Claim a clear task", "Confirm the plan"],
    npc: { name: "Priya", role: "classmate" },
    context:
      "Your study group is meeting to plan a class project. Everyone has been talking a lot, and you have an idea you think could help.",
    unexpectedPrompt:
      "Oh wait — one more thing. Our professor just emailed: the deadline moved up two days. What should we do?",
    alternativePool: [
      "I have an idea — we could each take one section. I could take the conclusion and check for mistakes.",
      "Could you say more about how we should split the work?",
    ],
    moments: [
      {
        prompt: "Okay, we need to split the work. Does anyone have ideas for how to organise this?",
        options: [
          {
            text: "I have an idea — we could each take one section of the report.",
            keywords: ["idea", "section", "each"],
            reply: "That sounds helpful! Which sections did you have in mind?",
            cue: "You offered a concrete idea and the group picked it up.",
            suggestion: "Starting with 'I have an idea' gives people a cue that you are about to contribute.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I don't know yet.",
            keywords: ["don't know"],
            reply: "That's okay — you can listen for a minute and jump in when something clicks.",
            cue: "It is always fine to be quiet first; the group gave you space.",
            suggestion: "Try adding 'can you explain more?' to stay involved while you think.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "Sure — we can also just make a list together so no one has to figure it out alone.",
          cue: "The group turned it into a shared list so nobody was stuck on their own.",
          suggestion: "A small question like 'how do we want to split this?' keeps the plan moving.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "I like the section idea. I could take the intro, and Dan can do research. What about you?",
        options: [
          {
            text: "I can take the conclusion and help check for mistakes.",
            keywords: ["conclusion", "check"],
            reply: "Great — checking for mistakes is really useful, thank you.",
            cue: "You claimed a clear task and offered an extra skill, which the group valued.",
            suggestion: "Naming your task and one skill ('I can take... and help with...') makes your role clear.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Whatever is left.",
            keywords: ["whatever", "left"],
            reply: "Okay, we'll leave a flexible slot for you — just tell us what you enjoy.",
            cue: "The group adapted, but a specific task is easier to plan around.",
            suggestion: "Try naming something concrete, like 'I can do the conclusion', so everyone knows the plan.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "No pressure — how about you pick one thing you'd enjoy, and we'll match the rest?",
          cue: "The group helped you choose instead of leaving you unsure.",
          suggestion: "Picking any one task first ('I can do X') makes the plan click into place.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Perfect. We meet again Friday — does that work for everyone?",
        options: [
          {
            text: "Friday works for me, and I'll bring my notes.",
            keywords: ["friday", "notes"],
            reply: "Perfect, see you Friday. Thanks for being organised!",
            cue: "You confirmed the time and added a helpful detail — a strong close.",
            suggestion: "Confirming a time and adding one small action ('I'll bring...') builds trust.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I think so.",
            keywords: ["think so"],
            reply: "Great — if anything changes, just message the group chat.",
            cue: "A short confirmation is fine; adding a reason makes it clearer.",
            suggestion: "Try 'Friday works for me' — a direct yes is easy for others to rely on.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "No worries — we'll put the time in the group chat so everyone can check.",
          cue: "The group made sure the plan was written down for you.",
          suggestion: "A clear 'yes, that works' helps others plan around you.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
  {
    id: "college.declining-invitation",
    category: "college",
    title: "Declining a Party Invitation",
    description: "Your roommate invited you to a party, but you really need a quiet night.",
    difficulty: "hard",
    estimatedDurationMinutes: 10,
    tags: ["boundaries", "assertiveness", "communication"],
    objectives: ["Decline kindly", "Hold your boundary", "End the talk warmly"],
    npc: { name: "Sam", role: "roommate" },
    context:
      "It is Friday afternoon. You had a long, tiring week and really need a quiet evening to rest. Your roommate is organising a party and just asked you to join.",
    unexpectedPrompt:
      "Hey, one last thing — my cousin is visiting and wants to meet everyone. Would you come by even just for five minutes?",
    alternativePool: [
      "Thanks for the invite, but I need a quiet night to rest — I'd love to catch up another time.",
      "I appreciate you asking. I'm going to skip tonight, but thank you for thinking of me.",
    ],
    moments: [
      {
        prompt: "Hey! Big party tonight at 8, you're coming right?",
        options: [
          {
            text: "Thanks for inviting me, but I need a quiet night to rest.",
            keywords: ["thanks", "quiet", "rest"],
            reply: "Of course, no problem at all. We'll keep it down.",
            cue: "You declined kindly and gave a clear reason, which made it easy for Sam to accept.",
            suggestion: "A clear 'no, thank you' with a short reason is polite and honest.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I can't.",
            keywords: ["can't"],
            reply: "No worries. Maybe another time!",
            cue: "Your 'no' was clear, though a small reason helps the other person understand.",
            suggestion: "Adding a short reason, like 'I need rest tonight', softens the refusal.",
            quality: QUALITY_PRESETS.good,
          },
          {
            text: "Maybe I'll come for a bit.",
            keywords: ["maybe", "come"],
            reply: "Awesome, see you at 8!",
            cue: "This left the door open, but now you are committed to something you did not want.",
            suggestion: "If you need rest, a gentle 'not tonight' protects your needs.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "No pressure — you don't have to decide this second.",
          cue: "Sam gave you time, which is your cue to check what you really need.",
          suggestion: "Take a breath and answer what YOU need, like 'I'll skip tonight to rest'.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Are you sure? Everyone's been looking forward to seeing you.",
        options: [
          {
            text: "I appreciate that. I'm sure — I need some quiet time tonight.",
            keywords: ["appreciate", "sure", "quiet"],
            reply: "Totally fair. You take care of yourself — we'll catch up soon.",
            cue: "You held your boundary with warmth, and Sam respected it.",
            suggestion: "Repeating your reason calmly ('I'm sure — I need quiet') makes boundaries stick.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I guess I can come for a little while.",
            keywords: ["guess", "little"],
            reply: "Great, see you soon!",
            cue: "Sam heard a yes, so your quiet evening is gone — this is the trade-off.",
            suggestion: "If you truly need rest, staying firm is the kind choice for yourself.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "Just so you know, it might get loud. You do whatever feels right for you.",
          cue: "Sam gave you an honest heads-up, trusting you to decide.",
          suggestion: "Your needs are valid — 'I need a quiet evening' is a complete answer.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Alright. Well, I'll save you a snack in case you change your mind.",
        options: [
          {
            text: "Thank you, that's really kind. I'll let you know if things change.",
            keywords: ["thank", "kind"],
            reply: "Sounds good. Rest well!",
            cue: "You ended warmly while keeping your boundary — a balanced close.",
            suggestion: "Thanking someone for their kindness while holding your choice is a great skill.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Whatever.",
            keywords: ["whatever"],
            reply: "Okay... well, take care.",
            cue: "A flat reply can leave the other person unsure how to respond.",
            suggestion: "Try 'thank you anyway' — it keeps the warmth without changing your answer.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "No worries either way. See you around!",
          cue: "Sam let the topic go, so the conversation ended on an easy note.",
          suggestion: "A final 'thank you' makes any close feel kind.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },

  // ────────────────────────── WORKPLACE ──────────────────────────
  {
    id: "workplace.asking-colleague-help",
    category: "workplace",
    title: "Asking a Coworker for Help",
    description: "You are new at work and a task is confusing. A coworker knows it well.",
    difficulty: "easy",
    estimatedDurationMinutes: 6,
    tags: ["asking_questions", "workplace", "confidence"],
    objectives: ["Ask directly for help", "Name the confusing step", "Confirm your understanding"],
    npc: { name: "Mr. Okafor", role: "coworker" },
    context:
      "You started at a new office last month. Today a task is confusing, and you remember a coworker mentioning they know it well.",
    unexpectedPrompt:
      "Ah, actually — I just got pulled into a meeting. Can we pick this up after lunch?",
    alternativePool: [
      "Could I ask you for help with the invoice approval? I'm not sure who to send it to.",
      "Would you have a few minutes to walk me through the approval step?",
    ],
    moments: [
      {
        prompt: "Morning! How's it going with the new role?",
        options: [
          {
            text: "Pretty good, thanks. Actually, could I ask you for help with a task?",
            keywords: ["help", "task", "ask"],
            reply: "Of course! What's the task?",
            cue: "You asked directly for help, which is exactly how teams work best.",
            suggestion: "Asking a clear question ('could I ask you for help?') makes it easy to say yes.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Fine.",
            keywords: ["fine"],
            reply: "Glad to hear it. Let me know if anything comes up.",
            cue: "This kept the door open, but did not ask for the help you need.",
            suggestion: "If you need help, add a small question — that is what coworkers are there for.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "No rush — you can flag it whenever you're ready.",
          cue: "Your coworker left the invitation open.",
          suggestion: "A short 'could you help me with X?' is all you need.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Happy to help. Which part is confusing you?",
        options: [
          {
            text: "The step where we approve the invoice — I'm not sure who to send it to.",
            keywords: ["invoice", "approve", "send"],
            reply: "Ah, that goes to the finance team. I'll show you the exact steps.",
            cue: "You named the exact step and your gap, so help could be precise.",
            suggestion: "Naming the specific step ('the invoice approval') gets you a specific answer.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "The whole thing.",
            keywords: ["whole"],
            reply: "Okay — let's go through it from the top, one step at a time.",
            cue: "Broad help is still available, but a specific question gets a faster answer.",
            suggestion: "Try to find the single step that trips you up — that is the fastest path to clarity.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "Let's open it together on screen and walk through each step.",
          cue: "Your coworker offered to work through it side by side.",
          suggestion: "Saying 'I'm confused about step 3' helps the helper know where to start.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Done — that should be it. Does it make sense now?",
        options: [
          {
            text: "Yes, thank you for showing me. I've got it from here.",
            keywords: ["thank", "got it"],
            reply: "Anytime! That's what I'm here for.",
            cue: "You confirmed understanding and thanked the helper — a clean close.",
            suggestion: "Confirming 'that makes sense now' tells the helper their time helped.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I think so.",
            keywords: ["think so"],
            reply: "Good — shout if it gets tricky again.",
            cue: "A short reply is fine; naming what you understood builds even more trust.",
            suggestion: "Try 'yes, the finance team part makes sense now' — it shows you listened.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "No stress — this is brand new. You'll get it with practice.",
          cue: "Your coworker made room for learning, no judgment.",
          suggestion: "Saying 'thanks, I'll try it now' is enough to close helpfully.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
  {
    id: "workplace.change-of-plans",
    category: "workplace",
    title: "Handling a Change of Plans",
    description: "Your team lead moved a deadline up and your plan for the day changed.",
    difficulty: "medium",
    estimatedDurationMinutes: 8,
    tags: ["flexibility", "workplace", "planning"],
    objectives: ["Acknowledge the change", "Ask for priorities", "Confirm a realistic commitment"],
    npc: { name: "Sarah", role: "team lead" },
    context:
      "You planned your whole morning around one task. Your team lead just sent a message that the deadline moved up and the plan has changed.",
    unexpectedPrompt:
      "Also — the client asked for extra charts. Is that something you can take on as well?",
    alternativePool: [
      "Thanks for letting me know. What should I prioritise first?",
      "Can you help me set the order of tasks so I can adjust my plan?",
    ],
    moments: [
      {
        prompt: "Quick heads-up: the client needs the report by tomorrow instead of Friday. Can we adjust?",
        options: [
          {
            text: "Thanks for letting me know. What should I reprioritise first?",
            keywords: ["reprioritise", "first", "know"],
            reply: "Good question — the summary section is the priority, then the charts.",
            cue: "You acknowledged the change and asked for a clear order, which is a strong work skill.",
            suggestion: "Asking 'what first?' turns a surprise change into a clear plan.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "But I planned my whole morning.",
            keywords: ["planned", "morning"],
            reply: "I hear you, it's frustrating. Let's protect the most important part of your plan.",
            cue: "Your feeling is valid, and naming it helps the team support you.",
            suggestion: "You can share the feeling AND ask for next steps — both matter.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "Let's take it one step at a time and see what we can move.",
          cue: "Your lead slowed things down so the change felt manageable.",
          suggestion: "Try 'what's the most important thing now?' to anchor yourself.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "The summary is priority one. Is it realistic for you to finish it by 2pm?",
        options: [
          {
            text: "Yes, I can have it done by 2pm.",
            keywords: ["yes", "2pm", "done"],
            reply: "Great — that's a solid commitment. I'll handle the charts.",
            cue: "You gave a clear, realistic yes, so the team could build around you.",
            suggestion: "A direct 'yes, I can' with a time builds trust.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I'm not sure.",
            keywords: ["not sure"],
            reply: "Okay — what part feels uncertain? Let's figure it out together.",
            cue: "Your lead asked a follow-up instead of guessing, which is a safe space.",
            suggestion: "Add what you need, like 'I'm not sure about the data — can I get the figures?'",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "No pressure to say yes instantly. Take a minute and tell me what you need.",
          cue: "Your lead gave you time to check your own capacity.",
          suggestion: "Answer with a number ('by 3pm works for me') or a need ('I'll need the data first').",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Perfect, you're on it. And thanks for being flexible with the plan.",
        options: [
          {
            text: "Happy to help. It helps that I know the priority order now.",
            keywords: ["help", "priority"],
            reply: "Exactly — clear priorities make everything easier. Great teamwork!",
            cue: "You reflected on what helped, reinforcing a positive work relationship.",
            suggestion: "Naming what helped ('knowing the priority order') helps leaders do more of it.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Okay.",
            keywords: ["okay"],
            reply: "Alright — check in with me when it's done.",
            cue: "A minimal reply is fine, though a short sentence closes warmer.",
            suggestion: "Try 'no problem' or 'will do' — it acknowledges the message clearly.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "I'll circle back before lunch to see how it's going.",
          cue: "Your lead planned a check-in, so you won't be left alone with the change.",
          suggestion: "A simple 'okay, thanks for the heads-up' keeps things moving.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
  {
    id: "workplace.giving-feedback",
    category: "workplace",
    title: "Giving Feedback to a Team Member",
    description: "A teammate keeps editing your work without talking to you first.",
    difficulty: "hard",
    estimatedDurationMinutes: 10,
    tags: ["assertiveness", "boundaries", "feedback"],
    objectives: ["Appreciate the intent", "Set a clear boundary", "Agree on a next step"],
    npc: { name: "Jamie", role: "teammate" },
    context:
      "You are working on a shared document. A teammate keeps changing your part of it without discussing it first, and it is causing confusion. You want to raise it kindly and clearly.",
    unexpectedPrompt:
      "Actually, I should be honest — I also changed the layout on your page because I was rushed. I'm sorry.",
    alternativePool: [
      "Thanks for improving the flow. I'd like us to agree before changing each other's sections.",
      "I appreciate the edits. Going forward, can we discuss changes together?",
    ],
    moments: [
      {
        prompt: "Hey — I moved some of your sections around to tighten the flow. Hope that's okay!",
        options: [
          {
            text: "Thanks for thinking of the flow. I'd like us to talk before changing each other's sections.",
            keywords: ["talk", "sections", "before"],
            reply: "Oh, I didn't realise. Thanks for telling me — I'll check in first next time.",
            cue: "You appreciated the intent while setting a clear boundary — that is assertive, not aggressive.",
            suggestion: "Phrase 'I like X, and I need Y' to pair appreciation with a boundary.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Whatever, it's fine.",
            keywords: ["whatever", "fine"],
            reply: "Great — let me know if you disagree with any of the edits.",
            cue: "This avoided conflict, but the confusion may keep happening.",
            suggestion: "If something matters to you, it's okay to say 'can we decide changes together?'",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "Ah, I'm sorry if that stepped on your work — that wasn't my intention.",
          cue: "Jamie responded to the tension, so you have an opening to talk.",
          suggestion: "You can say 'I'd like changes to go through us both' without blaming anyone.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Understood. Was there a specific change that bothered you?",
        options: [
          {
            text: "The intro — I had written it for a specific audience, and it got replaced.",
            keywords: ["intro", "audience", "replaced"],
            reply: "That makes sense — I didn't know about the audience. Let's put it back and keep your version.",
            cue: "You named the exact change and the reason, so the fix was easy.",
            suggestion: "Specific beats general: name the section and why it matters to you.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Just, you know, everything you changed.",
            keywords: ["everything"],
            reply: "Okay, that's a lot. Can we go through them one by one tomorrow?",
            cue: "Broad feedback still got a response, but specific points are easier to act on.",
            suggestion: "Pick the one change that matters most and start there.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "I see — let's not guess. We can look at the document together so it's clear.",
          cue: "Jamie suggested looking together, avoiding any blame game.",
          suggestion: "Pointing at one concrete spot keeps the conversation calm and practical.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Good call. New rule: we discuss edits before saving. Sound fair?",
        options: [
          {
            text: "Yes, that sounds fair. Thank you for being open to it.",
            keywords: ["fair", "open"],
            reply: "Thank YOU for raising it — that took courage. Better teamwork now.",
            cue: "You closed with agreement and thanks, strengthening the relationship.",
            suggestion: "Closing with 'yes, that works for me' turns a hard talk into a shared plan.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Yeah.",
            keywords: ["yeah"],
            reply: "Cool. Same page now!",
            cue: "A short yes works, though adding 'thank you' makes the close warmer.",
            suggestion: "Try 'yeah, that works — thanks' to land the agreement clearly.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "We'll write the rule in the doc header so nobody forgets.",
          cue: "Jamie made the agreement concrete so it lasts beyond the moment.",
          suggestion: "A final 'great, that works for me' seals the new agreement.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },

  // ────────────────────────── DAILY LIFE ──────────────────────────
  {
    id: "daily_life.cafe-order",
    category: "daily_life",
    title: "Ordering at a Cafe",
    description: "It is your turn to order, and you want to get your order exactly right.",
    difficulty: "easy",
    estimatedDurationMinutes: 5,
    tags: ["daily_errands", "communication", "confidence"],
    objectives: ["Give a complete order", "Answer follow-up questions", "Close warmly"],
    npc: { name: "Mia", role: "barista" },
    context:
      "You are at your favourite cafe. The line is short and it is your turn to order, but the menu board is busy and you want to be sure you get it right.",
    unexpectedPrompt: "Oh, one moment — would you like that iced or hot?",
    alternativePool: [
      "Hi, I'd like a medium oat-milk latte, please.",
      "Can I get a medium oat-milk latte, please?",
    ],
    moments: [
      {
        prompt: "Hi there! What can I get for you today?",
        options: [
          {
            text: "Hi, I'd like a medium oat-milk latte, please.",
            keywords: ["latte", "medium"],
            reply: "One medium oat-milk latte — coming right up!",
            cue: "You gave the order in one clear sentence, so the barista got it on the first try.",
            suggestion: "Size + drink + milk is a complete order formula: 'a medium oat-milk latte'.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "A coffee.",
            keywords: ["coffee"],
            reply: "Sure — do you have a size or milk preference?",
            cue: "The barista asked one small follow-up to complete your order.",
            suggestion: "Adding size and milk avoids the follow-up: 'a medium coffee, please'.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "No rush — take your time with the menu. I'm here whenever you're ready.",
          cue: "The barista gave you space to look without pressure.",
          suggestion: "When ready, 'I'd like X, please' is all you need.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Anything else for you today?",
        options: [
          {
            text: "That's all, thank you.",
            keywords: ["that's all", "thank"],
            reply: "Perfect — it'll be ready at the end of the counter!",
            cue: "You wrapped up your order clearly and politely.",
            suggestion: "A clear 'that's all, thank you' ends an order cleanly.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "No.",
            keywords: ["no"],
            reply: "Got it — I'll have it right out.",
            cue: "A short answer works here, since the question was simple.",
            suggestion: "Adding 'thank you' keeps even short answers friendly.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "Sure thing — I'll start making it now.",
          cue: "The conversation moved forward smoothly either way.",
          suggestion: "A polite 'that's all, thanks' makes a friendly close.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Here's your latte. Have a great day!",
        options: [
          {
            text: "Thank you so much, you too!",
            keywords: ["thank", "too"],
            reply: "Thanks! Enjoy your drink!",
            cue: "You exchanged a warm close — the social loop is complete.",
            suggestion: "Mirroring a wish ('you too!') is a simple, friendly closer.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Thanks.",
            keywords: ["thanks"],
            reply: "Anytime!",
            cue: "A short thank-you still lands well.",
            suggestion: "One word works — a friendly tone carries the rest.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "There you go — let me know if you need anything else.",
          cue: "The barista made the close easy.",
          suggestion: "Even a quiet smile and a 'thanks' finishes the exchange kindly.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
  {
    id: "daily_life.returning-item",
    category: "daily_life",
    title: "Returning an Item to a Store",
    description: "Your new backpack arrived broken and you need to exchange it.",
    difficulty: "medium",
    estimatedDurationMinutes: 7,
    tags: ["daily_errands", "assertiveness", "communication"],
    objectives: ["State the problem clearly", "Make a clear choice", "Accept help confidently"],
    npc: { name: "Leon", role: "store associate" },
    context:
      "You bought a backpack online but it arrived with a broken zipper. You brought it back to the store to exchange it. This is the first time you've done this alone.",
    unexpectedPrompt:
      "Just to double-check — did you want the exact same model, or were you thinking of a different size?",
    alternativePool: [
      "Hi, I'd like to return this backpack — the zipper is broken.",
      "Could I exchange this for a replacement, please?",
    ],
    moments: [
      {
        prompt: "Welcome back! How can I help you today?",
        options: [
          {
            text: "Hi, I'd like to return this backpack — the zipper is broken.",
            keywords: ["return", "zipper", "broken"],
            reply: "Oh no, sorry about that. Do you have your receipt?",
            cue: "You stated the problem clearly, so the assistant could help right away.",
            suggestion: "Opening with the action ('I'd like to return') + the reason makes the ask clear.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "This thing is broken.",
            keywords: ["broken"],
            reply: "Let's take a look — what part isn't working?",
            cue: "The assistant helped you find the words, no problem.",
            suggestion: "Try 'the zipper is broken' — naming the part speeds things up.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "No worries — take your time. We can figure it out together.",
          cue: "The assistant made it a team effort, lowering the pressure.",
          suggestion: "Even 'I need help with a return' is a perfect first sentence.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "I found the order in the system — I can offer a replacement or a refund.",
        options: [
          {
            text: "A replacement would be great, if it's not too much trouble.",
            keywords: ["replacement", "trouble"],
            reply: "Not trouble at all — I'll grab a new one from the back.",
            cue: "You made a clear choice with a polite tone, which the assistant appreciated.",
            suggestion: "'A replacement would be great' is a complete, polite answer.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I don't care, whatever.",
            keywords: ["whatever"],
            reply: "Okay — I'll set up a replacement for you, and you can swap it for anything else in store if you like.",
            cue: "The assistant still made it easy, even with a flat answer.",
            suggestion: "Naming a preference ('replacement, please') keeps you in control of the outcome.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "No rush — you can also look around and decide in a few minutes.",
          cue: "You got extra time to decide, no pressure.",
          suggestion: "A clear 'replacement, please' or 'refund, please' is all you need.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Here's your new backpack. Want me to check the zipper with you before you leave?",
        options: [
          {
            text: "Yes, please — that would help.",
            keywords: ["yes", "help"],
            reply: "Of course. I'll unzip and zip it a few times right here.",
            cue: "You accepted help and got peace of mind — a great use of the moment.",
            suggestion: "Accepting a helpful offer is a skill too: 'yes, please' works.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "It's fine.",
            keywords: ["fine"],
            reply: "No problem. Have a good day!",
            cue: "A short decline is perfectly okay.",
            suggestion: "If you'd rather not, 'it's fine, thank you' closes it politely.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "I'll check it myself, and you're covered by the return window either way.",
          cue: "The assistant reassured you with a backup plan.",
          suggestion: "A simple 'yes, please' gives you extra confidence.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
  {
    id: "daily_life.neighbor-noise",
    category: "daily_life",
    title: "Talking to a Neighbor About Noise",
    description: "A neighbor's dog barks all afternoon, and you decided to talk about it.",
    difficulty: "hard",
    estimatedDurationMinutes: 9,
    tags: ["boundaries", "assertiveness", "conflict_resolution"],
    objectives: ["Open the conversation gently", "Propose a practical fix", "Close on a good note"],
    npc: { name: "Mr. Torres", role: "neighbor" },
    context:
      "Your neighbor's dog has been barking all afternoon while he is away. It is making it hard for you to concentrate. You have been nervous about knocking, but you have decided to talk to him.",
    unexpectedPrompt:
      "By the way — she's usually calm; I think a delivery truck has been setting her off. Does that match what you're hearing?",
    alternativePool: [
      "Hi, sorry to bother you. Could we talk about the barking during the day?",
      "I wanted to ask about the dog barking mid-morning — could she spend that time inside?",
    ],
    moments: [
      {
        prompt: "Hello there — what can I do for you?",
        options: [
          {
            text: "Hi, sorry to bother you. Could we talk about the dog barking during the day?",
            keywords: ["bother", "barking", "talk"],
            reply: "Oh, I'm sorry about that — I've been at work and didn't realise. Tell me more.",
            cue: "You opened politely and named the issue, so your neighbor listened instead of getting defensive.",
            suggestion: "A gentle opener ('sorry to bother you') lowers tension before you raise a concern.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Your dog is really loud.",
            keywords: ["loud"],
            reply: "Hmm, I'm sorry to hear that. When does it bother you most?",
            cue: "The message got through, though the direct wording made it a little tense at first.",
            suggestion: "Try 'could we talk about the barking?' — it invites teamwork.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "I want to make sure I understand. Would you like to come in for a moment to talk?",
          cue: "Your neighbor invited you in, showing he wants to work it out.",
          suggestion: "Starting with 'could we talk about...' makes the conversation easier for both sides.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "I see — so the barking happens mostly mid-morning while I'm out. What would help?",
        options: [
          {
            text: "Maybe a shorter time outside, or a toy to keep her busy — those would help me a lot.",
            keywords: ["shorter", "toy", "busy"],
            reply: "That's a fair idea. I can also look into a little training. Let's try it.",
            cue: "You proposed specific, practical fixes, which made the solution easy to agree on.",
            suggestion: "Offering solutions ('maybe X or Y would help') turns a complaint into a plan.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I don't know, you figure it out.",
            keywords: ["don't know"],
            reply: "I understand you're frustrated. Let me think of some options and get back to you.",
            cue: "Your neighbor took responsibility, even though the reply was a bit blunt.",
            suggestion: "Even one suggestion, like 'a toy to keep her busy', helps reach agreement faster.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "Okay — let's keep it simple. I'll try a couple of changes and check back with you.",
          cue: "Your neighbor committed to trying, which is a good outcome.",
          suggestion: "Small specific requests ('could she be inside mid-morning?') are easier to agree to.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "I'll start tomorrow. Thanks for coming over and telling me directly.",
        options: [
          {
            text: "Thank you for listening — I really appreciate it.",
            keywords: ["thank", "appreciate"],
            reply: "Of course. Good neighbors look out for each other.",
            cue: "You closed the talk warmly, so the relationship stays friendly.",
            suggestion: "Ending with 'thank you for listening' reinforces the positive moment.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Okay, bye.",
            keywords: ["bye"],
            reply: "Take care. I'll keep you posted.",
            cue: "A short close works, though the exchange deserved a small thank-you.",
            suggestion: "Try 'thanks for understanding' to seal the good outcome.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "I'll text you if anything changes. Have a good rest of your day.",
          cue: "Your neighbor kept the channel open for updates.",
          suggestion: "A simple 'thank you' makes the ending feel complete.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },

  // ────────────────────────── RELATIONSHIPS ──────────────────────────
  {
    id: "relationships.reconnect-friend",
    category: "relationships",
    title: "Reconnecting with a Friend",
    description: "You haven't talked to a classmate in a few weeks and want to reconnect.",
    difficulty: "easy",
    estimatedDurationMinutes: 6,
    tags: ["friendship", "communication", "connection"],
    objectives: ["Answer warmly", "Ask a follow-up", "Confirm the plan"],
    npc: { name: "Alex", role: "classmate" },
    context:
      "You haven't talked to a classmate in a couple of weeks. You both sit near each other, and you have been wanting to reconnect without it feeling awkward.",
    unexpectedPrompt:
      "Oh! By the way, a few of us are going for smoothies after the session — you should come too!",
    alternativePool: [
      "Hi! I've been busy with assignments, but it's good to see you. How about you?",
      "Nice to see you! I'd love to catch up — what time does the study session start?",
    ],
    moments: [
      {
        prompt: "Hey, haven't seen you around much lately! How've you been?",
        options: [
          {
            text: "Hi! I've been okay — a bit busy with assignments. How about you?",
            keywords: ["busy", "assignments", "how about you"],
            reply: "Same here, the workload is heavy! Good to see you though.",
            cue: "You answered and asked back, which keeps a conversation going smoothly.",
            suggestion: "Answer + 'how about you?' is a classic two-part opener that keeps things flowing.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Fine.",
            keywords: ["fine"],
            reply: "Just fine? I hope things pick up!",
            cue: "The conversation can continue, but the short answer made Alex work a little.",
            suggestion: "Add one detail ('fine, busy with projects') to keep the conversation alive.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "No worries if you're busy. It's nice to see you either way!",
          cue: "Alex kept it warm, so there is no pressure at all.",
          suggestion: "Even 'busy but okay' gives the other person something to respond to.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "It is good to see you! Are you coming to the study session on Thursday?",
        options: [
          {
            text: "I'd like to — what time does it start?",
            keywords: ["time", "start"],
            reply: "4pm at the library, ground floor. I'll save you a seat!",
            cue: "You expressed interest and asked for the details you needed.",
            suggestion: "Asking for the specifics ('what time?') is a great way to say yes.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Maybe.",
            keywords: ["maybe"],
            reply: "No pressure — just let me know before Thursday if you can make it.",
            cue: "A 'maybe' leaves it open, but Alex needs an answer to plan.",
            suggestion: "Try 'I'd like to come' or 'I can't this week' — both are easier to plan around.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "It's a chill session, no pressure. You can drop by even for 20 minutes.",
          cue: "Alex made the invitation low-pressure, so you can decide easily.",
          suggestion: "A clear 'yes' or 'no' helps your friend plan — either is okay.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Great, I'll text you the room number. Looking forward to it!",
        options: [
          {
            text: "Awesome, thank you! See you Thursday.",
            keywords: ["thank", "thursday"],
            reply: "See you Thursday!",
            cue: "You confirmed the plan warmly — a clean, friendly close.",
            suggestion: "Confirming a plan ('see you Thursday') makes the connection feel real.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Ok.",
            keywords: ["ok"],
            reply: "Cool, talk soon!",
            cue: "A short 'ok' works, though mirroring the warmth goes further.",
            suggestion: "Try 'great, see you then' — it matches Alex's energy.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "Alright, I'll send the details. Great to reconnect!",
          cue: "The plan is set and the friendship is warm again.",
          suggestion: "A quick 'thanks, see you' completes the reconnect.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
  {
    id: "relationships.need-space",
    category: "relationships",
    title: "Telling a Friend You Need Space",
    description: "A friend messages every day, and you need some quiet time to recharge.",
    difficulty: "medium",
    estimatedDurationMinutes: 8,
    tags: ["boundaries", "friendship", "honesty"],
    objectives: ["Acknowledge their message", "Set a gentle boundary", "Keep the trust"],
    npc: { name: "Jordan", role: "close friend" },
    context:
      "Your friend has been sending a lot of messages every day. You care about them, but you are feeling overwhelmed and need some quiet time. You want to be honest without hurting them.",
    unexpectedPrompt:
      "One more thing — is there anything I can do to make the quiet time easier for you?",
    alternativePool: [
      "I saw your message and it made me smile. I need a bit of quiet time this week, though.",
      "Thanks for checking in. I need some space for a few days — I'll reach out after.",
    ],
    moments: [
      {
        prompt: "Heyy! Did you see the meme I sent? What do you think?",
        options: [
          {
            text: "I did see it, it made me smile. I need a bit of quiet time this week though.",
            keywords: ["quiet", "time", "smile"],
            reply: "Oh okay — thanks for telling me. Take all the time you need.",
            cue: "You acknowledged their message AND set a gentle boundary — both feelings respected.",
            suggestion: "'I saw it + I need quiet' pairs warmth with honesty.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Sorry, can't talk.",
            keywords: ["can't talk"],
            reply: "No worries, talk when you're free!",
            cue: "The message got across, but without a reason your friend might worry.",
            suggestion: "Adding one small reason ('I need some quiet') helps your friend understand.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "That's totally fine. I don't want to add stress — tell me what you need.",
          cue: "Jordan made it safe to be honest, which is exactly what you hoped.",
          suggestion: "You can say 'I need some quiet time' — a friend will hear it kindly.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Got it. Should I stop messaging for a bit?",
        options: [
          {
            text: "Yes, please — a few days of space would help, and I'll reach out after.",
            keywords: ["space", "few days", "reach out"],
            reply: "Sounds good. I'll give you space — message me when you're ready.",
            cue: "You gave a clear timeline, so your friend knew exactly what to do.",
            suggestion: "A clear boundary + a promise ('I'll reach out after') keeps trust strong.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I don't know.",
            keywords: ["don't know"],
            reply: "Okay, then I'll keep checking in gently, okay?",
            cue: "Without a clear answer, Jordan filled the gap — which may not be what you want.",
            suggestion: "Try 'maybe check back in a few days' — it gives your friend a clear cue.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "No problem — you take the lead. I'll follow your pace.",
          cue: "Jordan let you set the pace, taking pressure off.",
          suggestion: "Naming a rough time ('a few days') makes the boundary easier for both of you.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Alright. I'll be here when you're ready. Take care of yourself.",
        options: [
          {
            text: "Thank you for understanding — it really means a lot.",
            keywords: ["thank", "understanding"],
            reply: "Always. That's what friends are for.",
            cue: "You closed with genuine gratitude, deepening the trust between you.",
            suggestion: "Ending with 'thank you for understanding' reinforces how much you value the friendship.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Thanks.",
            keywords: ["thanks"],
            reply: "Anytime. See you soon!",
            cue: "A short thanks still closes warmly.",
            suggestion: "Adding 'it means a lot' makes your friend feel truly appreciated.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "No rush — whenever you're ready to chat, I'll be around.",
          cue: "Your friend left the door open with no pressure.",
          suggestion: "A warm 'thanks for being patient' completes the boundary beautifully.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
  {
    id: "relationships.making-up",
    category: "relationships",
    title: "Making Up After a Disagreement",
    description: "You and a close friend had a misunderstanding, and you want to repair it.",
    difficulty: "hard",
    estimatedDurationMinutes: 10,
    tags: ["conflict_resolution", "friendship", "apology"],
    objectives: ["Take the first step", "Share your feeling without blame", "Agree on a way forward"],
    npc: { name: "Casey", role: "close friend" },
    context:
      "You and your friend had a misunderstanding two days ago and haven't talked since. You've thought it over, and you want to reach out to repair the friendship.",
    unexpectedPrompt:
      "Wait — before we wrap up, can we also talk about what we're doing this weekend? I don't want us to avoid each other.",
    alternativePool: [
      "Hey. I've been thinking about what happened, and I'm sorry for my part in it.",
      "I felt hurt when plans changed without a word. I want to understand what happened.",
    ],
    moments: [
      {
        prompt: "Hey. I wasn't sure if you'd want to talk.",
        options: [
          {
            text: "Hey. I do want to talk — I've been thinking about what happened and I'm sorry.",
            keywords: ["talk", "thinking", "sorry"],
            reply: "Thanks for saying that. I was upset, but I didn't want this to end our friendship either.",
            cue: "You took the first step with a genuine apology — that is the hardest and most powerful move.",
            suggestion: "'I'm sorry' + a real reason makes an apology feel sincere.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Hey, you left me on read, you know.",
            keywords: ["left me on read"],
            reply: "I know — I needed a minute. I didn't mean to hurt you.",
            cue: "Naming the hurt is okay, but starting with blame can close doors before opening them.",
            suggestion: "Try 'I've been thinking about us' — it invites connection instead of blame.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "It's okay. I'm just glad you reached out.",
          cue: "Casey was ready to rebuild — your message opened the door.",
          suggestion: "A simple 'I want to talk' is enough to start repairing.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "I'm sorry too. I think I overreacted. What bothered you the most?",
        options: [
          {
            text: "When you cancelled without explaining, I thought I'd done something wrong.",
            keywords: ["cancelled", "explaining", "wrong"],
            reply: "I'm really sorry — it was about my stress, not you. I should have told you.",
            cue: "You shared your feeling without attacking, so Casey could hear it and respond honestly.",
            suggestion: "'I felt X when Y' shares feelings without blame — it invites repair.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "You just don't get it.",
            keywords: ["don't get it"],
            reply: "Then help me get it — I want to understand.",
            cue: "Casey asked to understand, but a clearer 'I felt...' would have made it easier.",
            suggestion: "Naming the exact feeling ('I felt hurt when...') unlocks a real conversation.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "Take your time — I'm here to listen, not to argue.",
          cue: "Casey made space for you to find the words.",
          suggestion: "A gentle 'I felt hurt' is a safe place to start.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Okay, I really hear you. What can I do differently next time?",
        options: [
          {
            text: "Just let me know what's going on, even if it's short — that would mean a lot.",
            keywords: ["let me know", "short"],
            reply: "Deal. Even a quick text about what's up. I can do that.",
            cue: "You turned the talk into a clear, doable agreement for the future.",
            suggestion: "Turning a hard talk into one small agreement makes the friendship stronger.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "I don't know.",
            keywords: ["don't know"],
            reply: "Okay — then let's agree to check in more often, and we'll figure it out.",
            cue: "Your friend offered a simple first step even without a specific answer.",
            suggestion: "One small ask ('keep me in the loop') gives the repair a shape.",
            quality: QUALITY_PRESETS.neutral,
          },
        ],
        fallback: {
          reply: "We'll figure it out together — that's what friends do.",
          cue: "Casey committed to working it out as a team.",
          suggestion: "A single clear ask, like 'text me if plans change', builds trust.",
          quality: FALLBACK_QUALITY,
        },
      },
      {
        prompt: "Cool. I'm really glad we talked. Friends?",
        options: [
          {
            text: "Friends. Thank you for hearing me out — this means everything.",
            keywords: ["friends", "thank"],
            reply: "Friends. Thanks for coming back to talk.",
            cue: "You sealed the repair warmly — a strong, mature close.",
            suggestion: "Ending with 'thank you' turns a hard conversation into a deeper bond.",
            quality: QUALITY_PRESETS.strong,
          },
          {
            text: "Yeah.",
            keywords: ["yeah"],
            reply: "Good. See you at lunch tomorrow?",
            cue: "A short yes closes it, though the moment deserved a little warmth.",
            suggestion: "Try 'yeah, friends — thanks for talking' to seal it warmly.",
            quality: QUALITY_PRESETS.good,
          },
        ],
        fallback: {
          reply: "Okay — let's grab lunch tomorrow and just be us again.",
          cue: "Casey moved straight to a plan, signalling the friendship is safe.",
          suggestion: "A final 'thank you for talking' makes the repair feel complete.",
          quality: FALLBACK_QUALITY,
        },
      },
    ],
  },
];

export function getScenarioById(scenarioId) {
  return SCENARIO_LIBRARY.find((scenario) => scenario.id === scenarioId) ?? null;
}

export function getScenariosByCategory(categoryId) {
  return SCENARIO_LIBRARY.filter((scenario) => scenario.category === categoryId);
}

export function getScenarioCategory(categoryId) {
  return SCENARIO_CATEGORIES.find((category) => category.id === categoryId) ?? null;
}

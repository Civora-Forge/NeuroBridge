/**
 * questionsRegistry.js
 *
 * Each answer option carries a `tagScores` map.
 *   Often    → +2 per relevant tag
 *   Sometimes → +1 per relevant tag
 *   Never/No  → {} (no contribution)
 *
 * The scoring engine (moduleSelector.js) sums all tagScores from the
 * user's answers, then computes each module's score as the sum of
 * tagScores[tag] for every tag the module declares.
 * A module is enabled when its score ≥ THRESHOLD (default 2).
 */

export const QUESTIONS_REGISTRY = {
  // ── OCD ──────────────────────────────────────────────────────────
  ocd: [
    {
      id: "ocd_urge_repeat",
      question: "Do you feel strong urges to repeat actions until they feel exactly right?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { compulsion: 1, urge_control: 1 } },
        { text: "Often",     tagScores: { compulsion: 2, urge_control: 2 } },
      ],
    },
    {
      id: "ocd_checking",
      question: "Do you re-check things (locks, appliances, messages) even when you know they are fine?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { compulsion: 1 } },
        { text: "Often",     tagScores: { compulsion: 2, urge_control: 1 } },
      ],
    },
    {
      id: "ocd_intrusive",
      question: "Do unwanted or distressing thoughts pop into your mind and stick around?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { intrusive_thoughts: 1 } },
        { text: "Often",     tagScores: { intrusive_thoughts: 2, rumination: 1 } },
      ],
    },
    {
      id: "ocd_mental_replay",
      question: "Do you replay past events or words to check whether something went wrong?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { rumination: 1, intrusive_thoughts: 1 } },
        { text: "Often",     tagScores: { rumination: 2, intrusive_thoughts: 1 } },
      ],
    },
    {
      id: "ocd_avoidance",
      question: "Do you avoid places, objects or situations to prevent uncomfortable feelings?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { avoidance: 1, fear: 1 } },
        { text: "Often",     tagScores: { avoidance: 2, fear: 2, exposure: 1 } },
      ],
    },
    {
      id: "ocd_triggers",
      question: "Are there specific times or places where urges or thoughts are much stronger?",
      options: [
        { text: "Not really", tagScores: {} },
        { text: "Sort of",    tagScores: { triggers: 1, patterns: 1 } },
        { text: "Clearly yes", tagScores: { triggers: 2, patterns: 2, compulsion: 1 } },
      ],
    },
    {
      id: "ocd_anxiety_build",
      question: "Does physical anxiety (tight chest, racing heart) build up before or during rituals?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { anxiety: 1, panic: 1 } },
        { text: "Often",     tagScores: { anxiety: 2, panic: 2 } },
      ],
    },
  ],

  // ── ASD ──────────────────────────────────────────────────────────
  asd: [
    {
      id: "asd_sensory_overload",
      question: "Do noisy or bright environments quickly become overwhelming?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { sensory_overload: 1, overwhelm: 1 } },
        { text: "Often",     tagScores: { sensory_overload: 2, overwhelm: 2 } },
      ],
    },
    {
      id: "asd_routine_disruption",
      question: "Do unexpected changes to your daily routine significantly increase your stress?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { routine: 1, stability: 1 } },
        { text: "Often",     tagScores: { routine: 2, stability: 2 } },
      ],
    },
    {
      id: "asd_social_decode",
      question: "Do you find it hard to read tone, sarcasm or unspoken social rules?",
      options: [
        { text: "Not much",  tagScores: {} },
        { text: "Sometimes", tagScores: { social_stress: 1, communication: 1 } },
        { text: "Often",     tagScores: { social_stress: 2, communication: 2 } },
      ],
    },
    {
      id: "asd_meltdown",
      question: "When overloaded, do you experience strong reactions that are hard to stop?",
      options: [
        { text: "Never",     tagScores: {} },
        { text: "Sometimes", tagScores: { panic: 1, overwhelm: 1 } },
        { text: "Often",     tagScores: { panic: 2, overwhelm: 2 } },
      ],
    },
    {
      id: "asd_emotion_name",
      question: "Do you find it difficult to name or describe what you are feeling in the moment?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { emotion_regulation: 1, social_stress: 1 } },
        { text: "Often",     tagScores: { emotion_regulation: 2, social_stress: 1 } },
      ],
    },
    {
      id: "asd_transition_stress",
      question: "Does switching between tasks or locations take extra mental effort?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { stability: 1, routine: 1 } },
        { text: "Often",     tagScores: { stability: 2, routine: 2 } },
      ],
    },
    {
      id: "asd_social_prep",
      question: "Would practicing social scenarios in advance help you feel more prepared?",
      options: [
        { text: "No",        tagScores: {} },
        { text: "Maybe",     tagScores: { social_stress: 1, communication: 1 } },
        { text: "Yes",       tagScores: { social_stress: 2, communication: 2 } },
      ],
    },
  ],

  // ── Dyslexia ──────────────────────────────────────────────────────
  dyslexia: [
    {
      id: "dyslexia_reading_fatigue",
      question: "Does reading dense text cause fast fatigue, skipped lines or losing your place?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { reading_fatigue: 1, focus: 1 } },
        { text: "Often",     tagScores: { reading_fatigue: 2, focus: 2 } },
      ],
    },
    {
      id: "dyslexia_word_sounding",
      question: "Do you struggle to sound out unfamiliar or complex words?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { working_memory: 1, reading_fatigue: 1 } },
        { text: "Often",     tagScores: { working_memory: 2, reading_fatigue: 2 } },
      ],
    },
    {
      id: "dyslexia_writing",
      question: "Is writing and spelling significantly harder for you than speaking?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { planning: 1, working_memory: 1 } },
        { text: "Often",     tagScores: { planning: 2, working_memory: 2 } },
      ],
    },
    {
      id: "dyslexia_multi_sensory",
      question: "Does hearing words read aloud help you understand them better?",
      options: [
        { text: "No",    tagScores: {} },
        { text: "A bit", tagScores: { focus: 1, stability: 1 } },
        { text: "A lot", tagScores: { focus: 2, stability: 2 } },
      ],
    },
    {
      id: "dyslexia_night_reading",
      question: "Would calmer reading or audio support help you unwind at night?",
      options: [
        { text: "No",    tagScores: {} },
        { text: "Maybe", tagScores: { sleep: 1, night_rumination: 1 } },
        { text: "Yes",   tagScores: { sleep: 2, night_rumination: 2 } },
      ],
    },
    {
      id: "dyslexia_profile",
      question: "Would tracking your reading patterns help you identify where to improve?",
      options: [
        { text: "No",    tagScores: {} },
        { text: "Maybe", tagScores: { stability: 1, planning: 1 } },
        { text: "Yes",   tagScores: { stability: 2, planning: 2 } },
      ],
    },
  ],

  // ── Dyscalculia ───────────────────────────────────────────────────
  dyscalculia: [
    {
      id: "dyscalc_steps",
      question: "Do multi-step calculations get confusing without clear written structure?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { number_confusion: 1, step_support: 1 } },
        { text: "Often",     tagScores: { number_confusion: 2, step_support: 2 } },
      ],
    },
    {
      id: "dyscalc_everyday",
      question: "Do everyday tasks like budgeting or time estimation feel harder than they should?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { number_confusion: 1, working_memory: 1 } },
        { text: "Often",     tagScores: { number_confusion: 2, working_memory: 2 } },
      ],
    },
    {
      id: "dyscalc_patterns",
      question: "Is it hard to see number patterns or sequences quickly?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { working_memory: 1, number_confusion: 1 } },
        { text: "Often",     tagScores: { working_memory: 2, number_confusion: 2 } },
      ],
    },
    {
      id: "dyscalc_anxiety",
      question: "Do number-related tasks trigger notable stress or avoidance?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { stress: 1, overwhelm: 1 } },
        { text: "Often",     tagScores: { stress: 2, overwhelm: 2 } },
      ],
    },
    {
      id: "dyscalc_timeline",
      question: "Would visual timelines or schedules help you manage number-related tasks?",
      options: [
        { text: "No",    tagScores: {} },
        { text: "Maybe", tagScores: { planning: 1, working_memory: 1 } },
        { text: "Yes",   tagScores: { planning: 2, working_memory: 2 } },
      ],
    },
    {
      id: "dyscalc_daily_budget",
      question: "Do you avoid tasks that require handling money or estimating quantities?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { step_support: 1, number_confusion: 1 } },
        { text: "Often",     tagScores: { step_support: 2, number_confusion: 2 } },
      ],
    },
  ],

  // ── Dyspraxia ─────────────────────────────────────────────────────
  dyspraxia: [
    {
      id: "dyspraxia_sequence",
      question: "Do daily movement routines feel easier when broken into clear steps?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { routine: 1, step_support: 1 } },
        { text: "Often",     tagScores: { routine: 2, step_support: 2 } },
      ],
    },
    {
      id: "dyspraxia_stress",
      question: "Do coordination-heavy tasks quickly raise your stress or frustration?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { stress: 1, overwhelm: 1 } },
        { text: "Often",     tagScores: { stress: 2, overwhelm: 2 } },
      ],
    },
    {
      id: "dyspraxia_visual_instructions",
      question: "Do visual or illustrated instructions help you complete tasks more accurately?",
      options: [
        { text: "No",    tagScores: {} },
        { text: "A bit", tagScores: { step_support: 1, planning: 1 } },
        { text: "A lot", tagScores: { step_support: 2, planning: 2 } },
      ],
    },
    {
      id: "dyspraxia_timing",
      question: "Do rhythmic or pacing cues help you stay coordinated through a task?",
      options: [
        { text: "No",    tagScores: {} },
        { text: "A bit", tagScores: { stability: 1, routine: 1 } },
        { text: "A lot", tagScores: { stability: 2, routine: 2 } },
      ],
    },
    {
      id: "dyspraxia_route",
      question: "Do you need to plan routes or navigation in advance for physical comfort?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { planning: 1, stress: 1 } },
        { text: "Often",     tagScores: { planning: 2, stress: 2 } },
      ],
    },
    {
      id: "dyspraxia_calm",
      question: "Does overwhelming physical difficulty sometimes make you want to give up?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { stress: 1, stability: 1 } },
        { text: "Often",     tagScores: { stress: 2, stability: 2 } },
      ],
    },
  ],

  // ── ADHD ──────────────────────────────────────────────────────────
  adhd: [
    {
      id: "adhd_overwhelm",
      question: "Do large tasks often feel so overwhelming that you freeze before starting?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { overwhelm: 1, planning: 1, task_start: 1 } },
        { text: "Often",     tagScores: { overwhelm: 2, planning: 2, task_start: 2 } },
      ],
    },
    {
      id: "adhd_time",
      question: "Do you lose track of time and miss deadlines more than most people?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { time_blindness: 1, planning: 1 } },
        { text: "Often",     tagScores: { time_blindness: 2, planning: 2 } },
      ],
    },
    {
      id: "adhd_focus",
      question: "Do you struggle to maintain focus, especially on routine or low-stimulus tasks?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { focus: 1, distraction: 1 } },
        { text: "Often",     tagScores: { focus: 2, distraction: 2 } },
      ],
    },
    {
      id: "adhd_emotion",
      question: "Do emotional reactions hit fast and feel difficult to manage in the moment?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { emotion_regulation: 1, stress: 1 } },
        { text: "Often",     tagScores: { emotion_regulation: 2, stress: 2 } },
      ],
    },
    {
      id: "adhd_noise",
      question: "Does background noise or a distracting environment affect your ability to focus?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { focus: 1, noise_sensitivity: 1 } },
        { text: "Often",     tagScores: { focus: 2, noise_sensitivity: 2 } },
      ],
    },
    {
      id: "adhd_sleep",
      question: "Does an active or restless mind make it hard to fall asleep?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { sleep: 1, night_rumination: 1 } },
        { text: "Often",     tagScores: { sleep: 2, night_rumination: 2 } },
      ],
    },
    {
      id: "adhd_accountability",
      question: "Does working alongside someone — even virtually — help you stay on task?",
      options: [
        { text: "No",    tagScores: {} },
        { text: "Maybe", tagScores: { focus: 1, task_start: 1 } },
        { text: "Yes",   tagScores: { focus: 2, task_start: 2 } },
      ],
    },
  ],

  // ── Anxiety ───────────────────────────────────────────────────────
  anxiety: [
    {
      id: "anx_physical",
      question: "Do physical signs of stress (rapid heart, tight chest) make it hard to function?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { physical_anxiety: 1, panic: 1 } },
        { text: "Often",     tagScores: { physical_anxiety: 2, panic: 2 } },
      ],
    },
    {
      id: "anx_rumination",
      question: "Do worry loops or intrusive thoughts continue for long stretches?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { rumination: 1, intrusive_thoughts: 1 } },
        { text: "Often",     tagScores: { rumination: 2, intrusive_thoughts: 2 } },
      ],
    },
    {
      id: "anx_social",
      question: "Does anticipating social situations cause significant anxiety beforehand?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { social_stress: 1, avoidance: 1 } },
        { text: "Often",     tagScores: { social_stress: 2, avoidance: 2 } },
      ],
    },
    {
      id: "anx_recovery",
      question: "Do you need guided steps to recover after intense stress or panic?",
      options: [
        { text: "No",        tagScores: {} },
        { text: "Sometimes", tagScores: { panic: 1, emotion_regulation: 1 } },
        { text: "Yes",       tagScores: { panic: 2, emotion_regulation: 2 } },
      ],
    },
    {
      id: "anx_sleep",
      question: "Does anxiety regularly prevent you from falling or staying asleep?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { sleep: 1, night_rumination: 1 } },
        { text: "Often",     tagScores: { sleep: 2, night_rumination: 2 } },
      ],
    },
    {
      id: "anx_anticipatory",
      question: "Do you spend significant time worrying about things that might go wrong?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { anxiety: 1, avoidance: 1 } },
        { text: "Often",     tagScores: { anxiety: 2, avoidance: 2 } },
      ],
    },
  ],

  // ── Depression ────────────────────────────────────────────────────
  depression: [
    {
      id: "dep_low_mood",
      question: "Do periods of low mood reduce your motivation to start or finish daily tasks?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { low_mood: 1, task_start: 1 } },
        { text: "Often",     tagScores: { low_mood: 2, task_start: 2 } },
      ],
    },
    {
      id: "dep_exhaustion",
      question: "Do you feel mentally empty or exhausted even on days with no clear cause?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { low_mood: 1, stability: 1 } },
        { text: "Often",     tagScores: { low_mood: 2, stability: 2 } },
      ],
    },
    {
      id: "dep_thoughts",
      question: "Do negative thoughts about yourself or the future loop repeatedly?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { rumination: 1, intrusive_thoughts: 1 } },
        { text: "Often",     tagScores: { rumination: 2, intrusive_thoughts: 2 } },
      ],
    },
    {
      id: "dep_social",
      question: "Do you pull back from friends or family when your mood drops?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { social_stress: 1, low_mood: 1 } },
        { text: "Often",     tagScores: { social_stress: 2, low_mood: 2 } },
      ],
    },
    {
      id: "dep_anxiety_spiral",
      question: "Does anxiety layer on top of low mood, making it hard to break out of a spiral?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { panic: 1, emotion_regulation: 1 } },
        { text: "Often",     tagScores: { panic: 2, emotion_regulation: 2 } },
      ],
    },
    {
      id: "dep_evidence",
      question: "Would collecting evidence of your own strengths help challenge negative beliefs?",
      options: [
        { text: "No",    tagScores: {} },
        { text: "Maybe", tagScores: { rumination: 1, intrusive_thoughts: 1 } },
        { text: "Yes",   tagScores: { rumination: 2, intrusive_thoughts: 2 } },
      ],
    },
    {
      id: "dep_void",
      question: "Are there times when you feel emotionally numb or disconnected from everything?",
      options: [
        { text: "Rarely",    tagScores: {} },
        { text: "Sometimes", tagScores: { low_mood: 1, stability: 1 } },
        { text: "Often",     tagScores: { low_mood: 2, stability: 2 } },
      ],
    },
  ],
};

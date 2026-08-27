/**
 * dyslexiaDifficultyService.js
 *
 * Word-level and sentence-level difficulty analysis for the Dyslexia Reader.
 * Uses a heuristic approach first, with optional Gemini AI enhancement.
 *
 * Design goals:
 * - Fast synchronous heuristic for immediate rendering
 * - Optional async Gemini call for richer analysis
 * - Non-blocking — does not prevent the reader from loading
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.5-flash";

// ─── Word Difficulty Heuristics ───────────────────────────────────────────────

/** Simple syllable counter (heuristic) */
function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const vowels = w.match(/[aeiouy]+/g) || [];
  let count = vowels.length;
  // Subtract silent 'e' at end
  if (w.endsWith("e") && count > 1) count -= 1;
  return Math.max(1, count);
}

/** Common easy words (top ~200 English words) */
const EASY_WORDS = new Set([
  "the","a","an","is","it","in","of","to","and","or","but","for","not","with",
  "this","that","are","was","be","has","had","he","she","they","we","you","I",
  "my","your","his","her","our","their","its","at","by","as","if","do","did",
  "on","up","so","go","me","no","us","am","can","will","would","could","should",
  "from","have","been","were","said","all","one","two","out","get","like","just",
  "time","see","good","what","when","who","how","than","then","she","he","we",
  "her","him","them","now","way","may","new","back","man","old","any","over",
  "come","into","here","our","day","same","get","own","also","most","make",
  "know","take","into","some","look","only","come","think","about","more","after",
  "first","never","last","long","little","great","other","where","much","before",
  "right","too","after","well","these","those","very","still","even","both",
]);

/**
 * Analyze word difficulty synchronously.
 * Returns 0 (easy), 1 (medium), 2 (hard) for each word.
 */
export function analyzeWordDifficulty(words) {
  return words.map((word) => {
    const clean = word.replace(/[^a-zA-Z']/g, "").toLowerCase();
    if (!clean || clean.length <= 2) return 0;
    if (EASY_WORDS.has(clean)) return 0;

    const syllables = countSyllables(clean);
    const length = clean.length;

    if (length > 12 || syllables >= 4) return 2;
    if (length > 8 || syllables >= 3) return 1;
    return 0;
  });
}

/**
 * Analyze sentence/paragraph difficulty synchronously.
 * Returns difficulty object: { score: 0|1|2, wordCount, clauseCount, reasons }
 */
export function analyzeSentenceDifficulty(paragraph) {
  if (!paragraph) return { score: 0, wordCount: 0, clauseCount: 0, reasons: [] };

  const sentences = paragraph.match(/[^.!?]+[.!?]?/g) || [paragraph];
  const avgWords = sentences.reduce((s, sent) => {
    return s + sent.trim().split(/\s+/).filter(Boolean).length;
  }, 0) / Math.max(sentences.length, 1);

  const wordCount = paragraph.trim().split(/\s+/).filter(Boolean).length;
  const commaCount = (paragraph.match(/,/g) || []).length;
  const clauseCount = commaCount + (paragraph.match(/\b(which|that|who|when|where|although|however|therefore|furthermore|consequently|nevertheless)\b/gi) || []).length;
  const reasons = [];
  let score = 0;

  if (avgWords > 25) {
    reasons.push("Long sentences");
    score = Math.max(score, 1);
  }
  if (avgWords > 35) {
    reasons.push("Very long sentences");
    score = 2;
  }
  if (clauseCount >= 3) {
    reasons.push("Multiple clauses");
    score = Math.max(score, 1);
  }
  if (clauseCount >= 5) {
    score = 2;
  }
  if (wordCount > 80) {
    reasons.push("Long paragraph");
    score = Math.max(score, 1);
  }

  return { score, wordCount, clauseCount, reasons };
}

// ─── AI Simplification ────────────────────────────────────────────────────────

/**
 * Simplify a word using AI.
 * Returns { simplified: string, explanation: string } or null on failure.
 */
export async function simplifyWord(word) {
  if (!GEMINI_API_KEY) return null;

  const prompt = `You are helping someone with dyslexia understand a difficult word.

Word: "${word}"

Respond with JSON only (no markdown, no extra text):
{
  "simplified": "a simpler synonym or short phrase (1-3 words)",
  "explanation": "plain English explanation in one short sentence"
}`;

  try {
    const res = await callGemini(prompt);
    const json = extractJSON(res);
    if (json?.simplified) return json;
  } catch (err) {
    console.warn("[dyslexiaDifficultyService] simplifyWord error:", err);
  }
  return null;
}

/**
 * Simplify a sentence or paragraph using AI.
 * Returns simplified string or null on failure.
 */
export async function simplifyText(text) {
  if (!GEMINI_API_KEY || !text?.trim()) return null;

  const prompt = `You are helping someone with dyslexia read more easily.

Simplify the following text. Rules:
- Use simpler, everyday words
- Break long sentences into shorter ones
- Keep the same meaning
- Do NOT add new information
- Keep the result as a single flowing paragraph
- Return ONLY the simplified text, no commentary

Text to simplify:
"${text}"`;

  try {
    const res = await callGemini(prompt);
    return res?.trim() || null;
  } catch (err) {
    console.warn("[dyslexiaDifficultyService] simplifyText error:", err);
  }
  return null;
}

/**
 * Get AI-enhanced word difficulty analysis for a block of text.
 * Returns Map<word, { difficulty: 0|1|2, explanation?: string, simpler?: string }>
 * Only analyzes words the heuristic rated >= 1.
 */
export async function getAIDifficultyAnalysis(words, heuristicScores) {
  if (!GEMINI_API_KEY) return null;

  const difficultWords = words
    .filter((_, i) => heuristicScores[i] >= 1)
    .map((w) => w.replace(/[^a-zA-Z'-]/g, ""))
    .filter(Boolean);

  const uniqueWords = [...new Set(difficultWords)].slice(0, 20);
  if (!uniqueWords.length) return null;

  const prompt = `You are a reading difficulty analyzer helping someone with dyslexia.

Analyze these words and rate their difficulty for a dyslexic reader (1=medium, 2=hard):
${uniqueWords.join(", ")}

Respond with JSON only:
{
  "words": [
    { "word": "...", "difficulty": 1, "simpler": "...", "explanation": "..." },
    ...
  ]
}

Only include words that are genuinely difficult (not everyday words). Be conservative.`;

  try {
    const res = await callGemini(prompt);
    const json = extractJSON(res);
    if (json?.words) {
      const map = new Map();
      json.words.forEach((w) => {
        if (w.word && w.difficulty) {
          map.set(w.word.toLowerCase(), {
            difficulty: Math.min(2, Math.max(1, Number(w.difficulty))),
            simpler: w.simpler || null,
            explanation: w.explanation || null,
          });
        }
      });
      return map;
    }
  } catch (err) {
    console.warn("[dyslexiaDifficultyService] AI analysis error:", err);
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2500 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

function extractJSON(text) {
  if (!text) return null;
  // Try to find JSON block
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

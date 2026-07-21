import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Brain,
  CheckCircle2,
  Loader,
  Volume2,
  Zap,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { usePhonologicalAnalysis } from "@/hooks/usePhonologicalAnalysis";

const PHONEMES = [
  "th", "ch", "sh", "zh", "ng", "ck",
  "ph", "gh", "wh", "qu", "tch",
  "ai", "ay", "ea", "ee", "igh", "oa", "ow",
  "l", "r", "s", "z", "b", "d", "g", "v"
];

const PHONEME_COLORS = {
  th: "#ef4444", ch: "#f97316", sh: "#eab308", zh: "#84cc16",
  ng: "#22c55e", ck: "#10b981", ph: "#14b8a6", gh: "#06b6d4",
  wh: "#0ea5e9", qu: "#3b82f6", tch: "#6366f1", ai: "#8b5cf6",
  ay: "#a855f7", ea: "#d946ef", ee: "#ec4899", igh: "#f43f5e",
  oa: "#ff6b6b", ow: "#ffd93d", l: "#6bcf7f", r: "#4d96ff",
  s: "#ff6b9d", z: "#c44569", b: "#f8b195", d: "#f67676",
  g: "#a29bfe", v: "#fd79a8"
};

/**
 * Fallback drills for common phonemes
 */
const FALLBACK_DRILLS = {
  th: {
    fillBlank: [
      {
        prompt: "I am ___inking about my plan.",
        options: ["th", "f", "s"],
        answer: "th",
      },
      {
        prompt: "Please pass me the ___read.",
        options: ["ch", "th", "wh"],
        answer: "th",
      },
      {
        prompt: "A ___ief stole the treasure.",
        options: ["ch", "th", "sh"],
        answer: "th",
      },
    ],
    wordBuild: {
      targetWord: "thinking",
      chunks: ["thin", "k", "ing"],
      hint: "Build from left to right",
    },
    soundMatch: [
      {
        prompt: "Which starts with /th/?",
        choices: ["think", "sink", "wink"],
        answer: "think",
      },
      {
        prompt: "Which ends with /th/?",
        choices: ["bath", "math", "path"],
        answer: "bath",
      },
    ],
  },
  r: {
    fillBlank: [
      {
        prompt: "The ___ed car drove fast.",
        options: ["b", "r", "t"],
        answer: "r",
      },
      {
        prompt: "I love to ___ead books.",
        options: ["l", "r", "t"],
        answer: "r",
      },
    ],
    wordBuild: {
      targetWord: "reading",
      chunks: ["read", "ing"],
      hint: "Sound each part clearly",
    },
    soundMatch: [
      {
        prompt: "Which starts with /r/?",
        choices: ["rabbit", "habit", "cadet"],
        answer: "rabbit",
      },
    ],
  },
  l: {
    fillBlank: [
      {
        prompt: "The ___ion is very strong.",
        options: ["l", "n", "r"],
        answer: "l",
      },
      {
        prompt: "I ___ike ice cream.",
        options: ["l", "r", "t"],
        answer: "l",
      },
    ],
    wordBuild: {
      targetWord: "listen",
      chunks: ["lis", "ten"],
      hint: "Listen to each sound",
    },
    soundMatch: [
      {
        prompt: "Which starts with /l/?",
        choices: ["love", "rove", "dove"],
        answer: "love",
      },
    ],
  },
  s: {
    fillBlank: [
      {
        prompt: "The ___un is bright.",
        options: ["s", "c", "z"],
        answer: "s",
      },
      {
        prompt: "I ___ee a big tree.",
        options: ["s", "c", "z"],
        answer: "s",
      },
    ],
    wordBuild: {
      targetWord: "sister",
      chunks: ["sis", "ter"],
      hint: "Emphasize the 's' sound",
    },
    soundMatch: [
      {
        prompt: "Which starts with /s/?",
        choices: ["sun", "run", "fun"],
        answer: "sun",
      },
    ],
  },
  ch: {
    fillBlank: [
      {
        prompt: "I like to eat ___eese.",
        options: ["ch", "sh", "j"],
        answer: "ch",
      },
      {
        prompt: "The ___air is comfortable.",
        options: ["ch", "sh", "wh"],
        answer: "ch",
      },
    ],
    wordBuild: {
      targetWord: "change",
      chunks: ["ch", "ange"],
      hint: "Start with the ch sound",
    },
    soundMatch: [
      {
        prompt: "Which starts with /ch/?",
        choices: ["chair", "their", "where"],
        answer: "chair",
      },
    ],
  },
};

/**
 * Generate drills for a phoneme
 * In demo mode, uses fallback drills. Optionally integrates with Gemini API if deployed.
 */
async function generatePhonemeGeminiDrills(phoneme, errorCount) {
  // Use fallback drills immediately for demo mode
  // In production with deployed Supabase edge functions, swap this logic
  const demoMode = true; // Set to false after edge functions are deployed
  
  if (demoMode) {
    return FALLBACK_DRILLS[phoneme] || FALLBACK_DRILLS.th;
  }
  
  try {
    const response = await supabase.functions.invoke("generate-training-drills", {
      body: { dominantPhoneme: phoneme },
    });

    if (response.error) {
      return FALLBACK_DRILLS[phoneme] || FALLBACK_DRILLS.th;
    }

    return response.data?.drills || FALLBACK_DRILLS[phoneme] || FALLBACK_DRILLS.th;
  } catch (error) {
    // Use fallback drills when edge function isn't available
    return FALLBACK_DRILLS[phoneme] || FALLBACK_DRILLS.th;
  }
}

/**
 * Phoneme Weakness Detector Component
 */
export function PhonemeWeaknessDetector({ userId }) {
  const { analysisResult, score, isLoading, error, analyzeText, reset } = usePhonologicalAnalysis(userId);
  const [selectedPhoneme, setSelectedPhoneme] = useState(null);
  const [drills, setDrills] = useState(null);
  const [drilIsLoading, setDrillIsLoading] = useState(false);
  const [customWords, setCustomWords] = useState("");

  const loadDrills = useCallback(async () => {
    if (!selectedPhoneme || !analysisResult) return;

    setDrillIsLoading(true);
    try {
      const errorCount = analysisResult.phonemeErrors[selectedPhoneme] || 0;
      const drillsData = await generatePhonemeGeminiDrills(selectedPhoneme, errorCount);
      setDrills(drillsData);
    } catch (error) {
      console.error("Drill generation failed:", error);
    } finally {
      setDrillIsLoading(false);
    }
  }, [selectedPhoneme, analysisResult]);

  useEffect(() => {
    if (selectedPhoneme && analysisResult) {
      loadDrills();
    }
  }, [selectedPhoneme, analysisResult]);

  const chartData = useMemo(
    () =>
      analysisResult
        ? Object.entries(analysisResult.phonemeErrors)
            .map(([phoneme, errors]) => ({
              name: phoneme.toUpperCase(),
              errors,
              weakness: errors * 3,
            }))
            .sort((a, b) => b.errors - a.errors)
            .slice(0, 8)
        : [],
    [analysisResult]
  );

  const topWeaknesses = useMemo(
    () =>
      analysisResult
        ? Object.entries(analysisResult.phonemeErrors)
            .map(([phoneme, errors]) => ({ phoneme, errors }))
            .sort((a, b) => b.errors - a.errors)
            .slice(0, 12)
        : [],
    [analysisResult]
  );

  const calculationBasis =
    analysisResult?.metadata?.usesHistory
      ? "Dynamic model: text phoneme frequency + phoneme difficulty + your historical phoneme mistakes"
      : "Dynamic model: text phoneme frequency + phoneme difficulty (history becomes active after practice data is available)";

  const selectedPhonemeData = topWeaknesses.find((p) => p.phoneme === selectedPhoneme);
  const phonemeRank = topWeaknesses.findIndex((p) => p.phoneme === selectedPhoneme) + 1;

  return (
    <div className="space-y-6">
      {/* Analysis Input Section */}
      <Card className="rounded-2xl border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-6 w-6 text-indigo-600" />
          <h3 className="text-xl font-bold text-slate-900">Phonological Weakness Detector</h3>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Paste text to analyze phoneme patterns and identify weak areas for targeted training
        </p>

        <textarea
          className="w-full h-20 mb-4 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="Paste text to analyze phoneme patterns and detect weaknesses..."
          value={customWords}
          onChange={(e) => setCustomWords(e.target.value)}
        />

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => analyzeText(customWords)}
            disabled={!customWords.trim() || isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Analyze Text
          </Button>

          <Button
            onClick={() => {
              reset();
              setCustomWords("");
              setSelectedPhoneme(null);
              setDrills(null);
            }}
            variant="outline"
            disabled={!analysisResult}
          >
            Clear
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </Card>

      {!analysisResult && !isLoading && !customWords && (
        <Card className="border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3 text-blue-800">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm mb-1">Get Started</p>
              <p className="text-sm">Paste your text above to detect phoneme weaknesses and receive AI-powered drills</p>
            </div>
          </div>
        </Card>
      )}

      {analysisResult && analysisResult.phonemeErrors && Object.keys(analysisResult.phonemeErrors).length > 0 && (
        <>
          {/* Top Weakness Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-xl border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-4">
              <p className="text-xs font-semibold uppercase text-red-700 mb-1">Highest Weakness</p>
              <p className="text-2xl font-bold text-red-900">
                {topWeaknesses[0]?.phoneme.toUpperCase()}
              </p>
              <p className="text-xs text-red-700 mt-2">
                {topWeaknesses[0]?.errors || 0} errors
              </p>
            </Card>

            <Card className="rounded-xl border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 p-4">
              <p className="text-xs font-semibold uppercase text-yellow-700 mb-1">Phonological Score</p>
              <p className="text-2xl font-bold text-yellow-900">
                {score}/100
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                {score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs work"}
              </p>
              <p className="text-xs text-yellow-800/90 mt-2 leading-relaxed">
                {calculationBasis}
              </p>
            </Card>

            <Card className="rounded-xl border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
              <p className="text-xs font-semibold uppercase text-indigo-700 mb-1">Text Analyzed</p>
              <p className="text-2xl font-bold text-indigo-900">
                {analysisResult.words}
              </p>
              <p className="text-xs text-indigo-700 mt-2">
                words with {Object.keys(analysisResult.phonemeErrors).length} unique phonemes
              </p>
            </Card>
          </div>

          {/* Error Distribution Chart */}
          {chartData.length > 0 && (
            <Card className="rounded-2xl border-slate-200 p-6">
              <h4 className="mb-4 font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                Phoneme Error Distribution
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="errors" fill="#ef4444" name="Error Count" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Phoneme Selection Grid */}
          <Card className="rounded-2xl border-slate-200 p-6">
            <h4 className="mb-4 font-semibold text-slate-900">Select Phoneme for Drills</h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {topWeaknesses.slice(0, 12).map((p) => (
                <button
                  key={p.phoneme}
                  onClick={() => setSelectedPhoneme(p.phoneme)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    selectedPhoneme === p.phoneme
                      ? "ring-2 ring-offset-2 ring-indigo-500 shadow-md"
                      : "border border-slate-200 hover:border-slate-300"
                  }`}
                  style={{
                    backgroundColor:
                      selectedPhoneme === p.phoneme
                        ? PHONEME_COLORS[p.phoneme] || "#6366f1"
                        : "#f8fafc",
                    color:
                      selectedPhoneme === p.phoneme ? "white" : PHONEME_COLORS[p.phoneme] || "#4f46e5",
                  }}
                >
                  <div>{p.phoneme.toUpperCase()}</div>
                  <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>
                    {p.errors}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Selected Phoneme Detail & Drills */}
          {selectedPhoneme && selectedPhonemeData && (
            <Card className="rounded-2xl border-slate-200 p-6 bg-gradient-to-br from-slate-50 to-blue-50">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-2xl font-bold"
                      style={{ backgroundColor: PHONEME_COLORS[selectedPhoneme] || "#6366f1" }}
                    >
                      {selectedPhoneme.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-900">/{selectedPhoneme}/ Sound</h4>
                      <p className="text-sm text-slate-600">Rank #{phonemeRank} weakness</p>
                    </div>
                  </div>
                </div>
                <Badge className="bg-red-100 text-red-800 text-lg px-4 py-2">
                  {selectedPhonemeData.errors} errors
                </Badge>
              </div>

              {/* AI Drills Section */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <h5 className="font-semibold text-slate-900">AI-Generated Drills</h5>
                  {drilIsLoading && <Loader className="h-4 w-4 animate-spin text-indigo-600 ml-auto" />}
                </div>

                {drills && (
                  <div className="space-y-4">
                    {/* Fill Blank */}
                    {drills.fillBlank && drills.fillBlank.length > 0 && (
                      <div className="border-t pt-4">
                        <h6 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Fill in the Blank
                        </h6>
                        {drills.fillBlank.map((exercise, idx) => (
                          <div key={idx} className="mb-3 p-3 bg-slate-50 rounded-lg">
                            <p className="text-sm font-medium text-slate-900 mb-2">{exercise.prompt}</p>
                            <div className="flex flex-wrap gap-2">
                              {exercise.options.map((opt, i) => (
                                <button
                                  key={i}
                                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                                    opt === exercise.answer
                                      ? "bg-green-200 text-green-900"
                                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Word Building */}
                    {drills.wordBuild && (
                      <div className="border-t pt-4">
                        <h6 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-600" />
                          Word Building
                        </h6>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-slate-900 mb-2">Target: {drills.wordBuild.targetWord}</p>
                          <p className="text-xs text-slate-600 mb-2">{drills.wordBuild.hint}</p>
                          <div className="flex flex-wrap gap-2">
                            {drills.wordBuild.chunks.map((chunk, idx) => (
                              <button
                                key={idx}
                                className="px-3 py-2 bg-blue-200 text-blue-900 rounded-lg text-sm font-semibold hover:bg-blue-300 transition"
                              >
                                {chunk}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sound Matching */}
                    {drills.soundMatch && drills.soundMatch.length > 0 && (
                      <div className="border-t pt-4">
                        <h6 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-purple-600" />
                          Sound Matching
                        </h6>
                        {drills.soundMatch.map((exercise, idx) => (
                          <div key={idx} className="mb-3 p-3 bg-slate-50 rounded-lg">
                            <p className="text-sm font-medium text-slate-900 mb-2">{exercise.prompt}</p>
                            <div className="flex flex-wrap gap-2">
                              {exercise.choices.map((choice, i) => (
                                <button
                                  key={i}
                                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                                    choice === exercise.answer
                                      ? "bg-purple-200 text-purple-900"
                                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                  }`}
                                >
                                  {choice}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {drilIsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="h-8 w-8 animate-spin text-indigo-600" />
                    <span className="ml-3 text-slate-600">Generating personalized drills...</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default PhonemeWeaknessDetector;

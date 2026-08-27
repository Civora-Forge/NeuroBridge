import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  Brain,
  BarChart3,
  BookOpen,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.5-flash";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 3000 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function extractJSON(text) {
  const match = text?.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function ScoreBar({ label, value }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const color =
    clamped >= 70 ? "bg-emerald-500" :
    clamped >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-mono text-slate-500">{clamped.toFixed(0)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIPersonalLearningProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [scores, setScores] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [realtimeStats, setRealtimeStats] = useState({
    totalSessions: 0,
    avgWpm: 0,
    avgComfort: 0,
    phonemeErrorCount: 0,
    ttsUsageRate: 0,
  });

  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;

  // ── Load data from Supabase ─────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!isSupabaseUser) {
      setError("Sign in with a Supabase-authenticated account to view your learning profile.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [sessionsRes, phonemeRes, profileRes] = await Promise.all([
        supabase
          .from("reading_sessions")
          .select("wpm, reading_comfort_score, tts_used, duration_seconds, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("phoneme_errors")
          .select("phoneme, error_count")
          .eq("user_id", user.id)
          .order("error_count", { ascending: false })
          .limit(5),
        supabase
          .from("cognitive_profiles")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const sessions = sessionsRes.data || [];
      const phonemeErrors = phonemeRes.data || [];
      const latestProfile = profileRes.data;

      // Compute realtime stats
      const totalSessions = sessions.length;
      const avgWpm = totalSessions
        ? sessions.reduce((s, r) => s + Number(r.wpm), 0) / totalSessions
        : 0;
      const avgComfort = totalSessions
        ? sessions.reduce((s, r) => s + Number(r.reading_comfort_score), 0) / totalSessions
        : 0;
      const ttsCount = sessions.filter((s) => s.tts_used).length;
      const ttsUsageRate = totalSessions ? (ttsCount / totalSessions) * 100 : 0;
      const phonemeErrorCount = phonemeErrors.reduce((s, p) => s + Number(p.error_count), 0);

      setRealtimeStats({ totalSessions, avgWpm, avgComfort, phonemeErrorCount, ttsUsageRate });

      if (latestProfile) {
        setScores({
          readingSpeedScore: Number(latestProfile.reading_speed_score) || 0,
          phonologicalAccuracyScore: Number(latestProfile.phonological_score) || 0,
          writingStabilityScore: Number(latestProfile.writing_stability_score) || 0,
          confidenceTrendScore: Number(latestProfile.confidence_trend) || 0,
          visualDiscriminationScore: Number(latestProfile.visual_discrimination_score) || 0,
        });
        setWeeklyPlan(latestProfile.generated_plan || null);
      } else if (totalSessions > 0) {
        // Derive scores from session data
        const speedScore = Math.min(100, (avgWpm / 200) * 100);
        const comfortScore = Math.min(100, avgComfort);
        const phonologicalScore = Math.max(0, 100 - (phonemeErrorCount / Math.max(1, totalSessions)) * 5);
        setScores({
          readingSpeedScore: speedScore,
          phonologicalAccuracyScore: phonologicalScore,
          writingStabilityScore: 0,
          confidenceTrendScore: comfortScore * 0.8,
          visualDiscriminationScore: 0,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load profile data.");
    } finally {
      setLoading(false);
    }
  }, [isSupabaseUser, user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── Supabase Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseUser) return;

    const channel = supabase
      .channel(`learning-profile-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "reading_sessions",
        filter: `user_id=eq.${user.id}`,
      }, () => loadProfile())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isSupabaseUser, user?.id, loadProfile]);

  // ── Generate Weekly AI Plan ─────────────────────────────────────────────────
  const generateWeeklyPlan = async () => {
    if (!isSupabaseUser || !scores) return;
    setGenerating(true);
    setError("");

    try {
      const prompt = `You are a dyslexia support specialist creating a personalized 7-day reading plan.

User's current scores (0-100):
- Reading Speed: ${scores.readingSpeedScore.toFixed(0)}
- Phonological Accuracy: ${scores.phonologicalAccuracyScore.toFixed(0)}
- Reading Comfort: ${realtimeStats.avgComfort.toFixed(0)}
- TTS Usage Rate: ${realtimeStats.ttsUsageRate.toFixed(0)}%
- Total Reading Sessions: ${realtimeStats.totalSessions}

Create a concrete 7-day adaptive training plan. Respond with JSON only:
{
  "summary": "...(2 sentences describing the focus of this week)",
  "dominantWeakness": "...(one phrase)",
  "improvementRate": "...(optimistic, realistic short phrase)",
  "days": [
    {
      "day": "Monday",
      "readingExercise": "...(specific 5-10 min activity)",
      "phonemeDrill": "...(specific phoneme focus)",
      "writingTask": "...(specific short task)",
      "encouragement": "...(one kind, motivating sentence)"
    }
  ]
}`;

      const text = await callGemini(prompt);
      const plan = extractJSON(text);

      if (!plan) throw new Error("Could not parse AI response");

      // Save to Supabase
      const { data: existing } = await supabase
        .from("cognitive_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from("cognitive_profiles")
          .update({
            reading_speed_score: scores.readingSpeedScore,
            phonological_score: scores.phonologicalAccuracyScore,
            confidence_trend: realtimeStats.avgComfort,
            generated_plan: plan,
            session_count: realtimeStats.totalSessions,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("cognitive_profiles").insert({
          user_id: user.id,
          reading_speed_score: scores.readingSpeedScore,
          phonological_score: scores.phonologicalAccuracyScore,
          confidence_trend: realtimeStats.avgComfort,
          generated_plan: plan,
          session_count: realtimeStats.totalSessions,
        });
      }

      setWeeklyPlan(plan);
    } catch (err) {
      setError(err.message || "Failed to generate weekly plan.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-slate-600 font-medium">Loading your learning profile…</p>
        </div>
      </div>
    );
  }

  const planDays = Array.isArray(weeklyPlan?.days) ? weeklyPlan.days : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back link */}
        <Link to="/dyslexia" className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Dyslexia Hub
        </Link>

        {/* Header */}
        <Card className="p-6 border-emerald-100 bg-white/90">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">AI Personal Learning Profile</h1>
                <p className="text-slate-500 text-sm">Evolves from your actual reading behavior</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={loadProfile}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                size="sm"
                onClick={generateWeeklyPlan}
                disabled={generating || !isSupabaseUser}
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Weekly Plan</>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {!isSupabaseUser && !error && (
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              Sign in with a Supabase account to see your personalized learning profile. Data is gathered from your reading sessions.
            </div>
          )}
        </Card>

        {/* Real-time stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Sessions", value: realtimeStats.totalSessions, icon: BookOpen },
            { label: "Avg WPM", value: realtimeStats.avgWpm.toFixed(0), icon: Activity },
            { label: "Avg Comfort", value: `${realtimeStats.avgComfort.toFixed(0)}%`, icon: TrendingUp },
            { label: "Phoneme Errors", value: realtimeStats.phonemeErrorCount, icon: Brain },
            { label: "TTS Usage", value: `${realtimeStats.ttsUsageRate.toFixed(0)}%`, icon: BarChart3 },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-4 border-emerald-100 bg-white/90">
              <div className="flex items-center gap-2 text-emerald-700 mb-1">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium text-slate-500">{label}</span>
              </div>
              <div className="text-xl font-bold text-slate-900">{value}</div>
            </Card>
          ))}
        </div>

        {/* Cognitive Scores */}
        <Card className="p-6 border-emerald-100 bg-white/90">
          <CardHeader className="p-0 mb-5">
            <CardTitle className="text-lg text-slate-900">Cognitive Scores</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {scores
                ? "Derived from your reading sessions and training history."
                : "Complete at least one reading session to generate scores."}
            </p>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            {scores ? (
              <>
                <ScoreBar label="Reading Speed" value={scores.readingSpeedScore} />
                <ScoreBar label="Phonological Accuracy" value={scores.phonologicalAccuracyScore} />
                <ScoreBar label="Writing Stability" value={scores.writingStabilityScore} />
                <ScoreBar label="Confidence Trend" value={scores.confidenceTrendScore} />
                <ScoreBar label="Visual Discrimination" value={scores.visualDiscriminationScore} />
              </>
            ) : (
              <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                <BookOpen className="w-10 h-10" />
                <p className="text-sm">No session data yet. Open the Reading Module to start.</p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link to="/dyslexia/reading-module">Open Reading Module →</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Adaptation Output */}
        <Card className="p-6 border-emerald-100 bg-white/90">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-lg text-slate-900">Weekly Adaptation Plan</CardTitle>
            {weeklyPlan?.dominantWeakness && (
              <p className="text-sm text-slate-600 mt-1">
                <strong>Focus area:</strong> {weeklyPlan.dominantWeakness}
                {weeklyPlan.improvementRate && (
                  <> · <span className="text-emerald-700">{weeklyPlan.improvementRate}</span></>
                )}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {weeklyPlan?.summary && (
              <p className="text-sm text-slate-700 mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                {weeklyPlan.summary}
              </p>
            )}
            {planDays.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {planDays.map((day) => (
                  <div key={day.day} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{day.day}</span>
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">
                        {day.day}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700"><strong>📖 Reading:</strong> {day.readingExercise}</p>
                    <p className="text-xs text-slate-700"><strong>🎵 Phoneme:</strong> {day.phonemeDrill}</p>
                    <p className="text-xs text-slate-700"><strong>✍️ Writing:</strong> {day.writingTask}</p>
                    <p className="text-xs text-emerald-700 italic">{day.encouragement}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                <Sparkles className="w-8 h-8" />
                <p className="text-sm">
                  {scores
                    ? "Click 'Generate Weekly Plan' to create your AI-powered 7-day plan."
                    : "Complete reading sessions first, then generate your weekly plan."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

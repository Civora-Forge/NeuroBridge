import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLearningProfile } from "@/lib/dyslexiaApi";
import { useDyslexiaRealtimeAnalytics } from "@/hooks/useDyslexiaRealtimeAnalytics";

const scoreItems = [
  { key: "readingSpeedScore", label: "Reading Speed Score" },
  { key: "phonologicalAccuracyScore", label: "Phonological Accuracy Score" },
  { key: "visualDiscriminationScore", label: "Visual Discrimination Score" },
  { key: "writingStabilityScore", label: "Writing Stability Score" },
  { key: "confidenceTrendScore", label: "Confidence Trend Score" },
];

export default function AIPersonalLearningProfile() {
  const [userId, setUserId] = useState("demo-user");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const { analytics, connected } = useDyslexiaRealtimeAnalytics(userId);

  const refreshProfile = async () => {
    setLoading(true);
    try {
      const response = await getLearningProfile(userId);
      setProfile(response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  return (
    <div className="min-h-screen bg-emerald-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link to="/dyslexia" className="inline-flex items-center text-emerald-700 hover:text-emerald-800">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dyslexia Module
        </Link>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-emerald-700" />
            <h1 className="text-2xl font-bold">AI Personal Learning Profile</h1>
          </div>
          <p className="text-gray-700 mb-4">Weekly evolving cognitive model with a personalized 7-day adaptive training plan.</p>
          <div className="flex gap-3">
            <input className="border rounded px-3 py-2 w-72" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={refreshProfile} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh Weekly Profile"}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Real-time analytics</h2>
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <div className="bg-white border rounded p-3">Stream: <strong>{connected ? "Connected" : "Disconnected"}</strong></div>
            <div className="bg-white border rounded p-3">Week Reading Sessions: <strong>{analytics.weekReadingSessions}</strong></div>
            <div className="bg-white border rounded p-3">Week Phonology Events: <strong>{analytics.weekPhonologyEvents}</strong></div>
            <div className="bg-white border rounded p-3">Latest Comfort: <strong>{analytics.latestComfortScore}</strong></div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Cognitive Scores</h2>
          {!profile ? (
            <p className="text-gray-600">No profile data available yet.</p>
          ) : (
            <div className="space-y-3">
              {scoreItems.map((item) => (
                <div key={item.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span>{profile[item.key] || 0}</span>
                  </div>
                  <div className="h-2 rounded bg-emerald-100">
                    <div className="h-2 rounded bg-emerald-500" style={{ width: `${profile[item.key] || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-2">Weekly Adaptation Output</h2>
          {!profile ? (
            <p className="text-gray-600">No adaptation output available yet.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p><strong>Dominant Weakness:</strong> {profile.dominantWeakness}</p>
              <p><strong>Improvement Rate:</strong> {profile.improvementRate}</p>
              <div>
                <p className="font-semibold mb-1">Recommended 7-day training plan</p>
                <pre className="whitespace-pre-wrap font-sans bg-white border rounded p-3 text-gray-700">
                  {profile.recommendedTrainingPlan}
                </pre>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

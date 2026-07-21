import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AudioLines, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logPhonologyErrors, generatePhonologyDrills } from "@/lib/dyslexiaApi";

export default function PhonologicalTrainingGenerator() {
  const [userId, setUserId] = useState("demo-user");
  const [age, setAge] = useState(14);
  const [bl, setBl] = useState(0);
  const [th, setTh] = useState(0);
  const [longA, setLongA] = useState(0);
  const [focus, setFocus] = useState("long vowel confusion");
  const [drills, setDrills] = useState("");
  const [loading, setLoading] = useState(false);

  const errorPattern = useMemo(
    () => ({ bl: Number(bl), th: Number(th), long_a: Number(longA) }),
    [bl, th, longA]
  );

  const submitAndGenerate = async () => {
    setLoading(true);
    try {
      await logPhonologyErrors({
        userId,
        exerciseContext: "sound-exercise",
        phonemeErrorPattern: errorPattern,
      });

      const response = await generatePhonologyDrills({ userId, age, focus });
      setDrills(response.drills || "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link to="/dyslexia" className="inline-flex items-center text-indigo-700 hover:text-indigo-800">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dyslexia Module
        </Link>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <AudioLines className="w-6 h-6 text-indigo-700" />
            <h1 className="text-2xl font-bold">Phonological Weakness Detection & Drill Generator</h1>
          </div>
          <p className="text-gray-700 mb-4">
            Log phoneme-level error patterns and generate targeted drills dynamically from real learner behavior.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input className="border rounded px-3 py-2" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
            <input type="number" className="border rounded px-3 py-2" value={age} onChange={(e) => setAge(Number(e.target.value))} placeholder="Age" />
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <label className="text-sm">Consonant blend errors (bl)
              <input type="number" className="w-full border rounded px-3 py-2 mt-1" value={bl} onChange={(e) => setBl(e.target.value)} />
            </label>
            <label className="text-sm">Consonant blend errors (th)
              <input type="number" className="w-full border rounded px-3 py-2 mt-1" value={th} onChange={(e) => setTh(e.target.value)} />
            </label>
            <label className="text-sm">Vowel length confusion (long_a)
              <input type="number" className="w-full border rounded px-3 py-2 mt-1" value={longA} onChange={(e) => setLongA(e.target.value)} />
            </label>
          </div>

          <label className="text-sm block mb-4">Primary focus for generation
            <input className="w-full border rounded px-3 py-2 mt-1" value={focus} onChange={(e) => setFocus(e.target.value)} />
          </label>

          <Button onClick={submitAndGenerate} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
            {loading ? "Generating..." : "Generate Dynamic AI Drills"}
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 text-indigo-700 mb-3">
            <Sparkles className="w-4 h-4" /> Generated Personalized Drills
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
            {drills || "No drills yet. Submit an error pattern to generate targeted exercises."}
          </pre>
        </Card>
      </div>
    </div>
  );
}

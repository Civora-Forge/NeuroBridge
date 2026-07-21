import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analyzeWriting } from "@/lib/dyslexiaApi";

export default function DyslexiaWritingAssistant() {
  const [userId, setUserId] = useState("demo-user");
  const [text, setText] = useState("I definately want to write becos it helps me lern");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runAssistant = async () => {
    setLoading(true);
    try {
      const response = await analyzeWriting({ userId, text });
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-rose-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link to="/dyslexia" className="inline-flex items-center text-rose-700 hover:text-rose-800">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dyslexia Module
        </Link>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <PenLine className="w-5 h-5 text-rose-700" />
            <h1 className="text-2xl font-bold">Dyslexia-Aware Writing Assistant</h1>
          </div>
          <p className="text-gray-700 mb-4">
            Gentle phonetic correction with encouraging explanations. No harsh red-underlines or punitive feedback.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input className="border rounded px-3 py-2" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-32 border rounded px-3 py-2"
            placeholder="Write your paragraph here"
          />

          <Button className="mt-4 bg-rose-600 hover:bg-rose-700" onClick={runAssistant} disabled={loading}>
            {loading ? "Analyzing..." : "Run AI Writing Support"}
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Supportive Output</h2>
          {!result ? (
            <p className="text-gray-600">No analysis yet.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Corrected text</p>
                <p className="bg-rose-50 rounded p-3">{result.correctedText}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Simple explanations</p>
                <ul className="space-y-2">
                  {(result.corrections || []).map((item, idx) => (
                    <li key={`${item.original}-${idx}`} className="bg-white border rounded p-3">
                      <strong>{item.original}</strong> → <strong>{item.corrected}</strong>
                      <p className="text-sm text-gray-600 mt-1">{item.explanation}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-3 text-green-800">
                {result.encouragement}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

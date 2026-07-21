import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Volume2, Puzzle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackReinforcementEvent } from "@/lib/dyslexiaApi";

const sourceText = "Learning happens when the brain connects sound, shape, and movement together.";

const syllablesForWord = (word) => word.replace(/[^a-zA-Z]/g, "").split(/(?<=[aeiouAEIOU])/).filter(Boolean);

export default function MultiSensoryReinforcementMode() {
  const [userId, setUserId] = useState("demo-user");
  const [sessionId] = useState(`session-${Date.now()}`);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showSyllables, setShowSyllables] = useState(false);
  const [selectedWord, setSelectedWord] = useState("learning");
  const [buildTarget] = useState("because");
  const [buildPool, setBuildPool] = useState(["be", "cause", "au", "bec", "se"]);
  const [buildResult, setBuildResult] = useState([]);

  const words = useMemo(() => sourceText.split(" "), []);

  const speakWithHighlight = async () => {
    if (!("speechSynthesis" in window)) return;

    for (let idx = 0; idx < words.length; idx += 1) {
      setHighlightIndex(idx);
      const utterance = new SpeechSynthesisUtterance(words[idx]);
      await new Promise((resolve) => {
        utterance.onend = resolve;
        window.speechSynthesis.speak(utterance);
      });
      await trackReinforcementEvent({ userId, sessionId, phase: "Hear", word: words[idx], latencyMs: 350 });
    }

    setHighlightIndex(-1);
  };

  const tapToHearPhoneme = async () => {
    if (!("speechSynthesis" in window)) return;
    const chunks = syllablesForWord(selectedWord);
    for (const chunk of chunks) {
      const utterance = new SpeechSynthesisUtterance(chunk);
      await new Promise((resolve) => {
        utterance.onend = resolve;
        window.speechSynthesis.speak(utterance);
      });
      await trackReinforcementEvent({ userId, sessionId, phase: "Tap-to-Hear", word: chunk, latencyMs: 220 });
    }
  };

  const addChunk = async (chunk) => {
    setBuildResult((prev) => [...prev, chunk]);
    setBuildPool((prev) => prev.filter((item, idx) => !(item === chunk && prev.indexOf(item) === idx)));
    await trackReinforcementEvent({ userId, sessionId, phase: "Build", word: chunk, latencyMs: 300 });
  };

  const resetBuild = () => {
    setBuildPool(["be", "cause", "au", "bec", "se"]);
    setBuildResult([]);
  };

  const builtWord = buildResult.join("");
  const isCorrectBuild = builtWord.toLowerCase() === buildTarget;

  return (
    <div className="min-h-screen bg-cyan-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link to="/dyslexia" className="inline-flex items-center text-cyan-700 hover:text-cyan-800">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dyslexia Module
        </Link>

        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-2">Intelligent Multi-Sensory Reinforcement Mode</h1>
          <p className="text-gray-700 mb-4">Cognitive Reinforcement Loop: <strong>Read → Hear → Build → Spell → Re-read</strong></p>
          <input className="border rounded px-3 py-2 w-full md:w-72" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">1) Read + Hear with synced highlighting</h2>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={speakWithHighlight}>
              <Volume2 className="w-4 h-4 mr-1" /> Start TTS Sync
            </Button>
          </div>
          <p className="leading-8 text-lg">
            {words.map((word, idx) => (
              <span key={`${word}-${idx}`} className={`mr-1 px-1 rounded ${idx === highlightIndex ? "bg-yellow-200" : ""}`}>
                {showSyllables ? syllablesForWord(word).join("-") : word}
              </span>
            ))}
          </p>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showSyllables} onChange={(e) => setShowSyllables(e.target.checked)} />
            Syllable segmentation toggle
          </label>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">2) Tap-to-hear phoneme breakdown</h2>
          <div className="flex gap-3 flex-wrap">
            <input className="border rounded px-3 py-2" value={selectedWord} onChange={(e) => setSelectedWord(e.target.value)} placeholder="Word" />
            <Button variant="outline" onClick={tapToHearPhoneme}>Tap to Hear</Button>
          </div>
          <p className="text-sm text-gray-600">Phoneme chunks: {syllablesForWord(selectedWord).join(" | ") || "-"}</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">3) Drag-and-build word reconstruction</h2>
          <p className="text-sm text-gray-600">Target word to build: <strong>{buildTarget}</strong></p>
          <div className="flex gap-2 flex-wrap">
            {buildPool.map((chunk, idx) => (
              <button key={`${chunk}-${idx}`} className="px-3 py-2 rounded bg-indigo-100 text-indigo-800" onClick={() => addChunk(chunk)}>
                {chunk}
              </button>
            ))}
          </div>
          <div className="p-3 rounded border bg-white">Built word: <strong>{builtWord || "(empty)"}</strong></div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetBuild}>Reset</Button>
            {isCorrectBuild && <span className="text-green-700 font-semibold">Great build. Re-read it aloud now.</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

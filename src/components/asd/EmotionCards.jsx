import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Volume2, Gamepad2, RotateCcw } from "lucide-react";

// Enrich each emotion with visual data
const EMOTION_META = {
  Calm:        { emoji: "😌", face: "😌", color: "bg-teal-100 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700",         active: "ring-teal-400 bg-teal-50 dark:bg-teal-900/60",      text: "text-teal-700 dark:text-teal-300",     accent: "bg-teal-500"     },
  Excited:     { emoji: "🤩", face: "🤩", color: "bg-yellow-100 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-700", active: "ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/60", text: "text-yellow-700 dark:text-yellow-300", accent: "bg-yellow-500"   },
  Worried:     { emoji: "😟", face: "😟", color: "bg-orange-100 dark:bg-orange-950/50 border-orange-300 dark:border-orange-700", active: "ring-orange-400 bg-orange-50 dark:bg-orange-900/60", text: "text-orange-700 dark:text-orange-300", accent: "bg-orange-500"   },
  Frustrated:  { emoji: "😤", face: "😤", color: "bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-700",             active: "ring-red-400 bg-red-50 dark:bg-red-900/60",           text: "text-red-700 dark:text-red-300",       accent: "bg-red-500"      },
  Overwhelmed: { emoji: "😰", face: "😰", color: "bg-purple-100 dark:bg-purple-950/50 border-purple-300 dark:border-purple-700", active: "ring-purple-400 bg-purple-50 dark:bg-purple-900/60", text: "text-purple-700 dark:text-purple-300", accent: "bg-purple-500"   },
  Upset:       { emoji: "😢", face: "😢", color: "bg-blue-100 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700",         active: "ring-blue-400 bg-blue-50 dark:bg-blue-900/60",       text: "text-blue-700 dark:text-blue-300",     accent: "bg-blue-500"     },
};

const ENCOURAGE_CORRECT = ["Amazing! 🌟", "You got it! 🎉", "Super smart! ⭐", "Wonderful! 💙", "Brilliant! 🏆"];
const ENCOURAGE_WRONG   = ["Not quite — try again! 💪", "Almost there! Keep going 🌸", "Good try! You can do it 💡"];

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function useSpeech() {
  const speak = useCallback((text, rate = 1, pitch = 1.15) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.pitch = pitch;
    window.speechSynthesis.speak(u);
  }, []);
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  return speak;
}

export default function EmotionCards({ states, selectedEmotion, onSelectEmotion, onReadEmotion }) {
  const speak = useSpeech();
  const activeState = states.find((s) => s.label === selectedEmotion) || states[0];

  // Quiz mode state
  const [quizMode, setQuizMode] = useState(false);
  const [quizTarget, setQuizTarget] = useState(null);
  const [quizAnswered, setQuizAnswered] = useState(null); // null | "correct" | "wrong"
  const [quizMessage, setQuizMessage] = useState("");
  const [wrongGuess, setWrongGuess] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [quizOptions, setQuizOptions] = useState([]);

  const startQuiz = useCallback(() => {
    const target = pick(states);
    const others = shuffle(states.filter((s) => s.label !== target.label)).slice(0, 3);
    const options = shuffle([target, ...others]);
    setQuizTarget(target);
    setQuizOptions(options);
    setQuizAnswered(null);
    setQuizMessage("");
    setWrongGuess(null);
    setQuizMode(true);
    speak(`Which emotion is this?`);
  }, [states, speak]);

  const handleQuizAnswer = (state) => {
    if (quizAnswered) return;
    const correct = state.label === quizTarget.label;
    setScore((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    if (correct) {
      setQuizAnswered("correct");
      const msg = pick(ENCOURAGE_CORRECT);
      setQuizMessage(msg);
      speak(`${msg} It is ${quizTarget.label}! ${quizTarget.supportText}`, 0.95);
    } else {
      setWrongGuess(state.label);
      setQuizAnswered("wrong");
      const msg = pick(ENCOURAGE_WRONG);
      setQuizMessage(msg);
      speak(`${msg} This emotion is ${quizTarget.label}.`, 0.9);
    }
  };

  const nextQuestion = () => startQuiz();
  const exitQuiz = () => { setQuizMode(false); setScore({ correct: 0, total: 0 }); };

  const handleCardClick = (state) => {
    onSelectEmotion(state);
    const meta = EMOTION_META[state.label] || {};
    speak(`${state.label}. ${state.supportText}`, 0.92);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><Heart size={20} /> Emotional Check-in</CardTitle>
        <CardDescription>Tap any emotion to hear its name and get support. Try the quiz to practise!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Quiz mode */}
        <AnimatePresence mode="wait">
          {quizMode && quizTarget ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl border-2 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 p-5 space-y-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-bold text-violet-700 dark:text-violet-300 text-lg">Which emotion is this? 🤔</p>
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border-0">
                    Score: {score.correct}/{score.total}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={exitQuiz} className="text-muted-foreground">Exit Quiz</Button>
                </div>
              </div>

              {/* Mystery emoji */}
              <div className="flex justify-center">
                <motion.div
                  key={quizTarget.label}
                  initial={{ scale: 0.5, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                  className="text-9xl select-none"
                  aria-label="Guess this emotion"
                >
                  {(EMOTION_META[quizTarget.label] || {}).face || "🙂"}
                </motion.div>
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {quizAnswered && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`rounded-xl px-4 py-3 text-center font-semibold ${
                      quizAnswered === "correct"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-700 dark:text-emerald-300"
                        : "bg-orange-50 dark:bg-orange-950/40 border border-orange-300 text-orange-700 dark:text-orange-300"
                    }`}
                  >
                    {quizMessage}
                    {quizAnswered === "wrong" && <p className="text-sm font-medium mt-1">It was: <strong>{quizTarget.label}</strong></p>}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Answer options */}
              <div className="grid grid-cols-2 gap-3">
                {quizOptions.map((option) => {
                  const meta = EMOTION_META[option.label] || {};
                  const isCorrectAnswer = quizAnswered && option.label === quizTarget.label;
                  const isWrongAnswer   = wrongGuess === option.label;
                  return (
                    <motion.button
                      key={option.label}
                      whileHover={!quizAnswered ? { scale: 1.04 } : {}}
                      whileTap={!quizAnswered ? { scale: 0.95 } : {}}
                      animate={isWrongAnswer ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                      transition={{ duration: 0.4 }}
                      disabled={!!quizAnswered}
                      onClick={() => handleQuizAnswer(option)}
                      className={`rounded-2xl border-2 p-4 text-center transition-all ${
                        isCorrectAnswer
                          ? "bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 ring-2 ring-emerald-400"
                          : isWrongAnswer
                          ? "bg-red-100 dark:bg-red-900/40 border-red-400"
                          : quizAnswered ? "opacity-50 " + meta.color
                          : meta.color + " hover:ring-2 ring-offset-1 " + (meta.active || "")
                      }`}
                    >
                      <span className="text-5xl block mb-1" aria-hidden="true">{meta.face || "🙂"}</span>
                      <span className="font-semibold text-sm">{option.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {quizAnswered && (
                <Button className="w-full gap-2 rounded-xl h-11" onClick={nextQuestion}>
                  <RotateCcw size={16} /> Next Question
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Emotion grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {states.map((state) => {
                  const meta = EMOTION_META[state.label] || {};
                  const isActive = selectedEmotion === state.label;
                  return (
                    <motion.button
                      key={state.label}
                      whileHover={{ scale: 1.05, y: -3 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleCardClick(state)}
                      className={`rounded-2xl border-2 p-4 text-center transition-all ${
                        isActive
                          ? `${meta.color} ring-2 ring-offset-2 ${meta.active}`
                          : meta.color
                      }`}
                    >
                      <motion.span
                        className="text-5xl block mb-2 select-none"
                        aria-hidden="true"
                        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.4 }}
                      >
                        {meta.face || "🙂"}
                      </motion.span>
                      <p className={`font-bold text-sm ${meta.text || ""}`}>{state.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{state.supportText}</p>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status and controls */}
        {!quizMode && (
          <div className="space-y-3">
            {/* Selected emotion display */}
            <AnimatePresence mode="wait">
              {activeState && (
                <motion.div
                  key={activeState.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-2xl border-2 p-4 flex items-center gap-4 ${(EMOTION_META[activeState.label] || {}).color || ""}`}
                >
                  <span className="text-5xl flex-shrink-0" aria-hidden="true">{(EMOTION_META[activeState.label] || {}).face || "🙂"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-base ${(EMOTION_META[activeState.label] || {}).text || ""}`}>
                      I feel <span className="capitalize">{activeState.label}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">{activeState.supportText}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Badge variant={activeState.risk === "high" ? "destructive" : "secondary"} className="text-xs">
                      {activeState.risk}
                    </Badge>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => speak(`${activeState.label}. ${activeState.supportText}`, 0.92)}>
                      <Volume2 size={13} />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quiz button */}
            <Button
              variant="outline"
              className="w-full gap-2 rounded-xl h-11 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
              onClick={startQuiz}
            >
              <Gamepad2 size={18} /> Play Emotion Quiz
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronLeft, ChevronRight, Pencil, Play, Plus, Repeat, Trash2, Volume2, VolumeX, X } from "lucide-react";

const STEP_COLORS = [
  "from-blue-400 to-blue-600",
  "from-violet-400 to-violet-600",
  "from-amber-400 to-amber-600",
  "from-emerald-400 to-emerald-600",
  "from-pink-400 to-pink-600",
  "from-teal-400 to-teal-600",
  "from-orange-400 to-orange-600",
];

const createEmptyStep = () => ({
  id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  text: "",
  image_url: "",
});

const inferEmojiForText = (text = "") => {
  const v = text.toLowerCase();
  if (/school|class|teacher|homework/.test(v)) return "🏫";
  if (/doctor|hospital|clinic|nurse/.test(v)) return "🩺";
  if (/store|grocery|shopping|market/.test(v)) return "🛒";
  if (/bus|car|ride|travel|road/.test(v)) return "🚌";
  if (/break|breathe|calm|quiet|rest/.test(v)) return "🌿";
  if (/eat|snack|lunch|breakfast|dinner/.test(v)) return "🍽️";
  if (/play|game|fun|recess/.test(v)) return "🎲";
  if (/celebrate|done|finish|congrat/.test(v)) return "🎉";
  if (/wait|delay|late/.test(v)) return "⏳";
  if (/help|support|ask/.test(v)) return "🤝";
  return "💡";
};

const normalizeStorySteps = (story) => {
  if (Array.isArray(story?.steps) && story.steps.length > 0) {
    return story.steps.map((step, i) => ({
      id: step.id || `${story.id}-step-${i + 1}`,
      text: typeof step.text === "string" ? step.text : "",
      image_url: typeof step.image_url === "string" ? step.image_url : "",
    }));
  }
  if (typeof story?.content === "string" && story.content.trim()) {
    return [{ id: `${story.id}-legacy`, text: story.content, image_url: "" }];
  }
  return [{ id: `${story?.id || "draft"}-fallback`, text: "No step content available.", image_url: "" }];
};

const normalizeStory = (story) => ({ ...story, steps: normalizeStorySteps(story) });

const buildStoryPayload = ({ title, steps }) => {
  const cleanedSteps = steps
    .map((s) => ({ id: s.id || `step-${Date.now()}`, text: (s.text || "").trim(), image_url: (s.image_url || "").trim() }))
    .filter((s) => s.text.length > 0);
  return { title: title.trim(), steps: cleanedSteps, content: cleanedSteps[0]?.text || "" };
};

const moveStep = (list, from, to) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const buildTaskSteps = (taskText) => {
  const task = taskText.trim();
  if (!task) return [];
  return [
    { id: `step-${Date.now()}-1`, text: `First, I look at my plan for: ${task}.`, image_url: "" },
    { id: `step-${Date.now()}-2`, text: "Next, I take one small step and ask for help if needed.", image_url: "" },
    { id: `step-${Date.now()}-3`, text: "Then, I take a short calm break (3 breaths or quiet minute).", image_url: "" },
    { id: `step-${Date.now()}-4`, text: "After that, I finish the next step at my own pace.", image_url: "" },
    { id: `step-${Date.now()}-5`, text: "Finally, I celebrate progress, even if it is not perfect.", image_url: "" },
  ];
};

function useReadAloud() {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef(null);

  const speak = useCallback((text) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    utter.pitch = 1.1;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, []);

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  return { speaking, speak, stop };
}

export default function SocialStoryBuilder({ role, stories, loading, onCreateStory, onUpdateStory, onDeleteStory }) {
  const canManageStories = role === "guardian";
  const normalizedStories = useMemo(() => stories.map(normalizeStory), [stories]);
  const { speaking, speak, stop } = useReadAloud();

  const [draftTitle, setDraftTitle] = useState("");
  const [draftSteps, setDraftSteps] = useState([createEmptyStep()]);
  const [taskBreakdownInput, setTaskBreakdownInput] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSteps, setEditingSteps] = useState([]);
  const [activeStoryId, setActiveStoryId] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const [autoPlaySeconds, setAutoPlaySeconds] = useState(5);

  const activeStory = useMemo(() => normalizedStories.find((s) => s.id === activeStoryId) || null, [normalizedStories, activeStoryId]);
  const activeSteps = activeStory?.steps || [];
  const activeStep = activeSteps[activeStepIndex] || null;

  useEffect(() => {
    if (!autoPlayEnabled || !activeStory || activeSteps.length === 0) return;
    if (activeStepIndex >= activeSteps.length - 1) return;
    const wait = Math.max(2, Number(autoPlaySeconds) || 5) * 1000;
    const id = setTimeout(() => setActiveStepIndex((p) => Math.min(p + 1, activeSteps.length - 1)), wait);
    return () => clearTimeout(id);
  }, [autoPlayEnabled, autoPlaySeconds, activeStory, activeStepIndex, activeSteps.length]);

  // Auto read-aloud when step changes
  useEffect(() => {
    if (activeStep?.text) speak(activeStep.text);
  }, [activeStep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraftStep = (i, patch) => setDraftSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const updateEditingStep = (i, patch) => setEditingSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const startStory = (storyId) => { setActiveStoryId(storyId); setActiveStepIndex(0); };
  const exitStory = () => { setActiveStoryId(null); setActiveStepIndex(0); setAutoPlayEnabled(false); stop(); };
  const replayStory = () => setActiveStepIndex(0);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><BookOpen size={20} /> Social Story Builder</CardTitle>
        <CardDescription>Interactive story cards with read-aloud and visual illustrations for each step.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Active story player */}
        {activeStory && activeStep && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-4"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-bold text-xl">{activeStory.title}</p>
                <p className="text-sm text-muted-foreground">Step {activeStepIndex + 1} of {activeSteps.length}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="gap-1" onClick={speaking ? stop : () => speak(activeStep.text)}>
                  {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  {speaking ? "Stop" : "Read Aloud"}
                </Button>
                <Badge variant="secondary">Story Mode</Badge>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 flex-wrap">
              {activeSteps.map((_, i) => (
                <motion.button
                  key={i}
                  onClick={() => setActiveStepIndex(i)}
                  className={`rounded-full transition-all ${i === activeStepIndex ? "w-6 h-3 bg-blue-500" : i < activeStepIndex ? "w-3 h-3 bg-emerald-400" : "w-3 h-3 bg-muted-foreground/30"}`}
                  whileHover={{ scale: 1.3 }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeStory.id}-${activeStep.id}-${activeStepIndex}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="rounded-2xl overflow-hidden border-2 border-border bg-card"
              >
                {/* Illustration area */}
                {activeStep.image_url ? (
                  <img src={activeStep.image_url} alt={`Step ${activeStepIndex + 1}`} className="w-full max-h-72 object-cover" />
                ) : (
                  <div className={`w-full h-52 flex flex-col items-center justify-center bg-gradient-to-br ${STEP_COLORS[activeStepIndex % STEP_COLORS.length]}`}>
                    <motion.span
                      className="text-7xl select-none"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
                      aria-hidden="true"
                    >
                      {inferEmojiForText(activeStep.text)}
                    </motion.span>
                  </div>
                )}

                {/* Step text - tappable */}
                <motion.div
                  className="p-5 cursor-pointer select-none"
                  whileTap={{ scale: 0.98, backgroundColor: "rgba(99,102,241,0.06)" }}
                  onClick={() => speak(activeStep.text)}
                >
                  <p className="text-2xl md:text-3xl leading-relaxed font-semibold tracking-wide">
                    {activeStep.text}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Tap text to hear it again</p>
                </motion.div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-1 rounded-xl h-11" disabled={activeStepIndex === 0} onClick={() => setActiveStepIndex((p) => Math.max(0, p - 1))}>
                <ChevronLeft size={16} /> Previous
              </Button>
              {activeStepIndex < activeSteps.length - 1 ? (
                <Button className="gap-1 rounded-xl h-11" onClick={() => setActiveStepIndex((p) => Math.min(activeSteps.length - 1, p + 1))}>
                  Next <ChevronRight size={16} />
                </Button>
              ) : (
                <Button variant="default" className="gap-1 rounded-xl h-11 bg-emerald-500 hover:bg-emerald-600" onClick={exitStory}>
                  🎉 Finish!
                </Button>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1" onClick={replayStory}><Repeat size={14} /> Replay</Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAutoPlayEnabled((v) => !v)}>
                <Play size={14} /> {autoPlayEnabled ? "Auto-play On" : "Auto-play Off"}
              </Button>
              {autoPlayEnabled && (
                <div className="flex items-center gap-1">
                  <Input type="number" min={2} max={20} value={autoPlaySeconds}
                    onChange={(e) => setAutoPlaySeconds(Math.max(2, Math.min(20, Number(e.target.value) || 5)))}
                    className="w-20 h-8" />
                  <span className="text-xs text-muted-foreground">s/step</span>
                </div>
              )}
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={exitStory}>
                <X size={14} /> Exit
              </Button>
            </div>
          </motion.div>
        )}

        {/* Guardian story builder */}
        {canManageStories && (
          <div className="rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 p-4 space-y-3">
            <p className="font-semibold text-violet-700 dark:text-violet-300">Create New Story</p>

            <div className="rounded-xl border bg-background/60 p-3 space-y-2">
              <p className="text-sm font-medium">Quick Task Breakdown</p>
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="E.g. Going to school on Monday" value={taskBreakdownInput}
                  onChange={(e) => setTaskBreakdownInput(e.target.value)} className="flex-1 min-w-52" />
                <Button variant="outline" onClick={() => {
                  const generated = buildTaskSteps(taskBreakdownInput);
                  if (!generated.length) return;
                  if (!draftTitle.trim()) setDraftTitle(taskBreakdownInput.trim());
                  setDraftSteps(generated);
                }}>Auto Create Cards</Button>
              </div>
            </div>

            <Input placeholder="Story title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            <div className="space-y-2">
              {draftSteps.map((step, i) => (
                <div key={step.id} className="rounded-xl border p-3 space-y-2 bg-background/60">
                  <p className="text-xs font-semibold text-muted-foreground">Card {i + 1} {inferEmojiForText(step.text)}</p>
                  <Textarea placeholder="Step text" value={step.text} onChange={(e) => updateDraftStep(i, { text: e.target.value })} />
                  <Input placeholder="Image URL (optional)" value={step.image_url} onChange={(e) => updateDraftStep(i, { image_url: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={i === 0} onClick={() => setDraftSteps((p) => moveStep(p, i, i - 1))}>↑ Up</Button>
                    <Button size="sm" variant="outline" disabled={i === draftSteps.length - 1} onClick={() => setDraftSteps((p) => moveStep(p, i, i + 1))}>↓ Down</Button>
                    <Button size="sm" variant="destructive" disabled={draftSteps.length <= 1} onClick={() => setDraftSteps((p) => p.filter((_, idx) => idx !== i))}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setDraftSteps((p) => [...p, createEmptyStep()])}><Plus size={14} /> Add Card</Button>
              <Button className="gap-2" onClick={() => {
                const payload = buildStoryPayload({ title: draftTitle, steps: draftSteps });
                if (!payload.title || payload.steps.length === 0) return;
                onCreateStory(payload);
                setDraftTitle(""); setDraftSteps([createEmptyStep()]);
              }}><Plus size={16} /> Save Story</Button>
            </div>
          </div>
        )}

        {/* Story list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading social stories...</p>
        ) : (
          <div className="space-y-4">
            {normalizedStories.length === 0 && <p className="text-sm text-muted-foreground">No social stories yet.</p>}
            {normalizedStories.map((story) => {
              const isEditing = editingId === story.id;
              const isBuiltIn = Boolean(story.is_builtin) || String(story.id).startsWith("builtin-");
              return (
                <motion.article
                  key={story.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border-2 border-border p-4 space-y-3 bg-card/60"
                >
                  {isEditing ? (
                    <>
                      <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
                      <div className="space-y-2">
                        {editingSteps.map((step, i) => (
                          <div key={step.id} className="rounded-xl border p-2 space-y-2 bg-background/60">
                            <p className="text-xs text-muted-foreground">Card {i + 1} {inferEmojiForText(step.text)}</p>
                            <Textarea value={step.text} onChange={(e) => updateEditingStep(i, { text: e.target.value })} />
                            <Input placeholder="Image URL (optional)" value={step.image_url} onChange={(e) => updateEditingStep(i, { image_url: e.target.value })} />
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" disabled={i === 0} onClick={() => setEditingSteps((p) => moveStep(p, i, i - 1))}>↑</Button>
                              <Button size="sm" variant="outline" disabled={i === editingSteps.length - 1} onClick={() => setEditingSteps((p) => moveStep(p, i, i + 1))}>↓</Button>
                              <Button size="sm" variant="destructive" disabled={editingSteps.length <= 1} onClick={() => setEditingSteps((p) => p.filter((_, idx) => idx !== i))}>Remove</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditingSteps((p) => [...p, createEmptyStep()])}>Add Card</Button>
                      <div className="flex gap-2">
                        <Button onClick={() => {
                          const payload = buildStoryPayload({ title: editingTitle, steps: editingSteps });
                          if (!payload.title || payload.steps.length === 0) return;
                          onUpdateStory(story.id, payload); setEditingId(null);
                        }}>Save</Button>
                        <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-lg">{story.title}</p>
                          <p className="text-xs text-muted-foreground">{story.steps.length} story cards</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{isBuiltIn ? "Built-in" : "Custom"}</Badge>
                          {!isBuiltIn && canManageStories && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditingId(story.id); setEditingTitle(story.title); setEditingSteps(story.steps.map((s) => ({ ...s }))); }}>
                              <Pencil size={14} /> Edit
                            </Button>
                          )}
                          {!isBuiltIn && canManageStories && (
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => onDeleteStory(story.id)}><Trash2 size={14} /></Button>
                          )}
                          <Button size="sm" className="gap-1 bg-blue-500 hover:bg-blue-600 text-white" onClick={() => startStory(story.id)}>
                            <Play size={14} /> Start Story
                          </Button>
                        </div>
                      </div>

                      {/* Card previews */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {story.steps.map((step, i) => (
                          <motion.button
                            key={step.id}
                            whileHover={{ scale: 1.04, y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => startStory(story.id)}
                            className="rounded-xl overflow-hidden border-2 border-border bg-card text-left"
                          >
                            {step.image_url ? (
                              <img src={step.image_url} alt={`Step ${i + 1}`} className="w-full h-20 object-cover" />
                            ) : (
                              <div className={`w-full h-20 flex items-center justify-center bg-gradient-to-br ${STEP_COLORS[i % STEP_COLORS.length]}`}>
                                <span className="text-3xl" aria-hidden="true">{inferEmojiForText(step.text)}</span>
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-xs font-semibold text-muted-foreground">Step {i + 1}</p>
                              <p className="text-xs line-clamp-2 mt-0.5">{step.text}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </>
                  )}
                </motion.article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

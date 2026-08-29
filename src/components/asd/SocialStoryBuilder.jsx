import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  AsdCard,
  AsdCharacter,
  AsdCelebration,
  AsdChip,
  AsdProgressDots,
  useASDPracticeCounts,
  PROGRESS_EVENTS,
} from "@/components/asd/ui";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

const SCENE_GRADIENTS = [
  "linear-gradient(135deg,#D7F5EC 0%,#A7F3D0 100%)",
  "linear-gradient(135deg,#E0F2FE 0%,#BAE6FD 100%)",
  "linear-gradient(135deg,#FDF2D7 0%,#FDE68A 100%)",
  "linear-gradient(135deg,#EDE9FE 0%,#DDD6FE 100%)",
  "linear-gradient(135deg,#FFE4E6 0%,#FECDD3 100%)",
];

const SCENE_TONES = ["teal", "sky", "amber", "violet", "rose"];

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

export default function SocialStoryBuilder({ role, stories, loading, onCreateStory, onUpdateStory, onDeleteStory, learnerId }) {
  const canManageStories = role === "guardian";
  const normalizedStories = useMemo(() => stories.map(normalizeStory), [stories]);
  const { speaking, speak, stop } = useReadAloud();
  const { recordEvent } = useASDPracticeCounts(learnerId);
  const { reduced, gentle } = useSensoryReducedMotion();

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
  const [justFinished, setJustFinished] = useState(false);

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

  useEffect(() => {
    if (activeStep?.text) speak(activeStep.text);
  }, [activeStep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraftStep = (i, patch) => setDraftSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const updateEditingStep = (i, patch) => setEditingSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const startStory = (storyId) => { setJustFinished(false); setActiveStoryId(storyId); setActiveStepIndex(0); };
  const exitStory = () => { setActiveStoryId(null); setActiveStepIndex(0); setAutoPlayEnabled(false); setJustFinished(false); stop(); };
  const replayStory = () => { setJustFinished(false); setActiveStepIndex(0); };
  const finishStory = () => {
    setJustFinished(true);
    recordEvent(PROGRESS_EVENTS.STORY_FINISHED);
    stop();
  };

  return (
    <AsdCard tone="stone" className="!rounded-2xl !shadow-[4px_4px_0_#B2DFDB]">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-gradient-to-br from-[#2DD4A8] to-[#0D9488] text-white shadow-[2px_2px_0_#D5F5EC]">
          <BookOpen size={20} />
        </span>
        <div>
          <h2 className="text-xl font-black text-[#134E4A]">Social Stories</h2>
          <p className="text-sm text-[#5F8A87]">Illustrated stories, read one scene at a time — tap a scene to hear it.</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {/* ── Active story player ── */}
        {activeStory && activeStep && (
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: gentle ? 0.3 : 0.4, ease: "easeOut" }}
            className="rounded-2xl border-2 border-[#5EEAD4] bg-[#F0FAF7] p-4"
          >
            {justFinished ? (
              <div className="py-6">
                <AsdCelebration label={`Story finished: ${activeStory.title}`} sub="That's one full story done — small steps count." />
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button className="gap-1 rounded-xl h-11 bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold" onClick={replayStory}>
                    <Repeat size={15} /> Read it again
                  </Button>
                  <Button variant="outline" className="gap-1 rounded-xl h-11 border-[#B2DFDB] text-[#134E4A]" onClick={exitStory}>
                    <CheckCircle2 size={15} /> Back to all stories
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-xl text-[#134E4A]">{activeStory.title}</p>
                    <p className="text-sm text-[#5F8A87]">Scene {activeStepIndex + 1} of {activeSteps.length}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="gap-1 text-[#134E4A]" onClick={speaking ? stop : () => speak(activeStep.text)}>
                      {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      {speaking ? "Stop" : "Read Aloud"}
                    </Button>
                    <AsdChip tone="teal">Story Mode</AsdChip>
                  </div>
                </div>

                <AsdProgressDots total={activeSteps.length} current={activeStepIndex} onSelect={setActiveStepIndex} tone="teal" labelPrefix="Scene" />

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeStory.id}-${activeStep.id}-${activeStepIndex}`}
                    initial={{ opacity: 0, x: reduced ? 0 : 36 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: reduced ? 0 : -36 }}
                    transition={{ duration: gentle ? 0.25 : 0.32, ease: "easeOut" }}
                    className="overflow-hidden rounded-2xl border-2 border-[#B2DFDB] bg-white"
                  >
                    {/* Illustrated scene */}
                    {activeStep.image_url ? (
                      <div className="relative">
                        <img src={activeStep.image_url} alt={`Scene ${activeStepIndex + 1}`} className="h-56 w-full object-cover" />
                        <span className="absolute left-3 top-3"><AsdChip tone="teal">Scene {activeStepIndex + 1}</AsdChip></span>
                      </div>
                    ) : (
                      <div className="relative h-56 w-full" style={{ background: SCENE_GRADIENTS[activeStepIndex % SCENE_GRADIENTS.length] }}>
                        <div className="absolute inset-0 grid place-items-center">
                          <motion.span
                            aria-hidden="true"
                            className="text-7xl select-none drop-shadow-[0_4px_10px_rgba(13,148,136,0.2)]"
                            initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: gentle ? 0.3 : 0.4, type: "spring", bounce: reduced ? 0 : 0.32 }}
                          >
                            {inferEmojiForText(activeStep.text)}
                          </motion.span>
                        </div>
                        <AsdCharacter size={64} tone={SCENE_TONES[activeStepIndex % SCENE_TONES.length]} ariaHidden className="absolute right-4 bottom-3" />
                        <span className="absolute left-3 top-3"><AsdChip tone="teal">Scene {activeStepIndex + 1}</AsdChip></span>
                      </div>
                    )}

                    {/* Step text */}
                    <motion.div
                      className="cursor-pointer p-5 select-none"
                      whileTap={reduced ? undefined : { scale: 0.985 }}
                      onClick={() => speak(activeStep.text)}
                    >
                      <p className="text-xl md:text-2xl leading-relaxed font-semibold tracking-wide text-[#134E4A]">
                        {activeStep.text}
                      </p>
                      <p className="text-xs text-[#5F8A87] mt-2">Tap the words to hear them again</p>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-1 rounded-xl h-11 border-[#B2DFDB] text-[#134E4A]" disabled={activeStepIndex === 0} onClick={() => setActiveStepIndex((p) => Math.max(0, p - 1))}>
                    <ChevronLeft size={16} /> Previous
                  </Button>
                  {activeStepIndex < activeSteps.length - 1 ? (
                    <Button className="gap-1 rounded-xl h-11 bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold" onClick={() => setActiveStepIndex((p) => Math.min(activeSteps.length - 1, p + 1))}>
                      Next <ChevronRight size={16} />
                    </Button>
                  ) : (
                    <Button className="gap-1 rounded-xl h-11 bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold" onClick={finishStory}>
                      <CheckCircle2 size={16} /> Finish!
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="gap-1 border-[#B2DFDB] text-[#134E4A]" onClick={replayStory}><Repeat size={14} /> Replay</Button>
                  <Button variant="outline" size="sm" className="gap-1 border-[#B2DFDB] text-[#134E4A]" onClick={() => setAutoPlayEnabled((v) => !v)}>
                    <Play size={14} /> {autoPlayEnabled ? "Auto-play On" : "Auto-play Off"}
                  </Button>
                  {autoPlayEnabled && (
                    <div className="flex items-center gap-1">
                      <Input type="number" min={2} max={20} value={autoPlaySeconds}
                        onChange={(e) => setAutoPlaySeconds(Math.max(2, Math.min(20, Number(e.target.value) || 5)))}
                        className="w-20 h-8 border-[#B2DFDB]" />
                      <span className="text-xs text-[#5F8A87]">s/scene</span>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="gap-1 text-[#5F8A87]" onClick={exitStory}>
                    <X size={14} /> Exit
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Guardian story builder ── */}
        {canManageStories && (
          <div className="rounded-2xl border-2 border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-3">
            <p className="font-semibold text-[#0D9488]">Create a new story</p>

            <div className="rounded-xl border border-[#B2DFDB] bg-white/60 p-3 space-y-2">
              <p className="text-sm font-medium text-[#134E4A]">Quick scene breakdown</p>
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="E.g. Going to school on Monday" value={taskBreakdownInput}
                  onChange={(e) => setTaskBreakdownInput(e.target.value)} className="flex-1 min-w-52 border-[#B2DFDB] focus:border-[#0D9488]" />
                <Button variant="outline" className="border-[#B2DFDB] text-[#134E4A]" onClick={() => {
                  const generated = buildTaskSteps(taskBreakdownInput);
                  if (!generated.length) return;
                  if (!draftTitle.trim()) setDraftTitle(taskBreakdownInput.trim());
                  setDraftSteps(generated);
                }}>Auto create scenes</Button>
              </div>
            </div>

            <Input placeholder="Story title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="border-[#B2DFDB] focus:border-[#0D9488]" />
            <div className="space-y-2">
              {draftSteps.map((step, i) => (
                <div key={step.id} className="rounded-xl border border-[#B2DFDB] p-3 space-y-2 bg-white/70">
                  <p className="text-xs font-semibold text-[#5F8A87]">Scene {i + 1} <span aria-hidden="true">{inferEmojiForText(step.text)}</span></p>
                  <Textarea placeholder="Scene text" value={step.text} onChange={(e) => updateDraftStep(i, { text: e.target.value })} className="border-[#B2DFDB] focus:border-[#0D9488]" />
                  <Input placeholder="Image URL (optional)" value={step.image_url} onChange={(e) => updateDraftStep(i, { image_url: e.target.value })} className="border-[#B2DFDB] focus:border-[#0D9488]" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="border-[#B2DFDB] text-[#134E4A]" disabled={i === 0} onClick={() => setDraftSteps((p) => moveStep(p, i, i - 1))}>↑ Up</Button>
                    <Button size="sm" variant="outline" className="border-[#B2DFDB] text-[#134E4A]" disabled={i === draftSteps.length - 1} onClick={() => setDraftSteps((p) => moveStep(p, i, i + 1))}>↓ Down</Button>
                    <Button size="sm" variant="destructive" disabled={draftSteps.length <= 1} onClick={() => setDraftSteps((p) => p.filter((_, idx) => idx !== i))}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="border-[#B2DFDB] text-[#134E4A]" onClick={() => setDraftSteps((p) => [...p, createEmptyStep()])}><Plus size={14} /> Add scene</Button>
              <Button className="gap-2 bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold" onClick={() => {
                const payload = buildStoryPayload({ title: draftTitle, steps: draftSteps });
                if (!payload.title || payload.steps.length === 0) return;
                onCreateStory(payload);
                setDraftTitle(""); setDraftSteps([createEmptyStep()]);
              }}><Plus size={16} /> Save story</Button>
            </div>
          </div>
        )}

        {/* ── Story list ── */}
        {loading ? (
          <p className="text-sm text-[#5F8A87]">Loading social stories...</p>
        ) : (
          <div className="space-y-4">
            {normalizedStories.length === 0 && <p className="text-sm text-[#5F8A87]">No social stories yet.</p>}
            {normalizedStories.map((story, storyIndex) => {
              const isEditing = editingId === story.id;
              const isBuiltIn = Boolean(story.is_builtin) || String(story.id).startsWith("builtin-");
              return (
                <motion.div
                  key={story.id}
                  layout={!reduced}
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border-2 border-[#B2DFDB] p-4 space-y-3 bg-white"
                >
                  {isEditing ? (
                    <>
                      <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="border-[#B2DFDB] focus:border-[#0D9488]" />
                      <div className="space-y-2">
                        {editingSteps.map((step, i) => (
                          <div key={step.id} className="rounded-xl border border-[#B2DFDB] p-2 space-y-2 bg-[#F0FAF7]">
                            <p className="text-xs text-[#5F8A87]">Scene {i + 1} <span aria-hidden="true">{inferEmojiForText(step.text)}</span></p>
                            <Textarea value={step.text} onChange={(e) => updateEditingStep(i, { text: e.target.value })} className="border-[#B2DFDB] focus:border-[#0D9488]" />
                            <Input placeholder="Image URL (optional)" value={step.image_url} onChange={(e) => updateEditingStep(i, { image_url: e.target.value })} className="border-[#B2DFDB] focus:border-[#0D9488]" />
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" className="border-[#B2DFDB] text-[#134E4A]" disabled={i === 0} onClick={() => setEditingSteps((p) => moveStep(p, i, i - 1))}>↑</Button>
                              <Button size="sm" variant="outline" className="border-[#B2DFDB] text-[#134E4A]" disabled={i === editingSteps.length - 1} onClick={() => setEditingSteps((p) => moveStep(p, i, i + 1))}>↓</Button>
                              <Button size="sm" variant="destructive" disabled={editingSteps.length <= 1} onClick={() => setEditingSteps((p) => p.filter((_, idx) => idx !== i))}>Remove</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="border-[#B2DFDB] text-[#134E4A]" onClick={() => setEditingSteps((p) => [...p, createEmptyStep()])}>Add scene</Button>
                      <div className="flex gap-2">
                        <Button className="bg-[#0D9488] text-white hover:bg-[#0F766E]" onClick={() => {
                          const payload = buildStoryPayload({ title: editingTitle, steps: editingSteps });
                          if (!payload.title || payload.steps.length === 0) return;
                          onUpdateStory(story.id, payload); setEditingId(null);
                        }}>Save</Button>
                        <Button variant="outline" className="border-[#B2DFDB] text-[#134E4A]" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <AsdCharacter size={46} tone={SCENE_TONES[storyIndex % SCENE_TONES.length]} accessory={storyIndex % 2 === 0 ? "leaf" : "star"} ariaHidden />
                          <div>
                            <p className="font-bold text-lg text-[#134E4A]">{story.title}</p>
                            <p className="text-xs text-[#5F8A87]">{story.steps.length} scenes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <AsdChip tone={isBuiltIn ? "teal" : "neutral"}>{isBuiltIn ? "Built-in" : "Custom"}</AsdChip>
                          {!isBuiltIn && canManageStories && (
                            <Button size="sm" variant="outline" className="gap-1 border-[#B2DFDB] text-[#134E4A]" onClick={() => { setEditingId(story.id); setEditingTitle(story.title); setEditingSteps(story.steps.map((s) => ({ ...s }))); }}>
                              <Pencil size={14} /> Edit
                            </Button>
                          )}
                          {!isBuiltIn && canManageStories && (
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => onDeleteStory(story.id)}><Trash2 size={14} /></Button>
                          )}
                          <Button size="sm" className="gap-1 bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold" onClick={() => startStory(story.id)}>
                            <Play size={14} /> Start story
                          </Button>
                        </div>
                      </div>

                      {/* Scene previews */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {story.steps.map((step, i) => (
                          <motion.button
                            key={step.id}
                            whileHover={reduced ? undefined : { scale: 1.03, y: -2 }}
                            whileTap={reduced ? undefined : { scale: 0.97 }}
                            onClick={() => startStory(story.id)}
                            className="rounded-xl overflow-hidden border-2 border-[#B2DFDB] bg-white text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
                          >
                            {step.image_url ? (
                              <img src={step.image_url} alt={`Scene ${i + 1}`} className="w-full h-16 object-cover" />
                            ) : (
                              <div className="w-full h-16 flex items-center justify-center" style={{ background: SCENE_GRADIENTS[i % SCENE_GRADIENTS.length] }}>
                                <span className="text-2xl" aria-hidden="true">{inferEmojiForText(step.text)}</span>
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-xs font-semibold text-[#0D9488]">Scene {i + 1}</p>
                              <p className="text-xs line-clamp-2 mt-0.5 text-[#134E4A]">{step.text}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AsdCard>
  );
}
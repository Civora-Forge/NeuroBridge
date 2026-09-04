import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "@fontsource/opendyslexic";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpenText,
  ChevronLeft,
  Clock3,
  FileScan,
  FileText,
  Focus,
  GalleryVerticalEnd,
  History,
  Home,
  Pause,
  Play,
  Ruler,
  ScanText,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Type,
  Volume2,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Upload,
  ImagePlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useFeatureAdaptation } from "@/hooks/useFeatureAdaptation";
import { useContextStateOptional } from "@/context/ContextProvider";
import {
  uploadAndProcessReadingFile,
  fetchUserReadingHistory,
  getReadingFileById,
  deleteReadingFile,
  updateReadingFileProgress,
} from "@/lib/readingFilesService";
import {
  extractTextFromFile,
  extractTextFromImage,
  extractTextFromImages,
  formatTextToParagraphs,
} from "@/lib/textExtractor";
import {
  loadReadingProfile,
  saveReadingProfile,
  DEFAULT_READING_PREFS,
  logReadingInteraction,
  saveReadingSession,
  deriveRecommendations,
} from "@/lib/readingProfileService";
import {
  analyzeWordDifficulty,
  analyzeSentenceDifficulty,
  simplifyWord,
  simplifyText,
  getAIDifficultyAnalysis,
} from "@/lib/dyslexiaDifficultyService";

/* ─────────────────────────────────────────────────────────────────────────────
   Ephemeral Document Store (In-Memory)
───────────────────────────────────────────────────────────────────────────── */
const EPHEMERAL_DOCS = new Map();



/* ─────────────────────────────────────────────────────────────────────────────
   Constants & Data
───────────────────────────────────────────────────────────────────────────── */
const STORAGE_KEY_RECENTS = "arm-recents-v2";
const STORAGE_KEY_PROGRESS = "arm-progress-v2";
const STORAGE_KEY_PREFS = "arm-prefs-v2";

const FONT_OPTIONS = [
  {
    value: '"OpenDyslexic", "Lexend", "Atkinson Hyperlegible", sans-serif',
    label: "OpenDyslexic",
    tag: "Recommended",
  },
  {
    value: '"Lexend", "Atkinson Hyperlegible", sans-serif',
    label: "Lexend",
  },
  {
    value: '"Atkinson Hyperlegible", sans-serif',
    label: "Atkinson Hyperlegible",
  },
  {
    value: "ui-sans-serif, system-ui, sans-serif",
    label: "System sans-serif",
  },
];

const BG_PRESETS = [
  { label: "Warm Cream", value: "#FAF3A0", text: "#1E2022" },
  { label: "Soft Paper", value: "#FFF8C4", text: "#1E2022" },
  { label: "Warm Ivory", value: "#FFF5D6", text: "#1E2022" },
  { label: "Dusty Blue", value: "#EAF2FF", text: "#1A2540" },
  { label: "Muted Sage", value: "#E9F0D7", text: "#1A2519" },
  { label: "Lavender", value: "#F3EEFF", text: "#2A1A45" },
];

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const READING_LIBRARY = {
  "moonlight-rail": {
    id: "moonlight-rail",
    title: "Moonlight Rail Journal",
    sourceLabel: "From Files",
    thumb: "from-amber-200 via-rose-200 to-sky-200",
    estimatedMinutes: 6,
    paragraphs: [
      "The train left the station just before dusk, and the windows turned gold as the city lights came on one by one. I kept my notebook open beside the seat and wrote down the tiny details that helped me stay present: the rhythm of the tracks, the soft hum of the carriage, and the steady glow of the reading lamp overhead.",
      "When the route passed the river, the reflections on the water looked like a second skyline. I slowed down my reading, let the words rest for a moment, and then returned to the page with a calmer pace. That pause was enough to make the rest of the chapter feel more approachable.",
      "By the time we reached the final stop, the sky had deepened to a dark violet and the stars were just becoming visible through the window. I closed my notebook and thought about how a journey, like a good paragraph, is best understood not at its end, but somewhere in the quiet middle.",
    ],
  },
  "garden-notes": {
    id: "garden-notes",
    title: "Garden Notes for Week 8",
    sourceLabel: "Scan Text",
    thumb: "from-emerald-200 via-teal-200 to-cyan-200",
    estimatedMinutes: 4,
    paragraphs: [
      "The basil leaves are larger than they were last week, and the soil keeps a light scent after watering. I added a small marker beside each seedling so the page would match the garden bed, making it easier to read back later without losing track of what changed.",
      "A clear routine helps more than a perfect plan. I check the light, note the weather, and write down what the plants seem to need next. The words stay simple, and the list stays short, which keeps the process calm and easy to return to.",
    ],
  },
  "city-story": {
    id: "city-story",
    title: "City Storyboard Pages",
    sourceLabel: "Scan Pages",
    thumb: "from-lime-200 via-yellow-200 to-amber-200",
    estimatedMinutes: 8,
    paragraphs: [
      "The first page shows a street corner with wide sidewalks, soft shadows, and a cafe that opens early for commuters. Every frame is labeled in plain language so the reader can move through the scene without having to hold too many details at once.",
      "On the second page, the story shifts to a quiet subway platform where the crowd thins and the announcement board flickers. The panel notes a single observation at a time, which makes the whole sequence feel organized and less overwhelming.",
      "The final page brings the story back to street level with a slow walk home and a clean closing sentence. There is no rush to finish; the layout gives the eye space to rest before the next line begins.",
    ],
  },
  "photo-caption": {
    id: "photo-caption",
    title: "Photo Caption Practice",
    sourceLabel: "From Gallery",
    thumb: "from-slate-200 via-indigo-100 to-violet-200",
    estimatedMinutes: 3,
    paragraphs: [
      "A photograph of a window seat becomes easier to understand when the caption starts with the main object, then adds the feeling, then ends with the detail that matters most. That structure keeps the message readable and avoids clutter.",
      "The caption can stay short and still be complete. If the image shows a notebook, a cup, and a bright lamp, the most helpful version begins with the notebook and leaves the rest as supporting details rather than competing ideas.",
    ],
  },
};

const FALLBACK_RECENTS = [
  {
    id: "moonlight-rail",
    title: "Moonlight Rail Journal",
    timestamp: "5 min ago",
    progress: 74,
    tag: "Last read",
    source: "Files",
    thumb: "from-amber-200 via-rose-200 to-sky-200",
  },
  {
    id: "garden-notes",
    title: "Garden Notes for Week 8",
    timestamp: "Yesterday",
    progress: 41,
    tag: "Draft",
    source: "Scan Text",
    thumb: "from-emerald-200 via-teal-200 to-cyan-200",
  },
  {
    id: "city-story",
    title: "City Storyboard Pages",
    timestamp: "2 days ago",
    progress: 89,
    tag: "Almost done",
    source: "Scan Pages",
    thumb: "from-lime-200 via-yellow-200 to-amber-200",
  },
  {
    id: "photo-caption",
    title: "Photo Caption Practice",
    timestamp: "Last week",
    progress: 57,
    tag: "Gallery",
    source: "From Gallery",
    thumb: "from-slate-200 via-indigo-100 to-violet-200",
  },
];

const QUICK_START = [
  {
    id: "files",
    title: "From Files",
    description: "Open PDFs, docs, or saved reading packs.",
    icon: FileText,
    docId: "moonlight-rail",
    accent: "from-amber-50 to-amber-100 border-amber-200",
    iconBg: "bg-amber-500",
  },
  {
    id: "scan-text",
    title: "Scan Text",
    description: "Capture a page and turn it into readable text via OCR.",
    icon: ScanText,
    docId: "garden-notes",
    accent: "from-emerald-50 to-teal-100 border-emerald-200",
    iconBg: "bg-emerald-500",
  },
  {
    id: "scan-pages",
    title: "Scan Pages",
    description: "Multi-page OCR for textbooks and handouts.",
    icon: FileScan,
    docId: "city-story",
    accent: "from-sky-50 to-cyan-100 border-sky-200",
    iconBg: "bg-sky-500",
  },
  {
    id: "gallery",
    title: "From Gallery",
    description: "Pick a saved image or screenshot from your device.",
    icon: GalleryVerticalEnd,
    docId: "photo-caption",
    accent: "from-violet-50 to-fuchsia-100 border-violet-200",
    iconBg: "bg-violet-500",
  },
];

const DEFAULT_PREFS = {
  fontFamily: FONT_OPTIONS[0].value,
  fontSize: 24,
  lineHeight: 1.85,
  letterSpacing: 0.02,
  wordSpacing: 0.1,
  backgroundColor: "#FAF3A0",
  textColor: "#1E2022",
  darkMode: false,
  highContrast: false,
  readingRuler: true,
  focusMode: true,
};

/* ─────────────────────────────────────────────────────────────────────────────
   Utilities
───────────────────────────────────────────────────────────────────────────── */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function lsGet(key, fallback) {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function generateSummary(paragraphs) {
  const text = paragraphs.join(" ");
  const sentences = (text.match(/[^.!?]+[.!?]?/g) || [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return text;
  return [
    sentences[0],
    sentences[Math.floor(sentences.length / 2)],
    sentences[sentences.length - 1],
  ]
    .filter(Boolean)
    .join(" ");
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────────────── */
function ProgressRing({ progress, size = 40 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      className="shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#15803d"
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress / 100)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}

function LabeledSlider({ id, label, helper, value, min, max, step, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <label htmlFor={id} className="font-medium text-slate-700">
          {label}
        </label>
        <span className="font-mono text-xs tabular-nums text-slate-500">
          {helper}
        </span>
      </div>
      <Slider
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
    </div>
  );
}

function ToggleRow({ label, description, checked, onCheckedChange, ariaLabel }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50">
      <span>
        <span className="block text-sm font-medium text-slate-800">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500">
            {description}
          </span>
        )}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel || label}
      />
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Accessibility Panel
───────────────────────────────────────────────────────────────────────────── */
function AccessibilityPanel({ prefs, setPrefs }) {
  const set = (key) => (val) => setPrefs((p) => ({ ...p, [key]: val }));

  return (
    <div className="space-y-5 pb-4">
      {/* Font family */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Font Family
        </label>
        <Select value={prefs.fontFamily} onValueChange={set("fontFamily")}>
          <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
            <SelectValue placeholder="Choose font" />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((o) => (
              <SelectItem key={o.label} value={o.value}>
                <span style={{ fontFamily: o.value }}>{o.label}</span>
                {o.tag && (
                  <Badge className="ml-2 bg-amber-100 text-[10px] text-amber-800 hover:bg-amber-100">
                    {o.tag}
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <LabeledSlider
        id="aa-font-size"
        label="Font Size"
        helper={`${prefs.fontSize}px`}
        value={prefs.fontSize}
        min={16}
        max={36}
        step={1}
        onChange={set("fontSize")}
      />
      <LabeledSlider
        id="aa-line-height"
        label="Line Spacing"
        helper={prefs.lineHeight.toFixed(2)}
        value={prefs.lineHeight}
        min={1.4}
        max={2.2}
        step={0.05}
        onChange={set("lineHeight")}
      />
      <LabeledSlider
        id="aa-letter-spacing"
        label="Letter Spacing"
        helper={`${prefs.letterSpacing.toFixed(2)}em`}
        value={prefs.letterSpacing}
        min={0}
        max={0.2}
        step={0.01}
        onChange={set("letterSpacing")}
      />
      <LabeledSlider
        id="aa-word-spacing"
        label="Word Spacing"
        helper={`${prefs.wordSpacing.toFixed(2)}em`}
        value={prefs.wordSpacing}
        min={0}
        max={0.3}
        step={0.01}
        onChange={set("wordSpacing")}
      />

      <Separator />

      {/* Background presets */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Background Colour
        </label>
        <div className="grid grid-cols-3 gap-2">
          {BG_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-label={`Set background to ${p.label}`}
              aria-pressed={prefs.backgroundColor === p.value}
              onClick={() =>
                setPrefs((prev) => ({
                  ...prev,
                  backgroundColor: p.value,
                  textColor: p.text,
                }))
              }
              style={{ backgroundColor: p.value }}
              className={cn(
                "h-10 rounded-xl border-2 text-xs font-medium transition-all",
                prefs.backgroundColor === p.value
                  ? "scale-105 border-slate-900 shadow-md"
                  : "border-transparent hover:border-slate-400",
              )}
            >
              <span style={{ color: p.text }}>{p.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-1">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-500">Custom BG</label>
            <Input
              type="color"
              value={prefs.backgroundColor}
              onChange={(e) => set("backgroundColor")(e.target.value)}
              className="h-10 rounded-xl border-slate-200 p-1"
              aria-label="Custom background colour"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-500">Text Colour</label>
            <Input
              type="color"
              value={prefs.textColor}
              onChange={(e) => set("textColor")(e.target.value)}
              className="h-10 rounded-xl border-slate-200 p-1"
              aria-label="Text colour"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Toggles */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Dark Mode"
          description="Reduce glare for low-light reading"
          checked={prefs.darkMode}
          onCheckedChange={set("darkMode")}
        />
        <ToggleRow
          label="High Contrast"
          description="Maximum foreground/background contrast"
          checked={prefs.highContrast}
          onCheckedChange={set("highContrast")}
        />
        <ToggleRow
          label="Reading Ruler"
          description="Amber guide band follows your cursor"
          checked={prefs.readingRuler}
          onCheckedChange={set("readingRuler")}
        />
        <ToggleRow
          label="Focus Mode"
          description="Dim inactive paragraphs while reading"
          checked={prefs.focusMode}
          onCheckedChange={set("focusMode")}
        />
      </div>

      <button
        type="button"
        onClick={() => setPrefs(DEFAULT_PREFS)}
        className="w-full rounded-2xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-700"
      >
        Reset to defaults
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TTS Player
───────────────────────────────────────────────────────────────────────────── */
function TTSPlayer({
  words,
  currentWordIndex,
  setCurrentWordIndex,
  isPlaying,
  setIsPlaying,
  prefs,
  defaultPlaybackRate,
}) {
  const [playbackRate, setPlaybackRate] = useState(defaultPlaybackRate ?? 1);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [voices, setVoices] = useState([]);
  const utteranceRef = useRef(null);
  const totalWords = words.length;

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const sync = () => {
      const avail = window.speechSynthesis.getVoices();
      setVoices(avail);
      if (!selectedVoiceURI && avail.length > 0) {
        const pref =
          avail.find((v) => /en/i.test(v.lang)) || avail[0];
        if (pref) setSelectedVoiceURI(pref.voiceURI);
      }
    };
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", sync);
  }, [selectedVoiceURI]);

  /* Apply an adaptive default rate while idle so slow-paced decisions carry
     into playback without overriding an explicit mid-session speed choice. */
  useEffect(() => {
    if (defaultPlaybackRate != null && !isPlaying) {
      setPlaybackRate(defaultPlaybackRate);
    }
  }, [defaultPlaybackRate, isPlaying]);

  const speak = useCallback(
    (fromIndex) => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const chunk = words.slice(fromIndex).join(" ");
      if (!chunk) return;
      const utt = new SpeechSynthesisUtterance(chunk);
      utt.rate = playbackRate;
      const voice = voices.find((v) => v.voiceURI === selectedVoiceURI);
      if (voice) utt.voice = voice;
      let wIdx = fromIndex;
      utt.onboundary = (ev) => {
        if (ev.name === "word") {
          const spokenCount = chunk
            .slice(0, ev.charIndex)
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;
          wIdx = clamp(fromIndex + spokenCount, 0, totalWords - 1);
          setCurrentWordIndex(wIdx);
        }
      };
      utt.onend = () => {
        setIsPlaying(false);
        setCurrentWordIndex(totalWords - 1);
      };
      utt.onerror = () => setIsPlaying(false);
      utteranceRef.current = utt;
      window.speechSynthesis.speak(utt);
    },
    [words, playbackRate, selectedVoiceURI, voices, totalWords, setCurrentWordIndex, setIsPlaying],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isPlaying) speak(currentWordIndex);
    else window.speechSynthesis?.cancel();
  }, [isPlaying]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isPlaying) {
      window.speechSynthesis?.cancel();
      speak(currentWordIndex);
    }
  }, [playbackRate, selectedVoiceURI]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const toggle = () => setIsPlaying((p) => !p);
  const skip = (dir) => {
    const next = clamp(currentWordIndex + dir * 10, 0, totalWords - 1);
    setCurrentWordIndex(next);
    if (isPlaying) {
      window.speechSynthesis?.cancel();
      speak(next);
    }
  };
  const progress =
    totalWords > 1 ? (currentWordIndex / (totalWords - 1)) * 100 : 0;

  const isDark = prefs.darkMode || prefs.highContrast;
  const panelClass = isDark
    ? "bg-slate-900/95 border-white/10 backdrop-blur"
    : "bg-white/95 border-black/8 backdrop-blur";
  const textClass = isDark ? "text-slate-100" : "text-slate-900";
  const subClass = isDark ? "text-slate-400" : "text-slate-500";
  const controlClass = isDark
    ? "border-white/20 bg-white/10 text-white"
    : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div
      role="region"
      aria-label="Text-to-Speech player"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t shadow-[0_-8px_32px_rgba(0,0,0,0.12)]",
        panelClass,
      )}
    >
      {/* Progress bar */}
      <div className="h-1 w-full bg-black/8">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-300"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Current word display */}
        <div className={cn("hidden min-w-[120px] shrink-0 sm:block", subClass)}>
          <span className="block font-mono text-xs">
            Word {currentWordIndex + 1} / {totalWords}
          </span>
          <span
            className={cn("block truncate text-sm font-semibold", textClass)}
            aria-live="polite"
            aria-atomic="true"
          >
            {words[currentWordIndex] || "—"}
          </span>
        </div>

        {/* Playback controls */}
        <div className="flex flex-1 items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => skip(-1)}
            aria-label="Skip back 10 words"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-110",
              subClass,
              "hover:text-slate-900",
            )}
          >
            <SkipBack className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play text-to-speech"}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition hover:scale-105 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 translate-x-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => skip(1)}
            aria-label="Skip forward 10 words"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-110",
              subClass,
              "hover:text-slate-900",
            )}
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Speed + Voice */}
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={String(playbackRate)}
            onValueChange={(v) => setPlaybackRate(Number(v))}
            aria-label="Playback speed"
          >
            <SelectTrigger
              className={cn(
                "h-9 w-[74px] rounded-full border text-xs font-semibold",
                controlClass,
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEED_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {voices.length > 0 && (
            <Select
              value={selectedVoiceURI}
              onValueChange={setSelectedVoiceURI}
              aria-label="TTS voice"
            >
              <SelectTrigger
                className={cn(
                  "h-9 w-[130px] rounded-full border text-xs",
                  controlClass,
                )}
              >
                <Volume2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                <SelectValue placeholder="Voice" />
              </SelectTrigger>
              <SelectContent className="max-h-52">
                {voices.map((v) => (
                  <SelectItem key={v.voiceURI} value={v.voiceURI}>
                    {v.name.slice(0, 28)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Processing & Scan Modals
───────────────────────────────────────────────────────────────────────────── */
function ProcessingOverlay({ processingState, error, onRetry, onClose }) {
  if (!processingState && !error) return null;

  return (
    <Dialog open={true} onOpenChange={() => (error ? onClose() : null)}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 text-center">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {error ? "Extraction Error" : "Processing Document"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            {error
              ? "We couldn't read text from the provided file or image."
              : processingState?.message || "Extracting readable text..."}
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 flex flex-col items-center justify-center gap-3">
          {error ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertCircle className="h-8 w-8" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          <p className="text-sm font-medium text-slate-700">
            {error || processingState?.message}
          </p>
          {processingState?.page && processingState?.total && (
            <p className="text-xs text-slate-500">
              Page {processingState.page} of {processingState.total}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          {error ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="rounded-xl">
                Close
              </Button>
              {onRetry && (
                <Button onClick={onRetry} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                  Try Again
                </Button>
              )}
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScanPagesModal({ open, onOpenChange, onStartScan, isProcessing }) {
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleScan = () => {
    if (files.length > 0) {
      onStartScan(files);
      setFiles([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Scan Pages (Multi-Page OCR)
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Select or capture multiple pages. We will extract text page-by-page using Gemini OCR and combine them.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="my-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              Captured Pages ({files.length})
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="rounded-xl border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Pages
            </Button>
          </div>

          {files.length === 0 ? (
            <div
              onClick={() => inputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center transition hover:border-slate-400 hover:bg-slate-50"
            >
              <ImagePlus className="mb-2 h-10 w-10 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">
                No pages added yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Click here to choose multiple photos or page scans
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Page ${idx + 1}`}
                    className="h-20 w-full object-cover rounded-lg"
                  />
                  <span className="mt-1 text-[11px] font-medium text-slate-600 truncate w-full text-center">
                    Page {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-600"
                    aria-label="Remove page"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            disabled={files.length === 0 || isProcessing}
            onClick={handleScan}
            className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...
              </>
            ) : (
              `Start Scanning (${files.length} ${files.length === 1 ? "Page" : "Pages"})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Home Screen
───────────────────────────────────────────────────────────────────────────── */
function HomeScreen({ onOpenDoc }) {
  const { user } = useAuth();
  const [historyItems, setHistoryItems] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activeNav, setActiveNav] = useState("home");

  /* Processing & Modal state */
  const [processingState, setProcessingState] = useState(null);
  const [processingError, setProcessingError] = useState(null);
  const [scanPagesOpen, setScanPagesOpen] = useState(false);
  const [lastFileAction, setLastFileAction] = useState(null);

  /* Hidden file input references */
  const filesInputRef = useRef(null);
  const scanTextInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const items = await fetchUserReadingHistory(user);
      setHistoryItems(items);
    } catch (err) {
      console.warn("Failed to fetch reading history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const openReadingRecord = (record) => {
    if (record.ocr_text) {
      const paragraphs = formatTextToParagraphs(record.ocr_text);
      const totalWords = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
      const estimatedMinutes = Math.max(1, Math.ceil(totalWords / 150));

      EPHEMERAL_DOCS.set(record.id, {
        id: record.id,
        title: record.file_name,
        sourceLabel: record.source,
        thumb: record.preview_url || "from-amber-200 via-rose-200 to-sky-200",
        preview_url: record.preview_url,
        estimatedMinutes,
        paragraphs,
        record,
      });
    }
    onOpenDoc(record.id);
  };

  const handleProcessAndStore = async (fileOrFiles, source) => {
    setProcessingError(null);
    setProcessingState({ stage: "uploading", message: "Saving document to Supabase..." });
    const isArray = Array.isArray(fileOrFiles);

    try {
      const record = await uploadAndProcessReadingFile({
        user,
        file: isArray ? null : fileOrFiles,
        files: isArray ? fileOrFiles : [],
        source,
        onProgress: (st) => setProcessingState(st),
      });

      setProcessingState(null);
      await loadHistory();
      openReadingRecord(record);
    } catch (err) {
      setProcessingState(null);
      setProcessingError(err.message || "Failed to process and store document.");
    }
  };

  const handleFromFiles = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastFileAction(() => () => handleFromFiles({ target: { files: [file] } }));
    await handleProcessAndStore(file, "files");
    e.target.value = "";
  };

  const handleScanText = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastFileAction(() => () => handleScanText({ target: { files: [file] } }));
    await handleProcessAndStore(file, "scan-text");
    e.target.value = "";
  };

  const handleFromGallery = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastFileAction(() => () => handleFromGallery({ target: { files: [file] } }));
    await handleProcessAndStore(file, "gallery");
    e.target.value = "";
  };

  const handleScanPages = async (files) => {
    setScanPagesOpen(false);
    setLastFileAction(() => () => handleScanPages(files));
    await handleProcessAndStore(files, "scan-pages");
  };

  const handleDeleteItem = async (e, docId, storagePath) => {
    e.stopPropagation();
    try {
      setHistoryItems((prev) => prev.filter((item) => item.id !== docId));
      await deleteReadingFile(docId, storagePath, user);
    } catch (err) {
      console.warn("Delete error:", err);
      loadHistory();
    }
  };

  const handleCardClick = (id) => {
    if (processingState) return;
    if (id === "files") filesInputRef.current?.click();
    else if (id === "scan-text") scanTextInputRef.current?.click();
    else if (id === "scan-pages") setScanPagesOpen(true);
    else if (id === "gallery") galleryInputRef.current?.click();
  };

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      action: () => {
        setActiveNav("home");
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    },
    {
      id: "history",
      label: "History",
      icon: History,
      action: () => {
        setActiveNav("history");
        document
          .getElementById("arm-history")
          ?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      id: "tutor",
      label: "Tutor",
      icon: BookOpenText,
      action: () => onOpenDoc("moonlight-rail"),
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings2,
      action: () => {
        setActiveNav("settings");
        document
          .getElementById("arm-settings")
          ?.scrollIntoView({ behavior: "smooth" });
      },
    },
  ];

  const recentsList = historyItems.length > 0 ? historyItems : FALLBACK_RECENTS;

  return (
    <div
      className="min-h-screen pb-28 pt-6 sm:pt-10"
      style={{
        background:
          "radial-gradient(circle at top, rgba(254,249,195,0.95), rgba(250,243,160,0.5) 40%, rgba(248,250,252,1) 78%)",
      }}
    >
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 sm:px-6">
        {/* ── Hero ── */}
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden rounded-[2rem] border border-black/5 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <Badge className="w-fit bg-amber-100 text-amber-900 hover:bg-amber-100">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Adaptive Reading Module
              </Badge>
              <h1
                className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl"
                style={{
                  fontFamily:
                    '"OpenDyslexic", "Lexend", "Atkinson Hyperlegible", sans-serif',
                }}
              >
                Calm reading, built for every mind.
              </h1>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:w-56 lg:flex-col">
              <Button
                onClick={() => onOpenDoc("moonlight-rail")}
                className="h-12 flex-1 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                aria-label="Open reader with sample document"
              >
                Start reading <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.header>

        {/* ── Continue Reading (History) ── */}
        <section id="arm-history" className="scroll-mt-24 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Continue Reading
              </h2>
              <p className="text-sm text-slate-600">
                Pick up where you left off. Every scanned and uploaded document is stored persistently.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full px-3 text-slate-700"
            >
              {historyItems.length > 0 ? `${historyItems.length} stored` : `${recentsList.length} items`}
            </Badge>
          </div>

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12 bg-white/60 rounded-3xl border border-black/5">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600 mr-2" />
              <span className="text-sm font-medium text-slate-600">Loading reading history...</span>
            </div>
          ) : recentsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 bg-white/80 rounded-3xl border border-dashed border-slate-300 text-center">
              <History className="h-10 w-10 text-slate-400 mb-2" />
              <h3 className="text-base font-bold text-slate-800">No reading history yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Upload a document or scan a page above to automatically save your files here.
              </p>
            </div>
          ) : (
            <Carousel className="w-full">
              <CarouselContent>
                {recentsList.map((doc, i) => {
                  const docTitle = doc.file_name || doc.title || "Untitled Document";
                  const docProgress = doc.metadata?.progress ?? doc.progress ?? 0;
                  const docSource = doc.source || doc.sourceLabel || "Files";
                  const docStatus = doc.ocr_status || "completed";
                  const isImagePreview = doc.preview_url;

                  return (
                    <CarouselItem
                      key={doc.id || i}
                      className="basis-[86%] md:basis-1/2 xl:basis-1/3"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: i * 0.04 }}
                        className="h-full"
                      >
                        <div
                          onClick={() => {
                            if (doc.ocr_text || doc.paragraphs) {
                              openReadingRecord(doc);
                            } else {
                              onOpenDoc(doc.id);
                            }
                          }}
                          className="group relative block h-full w-full text-left cursor-pointer"
                        >
                          <Card className="h-full overflow-hidden border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_24px_50px_rgba(15,23,42,0.10)]">
                            <div className="relative h-36 bg-gradient-to-br from-amber-100 via-yellow-100 to-sky-100 overflow-hidden">
                              {isImagePreview ? (
                                <img
                                  src={doc.preview_url}
                                  alt={docTitle}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className={cn("h-full w-full bg-gradient-to-br", doc.thumb || "from-amber-200 via-rose-200 to-sky-200")} />
                              )}
                              <div className="absolute right-3 top-3 flex items-center gap-2">
                                <ProgressRing progress={docProgress} />
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteItem(e, doc.id, doc.storage_path)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur transition hover:bg-rose-600"
                                  title="Delete from History"
                                  aria-label={`Delete ${docTitle}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <CardHeader className="space-y-2 pb-2">
                              <div className="flex items-start justify-between gap-3">
                                <CardTitle className="text-base leading-snug text-slate-900 truncate">
                                  {docTitle}
                                </CardTitle>
                                <Badge className="shrink-0 rounded-full bg-white text-xs text-slate-700 hover:bg-white">
                                  {doc.page_count ? `${doc.page_count} pg` : doc.tag || "Saved"}
                                </Badge>
                              </div>
                              <CardDescription className="flex items-center gap-1 text-xs">
                                <Clock3 className="h-3 w-3" />{" "}
                                {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : doc.timestamp || "Recent"} ·{" "}
                                <span className="capitalize">{docSource}</span>
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-0">
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Status</span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] uppercase font-bold",
                                    docStatus === "completed" && "border-emerald-300 bg-emerald-50 text-emerald-800",
                                    docStatus === "processing" && "border-amber-300 bg-amber-50 text-amber-800",
                                    docStatus === "failed" && "border-rose-300 bg-rose-50 text-rose-800",
                                  )}
                                >
                                  {docStatus}
                                </Badge>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-black/5">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
                                  style={{
                                    width: `${docProgress}%`,
                                    transition: "width 0.4s ease",
                                  }}
                                />
                              </div>
                            </CardContent>
                            <CardFooter className="justify-between pt-0 text-xs font-medium text-slate-700">
                              <span>Open in reader</span>
                              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </CardFooter>
                          </Card>
                        </div>
                      </motion.div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          )}
        </section>

        {/* ── Start Reading ── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Start Reading
            </h2>
            <p className="text-sm text-slate-600">
              Choose a capture method to open the adaptive reader.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_START.map((opt, i) => {
              const Icon = opt.icon;
              return (
                <motion.div
                  key={opt.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.06 * i }}
                  className="h-full"
                >
                  <button
                    type="button"
                    disabled={processingState !== null}
                    onClick={() => handleCardClick(opt.id)}
                    className="group h-full w-full text-left focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:outline-none disabled:opacity-60"
                    aria-label={`Open reader from: ${opt.title}`}
                  >
                    <Card
                      className={cn(
                        "h-full rounded-[1.75rem] border bg-gradient-to-br shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_24px_50px_rgba(15,23,42,0.10)]",
                        opt.accent,
                      )}
                    >
                      <CardHeader className="space-y-4 p-6">
                        <div
                          className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm",
                            opt.iconBg,
                          )}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="space-y-1.5">
                          <CardTitle className="text-xl text-slate-900">
                            {opt.title}
                          </CardTitle>
                          <CardDescription className="text-sm leading-6 text-slate-600">
                            {opt.description}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardFooter className="px-6 pb-6 pt-0">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                          Open reader{" "}
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </CardFooter>
                    </Card>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── Settings Preview ── */}
        <section id="arm-settings" className="scroll-mt-24">
          <Card className="overflow-hidden rounded-[1.75rem] border border-black/5 bg-slate-950 text-white">
            <CardHeader>
              <CardTitle className="text-2xl">
                Accessibility Controls
              </CardTitle>
              <CardDescription className="text-slate-300">
                Full customisation panel opens inside the reader — font,
                spacing, colour, ruler, dark mode, high contrast, and focus
                mode.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {[
                [
                  "Typography",
                  "OpenDyslexic · Lexend · Atkinson Hyperlegible · System",
                ],
                [
                  "Spacing",
                  "Font size · Line height · Letter spacing · Word spacing",
                ],
                [
                  "Reading Aids",
                  "Focus mode · Reading ruler · TTS word highlight",
                ],
              ].map(([t, d]) => (
                <div key={t} className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400">
                    {t}
                  </div>
                  <p className="mt-2 text-sm text-slate-200">{d}</p>
                </div>
              ))}
            </CardContent>
            <CardFooter className="justify-between border-t border-white/10 px-6 py-4 text-sm text-slate-300">
              <span>WCAG 2.2 · Keyboard navigable · Screen-reader ready</span>
              <Button
                onClick={() => onOpenDoc("moonlight-rail")}
                variant="secondary"
                className="rounded-full bg-white text-slate-900 hover:bg-slate-100"
              >
                Open reader
              </Button>
            </CardFooter>
          </Card>
        </section>
      </main>

      {/* ── Bottom Nav ── */}
      <nav
        aria-label="Adaptive Reading Module navigation"
        className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center justify-between gap-1 rounded-full border border-white/70 bg-white/90 px-2 py-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-medium transition-all duration-150",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Hidden File Inputs for Start Reading Cards */}
      <input
        ref={filesInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFromFiles}
      />
      <input
        ref={scanTextInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleScanText}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFromGallery}
      />

      {/* Multi-Page Scan Modal */}
      <ScanPagesModal
        open={scanPagesOpen}
        onOpenChange={setScanPagesOpen}
        onStartScan={handleScanPages}
        isProcessing={processingState !== null}
      />

      {/* Processing Overlay Dialog */}
      <ProcessingOverlay
        processingState={processingState}
        error={processingError}
        onRetry={lastFileAction}
        onClose={() => {
          setProcessingError(null);
          setProcessingState(null);
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Reader Screen
───────────────────────────────────────────────────────────────────────────── */
function ReaderScreen({ docId, onBack }) {
  const { user } = useAuth();
  const context = useContextStateOptional()?.context ?? null;
  const adaptation = useFeatureAdaptation("dyslexia.adaptive-reading", {
    getAppSnapshot: () => context,
    userId: user?.id ?? null,
  });
  const adaptiveConfig = adaptation.configuration;
  const [docState, setDocState] = useState(() => {
    return (
      EPHEMERAL_DOCS.get(docId) ||
      READING_LIBRARY[docId] ||
      READING_LIBRARY["moonlight-rail"]
    );
  });

  useEffect(() => {
    if (!docId) return;
    if (EPHEMERAL_DOCS.has(docId)) {
      setDocState(EPHEMERAL_DOCS.get(docId));
      return;
    }
    if (READING_LIBRARY[docId]) {
      setDocState(READING_LIBRARY[docId]);
      return;
    }
    // Fetch persistent document record from Supabase / service by ID
    getReadingFileById(docId, user).then((rec) => {
      if (rec && rec.ocr_text) {
        const paragraphs = formatTextToParagraphs(rec.ocr_text);
        const totalWords = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
        const loaded = {
          id: rec.id,
          title: rec.file_name,
          sourceLabel: rec.source,
          thumb: rec.preview_url || "from-amber-200 via-rose-200 to-sky-200",
          preview_url: rec.preview_url,
          estimatedMinutes: Math.max(1, Math.ceil(totalWords / 150)),
          paragraphs,
          record: rec,
        };
        EPHEMERAL_DOCS.set(rec.id, loaded);
        setDocState(loaded);
      }
    });
  }, [docId, user]);

  const doc = docState;

  /* Prefs — persisted to Supabase & localStorage */
  const [prefs, setPrefsState] = useState(DEFAULT_READING_PREFS);
  const [sessionData, setSessionData] = useState({
    startTime: Date.now(),
    ttsUsed: false,
    simplificationUsed: false,
    difficultyInteractions: 0
  });

  const mainRef = useRef(null);
  const [rulerStyle, setRulerStyle] = useState({});

  useEffect(() => {
    let mounted = true;
    loadReadingProfile(user).then((p) => {
      if (mounted) setPrefsState(p);
    });
    return () => { mounted = false; };
  }, [user]);

  const setPrefs = useCallback((updater) => {
    setPrefsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveReadingProfile(user, next);
      return next;
    });
  }, [user]);

  /* Adaptive overrides sit on top of the user's saved prefs only while the
     engine decision is active; the user's own toggles in the panel always
     remain visible (they edit `prefs` below). */
  const effectivePrefs = useMemo(() => {
    if (!adaptiveConfig?.active) return prefs;
    return {
      ...prefs,
      focusMode:
        adaptiveConfig.enableFocusMode === true ? true : prefs.focusMode,
      readingRuler:
        adaptiveConfig.enableReadingRuler === true ? true : prefs.readingRuler,
    };
  }, [prefs, adaptiveConfig]);

  /* Build structured paragraphs with global word indices */
  const structuredParagraphs = useMemo(() => {
    let idx = 0;
    return (doc?.paragraphs || []).map((para) => {
      const words = para.match(/\S+/g) || [];
      const start = idx;
      idx += words.length;
      return { para, words, startIdx: start, endIdx: idx - 1 };
    });
  }, [doc]);

  const allWords = useMemo(
    () => structuredParagraphs.flatMap((p) => p.words),
    [structuredParagraphs],
  );
  const totalWords = allWords.length;

  /* Reading position — restored from localStorage / document metadata */
  const [currentWordIndex, setCurrentWordIndex] = useState(() => {
    const saved = lsGet(`${STORAGE_KEY_PROGRESS}:${docId}`, null);
    if (saved?.wordIndex != null)
      return clamp(saved.wordIndex, 0, Math.max(totalWords - 1, 0));
    if (doc?.record?.metadata?.currentWordIndex != null)
      return clamp(doc.record.metadata.currentWordIndex, 0, Math.max(totalWords - 1, 0));
    return 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [summary, setSummary] = useState("");
  const [rulerY, setRulerY] = useState(200);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activePara, setActivePara] = useState(0);

  // New features state
  const [wordDifficultyScores, setWordDifficultyScores] = useState([]);
  const [sentenceComplexity, setSentenceComplexity] = useState([]);
  const [simplificationModal, setSimplificationModal] = useState({ open: false, text: "", simplified: "", explanation: "", loading: false, targetIdx: null });
  const [recommendations, setRecommendations] = useState([]);

  // Calculate heuristic difficulty
  useEffect(() => {
    if (!doc?.paragraphs) return;
    const sentenceScores = doc.paragraphs.map(p => analyzeSentenceDifficulty(p));
    setSentenceComplexity(sentenceScores);
    setWordDifficultyScores(analyzeWordDifficulty(allWords));
  }, [doc, allWords]);

  // Load recommendations
  useEffect(() => {
    if (!user) return;
    deriveRecommendations(user).then(recs => {
      // Filter out dismissed
      const dismissed = lsGet("neurobridge-dismissed-recs", []);
      setRecommendations(recs.filter(r => !dismissed.includes(r.id)));
    });
  }, [user]);

  const handleApplyRecommendation = (rec) => {
    if (rec.type === "settings" && rec.settingKey) {
      setPrefs(p => ({ ...p, [rec.settingKey]: rec.settingValue }));
    }
    handleDismissRecommendation(rec.id);
  };

  const handleDismissRecommendation = (id) => {
    setRecommendations(prev => prev.filter(r => r.id !== id));
    const dismissed = lsGet("neurobridge-dismissed-recs", []);
    lsSet("neurobridge-dismissed-recs", [...dismissed, id]);
  };

  const handleWordClick = async (word, globalIdx) => {
    setSessionData(s => ({ ...s, difficultyInteractions: s.difficultyInteractions + 1 }));
    setSimplificationModal({ open: true, text: word, simplified: "", explanation: "", loading: true, targetIdx: globalIdx });
    const res = await simplifyWord(word);
    setSimplificationModal(prev => ({
      ...prev,
      loading: false,
      simplified: res?.simplified || "Could not simplify.",
      explanation: res?.explanation || "Please try another word."
    }));
  };

  const handleSentenceSimplify = async (paraText, paraIndex) => {
    setSessionData(s => ({ ...s, simplificationUsed: true }));
    setSimplificationModal({ open: true, text: paraText, simplified: "", explanation: "", loading: true, targetIdx: `para-${paraIndex}` });
    const res = await simplifyText(paraText);
    setSimplificationModal(prev => ({
      ...prev,
      loading: false,
      simplified: res || "Could not simplify paragraph.",
      explanation: "Simplified version of the selected text."
    }));
  };

  /* Save progress on unmount and position change */
  useEffect(() => {
    const progress = totalWords > 1 ? Math.round((currentWordIndex / (totalWords - 1)) * 100) : 0;
    lsSet(`${STORAGE_KEY_PROGRESS}:${docId}`, {
      wordIndex: currentWordIndex,
    });
    if (docId) {
      updateReadingFileProgress(docId, progress, currentWordIndex, user);
    }
  }, [docId, currentWordIndex, totalWords, user]);

  /* Track Session End */
  useEffect(() => {
    return () => {
      // Unmount -> end session
      const durationSeconds = Math.round((Date.now() - sessionData.startTime) / 1000);
      if (durationSeconds > 10) {
        saveReadingSession(user, {
          fileId: docId?.startsWith("moonlight") ? null : docId,
          originalText: doc?.paragraphs?.[0]?.substring(0, 500) || "",
          wpm: totalWords > 0 ? Math.round((currentWordIndex / durationSeconds) * 60) : 0,
          comfortScore: 80, // Derived
          durationSeconds,
          ttsUsed: sessionData.ttsUsed,
          simplificationUsed: sessionData.simplificationUsed,
          difficultyInteractions: sessionData.difficultyInteractions,
          wordCount: currentWordIndex,
          startPosition: 0,
          endPosition: currentWordIndex
        });
      }
    };
  }, [user, sessionData, docId, doc, totalWords, currentWordIndex]);


  /* Sync active paragraph to TTS cursor */
  useEffect(() => {
    const idx = structuredParagraphs.findIndex(
      (p) =>
        currentWordIndex >= p.startIdx && currentWordIndex <= p.endIdx,
    );
    if (idx >= 0) setActivePara(idx);
  }, [currentWordIndex, structuredParagraphs]);

  /* Reading ruler — follows mouse/touch and stays inside container bounds */
  useEffect(() => {
    if (!effectivePrefs.readingRuler) return;
    
    const updateRulerBounds = () => {
      if (mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect();
        setRulerStyle({
          left: `${rect.left}px`,
          width: `${rect.width}px`
        });
      }
    };

    updateRulerBounds();

    const onMove = (e) => {
      const y = e.touches?.[0]?.clientY ?? e.clientY;
      setRulerY(y - 24);
      // Periodically update bounds in case container shifts
      updateRulerBounds();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("resize", updateRulerBounds, { passive: true });
    window.addEventListener("scroll", updateRulerBounds, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("resize", updateRulerBounds);
      window.removeEventListener("scroll", updateRulerBounds);
    };
  }, [effectivePrefs.readingRuler]);

  const theme = useMemo(() => {
    if (effectivePrefs.highContrast)
      return { backgroundColor: "#000000", color: "#FFF8C4" };
    if (effectivePrefs.darkMode)
      return { backgroundColor: "#0F172A", color: "#F8FAFC" };
    return { backgroundColor: effectivePrefs.backgroundColor, color: effectivePrefs.textColor };
  }, [effectivePrefs]);

  const readingStyle = useMemo(
    () => ({
      fontFamily: effectivePrefs.fontFamily,
      fontSize: `${effectivePrefs.fontSize}px`,
      lineHeight: effectivePrefs.lineHeight,
      letterSpacing: `${effectivePrefs.letterSpacing}em`,
      wordSpacing: `${effectivePrefs.wordSpacing}em`,
      color: theme.color,
    }),
    [effectivePrefs, theme],
  );

  const progress =
    totalWords > 1
      ? Math.round((currentWordIndex / (totalWords - 1)) * 100)
      : 0;

  const isDark = effectivePrefs.darkMode || effectivePrefs.highContrast;

  /* Render a paragraph with per-word TTS highlighting */
  function renderParagraph(paraObj, paraIndex) {
    let wIdx = paraObj.startIdx;
    const compScore = sentenceComplexity[paraIndex]?.score || 0;
    
    const spans = paraObj.words.map((word, i) => {
      const globalIdx = wIdx++;
      const isActive = globalIdx === currentWordIndex;
      const diffScore = wordDifficultyScores[globalIdx] || 0;
      
      let diffClass = "";
      if (diffScore === 1) diffClass = "word-difficulty-medium";
      else if (diffScore === 2) diffClass = "word-difficulty-hard";

      return (
        <span
          key={i}
          className={cn(
            "inline transition-all duration-100",
            isActive && "tts-word-active",
            diffClass
          )}
          onClick={(e) => {
             if (diffScore > 0) {
               e.stopPropagation();
               handleWordClick(word, globalIdx);
             }
          }}
          aria-current={isActive ? "true" : undefined}
        >
          {word}{" "}
        </span>
      );
    });

    const isFocused =
      !effectivePrefs.focusMode || paraIndex === activePara;

    let compClass = "";
    if (compScore === 1) compClass = "sentence-complexity-medium";
    else if (compScore === 2) compClass = "sentence-complexity-hard";

    return (
      <div key={paraObj.startIdx} className="group relative">
        {compScore > 0 && (
           <button 
             onClick={(e) => { e.stopPropagation(); handleSentenceSimplify(paraObj.para, paraIndex); }}
             className="absolute -left-12 top-2 hidden group-hover:flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 shadow-sm hover:bg-slate-200"
             title="Simplify this paragraph"
           >
             <Sparkles className="h-4 w-4" />
           </button>
        )}
        <motion.p
          layout
          className={cn(
            "mb-6 cursor-pointer rounded-xl p-2 transition-all duration-200 last:mb-0",
            prefs.focusMode
              ? isFocused
                ? "para-focused ring-2 ring-amber-300/30"
                : "para-dimmed"
              : "",
            compClass
          )}
          onClick={() => {
            setActivePara(paraIndex);
            setCurrentWordIndex(paraObj.startIdx);
            if (isPlaying) setIsPlaying(false);
          }}
          aria-label={`Paragraph ${paraIndex + 1}${isFocused ? ", active" : ""}`}
        >
          {spans}
        </motion.p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen transition-colors duration-300",
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50",
      )}
    >
      {/* Reading ruler overlay */}
      {prefs.readingRuler && (
        <div
          className="reading-ruler"
          style={{ top: rulerY, ...rulerStyle }}
          aria-hidden="true"
        />
      )}

      {/* ── Top bar ── */}
      <header
        className={cn(
          "sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur",
          isDark
            ? "border-white/10 bg-slate-950/90"
            : "border-black/8 bg-white/90",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to home screen"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:scale-105",
              isDark
                ? "bg-white/10 text-slate-200 hover:bg-white/20"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div
              className={cn(
                "truncate text-sm font-bold leading-tight",
                isDark ? "text-slate-100" : "text-slate-900",
              )}
            >
              {doc.title}
            </div>
            <div
              className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              {doc.sourceLabel} · ~{doc.estimatedMinutes} min · {progress}%
              read
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* AI Summary toggle */}
          <button
            type="button"
            onClick={() =>
              setSummary(
                summary ? "" : generateSummary(doc.paragraphs),
              )
            }
            aria-label="Toggle AI summary"
            aria-pressed={!!summary}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
              summary
                ? "bg-amber-400 text-slate-900"
                : isDark
                ? "bg-white/10 text-slate-200 hover:bg-white/20"
                : "bg-amber-50 text-amber-900 hover:bg-amber-100",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {summary ? "Hide" : "Summary"}
            </span>
          </button>

          {/* Focus mode */}
          <button
            type="button"
            onClick={() =>
              setPrefs((p) => ({ ...p, focusMode: !p.focusMode }))
            }
            aria-label={
              prefs.focusMode
                ? "Disable focus mode"
                : "Enable focus mode"
            }
            aria-pressed={prefs.focusMode}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition",
              prefs.focusMode
                ? "bg-violet-500 text-white"
                : isDark
                ? "bg-white/10 text-slate-200 hover:bg-white/20"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            <Focus className="h-4 w-4" />
          </button>

          {/* Reading ruler */}
          <button
            type="button"
            onClick={() =>
              setPrefs((p) => ({
                ...p,
                readingRuler: !p.readingRuler,
              }))
            }
            aria-label={
              prefs.readingRuler
                ? "Disable reading ruler"
                : "Enable reading ruler"
            }
            aria-pressed={prefs.readingRuler}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition",
              prefs.readingRuler
                ? "bg-amber-400 text-slate-900"
                : isDark
                ? "bg-white/10 text-slate-200 hover:bg-white/20"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            <Ruler className="h-4 w-4" />
          </button>

          {/* AA Accessibility Panel */}
          <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open accessibility settings panel"
                aria-haspopup="dialog"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition hover:scale-105",
                  isDark
                    ? "bg-white/10 text-slate-200 hover:bg-white/20"
                    : "bg-slate-900 text-white hover:bg-slate-700",
                )}
              >
                AA
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-full max-w-sm flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
            >
              <SheetHeader className="border-b p-5">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <Type className="h-5 w-5 text-amber-600" />
                  Accessibility Settings
                </SheetTitle>
                <SheetDescription>
                  Adjust typography, colour, and reading aids live as you
                  read.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-5">
                <AccessibilityPanel prefs={prefs} setPrefs={setPrefs} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ── Adaptive Reading Notice ── */}
      {adaptiveConfig?.active && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "border-b px-6 py-3",
            isDark
              ? "border-emerald-400/20 bg-emerald-950/50"
              : "border-emerald-200 bg-emerald-50",
          )}
        >
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-bold text-emerald-700">
              Adapted for you:{" "}
              {adaptiveConfig.mode === "slow_paced_reading"
                ? "slower pacing"
                : adaptiveConfig.mode === "focus_layout"
                ? "focus mode and reading ruler on"
                : "reading aids adjusted"}
            </p>
            {adaptation.reason && (
              <p className="mt-0.5 text-xs text-emerald-800/70">
                {adaptation.reason}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── AI Summary Banner ── */}
      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "border-b px-6 py-4",
              isDark
                ? "border-white/10 bg-amber-950/60"
                : "border-amber-200 bg-amber-50",
            )}
            role="region"
            aria-label="AI-generated summary"
          >
            <div className="mx-auto max-w-3xl">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-700">
                <Sparkles className="h-3.5 w-3.5" /> AI Summary
              </div>
              <p
                className={cn(
                  "text-sm leading-7",
                  isDark ? "text-amber-100" : "text-slate-800",
                )}
                style={{ fontFamily: prefs.fontFamily }}
              >
                {summary}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Recommendations Banners ── */}
        {recommendations.map(rec => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="recommendation-banner border-b border-emerald-200 bg-emerald-50 px-6 py-3"
          >
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
               <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700 mb-1">
                    <Sparkles className="h-3.5 w-3.5" /> Personalized Tip
                  </div>
                  <p className="text-sm font-medium text-slate-800">{rec.title}</p>
                  <p className="text-sm text-slate-600">{rec.description}</p>
               </div>
               <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleDismissRecommendation(rec.id)}>
                    Dismiss
                  </Button>
                  {rec.type === "settings" && (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApplyRecommendation(rec)}>
                      Apply
                    </Button>
                  )}
               </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── AI Simplification Modal ── */}
      <Dialog open={simplificationModal.open} onOpenChange={(open) => setSimplificationModal(p => ({ ...p, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Sparkles className="h-5 w-5" />
              AI Simplification
            </DialogTitle>
            <DialogDescription>
              We simplified this for easier reading.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Original</p>
              <p className="text-sm text-slate-700 line-clamp-3" style={{ fontFamily: prefs.fontFamily }}>{simplificationModal.text}</p>
            </div>
            
            <div className="rounded-xl bg-amber-50 p-4 border border-amber-100 shadow-inner">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">Simplified</p>
              {simplificationModal.loading ? (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating simpler version...
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-base font-medium text-slate-900" style={{ fontFamily: prefs.fontFamily }}>{simplificationModal.simplified}</p>
                  {simplificationModal.explanation && (
                    <p className="text-sm text-slate-600 italic border-t border-amber-200/50 pt-2 mt-2" style={{ fontFamily: prefs.fontFamily }}>
                      {simplificationModal.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="secondary" onClick={() => setSimplificationModal(p => ({ ...p, open: false }))}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reading content ── */}
      <main
        ref={mainRef}
        className="mx-auto max-w-3xl px-5 py-10 pb-56 sm:px-8 relative"
        style={{ backgroundColor: theme.backgroundColor }}
        role="article"
        aria-label={`Reading: ${doc.title}`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22 }}
          style={readingStyle}
        >
          {structuredParagraphs.map((paraObj, i) =>
            renderParagraph(paraObj, i),
          )}
        </motion.div>

        {/* Word position slider */}
        <div
          className={cn(
            "mt-10 space-y-2 rounded-2xl border p-4",
            isDark
              ? "border-white/10 bg-white/5"
              : "border-black/8 bg-white/60",
          )}
          aria-label="Jump to word position"
        >
          <div
            className={cn(
              "flex justify-between text-xs",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            <span>Word position</span>
            <span>
              {currentWordIndex + 1} / {totalWords}
            </span>
          </div>
          <Slider
            value={[currentWordIndex]}
            min={0}
            max={Math.max(totalWords - 1, 0)}
            step={1}
            onValueChange={([v]) => {
              setCurrentWordIndex(v);
              if (isPlaying) setIsPlaying(false);
            }}
            aria-label="Word position"
          />
        </div>
      </main>

      {/* ── TTS Player ── */}
      <TTSPlayer
        words={allWords}
        currentWordIndex={currentWordIndex}
        setCurrentWordIndex={setCurrentWordIndex}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        prefs={effectivePrefs}
        defaultPlaybackRate={adaptiveConfig?.active ? adaptiveConfig.playbackRate : undefined}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Root component
───────────────────────────────────────────────────────────────────────────── */
export default function AdaptiveReadingModule() {
  const [searchParams] = useSearchParams();
  const docParam = searchParams.get("doc");
  const [activeDocId, setActiveDocId] = useState(docParam || null);

  const openDoc = useCallback(
    (id) => setActiveDocId(id || "moonlight-rail"),
    [],
  );
  const goHome = useCallback(() => setActiveDocId(null), []);

  return (
    <AnimatePresence mode="wait">
      {activeDocId ? (
        <motion.div
          key="reader"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
        >
          <ReaderScreen docId={activeDocId} onBack={goHome} />
        </motion.div>
      ) : (
        <motion.div
          key="home"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.18 }}
        >
          <HomeScreen onOpenDoc={openDoc} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

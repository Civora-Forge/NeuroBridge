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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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
}) {
  const [playbackRate, setPlaybackRate] = useState(1);
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
   Home Screen
───────────────────────────────────────────────────────────────────────────── */
function HomeScreen({ onOpenDoc }) {
  const recents = useMemo(() => lsGet(STORAGE_KEY_RECENTS, FALLBACK_RECENTS), []);
  const [activeNav, setActiveNav] = useState("home");

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
              <p className="text-base leading-7 text-slate-600 sm:text-lg">
                OpenDyslexic-first typography · Warm low-glare backgrounds ·
                Full TTS with word highlighting · Focus mode · Reading ruler ·
                WCAG 2.2
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  ["Accessible Font", "OpenDyslexic first"],
                  ["Background", "Warm Cream"],
                  ["Standard", "WCAG 2.2"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-2xl border border-black/5 bg-amber-50/80 px-4 py-3"
                  >
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      {k}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900">
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:w-56 lg:flex-col">
              <Button
                onClick={() => onOpenDoc("moonlight-rail")}
                className="h-12 flex-1 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                aria-label="Open reader with sample document"
              >
                Start reading <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 flex-1 rounded-2xl border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              >
                <Link to="/dyslexia">
                  <ChevronLeft className="h-4 w-4" /> Dyslexia Hub
                </Link>
              </Button>
            </div>
          </div>
        </motion.header>

        {/* ── Continue Reading ── */}
        <section id="arm-history" className="scroll-mt-24 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Continue Reading
              </h2>
              <p className="text-sm text-slate-600">
                Pick up where you left off.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full px-3 text-slate-700"
            >
              {recents.length} documents
            </Badge>
          </div>

          <Carousel className="w-full">
            <CarouselContent>
              {recents.map((doc, i) => (
                <CarouselItem
                  key={doc.id}
                  className="basis-[86%] md:basis-1/2 xl:basis-1/3"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.04 }}
                    className="h-full"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDoc(doc.id)}
                      className="group block h-full w-full text-left"
                      aria-label={`Open ${doc.title}, ${doc.progress}% complete`}
                    >
                      <Card className="h-full overflow-hidden border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_24px_50px_rgba(15,23,42,0.10)]">
                        <div
                          className={cn(
                            "relative h-36 bg-gradient-to-br",
                            doc.thumb,
                          )}
                        >
                          <div className="absolute right-3 top-3">
                            <ProgressRing progress={doc.progress} />
                          </div>
                        </div>
                        <CardHeader className="space-y-2 pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <CardTitle className="text-base leading-snug text-slate-900">
                              {doc.title}
                            </CardTitle>
                            <Badge className="shrink-0 rounded-full bg-white text-xs text-slate-700 hover:bg-white">
                              {doc.tag}
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-1 text-xs">
                            <Clock3 className="h-3 w-3" /> {doc.timestamp} ·{" "}
                            {doc.source}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-0">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Progress</span>
                            <span>{doc.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-black/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
                              style={{
                                width: `${doc.progress}%`,
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
                    </button>
                  </motion.div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
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
                    onClick={() => onOpenDoc(opt.docId)}
                    className="group h-full w-full text-left focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:outline-none"
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Reader Screen
───────────────────────────────────────────────────────────────────────────── */
function ReaderScreen({ docId, onBack }) {
  const doc = READING_LIBRARY[docId] || READING_LIBRARY["moonlight-rail"];

  /* Prefs — persisted to localStorage */
  const [prefs, setPrefsState] = useState(() =>
    lsGet(STORAGE_KEY_PREFS, DEFAULT_PREFS),
  );
  const setPrefs = useCallback((updater) => {
    setPrefsState((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : updater;
      lsSet(STORAGE_KEY_PREFS, next);
      return next;
    });
  }, []);

  /* Build structured paragraphs with global word indices */
  const structuredParagraphs = useMemo(() => {
    let idx = 0;
    return doc.paragraphs.map((para) => {
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

  /* Reading position — restored from localStorage */
  const [currentWordIndex, setCurrentWordIndex] = useState(() => {
    const saved = lsGet(`${STORAGE_KEY_PROGRESS}:${docId}`, null);
    if (saved?.wordIndex != null)
      return clamp(saved.wordIndex, 0, Math.max(totalWords - 1, 0));
    return 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [summary, setSummary] = useState("");
  const [rulerY, setRulerY] = useState(200);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activePara, setActivePara] = useState(0);

  /* Save progress on unmount */
  useEffect(() => {
    return () => {
      lsSet(`${STORAGE_KEY_PROGRESS}:${docId}`, {
        wordIndex: currentWordIndex,
      });
    };
  }, [docId, currentWordIndex]);

  /* Sync active paragraph to TTS cursor */
  useEffect(() => {
    const idx = structuredParagraphs.findIndex(
      (p) =>
        currentWordIndex >= p.startIdx && currentWordIndex <= p.endIdx,
    );
    if (idx >= 0) setActivePara(idx);
  }, [currentWordIndex, structuredParagraphs]);

  /* Reading ruler — follows mouse/touch */
  useEffect(() => {
    if (!prefs.readingRuler) return;
    const onMove = (e) => {
      const y = e.touches?.[0]?.clientY ?? e.clientY;
      setRulerY(y - 24);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, [prefs.readingRuler]);

  const theme = useMemo(() => {
    if (prefs.highContrast)
      return { backgroundColor: "#000000", color: "#FFF8C4" };
    if (prefs.darkMode)
      return { backgroundColor: "#0F172A", color: "#F8FAFC" };
    return { backgroundColor: prefs.backgroundColor, color: prefs.textColor };
  }, [prefs]);

  const readingStyle = useMemo(
    () => ({
      fontFamily: prefs.fontFamily,
      fontSize: `${prefs.fontSize}px`,
      lineHeight: prefs.lineHeight,
      letterSpacing: `${prefs.letterSpacing}em`,
      wordSpacing: `${prefs.wordSpacing}em`,
      color: theme.color,
    }),
    [prefs, theme],
  );

  const progress =
    totalWords > 1
      ? Math.round((currentWordIndex / (totalWords - 1)) * 100)
      : 0;

  const isDark = prefs.darkMode || prefs.highContrast;

  /* Render a paragraph with per-word TTS highlighting */
  function renderParagraph(paraObj, paraIndex) {
    let wIdx = paraObj.startIdx;
    const spans = paraObj.words.map((word, i) => {
      const globalIdx = wIdx++;
      const isActive = globalIdx === currentWordIndex;
      return (
        <span
          key={i}
          className={cn(
            "inline transition-all duration-100",
            isActive && "tts-word-active",
          )}
          aria-current={isActive ? "true" : undefined}
        >
          {word}{" "}
        </span>
      );
    });

    const isFocused =
      !prefs.focusMode || paraIndex === activePara;

    return (
      <motion.p
        key={paraObj.startIdx}
        layout
        className={cn(
          "mb-6 cursor-pointer rounded-xl p-2 transition-all duration-200 last:mb-0",
          prefs.focusMode
            ? isFocused
              ? "para-focused ring-2 ring-amber-300/30"
              : "para-dimmed"
            : "",
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
          style={{ top: rulerY }}
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
      </AnimatePresence>

      {/* ── Reading content ── */}
      <main
        className="mx-auto max-w-3xl px-5 py-10 pb-56 sm:px-8"
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
        prefs={prefs}
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

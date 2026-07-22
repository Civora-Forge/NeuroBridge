import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  BookOpenText,
  Camera,
  FileScan,
  FileText,
  GalleryVerticalEnd,
  Headphones,
  Highlighter,
  Pause,
  Play,
  Ruler,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  SunMedium,
  MoonStar,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const RECENT_STORAGE_KEY = "neurobridge-dyslexia-recents";
const PROGRESS_STORAGE_PREFIX = "neurobridge-dyslexia-progress";

const READING_LIBRARY = {
  "moonlight-rail": {
    id: "moonlight-rail",
    title: "Moonlight Rail Journal",
    sourceLabel: "From files",
    thumb: "from-amber-200 via-rose-200 to-sky-200",
    estimatedMinutes: 6,
    paragraphs: [
      "The train left the station just before dusk, and the windows turned gold as the city lights came on one by one. I kept my notebook open beside the seat and wrote down the tiny details that helped me stay present: the rhythm of the tracks, the soft hum of the carriage, and the steady glow of the reading lamp overhead.",
      "When the route passed the river, the reflections on the water looked like a second skyline. I slowed down my reading, let the words rest for a moment, and then returned to the page with a calmer pace. That pause was enough to make the rest of the chapter feel more approachable.",
    ],
  },
  "garden-notes": {
    id: "garden-notes",
    title: "Garden Notes for Week 8",
    sourceLabel: "Scan text",
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
    sourceLabel: "Scan pages",
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
    sourceLabel: "From gallery",
    thumb: "from-slate-200 via-indigo-100 to-violet-200",
    estimatedMinutes: 3,
    paragraphs: [
      "A photograph of a window seat becomes easier to understand when the caption starts with the main object, then adds the feeling, then ends with the detail that matters most. That structure keeps the message readable and avoids clutter.",
      "The caption can stay short and still be complete. If the image shows a notebook, a cup, and a bright lamp, the most helpful version begins with the notebook and leaves the rest as supporting details rather than competing ideas.",
    ],
  },
  default: {
    id: "default",
    title: "Warm Reading Sample",
    sourceLabel: "Default reading mode",
    thumb: "from-stone-200 via-amber-100 to-yellow-200",
    estimatedMinutes: 5,
    paragraphs: [
      "Reading works best when the page is calm, the spacing is generous, and the letterforms are easy to follow. This sample keeps the language simple so the interface can focus on comfort, rhythm, and attention rather than visual noise.",
      "The reader remembers progress automatically, highlights the current spoken word, and keeps the most important tools close at hand. That way, the experience stays predictable even when the content changes.",
    ],
  },
};

const SOURCE_PRESETS = {
  files: { label: "From files", docId: "moonlight-rail" },
  "scan-text": { label: "Scan text", docId: "garden-notes" },
  "scan-pages": { label: "Scan pages", docId: "city-story" },
  gallery: { label: "From gallery", docId: "photo-caption" },
  recent: { label: "Recently opened", docId: "moonlight-rail" },
  settings: { label: "Preferences", docId: "moonlight-rail" },
};

const FONT_OPTIONS = [
  {
    value: '"OpenDyslexic", "Lexend", "Atkinson Hyperlegible", sans-serif',
    label: "OpenDyslexic",
  },
  { value: '"Lexend", "Atkinson Hyperlegible", sans-serif', label: "Lexend" },
  {
    value: '"Atkinson Hyperlegible", sans-serif',
    label: "Atkinson Hyperlegible",
  },
  { value: "ui-sans-serif, system-ui, sans-serif", label: "System sans" },
];

const BACKGROUND_OPTIONS = [
  { label: "Cream", value: "#FAF3A0" },
  { label: "Soft paper", value: "#FFF8C4" },
  { label: "Warm ivory", value: "#FFF5D6" },
  { label: "Dusty blue", value: "#EAF2FF" },
  { label: "Muted sage", value: "#E9F0D7" },
];

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function getStoredRecentDocuments() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateSummary(paragraphs) {
  const text = paragraphs.join(" ");
  const sentences =
    text
      .match(/[^.!?]+[.!?]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];

  if (sentences.length <= 2) {
    return text;
  }

  const first = sentences[0];
  const middle = sentences[Math.floor(sentences.length / 2)];
  const last = sentences[sentences.length - 1];

  return [first, middle, last].filter(Boolean).join(" ");
}

function countWordsBefore(text, charIndex) {
  const slice = text.slice(0, charIndex).trim();

  if (!slice) {
    return 0;
  }

  return slice.split(/\s+/).length;
}

function LabeledSlider({ label, value, helper, min, max, step, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{helper}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
      />
    </div>
  );
}

function AccessibilityControls({
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  lineHeight,
  setLineHeight,
  letterSpacing,
  setLetterSpacing,
  wordSpacing,
  setWordSpacing,
  backgroundColor,
  setBackgroundColor,
  textColor,
  setTextColor,
  darkMode,
  setDarkMode,
  highContrast,
  setHighContrast,
  readingRuler,
  setReadingRuler,
  focusMode,
  setFocusMode,
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">Font family</div>
          <Select value={fontFamily} onValueChange={setFontFamily}>
            <SelectTrigger className="rounded-2xl border-slate-200 bg-white">
              <SelectValue placeholder="Choose font" />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((option) => (
                <SelectItem key={option.label} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">Background</div>
          <Select value={backgroundColor} onValueChange={setBackgroundColor}>
            <SelectTrigger className="rounded-2xl border-slate-200 bg-white">
              <SelectValue placeholder="Choose background" />
            </SelectTrigger>
            <SelectContent>
              {BACKGROUND_OPTIONS.map((option) => (
                <SelectItem key={option.label} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">Text color</div>
          <Input
            type="color"
            value={textColor}
            onChange={(event) => setTextColor(event.target.value)}
            className="h-12 rounded-2xl border-slate-200 bg-white p-2"
            aria-label="Text color"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">
            Background color
          </div>
          <Input
            type="color"
            value={backgroundColor}
            onChange={(event) => setBackgroundColor(event.target.value)}
            className="h-12 rounded-2xl border-slate-200 bg-white p-2"
            aria-label="Background color"
          />
        </div>
      </div>

      <LabeledSlider
        label="Font size"
        helper={`${fontSize}px`}
        value={fontSize}
        min={16}
        max={36}
        step={1}
        onChange={setFontSize}
      />

      <LabeledSlider
        label="Line spacing"
        helper={lineHeight.toFixed(2)}
        value={lineHeight}
        min={1.4}
        max={2.2}
        step={0.05}
        onChange={setLineHeight}
      />

      <LabeledSlider
        label="Letter spacing"
        helper={`${letterSpacing.toFixed(2)}em`}
        value={letterSpacing}
        min={0}
        max={0.2}
        step={0.01}
        onChange={setLetterSpacing}
      />

      <LabeledSlider
        label="Word spacing"
        helper={`${wordSpacing.toFixed(2)}em`}
        value={wordSpacing}
        min={0}
        max={0.3}
        step={0.01}
        onChange={setWordSpacing}
      />

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-slate-700">
              Dark mode
            </span>
            <span className="block text-xs text-slate-500">
              Reduce glare for low-light reading
            </span>
          </span>
          <Switch
            checked={darkMode}
            onCheckedChange={setDarkMode}
            aria-label="Toggle dark mode"
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-slate-700">
              High contrast
            </span>
            <span className="block text-xs text-slate-500">
              Strong foreground and background contrast
            </span>
          </span>
          <Switch
            checked={highContrast}
            onCheckedChange={setHighContrast}
            aria-label="Toggle high contrast mode"
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-slate-700">
              Reading ruler
            </span>
            <span className="block text-xs text-slate-500">
              Track one line or paragraph at a time
            </span>
          </span>
          <Switch
            checked={readingRuler}
            onCheckedChange={setReadingRuler}
            aria-label="Toggle reading ruler"
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-slate-700">
              Focus mode
            </span>
            <span className="block text-xs text-slate-500">
              Dim the rest of the page while reading
            </span>
          </span>
          <Switch
            checked={focusMode}
            onCheckedChange={setFocusMode}
            aria-label="Toggle focus mode"
          />
        </label>
      </div>
    </div>
  );
}

function ImportActionCard({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-32 flex-col justify-between rounded-[1.5rem] border border-white/60 bg-white p-5 text-left shadow-[0_16px_36px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(15,23,42,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1 pt-4">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="text-sm leading-6 text-slate-600">{description}</div>
      </div>
    </button>
  );
}

export default function DyslexiaReader() {
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source") ?? "files";
  const docParam = searchParams.get("doc");

  const selectedDocument = useMemo(() => {
    const preset = SOURCE_PRESETS[source] ?? SOURCE_PRESETS.files;
    return (
      READING_LIBRARY[docParam] ??
      READING_LIBRARY[preset.docId] ??
      READING_LIBRARY.default
    );
  }, [docParam, source]);

  const structuredParagraphs = useMemo(() => {
    let startWordIndex = 0;

    return selectedDocument.paragraphs.map((paragraph) => {
      const words = paragraph.match(/\S+/g) ?? [];
      const range = {
        paragraph,
        words,
        startWordIndex,
        endWordIndex: startWordIndex + Math.max(words.length - 1, 0),
      };

      startWordIndex += words.length;
      return range;
    });
  }, [selectedDocument]);

  const allWords = useMemo(
    () => structuredParagraphs.flatMap((paragraph) => paragraph.words),
    [structuredParagraphs],
  );

  const totalWords = allWords.length;
  const selectedPreset = SOURCE_PRESETS[source] ?? SOURCE_PRESETS.files;

  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(24);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [letterSpacing, setLetterSpacing] = useState(0.02);
  const [wordSpacing, setWordSpacing] = useState(0.08);
  const [backgroundColor, setBackgroundColor] = useState("#FAF3A0");
  const [textColor, setTextColor] = useState("#1F2937");
  const [darkMode, setDarkMode] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [readingRuler, setReadingRuler] = useState(true);
  const [focusMode, setFocusMode] = useState(true);
  const [summary, setSummary] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [voices, setVoices] = useState([]);
  const [readerPanelOpen, setReaderPanelOpen] = useState(false);
  const [rulerY, setRulerY] = useState(96);
  const [importStatus, setImportStatus] = useState("");

  const contentRef = useRef(null);
  const utteranceRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const pagesInputRef = useRef(null);

  const readingProgress =
    totalWords > 1
      ? Math.round((currentWordIndex / (totalWords - 1)) * 100)
      : 0;
  const activeParagraphIndex = structuredParagraphs.findIndex(
    (paragraph) =>
      currentWordIndex >= paragraph.startWordIndex &&
      currentWordIndex <= paragraph.endWordIndex,
  );

  const theme = useMemo(() => {
    if (highContrast) {
      return {
        backgroundColor: "#000000",
        color: "#FFF8C4",
        borderColor: "rgba(255,255,255,0.18)",
      };
    }

    if (darkMode) {
      return {
        backgroundColor: "#0F172A",
        color: "#F8FAFC",
        borderColor: "rgba(255,255,255,0.12)",
      };
    }

    return {
      backgroundColor,
      color: textColor,
      borderColor: "rgba(15,23,42,0.08)",
    };
  }, [backgroundColor, darkMode, highContrast, textColor]);

  const currentWord = allWords[currentWordIndex] ?? allWords[0] ?? "";

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return undefined;
    }

    const syncVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);

      if (!selectedVoiceURI && available.length > 0) {
        const preferred =
          available.find((voice) => /en/i.test(voice.lang)) ?? available[0];
        if (preferred) {
          setSelectedVoiceURI(preferred.voiceURI);
        }
      }
    };

    syncVoices();
    window.speechSynthesis.addEventListener("voiceschanged", syncVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", syncVoices);
    };
  }, [selectedVoiceURI]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(
      `${PROGRESS_STORAGE_PREFIX}:${selectedDocument.id}`,
    );

    if (!saved) {
      setCurrentWordIndex(0);
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.currentWordIndex === "number") {
        setCurrentWordIndex(
          clamp(parsed.currentWordIndex, 0, Math.max(allWords.length - 1, 0)),
        );
      } else if (
        typeof parsed.readingProgress === "number" &&
        allWords.length > 1
      ) {
        setCurrentWordIndex(
          clamp(
            Math.round((parsed.readingProgress / 100) * (allWords.length - 1)),
            0,
            allWords.length - 1,
          ),
        );
      }
    } catch {
      setCurrentWordIndex(0);
    }
  }, [allWords.length, selectedDocument.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedDocument.id) {
      return;
    }

    const payload = {
      id: selectedDocument.id,
      title: selectedDocument.title,
      source: selectedPreset.label,
      timestamp: formatDistanceToNow(new Date(), { addSuffix: true }),
      progress: readingProgress,
      thumb: selectedDocument.thumb,
      currentWordIndex,
    };

    window.localStorage.setItem(
      `${PROGRESS_STORAGE_PREFIX}:${selectedDocument.id}`,
      JSON.stringify(payload),
    );

    const recentDocuments = getStoredRecentDocuments().filter(
      (item) => item.id !== selectedDocument.id,
    );
    window.localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify([payload, ...recentDocuments].slice(0, 6)),
    );
  }, [
    currentWordIndex,
    readingProgress,
    selectedDocument,
    selectedPreset.label,
  ]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const selectedVoice = useMemo(
    () =>
      voices.find((voice) => voice.voiceURI === selectedVoiceURI) ??
      voices[0] ??
      null,
    [selectedVoiceURI, voices],
  );

  const cancelSpeech = useCallback(() => {
    if (!window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const speakFromIndex = useCallback(
    (startIndex) => {
      if (!window.speechSynthesis || totalWords === 0) {
        return;
      }

      const normalizedStart = clamp(startIndex, 0, totalWords - 1);
      const remainingWords = allWords.slice(normalizedStart);
      const utteranceText = remainingWords.join(" ");

      if (!utteranceText) {
        return;
      }

      cancelSpeech();

      const utterance = new SpeechSynthesisUtterance(utteranceText);
      utterance.rate = playbackRate;
      utterance.pitch = 1;
      utterance.volume = 1;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onboundary = (event) => {
        if (typeof event.charIndex !== "number") {
          return;
        }

        const relativeWordIndex = countWordsBefore(
          utteranceText,
          event.charIndex,
        );
        const nextWordIndex = clamp(
          normalizedStart + relativeWordIndex,
          normalizedStart,
          totalWords - 1,
        );
        setCurrentWordIndex(nextWordIndex);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };

      utterance.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setCurrentWordIndex(normalizedStart);
      setIsPlaying(true);
      setIsPaused(false);
    },
    [allWords, cancelSpeech, playbackRate, selectedVoice, totalWords],
  );

  const handlePlayPause = useCallback(() => {
    if (!window.speechSynthesis || totalWords === 0) {
      return;
    }

    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    speakFromIndex(currentWordIndex);
  }, [currentWordIndex, speakFromIndex, totalWords]);

  const jumpBySeconds = useCallback(
    (seconds) => {
      const wordsPerSecond = 2.5 * playbackRate;
      const jumpWords = Math.max(
        1,
        Math.round(Math.abs(seconds) * wordsPerSecond),
      );
      const nextIndex = clamp(
        currentWordIndex + (seconds < 0 ? -jumpWords : jumpWords),
        0,
        Math.max(totalWords - 1, 0),
      );
      speakFromIndex(nextIndex);
    },
    [currentWordIndex, playbackRate, speakFromIndex, totalWords],
  );

  const handleProgressCommit = useCallback(
    (value) => {
      if (totalWords === 0) {
        return;
      }

      const nextIndex = clamp(
        Math.round(((value[0] ?? 0) / 100) * (totalWords - 1)),
        0,
        totalWords - 1,
      );
      speakFromIndex(nextIndex);
    },
    [speakFromIndex, totalWords],
  );

  const handleGenerateSummary = useCallback(() => {
    setSummary(generateSummary(selectedDocument.paragraphs));
  }, [selectedDocument]);

  const handleImport = useCallback((mode) => {
    return (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setImportStatus(`${mode} queued: ${file.name}`);
      event.target.value = "";
    };
  }, []);

  const readerStyle = {
    backgroundColor: theme.backgroundColor,
    color: theme.color,
    borderColor: theme.borderColor,
    fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight,
    letterSpacing: `${letterSpacing}em`,
    wordSpacing: `${wordSpacing}em`,
  };

  let wordCursor = 0;

  return (
    <div
      className={cn(
        "min-h-screen pb-40 pt-6",
        highContrast && "bg-black",
        darkMode && !highContrast && "bg-slate-950",
      )}
      style={{ backgroundColor: theme.backgroundColor }}
    >
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur"
        >
          <div className="flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  variant="ghost"
                  className="h-11 rounded-full border border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
                >
                  <Link to="/dyslexia">
                    <ArrowLeft className="h-4 w-4" />
                    Back to module
                  </Link>
                </Button>
                <Badge className="rounded-full bg-amber-100 text-amber-900 hover:bg-amber-100">
                  <BookOpenText className="mr-1 h-3.5 w-3.5" />
                  {selectedPreset.label}
                </Badge>
                <Badge variant="secondary" className="rounded-full">
                  {selectedDocument.estimatedMinutes} min read
                </Badge>
              </div>

              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  {selectedDocument.title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Warm paper tones, OpenDyslexic-first typography, synchronized
                  word highlighting, and a fixed TTS player keep the reading
                  flow predictable and calm.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-amber-200 bg-amber-50 text-amber-900"
                >
                  <Highlighter className="mr-1 h-3.5 w-3.5" />
                  Focus mode active
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-sky-200 bg-sky-50 text-sky-900"
                >
                  <Ruler className="mr-1 h-3.5 w-3.5" />
                  Reading ruler on
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-900"
                >
                  <Volume2 className="mr-1 h-3.5 w-3.5" />
                  TTS ready
                </Badge>
              </div>
            </div>

            <div className="grid w-full max-w-sm gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Auto-save progress
                  </div>
                  <div className="text-xs text-slate-500">
                    Last saved{" "}
                    {formatDistanceToNow(new Date(), { addSuffix: true })}
                  </div>
                </div>
                <Badge className="rounded-full bg-white text-slate-700 hover:bg-white">
                  {readingProgress}%
                </Badge>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-200"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                <div className="rounded-2xl bg-white px-3 py-2 text-center">
                  {totalWords} words
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-center">
                  Word {Math.min(currentWordIndex + 1, Math.max(totalWords, 1))}
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-center">
                  {selectedDocument.estimatedMinutes} min
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.03 }}
            className="space-y-6"
          >
            <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <CardHeader className="space-y-4 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-2xl text-slate-950">
                      Reading workspace
                    </CardTitle>
                    <CardDescription>
                      Use the floating accessibility panel to fine-tune the
                      page.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="rounded-full"
                      onClick={handleGenerateSummary}
                    >
                      <Sparkles className="h-4 w-4" />
                      AI Summary
                    </Button>
                    <Sheet
                      open={readerPanelOpen}
                      onOpenChange={setReaderPanelOpen}
                    >
                      <SheetTrigger asChild>
                        <Button
                          variant="outline"
                          className="rounded-full xl:hidden"
                        >
                          <Settings2 className="h-4 w-4" />
                          Accessibility
                        </Button>
                      </SheetTrigger>
                      <SheetContent
                        side="bottom"
                        className="max-h-[90vh] overflow-y-auto rounded-t-[2rem] border-slate-200 bg-slate-50 px-4 sm:px-6"
                      >
                        <SheetHeader>
                          <SheetTitle>Accessibility settings</SheetTitle>
                          <SheetDescription>
                            Fine-tune typography, contrast, and reading aids.
                          </SheetDescription>
                        </SheetHeader>
                        <AccessibilityControls
                          fontFamily={fontFamily}
                          setFontFamily={setFontFamily}
                          fontSize={fontSize}
                          setFontSize={setFontSize}
                          lineHeight={lineHeight}
                          setLineHeight={setLineHeight}
                          letterSpacing={letterSpacing}
                          setLetterSpacing={setLetterSpacing}
                          wordSpacing={wordSpacing}
                          setWordSpacing={setWordSpacing}
                          backgroundColor={backgroundColor}
                          setBackgroundColor={setBackgroundColor}
                          textColor={textColor}
                          setTextColor={setTextColor}
                          darkMode={darkMode}
                          setDarkMode={setDarkMode}
                          highContrast={highContrast}
                          setHighContrast={setHighContrast}
                          readingRuler={readingRuler}
                          setReadingRuler={setReadingRuler}
                          focusMode={focusMode}
                          setFocusMode={setFocusMode}
                        />
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ImportActionCard
                    icon={Camera}
                    title="Camera OCR"
                    description="Capture a page directly from the camera and queue it for OCR."
                    onClick={() => cameraInputRef.current?.click()}
                  />
                  <ImportActionCard
                    icon={GalleryVerticalEnd}
                    title="From gallery"
                    description="Choose a saved image or screenshot from your device."
                    onClick={() => galleryInputRef.current?.click()}
                  />
                  <ImportActionCard
                    icon={FileText}
                    title="PDF import"
                    description="Load a PDF and keep the reader ready for extracted text."
                    onClick={() => pdfInputRef.current?.click()}
                  />
                  <ImportActionCard
                    icon={FileScan}
                    title="Scan pages"
                    description="Queue scans for multi-page reading support."
                    onClick={() => pagesInputRef.current?.click()}
                  />
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImport("Camera OCR")}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImport("Gallery import")}
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleImport("PDF import")}
                />
                <input
                  ref={pagesInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleImport("Scan pages")}
                />

                {importStatus ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {importStatus}
                  </div>
                ) : null}
              </CardHeader>

              <CardContent>
                <div
                  ref={contentRef}
                  onMouseMove={(event) => {
                    if (!contentRef.current) {
                      return;
                    }

                    const bounds = contentRef.current.getBoundingClientRect();
                    setRulerY(
                      clamp(
                        event.clientY - bounds.top - 28,
                        0,
                        Math.max(bounds.height - 56, 0),
                      ),
                    );
                  }}
                  className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 p-6 sm:p-8"
                  style={readerStyle}
                >
                  {readingRuler ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 right-0 z-10 rounded-2xl border border-sky-300/40 bg-sky-200/20 shadow-[0_0_0_1px_rgba(125,211,252,0.12)]"
                      style={{ top: rulerY, height: 56 }}
                    />
                  ) : null}

                  <div className="relative z-20 space-y-6">
                    {structuredParagraphs.map((paragraph, paragraphIndex) => {
                      const paragraphActive =
                        activeParagraphIndex === paragraphIndex;
                      const tokens = paragraph.paragraph.split(/(\s+)/);
                      let paragraphWordOffset = 0;

                      const paragraphStyle = cn(
                        "rounded-[1.25rem] p-4 sm:p-5 transition-all duration-200",
                        focusMode &&
                          !paragraphActive &&
                          "opacity-35 blur-[0.45px]",
                        paragraphActive &&
                          "bg-white/55 ring-1 ring-slate-900/8 shadow-sm",
                      );

                      const startWordIndex = paragraph.startWordIndex;

                      return (
                        <motion.div
                          key={`${paragraphIndex}-${paragraph.startWordIndex}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.18,
                            delay: paragraphIndex * 0.02,
                          }}
                          className={paragraphStyle}
                          onClick={() => setCurrentWordIndex(startWordIndex)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setCurrentWordIndex(startWordIndex);
                            }
                          }}
                          aria-label={`Paragraph ${paragraphIndex + 1}`}
                        >
                          <p className="select-text">
                            {tokens.map((token, tokenIndex) => {
                              if (/^\s+$/.test(token)) {
                                return (
                                  <span key={`${tokenIndex}-${token}`}>
                                    {token}
                                  </span>
                                );
                              }

                              const wordIndex =
                                startWordIndex + paragraphWordOffset;
                              paragraphWordOffset += 1;
                              const isCurrentWord =
                                wordIndex === currentWordIndex;

                              return (
                                <span
                                  key={`${tokenIndex}-${token}`}
                                  className={cn(
                                    "rounded px-1 transition-colors duration-150",
                                    isCurrentWord &&
                                      "bg-amber-300 text-slate-950 shadow-sm",
                                  )}
                                >
                                  {token}
                                </span>
                              );
                            })}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">
                  Text-to-speech summary
                </CardTitle>
                <CardDescription>
                  The AI summary button creates a concise overview for quick
                  review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary ? (
                  <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-slate-800">
                    {summary}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    Generate a concise summary to keep the main ideas close at
                    hand.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.06 }}
            className="space-y-6"
          >
            <Card className="hidden rounded-[2rem] border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)] xl:block">
              <CardHeader>
                <CardTitle className="text-xl">Accessibility panel</CardTitle>
                <CardDescription>
                  Floating controls for font, spacing, color, focus mode, and
                  reading aids.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccessibilityControls
                  fontFamily={fontFamily}
                  setFontFamily={setFontFamily}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                  lineHeight={lineHeight}
                  setLineHeight={setLineHeight}
                  letterSpacing={letterSpacing}
                  setLetterSpacing={setLetterSpacing}
                  wordSpacing={wordSpacing}
                  setWordSpacing={setWordSpacing}
                  backgroundColor={backgroundColor}
                  setBackgroundColor={setBackgroundColor}
                  textColor={textColor}
                  setTextColor={setTextColor}
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                  highContrast={highContrast}
                  setHighContrast={setHighContrast}
                  readingRuler={readingRuler}
                  setReadingRuler={setReadingRuler}
                  focusMode={focusMode}
                  setFocusMode={setFocusMode}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Current session</CardTitle>
                <CardDescription>
                  Fast summary of where you are and what the reader is doing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Progress</span>
                  <strong className="text-slate-900">{readingProgress}%</strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Current word</span>
                  <strong className="text-slate-900">
                    {currentWord || "Ready"}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Voice</span>
                  <strong className="text-slate-900">
                    {selectedVoice?.name ?? "System voice"}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Text mode</span>
                  <strong className="text-slate-900">
                    {focusMode ? "Focus" : "Open"}
                  </strong>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Continue reading</CardTitle>
                <CardDescription>
                  Other recent documents are saved here automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Carousel className="w-full">
                  <CarouselContent>
                    {getStoredRecentDocuments()
                      .slice(0, 3)
                      .map((item) => (
                        <CarouselItem key={item.id} className="basis-full">
                          <Link
                            to={`/dyslexia/adaptive-reading?source=recent&doc=${encodeURIComponent(item.id)}`}
                            className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div
                              className={cn(
                                "h-24 rounded-2xl bg-gradient-to-br",
                                item.thumb ?? "from-slate-200 to-amber-100",
                              )}
                            />
                            <div className="mt-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {item.title}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.timestamp}
                                </div>
                              </div>
                              <Badge
                                variant="secondary"
                                className="rounded-full"
                              >
                                {item.progress}%
                              </Badge>
                            </div>
                          </Link>
                        </CarouselItem>
                      ))}
                  </CarouselContent>
                </Carousel>
              </CardContent>
            </Card>
          </motion.aside>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/95 shadow-[0_-18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-3 md:grid-cols-[auto,auto,1fr,auto] md:items-center">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                onClick={() => jumpBySeconds(-10)}
                aria-label="Skip back 10 seconds"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                className="h-12 rounded-full px-5"
                onClick={handlePlayPause}
                aria-label={
                  isPlaying && !isPaused ? "Pause reading" : "Play reading"
                }
              >
                {isPlaying && !isPaused ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isPlaying && !isPaused ? "Pause" : "Play"}
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                onClick={() => jumpBySeconds(10)}
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Headphones className="h-4 w-4 text-slate-500" />
              <span>TTS speed</span>
              <Select
                value={String(playbackRate)}
                onValueChange={(value) => setPlaybackRate(Number(value))}
              >
                <SelectTrigger className="h-10 w-28 rounded-full border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEED_OPTIONS.map((speed) => (
                    <SelectItem key={speed} value={String(speed)}>
                      {speed}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Progress</span>
                <span>{readingProgress}%</span>
              </div>
              <Slider
                value={[readingProgress]}
                max={100}
                step={1}
                onValueCommit={handleProgressCommit}
                aria-label="Reading progress"
              />
            </div>

            <div className="flex items-center gap-2 justify-self-start md:justify-self-end">
              <Select
                value={selectedVoiceURI}
                onValueChange={setSelectedVoiceURI}
              >
                <SelectTrigger className="h-10 w-48 rounded-full border-slate-200 bg-white">
                  <SelectValue placeholder="Voice" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((voice) => (
                    <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={cancelSpeech}
                aria-label="Stop reading"
              >
                Stop
              </Button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setReaderPanelOpen(true)}
        className="fixed bottom-24 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)] transition hover:scale-105 xl:hidden"
        aria-label="Open accessibility controls"
      >
        <Settings2 className="h-5 w-5" />
      </button>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenText,
  Clock3,
  FileScan,
  FileText,
  GalleryVerticalEnd,
  Home,
  History,
  KeyboardMusic,
  ScanText,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const RECENT_STORAGE_KEY = "neurobridge-dyslexia-recents";

const fallbackRecentDocuments = [
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
    source: "Scan text",
    thumb: "from-emerald-200 via-teal-200 to-cyan-200",
  },
  {
    id: "city-story",
    title: "City Storyboard Pages",
    timestamp: "2 days ago",
    progress: 89,
    tag: "Almost done",
    source: "Scan pages",
    thumb: "from-lime-200 via-yellow-200 to-amber-200",
  },
  {
    id: "photo-caption",
    title: "Photo Caption Practice",
    timestamp: "Last week",
    progress: 57,
    tag: "Gallery",
    source: "From gallery",
    thumb: "from-slate-200 via-indigo-100 to-violet-200",
  },
];

const quickStartOptions = [
  {
    title: "From Files",
    description: "Open PDFs, docs, or saved reading packs.",
    icon: FileText,
    to: "/dyslexia/adaptive-reading?source=files&doc=moonlight-rail",
    accent: "from-amber-50 to-amber-100",
  },
  {
    title: "Scan Text",
    description: "Capture a page and turn it into readable text.",
    icon: ScanText,
    to: "/dyslexia/adaptive-reading?source=scan-text&doc=garden-notes",
    accent: "from-emerald-50 to-teal-100",
  },
  {
    title: "Scan Pages",
    description: "Multi-page OCR for textbooks and handouts.",
    icon: FileScan,
    to: "/dyslexia/adaptive-reading?source=scan-pages&doc=city-story",
    accent: "from-sky-50 to-cyan-100",
  },
  {
    title: "From Gallery",
    description: "Pick a saved image or screenshot from your device.",
    icon: GalleryVerticalEnd,
    to: "/dyslexia/adaptive-reading?source=gallery&doc=photo-caption",
    accent: "from-violet-50 to-fuchsia-100",
  },
];

const navItems = [
  { label: "Home", icon: Home, action: "top" },
  { label: "History", icon: History, action: "history" },
  { label: "Tutor", icon: BookOpenText, to: "/dyslexia/adaptive-reading" },
  { label: "Settings", icon: Settings2, action: "settings" },
];

function loadRecentDocuments() {
  if (typeof window === "undefined") {
    return fallbackRecentDocuments;
  }

  try {
    const stored = window.localStorage.getItem(RECENT_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    return fallbackRecentDocuments;
  }

  return fallbackRecentDocuments;
}

function ProgressBar({ progress }) {
  return (
    <div className="h-2 w-full rounded-full bg-black/5">
      <div
        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function DyslexiaDashboard() {
  const [recentDocuments, setRecentDocuments] = useState(
    fallbackRecentDocuments,
  );

  useEffect(() => {
    setRecentDocuments(loadRecentDocuments());
  }, []);

  const stats = useMemo(
    () => [
      { label: "Accessible font", value: "OpenDyslexic first" },
      { label: "Reading mode", value: "Warm low-glare paper" },
      { label: "Keyboard-ready", value: "WCAG 2.2 aligned" },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(254,249,195,0.9),_rgba(250,243,160,0.5)_40%,_rgba(248,250,252,1)_78%)] pb-28 pt-6 sm:pt-8">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden rounded-[2rem] border border-black/5 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <Badge className="w-fit bg-amber-100 text-amber-900 hover:bg-amber-100">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Dyslexia reading module
              </Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  Calm reading that adapts to the reader, not the other way
                  around.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  A minimalist, accessibility-first reading workspace with warm
                  paper tones, OpenDyslexic-first typography, and a lightweight
                  path from capture to focus to audio support.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-black/5 bg-amber-50/80 px-4 py-3"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid w-full max-w-sm gap-3 rounded-3xl border border-amber-100 bg-amber-50/70 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                  <KeyboardMusic className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Reading preferences
                  </div>
                  <p className="text-sm text-slate-600">
                    OpenDyslexic, cream paper, and low-glare spacing presets by
                    default.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                <span className="rounded-xl bg-white px-3 py-2 text-center">
                  Font
                </span>
                <span className="rounded-xl bg-white px-3 py-2 text-center">
                  Spacing
                </span>
                <span className="rounded-xl bg-white px-3 py-2 text-center">
                  TTS
                </span>
              </div>
              <Button
                asChild
                className="h-12 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
              >
                <Link to="/dyslexia/adaptive-reading?source=files&doc=moonlight-rail">
                  Start reading
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.section>

        <section id="history" className="space-y-4 scroll-mt-24">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Continue Reading
              </h2>
              <p className="text-sm text-slate-600">
                Recently opened documents with progress and last-opened
                timestamps.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="h-8 rounded-full px-3 text-slate-700"
            >
              {recentDocuments.length} documents
            </Badge>
          </div>

          <Carousel className="w-full">
            <CarouselContent>
              {recentDocuments.map((document, index) => (
                <CarouselItem
                  key={document.id}
                  className="basis-[86%] md:basis-1/2 xl:basis-1/3"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.03 }}
                    className="h-full"
                  >
                    <Link
                      to={`/dyslexia/adaptive-reading?source=recent&doc=${encodeURIComponent(document.id)}`}
                      className="group block h-full"
                    >
                      <Card className="h-full overflow-hidden border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_24px_50px_rgba(15,23,42,0.1)]">
                        <div
                          className={cn(
                            "h-36 bg-gradient-to-br",
                            document.thumb,
                          )}
                        />
                        <CardHeader className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <CardTitle className="text-lg text-slate-900">
                                {document.title}
                              </CardTitle>
                              <CardDescription className="mt-1 flex items-center gap-1 text-sm">
                                <Clock3 className="h-3.5 w-3.5" />
                                {document.timestamp}
                              </CardDescription>
                            </div>
                            <Badge className="rounded-full bg-white text-slate-700 hover:bg-white">
                              {document.tag}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between text-sm text-slate-600">
                            <span>{document.source}</span>
                            <span>{document.progress}%</span>
                          </div>
                          <ProgressBar progress={document.progress} />
                        </CardContent>
                        <CardFooter className="justify-between text-sm font-medium text-slate-700">
                          <span>Open in reader</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </CardFooter>
                      </Card>
                    </Link>
                  </motion.div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Start Reading
            </h2>
            <p className="text-sm text-slate-600">
              Choose a capture path and open the adaptive reader with the right
              starting point.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickStartOptions.map((option, index) => {
              const Icon = option.icon;

              return (
                <motion.div
                  key={option.title}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.05 * index }}
                  className="h-full"
                >
                  <Link to={option.to} className="group block h-full">
                    <Card
                      className={cn(
                        "h-full rounded-[1.75rem] border-white/60 bg-gradient-to-br p-0 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_24px_50px_rgba(15,23,42,0.1)]",
                        option.accent,
                      )}
                    >
                      <CardHeader className="space-y-4 p-6">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 text-slate-900 shadow-sm">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                          <CardTitle className="text-xl text-slate-900">
                            {option.title}
                          </CardTitle>
                          <CardDescription className="text-sm leading-6 text-slate-600">
                            {option.description}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardFooter className="px-6 pb-6 pt-0">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                          Open reader <ArrowRight className="h-4 w-4" />
                        </span>
                      </CardFooter>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section id="settings" className="scroll-mt-24">
          <Card className="overflow-hidden rounded-[1.75rem] border border-black/5 bg-slate-950 text-white">
            <CardHeader>
              <CardTitle className="text-2xl">Settings preview</CardTitle>
              <CardDescription className="text-slate-300">
                The reader exposes the full accessibility panel with font,
                spacing, color, ruler, dark mode, high contrast, and focus
                controls.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Typography
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  OpenDyslexic with Lexend and Atkinson Hyperlegible fallbacks.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Spacing
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  Adjustable font size, line height, letter spacing, and word
                  spacing.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Reading aids
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  Focus mode, reading ruler, and synchronized TTS highlighting.
                </p>
              </div>
            </CardContent>
            <CardFooter className="justify-between border-t border-white/10 px-6 py-4 text-sm text-slate-300">
              <span>Ready for keyboard and screen reader use.</span>
              <Button
                asChild
                variant="secondary"
                className="rounded-full bg-white text-slate-900 hover:bg-slate-100"
              >
                <Link to="/dyslexia/adaptive-reading?source=settings&doc=moonlight-rail">
                  Open settings in reader
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </section>
      </main>

      <nav
        aria-label="Dyslexia module navigation"
        className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-1rem)] max-w-xl items-center justify-between gap-2 rounded-full border border-white/70 bg-white/90 px-2 py-2 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur sm:w-[calc(100%-2rem)]"
      >
        {navItems.map((item) => {
          const Icon = item.icon;

          if (item.to) {
            return (
              <Button
                key={item.label}
                asChild
                variant="ghost"
                className="h-12 flex-1 rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              >
                <Link to={item.to}>
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </Button>
            );
          }

          return (
            <Button
              key={item.label}
              variant="ghost"
              className="h-12 flex-1 rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              onClick={() => {
                if (item.action === "top") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  return;
                }

                document
                  .getElementById(item.action)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}

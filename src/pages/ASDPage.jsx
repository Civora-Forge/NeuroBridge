import { Brain, BookOpen, Smile, MessageCircle, MessagesSquare, Heart, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

const tools = [
  { to: "/asd/stories",  icon: BookOpen,      title: "Social Stories",      desc: "Practice real-world social scenarios at your own pace with animated story cards.", accent: "from-blue-400 to-blue-600", eyebrow: "Stories" },
  { to: "/asd/emotion",  icon: Smile,         title: "Emotion Decoder",     desc: "Recognise and express emotions with guided support and gentle feedback.", accent: "from-amber-400 to-amber-600", eyebrow: "Feelings" },
  { to: "/asd/social-scenarios", icon: MessageCircle, title: "Social Scenario Simulator", desc: "Practise responding to one situation at a time with structured, kind feedback.", accent: "from-emerald-400 to-emerald-600", eyebrow: "Practice" },
  { to: "/communication", icon: MessagesSquare, title: "Conversation Practice", desc: "Practise real conversations by voice or text with one-tap phrase support.", accent: "from-violet-400 to-violet-600", eyebrow: "Talk" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.08, ease: "easeOut" },
  }),
};

export default function ASDPage() {
  return (
    <SupportToolThemeProvider theme="asd_social">
      <SupportToolLayout
        title="Social & Emotional Support Hub"
        description="Tools for emotional understanding and social confidence."
      >
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden rounded-[2rem] border border-[#B2DFDB] bg-white/85 p-6 shadow-[0_20px_60px_rgba(13,148,136,0.10)] backdrop-blur md:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B2DFDB] bg-[#E0F5EE] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#0D9488]">
                <Sparkles className="h-3.5 w-3.5" />
                ASD Social & Emotional Module
              </span>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight text-[#134E4A] sm:text-5xl lg:text-6xl">
                  Social skills grow with gentle, repeated practice.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[#5F8A87] sm:text-lg">
                  A calm, structured space to practise emotions, conversations, and social stories —
                  at your own pace, with kind feedback every step.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl border border-[#B2DFDB] bg-[#E0F5EE]/80 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5F8A87]">Modules</div>
                  <div className="mt-1 text-sm font-medium text-[#134E4A]">{tools.length} tools</div>
                </div>
                <div className="rounded-2xl border border-[#B2DFDB] bg-[#E0F5EE]/80 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5F8A87]">Approach</div>
                  <div className="mt-1 text-sm font-medium text-[#134E4A]">CBT-based</div>
                </div>
                <div className="rounded-2xl border border-[#B2DFDB] bg-[#E0F5EE]/80 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5F8A87]">Feedback</div>
                  <div className="mt-1 text-sm font-medium text-[#134E4A]">Always kind</div>
                </div>
              </div>
            </div>

            <div className="grid w-full max-w-sm gap-3 rounded-3xl border border-[#B2DFDB] bg-[#E0F5EE]/70 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#0D9488] shadow-sm">
                  <Heart className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#134E4A]">Quick start</div>
                  <p className="text-sm text-[#5F8A87]">Pick any tool below to begin right away.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#5F8A87]">
                <span className="rounded-xl bg-white px-3 py-2 text-center">Social</span>
                <span className="rounded-xl bg-white px-3 py-2 text-center">Emotions</span>
              </div>
              <Link
                to="/asd/stories"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0D9488] text-sm font-bold text-white shadow-[3px_3px_0_#B2DFDB] transition-colors hover:bg-[#0F766E]"
              >
                Start a Story
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#134E4A]">
              Choose a Tool
            </h2>
            <p className="text-sm text-[#5F8A87]">
              Each tool is designed to be calm, clear, and supportive.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tools.map(({ to, icon: Icon, title, desc, accent, eyebrow }, index) => (
              <motion.div
                key={to}
                custom={index}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
              >
                <Link
                  to={to}
                  className="group block h-full overflow-hidden rounded-[1.5rem] border border-[#B2DFDB] bg-white shadow-[0_4px_12px_rgba(13,148,136,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(13,148,136,0.18)]"
                >
                  <div className={`h-28 bg-gradient-to-br ${accent} flex items-center justify-center`}>
                    <span className="text-4xl text-white/90" aria-hidden="true">
                      {index === 0 ? "📖" : index === 1 ? "😊" : index === 2 ? "💬" : "🗣️"}
                    </span>
                  </div>
                  <div className="p-5 space-y-2">
                    <span className="inline-block rounded-full bg-[#E0F5EE] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#0D9488]">
                      {eyebrow}
                    </span>
                    <h3 className="text-lg font-bold text-[#134E4A] group-hover:text-[#0D9488] transition-colors">
                      {title}
                    </h3>
                    <p className="text-sm text-[#5F8A87] leading-relaxed">{desc}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] group-hover:text-[#0F766E]">
                      Open Tool <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}

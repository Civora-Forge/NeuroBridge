import { Wind, Heart, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import AdaptiveAnxietyEngine from "@/components/anxiety/AdaptiveAnxietyEngine";

export default function AnxietyPage() {
  return (
    <SupportToolThemeProvider theme="anxiety_calm">
      <SupportToolLayout
        title="Calming Toolkit"
        description="Gentle, adaptive anxiety support — zero pressure, just calm."
      >
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden rounded-[2rem] border border-[#C7D2FE] bg-white/85 p-6 shadow-[0_20px_60px_rgba(79,107,246,0.10)] backdrop-blur md:p-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C7D2FE] bg-[#DDE8FC] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#4F6BF6]">
                <Sparkles className="h-3.5 w-3.5" />
                Anxiety Support Module
              </span>
              <h1 className="text-4xl font-black tracking-tight text-[#1E2A5E] sm:text-5xl">
                Breathe. Ground. Reset.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[#6B7BA8] sm:text-lg">
                NeuroBridge gently watches for signs of tension and offers calm, evidence-based exercises
                when you need them — never in the way, always ready.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#C7D2FE] bg-[#DDE8FC]/60 px-5 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#4F6BF6] shadow-sm">
                <Wind className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1E2A5E]">Passive & active</p>
                <p className="text-xs text-[#6B7BA8]">Works in the background, or start a reset now.</p>
              </div>
            </div>
          </div>
        </motion.section>

        <AdaptiveAnxietyEngine />
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}

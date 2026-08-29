import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen } from "lucide-react";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import SocialStoryBuilder from "@/components/asd/SocialStoryBuilder";
import { useASDData } from "@/hooks/useASDData";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

export default function ASDStoriesPage() {
  const asd = useASDData();
  const { reduced, gentle } = useSensoryReducedMotion();
  return (
    <SupportToolThemeProvider theme="asd_social">
      <SupportToolLayout
        title="Social Stories"
        description="Interactive illustrated stories with read-aloud for everyday situations."
      >
        <motion.header
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: gentle ? 0.3 : 0.45, ease: "easeOut" }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <Link
            to="/asd"
            className="inline-flex items-center gap-1.5 rounded-[10px] border-2 border-[#B2DFDB] bg-white px-3 py-2 text-sm font-bold text-[#5F8A87] shadow-[2px_2px_0_#D5F5EC] transition-colors hover:text-[#0D9488] hover:border-[#0D9488] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
          >
            <ArrowLeft className="w-4 h-4" /> Back to hub
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-black text-[#0D9488]">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#E0F5EE]"><BookOpen size={16} /></span>
            Stories are short, gentle guides for real situations.
          </span>
        </motion.header>
        <SocialStoryBuilder
          role={asd.role}
          stories={asd.stories}
          loading={asd.loading}
          learnerId={asd.targetWardId}
          onCreateStory={asd.createStory}
          onUpdateStory={asd.updateStory}
          onDeleteStory={asd.deleteStory}
        />
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
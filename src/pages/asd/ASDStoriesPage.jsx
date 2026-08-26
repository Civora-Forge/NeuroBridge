import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import SocialStoryBuilder from "@/components/asd/SocialStoryBuilder";
import { useASDData } from "@/hooks/useASDData";

export default function ASDStoriesPage() {
  const asd = useASDData();
  return (
    <SupportToolThemeProvider theme="asd_social">
      <SupportToolLayout
        title="Social Stories"
        description="Interactive story cards with read-aloud and visual illustrations."
      >
        <Link
          to="/asd"
          className="inline-flex items-center gap-1.5 text-sm text-[#5F8A87] hover:text-[#0D9488] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Social & Emotional Hub
        </Link>
        <SocialStoryBuilder
          role={asd.role}
          stories={asd.stories}
          loading={asd.loading}
          onCreateStory={asd.createStory}
          onUpdateStory={asd.updateStory}
          onDeleteStory={asd.deleteStory}
        />
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}

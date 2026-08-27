import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import EmotionDecoderCard from "@/components/asd/EmotionDecoderCard";

export default function ASDEmotionPage() {
  return (
    <SupportToolThemeProvider theme="asd_social">
      <SupportToolLayout
        title="Emotion Decoder"
        description="Recognise and express emotions with guided support."
      >
        <Link
          to="/asd"
          className="inline-flex items-center gap-1.5 text-sm text-[#5F8A87] hover:text-[#0D9488] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Social & Emotional Hub
        </Link>
        <EmotionDecoderCard />
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}

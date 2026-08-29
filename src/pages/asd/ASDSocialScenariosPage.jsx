import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import SocialScenarioSimulatorCard from "@/components/asd/SocialScenarioSimulatorCard";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

export default function ASDSocialScenariosPage() {
  const { reduced, gentle } = useSensoryReducedMotion();
  return (
    <SupportToolThemeProvider theme="asd_social">
      <SupportToolLayout
        title="Social Scenario Simulator"
        description="Step into one situation at a time and practise how you would respond."
      >
        <motion.header
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: gentle ? 0.3 : 0.45, ease: "easeOut" }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <Link
            to="/asd"
            className="inline-flex items-center gap-1.5 rounded-[10px] border-2 border-[#B2DFDB] bg-white px-3 py-2 text-sm font-bold text-[#5F8A87] shadow-[2px_2px_0_#D5F5EC] transition-colors hover:text-[#0D9488] hover:border-[#0D9488] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
          >
            <ArrowLeft className="w-4 h-4" /> Back to hub
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-black text-[#7C3AED]">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#EDE9FE] text-[#7C3AED]"><MessagesSquare size={16} /></span>
            You respond — the situation reacts to you.
          </span>
        </motion.header>
        <SocialScenarioSimulatorCard />
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
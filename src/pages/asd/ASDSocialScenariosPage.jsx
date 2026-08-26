import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import SocialScenarioSimulatorCard from "@/components/asd/SocialScenarioSimulatorCard";

export default function ASDSocialScenariosPage() {
  return (
    <SupportToolThemeProvider theme="asd_social">
      <SupportToolLayout
        title="Social Scenario Simulator"
        description="Practise responding to one situation at a time with gentle feedback."
      >
        <Link
          to="/asd"
          className="inline-flex items-center gap-1.5 text-sm text-[#5F8A87] hover:text-[#0D9488] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Social & Emotional Hub
        </Link>
        <SocialScenarioSimulatorCard />
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}

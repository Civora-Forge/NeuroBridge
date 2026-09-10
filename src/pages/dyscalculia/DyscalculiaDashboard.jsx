/**
 * Dyscalculia Dashboard
 *
 * There are no real number-sense exercises built yet (the previous version
 * of this screen showed tabs, a "0/0 completed" counter, and "+ Add custom
 * practice" / "+ New practice category" buttons with no click handlers —
 * a fully-styled dashboard for tools that don't exist, with dead buttons).
 * An honest "not built yet" screen is clearer and more trustworthy than a
 * dashboard that looks broken. When real tools exist, use concrete/visual
 * number representations here (number lines, grouped dots, step-by-step
 * worked examples) rather than raw digits or equations — see
 * docs/redesign-research.md.
 */
import { Calculator } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function DyscalculiaDashboard() {
  return (
    <ComingSoon
      title="Number Confidence"
      subtitle="Dyscalculia support"
      description="Visual, step-by-step number tools — number lines, grouped quantities, and worked examples instead of bare equations."
      color="bg-mode-dyscalculia"
      icon={<Calculator className="w-12 h-12 text-primary-foreground" />}
    />
  );
}

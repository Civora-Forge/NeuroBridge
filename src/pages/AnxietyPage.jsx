import { Wind, BookOpen, Activity, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import AdaptiveAnxietyEngine from "@/components/anxiety/AdaptiveAnxietyEngine";

export default function AnxietyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/30 p-4 sm:p-8">
      <AdaptiveAnxietyEngine />
    </div>
  );
}

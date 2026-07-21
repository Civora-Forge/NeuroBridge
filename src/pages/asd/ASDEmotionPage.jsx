import { Link } from "react-router-dom";
import EmotionCards from "@/components/asd/EmotionCards";
import { ArrowLeft } from "lucide-react";

export default function ASDEmotionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/20">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>
        <EmotionCards />
      </div>
    </div>
  );
}
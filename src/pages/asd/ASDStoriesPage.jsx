import { Link } from "react-router-dom";
import SocialStoryBuilder from "@/components/asd/SocialStoryBuilder";
import { useASDData } from "@/hooks/useASDData";
import { ArrowLeft } from "lucide-react";

export default function ASDStoriesPage() {
  const asd = useASDData();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/20">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/asd" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Sensory & Social Hub
        </Link>
        <SocialStoryBuilder
          role={asd.role}
          stories={asd.stories}
          loading={asd.loading}
          onCreateStory={asd.createStory}
          onUpdateStory={asd.updateStory}
          onDeleteStory={asd.deleteStory}
        />
      </div>
    </div>
  );
}
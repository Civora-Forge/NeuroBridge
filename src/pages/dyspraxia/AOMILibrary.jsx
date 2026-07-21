import { Link } from "react-router-dom";
import { ArrowLeft, Play, Eye } from "lucide-react";
const videos = [
    {
        id: "1",
        title: "Tying Shoe Laces",
        description: "First-person view of the bunny-ear method, broken into 6 micro-steps.",
        duration: "3:45",
        difficulty: "Beginner",
    },
    {
        id: "2",
        title: "Using Cutlery (Fork & Knife)",
        description: "First-person perspective on holding and cutting with proper grip angles.",
        duration: "4:20",
        difficulty: "Beginner",
    },
    {
        id: "3",
        title: "Buttoning a Shirt",
        description: "Close-up first-person guide to aligning and pushing buttons through holes.",
        duration: "2:50",
        difficulty: "Intermediate",
    },
    {
        id: "4",
        title: "Handwriting Grip",
        description: "Motor imagery exercise for the dynamic tripod grip with pen positioning.",
        duration: "5:10",
        difficulty: "Beginner",
    },
];
export default function AOMILibrary() {
    return (<div className="animate-fade-in">
      <Link to="/dyspraxia" className="dyspraxia-btn min-h-[56px] bg-transparent border-2 border-border text-sm mb-6 gap-2 inline-flex px-4">
        <ArrowLeft className="w-5 h-5"/>
        Back to CoordiMate
      </Link>

      <h1 className="section-title mb-1">AOMI First-Person Library</h1>
      <p className="section-subtitle mb-2">
        Action Observation + Motor Imagery — watch tasks from your perspective.
      </p>
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Eye className="w-4 h-4 text-mode-dyspraxia"/>
        <span className="text-muted-foreground">All videos are in first-person POV for optimal motor learning</span>
      </div>

      <div className="flex flex-col gap-4">
        {videos.map((v) => (<div key={v.id} className="neuro-card flex flex-col sm:flex-row gap-4">
            {/* Video placeholder */}
            <div className="w-full sm:w-64 h-40 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-mode-dyspraxia/20 flex items-center justify-center mx-auto mb-2">
                  <Play className="w-6 h-6 text-mode-dyspraxia ml-1"/>
                </div>
                <p className="text-xs text-muted-foreground">1st Person POV</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <h3 className="text-lg font-bold mb-1">{v.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">{v.description}</p>
              <div className="flex gap-3 items-center">
                <span className="text-xs font-semibold bg-secondary px-3 py-1 rounded-full">{v.duration}</span>
                <span className="text-xs font-semibold bg-mode-dyspraxia/10 text-mode-dyspraxia px-3 py-1 rounded-full">{v.difficulty}</span>
              </div>
            </div>
          </div>))}
      </div>
    </div>);
}

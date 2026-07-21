import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, MoveRight } from "lucide-react";
const tasks = [
    {
        title: "Tying Shoe Laces",
        steps: [
            { instruction: "Place both laces flat, one in each hand", icon: "🤲", detail: "Hold near the shoe, thumbs on top" },
            { instruction: "Cross right lace over left lace", icon: "✖️", detail: "Make an X shape in front of you" },
            { instruction: "Loop the right lace under and pull tight", icon: "🔄", detail: "Pull both ends outward firmly" },
            { instruction: "Make a loop ('bunny ear') with the right lace", icon: "👂", detail: "Pinch the loop with your right thumb and finger" },
            { instruction: "Wrap the left lace around the loop", icon: "🔁", detail: "Go around the front of the loop" },
            { instruction: "Push the left lace through the hole and pull both loops", icon: "✅", detail: "You've made a bow!" },
        ],
    },
    {
        title: "Using Cutlery",
        steps: [
            { instruction: "Pick up the fork in your left hand", icon: "🍴", detail: "Hold it like a pencil, prongs pointing down" },
            { instruction: "Pick up the knife in your right hand", icon: "🔪", detail: "Index finger on the back of the blade" },
            { instruction: "Press the fork into the food to hold it steady", icon: "📌", detail: "Push straight down, don't angle" },
            { instruction: "Saw gently with the knife, moving back and forth", icon: "↔️", detail: "Keep the knife at a slight angle" },
            { instruction: "Lift the food to your mouth with the fork", icon: "😋", detail: "Keep your elbow close to your body" },
        ],
    },
];
export default function ARInstructionCards() {
    const [taskIdx, setTaskIdx] = useState(0);
    const [stepIdx, setStepIdx] = useState(0);
    const task = tasks[taskIdx];
    const step = task.steps[stepIdx];
    return (<div className="animate-fade-in">
      <Link to="/dyspraxia" className="dyspraxia-btn min-h-[56px] bg-transparent border-2 border-border text-sm mb-6 gap-2 inline-flex px-4">
        <ArrowLeft className="w-5 h-5"/>
        Back to CoordiMate
      </Link>

      <h1 className="section-title mb-1">AR Instruction Cards</h1>
      <p className="section-subtitle mb-6">Step-by-step visual guides with clear icons and directions.</p>

      {/* Task selector */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {tasks.map((t, i) => (<button key={t.title} className={`dyspraxia-btn min-h-[56px] px-5 text-sm ${taskIdx === i ? "bg-mode-dyspraxia text-primary-foreground" : "bg-secondary"}`} onClick={() => {
                setTaskIdx(i);
                setStepIdx(0);
            }}>
            {t.title}
          </button>))}
      </div>

      {/* Instruction card */}
      <div className="max-w-lg mx-auto">
        <div className="neuro-card text-center p-8">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Step {stepIdx + 1} of {task.steps.length}
          </p>
          <div className="text-6xl mb-4">{step.icon}</div>
          <h2 className="text-xl font-bold mb-2">{step.instruction}</h2>
          <p className="text-muted-foreground mb-2">{step.detail}</p>

          {/* Arrow indicator */}
          <div className="flex items-center justify-center gap-2 text-mode-dyspraxia mt-4 mb-6">
            <MoveRight className="w-6 h-6 animate-pulse-soft"/>
            <span className="text-sm font-semibold">Follow the movement</span>
          </div>

          {/* Progress */}
          <div className="flex gap-1 justify-center mb-6">
            {task.steps.map((_, i) => (<div key={i} className={`h-2 rounded-full transition-all ${i === stepIdx ? "w-8 bg-mode-dyspraxia" : i < stepIdx ? "w-4 bg-success" : "w-4 bg-secondary"}`}/>))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-4">
          <button className="dyspraxia-btn flex-1 bg-secondary gap-2" disabled={stepIdx === 0} onClick={() => setStepIdx((s) => s - 1)}>
            <ChevronLeft className="w-5 h-5"/>
            Previous
          </button>
          <button className="dyspraxia-btn flex-1 bg-mode-dyspraxia text-primary-foreground gap-2" disabled={stepIdx === task.steps.length - 1} onClick={() => setStepIdx((s) => s + 1)}>
            Next
            <ChevronRight className="w-5 h-5"/>
          </button>
        </div>
      </div>
    </div>);
}

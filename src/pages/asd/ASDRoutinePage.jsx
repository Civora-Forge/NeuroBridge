import { Link } from "react-router-dom";
import RoutineVisualizer from "@/components/asd/RoutineVisualizer";
import { useASDData } from "@/hooks/useASDData";
import { ArrowLeft } from "lucide-react";

export default function ASDRoutinePage() {
  const asd = useASDData();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/20">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link
          to="/asd"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Social & Emotional Support Hub
        </Link>
        <RoutineVisualizer
          role={asd.role}
          canManageRoutine={asd.canEditRoutine}
          routines={asd.routines}
          loading={asd.loading}
          onAddTask={asd.addRoutineTask}
          onToggleTask={asd.toggleTaskCompletion}
          onEditTask={asd.editRoutineTask}
          onDeleteTask={asd.deleteRoutineTask}
        />
      </div>
    </div>
  );
}

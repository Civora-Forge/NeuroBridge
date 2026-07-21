import { Link } from "react-router-dom";
import { Clock, Timer, Brain, Activity, Leaf, BookOpen, Calculator, Shield, Hand, Ear, Zap, Headphones, Mic, PenTool, User, Map, BarChart2, Wind, Smile, MessageCircle } from "lucide-react";

const ICONS = {
  Clock, Timer, Brain, Activity, Leaf, BookOpen, Calculator, Shield,
  Hand, Ear, Zap, Headphones, Mic, PenTool, User, Map, BarChart2, Wind, Smile, MessageCircle,
};

export default function ModuleCard({ title, description, icon = "Activity", launchRoute = "/" }) {
  const Icon = ICONS[icon] || Activity;

  return (
    <div className="group relative bg-white border border-green-100 rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:shadow-[0_10px_30px_rgba(34,197,94,0.18)] hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-green-100/50 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-50 to-teal-50 border border-green-100 flex items-center justify-center text-green-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 group-hover:text-green-700 transition-colors">{title}</h3>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <Link
        to={launchRoute}
        className="mt-auto inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-green-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:from-green-600 hover:to-teal-600 transition-all w-fit"
      >
        Open Tool →
      </Link>
    </div>
  );
}


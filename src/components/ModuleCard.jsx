import { Link } from "react-router-dom";
import { Clock, Timer, Brain, Activity, Leaf, BookOpen, Calculator, Shield, Hand, Ear, Zap, Headphones, Mic, PenTool, User, Map, BarChart2, Wind, Smile, MessageCircle, MessagesSquare } from "lucide-react";
import { getModeKeyForRoute, modeStyles } from "@/lib/moduleColor";

const ICONS = {
  Clock, Timer, Brain, Activity, Leaf, BookOpen, Calculator, Shield,
  Hand, Ear, Zap, Headphones, Mic, PenTool, User, Map, BarChart2, Wind, Smile, MessageCircle,
  MessagesSquare,
};

export default function ModuleCard({ title, description, icon = "Activity", launchRoute = "/" }) {
  const Icon = ICONS[icon] || Activity;
  const c = modeStyles(getModeKeyForRoute(launchRoute));

  return (
    <div className="group relative bg-card border rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden" style={c.borderSoft}>
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" style={c.bgSoft} aria-hidden="true" />
      <div className="w-11 h-11 rounded-xl border flex items-center justify-center" style={{ ...c.bgSoft, ...c.borderSoft, ...c.text }}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <Link
        to={launchRoute}
        aria-label={`Open ${title}`}
        className="mt-auto inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:opacity-90 transition-all w-fit"
        style={c.bg}
      >
        Open <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}


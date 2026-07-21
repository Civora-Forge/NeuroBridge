import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
export default function ComingSoon({ title, subtitle, description, color, icon }) {
    return (<div className="animate-fade-in">
      <Link to="/" className="neuro-btn-ghost text-sm mb-6 gap-2 inline-flex min-h-0 py-2 px-3">
        <ArrowLeft className="w-4 h-4"/>
        Back to Modes
      </Link>

      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className={`w-24 h-24 rounded-3xl ${color} flex items-center justify-center mb-6`}>
          {icon}
        </div>
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-lg text-primary font-semibold mb-4">{subtitle}</p>
        <div className="neuro-card max-w-lg mx-auto">
          <p className="text-base font-semibold mb-2">Module Coming Soon</p>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>);
}

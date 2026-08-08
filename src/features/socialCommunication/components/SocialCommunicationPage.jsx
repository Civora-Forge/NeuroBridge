import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquareHeart, Volume2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSocialCommunication, COMMUNICATION_VIEWS } from "../hooks/useSocialCommunication";
import ActivitySetup from "./ActivitySetup";
import ScenarioBrief from "./ScenarioBrief";
import ConversationView from "./ConversationView";
import FeedbackView from "./FeedbackView";
import SessionSummaryView from "./SessionSummaryView";
import HistoryView from "./HistoryView";

export default function SocialCommunicationPage() {
  const engine = useSocialCommunication();

  const content = (() => {
    switch (engine.view) {
      case COMMUNICATION_VIEWS.BRIEF:
        return <ScenarioBrief engine={engine} />;
      case COMMUNICATION_VIEWS.CONVERSATION:
        return <ConversationView engine={engine} />;
      case COMMUNICATION_VIEWS.FEEDBACK:
        return <FeedbackView engine={engine} />;
      case COMMUNICATION_VIEWS.SUMMARY:
        return <SessionSummaryView engine={engine} />;
      case COMMUNICATION_VIEWS.HISTORY:
        return <HistoryView engine={engine} />;
      default:
        return <ActivitySetup engine={engine} />;
    }
  })();

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-cyan-50/40 ${
        engine.a11y.reduceMotion ? "[&_*]:transition-none" : ""
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label="Back to home"
              className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-violet-600 hover:border-violet-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className={`font-black text-slate-900 ${engine.a11y.largeText ? "text-2xl" : "text-xl"}`}>
                Conversation Practice
              </h1>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" /> Speak or type — your way.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="a11y-large" className="text-xs text-slate-600">Large text</Label>
              <Switch
                id="a11y-large"
                checked={engine.a11y.largeText}
                onCheckedChange={(checked) => engine.updateA11y({ largeText: checked })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="a11y-motion" className="text-xs text-slate-600">Reduce motion</Label>
              <Switch
                id="a11y-motion"
                checked={engine.a11y.reduceMotion}
                onCheckedChange={(checked) => engine.updateA11y({ reduceMotion: checked })}
              />
            </div>
          </div>
        </header>

        {engine.aiUnavailable && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Online scenario generation is unavailable right now — using a built-in practice
            scenario instead. Everything else works the same.
          </div>
        )}

        <main className="flex items-start justify-center">{content}</main>
      </div>
    </div>
  );
}

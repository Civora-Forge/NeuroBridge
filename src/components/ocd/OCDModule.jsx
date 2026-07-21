/**
 * OCDModule.jsx — OCD Self-Management Shell
 *
 * 5 ERP-aligned tabs sharing state via ocdStore (localStorage).
 * Imports the production rebuilds of all 5 components.
 * Clinical disclaimer shown at bottom.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListChecks, BookOpen, Target, Leaf, BarChart2, ShieldAlert } from "lucide-react";
import ERPTracker from "./ERPTracker";
import ThoughtTriggerJournal from "./ThoughtTriggerJournal";
import ResponsePreventionGoals from "./ResponsePreventionGoals";
import MindfulnessInterruptions from "./MindfulnessInterruptions";
import SymptomDashboard from "./SymptomDashboard";

const TABS = [
  { key: "erp",        label: "ERP Tracker",   icon: ListChecks, short: "ERP" },
  { key: "journal",    label: "Thought Journal",icon: BookOpen,   short: "Journal"  },
  { key: "goals",      label: "Goals",          icon: Target,     short: "Goals"    },
  { key: "mindful",    label: "Mindfulness",    icon: Leaf,       short: "Mindful"  },
  { key: "dashboard",  label: "Dashboard",      icon: BarChart2,  short: "Stats"    },
];

export default function OCDModule() {
  const [activeTab, setActiveTab] = useState("erp");
  // Lightweight cross-tab event counter — any component can "nudge" the dashboard
  const [dashTrigger, setDashTrigger] = useState(0);

  const handleDataEvent = () => setDashTrigger((n) => n + 1);

  return (
    <div className="flex flex-col min-h-0 space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                active ? "bg-teal-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="flex-1"
        >
          {activeTab === "erp" && (
            <ERPTracker onSessionLogged={handleDataEvent} />
          )}
          {activeTab === "journal" && (
            <ThoughtTriggerJournal onEntryAdded={handleDataEvent} onNavigateTo={setActiveTab} />
          )}
          {activeTab === "goals" && (
            <ResponsePreventionGoals onGoalCompleted={handleDataEvent} />
          )}
          {activeTab === "mindful" && (
            <MindfulnessInterruptions onSessionComplete={handleDataEvent} />
          )}
          {activeTab === "dashboard" && (
            <SymptomDashboard key={dashTrigger} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Clinical disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <ShieldAlert size={12} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          This tool supports ERP practice between therapy sessions. It does not replace clinical care.
          If you are in distress, contact your therapist or a crisis line.
        </p>
      </div>
    </div>
  );
}

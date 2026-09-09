import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ModuleCard from "@/components/ModuleCard";
import { composeHomeModules } from "@/data/modulesRegistry";
import { getLastVisitedModule } from "@/lib/lastVisitedModule";
import EmptyState from "@/components/EmptyState";

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — older than that isn't "where you left off"

export default function Home() {
  const { user, enabledModules, enabledFeatures } = useAuth();

  const modules = useMemo(
    () => composeHomeModules([...enabledModules, ...enabledFeatures]),
    [enabledModules, enabledFeatures],
  );

  // One transparent rule, not a black-box recommendation: prefer resuming
  // whatever the user actually opened most recently; otherwise suggest the
  // first module in their own list. No hidden scoring.
  const { nextAction, isResuming } = useMemo(() => {
    if (modules.length === 0) return { nextAction: null, isResuming: false };
    const lastVisit = getLastVisitedModule();
    if (lastVisit && Date.now() - lastVisit.at < RECENT_WINDOW_MS) {
      const match = modules.find((m) => m.id === lastVisit.moduleId);
      if (match) return { nextAction: match, isResuming: true };
    }
    return { nextAction: modules[0], isResuming: false };
  }, [modules]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/20 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-md">
              <span className="text-white text-lg">👋</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Good to see you{user?.name ? `, ${user.name}` : ""}
              </h1>
              <p className="text-sm text-slate-500">Here's a good place to start.</p>
            </div>
          </div>
          <div className="h-1 w-16 rounded-full bg-gradient-to-r from-green-400 to-teal-400 mt-3" />
        </header>

        {modules.length === 0 ? (
          <EmptyState
            title="No tools enabled yet"
            description="Complete onboarding to build your toolkit."
          />
        ) : (
          <>
            {/* One clear next step — not a menu, a suggestion. */}
            <section className="mb-10">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {isResuming ? "Continue where you left off" : "A good place to start"}
              </p>
              <Link
                to={nextAction.launchRoute}
                className="group relative flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-green-500 to-teal-500 p-6 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div>
                  <h2 className="text-xl font-bold text-white">{nextAction.title}</h2>
                  <p className="text-sm text-white/90 mt-1">{nextAction.description}</p>
                </div>
                <ArrowRight className="w-6 h-6 text-white flex-shrink-0 group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className="text-xs text-slate-400 mt-2">
                {isResuming
                  ? "Because you opened this in the last two weeks — not a recommendation, just where you left off."
                  : "Because it's first in your toolkit — not a personalized pick."}
              </p>
            </section>

            {/* Everything else stays fully discoverable, just secondary. */}
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Your support areas
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modules.map((module) => (
                  <ModuleCard
                    key={module.id}
                    title={module.title}
                    description={module.description}
                    icon={module.icon}
                    launchRoute={module.launchRoute}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

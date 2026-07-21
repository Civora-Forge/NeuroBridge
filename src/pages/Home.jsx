import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import ModuleCard from "@/components/ModuleCard";
import { MODULES_REGISTRY } from "@/data/modulesRegistry";

export default function Home() {
  const { user, enabledModules } = useAuth();

  const modules = useMemo(
    () => (enabledModules || []).map((moduleId) => MODULES_REGISTRY[moduleId]).filter(Boolean),
    [enabledModules],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/20 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-md">
              <span className="text-white text-lg">👋</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Welcome back{user?.name ? `, ${user.name}` : ""}
              </h1>
              <p className="text-sm text-slate-500">Your personalized support tools are ready below.</p>
            </div>
          </div>
          <div className="h-1 w-16 rounded-full bg-gradient-to-r from-green-400 to-teal-400 mt-3" />
        </header>

        {modules.length === 0 ? (
          <div className="rounded-2xl border border-green-100 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">No tools enabled yet. Complete onboarding to build your toolkit.</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}


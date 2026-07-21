import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { MODULES_REGISTRY } from "@/data/modulesRegistry";

export default function ToolWorkspace() {
  const { moduleId } = useParams();

  const module = useMemo(() => {
    const decoded = decodeURIComponent(moduleId || "");
    return MODULES_REGISTRY[decoded] || null;
  }, [moduleId]);

  if (!module) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">This tool is not available in your current plan.</p>
        </div>
      </div>
    );
  }

  return <Navigate to={module.launchRoute || "/"} replace />;
}

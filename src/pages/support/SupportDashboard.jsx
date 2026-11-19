import { Card } from "@/components/ui/card";
import { ShieldCheck, Users } from "lucide-react";

export default function SupportDashboard() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Support Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Consent-based support data will appear here when a care recipient is securely connected.</p>
      </header>

      <Card className="border-amber-200 bg-amber-50 p-5 text-amber-950">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" /> No live recipient data connected</div>
        <p className="mt-2 text-sm">
          This prototype does not yet have a production care-recipient linking and consent workflow. Trend, check-in, and alert values are intentionally unavailable rather than simulated.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["Emotional Trend", "No consented data"],
          ["Weekly Check-ins", "No consented data"],
          ["Active Alerts", "No consented data"],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 text-slate-600"><Users className="h-4 w-4" /> {label}</div>
            <p className="mt-3 text-lg font-semibold text-slate-500">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Next safe step</h2>
        <p className="mt-2 text-sm text-slate-600">
          Connect this view only after implementing user-scoped consent, support-person authorization, and server-side access controls. Do not use this screen for clinical monitoring or emergency response.
        </p>
      </Card>
    </div>
  );
}

import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Brain, Zap, BookOpen, Calculator, Shield, Hand, Ear, Sparkles,
  Home, ArrowLeftRight, User, Settings, ShieldCheck, LogOut, Heart, Wind,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { FEATURES } from "@/lib/featureRegistry";

// featureKey: null means always visible (Home)
const USER_NAV = [
  { title: "Home",        path: "/",            icon: Home,       featureKey: null },
  { title: "Sensory Balance",  path: "/asd",         icon: Brain,      featureKey: FEATURES.ASD },
  { title: "Focus Flow",       path: "/adhd",        icon: Zap,        featureKey: FEATURES.ADHD },
  { title: "Reading Support",  path: "/dyslexia",    icon: BookOpen,   featureKey: FEATURES.DYSLEXIA },
  { title: "Number Confidence",path: "/dyscalculia", icon: Calculator, featureKey: FEATURES.DYSCALCULIA },
  { title: "Exposure Practice",path: "/ocd",         icon: Shield,     featureKey: FEATURES.OCD },
  { title: "Motor Planning",   path: "/dyspraxia",   icon: Hand,       featureKey: FEATURES.DYSPRAXIA },
  { title: "Audio Clarity",    path: "/apd",         icon: Ear,        featureKey: FEATURES.APD },
  { title: "Calming Toolkit",  path: "/anxiety",     icon: Wind,       featureKey: FEATURES.ANXIETY },
  { title: "Daily Momentum",   path: "/depression",  icon: Sparkles,   featureKey: FEATURES.DEPRESSION },
];

const SUPPORT_NAV = [
  { title: "Support",   path: "/support-dashboard",   icon: ShieldCheck },
];

const GUARDIAN_NAV = [
  { title: "Care-Circle", path: "/guardian-dashboard", icon: Heart },
];

export default function AppLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, isAuthenticated, logout, hasFeature } = useAuth();

  // For regular users: show Home always + any module they have enabled.
  // Support and guardians have fixed, role-specific navs.
  const navItems =
    role === "support"
      ? SUPPORT_NAV
      : role === "guardian"
      ? GUARDIAN_NAV
      : USER_NAV.filter((item) => item.featureKey === null || hasFeature(item.featureKey));

  function handleLogout() {
    logout();
    navigate("/login-user");
  }

  if (role === "user") {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <header className="border-b border-green-100 bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-green-600" />
              <span className="text-sm font-semibold text-slate-900">NeuroBridge</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/settings" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                <Settings className="h-4 w-4" />
              </Link>
              <button onClick={handleLogout} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* ── Sidebar (desktop) ─────────────────── */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card p-4 gap-2 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-3 px-3 py-4 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">NeuroBridge</span>
        </div>

        {/* User identity card */}
        {isAuthenticated && user ? (
          <Link
            to={role === "support" ? "/support-dashboard" : role === "guardian" ? "/guardian-dashboard" : "/settings"}
            className="neuro-card p-3 mb-4 flex items-center gap-3 hover:bg-secondary transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              {role === "support"
                ? <ShieldCheck className="w-4 h-4 text-amber-500" />                : role === "guardian"
                ? <Heart className="w-4 h-4 text-violet-500" />                : <User className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.abhaId ?? (role === "support" ? "Support" : "No ABHA linked")}
              </p>
            </div>
          </Link>
        ) : (
          <div className="neuro-card p-3 mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Not signed in</p>
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-1 mt-2">
          {role === "user" && (
            <Link to="/settings" className="neuro-btn-outline text-sm gap-2">
              <Settings className="w-4 h-4" /> Settings
            </Link>
          )}
          {isAuthenticated ? (
            <button onClick={handleLogout} className="neuro-btn-outline text-sm gap-2">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          ) : (
            <Link to="/login" className="neuro-btn-outline text-sm gap-2">
              <User className="w-4 h-4" /> Sign in
            </Link>
          )}
          {role === "user" && (
            <Link to="/" className="neuro-btn-outline text-sm gap-2 mt-1">
              <ArrowLeftRight className="w-4 h-4" /> Switch Mode
            </Link>
          )}
        </div>
      </aside>

      {/* ── Mobile top bar ─────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between border-b border-border bg-card px-4 py-3 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">NeuroBridge</span>
          </div>
          <div className="flex items-center gap-2">
            {role === "user" && (
              <Link to="/settings" className="neuro-btn-ghost text-sm py-2 px-3 min-h-0 gap-1">
                <Settings className="w-4 h-4" />
              </Link>
            )}
            {isAuthenticated ? (
              <button onClick={handleLogout} className="neuro-btn-ghost text-sm py-2 px-3 min-h-0 gap-1">
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link to="/login" className="neuro-btn-ghost text-sm py-2 px-3 min-h-0 gap-1">
                <User className="w-4 h-4" />
              </Link>
            )}
            {role === "user" && (
              <Link to="/" className="neuro-btn-ghost text-sm py-2 px-3 min-h-0 gap-1">
                <ArrowLeftRight className="w-4 h-4" /> Modes
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

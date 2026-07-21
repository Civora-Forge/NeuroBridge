import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, ShieldCheck, Activity, CheckCircle2, Clock, XCircle,
  LogOut, ChevronRight, Search, Badge,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
//  Mock data
// ─────────────────────────────────────────────
const MOCK_USERS = [
  { id: "nb-001", name: "Arun Kumar",      email: "arun@nb.in",   abhaStatus: "verified",  profile: "OCD",         lastActive: "2 hrs ago",  ashaWorker: false },
  { id: "nb-002", name: "Meera Pillai",    email: "meera@nb.in",  abhaStatus: "pending",   profile: "Dyslexia",    lastActive: "1 day ago",  ashaWorker: false },
  { id: "nb-003", name: "Ravi Shankar",    email: "ravi@nb.in",   abhaStatus: "verified",  profile: "ADHD",        lastActive: "3 hrs ago",  ashaWorker: false },
  { id: "nb-004", name: "Ananya Thomas",   email: "anya@nb.in",   abhaStatus: "unverified",profile: "Dyspraxia",   lastActive: "5 days ago", ashaWorker: false },
  { id: "nb-005", name: "Vishnu Nambiar",  email: "vish@nb.in",   abhaStatus: "pending",   profile: "ASD",         lastActive: "1 hr ago",   ashaWorker: false },
  { id: "nb-006", name: "Lakshmi Iyer",    email: "laksh@nb.in",  abhaStatus: "verified",  profile: "Anxiety",     lastActive: "30 min ago", ashaWorker: false },
  { id: "nb-007", name: "Kiran Das",       email: "kiran@nb.in",  abhaStatus: "unverified",profile: "Dyscalculia", lastActive: "2 days ago", ashaWorker: false },
  { id: "nb-008", name: "Sindhu Gopalan",  email: "sindhu@nb.in", abhaStatus: "verified",  profile: "Depression",  lastActive: "4 hrs ago",  ashaWorker: false },
];

const ASHA_WORKERS = [
  { id: "asha-001", name: "Geetha Menon",   district: "Thrissur",   users: 14, status: "approved",  phone: "+91-94470-XXXXX" },
  { id: "asha-002", name: "Parvathy Krishnan", district: "Palakkad", users: 9,  status: "pending",   phone: "+91-98470-XXXXX" },
  { id: "asha-003", name: "Suja Varghese",  district: "Kottayam",   users: 21, status: "approved",  phone: "+91-97440-XXXXX" },
  { id: "asha-004", name: "Bindhu Mohan",   district: "Kozhikode",  users: 6,  status: "pending",   phone: "+91-99470-XXXXX" },
];

const CHART_DATA = [
  { name: "ASD",         users: 47, fill: "#6366f1" },
  { name: "ADHD",        users: 83, fill: "#f59e0b" },
  { name: "Dyslexia",    users: 61, fill: "#10b981" },
  { name: "Dyscalculia", users: 29, fill: "#ec4899" },
  { name: "OCD",         users: 54, fill: "#8b5cf6" },
  { name: "Dyspraxia",   users: 38, fill: "#06b6d4" },
  { name: "Anxiety",     users: 72, fill: "#f97316" },
  { name: "Depression",  users: 18, fill: "#84cc16" },
];

const STATUS_BADGE = {
  verified:   { label: "Verified",   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  pending:    { label: "Pending",    cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  unverified: { label: "Unverified", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const ASHA_STATUS = {
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-400", icon: CheckCircle2 },
  pending:  { label: "Pending",  cls: "bg-amber-500/15 text-amber-400",      icon: Clock },
};

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="neuro-card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">{children}</h2>;
}

// ─────────────────────────────────────────────
//  AdminDashboard
// ─────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [ashaWorkers, setAshaWorkers] = useState(ASHA_WORKERS);
  const [activeTab, setActiveTab] = useState("overview");

  const filteredUsers = MOCK_USERS.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.profile.toLowerCase().includes(search.toLowerCase()),
  );

  function approveAsha(id) {
    setAshaWorkers((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: "approved" } : w)),
    );
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const tabs = ["overview", "users", "asha-portal"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Signed in as <span className="text-foreground font-medium">{user?.name}</span>
            &nbsp;&mdash;&nbsp;{user?.designation}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="neuro-btn-outline flex items-center gap-2 text-sm"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors ${
              activeTab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────── */}
      {activeTab === "overview" && (
        <motion.div
          key="overview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users}       label="Total Users"     value="402"  color="bg-primary/15 text-primary" />
            <StatCard icon={ShieldCheck} label="ABHA Verified"   value="318"  color="bg-emerald-500/15 text-emerald-500" />
            <StatCard icon={Activity}    label="Active Today"    value="74"   color="bg-amber-500/15 text-amber-500" />
            <StatCard icon={Users}       label="ASHA Workers"    value="4"    color="bg-violet-500/15 text-violet-500" />
          </div>

          {/* Bar chart */}
          <div className="neuro-card p-6">
            <SectionTitle><Activity className="w-4 h-4 text-primary" /> User Distribution by Neuro-Category</SectionTitle>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={CHART_DATA} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="users" radius={[6, 6, 0, 0]}>
                  {CHART_DATA.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* ── USERS ───────────────────────────────── */}
      {activeTab === "users" && (
        <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or profile…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Table */}
          <div className="neuro-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">ABHA Status</th>
                  <th className="px-4 py-3 font-medium">Neuro-Profile</th>
                  <th className="px-4 py-3 font-medium">Last Active</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => {
                  const badge = STATUS_BADGE[u.abhaStatus];
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                          {u.profile}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.lastActive}</td>
                      <td className="px-4 py-3">
                        <button className="text-muted-foreground hover:text-foreground transition">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── ASHA WORKER PORTAL ───────────────────── */}
      {activeTab === "asha-portal" && (
        <motion.div key="asha" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="neuro-card p-5 border-l-4 border-l-emerald-500 bg-emerald-500/5">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              ASHA Worker Verification — Rural Kerala Programme
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ASHA workers verified here gain access to a simplified field dashboard to assist registered users in low-connectivity districts.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ashaWorkers.map((w, i) => {
              const s = ASHA_STATUS[w.status];
              const Icon = s.icon;
              return (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="neuro-card p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.district} District &bull; {w.phone}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
                      <Icon className="w-3 h-3" />{s.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Manages</span>
                    <span className="text-xs font-semibold">{w.users} users</span>
                  </div>
                  {w.status === "pending" && (
                    <button
                      onClick={() => approveAsha(w.id)}
                      className="neuro-btn w-full text-sm mt-1 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve Worker
                    </button>
                  )}
                  {w.status === "approved" && (
                    <button className="neuro-btn-outline w-full text-sm mt-1 flex items-center justify-center gap-2 opacity-60 cursor-default">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Approved
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

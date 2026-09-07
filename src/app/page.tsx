"use client";

import { useEffect, useState, useMemo } from "react";
import { JVCLogo } from "@/components/JVCLogo";
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  RefreshCw,
  Play,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  QrCode,
  Search,
  MapPin,
  Building2,
  Phone,
  UserCheck,
  XCircle,
  FolderOpen,
  Settings2,
  Sliders,
  Send,
  LogOut,
  Calendar,
  Sparkles,
} from "lucide-react";
import { JVCMember } from "@/lib/supabase";

export const JVC_HUBS = [
  { id: "all", name: "All Hubs", flag: "🇪🇺", city: "All Europe" },
  { id: "paris", name: "Paris", flag: "🇫🇷", city: "Paris" },
  { id: "milan", name: "Milan", flag: "🇮🇹", city: "Milan" },
  { id: "london", name: "London", flag: "🇬🇧", city: "London" },
  { id: "berlin", name: "Berlin", flag: "🇩🇪", city: "Berlin" },
  { id: "munich", name: "Munich", flag: "🇩🇪", city: "Munich" },
  { id: "zurich", name: "Zurich", flag: "🇨🇭", city: "Zurich" },
  { id: "madrid", name: "Madrid", flag: "🇪🇸", city: "Madrid" },
  { id: "stockholm", name: "Stockholm", flag: "🇸🇪", city: "Stockholm" },
  { id: "amsterdam", name: "Amsterdam", flag: "🇳🇱", city: "Amsterdam" },
];

function formatAppliedDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr || "—";
  }
}

export default function AdminControlRoom() {
  const [members, setMembers] = useState<JVCMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHub, setSelectedHub] = useState<string>("all");
  const [activeStatusTab, setActiveStatusTab] = useState<
    "all" | "active_member" | "pending_review" | "removed_churned" | "rejected" | "flagged_manual"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [runningCheck, setRunningCheck] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [runLog, setRunLog] = useState<any | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);

  // WhatsApp bot status
  const [waStatus, setWaStatus] = useState<{
    status: string;
    phoneNumber: string | null;
    qrCodeDataUrl: string | null;
  }>({ status: "disconnected", phoneNumber: null, qrCodeDataUrl: null });

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/members");
      if (res.ok) {
        const data = await res.json();
        const memberList = data.members || [];
        setMembers(memberList);

        // Auto-analyze unverified profiles upon entering the dashboard
        const unanalyzed = memberList.filter((m: JVCMember) => !m.ai_evaluation);
        if (unanalyzed.length > 0 && !analyzingAll) {
          fetch("/api/admin/analyze-all", { method: "POST" })
            .then((r) => r.json())
            .then((resData) => {
              if (resData.evaluatedCount > 0) {
                fetch("/api/admin/members")
                  .then((r) => r.json())
                  .then((d) => setMembers(d.members || []))
                  .catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerAutoAnalyzeAll = async () => {
    setAnalyzingAll(true);
    try {
      const res = await fetch("/api/admin/analyze-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await fetchMembers();
      } else {
        alert("AI Analysis notice: " + (data.error || "Please try again shortly."));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setAnalyzingAll(false);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch WA status:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Failed to logout:", err);
    } finally {
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerMonthlyVerification = async (dryRun: boolean) => {
    const hubLabel = selectedHub === "all" ? "all European Hubs" : `the ${selectedHub.toUpperCase()} Hub`;
    const confirmed = confirm(
      dryRun
        ? `Run Monthly Verification in Simulation (Dry Run) for ${hubLabel}? No WhatsApp messages or removals will be performed.`
        : `WARNING: Run LIVE Monthly Verification for ${hubLabel}? Members who left VC will be removed from WhatsApp groups, and eligible candidates will receive invites.`
    );
    if (!confirmed) return;

    setRunningCheck(true);
    setRunLog(null);

    try {
      const res = await fetch(`/api/cron/monthly-check?dryRun=${dryRun}`, {
        method: "POST",
        headers: { "x-admin-trigger": "true" },
      });

      const data = await res.json();
      setRunLog(data.summary || data);
      await fetchMembers();
    } catch (err: any) {
      alert("Error during verification: " + err.message);
    } finally {
      setRunningCheck(false);
    }
  };

  const handleMemberAction = async (memberId: string, action: string, extra?: any) => {
    setActionLoadingId(memberId);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, action, ...extra }),
      });
      if (res.ok) {
        await fetchMembers();
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const connectWhatsApp = async () => {
    await fetch("/api/whatsapp/status", { method: "POST" });
    await fetchWaStatus();
  };

  // Filter members by selected hub
  const hubMembers = useMemo(() => {
    if (selectedHub === "all") return members;
    return members.filter((m) =>
      (m.hub_city || "").toLowerCase().includes(selectedHub.toLowerCase())
    );
  }, [members, selectedHub]);

  // Counts for current selected hub
  const hubStats = useMemo(() => {
    return {
      total: hubMembers.length,
      inside: hubMembers.filter((m) => m.status === "active_member").length,
      waiting: hubMembers.filter((m) => m.status === "pending_review").length,
      removed: hubMembers.filter((m) => m.status === "removed_churned").length,
      neverAdmitted: hubMembers.filter((m) => m.status === "rejected").length,
      appeals: hubMembers.filter((m) => m.status === "flagged_manual").length,
    };
  }, [hubMembers]);

  // Filtered by status and search query
  const displayedMembers = useMemo(() => {
    return hubMembers.filter((m) => {
      const matchesStatus = activeStatusTab === "all" || m.status === activeStatusTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        m.full_name.toLowerCase().includes(q) ||
        (m.first_name || "").toLowerCase().includes(q) ||
        (m.last_name || "").toLowerCase().includes(q) ||
        (m.current_firm || "").toLowerCase().includes(q) ||
        (m.role_title || "").toLowerCase().includes(q) ||
        m.phone_number.includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [hubMembers, activeStatusTab, searchQuery]);

  const currentHubInfo = JVC_HUBS.find((h) => h.id === selectedHub) || JVC_HUBS[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-foreground/10">
        <div className="flex items-center gap-3">
          <JVCLogo size={110} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium tracking-tight">JVC Community Engine</h1>
              <a
                href="https://jvc-community.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 border border-foreground/10 px-2 py-0.5 rounded-md bg-white/40 transition-colors"
              >
                jvc-community.com <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Junior VC Community Europe &bull; Regional Hubs Control Room & Verification Engine
            </p>
          </div>
        </div>

        {/* WhatsApp Connection Widget + Sign Out */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-foreground/10 text-xs font-medium bg-white/60 shadow-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                waStatus.status === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : waStatus.status === "qr_ready"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            <span className="capitalize">WhatsApp Bot: {waStatus.status.replace("_", " ")}</span>
            {waStatus.phoneNumber && (
              <span className="text-muted-foreground font-mono">({waStatus.phoneNumber})</span>
            )}
          </div>

          {waStatus.status !== "connected" && (
            <button
              onClick={connectWhatsApp}
              className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-foreground text-background hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Connect WhatsApp
            </button>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            title="Sign out of Control Room"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200/80 bg-white/70 hover:bg-white text-neutral-600 hover:text-neutral-900 text-xs font-medium cursor-pointer shadow-xs transition-all"
          >
            <LogOut className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* QR Code Banner if ready */}
      {waStatus.status === "qr_ready" && waStatus.qrCodeDataUrl && (
        <div className="my-4 p-5 rounded-2xl border border-amber-200 bg-amber-50/70 flex flex-col sm:flex-row items-center gap-6 shadow-xs">
          <img
            src={waStatus.qrCodeDataUrl}
            alt="WhatsApp QR Code"
            className="w-36 h-36 rounded-xl shadow-xs border border-amber-200 bg-white p-2"
          />
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 text-amber-900 font-semibold text-sm">
              <QrCode className="w-4 h-4" />
              Scan QR Code with WhatsApp
            </div>
            <p className="text-xs text-amber-800/80 max-w-lg leading-relaxed">
              Open WhatsApp on the bot device &gt; Linked Devices &gt; Link a device.
              Once linked, the bot will automatically manage member admissions and offboarding for each regional Hub.
            </p>
          </div>
        </div>
      )}

      {/* 📁 REGIONAL HUB SELECTOR */}
      <section className="my-6">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              JVC European Hubs
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Select a Hub to view and manage its verified members
          </span>
        </div>

        {/* Hub Pills Scrollable */}
        <div className="flex items-center gap-2.5 overflow-x-auto py-2.5 px-1 scrollbar-thin">
          {JVC_HUBS.map((hub) => {
            const isSelected = selectedHub === hub.id;
            const count =
              hub.id === "all"
                ? members.length
                : members.filter((m) =>
                    (m.hub_city || "").toLowerCase().includes(hub.id.toLowerCase())
                  ).length;

            return (
              <button
                key={hub.id}
                onClick={() => setSelectedHub(hub.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-white text-neutral-950 border-neutral-900 ring-2 ring-neutral-900/10 shadow-xs font-semibold"
                    : "bg-white/50 text-neutral-600 border-neutral-200/70 hover:bg-white hover:text-neutral-900 hover:border-neutral-300 font-medium"
                }`}
              >
                <span className="text-base leading-none">{hub.flag}</span>
                <span>{hub.name}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
                    isSelected
                      ? "bg-neutral-900 text-white font-medium"
                      : "bg-black/[0.04] text-neutral-500 font-normal"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Hub Overview Banner */}
      <div className="p-6 rounded-2xl border border-foreground/10 bg-white/60 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{currentHubInfo.flag}</span>
            <h2 className="text-lg font-semibold tracking-tight">
              {currentHubInfo.city} {selectedHub !== "all" && "Hub"}
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-foreground/5 text-muted-foreground">
              {hubStats.total} {hubStats.total === 1 ? "member" : "members"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage active members, monthly intake review, VC alumni, and rejected applicants.
          </p>
        </div>

        {/* Action Controls for this Hub */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={triggerAutoAnalyzeAll}
            disabled={analyzingAll || runningCheck}
            className="px-3.5 py-2 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs font-medium shadow-2xs"
            title="Runs Gemini AI evaluation on all pending profiles"
          >
            <Sparkles className={`w-3.5 h-3.5 text-purple-600 ${analyzingAll ? "animate-spin" : ""}`} />
            {analyzingAll ? "Analyzing with AI..." : "Analyze with AI"}
          </button>

          <button
            onClick={() => triggerMonthlyVerification(true)}
            disabled={runningCheck}
            className="px-3.5 py-2 rounded-xl border border-foreground/15 text-xs font-medium hover:bg-white hover:border-foreground/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Runs verification with Lobstr and Gemini AI without modifying WhatsApp"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningCheck ? "animate-spin" : ""}`} />
            Simulation (Dry Run)
          </button>

          <button
            onClick={() => triggerMonthlyVerification(false)}
            disabled={runningCheck}
            className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            title="Runs verification and applies live updates to WhatsApp groups"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {runningCheck ? "Verifying..." : "Run LIVE Monthly Check"}
          </button>
        </div>
      </div>

      {/* 📁 5 STATUS FOLDERS (ALL / ACTIVE / WAITING LIST / ALUMNI / REJECTED) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        {/* 0. ALL MEMBERS / STATUSES */}
        <button
          onClick={() => setActiveStatusTab("all")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "all"
              ? "bg-neutral-900 text-white border-neutral-900 shadow-md ring-2 ring-neutral-900/20"
              : "bg-white/60 border-foreground/10 hover:border-foreground/30 text-foreground"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wider ${activeStatusTab === "all" ? "text-neutral-200" : "text-neutral-600"}`}>
              All Members
            </span>
            <Users className={`w-4 h-4 ${activeStatusTab === "all" ? "text-white" : "text-neutral-500"}`} />
          </div>
          <div className={`text-2xl font-bold ${activeStatusTab === "all" ? "text-white" : "text-neutral-950"}`}>
            {hubStats.total}
          </div>
          <p className={`text-[11px] mt-1 ${activeStatusTab === "all" ? "text-neutral-300" : "text-muted-foreground"}`}>
            All statuses in this Hub
          </p>
        </button>

        {/* 1. ACTIVE MEMBERS */}
        <button
          onClick={() => setActiveStatusTab(activeStatusTab === "active_member" ? "all" : "active_member")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "active_member"
              ? "bg-emerald-500/10 border-emerald-500 shadow-sm ring-1 ring-emerald-500"
              : "bg-white/60 border-foreground/10 hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-950">{hubStats.inside}</div>
          <p className="text-[11px] text-emerald-700/80 mt-1">In official WhatsApp group</p>
        </button>

        {/* 2. WAITING LIST */}
        <button
          onClick={() => setActiveStatusTab(activeStatusTab === "pending_review" ? "all" : "pending_review")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "pending_review"
              ? "bg-amber-500/10 border-amber-500 shadow-sm ring-1 ring-amber-500"
              : "bg-white/60 border-foreground/10 hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Waiting List</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-950">{hubStats.waiting}</div>
          <p className="text-[11px] text-amber-700/80 mt-1">Pending monthly verification</p>
        </button>

        {/* 3. ALUMNI (LEFT VC) */}
        <button
          onClick={() => setActiveStatusTab(activeStatusTab === "removed_churned" ? "all" : "removed_churned")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "removed_churned"
              ? "bg-orange-500/10 border-orange-500 shadow-sm ring-1 ring-orange-500"
              : "bg-white/60 border-foreground/10 hover:border-orange-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-orange-800 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Alumni (Left VC)</span>
            <UserX className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-orange-950">{hubStats.removed}</div>
          <p className="text-[11px] text-orange-700/80 mt-1">No longer in Venture Capital</p>
        </button>

        {/* 4. REJECTED */}
        <button
          onClick={() => setActiveStatusTab(activeStatusTab === "rejected" ? "all" : "rejected")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "rejected"
              ? "bg-rose-500/10 border-rose-500 shadow-sm ring-1 ring-rose-500"
              : "bg-white/60 border-foreground/10 hover:border-rose-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-rose-800 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-950">{hubStats.neverAdmitted}</div>
          <p className="text-[11px] text-rose-700/80 mt-1">VC criteria not met</p>
        </button>
      </div>

      {/* Execution Log Summary if available */}
      {runLog && (
        <div className="mb-6 p-5 rounded-2xl border border-foreground/15 bg-white shadow-xs font-mono text-xs">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-foreground/10">
            <div className="font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verification Run Summary</span>
            </div>
            <button
              onClick={() => setRunLog(null)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Close
            </button>
          </div>
          <pre className="overflow-x-auto text-[11px] text-muted-foreground">
            {JSON.stringify(runLog, null, 2)}
          </pre>
        </div>
      )}

      {/* Filter bar & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {activeStatusTab === "all"
              ? "Showing: All Members"
              : activeStatusTab === "active_member"
              ? "🟢 Showing: Active Members"
              : activeStatusTab === "pending_review"
              ? "🟡 Showing: Waiting List"
              : activeStatusTab === "removed_churned"
              ? "🟠 Showing: Alumni (Left VC)"
              : activeStatusTab === "flagged_manual"
              ? "🟣 Showing: Appeals / Inquiries"
              : "🔴 Showing: Rejected"}
          </span>
          {activeStatusTab !== "all" && (
            <button
              onClick={() => setActiveStatusTab("all")}
              className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Show all
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search candidate, VC fund, role, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-xs rounded-xl border border-foreground/15 bg-white/80 focus:outline-hidden focus:ring-1 focus:ring-foreground transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Member Table */}
      <div className="bg-white/90 rounded-2xl border border-foreground/10 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-foreground/[0.03] border-b border-foreground/10 text-muted-foreground font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Fund & Role</th>
                <th className="py-3.5 px-4">Assigned Hub</th>
                <th className="py-3.5 px-4">Applied Date</th>
                <th className="py-3.5 px-4">Community Status</th>
                <th className="py-3.5 px-4 min-w-[320px]">AI Evaluation & Reasoning</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[180px]">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading Hub members...
                  </td>
                </tr>
              ) : displayedMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground space-y-1">
                    <div className="text-sm font-medium">No candidates found in this section.</div>
                    <p className="text-xs text-muted-foreground">
                      {selectedHub !== "all"
                        ? `No applications recorded yet for the ${currentHubInfo.city} Hub.`
                        : "No candidates match the selected filters."}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedMembers.map((m) => {
                  const isActing = actionLoadingId === m.id;

                  return (
                    <tr key={m.id} className="hover:bg-foreground/[0.015] transition-colors">
                      {/* Name & Contacts */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                          <span>{m.full_name}</span>
                        </div>
                        <div className="text-muted-foreground font-mono text-[11px] flex items-center gap-1.5 mt-0.5">
                          <a
                            href={`https://wa.me/${m.phone_number.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                            title="Open WhatsApp Chat"
                          >
                            <Phone className="w-3 h-3" />
                            {m.phone_number}
                          </a>
                        </div>
                        <a
                          href={m.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>

                      {/* Firm & Role */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          {m.current_firm || "—"}
                        </div>
                        <div className="text-muted-foreground text-[11px] ml-4.5">
                          {m.role_title || "—"}
                        </div>
                      </td>

                      {/* Hub */}
                      <td className="py-3.5 px-4">
                        <select
                          value={m.hub_city || "Paris"}
                          onChange={(e) => handleMemberAction(m.id, "change_hub", { newHub: e.target.value })}
                          className="text-xs bg-background/60 border border-foreground/15 rounded-lg px-2 py-1 font-medium cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-foreground"
                        >
                          {JVC_HUBS.filter((h) => h.id !== "all").map((h) => (
                            <option key={h.city} value={h.city}>
                              {h.flag} {h.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Applied Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-700 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{formatAppliedDate(m.applied_at || m.created_at)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {m.status === "active_member" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🟢 Active Member
                          </span>
                        )}
                        {m.status === "pending_review" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            🟡 Waiting List
                          </span>
                        )}
                        {m.status === "removed_churned" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            🟠 Alumni (Left VC)
                          </span>
                        )}
                        {m.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            🔴 Rejected
                          </span>
                        )}
                        {m.status === "flagged_manual" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
                            🟣 Appealed (Inquiry)
                          </span>
                        )}
                      </td>

                      {/* AI Evaluation & Reasoning */}
                      <td className="py-3.5 px-4 min-w-[320px] max-w-md">
                        {m.ai_evaluation ? (
                          <div className="space-y-1.5">
                            {/* Final verdict badge with emoji */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {m.ai_evaluation.confidence < 0.7 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                                  ⚠️ Doubtful ({Math.round((m.ai_evaluation.confidence || 0.6) * 100)}%)
                                </span>
                              ) : m.is_eligible_vc ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  ✅ Eligible ({Math.round((m.ai_evaluation.confidence || 0.95) * 100)}%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-300">
                                  ❌ Ineligible ({Math.round((m.ai_evaluation.confidence || 0.8) * 100)}%)
                                </span>
                              )}

                              {m.ai_evaluation.firm_category && (
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200">
                                  {m.ai_evaluation.firm_category.replace("_", " ")}
                                </span>
                              )}
                            </div>

                            {/* Full text without clipping */}
                            <p className="text-xs text-neutral-700 leading-relaxed whitespace-normal break-words">
                              {m.rejection_reason || m.ai_evaluation.reasoning || "Evaluation completed."}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400 italic">
                            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span>⏳ Pending AI Analysis</span>
                          </div>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap min-w-[180px]">
                        <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                          {isActing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <button
                                onClick={() => handleMemberAction(m.id, "re_verify")}
                                title="Re-check candidate with Lobstr and Gemini AI"
                                className="px-2.5 py-1 rounded-lg border border-foreground/15 hover:bg-foreground/5 transition-colors text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Re-check
                              </button>

                              {m.status !== "active_member" && (
                                <button
                                  onClick={() => handleMemberAction(m.id, "force_approve")}
                                  title="Admit candidate into community and invite to WhatsApp"
                                  className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}

                              {m.status === "active_member" && (
                                <button
                                  onClick={() => handleMemberAction(m.id, "force_remove")}
                                  title="Remove member from WhatsApp group"
                                  className="px-2.5 py-1 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

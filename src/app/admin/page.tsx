"use client";

import { useEffect, useState } from "react";
import { JVCLogo } from "@/components/JVCLogo";
import Link from "next/link";
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
  ArrowLeft,
  Search,
} from "lucide-react";
import { JVCMember } from "@/lib/supabase";

export default function AdminPage() {
  const [members, setMembers] = useState<JVCMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "pending_review" | "active_member" | "rejected" | "removed_churned" | "flagged_manual">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [runningCheck, setRunningCheck] = useState(false);
  const [runLog, setRunLog] = useState<any | null>(null);

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
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchMembers();
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerMonthlyVerification = async (dryRun: boolean) => {
    if (!confirm(dryRun ? "Run Monthly Verification in Dry Run mode (Simulation)?" : "Run LIVE Monthly Verification? This will update the WhatsApp group and send messages to candidates!")) {
      return;
    }

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
      alert("Verification failed: " + err.message);
    } finally {
      setRunningCheck(false);
    }
  };

  const handleManualAction = async (memberId: string, action: string) => {
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, action }),
      });
      if (res.ok) {
        await fetchMembers();
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  const connectWhatsApp = async () => {
    await fetch("/api/whatsapp/status", { method: "POST" });
    await fetchWaStatus();
  };

  // Metrics
  const totalCount = members.length;
  const activeCount = members.filter((m) => m.status === "active_member").length;
  const pendingCount = members.filter((m) => m.status === "pending_review").length;
  const churnedCount = members.filter((m) => m.status === "removed_churned").length;
  const rejectedCount = members.filter((m) => m.status === "rejected").length;
  const flaggedCount = members.filter((m) => m.status === "flagged_manual").length;

  const filteredMembers = members.filter((m) => {
    const matchesTab = activeTab === "all" || m.status === activeTab;
    const matchesSearch =
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.current_firm || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.role_title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone_number.includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-6 md:p-12">
      {/* Top Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-8 border-b border-foreground/10">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-xl border border-foreground/10 hover:bg-foreground/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <JVCLogo size={80} />
          <div>
            <h1 className="text-xl font-medium tracking-tight">JVC Community Engine</h1>
            <p className="text-xs text-muted-foreground">
              European Venture Capital Ecosystem • Monthly Automation Control Room
            </p>
          </div>
        </div>

        {/* WhatsApp Connection Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-foreground/10 text-xs font-medium bg-white/50">
            <span
              className={`w-2 h-2 rounded-full ${
                waStatus.status === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : waStatus.status === "qr_ready"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            <span className="capitalize">WhatsApp: {waStatus.status.replace("_", " ")}</span>
            {waStatus.phoneNumber && (
              <span className="text-muted-foreground font-mono">({waStatus.phoneNumber})</span>
            )}
          </div>

          {waStatus.status !== "connected" && (
            <button
              onClick={connectWhatsApp}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Connect Bot
            </button>
          )}
        </div>
      </div>

      {/* QR Code Modal / Drawer if qr_ready */}
      {waStatus.status === "qr_ready" && waStatus.qrCodeDataUrl && (
        <div className="my-6 p-6 rounded-2xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row items-center gap-6">
          <img
            src={waStatus.qrCodeDataUrl}
            alt="WhatsApp QR Code"
            className="w-44 h-44 rounded-xl shadow-sm border border-amber-200 bg-white p-2"
          />
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 text-amber-900 font-semibold text-sm">
              <QrCode className="w-4 h-4" />
              Scan QR Code with WhatsApp
            </div>
            <p className="text-xs text-amber-800/80 max-w-md leading-relaxed">
              Open WhatsApp on your bot phone &gt; Settings &gt; Linked Devices &gt; Link a Device.
              Point your camera at this QR code. Once scanned, the bot will automatically manage group
              participants and send official messages.
            </p>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 my-8">
        <div className="p-5 rounded-2xl border border-foreground/10 bg-white/40">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="text-2xl font-semibold">{totalCount}</div>
        </div>

        <div className="p-5 rounded-2xl border border-foreground/10 bg-white/40">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Active in VC</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold text-emerald-950">{activeCount}</div>
        </div>

        <div className="p-5 rounded-2xl border border-foreground/10 bg-white/40">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-semibold text-amber-950">{pendingCount}</div>
        </div>

        <div className="p-5 rounded-2xl border border-foreground/10 bg-white/40">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Stepped Out</span>
            <UserX className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-semibold text-orange-950">{churnedCount}</div>
        </div>

        <div className="p-5 rounded-2xl border border-foreground/10 bg-white/40">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Appeals</span>
            <MessageSquare className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-semibold text-purple-950">{flaggedCount}</div>
        </div>
      </div>

      {/* Control Actions & Verification Trigger */}
      <div className="p-6 rounded-2xl border border-foreground/10 bg-white/50 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base font-semibold">Monthly Verification Engine</h2>
          <p className="text-xs text-muted-foreground">
            Scrapes LinkedIn via Lobstr API &bull; Evaluates VC roles with Gemini 3.6 Flash &bull; Adds qualified candidates &bull; Removes members who left the ecosystem.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => triggerMonthlyVerification(true)}
            disabled={runningCheck}
            className="px-4 py-2 rounded-xl border border-foreground/20 text-xs font-medium hover:bg-foreground/5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningCheck ? "animate-spin" : ""}`} />
            Run Dry Run (Simulation)
          </button>

          <button
            onClick={() => triggerMonthlyVerification(false)}
            disabled={runningCheck}
            className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {runningCheck ? "Verifying Ecosystem..." : "Execute Monthly Run (Live)"}
          </button>
        </div>
      </div>

      {/* Execution Log summary if available */}
      {runLog && (
        <div className="mb-8 p-6 rounded-2xl border border-foreground/15 bg-white shadow-sm font-mono text-xs">
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold text-sm">Execution Run Summary</span>
            <span className="text-muted-foreground">{runLog.completedAt}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-muted-foreground">
            <div>Processed: <strong className="text-foreground">{runLog.totalProcessed}</strong></div>
            <div>New Approved: <strong className="text-emerald-600">{runLog.newApplicantsApproved}</strong></div>
            <div>New Rejected: <strong className="text-rose-600">{runLog.newApplicantsRejected}</strong></div>
            <div>Kept Active: <strong className="text-emerald-600">{runLog.existingMembersKept}</strong></div>
            <div>Removed (Left VC): <strong className="text-orange-600">{runLog.existingMembersRemoved}</strong></div>
          </div>
        </div>
      )}

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all", label: "All Members" },
              { id: "pending_review", label: `Pending (${pendingCount})` },
              { id: "active_member", label: `Active (${activeCount})` },
              { id: "flagged_manual", label: `Appeals (${flaggedCount})` },
              { id: "removed_churned", label: `Stepped Out (${churnedCount})` },
              { id: "rejected", label: `Rejected (${rejectedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "bg-foreground text-background"
                  : "bg-foreground/5 hover:bg-foreground/10 text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search candidate, firm, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-foreground/15 bg-white/70 focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
      </div>

      {/* Member Table */}
      <div className="bg-white/80 rounded-2xl border border-foreground/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-foreground/[0.03] border-b border-foreground/10 text-muted-foreground font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Member / Candidate</th>
                <th className="py-3.5 px-4">Firm & Role</th>
                <th className="py-3.5 px-4">Hub</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">AI Reason / Evaluation</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading community members...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No members found in this category.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-foreground/[0.015] transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-foreground text-sm">{m.full_name}</div>
                      <div className="text-muted-foreground font-mono text-[11px] flex items-center gap-1 mt-0.5">
                        <Smartphone className="w-3 h-3 text-emerald-600" />
                        {m.phone_number}
                      </div>
                      <a
                        href={m.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-foreground/70 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-medium text-foreground">{m.current_firm || "—"}</div>
                      <div className="text-muted-foreground">{m.role_title || "—"}</div>
                    </td>

                    <td className="py-4 px-4 text-muted-foreground font-medium">
                      {m.hub_city || "Europe"}
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          m.status === "active_member"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : m.status === "pending_review"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : m.status === "flagged_manual"
                            ? "bg-purple-50 text-purple-700 border border-purple-200 animate-pulse"
                            : m.status === "removed_churned"
                            ? "bg-orange-50 text-orange-700 border border-orange-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {m.status.replace("_", " ")}
                      </span>
                    </td>

                    <td className="py-4 px-4 max-w-xs">
                      {m.rejection_reason ? (
                        <span className="text-rose-600 line-clamp-2">{m.rejection_reason}</span>
                      ) : m.ai_evaluation?.reasoning ? (
                        <span className="text-muted-foreground line-clamp-2">
                          {m.ai_evaluation.reasoning}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Awaiting monthly evaluation</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {m.status !== "active_member" && (
                          <button
                            onClick={() => handleManualAction(m.id, "force_approve")}
                            title="Force Approve & Add to WhatsApp"
                            className="px-2.5 py-1 rounded-lg border border-foreground/15 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors text-[11px] font-medium"
                          >
                            Approve
                          </button>
                        )}

                        {m.status === "active_member" && (
                          <button
                            onClick={() => handleManualAction(m.id, "force_remove")}
                            title="Remove from WhatsApp Group"
                            className="px-2.5 py-1 rounded-lg border border-foreground/15 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors text-[11px] font-medium"
                          >
                            Step Out
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

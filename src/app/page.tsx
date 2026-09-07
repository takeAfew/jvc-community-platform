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

  // WhatsApp bot status
  const [waStatus, setWaStatus] = useState<{
    status: string;
    phoneNumber: string | null;
    qrCodeDataUrl: string | null;
  }>({ status: "disconnected", phoneNumber: null, qrCodeDataUrl: null });

  // Hub WhatsApp settings modal
  const [showHubSettings, setShowHubSettings] = useState(false);
  const [hubWaSettings, setHubWaSettings] = useState<{ groupName: string; groupJid: string; inviteLink: string }>({
    groupName: "",
    groupJid: "",
    inviteLink: "",
  });

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
    const hubLabel = selectedHub === "all" ? "tutti gli Hub Europei" : `l'Hub di ${selectedHub.toUpperCase()}`;
    const confirmed = confirm(
      dryRun
        ? `Avviare la Verifica Mensile in Simulazione (Dry Run) per ${hubLabel}? Nessun messaggio o rimozione WhatsApp verrà effettuata.`
        : `ATTENZIONE: Avviare la Verifica Mensile LIVE per ${hubLabel}? Chi non lavora più in VC verrà rimosso dal gruppo WhatsApp e i nuovi candidati idonei verranno aggiunti.`
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
      alert("Errore durante la verifica: " + err.message);
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
        (m.current_firm || "").toLowerCase().includes(q) ||
        (m.role_title || "").toLowerCase().includes(q) ||
        m.phone_number.includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [hubMembers, activeStatusTab, searchQuery]);

  const currentHubInfo = JVC_HUBS.find((h) => h.id === selectedHub) || JVC_HUBS[0];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 md:p-8">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-foreground/10">
        <div className="flex items-center gap-3">
          <JVCLogo size={65} />
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
              Junior VC Community Europe &bull; Control Room Hubs & Automazione
            </p>
          </div>
        </div>

        {/* WhatsApp Connection Widget */}
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
              Collega WhatsApp
            </button>
          )}
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
              Scansiona il QR Code con WhatsApp
            </div>
            <p className="text-xs text-amber-800/80 max-w-lg leading-relaxed">
              Apri WhatsApp sul telefono del bot &gt; Dispositivi Collegati &gt; Collega un dispositivo.
              Una volta associato, il bot gestirà automaticamente l&apos;ingresso e l&apos;uscita nei gruppi dei rispettivi Hub.
            </p>
          </div>
        </div>
      )}

      {/* 📁 HUB DIRECTORY / SELEZIONE CARTELLE HUB */}
      <section className="my-6">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hub Europei JVC
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Seleziona un Hub per visualizzare e gestire i suoi membri
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
              {hubStats.total} {hubStats.total === 1 ? "professionista" : "professionisti"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gestisci chi è dentro, la waiting list mensile, chi è uscito dal VC e chi non è stato ammesso.
          </p>
        </div>

        {/* Action Controls for this Hub */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => triggerMonthlyVerification(true)}
            disabled={runningCheck}
            className="px-3.5 py-2 rounded-xl border border-foreground/15 text-xs font-medium hover:bg-white hover:border-foreground/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Esegue il controllo con Lobstr e Gemini senza modificare WhatsApp"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningCheck ? "animate-spin" : ""}`} />
            Simulazione (Dry Run)
          </button>

          <button
            onClick={() => triggerMonthlyVerification(false)}
            disabled={runningCheck}
            className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            title="Esegue il controllo e applica le modifiche ai gruppi WhatsApp inviando i messaggi"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {runningCheck ? "Verifica in corso..." : "Esegui Verifica Mensile LIVE"}
          </button>
        </div>
      </div>

      {/* 4 CARTELLA DI STATO (DENTRO / WAITING LIST / RIMOSSI / MAI ENTRATI) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        {/* 1. CHI È DENTRO */}
        <button
          onClick={() => setActiveStatusTab(activeStatusTab === "active_member" ? "all" : "active_member")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "active_member"
              ? "bg-emerald-500/10 border-emerald-500 shadow-sm ring-1 ring-emerald-500"
              : "bg-white/60 border-foreground/10 hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Dentro (Attivi)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-950">{hubStats.inside}</div>
          <p className="text-[11px] text-emerald-700/80 mt-1">Nel gruppo WhatsApp ufficiale</p>
        </button>

        {/* 2. IN WAITING LIST */}
        <button
          onClick={() => setActiveStatusTab(activeStatusTab === "pending_review" ? "all" : "pending_review")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "pending_review"
              ? "bg-amber-500/10 border-amber-500 shadow-sm ring-1 ring-amber-500"
              : "bg-white/60 border-foreground/10 hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">In Waiting List</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-950">{hubStats.waiting}</div>
          <p className="text-[11px] text-amber-700/80 mt-1">In attesa del controllo mensile</p>
        </button>

        {/* 3. RIMOSSI (HANNO LASCIATO IL VC) */}
        <button
          onClick={() => setActiveStatusTab(activeStatusTab === "removed_churned" ? "all" : "removed_churned")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "removed_churned"
              ? "bg-orange-500/10 border-orange-500 shadow-sm ring-1 ring-orange-500"
              : "bg-white/60 border-foreground/10 hover:border-orange-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-orange-800 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Rimossi (Usciti)</span>
            <UserX className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-orange-950">{hubStats.removed}</div>
          <p className="text-[11px] text-orange-700/80 mt-1">Non lavorano più nel Venture Capital</p>
        </button>

        {/* 4. MAI ENTRATI (RIFIUTATI) */}
        <button
          onClick={() => setActiveStatusTab(activeStatusTab === "rejected" ? "all" : "rejected")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatusTab === "rejected"
              ? "bg-rose-500/10 border-rose-500 shadow-sm ring-1 ring-rose-500"
              : "bg-white/60 border-foreground/10 hover:border-rose-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-rose-800 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Mai Entrati</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-950">{hubStats.neverAdmitted}</div>
          <p className="text-[11px] text-rose-700/80 mt-1">Requisiti VC non soddisfatti</p>
        </button>
      </div>

      {/* Execution Log Summary if available */}
      {runLog && (
        <div className="mb-6 p-5 rounded-2xl border border-foreground/15 bg-white shadow-xs font-mono text-xs">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-foreground/10">
            <span className="font-semibold text-foreground">Esito Ultima Esecuzione ({runLog.runId})</span>
            <span className="text-muted-foreground">{runLog.completedAt}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-muted-foreground">
            <div>Profili Valutati: <strong className="text-foreground">{runLog.totalProcessed}</strong></div>
            <div>Nuovi Idonei: <strong className="text-emerald-600">{runLog.newApplicantsApproved}</strong></div>
            <div>Nuovi Rifiutati: <strong className="text-rose-600">{runLog.newApplicantsRejected}</strong></div>
            <div>Confermati in VC: <strong className="text-emerald-600">{runLog.existingMembersKept}</strong></div>
            <div>Rimossi (Usciti): <strong className="text-orange-600">{runLog.existingMembersRemoved}</strong></div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Filtro Cartella:</span>
          <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-foreground/5 border border-foreground/10">
            {activeStatusTab === "all"
              ? "Tutti gli Stati"
              : activeStatusTab === "active_member"
              ? "🟢 Dentro (Attivi)"
              : activeStatusTab === "pending_review"
              ? "🟡 In Waiting List"
              : activeStatusTab === "removed_churned"
              ? "🟠 Rimossi"
              : activeStatusTab === "flagged_manual"
              ? "🟣 Contestazioni"
              : "🔴 Mai Entrati"}
          </span>
          {activeStatusTab !== "all" && (
            <button
              onClick={() => setActiveStatusTab("all")}
              className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Mostra tutti
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cerca nome, fondo VC, ruolo o telefono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-xs rounded-xl border border-foreground/15 bg-white/80 focus:outline-none focus:ring-1 focus:ring-foreground transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Member Table */}
      <div className="bg-white/90 rounded-2xl border border-foreground/10 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-foreground/[0.03] border-b border-foreground/10 text-muted-foreground font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Professionista</th>
                <th className="py-3.5 px-4">Fondo & Ruolo</th>
                <th className="py-3.5 px-4">Hub Assegnato</th>
                <th className="py-3.5 px-4">Stato nella Community</th>
                <th className="py-3.5 px-4">Valutazione AI & Motivazione</th>
                <th className="py-3.5 px-4 text-right">Azioni Rapide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Caricamento membri dell&apos;Hub...
                  </td>
                </tr>
              ) : displayedMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground space-y-1">
                    <div className="text-sm font-medium">Nessun professionista trovato in questa sezione.</div>
                    <p className="text-xs text-muted-foreground">
                      {selectedHub !== "all"
                        ? `Non ci sono ancora candidature per l'Hub di ${currentHubInfo.city}.`
                        : "Nessuna persona corrisponde ai filtri selezionati."}
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
                        <div className="font-semibold text-foreground text-sm">{m.full_name}</div>
                        <div className="text-muted-foreground font-mono text-[11px] flex items-center gap-1.5 mt-0.5">
                          <a
                            href={`https://wa.me/${m.phone_number.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                            title="Apri chat WhatsApp"
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
                          className="text-xs bg-background/60 border border-foreground/15 rounded-lg px-2 py-1 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-foreground"
                        >
                          {JVC_HUBS.filter((h) => h.id !== "all").map((h) => (
                            <option key={h.city} value={h.city}>
                              {h.flag} {h.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {m.status === "active_member" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🟢 Dentro (Attivo)
                          </span>
                        )}
                        {m.status === "pending_review" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            🟡 In Waiting List
                          </span>
                        )}
                        {m.status === "removed_churned" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            🟠 Rimosso (Non in VC)
                          </span>
                        )}
                        {m.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            🔴 Mai Entrato
                          </span>
                        )}
                        {m.status === "flagged_manual" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
                            🟣 Ha Risposto (Contestazione)
                          </span>
                        )}
                      </td>

                      {/* AI Evaluation */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {m.rejection_reason ? (
                          <span className="text-rose-600 line-clamp-2" title={m.rejection_reason}>
                            {m.rejection_reason}
                          </span>
                        ) : m.ai_evaluation?.reasoning ? (
                          <span
                            className="text-muted-foreground line-clamp-2"
                            title={m.ai_evaluation.reasoning}
                          >
                            {m.ai_evaluation.reasoning}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            In attesa della verifica mensile
                          </span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isActing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <button
                                onClick={() => handleMemberAction(m.id, "re_verify")}
                                title="Ricontrolla con Lobstr e Gemini"
                                className="px-2 py-1 rounded-lg border border-foreground/15 hover:bg-foreground/5 transition-colors text-[11px]"
                              >
                                Re-check
                              </button>

                              {m.status !== "active_member" && (
                                <button
                                  onClick={() => handleMemberAction(m.id, "force_approve")}
                                  title="Ammetti nella community e aggiungi a WhatsApp"
                                  className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-[11px] font-medium"
                                >
                                  Ammetti
                                </button>
                              )}

                              {m.status === "active_member" && (
                                <button
                                  onClick={() => handleMemberAction(m.id, "force_remove")}
                                  title="Rimuovi dal gruppo WhatsApp"
                                  className="px-2.5 py-1 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors text-[11px] font-medium"
                                >
                                  Rimuovi
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

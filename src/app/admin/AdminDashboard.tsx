"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPlanDisplayName, PLAN_PRICING, normalizePlan, BED_PRICE, calculateMonthlyFee } from "@/lib/entitlements";
import {
    Building2,
    DollarSign,
    TrendingUp,
    Users as UsersIcon,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Phone,
    Mail,
    ChevronDown,
    ChevronRight,
    Plus,
    X,
    Save,
    Activity,
    Target,
    Crown,
    FileText,
    Loader2,
    MessageSquare,
    Send,
    Globe,
    BookOpen,
    Wrench,
    ReceiptText,
    Eye,
    EyeOff,
} from "lucide-react";

// =============== Tipos ===============
type Overview = {
    sedesActivas: number;
    sedesTotal: number;
    mrr: number;
    mrrSegunModelo?: number;
    contratosDesalineados?: { sede: string; camasContrato: number; camasAutorizadas: number; facturaActual: number; facturaSegunModelo: number }[];
    arr: number;
    prospectos: number;
    prospectosEnProceso: number;
    cerrados: number;
    facturasVencidas: number;
    cuposFounder: number;
};

type Prospect = {
    id: string;
    name: string;
    municipality: string;
    phone: string | null;
    email: string | null;
    contactName: string | null;
    stage: string;
    priority: string;
    estimatedBeds: number | null;
    planInterest: string | null;
    notes: string | null;
    lastContactAt: string | null;
    nextFollowUp: string | null;
    updatedAt: string;
    assignedTo?: { id: string; name: string } | null;
};

type Sede = {
    id: string;
    name: string;
    capacity: number;
    isActive: boolean;
    licenseActive: boolean;
    licenseExpiry: string;
    subscriptionPlan: string;
    subscriptionStatus: string;
    saasContract: { monthlyAmount: number; status: string; beds: number; plan: string } | null;
    _count: { patients: number; users: number };
    lastActivity: string | null;
    medsToday: number;
    healthScore: number;
};

type Invoice = {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: string;
    totalAmount: number;
    paidAt: string | null;
    headquarters: { id: string; name: string; logoUrl: string | null };
};

// =============== Constantes ===============
const STAGES = ["PROSPECTO", "CONTACTADO", "VISITA_AGENDADA", "DEMO_DADA", "PROPUESTA_ENVIADA", "CERRADO", "PERDIDO"];

const STAGE_STYLES: Record<string, string> = {
    PROSPECTO: "bg-slate-700/40 text-slate-300 border-slate-600",
    CONTACTADO: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    VISITA_AGENDADA: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    DEMO_DADA: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    PROPUESTA_ENVIADA: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    CERRADO: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    PERDIDO: "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

const PRIORITY_STYLES: Record<string, string> = {
    ALTA: "bg-[#3CC6C4]/10 text-[#3CC6C4] border-[#3CC6C4]/30",
    MEDIA: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    BAJA: "bg-slate-700/40 text-slate-400 border-slate-600",
};

function fmtMoney(n: number): string {
    return `$${Math.round(n).toLocaleString()}`;
}

function relativeTime(iso: string | null): string {
    if (!iso) return "sin actividad";
    const d = new Date(iso).getTime();
    const diff = Date.now() - d;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "hace minutos";
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days}d`;
    return new Date(iso).toLocaleDateString("es-PR", { day: "numeric", month: "short" });
}

function stageLabel(s: string): string {
    return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Tipo mensaje Zéndity ─────────────────────────────────────────
type ZendityMessage = {
    id: string;
    targetHqId: string | null;
    title: string;
    body: string;
    category: string;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
    author: { id: string; name: string };
    targetHq: { id: string; name: string } | null;
};

// =============== Dashboard ===============
export default function AdminDashboard({ userName }: { userName: string }) {
    const [tab, setTab] = useState<"overview" | "pipeline" | "sedes" | "comunicaciones" | "legal">("overview");
    const [overview, setOverview] = useState<Overview | null>(null);
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [sedes, setSedes] = useState<Sede[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [messages, setMessages] = useState<ZendityMessage[]>([]);
    const [loading, setLoading] = useState(true);

    // Load all data on mount
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [ovR, prR, seR, inR, msgR] = await Promise.all([
                    fetch("/api/admin/overview").then((r) => r.json()),
                    fetch("/api/admin/prospects").then((r) => r.json()),
                    fetch("/api/admin/sedes").then((r) => r.json()),
                    fetch("/api/admin/invoices").then((r) => r.json()),
                    fetch("/api/admin/messages").then((r) => r.json()),
                ]);
                if (ovR.success) setOverview(ovR.overview);
                if (prR.success) setProspects(prR.prospects);
                if (seR.success) setSedes(seR.sedes);
                if (inR.success) setInvoices(inR.invoices);
                if (msgR.success) setMessages(msgR.messages);
            } catch (e) {
                console.error("Admin load error:", e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200">
            {/* ---------- Header global ---------- */}
            <header className="border-b border-slate-800/80 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0F6B78] to-[#3CC6C4] flex items-center justify-center shadow-lg shadow-[#3CC6C4]/20">
                            <Crown className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight leading-tight">Zéndity Corp</h1>
                            <p className="text-xs text-slate-500 font-medium">Panel de administración</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] text-white shadow-lg shadow-[#3CC6C4]/20">
                            Super Admin
                        </span>
                        <span className="text-sm text-slate-400 hidden sm:block">{userName}</span>
                    </div>
                </div>

                {/* Tabs */}
                <nav className="max-w-7xl mx-auto px-8 flex gap-1">
                    {(
                        [
                            { id: "overview", label: "Visión General", icon: Activity },
                            { id: "pipeline", label: "Pipeline de Ventas", icon: Target },
                            { id: "sedes", label: "Sedes Activas", icon: Building2 },
                            { id: "comunicaciones", label: "Comunicaciones", icon: MessageSquare, badge: messages.filter((m) => !m.isRead).length },
                            { id: "legal", label: "Legal & SLA", icon: FileText },
                        ] as const
                    ).map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.id;
                        const unread = "badge" in t ? t.badge : 0;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`relative flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
                                    active
                                        ? "text-[#3CC6C4] border-[#3CC6C4]"
                                        : "text-slate-400 border-transparent hover:text-slate-200"
                                }`}
                            >
                                <Icon className="w-4 h-4" /> {t.label}
                                {unread > 0 && (
                                    <span className="absolute -top-0.5 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                                        {unread}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-10 pb-20">
                {loading ? (
                    <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin" /> Cargando panel corporativo...
                    </div>
                ) : (
                    <>
                        {tab === "overview" && <OverviewTab overview={overview} sedes={sedes} invoices={invoices} onPayInvoice={async (id) => {
                            const res = await fetch(`/api/admin/invoices/${id}/pay`, { method: "PATCH" });
                            const data = await res.json();
                            if (data.success) {
                                setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, status: "PAID", paidAt: new Date().toISOString() } : i)));
                            }
                        }} />}
                        {tab === "pipeline" && <PipelineTab prospects={prospects} setProspects={setProspects} onSedeCreated={(s) => setSedes((prev) => [s, ...prev])} />}
                        {tab === "sedes" && (
                            <SedesTab
                                sedes={sedes}
                                onCreated={(s) => setSedes((prev) => [s, ...prev])}
                                onRefresh={async () => {
                                    // Recarga desde el servidor: una acción de ciclo de
                                    // vida cambia estado, plan y health score a la vez.
                                    const r = await fetch("/api/admin/sedes").then((x) => x.json()).catch(() => null);
                                    if (r?.success) setSedes(r.sedes);
                                }}
                            />
                        )}
                        {tab === "comunicaciones" && (
                            <CommsTab
                                messages={messages}
                                sedes={sedes}
                                onSent={(msg) => setMessages((prev) => [msg, ...prev])}
                                onMarkRead={(id) => setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isRead: true, readAt: new Date().toISOString() } : m))}
                            />
                        )}
                        {tab === "legal" && <LegalTab />}
                    </>
                )}
            </main>
        </div>
    );
}

// =============== Tab 1 — Visión General ===============
function OverviewTab({
    overview,
    sedes,
    invoices,
    onPayInvoice,
}: {
    overview: Overview | null;
    sedes: Sede[];
    invoices: Invoice[];
    onPayInvoice: (id: string) => Promise<void>;
}) {
    if (!overview) return <p className="text-slate-500">Sin datos.</p>;

    const activeSedes = sedes.filter((s) => s.isActive);
    const pendingInvoices = invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE");

    const desalineados = overview.contratosDesalineados ?? [];

    return (
        <div className="space-y-10">
            {/* Contratos cuyo número de camas no coincide con la capacidad
                autorizada. Desde la tarifa por cama, ese desfase es dinero mal
                facturado — se muestra en vez de quedar enterrado en el MRR. */}
            {desalineados.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-black text-amber-300 text-sm">
                                {desalineados.length} contrato{desalineados.length !== 1 ? "s" : ""} no coincide{desalineados.length !== 1 ? "n" : ""} con la capacidad autorizada
                            </p>
                            <p className="text-amber-200/70 text-xs mt-1">
                                La tarifa es ${BED_PRICE} por cama. Si el monto difiere por un acuerdo especial, déjalo;
                                si es un contrato viejo, actualiza las camas desde Gestionar y se recalcula solo.
                            </p>
                            <div className="mt-3 space-y-1.5">
                                {desalineados.map((d) => (
                                    <div key={d.sede} className="text-xs flex flex-wrap items-center gap-2 text-slate-300">
                                        <span className="font-bold text-white">{d.sede}</span>
                                        <span className="text-slate-500">contrato por {d.camasContrato} camas · autorizadas {d.camasAutorizadas}</span>
                                        <span className="ml-auto font-mono">
                                            <span className="text-amber-400">{fmtMoney(d.facturaActual)}</span>
                                            <span className="text-slate-600 mx-1.5">→</span>
                                            <span className="text-emerald-400">{fmtMoney(d.facturaSegunModelo)}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fila 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard
                    label="MRR"
                    value={fmtMoney(overview.mrr)}
                    suffix={
                        overview.mrrSegunModelo !== undefined && Math.abs(overview.mrrSegunModelo - overview.mrr) > 0.01
                            ? `/ mes · según tarifa: ${fmtMoney(overview.mrrSegunModelo)}`
                            : "/ mes"
                    }
                    color={overview.mrr > 0 ? "emerald" : "slate"}
                    icon={DollarSign}
                />
                <KpiCard label="ARR" value={fmtMoney(overview.arr)} suffix="/ año" color="teal" icon={TrendingUp} />
                <KpiCard label="Sedes Activas" value={overview.sedesActivas.toString()} suffix={`de ${overview.sedesTotal}`} color="aqua" icon={Building2} />
                <KpiCard label="Cupos Fundador" value={`${overview.cuposFounder}`} suffix="/ 20" color="amber" icon={Crown} />
            </div>

            {/* Fila 2 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard label="Prospectos" value={overview.prospectos.toString()} color="slate" icon={Target} />
                <KpiCard label="En Proceso" value={overview.prospectosEnProceso.toString()} color="amber" icon={Clock} />
                <KpiCard label="Cerrados" value={overview.cerrados.toString()} color="emerald" icon={CheckCircle2} />
                <KpiCard
                    label="Facturas Vencidas"
                    value={overview.facturasVencidas.toString()}
                    color={overview.facturasVencidas > 0 ? "rose" : "slate"}
                    icon={AlertTriangle}
                />
            </div>

            {/* Sedes activas con health score */}
            <section>
                <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#3CC6C4]" /> Sedes Activas
                </h2>
                {activeSedes.length === 0 ? (
                    <p className="text-sm text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center">
                        Sin sedes activas todavía.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeSedes.map((s) => (
                            <div key={s.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-[#3CC6C4]/40 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="font-black text-white text-base leading-tight">{s.name}</p>
                                        <p className="text-[11px] text-slate-500 uppercase tracking-widest">
                                            {relativeTime(s.lastActivity)}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                        {getPlanDisplayName(s.subscriptionPlan)}
                                    </span>
                                </div>
                                <HealthBar score={s.healthScore} />
                                <div className="flex items-center justify-between mt-4 text-xs">
                                    <span className="text-slate-400">
                                        <span className="font-bold text-slate-200">{s._count.patients}</span> res · <span className="font-bold text-slate-200">{s._count.users}</span> staff
                                    </span>
                                    <span className="text-[#3CC6C4] font-bold">
                                        {s.saasContract ? fmtMoney(s.saasContract.monthlyAmount) : "—"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Facturas pendientes */}
            <section>
                <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#3CC6C4]" /> Facturas Pendientes
                </h2>
                {pendingInvoices.length === 0 ? (
                    <p className="text-sm text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center">
                        Sin facturas pendientes — todo al día.
                    </p>
                ) : (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl divide-y divide-slate-800 overflow-hidden">
                        {pendingInvoices.map((inv) => {
                            const overdue = inv.status === "OVERDUE";
                            return (
                                <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors">
                                    <div className="flex-1">
                                        <p className="font-bold text-white text-sm">{inv.headquarters.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {inv.invoiceNumber} · vence {new Date(inv.dueDate).toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric" })}
                                            {overdue && <span className="ml-2 text-rose-400 font-bold">VENCIDA</span>}
                                        </p>
                                    </div>
                                    <p className={`text-lg font-black mr-4 ${overdue ? "text-rose-400" : "text-white"}`}>{fmtMoney(inv.totalAmount)}</p>
                                    <button
                                        onClick={() => onPayInvoice(inv.id)}
                                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest bg-[#3CC6C4]/10 text-[#3CC6C4] border border-[#3CC6C4]/30 rounded-lg hover:bg-[#3CC6C4]/20 transition-colors"
                                    >
                                        Marcar pagada
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

// =============== Tab 2 — Pipeline ===============
function PipelineTab({
    prospects,
    setProspects,
    onSedeCreated,
}: {
    prospects: Prospect[];
    setProspects: React.Dispatch<React.SetStateAction<Prospect[]>>;
    onSedeCreated: (s: Sede) => void;
}) {
    const [filter, setFilter] = useState<string>("ALL");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [convertingProspect, setConvertingProspect] = useState<Prospect | null>(null);

    const filtered = useMemo(() => {
        if (filter === "ALL") return prospects;
        if (filter === "ALTA") return prospects.filter((p) => p.priority === "ALTA");
        return prospects.filter((p) => p.stage === filter);
    }, [prospects, filter]);

    const totalAlta = prospects.filter((p) => p.priority === "ALTA").length;
    const cerrados = prospects.filter((p) => p.stage === "CERRADO").length;
    const enProceso = prospects.filter((p) => !["PROSPECTO", "CERRADO", "PERDIDO"].includes(p.stage)).length;
    const cuposDisponibles = Math.max(0, 20 - cerrados);
    const cupoPct = (cerrados / 20) * 100;

    const updateProspect = (id: string, patch: Partial<Prospect>) =>
        setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

    const deleteProspect = (id: string) =>
        setProspects((prev) => prev.filter((p) => p.id !== id));

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-white">Pipeline de Ventas ({prospects.length})</h2>
                <button
                    onClick={() => setModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] text-white text-sm font-bold shadow-lg shadow-[#3CC6C4]/20 hover:brightness-110 transition flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Nuevo Prospecto
                </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MiniMetric label="Total" value={prospects.length} />
                <MiniMetric label="Alta prioridad" value={totalAlta} accent="aqua" />
                <MiniMetric label="En proceso" value={enProceso} accent="amber" />
                <MiniMetric label="Cerrados" value={cerrados} accent="emerald" />
                <MiniMetric label="Cupos disp." value={cuposDisponibles} accent="teal" />
            </div>

            {/* Barra cupos fundador */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" /> Modelo Fundador — 20 sedes con 50% dto.
                    </p>
                    <p className="text-sm font-black text-[#3CC6C4]">{cerrados} / 20</p>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] rounded-full transition-all"
                        style={{ width: `${Math.min(100, cupoPct)}%` }}
                    />
                </div>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
                <FilterPill active={filter === "ALL"} onClick={() => setFilter("ALL")}>Todos ({prospects.length})</FilterPill>
                <FilterPill active={filter === "ALTA"} onClick={() => setFilter("ALTA")}>Alta prioridad ({totalAlta})</FilterPill>
                <span className="w-px h-5 bg-slate-800 mx-1" />
                {STAGES.map((s) => {
                    const count = prospects.filter((p) => p.stage === s).length;
                    if (count === 0) return null;
                    return (
                        <FilterPill key={s} active={filter === s} onClick={() => setFilter(s)}>
                            {stageLabel(s)} ({count})
                        </FilterPill>
                    );
                })}
            </div>

            {/* Lista */}
            <div className="space-y-2">
                {filtered.map((p, idx) => {
                    const expanded = expandedId === p.id;
                    return (
                        <div key={p.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                            <button
                                onClick={() => setExpandedId(expanded ? null : p.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors text-left"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <span className="text-xs font-mono text-slate-600 w-6">#{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm truncate">{p.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{p.municipality}{p.phone ? ` · ${p.phone}` : ""}</p>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${PRIORITY_STYLES[p.priority]}`}>
                                        {p.priority}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${STAGE_STYLES[p.stage]}`}>
                                        {stageLabel(p.stage)}
                                    </span>
                                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                </div>
                            </button>

                            {expanded && (
                                <ProspectEditor
                                    prospect={p}
                                    onUpdate={(patch) => updateProspect(p.id, patch)}
                                    onDelete={() => { deleteProspect(p.id); setExpandedId(null); }}
                                    onConvert={() => setConvertingProspect(p)}
                                />
                            )}
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <p className="text-center text-sm text-slate-500 py-10">No hay prospectos que coincidan con el filtro.</p>
                )}
            </div>

            {modalOpen && (
                <NewProspectModal
                    onClose={() => setModalOpen(false)}
                    onCreated={(p) => { setProspects((prev) => [p, ...prev]); setModalOpen(false); }}
                />
            )}

            {convertingProspect && (
                <NewSedeModal
                    prefill={{
                        name: convertingProspect.name,
                        directorName: convertingProspect.contactName ?? "",
                        directorEmail: convertingProspect.email ?? "",
                        ownerPhone: convertingProspect.phone ?? "",
                        plan: convertingProspect.planInterest ?? "PRO",
                        capacity: convertingProspect.estimatedBeds?.toString() ?? "50",
                        beds: convertingProspect.estimatedBeds?.toString() ?? "",
                    }}
                    prospectId={convertingProspect.id}
                    onClose={() => setConvertingProspect(null)}
                    onCreated={(s) => {
                        onSedeCreated(s);
                        // Marcar prospecto como CERRADO en la lista local
                        updateProspect(convertingProspect.id, { stage: "CERRADO" });
                        setConvertingProspect(null);
                        setExpandedId(null);
                    }}
                />
            )}
        </div>
    );
}

function ProspectEditor({
    prospect,
    onUpdate,
    onDelete,
    onConvert,
}: {
    prospect: Prospect;
    onUpdate: (patch: Partial<Prospect>) => void;
    onDelete: () => void;
    onConvert: () => void;
}) {
    const [draft, setDraft] = useState({
        stage: prospect.stage,
        priority: prospect.priority,
        estimatedBeds: prospect.estimatedBeds?.toString() || "",
        planInterest: prospect.planInterest || "",
        nextFollowUp: prospect.nextFollowUp ? prospect.nextFollowUp.slice(0, 10) : "",
        notes: prospect.notes || "",
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const save = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await fetch(`/api/admin/prospects/${prospect.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stage: draft.stage,
                    priority: draft.priority,
                    estimatedBeds: draft.estimatedBeds || null,
                    planInterest: draft.planInterest || null,
                    nextFollowUp: draft.nextFollowUp || null,
                    notes: draft.notes || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                onUpdate(data.prospect);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            } else {
                alert(data.error || "Error guardando");
            }
        } catch (e) {
            alert("Error de conexión");
        } finally {
            setSaving(false);
        }
    };

    const craftEmail = () => {
        const subject = encodeURIComponent(`Zéndity OS — ${prospect.name}`);
        const body = encodeURIComponent(
            `Saludos${prospect.contactName ? ` ${prospect.contactName}` : ""},\n\nSoy Andrés de Zéndity. Estamos activando el sistema operativo para hogares de ancianos en Puerto Rico — HIPAA-ready, eMAR clínico, CRM con agente de voz, y dashboards corporativos en tiempo real.\n\n¿Podría agendar 15 min esta semana para mostrarle una demo personalizada para ${prospect.name}?\n\nSaludos cordiales,\nAndrés`
        );
        if (prospect.email) {
            window.open(`mailto:${prospect.email}?subject=${subject}&body=${body}`);
        } else {
            alert("Este prospecto no tiene email — agrégalo primero.");
        }
    };

    const preparePitch = () => {
        const pitch = `PITCH — ${prospect.name} (${prospect.municipality})\n\n` +
            `Hook: "Los hogares de ${prospect.municipality} están perdiendo $XX/mes en compliance manual. Zéndity lo automatiza en 7 días."\n\n` +
            `Dolores tipo:\n- eMAR en papel → riesgo de CMS fines\n- Horario manual → sobrecostos de overtime\n- Familias sin visibilidad → rotación\n\n` +
            `Solución Zéndity:\n- eMAR HIPAA con audit log\n- Schedule Builder con colores y redistribución auto\n- Portal familia + Zendi (AI concierge)\n\n` +
            `Números:\n- Camas estimadas: ${prospect.estimatedBeds || "por confirmar"}\n- Plan interés: ${prospect.planInterest || "PRO $599/mes"}\n- 50% dto fundador si cierra en 30d\n\n` +
            `Próximo paso: ${prospect.nextFollowUp ? `seguir el ${new Date(prospect.nextFollowUp).toLocaleDateString("es-PR")}` : "definir demo"}`;
        navigator.clipboard.writeText(pitch).then(() => alert("Pitch copiado al portapapeles ✓"));
    };

    return (
        <div className="border-t border-slate-800 p-5 bg-slate-950/60 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {(prospect.phone || prospect.email || prospect.contactName) && (
                    <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-3 space-y-1 text-xs">
                        {prospect.contactName && <p className="text-slate-400"><span className="text-slate-500">Contacto:</span> {prospect.contactName}</p>}
                        {prospect.phone && <p className="text-slate-400 flex items-center gap-2"><Phone className="w-3 h-3" /> {prospect.phone}</p>}
                        {prospect.email && <p className="text-slate-400 flex items-center gap-2"><Mail className="w-3 h-3" /> {prospect.email}</p>}
                    </div>
                )}

                <Field label="Etapa">
                    <select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })} className={inputCls}>
                        {STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
                    </select>
                </Field>
                <Field label="Prioridad">
                    <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} className={inputCls}>
                        {["ALTA", "MEDIA", "BAJA"].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </Field>
                <Field label="Camas estimadas">
                    <input type="number" min={0} value={draft.estimatedBeds} onChange={(e) => setDraft({ ...draft, estimatedBeds: e.target.value })} className={inputCls} placeholder="Ej. 30" />
                </Field>
                <Field label="Plan de interés">
                    <select value={draft.planInterest} onChange={(e) => setDraft({ ...draft, planInterest: e.target.value })} className={inputCls}>
                        <option value="">—</option>
                        <option value="LITE">LITE ($299)</option>
                        <option value="PRO">PRO ($599)</option>
                        <option value="ENTERPRISE">ENTERPRISE ($999)</option>
                    </select>
                </Field>
                <Field label="Próximo seguimiento">
                    <input type="date" value={draft.nextFollowUp} onChange={(e) => setDraft({ ...draft, nextFollowUp: e.target.value })} className={`${inputCls} [color-scheme:dark]`} />
                </Field>
            </div>

            <Field label="Notas">
                <textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={inputCls} placeholder="Observaciones, contexto, objeciones..." />
            </Field>

            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={save}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] text-white text-sm font-bold shadow-lg shadow-[#3CC6C4]/20 hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saved ? "¡Guardado!" : "Guardar"}
                </button>
                <button onClick={craftEmail} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm font-bold hover:bg-slate-700 transition flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Redactar email
                </button>
                <button onClick={preparePitch} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm font-bold hover:bg-slate-700 transition flex items-center gap-2">
                    <Target className="w-4 h-4" /> Preparar pitch
                </button>

                {/* ── Conversión a sede activa ── */}
                {prospect.stage !== "CERRADO" && (
                    <button
                        onClick={onConvert}
                        className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold border border-emerald-500/30 hover:bg-emerald-500/20 transition flex items-center gap-2"
                    >
                        <Building2 className="w-4 h-4" /> Convertir en cliente →
                    </button>
                )}
                {prospect.stage === "CERRADO" && (
                    <span className="px-3 py-2 rounded-lg bg-emerald-500/5 text-emerald-600 text-xs font-bold border border-emerald-500/10 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Cliente activo
                    </span>
                )}

                <button
                    onClick={async () => {
                        if (!confirm(`¿Eliminar "${prospect.name}" del pipeline? Esta acción no se puede deshacer.`)) return;
                        await fetch(`/api/admin/prospects/${prospect.id}`, { method: "DELETE" });
                        onDelete();
                    }}
                    className="ml-auto px-4 py-2 rounded-lg bg-rose-500/10 text-rose-400 text-sm font-bold border border-rose-500/20 hover:bg-rose-500/20 transition flex items-center gap-2"
                >
                    <X className="w-4 h-4" /> Eliminar
                </button>
            </div>
        </div>
    );
}

// ── Modal: Nuevo Prospecto ────────────────────────────────────────
const PR_MUNICIPALITIES = [
    "Aguadilla","Aibonito","Añasco","Arecibo","Arroyo","Barceloneta","Barranquitas",
    "Bayamón","Cabo Rojo","Caguas","Camuy","Canóvanas","Carolina","Cataño","Cayey",
    "Ceiba","Ciales","Cidra","Coamo","Comerío","Corozal","Culebra","Dorado","Fajardo",
    "Florida","Guánica","Guayama","Guayanilla","Guaynabo","Gurabo","Hatillo","Hormigueros",
    "Humacao","Isabela","Jayuya","Juana Díaz","Juncos","Lajas","Lares","Las Marías",
    "Las Piedras","Loíza","Luquillo","Manatí","Maricao","Maunabo","Mayagüez","Moca",
    "Morovis","Naguabo","Naranjito","Orocovis","Patillas","Peñuelas","Ponce","Quebradillas",
    "Rincón","Río Grande","Sabana Grande","Salinas","San Germán","San Juan","San Lorenzo",
    "San Sebastián","Santa Isabel","Toa Alta","Toa Baja","Trujillo Alto","Utuado",
    "Vega Alta","Vega Baja","Vieques","Villalba","Yabucoa","Yauco",
];

function NewProspectModal({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (p: Prospect) => void;
}) {
    const [form, setForm] = useState({
        name: "",
        municipality: "",
        contactName: "",
        phone: "",
        email: "",
        priority: "MEDIA",
        estimatedBeds: "",
        planInterest: "",
        notes: "",
        nextFollowUp: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/prospects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    estimatedBeds: form.estimatedBeds ? Number(form.estimatedBeds) : null,
                    planInterest: form.planInterest || null,
                    notes: form.notes || null,
                    nextFollowUp: form.nextFollowUp || null,
                    phone: form.phone || null,
                    email: form.email || null,
                    contactName: form.contactName || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                onCreated({
                    ...data.prospect,
                    lastContactAt: null,
                    assignedTo: null,
                });
            } else {
                setError(data.error || "Error al crear prospecto");
            }
        } catch {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <form
                onSubmit={submit}
                className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
                <header className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F6B78] to-[#3CC6C4] flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Nuevo Prospecto</h2>
                            <p className="text-xs text-slate-500">Se añade al pipeline en etapa PROSPECTO</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="p-5 space-y-5">
                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-3 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Sede */}
                    <Section title="Información de la sede">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre de la sede *" span={2}>
                                <input
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ej. Hogar Santa Rosa"
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Municipio *" span={2}>
                                <select
                                    required
                                    value={form.municipality}
                                    onChange={(e) => setForm({ ...form, municipality: e.target.value })}
                                    className={inputCls}
                                >
                                    <option value="">— Selecciona municipio —</option>
                                    {PR_MUNICIPALITIES.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                    </Section>

                    {/* Contacto */}
                    <Section title="Persona de contacto">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre del contacto">
                                <input
                                    value={form.contactName}
                                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                                    placeholder="Ej. María González"
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Teléfono">
                                <input
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="(787) 000-0000"
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Email" span={2}>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="contacto@hogar.com"
                                    className={inputCls}
                                />
                            </Field>
                        </div>
                    </Section>

                    {/* Pipeline */}
                    <Section title="Calificación inicial">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Prioridad">
                                <div className="flex gap-2">
                                    {["ALTA", "MEDIA", "BAJA"].map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setForm({ ...form, priority: p })}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                                                form.priority === p
                                                    ? PRIORITY_STYLES[p]
                                                    : "bg-slate-800/40 text-slate-500 border-slate-700 hover:border-slate-600"
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </Field>
                            <Field label="Plan de interés">
                                <select
                                    value={form.planInterest}
                                    onChange={(e) => setForm({ ...form, planInterest: e.target.value })}
                                    className={inputCls}
                                >
                                    <option value="">— Sin definir —</option>
                                    <option value="PRO">Zendity Completo — ${BED_PRICE}/cama</option>
                                </select>
                            </Field>
                            <Field label="Camas estimadas">
                                <input
                                    type="number"
                                    min={1}
                                    value={form.estimatedBeds}
                                    onChange={(e) => setForm({ ...form, estimatedBeds: e.target.value })}
                                    placeholder="Ej. 30"
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Próximo seguimiento">
                                <input
                                    type="date"
                                    value={form.nextFollowUp}
                                    onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })}
                                    className={`${inputCls} [color-scheme:dark]`}
                                />
                            </Field>
                            <Field label="Notas iniciales" span={2}>
                                <textarea
                                    rows={3}
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    placeholder="Contexto de cómo lo conociste, objeciones iniciales, etc."
                                    className={inputCls}
                                />
                            </Field>
                        </div>
                    </Section>
                </div>

                <footer className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4 flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {loading ? "Guardando…" : "Agregar al pipeline"}
                    </button>
                </footer>
            </form>
        </div>
    );
}

// =============== Tab 3 — Sedes Activas ===============
function SedesTab({ sedes, onCreated, onRefresh }: { sedes: Sede[]; onCreated: (s: Sede) => void; onRefresh?: () => void }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [manageSede, setManageSede] = useState<Sede | null>(null);

    // Como esta cada cliente: puesta en marcha y hallazgos del monitor. El
    // listado mostraba camas, ocupacion y facturacion —cuanto vendi— pero no si
    // la sede PUEDE OPERAR ni si su informacion dice la verdad. Se carga aparte
    // para no frenar la tabla: verificarSede hace varias consultas por sede.
    const [salud, setSalud] = useState<Record<string, any>>({});
    useEffect(() => {
        fetch("/api/admin/salud-sedes")
            .then(r => r.json())
            .then(j => {
                if (!j.success) return;
                const m: Record<string, any> = {};
                j.sedes.forEach((x: any) => { m[x.id] = x; });
                setSalud(m);
            })
            .catch(() => {});
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-white">Directorio de Sedes ({sedes.length})</h2>
                <button
                    onClick={() => setModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] text-white text-sm font-bold shadow-lg shadow-[#3CC6C4]/20 hover:brightness-110 transition flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Nueva Sede
                </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-950/60 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                        <tr>
                            <th className="text-left p-4">Sede</th>
                            {/* Decia "Plan" pero muestra camas x tarifa: es facturacion,
                                no plan. Y desde la tarifa unica el plan no significa nada. */}
                            <th className="text-center p-4">Facturación</th>
                            <th className="text-center p-4">Ocupación</th>
                            <th className="text-center p-4">Staff</th>
                            <th className="text-center p-4">MRR</th>
                            <th className="text-center p-4">Health</th>
                            <th className="text-center p-4">Operativa</th>
                            <th className="text-center p-4">Estado</th>
                            <th className="text-center p-4">Gestión</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {sedes.map((s) => {
                            const pct = s.capacity ? Math.round((s._count.patients / s.capacity) * 100) : 0;
                            return (
                                <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-white">{s.name}</p>
                                        <p className="text-[11px] text-slate-500 font-mono">{s.id.split("-")[0]}***</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        {(() => {
                                            const teorico = calculateMonthlyFee(s.capacity);
                                            const real = s.saasContract?.monthlyAmount;
                                            const desfase = real !== undefined && Math.abs(real - teorico) > 0.01;
                                            return (
                                                <span
                                                    title={desfase ? `El contrato factura $${real?.toLocaleString()} pero ${s.capacity} camas × $${BED_PRICE} = $${teorico.toLocaleString()}` : undefined}
                                                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
                                                        desfase
                                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                                            : "bg-slate-800 text-slate-300 border-slate-700"
                                                    }`}
                                                >
                                                    {s.capacity} camas · ${teorico.toLocaleString()}{desfase ? " ⚠" : ""}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-4 text-center text-slate-300">
                                        {s._count.patients} / {s.capacity} <span className="text-slate-600">({pct}%)</span>
                                    </td>
                                    <td className="p-4 text-center text-slate-300">{s._count.users}</td>
                                    <td className="p-4 text-center text-[#3CC6C4] font-bold">
                                        {s.saasContract ? fmtMoney(s.saasContract.monthlyAmount) : "—"}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${
                                                        s.healthScore > 75 ? "bg-emerald-500" : s.healthScore >= 50 ? "bg-amber-500" : "bg-rose-500"
                                                    }`}
                                                    style={{ width: `${s.healthScore}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-slate-300 w-8">{s.healthScore}</span>
                                        </div>
                                    </td>
                                    {/* Operativa — puesta en marcha y hallazgos del monitor.
                                        Convierte "cuantas camas vendi" en "como esta el cliente". */}
                                    <td className="p-4 text-center">
                                        {salud[s.id]?.error ? (
                                            <span className="text-[11px] text-slate-600">—</span>
                                        ) : salud[s.id] ? (
                                            <div className="space-y-1">
                                                <div
                                                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full inline-block ${
                                                        salud[s.id].puedeOperar
                                                            ? "bg-emerald-500/15 text-emerald-400"
                                                            : "bg-rose-500/15 text-rose-400"
                                                    }`}
                                                    title={
                                                        salud[s.id].puedeOperar
                                                            ? undefined
                                                            : `Le falta: ${salud[s.id].faltan.join(", ")}`
                                                    }
                                                >
                                                    {salud[s.id].completados}/{salud[s.id].total}
                                                </div>
                                                {(salud[s.id].criticos > 0 || salud[s.id].altos > 0) && (
                                                    <div className="text-[10px] font-bold">
                                                        {salud[s.id].criticos > 0 && (
                                                            <span className="text-rose-400">{salud[s.id].criticos} crítico{salud[s.id].criticos === 1 ? "" : "s"}</span>
                                                        )}
                                                        {salud[s.id].criticos > 0 && salud[s.id].altos > 0 && <span className="text-slate-600"> · </span>}
                                                        {salud[s.id].altos > 0 && (
                                                            <span className="text-amber-400">{salud[s.id].altos} alto{salud[s.id].altos === 1 ? "" : "s"}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-slate-600 animate-pulse">…</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        {s.isActive && s.subscriptionStatus === "ACTIVE" ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20">
                                                <AlertTriangle className="w-3 h-3" /> {s.subscriptionStatus}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => setManageSede(s)}
                                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors"
                                        >
                                            Gestionar
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {sedes.length === 0 && (
                            <tr><td colSpan={8} className="p-12 text-center text-slate-500">No hay sedes todavía.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modalOpen && (
                <NewSedeModal
                    onClose={() => setModalOpen(false)}
                    onCreated={(s) => { onCreated(s); setModalOpen(false); }}
                />
            )}

            {manageSede && (
                <ManageSedeModal
                    sede={manageSede}
                    onClose={() => setManageSede(null)}
                    onChanged={() => { onRefresh?.(); setManageSede(null); }}
                />
            )}
        </div>
    );
}

/**
 * Gestión comercial de una sede: suspender por facturación, reactivar,
 * renovar licencia, cambiar plan, cerrar y restablecer el PIN del Director.
 *
 * Todo lo que aquí se toca es COMERCIAL. El staff del hogar (cuidadoras,
 * enfermeras) lo gestiona el propio Director desde /hr/staff — Zendity solo
 * destraba al titular cuando pierde su acceso.
 */
function ManageSedeModal({
    sede, onClose, onChanged,
}: { sede: Sede; onClose: () => void; onChanged: () => void }) {
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    const [months, setMonths] = useState("12");
    const [camas, setCamas] = useState(String(sede.capacity ?? ""));
    const [pin, setPin] = useState("");

    const suspended = !sede.isActive || sede.subscriptionStatus !== "ACTIVE";

    // El botón servía solo para CAMBIAR la capacidad y se bloqueaba si el número
    // no variaba. Pero el caso real más común es el inverso: la capacidad está
    // bien y lo que quedó viejo es el CONTRATO (Cupey: 50 autorizadas, contrato
    // por 35). Ahí el botón aparecía muerto sin explicar por qué.
    const cambiaCapacidad = !!camas && Number(camas) !== sede.capacity;
    const contratoDesalineado =
        !!sede.saasContract && Math.abs(sede.saasContract.monthlyAmount - calculateMonthlyFee(sede.capacity)) > 0.01;

    async function run(action: string, extra: Record<string, unknown> = {}, confirmMsg?: string) {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        setBusy(action); setMsg(null);
        try {
            const res = await fetch(`/api/admin/sedes/${sede.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...extra }),
            });
            const data = await res.json();
            if (data.success) {
                setMsg({ kind: "ok", text: data.message || "Listo" });
                if (action !== "RESET_DIRECTOR_PIN") setTimeout(onChanged, 1200);
                else setPin("");
            } else {
                setMsg({ kind: "err", text: data.error || "Error" });
            }
        } catch {
            setMsg({ kind: "err", text: "Error de red" });
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-800 flex items-start justify-between sticky top-0 bg-slate-900 z-10">
                    <div>
                        <h2 className="text-xl font-black text-white">{sede.name}</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {sede.capacity} camas · ${calculateMonthlyFee(sede.capacity).toLocaleString()}/mes · {sede.subscriptionStatus}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {msg && (
                        <div className={`rounded-xl px-4 py-3 text-sm font-bold border ${
                            msg.kind === "ok"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>{msg.text}</div>
                    )}

                    {/* Servicio */}
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Servicio</h3>
                        {suspended ? (
                            <button
                                onClick={() => run("REACTIVATE")}
                                disabled={!!busy}
                                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition disabled:opacity-50"
                            >
                                {busy === "REACTIVATE" ? "Reactivando…" : "Reactivar servicio"}
                            </button>
                        ) : (
                            <>
                                <a
                                    href={`/api/admin/sedes/${sede.id}/continuity-pdf`}
                                    className="block w-full py-3 mb-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm text-center transition"
                                >
                                    ↓ Descargar hoja de continuidad (antes de suspender)
                                </a>
                                <button
                                    onClick={() => run("SUSPEND", {},
                                        `¿Suspender ${sede.name}?\n\nEl hogar perderá acceso INMEDIATAMENTE y deberá operar en papel. Descarga y envía la hoja de continuidad antes de continuar.`)}
                                    disabled={!!busy}
                                    className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition disabled:opacity-50"
                                >
                                    {busy === "SUSPEND" ? "Suspendiendo…" : "Suspender por facturación"}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Licencia */}
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Licencia</h3>
                        <div className="flex gap-2">
                            <select
                                value={months}
                                onChange={(e) => setMonths(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none focus:ring-2 focus:ring-[#3CC6C4]"
                            >
                                {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} mes{m > 1 ? "es" : ""}</option>)}
                            </select>
                            <button
                                onClick={() => run("RENEW_LICENSE", { months: Number(months) })}
                                disabled={!!busy}
                                className="flex-1 py-2.5 rounded-xl bg-[#0F6B78] hover:brightness-110 text-white font-bold text-sm transition disabled:opacity-50"
                            >
                                {busy === "RENEW_LICENSE" ? "Renovando…" : "Renovar licencia"}
                            </button>
                        </div>
                    </div>

                    {/* Tarifa — depende de las camas autorizadas, no de un plan.
                        Cambiar la capacidad cambia lo que el hogar paga, por eso
                        pide confirmación con el monto nuevo a la vista. */}
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Camas autorizadas</h3>
                        <p className="text-[11px] text-slate-500 mb-3">
                            Capacidad de la licencia del Departamento de la Familia. Define la tarifa: ${BED_PRICE}/cama.
                        </p>
                        {contratoDesalineado && !cambiaCapacidad && (
                            <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                                <p className="text-[11px] text-amber-300 font-bold">
                                    El contrato factura ${sede.saasContract!.monthlyAmount.toLocaleString()} por {sede.saasContract!.beds} camas.
                                </p>
                                <p className="text-[11px] text-amber-200/70 mt-0.5">
                                    Con {sede.capacity} camas autorizadas serían ${calculateMonthlyFee(sede.capacity).toLocaleString()}.
                                    Si es un acuerdo especial, déjalo así.
                                </p>
                            </div>
                        )}
                        <div className="flex gap-2 items-center">
                            <input
                                type="number" min={1} max={500}
                                value={camas}
                                onChange={(e) => setCamas(e.target.value.replace(/\D/g, ""))}
                                className="w-28 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none focus:ring-2 focus:ring-[#3CC6C4]"
                            />
                            <span className="text-sm text-slate-400 font-bold">
                                → ${calculateMonthlyFee(Number(camas) || 0).toLocaleString()}/mes
                            </span>
                            <button
                                onClick={() => run("CHANGE_CAPACITY", { capacity: Number(camas) },
                                    cambiaCapacidad
                                        ? `¿Cambiar la capacidad de ${sede.name} a ${camas} camas?\n\nLa tarifa mensual pasa de $${calculateMonthlyFee(sede.capacity).toLocaleString()} a $${calculateMonthlyFee(Number(camas) || 0).toLocaleString()}.`
                                        : `¿Alinear el contrato de ${sede.name} a ${camas} camas?\n\nLa mensualidad pasa de $${(sede.saasContract?.monthlyAmount ?? 0).toLocaleString()} a $${calculateMonthlyFee(Number(camas) || 0).toLocaleString()}.`)}
                                disabled={!!busy || !camas || (!cambiaCapacidad && !contratoDesalineado)}
                                className="ml-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm transition disabled:opacity-40"
                            >
                                {busy === "CHANGE_CAPACITY" ? "Guardando…" : cambiaCapacidad ? "Actualizar" : "Alinear contrato"}
                            </button>
                        </div>
                    </div>

                    {/* Acceso del titular */}
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Acceso del Director</h3>
                        <p className="text-[11px] text-slate-500 mb-3">
                            Solo para destrabar al titular. El resto del equipo lo gestiona el Director en su sede.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text" inputMode="numeric" maxLength={6}
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                                placeholder="PIN nuevo (4-6 dígitos)"
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:ring-2 focus:ring-[#3CC6C4]"
                            />
                            <button
                                onClick={() => run("RESET_DIRECTOR_PIN", { pinCode: pin })}
                                disabled={!!busy || !/^\d{4,6}$/.test(pin)}
                                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm transition disabled:opacity-40"
                            >
                                Restablecer
                            </button>
                        </div>
                    </div>

                    {/* Fin de contrato */}
                    <div className="pt-4 border-t border-slate-800">
                        <button
                            onClick={() => run("CLOSE", {},
                                `¿CERRAR ${sede.name} definitivamente?\n\nEs el fin del contrato: el hogar pierde el acceso por completo. Asegúrate de haberle entregado su información antes.`)}
                            disabled={!!busy || !sede.isActive}
                            className="w-full py-2.5 rounded-xl bg-transparent hover:bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-sm transition disabled:opacity-40"
                        >
                            {busy === "CLOSE" ? "Cerrando…" : "Cerrar sede (fin de contrato)"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

type SedeFormPrefill = {
    name?: string;
    directorName?: string;
    directorEmail?: string;
    ownerPhone?: string;
    plan?: string;
    capacity?: string;
    beds?: string;
};

function NewSedeModal({
    onClose,
    onCreated,
    prefill,
    prospectId,
}: {
    onClose: () => void;
    onCreated: (s: Sede) => void;
    prefill?: SedeFormPrefill;
    prospectId?: string;
}) {
    const isConversion = !!prospectId;

    // Normaliza el plan del prefill (acepta nombres comerciales o códigos internos)
    const initialPlan = normalizePlan(prefill?.plan ?? "PRO") ?? "PRO";

    const [form, setForm] = useState({
        name: prefill?.name ?? "",
        capacity: prefill?.capacity ?? "50",
        licenseMonths: "12",
        // Telefono y direccion DE LA SEDE. Salen impresos en el formulario de
        // traslado de emergencia que va con el residente al hospital; sin ellos
        // ese papel llega sin a quien llamar. Las dos sedes de Vivid se crearon
        // sin ninguno de los dos porque el alta no los pedia.
        phone: "",
        directorName: prefill?.directorName ?? "",
        directorEmail: prefill?.directorEmail ?? "",
        directorPinCode: "",
        ownerPhone: prefill?.ownerPhone ?? "",
        taxId: "",
        billingAddress: "",
        // Valor unico: ya no se escoge. Ver el comentario del formulario.
        plan: 'ZENDITY',
        // Auto-prellena el precio según el plan elegido
        pricePerBed: String(PLAN_PRICING[initialPlan].pricePerBed),
        beds: prefill?.beds ?? "",
        monthlyAmount: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Al crear una sede pasan varias cosas y ninguna se contaba: el modal se
    // cerraba y ya. Quien da de alta no sabia que el BAA quedo pendiente ni que
    // hasta firmarlo la sede no puede registrar residentes.
    const [creada, setCreada] = useState<{ nombre: string; director: string; camas: number; mensual: number } | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/sedes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                // Si viene de un prospecto, marcarlo como CERRADO
                if (prospectId) {
                    await fetch(`/api/admin/prospects/${prospectId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ stage: "CERRADO" }),
                    });
                }
                const hq = data.onboarding.hq;
                setCreada({
                    nombre: hq.name,
                    director: form.directorEmail,
                    camas: Number(form.capacity) || 0,
                    mensual: data.onboarding.contract?.monthlyAmount ?? 0,
                });
                onCreated({
                    ...hq,
                    saasContract: data.onboarding.contract,
                    _count: { patients: 0, users: 1 },
                    lastActivity: null,
                    medsToday: 0,
                    healthScore: hq.licenseActive ? 25 : 0 + (data.onboarding.contract ? 25 : 0),
                } as Sede);
            } else {
                setError(data.error || "Error en onboarding");
            }
        } catch (e) {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            {creada ? (
                /* Que se creo y que falta. Antes el modal se cerraba y ya: quien
                   daba de alta no sabia que el BAA quedaba pendiente, ni que
                   hasta firmarlo la sede no puede registrar ni un residente. */
                <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-7 space-y-5">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Sede creada</p>
                        <h2 className="text-2xl font-black text-white mt-1">{creada.nombre}</h2>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-400">Director</span>
                            <span className="text-white font-bold">{creada.director}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-400">Capacidad</span>
                            <span className="text-white font-bold">{creada.camas} camas</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-400">Mensualidad</span>
                            <span className="text-white font-bold">${creada.mensual.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                        <p className="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-1.5">Falta antes de operar</p>
                        <p className="text-sm text-amber-100/90 leading-relaxed">
                            El <strong>Acuerdo de Asociado Comercial (BAA)</strong> quedó pendiente de firma.
                            Hasta que el director lo firme, esta sede <strong>no puede registrar residentes</strong>.
                            Lo encuentra en su menú lateral, en <strong>Acuerdos</strong>.
                        </p>
                    </div>

                    <p className="text-[13px] text-slate-400 leading-relaxed">
                        Después necesitará registrar cuidadoras y personal de enfermería o supervisión.
                        Su avance se ve en <strong className="text-slate-300">Puesta en Marcha</strong>.
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] text-white font-black"
                    >
                        Entendido
                    </button>
                </div>
            ) : (
            <form
                onSubmit={submit}
                className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
                <header className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isConversion ? "bg-gradient-to-br from-emerald-600 to-[#3CC6C4]" : "bg-gradient-to-br from-[#0F6B78] to-[#3CC6C4]"}`}>
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">
                                {isConversion ? `Activar sede — ${form.name}` : "Nueva Sede"}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {isConversion
                                    ? "Datos pre-llenados desde el pipeline — revisa y completa"
                                    : "Onboarding atómico: HQ + Director + Contrato"}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="p-5 space-y-5">
                    {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-3 text-sm">{error}</div>}

                    {isConversion && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            <div className="text-sm">
                                <p className="font-bold text-emerald-300">Datos pre-llenados desde el pipeline</p>
                                <p className="text-emerald-400/70 text-xs mt-1">
                                    Revisa nombre, contacto y plan. Solo falta el <strong>PIN inicial</strong> y opcionalmente los datos del contrato.
                                    Al confirmar se crea la cuenta del Director y se le envía el email de bienvenida automáticamente.
                                </p>
                            </div>
                        </div>
                    )}

                    <Section title="Sede">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre" span={2}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
                            <Field label="Capacidad (camas)"><input required type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={inputCls} /></Field>
                            <Field label="Meses de licencia"><input required type="number" min={1} value={form.licenseMonths} onChange={(e) => setForm({ ...form, licenseMonths: e.target.value })} className={inputCls} /></Field>
                            <Field label="Teléfono de la sede" span={2}><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="787-000-0000 — sale en el formulario de traslado" className={inputCls} /></Field>
                            <Field label="Dirección" span={2}><input value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} placeholder="Dirección física del hogar" className={inputCls} /></Field>
                        </div>
                    </Section>

                    <Section title="Director / Dueño">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre"><input value={form.directorName} onChange={(e) => setForm({ ...form, directorName: e.target.value })} className={inputCls} /></Field>
                            <Field label="Email *"><input required type="email" value={form.directorEmail} onChange={(e) => setForm({ ...form, directorEmail: e.target.value })} className={inputCls} /></Field>
                            <Field label="PIN inicial *"><input required value={form.directorPinCode} onChange={(e) => setForm({ ...form, directorPinCode: e.target.value })} className={inputCls} placeholder="4-6 dígitos" /></Field>
                            <Field label="Teléfono"><input value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} className={inputCls} /></Field>
                        </div>
                    </Section>

                    <Section title="Contrato SaaS (opcional)">
                        <div className="grid grid-cols-2 gap-3">
                            {/* Aqui habia un selector de plan —Esencial, Profesional,
                                Corporativo—. La tarifa es unica desde el commit
                                "$12.49/cama, se eliminan los planes diferenciados": los
                                tres mostraban "Zendity Completo" y cobraban lo mismo.
                                Un plan que no cambia ni el precio ni las funciones solo
                                genera preguntas en una factura. Se retira de la UI; el
                                campo sigue en la base con lo que ya tienen las sedes
                                —borrarlo seria una migracion destructiva sin ganancia—
                                y el alta ahora graba siempre el mismo valor. */}
                            <Field label={`Precio por cama (estándar $${PLAN_PRICING[form.plan]?.pricePerBed ?? 0})`}><input type="number" min={0} step="0.01" value={form.pricePerBed} onChange={(e) => setForm({ ...form, pricePerBed: e.target.value })} className={inputCls} /></Field>
                            <Field label="Camas facturadas"><input type="number" min={0} value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} className={inputCls} /></Field>
                            <Field label="Mensualidad total ($)"><input type="number" min={0} step="0.01" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} className={inputCls} placeholder="Dejar en 0 si no crea contrato" /></Field>
                        </div>
                    </Section>
                </div>

                <footer className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4 flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800">Cancelar</button>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`px-5 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2 ${
                            isConversion
                                ? "bg-gradient-to-r from-emerald-600 to-[#3CC6C4] shadow-lg shadow-emerald-500/20"
                                : "bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] shadow-lg shadow-[#3CC6C4]/20"
                        }`}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                        {loading ? "Activando…" : isConversion ? "Activar sede y notificar director" : "Crear sede"}
                    </button>
                </footer>
            </form>
            )}
        </div>
    );
}

// =============== Tab 4 — Comunicaciones ===============
const CATEGORIES = [
    { id: "ANNOUNCEMENT", label: "Aviso General", icon: Globe, color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
    { id: "BILLING",      label: "Facturación",   icon: ReceiptText, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    { id: "SUPPORT",      label: "Soporte",        icon: BookOpen, color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
    { id: "MAINTENANCE",  label: "Mantenimiento",  icon: Wrench, color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

function CommsTab({
    messages,
    sedes,
    onSent,
    onMarkRead,
}: {
    messages: ZendityMessage[];
    sedes: Sede[];
    onSent: (msg: ZendityMessage) => void;
    onMarkRead: (id: string) => void;
}) {
    const [form, setForm] = useState({
        targetHqId: "" as string, // "" = broadcast
        category: "ANNOUNCEMENT" as CategoryId,
        title: "",
        body: "",
    });
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setSendError(null);
        try {
            const res = await fetch("/api/admin/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetHqId: form.targetHqId || null,
                    title: form.title,
                    body: form.body,
                    category: form.category,
                }),
            });
            const data = await res.json();
            if (data.success) {
                onSent(data.message);
                setForm({ targetHqId: "", category: "ANNOUNCEMENT", title: "", body: "" });
            } else {
                setSendError(data.error || "Error enviando");
            }
        } catch {
            setSendError("Error de conexión");
        } finally {
            setSending(false);
        }
    };

    const markRead = async (id: string) => {
        onMarkRead(id);
        await fetch("/api/admin/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: id }),
        });
    };

    const unread = messages.filter((m) => !m.isRead).length;

    return (
        <div className="space-y-8">
            {/* Métricas rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniMetric label="Total enviados" value={messages.length} />
                <MiniMetric label="Sin leer (sedes)" value={unread} accent={unread > 0 ? "amber" : "slate"} />
                <MiniMetric label="Broadcasts" value={messages.filter((m) => !m.targetHqId).length} accent="aqua" />
                <MiniMetric label="Específicos" value={messages.filter((m) => !!m.targetHqId).length} accent="teal" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ── Formulario de redacción ── */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0F6B78]/20 flex items-center justify-center">
                            <Send className="w-4 h-4 text-[#3CC6C4]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white">Redactar comunicado</h2>
                            <p className="text-[11px] text-slate-500">Zéndity Corp → sedes clientes</p>
                        </div>
                    </div>

                    <form onSubmit={send} className="p-6 space-y-5">
                        {sendError && (
                            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-3 text-sm">
                                {sendError}
                            </div>
                        )}

                        {/* Destinatario */}
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                                Destinatario
                            </label>
                            <select
                                value={form.targetHqId}
                                onChange={(e) => setForm({ ...form, targetHqId: e.target.value })}
                                className={inputCls}
                            >
                                <option value="">📢 Todas las sedes (broadcast)</option>
                                {sedes.filter((s) => s.isActive).map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Categoría */}
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                                Categoría
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((c) => {
                                    const CIcon = c.icon;
                                    const active = form.category === c.id;
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setForm({ ...form, category: c.id })}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                                active
                                                    ? c.color
                                                    : "text-slate-500 border-slate-700 bg-slate-800/40 hover:border-slate-600"
                                            }`}
                                        >
                                            <CIcon className="w-3 h-3" /> {c.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Asunto */}
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                                Asunto
                            </label>
                            <input
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Ej. Actualización del sistema — 3 de junio"
                                className={inputCls}
                            />
                        </div>

                        {/* Cuerpo */}
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                                Mensaje
                            </label>
                            <textarea
                                required
                                rows={6}
                                value={form.body}
                                onChange={(e) => setForm({ ...form, body: e.target.value })}
                                placeholder="Escribe el mensaje completo aquí…"
                                className={inputCls}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={sending}
                            className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] text-white font-bold text-sm shadow-lg shadow-[#3CC6C4]/20 hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sending ? "Enviando…" : "Enviar comunicado"}
                        </button>
                    </form>
                </div>

                {/* ── Historial de mensajes ── */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#0F6B78]/20 flex items-center justify-center">
                                <MessageSquare className="w-4 h-4 text-[#3CC6C4]" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-white">Historial</h2>
                                <p className="text-[11px] text-slate-500">{messages.length} mensaje{messages.length !== 1 ? "s" : ""} enviados</p>
                            </div>
                        </div>
                        {unread > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-black border border-amber-500/20 uppercase tracking-widest">
                                {unread} sin leer
                            </span>
                        )}
                    </div>

                    <div className="divide-y divide-slate-800 max-h-[560px] overflow-y-auto">
                        {messages.length === 0 ? (
                            <p className="text-center text-slate-500 text-sm py-12">No hay mensajes enviados todavía.</p>
                        ) : (
                            messages.map((msg) => {
                                const cat = CATEGORIES.find((c) => c.id === msg.category) ?? CATEGORIES[0];
                                const CatIcon = cat.icon;
                                const expanded = expandedId === msg.id;
                                return (
                                    <div key={msg.id} className={`transition-colors ${!msg.isRead ? "bg-amber-500/5" : ""}`}>
                                        <button
                                            onClick={() => {
                                                setExpandedId(expanded ? null : msg.id);
                                                if (!msg.isRead) markRead(msg.id);
                                            }}
                                            className="w-full text-left px-5 py-4 hover:bg-slate-800/30 transition-colors"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-0.5 p-1.5 rounded-lg border ${cat.color} shrink-0`}>
                                                    <CatIcon className="w-3 h-3" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className={`text-sm font-bold truncate ${!msg.isRead ? "text-white" : "text-slate-300"}`}>
                                                            {msg.title}
                                                        </p>
                                                        {!msg.isRead && (
                                                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                        <span>{msg.targetHq ? msg.targetHq.name : "📢 Todas las sedes"}</span>
                                                        <span>·</span>
                                                        <span>{relativeTime(msg.createdAt)}</span>
                                                        <span>·</span>
                                                        {msg.isRead
                                                            ? <span className="text-emerald-500 flex items-center gap-1"><Eye className="w-3 h-3" /> Leído</span>
                                                            : <span className="text-amber-400 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Sin leer</span>
                                                        }
                                                    </div>
                                                </div>
                                                {expanded ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-1" />}
                                            </div>
                                        </button>
                                        {expanded && (
                                            <div className="px-5 pb-5 -mt-1">
                                                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                    {msg.body}
                                                </div>
                                                {msg.readAt && (
                                                    <p className="text-[11px] text-slate-600 mt-2">
                                                        Leído el {new Date(msg.readAt).toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// =============== Primitivas ===============
const inputCls = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3CC6C4] transition-colors";

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 }) {
    return (
        <div className={span === 2 ? "col-span-2" : ""}>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">{label}</label>
            {children}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-black text-[#3CC6C4] border-b border-slate-800 pb-2">{title}</h3>
            {children}
        </div>
    );
}

function KpiCard({
    label,
    value,
    suffix,
    color,
    icon: Icon,
}: {
    label: string;
    value: string;
    suffix?: string;
    color: "emerald" | "teal" | "aqua" | "amber" | "rose" | "slate";
    icon: any;
}) {
    const palette: Record<string, { text: string; bg: string; border: string }> = {
        emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
        teal: { text: "text-[#3CC6C4]", bg: "bg-[#0F6B78]/20", border: "border-[#0F6B78]/40" },
        aqua: { text: "text-[#3CC6C4]", bg: "bg-[#3CC6C4]/10", border: "border-[#3CC6C4]/30" },
        amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
        rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
        slate: { text: "text-slate-300", bg: "bg-slate-800/50", border: "border-slate-700" },
    };
    const p = palette[color];
    return (
        <div className={`bg-slate-900/60 border ${p.border} rounded-2xl p-5`}>
            <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{label}</p>
                <div className={`w-8 h-8 rounded-lg ${p.bg} ${p.text} flex items-center justify-center`}><Icon className="w-4 h-4" /></div>
            </div>
            <p className={`text-3xl font-black ${p.text}`}>{value}</p>
            {suffix && <p className="text-xs text-slate-500 font-medium mt-1">{suffix}</p>}
        </div>
    );
}

function HealthBar({ score }: { score: number }) {
    const color = score > 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500";
    const textColor = score > 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Health</p>
                <p className={`text-xs font-black ${textColor}`}>{score}/100</p>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
            </div>
        </div>
    );
}

function MiniMetric({ label, value, accent = "slate" }: { label: string; value: number; accent?: "slate" | "aqua" | "amber" | "emerald" | "teal" }) {
    const colors: Record<string, string> = {
        slate: "text-white",
        aqua: "text-[#3CC6C4]",
        amber: "text-amber-400",
        emerald: "text-emerald-400",
        teal: "text-[#0F6B78]",
    };
    return (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
            <p className={`text-2xl font-black ${colors[accent]}`}>{value}</p>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mt-1">{label}</p>
        </div>
    );
}

function FilterPill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                active
                    ? "bg-[#3CC6C4] text-slate-950 border-[#3CC6C4]"
                    : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-600"
            }`}
        >
            {children}
        </button>
    );
}

// =============== Tab 5 — Legal & SLA ===============
function LegalTab() {
    const cards = [
        {
            icon: "📄",
            title: "Acuerdos BAA (HIPAA)",
            desc: "Gestiona los Business Associate Agreements con cada sede. Requerido por la Ley HIPAA para el manejo de PHI.",
            href: "/admin/baa",
            // Antes: "2 pendientes" escrito a mano, el mismo numero hubiera lo
            // que hubiera. Ahora la pagina lee AcuerdoSede y cuenta de verdad.
            badge: "Ver estado",
            badgeColor: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
            cta: "Gestionar BAAs →",
        },
        // Aqui habia una tarjeta "Acuerdo de Nivel de Servicio (SLA)" que
        // llevaba a /admin/sla: 469 lineas estaticas prometiendo 99.5% de uptime
        // y tiempos de respuesta, sin medir NADA. Se retira junto con la pagina.
        // Prometer un SLA que no se mide es peor que no tener SLA: el dia que un
        // cliente reclame, no hay con que responderle ni a favor ni en contra.
        // Cuando exista medicion real —/api/health mas el monitor externo— vuelve.

        {
            icon: "✅",
            title: "Onboarding de Nuevas Sedes",
            desc: "Checklist guiado que cada director sigue para configurar Zéndity paso a paso después de contratar.",
            href: "/corporate/onboarding",
            badge: "En producción",
            badgeColor: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
            cta: "Ver checklist →",
        },
        {
            icon: "🎫",
            title: "Tickets de Soporte",
            desc: "Solicitudes de soporte enviadas desde todas las sedes. Gestiona BUGs, preguntas y peticiones de features.",
            href: "/admin/support",
            badge: null,
            badgeColor: "",
            cta: "Ver tickets →",
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white">Legal & Soporte</h2>
                <p className="text-sm text-slate-500 mt-1">Documentos legales, nivel de servicio y atención a sedes</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cards.map((c) => (
                    <Link
                        key={c.href}
                        href={c.href}
                        className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 hover:border-[#3CC6C4]/40 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <span className="text-3xl">{c.icon}</span>
                            {c.badge && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badgeColor}`}>
                                    {c.badge}
                                </span>
                            )}
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-[#3CC6C4] transition-colors mb-1">
                            {c.title}
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed mb-4">{c.desc}</p>
                        <span className="text-sm font-semibold text-[#3CC6C4]">{c.cta}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}

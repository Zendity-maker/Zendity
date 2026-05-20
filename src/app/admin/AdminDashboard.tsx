"use client";

import { useEffect, useMemo, useState } from "react";
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
    const [tab, setTab] = useState<"overview" | "pipeline" | "sedes" | "comunicaciones">("overview");
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
                        {tab === "pipeline" && <PipelineTab prospects={prospects} setProspects={setProspects} />}
                        {tab === "sedes" && <SedesTab sedes={sedes} onCreated={(s) => setSedes((prev) => [s, ...prev])} />}
                        {tab === "comunicaciones" && (
                            <CommsTab
                                messages={messages}
                                sedes={sedes}
                                onSent={(msg) => setMessages((prev) => [msg, ...prev])}
                                onMarkRead={(id) => setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isRead: true, readAt: new Date().toISOString() } : m))}
                            />
                        )}
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

    return (
        <div className="space-y-10">
            {/* Fila 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard label="MRR" value={fmtMoney(overview.mrr)} suffix="/ mes" color={overview.mrr > 0 ? "emerald" : "slate"} icon={DollarSign} />
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
                                        {s.subscriptionPlan}
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
}: {
    prospects: Prospect[];
    setProspects: React.Dispatch<React.SetStateAction<Prospect[]>>;
}) {
    const [filter, setFilter] = useState<string>("ALL");
    const [expandedId, setExpandedId] = useState<string | null>(null);

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

    return (
        <div className="space-y-8">
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

                            {expanded && <ProspectEditor prospect={p} onUpdate={(patch) => updateProspect(p.id, patch)} />}
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <p className="text-center text-sm text-slate-500 py-10">No hay prospectos que coincidan con el filtro.</p>
                )}
            </div>
        </div>
    );
}

function ProspectEditor({
    prospect,
    onUpdate,
}: {
    prospect: Prospect;
    onUpdate: (patch: Partial<Prospect>) => void;
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
            </div>
        </div>
    );
}

// =============== Tab 3 — Sedes Activas ===============
function SedesTab({ sedes, onCreated }: { sedes: Sede[]; onCreated: (s: Sede) => void }) {
    const [modalOpen, setModalOpen] = useState(false);

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
                            <th className="text-center p-4">Plan</th>
                            <th className="text-center p-4">Ocupación</th>
                            <th className="text-center p-4">Staff</th>
                            <th className="text-center p-4">MRR</th>
                            <th className="text-center p-4">Health</th>
                            <th className="text-center p-4">Estado</th>
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
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                            {s.subscriptionPlan}
                                        </span>
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
                                </tr>
                            );
                        })}
                        {sedes.length === 0 && (
                            <tr><td colSpan={7} className="p-12 text-center text-slate-500">No hay sedes todavía.</td></tr>
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
        </div>
    );
}

function NewSedeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Sede) => void }) {
    const [form, setForm] = useState({
        name: "",
        capacity: "50",
        licenseMonths: "12",
        directorName: "",
        directorEmail: "",
        directorPinCode: "",
        ownerPhone: "",
        taxId: "",
        billingAddress: "",
        plan: "PRO",
        pricePerBed: "",
        beds: "",
        monthlyAmount: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                // reconstruir el objeto Sede con defaults mínimos — el GET /sedes se volverá a hacer al recargar
                const hq = data.onboarding.hq;
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
            <form
                onSubmit={submit}
                className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
                <header className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F6B78] to-[#3CC6C4] flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Nueva Sede</h2>
                            <p className="text-xs text-slate-500">Onboarding atómico: HQ + Director + Contrato</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="p-5 space-y-5">
                    {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-3 text-sm">{error}</div>}

                    <Section title="Sede">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre" span={2}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
                            <Field label="Capacidad (camas)"><input required type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={inputCls} /></Field>
                            <Field label="Meses de licencia"><input required type="number" min={1} value={form.licenseMonths} onChange={(e) => setForm({ ...form, licenseMonths: e.target.value })} className={inputCls} /></Field>
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
                            <Field label="Plan">
                                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className={inputCls}>
                                    <option value="LITE">LITE</option>
                                    <option value="PRO">PRO</option>
                                    <option value="ENTERPRISE">ENTERPRISE</option>
                                </select>
                            </Field>
                            <Field label="Precio por cama"><input type="number" min={0} step="0.01" value={form.pricePerBed} onChange={(e) => setForm({ ...form, pricePerBed: e.target.value })} className={inputCls} /></Field>
                            <Field label="Camas facturadas"><input type="number" min={0} value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} className={inputCls} /></Field>
                            <Field label="Mensualidad total ($)"><input type="number" min={0} step="0.01" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} className={inputCls} placeholder="Dejar en 0 si no crea contrato" /></Field>
                        </div>
                    </Section>
                </div>

                <footer className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4 flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800">Cancelar</button>
                    <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#0F6B78] to-[#3CC6C4] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {loading ? "Creando..." : "Crear sede"}
                    </button>
                </footer>
            </form>
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

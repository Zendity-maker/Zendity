import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    Shield,
    Clock,
    Zap,
    BarChart3,
    Printer,
    Download,
    CheckCircle2,
    AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ─── Tipos ──────────────────────────────────────────────────────────────────
type SeveridadRow = {
    nivel: string;
    etiqueta: string;
    descripcion: string;
    respuesta: string;
    resolucion: string;
    color: string;
};

type CreditoRow = {
    condicion: string;
    credito: string;
};

// ─── Datos estáticos ─────────────────────────────────────────────────────────
const SEVERIDADES: SeveridadRow[] = [
    {
        nivel: "P1",
        etiqueta: "Crítico",
        descripcion: "Sistema completamente caído — ningún usuario puede acceder a la plataforma",
        respuesta: "30 minutos",
        resolucion: "4 horas",
        color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    },
    {
        nivel: "P2",
        etiqueta: "Alto",
        descripcion: "Función principal degradada — eMAR, horario o autenticación con fallos parciales",
        respuesta: "2 horas",
        resolucion: "24 horas",
        color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
        nivel: "P3",
        etiqueta: "Medio",
        descripcion: "Función secundaria con errores — reportes, portal familiar, Academy",
        respuesta: "8 horas",
        resolucion: "72 horas",
        color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    },
    {
        nivel: "P4",
        etiqueta: "Bajo",
        descripcion: "Problema cosmético o de usabilidad sin impacto operacional",
        respuesta: "48 horas",
        resolucion: "2 semanas",
        color: "text-slate-400 bg-slate-700/40 border-slate-600",
    },
];

const CREDITOS: CreditoRow[] = [
    { condicion: "Uptime mensual < 99.5% y ≥ 99.0%", credito: "10% del monto mensual" },
    { condicion: "Uptime mensual < 99.0% y ≥ 95.0%", credito: "25% del monto mensual" },
    { condicion: "Uptime mensual < 95.0%", credito: "50% del monto mensual" },
];

// ─── Componentes de UI ───────────────────────────────────────────────────────
function SectionCard({
    title,
    icon: Icon,
    children,
    accent = "teal",
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    accent?: "teal" | "amber" | "rose" | "emerald";
}) {
    const colors: Record<string, string> = {
        teal: "text-teal-400 bg-teal-600/10 border-teal-600/20",
        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    };

    return (
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${colors[accent]}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-white">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </section>
    );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${color}`}>
            {children}
        </span>
    );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default async function SLAPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "SUPER_ADMIN") {
        redirect("/");
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200">
            {/* Header */}
            <header className="border-b border-slate-800/80 bg-[#0f172a]/90 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-900/40">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
                                Acuerdo de Nivel de Servicio (SLA)
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Compromisos de disponibilidad y soporte de Zéndity
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 border border-slate-700">
                            Versión 2.0 — Enero 2025
                        </span>
                        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-teal-700 to-teal-500 text-white shadow-lg shadow-teal-900/30">
                            Super Admin
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-8 py-10 pb-20 space-y-8">

                {/* ── Sección 1: Disponibilidad ──────────────────────────────── */}
                <SectionCard title="Disponibilidad del Servicio" icon={Shield} accent="teal">
                    <div className="space-y-6">
                        {/* Uptime garantizado */}
                        <div className="flex items-start gap-5 bg-teal-600/10 border border-teal-600/20 rounded-xl p-5">
                            <div className="text-center shrink-0">
                                <p className="text-4xl font-black text-teal-400">99.5%</p>
                                <p className="text-[10px] uppercase tracking-widest text-teal-400/70 font-bold mt-1">
                                    Uptime mensual
                                </p>
                            </div>
                            <div className="border-l border-teal-600/20 pl-5">
                                <p className="text-sm font-bold text-white mb-1">
                                    Disponibilidad garantizada
                                </p>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Zéndity garantiza un uptime mensual mínimo del 99.5% para todos los módulos
                                    productivos de la plataforma (eMAR, Schedule Builder, Portal Familiar, Dashboard
                                    Supervisor), medido en una ventana de 30 días calendario.
                                </p>
                            </div>
                        </div>

                        {/* Ventana de mantenimiento */}
                        <div>
                            <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">
                                Ventana de Mantenimiento Programado
                            </h3>
                            <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-white">
                                        Domingos 2:00 AM — 4:00 AM (hora de Puerto Rico, AST)
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Las interrupciones planificadas dentro de esta ventana no se contabilizan contra
                                        el SLA de uptime. Se notificará con 48h de anticipación si se supera 30 minutos.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Exclusiones */}
                        <div>
                            <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">
                                Exclusiones del SLA
                            </h3>
                            <div className="space-y-2">
                                {[
                                    "Eventos de fuerza mayor (huracanes, terremotos, pandemias u otros eventos fuera del control razonable de Zéndity)",
                                    "Interrupciones causadas por fallos del proveedor de infraestructura en la nube (Vercel, Neon PostgreSQL) que estén fuera del control directo de Zéndity",
                                    "Interrupciones causadas por acciones de la Entidad Cubierta o usuarios autorizados de la misma",
                                    "Interrupciones derivadas de cambios en el entorno del cliente que afecten la conectividad a internet",
                                ].map((excl, i) => (
                                    <div key={i} className="flex items-start gap-2.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-sm text-slate-400">{excl}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* ── Sección 2: Tiempos de Respuesta ────────────────────────── */}
                <SectionCard title="Tiempos de Respuesta a Incidentes" icon={Zap} accent="amber">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Los tiempos aplican durante el horario de soporte estándar, excepto P1 y P2 que son
                            atendidos 24/7. El tiempo de respuesta se mide desde la apertura del ticket hasta el
                            primer contacto de un técnico de Zéndity.
                        </p>

                        {/* Tabla de severidades */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-950/60">
                                        <th className="text-left p-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                            Severidad
                                        </th>
                                        <th className="text-left p-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                            Descripción
                                        </th>
                                        <th className="text-center p-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                            Tiempo de Respuesta
                                        </th>
                                        <th className="text-center p-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                            Resolución Objetivo
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {SEVERIDADES.map((sev) => (
                                        <tr key={sev.nivel} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="p-3">
                                                <Badge color={sev.color}>
                                                    {sev.nivel} — {sev.etiqueta}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-slate-400 text-xs leading-relaxed max-w-xs">
                                                {sev.descripcion}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="font-bold text-white">{sev.respuesta}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="font-bold text-slate-300">{sev.resolucion}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <p className="text-xs text-slate-600 italic">
                            * Los tiempos de resolución son objetivos, no garantías absolutas. Incidentes de mayor
                            complejidad pueden requerir tiempos adicionales debidamente comunicados.
                        </p>
                    </div>
                </SectionCard>

                {/* ── Sección 3: Soporte ──────────────────────────────────────── */}
                <SectionCard title="Soporte y Comunicación" icon={Clock} accent="emerald">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Canales */}
                        <div>
                            <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">
                                Canales de Soporte
                            </h3>
                            <div className="space-y-3">
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                        <span className="text-sm font-bold text-white">Sistema de Tickets</span>
                                        <span className="ml-auto text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                            Principal
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 pl-6">
                                        support.zendity.com — para todos los niveles de incidentes. SLA garantizado
                                        desde apertura del ticket.
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                                        <span className="text-sm font-bold text-white">WhatsApp — Urgencias</span>
                                        <span className="ml-auto text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                                            P1 / P2
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 pl-6">
                                        Solo para incidentes P1 y P2 activos. Número disponible en el contrato. No
                                        sustituye al ticket formal.
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-bold text-white">Email</span>
                                        <span className="ml-auto text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600 font-bold">
                                            P3 / P4
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 pl-6">
                                        support@zendity.com — para incidentes de baja prioridad y consultas generales.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Horarios e idiomas */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">
                                    Horario de Soporte
                                </h3>
                                <div className="space-y-2">
                                    {[
                                        {
                                            label: "P1 — Sistema caído",
                                            horario: "24/7 — Sin excepción",
                                            color: "text-rose-400",
                                        },
                                        {
                                            label: "P2 — Función crítica",
                                            horario: "24/7 — Sin excepción",
                                            color: "text-amber-400",
                                        },
                                        {
                                            label: "P3 / P4 — General",
                                            horario: "Lun–Vie · 8:00 AM – 6:00 PM AST",
                                            color: "text-slate-400",
                                        },
                                    ].map((h) => (
                                        <div
                                            key={h.label}
                                            className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-2.5"
                                        >
                                            <span className={`text-xs font-bold ${h.color}`}>{h.label}</span>
                                            <span className="text-xs text-slate-400">{h.horario}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">
                                    Idiomas de Soporte
                                </h3>
                                <div className="flex gap-3">
                                    {["Español", "English"].map((idioma) => (
                                        <div
                                            key={idioma}
                                            className="flex items-center gap-2 bg-teal-600/10 border border-teal-600/20 rounded-lg px-4 py-2.5"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                                            <span className="text-sm font-bold text-teal-300">{idioma}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* ── Sección 4: Compensaciones ───────────────────────────────── */}
                <SectionCard title="Compensaciones (SLA Credits)" icon={BarChart3} accent="rose">
                    <div className="space-y-5">
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Si Zéndity no cumple con los compromisos de disponibilidad en un mes calendario, la
                            Entidad Cubierta tendrá derecho a solicitar créditos conforme a la siguiente tabla.
                            Los créditos se aplican al siguiente período de facturación y no son acumulables con
                            otras compensaciones contractuales.
                        </p>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-950/60">
                                        <th className="text-left p-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                            Condición de Incumplimiento
                                        </th>
                                        <th className="text-center p-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                            Crédito Aplicable
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {CREDITOS.map((c, i) => (
                                        <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="p-4 text-slate-300">{c.condicion}</td>
                                            <td className="p-4 text-center">
                                                <span className="font-black text-rose-400">{c.credito}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-2">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Procedimiento de Reclamación
                            </h4>
                            <ol className="space-y-1.5">
                                {[
                                    "La solicitud de crédito debe enviarse a support@zendity.com dentro de los 15 días siguientes al mes afectado.",
                                    "Zéndity verificará los registros de uptime y responderá dentro de 10 días hábiles.",
                                    "El crédito aprobado se aplicará automáticamente en la siguiente factura.",
                                    "El crédito máximo acumulable en un período de 12 meses es el equivalente a 2 meses de servicio.",
                                ].map((step, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-xs text-slate-400">
                                        <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                            {i + 1}
                                        </span>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </SectionCard>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-black text-white">
                            SLA Versión 2.0 — Vigente desde el 1 de enero de 2025
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Este documento tiene carácter contractual y forma parte integral del Acuerdo de Servicio
                            entre Zéndity LLC y la Entidad Cubierta. Revisión anual prevista en enero de 2026.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-6">
                        {/* Imprimir — solo UI */}
                        <button
                            onClick={() => typeof window !== "undefined" && window.print()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-bold transition-colors border border-slate-700"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir
                        </button>
                        {/* Descargar PDF — solo UI */}
                        <button
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition-colors shadow-lg shadow-teal-900/30"
                        >
                            <Download className="w-4 h-4" />
                            Descargar PDF
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}

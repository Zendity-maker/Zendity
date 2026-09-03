"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, ArrowLeft } from "lucide-react";

/**
 * Estado del BAA de todas las sedes.
 *
 * Esta página tenía 503 líneas y NO leía un solo dato. Se titulaba "gestión
 * centralizada de BAAs" y su badge decía "2 pendientes" escrito a mano — el
 * mismo número hubiera lo que hubiera. En una pantalla de cumplimiento eso no
 * es un placeholder: es una respuesta inventada a una pregunta que algún día
 * hace un regulador.
 *
 * Ahora lee AcuerdoSede: quién firmó cada sede, cuándo, con qué cargo y desde
 * qué IP. Sin datos, la fila dice que no hay, no un número bonito.
 */
export default function BaaPage() {
    const [d, setD] = useState<any>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        fetch("/api/admin/acuerdos")
            .then(r => r.json())
            .then(j => { if (j.success) setD(j); })
            .finally(() => setCargando(false));
    }, []);

    if (cargando) return <div className="min-h-screen bg-[#0f172a] p-10 text-center text-slate-400 font-bold animate-pulse">Cargando acuerdos…</div>;
    if (!d) return <div className="min-h-screen bg-[#0f172a] p-10 text-center text-rose-400 font-bold">No se pudo cargar</div>;

    return (
        // El body global es bg-gray-50 (claro). El panel de super admin se pone
        // su propio fondo oscuro —AdminDashboard usa bg-[#0f172a]— y esta pagina
        // no lo hacia: sus text-white y text-emerald-100 quedaban sobre blanco y
        // el titulo casi no se leia.
        <div className="min-h-screen bg-[#0f172a] text-slate-200">
            <div className="max-w-4xl mx-auto p-6 space-y-6 pb-16">
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" /> Volver
            </Link>

            <div>
                <h1 className="text-2xl font-black text-white">Acuerdos BAA (HIPAA)</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Versión vigente <strong className="text-slate-300">{d.versionVigente}</strong>.
                    Sin este acuerdo firmado, una sede no puede registrar residentes.
                </p>
            </div>

            {d.pendientes > 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-100/90">
                        <strong>{d.pendientes} sede{d.pendientes === 1 ? "" : "s"}</strong> sin el acuerdo vigente firmado.
                        No pueden admitir residentes hasta que su director lo firme.
                    </p>
                </div>
            ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <p className="text-sm text-emerald-100/90">Todas las sedes tienen el acuerdo vigente firmado.</p>
                </div>
            )}

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-950/60 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                        <tr>
                            <th className="text-left p-3">Sede</th>
                            <th className="text-left p-3">Estado</th>
                            <th className="text-left p-3">Firmante</th>
                            <th className="text-left p-3">Fecha</th>
                            <th className="text-right p-3">Residentes activos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {d.sedes.map((s: any) => (
                            <tr key={s.id} className="border-t border-slate-800">
                                <td className="p-3 font-bold text-white">{s.sede}</td>
                                <td className="p-3">
                                    {s.alDia ? (
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                                            Firmado v{s.version}
                                        </span>
                                    ) : s.firmado ? (
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-500/15 text-amber-400">
                                            Versión vieja (v{s.version})
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-rose-500/15 text-rose-400">
                                            Sin firmar
                                        </span>
                                    )}
                                </td>
                                <td className="p-3 text-slate-300">
                                    {s.firmante ? (
                                        <>
                                            {s.firmante}
                                            {s.cargo && <span className="text-slate-500">, {s.cargo}</span>}
                                            {s.ip && <span className="block text-[11px] text-slate-600">desde {s.ip}</span>}
                                        </>
                                    ) : <span className="text-slate-600">—</span>}
                                </td>
                                <td className="p-3 text-slate-400">
                                    {s.fecha
                                        ? new Date(s.fecha).toLocaleDateString("es-PR", { day: "2-digit", month: "short", year: "numeric" })
                                        : <span className="text-slate-600">—</span>}
                                </td>
                                <td className="p-3 text-right text-slate-300 font-bold">{s.residentesActivos}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
                El texto del acuerdo vive en <code className="text-slate-400">src/lib/baa-texto.ts</code> y cubre las
                cláusulas que exige 45 CFR 164.504(e). Cada firma guarda el hash del texto exacto que se mostró:
                si el acuerdo cambia, se puede demostrar qué versión aceptó cada sede.
            </p>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, CheckCircle2, Clock, User, FileSignature } from 'lucide-react';

interface LifePlan {
    id: string;
    patient: { id: string; name: string };
    status: "DRAFT" | "APPROVED";
    criticalAlerts: string;
    feeding: string;
    mobility: string;
    customs: string;
    signedBy?: { name: string; role: string };
    signedAt?: string;
    createdAt: string;
    emailSentAt?: string | null;
    nextReview?: string | null;
    /** Cuántas versiones anteriores tiene este residente. Se calcula en pantalla. */
    anteriores?: number;
}

export default function CaregiversLifePlanPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [plans, setPlans] = useState<LifePlan[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State para firmas (Convertido en In-Line flow)
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pestañas de estado. "Todos" muestra un plan por residente.
    const [filtro, setFiltro] = useState<'TODOS' | 'AL_DIA' | 'PENDIENTE' | 'BORRADOR'>('TODOS');

    // Conteo por RESIDENTE, no por plan: quien no tiene ningun plan no aparece
    // en la lista de abajo, y era justo el que no se veia.
    const [resumen, setResumen] = useState<{
        total: number; alDia: number; sinEnviar: number;
        vencidos: number; borrador: number; sinPlan: number;
    } | null>(null);
    /**
     * Residentes SIN NINGÚN plan. Van aparte porque no hay `LifePlan` que
     * mostrar: la lista se arma desde los planes y quien no tiene ninguno no
     * salía —no aparecía como problema, aparecía como nada.
     */
    const [sinPlan, setSinPlan] = useState<{ id:string; name:string; roomNumber:string|null; desde:string }[]>([]);

    useEffect(() => {
        fetchLifePlans();
    }, []);

    // Un plan por residente: el aprobado si lo hay, si no el borrador mas
    // reciente. `anteriores` es cuantas versiones quedan detras — no se borran,
    // son la constancia de que decia el cuido en cada periodo.
    const visibles = (() => {
        const porPaciente = new Map<string, any[]>();
        plans.forEach(pl => {
            const l = porPaciente.get(pl.patient.id) ?? [];
            l.push(pl);
            porPaciente.set(pl.patient.id, l);
        });

        const uno = [...porPaciente.values()].map(l => {
            const orden = [...l].sort((a, b) =>
                new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
            const vigente = orden.find(x => x.status === 'APPROVED') ?? orden[0];
            return { ...vigente, anteriores: orden.length - 1 };
        });

        const hoy = new Date();
        const filtrados = uno.filter(pl => {
            const vencido = pl.nextReview && new Date(pl.nextReview) < hoy;
            const alDia = pl.status === 'APPROVED' && pl.emailSentAt && !vencido;
            const pendiente = pl.status === 'APPROVED' && (!pl.emailSentAt || vencido);
            if (filtro === 'AL_DIA')    return alDia;
            if (filtro === 'PENDIENTE') return pendiente;
            if (filtro === 'BORRADOR')  return pl.status !== 'APPROVED';
            return true;
        });

        // Mas reciente primero — el que se acaba de tocar queda arriba.
        return filtrados.sort((a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    })();

    const fetchLifePlans = async () => {
        try {
            const res = await fetch("/api/cuidadores/lifeplans");
            const data = await res.json();
            if (data.success) {
                setPlans(data.lifePlans);
                setResumen(data.resumen ?? null);
                setSinPlan(data.sinPlan ?? []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };




    if (loading) return (
        <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-500">
                    <FileSignature className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-500 tracking-wider text-sm uppercase">Cargando Plataforma de Cuidadores...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-[0.98] duration-500 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end pb-6 border-b border-slate-200/60 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <span className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-teal-600"></span>
                        Zendity Life Plan
                    </h1>
                    <p className="text-slate-500 mt-3 font-medium text-sm">Fichas de Cuidado Operativo (PAI) generadas por IA y validadas por Enfermería clínica.</p>
                </div>
            </div>

            {/* ── ESTADO DE LOS PAI ──────────────────────────────────────────
                Un plan solo cuenta como "al dia" si ademas la familia recibio su
                copia. Aprobar sin enviar es media tarea, y esa mitad es la que se
                perdia de vista: hasta sep-2026 el correo salia solo a quien
                tuviera familiar principal marcado, o sea 4 de 19. */}
            {resumen && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-baseline justify-between mb-4">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Estado de los planes
                        </p>
                        <p className="text-sm font-bold text-slate-500">
                            <span className="text-2xl font-black text-[#0F6E56]">{resumen.alDia}</span>
                            <span className="text-slate-400"> de {resumen.total} al día</span>
                        </p>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex mb-4">
                        <div className="bg-[#0F6E56] h-full" style={{ width: `${(resumen.alDia / Math.max(resumen.total, 1)) * 100}%` }} />
                        <div className="bg-amber-400 h-full" style={{ width: `${((resumen.sinEnviar + resumen.vencidos) / Math.max(resumen.total, 1)) * 100}%` }} />
                        <div className="bg-slate-300 h-full" style={{ width: `${((resumen.borrador + resumen.sinPlan) / Math.max(resumen.total, 1)) * 100}%` }} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { n: resumen.alDia,     t: 'Al día',            d: 'aprobado y la familia lo tiene', c: 'text-[#0F6E56]' },
                            { n: resumen.sinEnviar, t: 'Sin enviar',        d: 'aprobado, la familia no lo ha recibido', c: 'text-amber-600' },
                            { n: resumen.vencidos,  t: 'Vencidos',          d: 'pasó su fecha de revisión', c: 'text-amber-600' },
                            { n: resumen.borrador,  t: 'En borrador',       d: 'falta redactarlo o aprobarlo', c: 'text-slate-600' },
                            { n: resumen.sinPlan,   t: 'Sin plan',          d: 'no tiene ninguno', c: 'text-rose-600' },
                        ].map(x => (
                            <div key={x.t} className={x.n === 0 ? 'opacity-40' : ''}>
                                <p className={`text-2xl font-black ${x.c}`}>{x.n}</p>
                                <p className="text-xs font-bold text-slate-700">{x.t}</p>
                                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{x.d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── PESTAÑAS ──────────────────────────────────────────────────
                La pantalla listaba PLANES, no residentes: cada vez que se
                regenera uno aparece otra tarjeta del mismo. Ahora se muestra el
                plan vigente de cada residente —el aprobado si lo hay, si no el
                borrador mas reciente— y las versiones anteriores se cuentan en la
                tarjeta. No se borran: un plan superado es la constancia de que
                decia el cuido en ese periodo, y varios se firmaron y se enviaron
                a familias. */}
            <div className="flex gap-2 flex-wrap">
                {([
                    ['TODOS',     'Todos'],
                    ['AL_DIA',    'Al día'],
                    ['PENDIENTE', 'Pendientes de enviar o vencidos'],
                    ['BORRADOR',  'En borrador'],
                ] as const).map(([v, t]) => (
                    <button
                        key={v}
                        onClick={() => setFiltro(v)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                            filtro === v
                                ? 'bg-[#0F6E56] text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Sin ningún plan. Va ARRIBA y en rojo: un residente sin plan de
                cuido es un hueco mayor que uno con el plan sin firmar, y hasta
                hoy solo existía como un número en el resumen que nadie podía
                pinchar. Se respeta el filtro: en "Al día" no pinta nada. */}
            {sinPlan.length > 0 && (filtro === 'TODOS' || filtro === 'BORRADOR') && (
                <div className="mb-6 rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-5">
                    <h3 className="font-black text-rose-800 text-sm uppercase tracking-wider mb-1">
                        Sin plan de cuido — {sinPlan.length} residente{sinPlan.length === 1 ? '' : 's'}
                    </h3>
                    <p className="text-rose-900/80 text-sm mb-4">
                        No tienen ningún PAI, ni siquiera en borrador.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {sinPlan.map(r => {
                            const dias = Math.floor((Date.now() - new Date(r.desde).getTime()) / 86400000);
                            return (
                                <Link
                                    key={r.id}
                                    href={`/corporate/medical/patients/${r.id}/pai`}
                                    className="bg-white rounded-xl border border-rose-200 px-4 py-3 hover:border-rose-400 transition-colors"
                                >
                                    <span className="block font-bold text-slate-800">{r.name.trim()}</span>
                                    <span className="block text-xs text-slate-500">
                                        {r.roomNumber ? `Cuarto ${r.roomNumber} · ` : ''}{dias} días en el hogar
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {visibles.length === 0 && sinPlan.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-500 font-bold bg-white rounded-3xl border border-dashed border-slate-200">
                        Aún no hay Fichas de Vida procesadas desde Zendity Intake.
                    </div>
                )}

                {visibles.map((plan) => (
                    <div key={plan.id} className="bg-white rounded-xl border border-slate-200/80 overflow-hidden flex flex-col group hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-teal-200 transition-all duration-300">

                        {/* Cabecera / Estatus */}
                        <div className="p-5 flex justify-between items-start border-b border-slate-100/50 bg-slate-50/30">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-white shadow-sm flex items-center justify-center font-black text-xl text-slate-600">
                                    {plan.patient.name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-lg leading-tight text-slate-800">{plan.patient.name}</h3>
                                    {!!plan.anteriores && (
                                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                                            {plan.anteriores} versión{plan.anteriores === 1 ? '' : 'es'} anterior{plan.anteriores === 1 ? '' : 'es'} en el expediente
                                        </p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                                        <User className="w-3 h-3" /> Residente
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                {plan.status === 'APPROVED' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Acreditado
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm">
                                        <Clock className="w-3.5 h-3.5" /> Borrador IA
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Alertas Críticas */}
                        {plan.criticalAlerts && !plan.criticalAlerts.includes("Ninguna") && (
                            <div className="bg-rose-50/50 border-b border-rose-100/50 p-4 px-5">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
                                        <ShieldAlert className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-1.5">Alerta Médica</h4>
                                        <p className="text-sm font-semibold text-rose-700 leading-snug">{plan.criticalAlerts}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cuerpo de la Ficha Técnica */}
                        <div className="p-6 space-y-6 flex-1 bg-white">
                            <div className="flex items-start gap-4">
                                <div className="text-2xl mt-0.5 opacity-80"></div>
                                <div>
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Alimentación</h4>
                                    <p className="font-semibold text-slate-700 leading-snug mt-1 text-sm">{plan.feeding}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="text-2xl mt-0.5 opacity-80"></div>
                                <div>
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Movilidad & Piel</h4>
                                    <p className="font-semibold text-slate-700 leading-snug mt-1 text-sm">{plan.mobility}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="text-2xl mt-0.5 opacity-80"></div>
                                <div>
                                    <h4 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Rutinas & Emoción</h4>
                                    <p className="font-semibold text-slate-700 leading-snug mt-1 text-sm">{plan.customs}</p>
                                </div>
                            </div>
                        </div>

                        {/* Pie de Firma / Aprobación */}
                        <div className="p-5 bg-slate-50/50 border-t border-slate-100">
                            {plan.status === 'APPROVED' ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold border border-teal-200">
                                            {plan.signedBy?.name?.charAt(0) || 'V'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Validado por</p>
                                            <p className="text-xs font-bold text-slate-700">{plan.signedBy?.name || 'Zendity Staff'}</p>
                                        </div>
                                    </div>
                                    {plan.signedAt && (
                                        <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                                            {new Date(plan.signedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                /* Aqui vivia un segundo camino para firmar el PAI: un "PIN Medico"
                                   que no validaba nada —la ruta aceptaba 4 caracteres cualesquiera y
                                   el firmante salia de la sesion, no del PIN— y que ademas no
                                   guardaba el contenido editado, no exigia la version familiar y NO
                                   enviaba el correo a la familia. Dos botones que firmaban el mismo
                                   documento con consecuencias distintas es como se pierde un envio
                                   sin que nadie lo note.
                                   El PAI se aprueba en un solo lugar: su propia pantalla. */
                                <Link
                                    href={`/corporate/medical/patients/${plan.patient.id}/pai`}
                                    className="w-full py-2.5 bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50 rounded-xl font-bold text-sm text-slate-700 flex items-center justify-center gap-2 transition-colors group"
                                >
                                    <FileSignature className="w-4 h-4 text-slate-500 group-hover:text-teal-500 transition-colors" />
                                    Abrir y aprobar PAI
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

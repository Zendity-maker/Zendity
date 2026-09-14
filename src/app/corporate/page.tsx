"use client";

/**
 * LA PANTALLA DE DIRECCIÓN.
 *
 * Reescrita el 14-sep-2026. La anterior tenía 1.584 líneas y Andrés la describió
 * así: "lo siento desordenado y poco funcional. botones innecesarios."
 *
 * La auditoría de ese día le dio la razón con números:
 *
 *   · El estado del turno se pintaba DOS veces, desde dos endpoints con dos
 *     aritméticas: el chip decía "Baños 31" y la barra de encima "30/30".
 *   · El triage salía TRES veces con tres números que no coincidían (2, 1, 18).
 *   · A /corporate/triage se llegaba CUATRO veces desde la misma pantalla, y
 *     una de esas cuatro era la tarjeta "Mensajes Familiares", que llevaba
 *     donde no estaban.
 *   · Cuatro indicadores no podían moverse: cumplimiento eMAR 100% en 29 de 30
 *     días porque dividía administradas entre administradas, la gráfica de
 *     comidas al 109% por dividir entre residentes×3, un badge de "2 horarios
 *     sin publicar" apuntando a borradores de mayo y julio.
 *   · Y los dos bloques que SÍ nombraban gente no tenían un solo enlace.
 *
 * En el fondo era el panel del supervisor repintado: los mismos cuatro
 * indicadores, las mismas ausencias, y dos enlaces del briefing que apuntaban
 * literalmente a /care/supervisor.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO QUE HAY AHORA, Y POR QUÉ
 *
 * Cuatro franjas y un solo endpoint (/api/corporate/hoy), ordenadas por la
 * única pregunta que importa a las siete de la mañana: ¿hay algo que solo yo
 * pueda resolver? El reparto con el supervisor está escrito en el código desde
 * agosto — allí va lo resoluble en una o dos horas; aquí, lo que lleva días.
 *
 * LO QUE NO ESTÁ, A PROPÓSITO: las seis gráficas de tendencia (medían cosas
 * que no se mueven), el scorecard que rankeaba dos sedes de las cuales una está
 * vacía, el briefing escrito por GPT-4o —el correo de dirección documenta por
 * qué la conclusión no la escribe una IA— y los KPIs inmóviles.
 *
 * Ver src/lib/pantalla-direccion.ts para el motor y el criterio.
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import OnboardingChecklist from '@/components/corporate/OnboardingChecklist';
import { useActiveHq } from "@/contexts/ActiveHqContext";
import {
    Moon, ListChecks, Users, Clock, ChevronRight, RefreshCw,
    Stethoscope, ClipboardList, MessageSquare, GraduationCap, Building2,
} from 'lucide-react';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

interface Novedad { que: string; cuando: string; enlace: string; pideDecision: boolean }
interface Decision { que: string; porque: string; quien: string }
interface Parado { que: string; dias: number; cuantos: number; enlace: string }
interface Progreso { hecho: number; total: number }
interface Pantalla {
    sede: { id: string; nombre: string };
    desde: string;
    anoche: Novedad[];
    decisiones: Decision[];
    piso: {
        enTurno: { caregiverId: string; nombre: string; colores: string[]; desde: string }[];
        ausencias: { nombre: string; motivo: string | null; aviso: boolean }[];
        corriendo: { enHospital: { nombre: string }[]; alertasAbiertas: number; rotacionesVencidas: number };
        progreso: { banos: Progreso; comidas: Progreso; vitales: Progreso };
        sinActividad: { id: string; nombre: string; habitacion: string | null }[];
        sinContactoFamilia: { id: string; nombre: string }[];
    };
    parado: Parado[];
}

/** Los sitios a los que de verdad se va desde aquí. Uno por destino, no cuatro. */
const IR_A = [
    { href: '/care/supervisor', icono: Stethoscope, texto: 'Piso y turno' },
    { href: '/corporate/patients', icono: Users, texto: 'Residentes' },
    { href: '/hr', icono: ClipboardList, texto: 'Personal' },
    { href: '/corporate/family-messages', icono: MessageSquare, texto: 'Familias' },
    { href: '/academy', icono: GraduationCap, texto: 'Academy' },
    { href: '/corporate/sedes', icono: Building2, texto: 'Sedes' },
];

const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: 'numeric', minute: '2-digit' });

export default function PantallaDireccion() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { activeHqId } = useActiveHq();
    const [d, setD] = useState<Pantalla | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const q = activeHqId ? `?headquartersId=${activeHqId}` : '';
            const res = await fetch(`/api/corporate/hoy${q}`);
            const json = await res.json();
            if (json.success) setD(json.pantalla);
            else setError(json.error || 'No se pudo cargar');
        } catch {
            setError('Error de conexión');
        } finally {
            setCargando(false);
        }
    }, [activeHqId]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.push('/login?callbackUrl=/corporate'); return; }
        if (!ALLOWED_ROLES.includes(user.role || '')) { router.push('/'); return; }
        cargar();
    }, [user, authLoading, cargar, router]);

    if (authLoading || (cargando && !d)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-medium gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" /> Cargando…
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-16">
            <div className="max-w-3xl mx-auto px-5 py-8 md:py-12">

                <div className="flex items-start justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                            {d?.sede.nombre ?? 'Dirección'}
                        </h1>
                        {d && (
                            <p className="text-slate-500 text-sm font-medium mt-1">
                                Desde las {hora(d.desde)} de ayer
                            </p>
                        )}
                    </div>
                    <button
                        onClick={cargar}
                        disabled={cargando}
                        className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 shrink-0"
                        aria-label="Actualizar"
                    >
                        <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {error && (
                    <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-5 mb-6">
                        <p className="text-sm text-rose-800 font-semibold">{error}</p>
                    </div>
                )}

                {d && (
                    <div className="space-y-5">

                        {/* Se esconde solo cuando la sede está lista, cuando se
                            descarta, o si no hay pasos. No cuesta nada cuando
                            sobra y hace falta mientras Mayagüez esté vacía. */}
                        <OnboardingChecklist hqId={d.sede.id} />

                        {/* ── 1 ────────────────────────────────────────────── */}
                        <Franja titulo="¿Pasó algo anoche?" icono={Moon} acento>
                            {d.anoche.length === 0 ? (
                                /* Un vacío con nombre. "Nada que reportar" es información;
                                   un bloque en blanco es una pantalla que no cargó. */
                                <p className="text-sm text-slate-600">
                                    Nada que reportar. Ni caídas, ni alertas nuevas, ni medicamentos sin administrar.
                                </p>
                            ) : (
                                <ul className="space-y-1.5">
                                    {d.anoche.map((n, i) => (
                                        <li key={i}>
                                            <Link href={n.enlace} className="flex items-center gap-3 group py-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.pideDecision ? 'bg-rose-500' : 'bg-slate-300'}`} />
                                                <span className={`text-sm flex-1 ${n.pideDecision ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                                    {n.que}
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Franja>

                        {/* ── 2 ────────────────────────────────────────────── */}
                        <Franja titulo="Esperando tu decisión" icono={ListChecks} acento>
                            {d.decisiones.length === 0 ? (
                                <p className="text-sm text-slate-600">Nada esperando por ti.</p>
                            ) : (
                                <div className="space-y-4">
                                    {d.decisiones.map((x, i) => (
                                        <div key={i} className={i > 0 ? 'pt-4 border-t border-slate-100' : ''}>
                                            <p className="text-sm font-bold text-slate-900 leading-snug">{x.que}</p>
                                            {/* El número que lo justifica. Sin esto sería una opinión. */}
                                            <p className="text-[13px] text-slate-500 mt-1 leading-snug">{x.porque}</p>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-teal-700 mt-1.5">{x.quien}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Franja>

                        {/* ── 3 ────────────────────────────────────────────── */}
                        <Franja titulo="El piso ahora mismo" icono={Users}>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
                                <Dato n={d.piso.enTurno.length} t="en turno" />
                                <Dato n={d.piso.ausencias.length} t="ausencias" alerta={d.piso.ausencias.length > 0} />
                                <Dato n={d.piso.corriendo.enHospital.length} t="en hospital" />
                                <Dato n={d.piso.sinActividad.length} t="sin registro hoy" alerta={d.piso.sinActividad.length > 0} />
                            </div>
                            {d.piso.enTurno.length > 0 && (
                                <p className="text-[13px] text-slate-500 mb-4 leading-snug">
                                    {d.piso.enTurno.map(c => c.nombre.split(' ')[0]).join(', ')}
                                    {d.piso.enTurno.some(c => c.colores.length > 0) && (
                                        <> · grupos {d.piso.enTurno.flatMap(c => c.colores).join(', ')}</>
                                    )}
                                </p>
                            )}
                            {/* Cada contador con su denominador. "Baños 35" sin decir
                                sobre cuántos no es progreso, es un número suelto. */}
                            <div className="space-y-2">
                                <Barra t="Baños" p={d.piso.progreso.banos} />
                                <Barra t="Comidas" p={d.piso.progreso.comidas} />
                                <Barra t="Vitales" p={d.piso.progreso.vitales} />
                            </div>
                        </Franja>

                        {/* ── 4 ────────────────────────────────────────────── */}
                        <Franja titulo="Lo que lleva días parado" icono={Clock}>
                            {d.parado.length === 0 ? (
                                <p className="text-sm text-slate-600">Nada atrasado.</p>
                            ) : (
                                <ul className="space-y-0.5">
                                    {d.parado.map((x, i) => (
                                        <li key={i}>
                                            <Link href={x.enlace} className="flex items-center gap-3 group py-2 border-b border-slate-100 last:border-0">
                                                <span className="text-sm text-slate-800 flex-1 leading-snug">{x.que}</span>
                                                {x.dias > 0 && (
                                                    <span className="text-[11px] font-black tabular-nums text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                                                        {x.dias} {x.dias === 1 ? 'día' : 'días'}
                                                    </span>
                                                )}
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Franja>

                        {/* Un destino, un enlace. Antes se llegaba al mismo sitio
                            desde cuatro botones distintos de esta pantalla. */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                            {IR_A.map(({ href, icono: Icono, texto }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:border-teal-400 hover:text-teal-800 transition-colors"
                                >
                                    <Icono className="w-4 h-4 text-slate-400 shrink-0" />
                                    {texto}
                                </Link>
                            ))}
                        </div>

                        <p className="text-[13px] text-slate-400 leading-snug pt-2">
                            Todo esto se calcula contra el expediente al abrir. Nada se marca a mano
                            como hecho: cada línea desaparece sola cuando el trabajo se registra.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function Franja({ titulo, icono: Icono, acento, children }: {
    titulo: string; icono: React.ElementType; acento?: boolean; children: React.ReactNode;
}) {
    return (
        <section className={`bg-white rounded-2xl border p-5 md:p-6 ${acento ? 'border-l-4 border-l-teal-600 border-slate-200' : 'border-slate-200'}`}>
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3.5">
                <Icono className="w-3.5 h-3.5" /> {titulo}
            </h2>
            {children}
        </section>
    );
}

function Dato({ n, t, alerta }: { n: number; t: string; alerta?: boolean }) {
    return (
        <div>
            <span className={`text-2xl font-black tabular-nums ${alerta && n > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{n}</span>
            <span className="text-[13px] text-slate-500 ml-1.5">{t}</span>
        </div>
    );
}

function Barra({ t, p }: { t: string; p: Progreso }) {
    const pct = p.total > 0 ? Math.round((p.hecho / p.total) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-[13px] text-slate-500 w-16 shrink-0">{t}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-600 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[13px] font-bold tabular-nums text-slate-700 w-14 text-right shrink-0">
                {p.hecho}/{p.total}
            </span>
        </div>
    );
}

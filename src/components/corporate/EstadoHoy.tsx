"use client";

import { useEffect, useState } from "react";
import { UserCheck, UserX, Activity, AlertTriangle } from "lucide-react";

/**
 * "Hoy" — lo que el director abre a mirar cada mañana.
 *
 * Andrés lo describió así: quién está en turno, quién se ausentó, si hay alguna
 * situación de emergencia corriendo, y el progreso del turno. Nada de eso
 * estaba junto:
 *
 *  · Las ausencias NO aparecían en el dashboard. El dato existía —con motivo y
 *    con la distinción entre avisar y no aparecer— pero había que ir al
 *    constructor de horarios a buscarlo.
 *  · El progreso no tenía denominador: "Baños hoy: 35" sin decir sobre cuántos.
 *  · Lo que corre ahora estaba partido entre dos pantallas.
 *  · Quién está en turno era un número, no una lista. Saber que hay 3 no dice
 *    a quién llamar.
 *
 * Usa las mismas definiciones que el panel del supervisor. Son la misma vista
 * a distinta altura.
 */

/**
 * El grupo de color se muestra como PUNTO + NOMBRE, en una pastilla neutra.
 *
 * Antes era una pildora tintada con la inicial: una pildora rosada con una "R".
 * Andres lo leyo como alarma —"Krystal y Mariangelie estan en rojo"— y lo
 * comparo con el panel del supervisor, donde el rojo SI significa puntaje
 * critico. Las dos tenian complianceScore 100: no habia contradiccion de datos,
 * habia una colision de significado. El mismo rosado decia "cubre el grupo
 * ROJO" en una pantalla y "esta mal" en la otra.
 *
 * El color se conserva en el punto —es informacion real— pero el fondo queda
 * neutro para que la pastilla no pueda leerse como severidad, y el nombre va
 * escrito en vez de una inicial.
 */
const COLOR_PUNTO: Record<string, string> = {
    RED: "bg-rose-500",
    YELLOW: "bg-amber-400",
    BLUE: "bg-sky-500",
    GREEN: "bg-emerald-500",
};

const COLOR_NOMBRE: Record<string, string> = {
    RED: "Rojo",
    YELLOW: "Amarillo",
    BLUE: "Azul",
    GREEN: "Verde",
};

function Barra({ etiqueta, hecho, total }: { etiqueta: string; hecho: number; total: number }) {
    const pct = total > 0 ? Math.round((hecho / total) * 100) : 0;
    // Un progreso sin denominador es un contador. Con él, 32/33 dice que falta uno.
    return (
        <div>
            <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-bold text-slate-500">{etiqueta}</span>
                <span className="text-xs font-black text-slate-700">{hecho}<span className="text-slate-300">/{total}</span></span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-teal-500" : "bg-amber-400"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                />
            </div>
        </div>
    );
}

export default function EstadoHoy({ hqId }: { hqId?: string }) {
    const [e, setE] = useState<any>(null);

    useEffect(() => {
        const url = hqId && hqId !== "ALL"
            ? `/api/corporate/estado-hoy?hqId=${hqId}`
            : "/api/corporate/estado-hoy";
        fetch(url, { cache: "no-store" })
            .then(r => r.json())
            .then(d => { if (d.success) setE(d.estado); })
            .catch(() => null);
    }, [hqId]);

    if (!e) return null;

    const hayAlgoCorriendo =
        e.corriendo.enHospital.length > 0 ||
        e.corriendo.alertasAbiertas > 0 ||
        e.corriendo.rotacionesVencidas > 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

            {/* EN TURNO — nombres, no un número. Un número no dice a quién llamar. */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    <UserCheck className="w-3.5 h-3.5" /> En turno ahora
                </p>
                {e.enTurno.length === 0 ? (
                    <p className="text-sm text-slate-400">Nadie con turno abierto.</p>
                ) : (
                    <ul className="space-y-2">
                        {e.enTurno.map((p: any) => (
                            <li key={p.caregiverId} className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-slate-700 truncate">{p.nombre}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                    {p.colores.length === 0
                                        ? <span className="text-[10px] text-slate-300">sin grupo</span>
                                        : (
                                            <>
                                                <span className="text-[10px] font-medium text-slate-400">cubre</span>
                                                {p.colores.map((c: string) => (
                                                    <span
                                                        key={c}
                                                        title={`Grupo de residentes ${COLOR_NOMBRE[c] ?? c}`}
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded"
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${COLOR_PUNTO[c] ?? "bg-slate-400"}`} />
                                                        {COLOR_NOMBRE[c] ?? c}
                                                    </span>
                                                ))}
                                            </>
                                        )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Las ausencias van JUNTO a quién está, no en otra pantalla:
                    la pregunta es la misma. */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        <UserX className="w-3.5 h-3.5" /> Ausencias hoy
                    </p>
                    {e.ausencias.length === 0 ? (
                        <p className="text-sm text-slate-400">Ninguna.</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {e.ausencias.map((a: any, i: number) => (
                                <li key={i} className="text-sm">
                                    <span className="font-bold text-slate-700">{a.nombre}</span>
                                    {/* Faltar avisando y no aparecer no son lo mismo,
                                        y es lo primero que se quiere saber. */}
                                    <span className={`ml-2 text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${a.aviso ? "bg-slate-100 text-slate-500" : "bg-rose-100 text-rose-700"}`}>
                                        {a.aviso ? "avisó" : "sin avisar"}
                                    </span>
                                    {a.motivo && <span className="block text-xs text-slate-400">{a.motivo}</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* CORRIENDO AHORA — todo lo urgente en un sitio. */}
            <div className={`rounded-2xl p-5 border ${hayAlgoCorriendo ? "bg-rose-50/50 border-rose-200" : "bg-white border-slate-200"}`}>
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5" /> Corriendo ahora
                </p>
                {!hayAlgoCorriendo ? (
                    <p className="text-sm text-slate-400">Sin situaciones abiertas.</p>
                ) : (
                    <ul className="space-y-2.5">
                        {e.corriendo.enHospital.map((h: any, i: number) => (
                            <li key={i} className="text-sm">
                                <span className="font-black text-rose-700">En hospital</span>
                                <span className="block text-slate-600">{h.nombre}</span>
                            </li>
                        ))}
                        {e.corriendo.alertasAbiertas > 0 && (
                            <li className="text-sm">
                                <span className="font-black text-slate-700">{e.corriendo.alertasAbiertas} alerta{e.corriendo.alertasAbiertas === 1 ? "" : "s"} clínica{e.corriendo.alertasAbiertas === 1 ? "" : "s"}</span>
                                <span className="block text-xs text-slate-500">sin resolver en 24 h</span>
                            </li>
                        )}
                        {e.corriendo.rotacionesVencidas > 0 && (
                            <li className="text-sm">
                                <span className="font-black text-slate-700">{e.corriendo.rotacionesVencidas} rotación{e.corriendo.rotacionesVencidas === 1 ? "" : "es"} vencida{e.corriendo.rotacionesVencidas === 1 ? "" : "s"}</span>
                                <span className="block text-xs text-slate-500">residentes con úlcera activa</span>
                            </li>
                        )}
                    </ul>
                )}
            </div>

            {/* PROGRESO DEL TURNO — con su denominador. */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">
                    <Activity className="w-3.5 h-3.5" /> Progreso del turno
                </p>
                <div className="space-y-3.5">
                    <Barra etiqueta="Baños" hecho={e.progreso.banos.hecho} total={e.progreso.banos.total} />
                    <Barra etiqueta="Comidas" hecho={e.progreso.comidas.hecho} total={e.progreso.comidas.total} />
                    <Barra etiqueta="Vitales" hecho={e.progreso.vitales.hecho} total={e.progreso.vitales.total} />
                </div>
                {e.sinActividad.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                        <p className="text-xs font-bold text-rose-600">
                            {e.sinActividad.length} sin ningún registro hoy
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {e.sinActividad.slice(0, 3).map((x: any) => x.nombre).join(", ")}
                            {e.sinActividad.length > 3 && ` y ${e.sinActividad.length - 3} más`}
                        </p>
                    </div>
                )}
            </div>

            {/* Expedientes sin contacto de familia. No es del turno —por eso va
                aparte, debajo— pero tampoco puede seguir invisible: llevaba
                meses sin que nadie supiera que eran 19 de 32. */}
            {e.sinContactoFamilia?.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-2xl border border-rose-200 p-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-600 mb-2">
                        <UserX className="w-3.5 h-3.5" />
                        {e.sinContactoFamilia.length} expedientes sin contacto de familia
                    </p>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Ni familiar registrado ni declaración de que no lo hay. Es a quién no
                        llamas de madrugada. Se resuelve en el expediente de cada uno.
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                        {e.sinContactoFamilia.slice(0, 4).map((x: any) => x.nombre).join(" · ")}
                        {e.sinContactoFamilia.length > 4 && ` y ${e.sinContactoFamilia.length - 4} más`}
                    </p>
                </div>
            )}
        </div>
    );
}

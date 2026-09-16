"use client";

/**
 * LA PARED DEL PISO — lo que falta en este turno.
 *
 * Va en la sala de descanso del personal. La del área común es OTRA pantalla,
 * con otros datos, y no existe todavía porque no hay con qué llenarla: el menú
 * tiene UNA fila en toda la historia y está en blanco.
 *
 * LA REGLA, y de ella sale todo el diseño: un bloque entra si PUEDE LLEGAR A
 * CERO y si NOMBRA CUARTO. Un número que no puede bajar enseña a no mirar; uno
 * sin nombre no habilita nada, porque nadie sabe a qué cuarto ir.
 *
 * Lo que se quitó, y por qué:
 *
 *   · El punto verde "Estable" del mapa estaba escrito a mano en los 31
 *     residentes — sin condición, sin campo del que salir. Salían en verde los
 *     cuatro con úlcera abierta, que eran exactamente el número rojo que la
 *     misma pantalla mostraba al lado.
 *   · La tarjeta roja de "Alertas Clínicas" llevaba 89 de 90 días encendida.
 *   · El "Censo Activo" a 72 píxeles cambió 0 veces en las 24 horas auditadas.
 *   · El Top 5 se descargaba al kiosco cada minuto aunque la bandera lo
 *     ocultara, y su orden seguía invertido: proyectado, alguien con 0 turnos y
 *     0 administraciones salía sexto con el valor por defecto del schema.
 *   · Las fotos: 1,12 MiB de base64 por consulta que la pantalla nunca dibujó.
 */

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Pill, Clock, Calendar as CalendarIcon, Loader2,
    UtensilsCrossed, AlertTriangle, CheckCircle2, HeartPulse, MessageSquareWarning,
} from "lucide-react";

type Dosis = { residente: string; cuarto: string | null; medicamento: string; franja: string | null };
type Cura = { residente: string; cuarto: string | null; etapa: string; zona: string; curadaHoy: boolean; horasSinCura: number | null };

type WallData = {
    sede: { nombre: string; logoUrl: string | null };
    mirandoComo: string | null;
    generadoA: string;
    meds: { dadas: number; resueltasDeOtroModo: number; vencidas: Dosis[]; sinDar: Dosis[]; totalDelDia: number };
    curas: { hechasHoy: number; total: number; pendientes: Cura[] };
    señalamientosAbiertos: number;
    residentes: { id: string; name: string; roomNumber: string | null }[];
    menu: { desayuno: string | null; almuerzo: string | null; cena: string | null } | null;
};

/** El token del televisor. Se guarda una vez y ya no caduca. */
const CLAVE_TOKEN = 'zendity.wall.deviceToken';

export default function ParedDelPiso() {
    const [data, setData] = useState<WallData | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    /**
     * UN FALLO DE RED NO BORRA LA PARED.
     *
     * Antes, cualquier error sustituía la pantalla entera por "Error de
     * Conexión. Reintentando…". Como la sesión caduca a las 8 horas y nada la
     * renueva, eso pasaba todas las noches: la pared se apagaba sola y, si
     * alguien recargaba, salía el formulario de login mirando al pasillo.
     *
     * Ahora se conserva lo último bueno y se dice de cuándo es. Una pared que
     * envejece a la vista es mucho mejor que una pantalla de error.
     */
    const [ultimoOk, setUltimoOk] = useState<Date | null>(null);
    const [fallando, setFallando] = useState(false);
    const token = useRef<string | null>(null);

    useEffect(() => {
        try { token.current = localStorage.getItem(CLAVE_TOKEN); } catch { /* modo privado */ }
    }, []);

    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const cargar = async () => {
            try {
                const res = await fetch('/api/wall/dashboard', {
                    headers: token.current ? { 'x-device-token': token.current } : {},
                });
                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                    setUltimoOk(new Date());
                    setFallando(false);
                } else {
                    setFallando(true);
                }
            } catch {
                setFallando(true);
            } finally {
                setLoading(false);
            }
        };
        cargar();
        const p = setInterval(cargar, 60000);
        return () => clearInterval(p);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1F2D3A] flex flex-col items-center justify-center text-white">
                <Loader2 className="w-16 h-16 animate-spin text-[#0F6B78] mb-4" />
                <h1 className="text-2xl font-black">Cargando la pared…</h1>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[#1F2D3A] flex flex-col items-center justify-center text-rose-300 p-10 text-center">
                <AlertTriangle className="w-16 h-16 mb-4" />
                <h1 className="text-3xl font-black">No se pudo cargar la pared</h1>
                <p className="text-xl text-rose-200/70 mt-3 max-w-2xl">
                    Sigue reintentando cada minuto. Si esta pantalla es un televisor fijo,
                    puede que le falte su token de dispositivo.
                </p>
            </div>
        );
    }

    const minutosDesdeOk = ultimoOk ? Math.round((currentTime.getTime() - ultimoOk.getTime()) / 60000) : null;
    const viejo = fallando && minutosDesdeOk !== null && minutosDesdeOk >= 2;

    const { meds, curas } = data;
    const faltanMeds = meds.sinDar.length + meds.vencidas.length;
    const cuartosSeñalados = new Set(
        [...meds.sinDar, ...meds.vencidas, ...curas.pendientes].map(x => x.cuarto).filter(Boolean) as string[],
    );

    return (
        <div className="min-h-screen bg-[#1F2D3A] text-[#EAF4F5] flex flex-col p-6 font-sans antialiased relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#0F6B78]/20 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#3CC6C4]/10 blur-[150px] rounded-full pointer-events-none" />

            <header className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-6 relative z-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#0F6B78] to-[#3CC6C4] rounded-2xl flex items-center justify-center overflow-hidden border border-[#3CC6C4]/30">
                        {data.sede.logoUrl
                            ? <img src={data.sede.logoUrl} alt="" className="w-full h-full object-cover bg-white" />
                            : <img src="/brand/zendity_icon_primary.svg" className="w-10 h-10 object-contain brightness-0 invert" alt="Zéndity" />}
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight">Lo que falta en este turno</h1>
                        <p className="text-lg font-bold text-[#EAF4F5]/60 mt-1 uppercase tracking-widest">{data.sede.nombre}</p>
                    </div>
                </div>
                <div className="text-right flex items-center gap-5">
                    {viejo && (
                        <div className="bg-amber-500/20 border border-amber-400/40 px-5 py-3 rounded-2xl">
                            <p className="text-amber-200 font-black text-sm uppercase tracking-widest">Datos de hace {minutosDesdeOk} min</p>
                            <p className="text-amber-200/70 text-xs mt-0.5">Sin conexión — reintentando</p>
                        </div>
                    )}
                    <div className="flex items-center gap-3 bg-black/40 px-6 py-4 rounded-2xl border border-white/10">
                        <CalendarIcon className="w-7 h-7 text-[#3CC6C4]" />
                        <span className="text-xl font-bold capitalize">{format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-4 bg-[#0F6B78]/30 px-8 py-4 rounded-2xl border border-[#3CC6C4]/40">
                        <Clock className="w-8 h-8 text-white" />
                        <span className="text-4xl font-black tracking-widest">{format(currentTime, "hh:mm a")}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 relative z-10">

                {/* ── Medicamentos del turno ──────────────────────────────── */}
                <section className="col-span-5 bg-white/5 border border-white/10 rounded-3xl p-7 flex flex-col min-h-0">
                    <div className="flex items-baseline justify-between mb-5">
                        <h2 className="text-2xl font-black flex items-center gap-3">
                            <Pill className="w-7 h-7 text-[#3CC6C4]" /> Medicamentos
                        </h2>
                        <span className="text-[#EAF4F5]/50 text-lg font-bold">{meds.dadas} de {meds.totalDelDia} dadas</span>
                    </div>

                    {faltanMeds === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-4" />
                            <p className="text-3xl font-black text-emerald-300">Nada pendiente ahora mismo</p>
                            <p className="text-[#EAF4F5]/50 text-lg mt-2">
                                {meds.dadas} dosis dadas hoy
                                {meds.resueltasDeOtroModo > 0 && ` · ${meds.resueltasDeOtroModo} con su motivo anotado`}
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {meds.sinDar.map((d, i) => (
                                <Renglon key={`m${i}`} tono="rose" etiqueta={d.franja ?? '—'}
                                    titulo={d.medicamento} sub={`${d.residente}${d.cuarto ? ` · ${d.cuarto}` : ''}`} cola="sin dar" />
                            ))}
                            {meds.vencidas.map((d, i) => (
                                <Renglon key={`v${i}`} tono="amber" etiqueta={d.franja ?? '—'}
                                    titulo={d.medicamento} sub={`${d.residente}${d.cuarto ? ` · ${d.cuarto}` : ''}`} cola="pasó la hora" />
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Curas del día ───────────────────────────────────────── */}
                <section className="col-span-4 bg-white/5 border border-white/10 rounded-3xl p-7 flex flex-col min-h-0">
                    <div className="flex items-baseline justify-between mb-5">
                        <h2 className="text-2xl font-black flex items-center gap-3">
                            <HeartPulse className="w-7 h-7 text-[#3CC6C4]" /> Curas
                        </h2>
                        <span className="text-[#EAF4F5]/50 text-lg font-bold">{curas.hechasHoy} de {curas.total} hoy</span>
                    </div>

                    {curas.total === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center">
                            <p className="text-xl text-[#EAF4F5]/50">Ninguna herida abierta.</p>
                        </div>
                    ) : curas.pendientes.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-4" />
                            <p className="text-3xl font-black text-emerald-300">Las {curas.total} curadas hoy</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {curas.pendientes.map((c, i) => (
                                <Renglon key={i} tono="amber" etiqueta={`Et. ${c.etapa}`}
                                    titulo={c.zona}
                                    sub={`${c.residente}${c.cuarto ? ` · ${c.cuarto}` : ''}`}
                                    cola={c.horasSinCura !== null ? `${(c.horasSinCura / 24).toFixed(1)} días` : 'sin registro'} />
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Columna derecha ─────────────────────────────────────── */}
                <div className="col-span-3 flex flex-col gap-6 min-h-0">

                    <div className={`rounded-3xl p-6 border ${data.señalamientosAbiertos > 0 ? 'bg-amber-500/15 border-amber-400/40' : 'bg-white/5 border-white/10'}`}>
                        <p className="text-sm font-black uppercase tracking-widest text-[#EAF4F5]/50 flex items-center gap-2">
                            <MessageSquareWarning className="w-5 h-5" /> Señalamientos de familia
                        </p>
                        <p className={`text-5xl font-black mt-2 ${data.señalamientosAbiertos > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                            {data.señalamientosAbiertos}
                        </p>
                        <p className="text-[#EAF4F5]/45 text-sm mt-1">
                            {data.señalamientosAbiertos === 0 ? 'ninguno sin resolver' : 'esperando respuesta'}
                        </p>
                    </div>

                    {/* El menú, o la verdad de que no hay. Sin inventar comida. */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <p className="text-sm font-black uppercase tracking-widest text-[#EAF4F5]/50 flex items-center gap-2 mb-3">
                            <UtensilsCrossed className="w-5 h-5" /> Comida de hoy
                        </p>
                        {data.menu && (data.menu.desayuno || data.menu.almuerzo || data.menu.cena) ? (
                            <div className="space-y-2.5">
                                {([['Desayuno', data.menu.desayuno], ['Almuerzo', data.menu.almuerzo], ['Cena', data.menu.cena]] as const)
                                    .map(([l, v]) => (
                                        <div key={l}>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-[#3CC6C4]/70">{l}</p>
                                            <p className="text-lg font-bold text-white">{v ?? '—'}</p>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <p className="text-[#EAF4F5]/40 text-base italic py-3">
                                Menú no cargado. Cocina lo sube desde su pantalla.
                            </p>
                        )}
                    </div>

                    {/* El mapa: ubica, no diagnostica. Sin punto de estado. */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex-1 min-h-0 flex flex-col">
                        <p className="text-sm font-black uppercase tracking-widest text-[#EAF4F5]/50 mb-3">
                            Residentes · {data.residentes.length}
                        </p>
                        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-1.5 pr-1 content-start">
                            {data.residentes.map(r => {
                                const señalado = !!r.roomNumber && cuartosSeñalados.has(r.roomNumber);
                                return (
                                    <div key={r.id}
                                        className={`px-2.5 py-1.5 rounded-lg border text-sm ${señalado ? 'bg-amber-500/15 border-amber-400/40' : 'bg-white/5 border-white/10'}`}>
                                        <span className="font-black text-white/90">{r.roomNumber ?? '—'}</span>
                                        <span className="text-white/45 ml-1.5 truncate">{r.name.trim().split(' ')[0]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {data.mirandoComo && (
                <p className="text-center text-[#EAF4F5]/25 text-xs mt-3 relative z-10">{data.mirandoComo}</p>
            )}
        </div>
    );
}

/** Un renglón de lo que falta: la hora, qué, quién y dónde. */
function Renglon({ tono, etiqueta, titulo, sub, cola }: {
    tono: 'rose' | 'amber'; etiqueta: string; titulo: string; sub: string; cola: string;
}) {
    const c = tono === 'rose'
        ? 'bg-rose-500/12 border-rose-400/35'
        : 'bg-amber-500/12 border-amber-400/35';
    const t = tono === 'rose' ? 'text-rose-300' : 'text-amber-300';
    return (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${c}`}>
            <span className={`text-sm font-black w-20 shrink-0 ${t}`}>{etiqueta}</span>
            <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-white truncate">{titulo}</p>
                <p className="text-sm text-[#EAF4F5]/55 truncate">{sub}</p>
            </div>
            <span className={`text-xs font-black uppercase tracking-widest shrink-0 ${t}`}>{cola}</span>
        </div>
    );
}

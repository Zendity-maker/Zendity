"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    Activity, Users, DollarSign, CheckCircle, Clock, HeartPulse,
    TrendingUp, BedDouble, Landmark, Sparkles, UserCheck, ArrowUpRight, ArrowDownRight, Scale, PiggyBank,
} from "lucide-react";
import { CONSOLIDADO_VISIBLE } from "@/lib/consolidado-visible";

/**
 * Partners & Investor Dashboard (v2 — 17-ago-2026).
 *
 * Estructura tipo "dashboard del Director" pero con contenido para socios:
 * resumen ejecutivo arriba, KPIs hero, y secciones de finanzas (devengado vs
 * caja + serie mensual), crecimiento (pipeline CRM agregado) y calidad.
 *
 * REGLA: aquí no entra PHI. Sin nombres de residentes, sin facturas
 * individuales, sin staff con nombre. Solo agregados.
 */

interface VividKPI {
    hqId: string;
    name: string;
    logoUrl?: string | null;
    /**
     * OJO: `isOpen` NO dice si la sede abrió sus puertas. Es `hq.isActive`, y la
     * API ya filtra por `isActive: true`, así que aquí SIEMPRE vale true —
     * Mayagüez incluida, que abre en octubre. Quien contesta si abrió es
     * `apertura.esPreApertura`.
     */
    isOpen: boolean;
    apertura: {
        /** Mes en que la sede entró al sistema. */
        mesAlta: string;
        /** true = no ha emitido una sola factura en toda su vida. */
        sinFacturacionHistorica: boolean;
        esPreApertura: boolean;
        /** Gasto cargado ANTES de que empezara su serie. Solo en pre-apertura. */
        gastoPrevioALaSerie: number | null;
        mesesDeGastoPrevio: number;
        primerMesConGasto: string | null;
    };
    resumen: string[];
    ocupacion: {
        capacity: number;
        ocupadas: number;
        fisicos: number;
        enHospital: number;
        occupancyRate: number;
        camasLibres: number;
        altasMes: number;
        bajasMes: number;
    };
    finanzas: {
        facturadoMes: number;
        cobradoMes: number;
        tasaCobranza: number | null;
        vencidoTotal: number;
        arpu: number;
        mrr: number;
        potencialMensual: number;
        brechaFacturacion: number;
        serie: { mes: string; facturado: number; cobrado: number }[];
    };
    crecimiento: {
        pipeline: Record<string, number>;
        leadsActivos: number;
        ritmoMensualAdmisiones: number;
        mesesAFullOcupacion: number | null;
        funnel: {
            // 'MANUAL+CRM' = el mes se combinó por máximo entre las dos fuentes
            // (growth.ts). Faltaba en este tipo; como el dato entra por
            // res.json(), TSC nunca iba a avisar.
            serie: { mes: string; prospects: number; tours: number; evaluations: number; contracts: number; admissions: number; hasData: boolean; source: 'CRM' | 'MANUAL' | 'MANUAL+CRM' | 'NONE' }[];
            mesesDesdeCRM: number;
            mesesManuales: number;
            totales: { prospects: number; tours: number; evaluations: number; contracts: number; admissions: number };
            mesesConDatos: number;
            conversionPct: number | null;
            tourRatePct: number | null;
            admisionesMensualPromedio: number | null;
        };
    };
    calidad: {
        /**
         * `number | null`. Estaban declarados `number` a secas y por eso TSC no
         * avisó de que la pantalla imprimía la palabra "null": el dato entra por
         * `res.json()`, que es `any`, así que el tipo de aquí es lo único que
         * podía haberlo visto. `facilityHealthScore` es null cuando la sede no
         * tiene expedientes; `clinicalComplianceRate` lo es desde el 09-sep,
         * mientras Z_SCORE_VISIBLE siga apagado.
         */
        facilityHealthScore: number | null;
        facilityHealthGrade: 'EXCELENTE' | 'BUENO' | 'ALERTA' | 'CRITICO' | null;
        /** false → se pinta "—", nunca un 0 ni un "null". */
        facilityHealthMedible: boolean;
        facilityHealthMotivo: string | null;
        clinicalComplianceRate: number | null;
    };
    equipo: {
        staffCount: number;
        clinicalCount: number;
        ratioStaffResidente: number;
    };
    rentabilidad: {
        mesesConDatos: number;
        mesesSinDatos: number;
        ingresos: number;
        gastos: number;
        margen: number;
        margenPct: number | null;
        gastoMensualPromedio: number | null;
        serie: {
            mes: string; ingresos: number; gastos: number; margen: number;
            margenPct: number | null; hasExpenseData: boolean;
            porCategoria: { category: string; label: string; amount: number }[];
        }[];
        enCurso: {
            mes: string; ingresos: number; gastos: number; margen: number;
            margenPct: number | null; hasExpenseData: boolean;
        } | null;
        estructura: {
            total: number;
            categorias: { category: string; label: string; amount: number; pct: number }[];
        };
        breakEven: {
            camasNecesarias: number;
            camasSobreEquilibrio: number;
            ocupacionEquilibrioPct: number;
            alcanzable: boolean;
        } | null;
        /**
         * QUÉ MESES CUBRE ESTE BLOQUE, Y POR QUÉ NO HAY MARGEN SI NO LO HAY.
         * Sin esto el rótulo tenía que ser un literal escrito a mano, y mentía.
         */
        ventana: {
            /** Primer mes de la serie de ESTA sede. */
            desde: string;
            /** Último mes CERRADO. null si la sede no ha cerrado ninguno. */
            hasta: string | null;
            mesEnCurso: string;
            mesesCerrados: number;
            mesesEnResumen: number;
            motivoSinRentabilidad: 'SIN_MESES_CERRADOS' | 'SIN_GASTOS_CARGADOS' | null;
        };
    };
}

/**
 * LA SUMA DE LAS DOS SEDES. La API la devuelve null cuando solo hay una sede
 * visible —un "consolidado" de una sede es la misma sede otra vez— y entonces
 * esta pantalla no pinta nada.
 */
interface Consolidado {
    sedes: number;
    nombres: string[];
    rentabilidad: {
        meses: string[];
        desde: string | null;
        hasta: string | null;
        ingresos: number;
        gastos: number;
        margen: number;
        margenPct: number | null;
        sedesQueAportan: number;
        sedesSinMesesCerrados: number;
        /** Gasto real de las sedes que no aportan al margen. Se enseña aparte. */
        gastoDeSedesSinCerrar: number;
        /** Invertido antes de abrir. NO es "deuda entre sedes": ver abajo. */
        gastoPreAperturaAcumulado: number;
    };
    ocupacion: {
        capacity: number;
        ocupadas: number;
        camasLibres: number;
        occupancyRate: number;
        camasEnPreApertura: number;
        occupancyRateAbiertas: number | null;
    };
    residentes: { total: number; fisicos: number; enHospital: number };
    /** Sin margen a propósito: mezclaría el gasto de una sede que no factura. */
    mesEnCurso: { facturado: number; cobrado: number; vencidoTotal: number; brechaFacturacion: number };
    mrr: number;
}

const MESES_ES: Record<string, string> = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

/** "2026-07" → "Jul 2026". Para rótulos derivados del dato, nunca a mano. */
const mesLargo = (mes: string) => {
    const [yy, mm] = mes.split('-');
    return `${MESES_ES[mm] ?? mm} ${yy}`;
};

/**
 * "Jul–Ago 2026" a partir de los meses que de verdad entraron. Un solo mes se
 * imprime solo; el año se repite si los meses cruzan de año.
 */
const rangoMeses = (meses: string[]) => {
    if (meses.length === 0) return null;
    const primero = meses[0], ultimo = meses[meses.length - 1];
    if (primero === ultimo) return mesLargo(primero);
    const [ay] = primero.split('-'), [by] = ultimo.split('-');
    return ay === by
        ? `${MESES_ES[primero.split('-')[1]]}–${MESES_ES[ultimo.split('-')[1]]} ${ay}`
        : `${mesLargo(primero)} – ${mesLargo(ultimo)}`;
};

/**
 * El tamaño de la ventana de rentabilidad: los TRES últimos meses cerrados
 * (`partirPorCierre` → `ultimosTresCerrados`, en src/lib/profitability.ts).
 *
 * Vive aquí SOLO para contestar "¿salió corta la ventana?" y, si salió corta,
 * explicar por qué. Ninguna cifra de pantalla se calcula con este número: los
 * montos y los conteos salen del payload. Si algún día la ventana pasa a seis
 * meses, lo peor que ocurre es que deje de aparecer una nota explicativa —
 * nunca que un total se divida entre el número equivocado, que es justo lo que
 * hacía el "últimos 3 meses cerrados" escrito a mano que esto sustituyó.
 */
const VENTANA_MESES = 3;

const STAGE_LABELS: Record<string, string> = {
    PROSPECT: 'Prospectos',
    TOUR: 'Tour',
    EVALUATION: 'Evaluación',
    CONTRACT: 'Contrato',
    ADMISSION: 'Admitidos',
};

export default function VividInvestorsDashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [kpis, setKpis] = useState<VividKPI[]>([]);
    // La suma de las sedes. null cuando solo hay una visible — ver Consolidado.
    const [consolidado, setConsolidado] = useState<Consolidado | null>(null);
    // Sede visible. Con las sedes apiladas la pagina se duplicaba por cada una;
    // con cinco seria interminable. Se muestra una y se cambia con pestañas.
    const [sedeActiva, setSedeActiva] = useState(0);
    const [fetchLoading, setFetchLoading] = useState(true);
    // Solo para el INVESTOR al que el servidor le dice que no: ver el 403 de
    // abajo. A los demás se los lleva el rebote y nunca se pinta.
    const [sinAcceso, setSinAcceso] = useState(false);

    // El rol solo abre la puerta de la calle. Quien de verdad decide es el
    // servidor, que mira si esta persona POSEE una sede o tiene vínculo — ver
    // src/lib/acceso-inversion.ts. Aquí se deja DIRECTOR porque el dueño de
    // Cupey y Mayagüez lo es; un DIRECTOR sin sedes propias llega hasta la
    // llamada y se lo lleva el 403.
    const INVESTOR_ROLES = ['INVESTOR', 'ADMIN', 'DIRECTOR', 'SUPER_ADMIN'];

    useEffect(() => {
        if (loading) return;
        if (!user || !INVESTOR_ROLES.includes(user.role as string)) {
            // A /corporate, donde sí trabaja. Antes esto rebotaba a
            // /unauthorized, una ruta que NO EXISTE bajo src/app: el rebote
            // terminaba en un 404 crudo, sin barra lateral ni vuelta atrás.
            router.replace('/corporate');
            return;
        }
        fetch('/api/corporate/investors/kpis')
            .then(async res => {
                if (res.status === 401 || res.status === 403) {
                    // A un INVESTOR NO se le puede rebotar a /corporate:
                    // AuthContext.tsx:151 devuelve a esa gente a esta misma
                    // página, así que las dos redirecciones se persiguen sin
                    // fin y el spinner no para nunca. Se le dice en pantalla.
                    //
                    // Hoy no hay ninguna cuenta así —el único inversionista
                    // real entra por su SedeVinculo— pero ningún código del
                    // repo crea vínculos: la próxima cuenta INVESTOR nace sin
                    // uno y caería justo aquí.
                    if (user.role === 'INVESTOR') {
                        setSinAcceso(true);
                        setFetchLoading(false);
                        return;
                    }
                    // El resto sí trabaja en /corporate. Sin
                    // `setFetchLoading(false)` a propósito: la pantalla se
                    // queda en el spinner mientras navega. Ni un destello del
                    // panel para quien no puede verlo.
                    router.replace('/corporate');
                    return;
                }
                const data = await res.json();
                if (data.success) {
                    setKpis(data.targets);
                    setConsolidado(data.consolidado ?? null);
                }
                setFetchLoading(false);
            })
            .catch(err => { console.error(err); setFetchLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, loading, router]);

    if (loading || fetchLoading) {
        return (
            <div className="min-h-screen bg-[#101B33] flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-[#8CBBE8]/20 border-t-amber-500 rounded-full animate-spin"></div>
                <p className="mt-4 text-[#8CBBE8]/55 font-bold tracking-widest uppercase text-sm">Preparando Métricas del Grupo...</p>
            </div>
        );
    }

    // La cuenta tiene el rol pero no la participación. Esta pantalla es la
    // única a la que un INVESTOR puede entrar, así que la salida tiene que ser
    // cerrar sesión: un enlace a /corporate o a /login lo traería de vuelta.
    if (sinAcceso) {
        return (
            <div className="min-h-screen bg-[#101B33] flex flex-col items-center justify-center px-6 text-center">
                <h1 className="text-xl font-serif text-[#FAF6EE] tracking-tight uppercase">
                    Sin acceso a los números del grupo
                </h1>
                <p className="mt-3 max-w-md text-sm text-[#8CBBE8]/70 font-medium leading-relaxed">
                    Esta cuenta todavía no está vinculada a ninguna sede. Escríbele a
                    Zéndity para que registren la participación y vuelve a entrar.
                </p>
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="mt-8 text-xs font-bold text-[#FAF6EE]/50 hover:text-[#FAF6EE] transition-colors px-3 py-2"
                >
                    Cerrar sesión
                </button>
            </div>
        );
    }

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="min-h-screen bg-[#101B33] font-sans selection:bg-[#C5E69A] selection:text-[#1C3170]">
            {/* Header */}
            <div className="bg-[#1C3170]/85 backdrop-blur-xl border-b border-[#C5E69A]/25 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 flex flex-col md:flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/10 p-1">
                            <img src="/logo-vivid.png" alt="Vivid Senior Living Logo" className="max-h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-serif text-[#FAF6EE] tracking-tight uppercase pb-1">Vivid <span className="text-[#C5E69A] font-light">Senior Living</span></h1>
                            <p className="text-[#8CBBE8]/55 font-medium text-xs tracking-[0.2em] uppercase leading-relaxed">Partners & Investor Dashboard</p>
                        </div>
                    </div>
                    {/* Salida. La pagina es de pantalla completa —no lleva la barra
                        lateral— y sin esto quedaba sin forma de volver, como le pasaba
                        al panel de super admin. */}
                    <a
                        href="/corporate"
                        className="mt-4 md:mt-0 md:order-last text-xs font-bold text-[#FAF6EE]/50 hover:text-[#FAF6EE] transition-colors px-3 py-2"
                    >
                        ← Volver a Zéndity
                    </a>
                    <div className="mt-4 md:mt-0 flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-2 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-[#C5E69A] animate-pulse"></div>
                        <span className="text-[#C5E69A] text-xs font-bold uppercase tracking-widest">Datos en Vivo</span>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12 space-y-12">
                {/*
                    EL NÚMERO DEL NEGOCIO — LAS DOS SEDES SUMADAS.

                    Va primero y arriba porque es el dueño quien mira esta
                    pantalla, y su negocio son las dos juntas. Hasta hoy el total
                    no existía en ninguna parte: había que sacarlo a mano de dos
                    pestañas, que es donde se cometen los errores.

                    Si la API lo manda null (una sola sede visible) no se pinta
                    nada: repetir la misma sede en otra tarjeta la haría parecer
                    una segunda confirmación.
                */}
                {/*
                    Construida y apagada. Andrés la pidió el 19-sep-2026 y ese mismo
                    día pidió no enseñarla todavía. El interruptor y el porqué viven
                    en src/lib/consolidado-visible.ts; encenderla es cambiar una línea.
                    Se deja tipada y compilando a propósito: lo que se apaga comentando
                    deja de cuadrar con el payload y hay que rehacerlo para encenderlo.
                */}
                {CONSOLIDADO_VISIBLE && consolidado && (() => {
                    const r = consolidado.rentabilidad;
                    const oc = consolidado.ocupacion;
                    const rango = rangoMeses(r.meses);
                    return (
                        <section className="bg-gradient-to-br from-[#1C3170]/80 via-[#1C3170]/45 to-transparent border border-[#C5E69A]/30 rounded-3xl p-8 space-y-7">
                            <div className="flex items-start justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-[#FAF6EE] flex items-center gap-2">
                                        <Landmark className="w-5 h-5 text-[#C5E69A]" /> Grupo consolidado
                                    </h2>
                                    <p className="text-[#8CBBE8]/70 text-xs font-medium mt-1.5 leading-relaxed">
                                        {consolidado.sedes} sedes sumadas: {consolidado.nombres.join(' + ')}.
                                    </p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#C5E69A] bg-[#C5E69A]/10 border border-[#C5E69A]/25 px-3 py-1 rounded-full">
                                    {rango ? `Margen sobre ${rango}` : 'Sin meses cerrados todavía'}
                                </span>
                            </div>

                            {/* Rentabilidad del grupo. Los % salen de los totales,
                                nunca del promedio de los márgenes de cada sede. */}
                            {r.sedesQueAportan > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Ingresos del grupo', value: fmt(r.ingresos), tone: 'text-[#FAF6EE]' },
                                            { label: 'Gastos del grupo', value: fmt(r.gastos), tone: 'text-rose-400' },
                                            { label: 'Margen antes de overhead', value: fmt(r.margen), tone: r.margen >= 0 ? 'text-[#C5E69A]' : 'text-rose-400' },
                                            { label: '% antes de overhead', value: r.margenPct !== null ? `${r.margenPct}%` : '—', tone: (r.margenPct ?? 0) >= 0 ? 'text-[#C5E69A]' : 'text-rose-400' },
                                        ].map(k => (
                                            <div key={k.label} className="bg-[#101B33]/50 rounded-2xl p-5 border border-[#8CBBE8]/20">
                                                <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">{k.label}</p>
                                                <p className={`text-2xl font-black mt-1 ${k.tone}`}>{k.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[#8CBBE8]/55 text-[11px] leading-relaxed">
                                        Suma de {r.sedesQueAportan} sede{r.sedesQueAportan !== 1 ? 's' : ''} sobre los meses
                                        {' '}<strong className="text-[#8CBBE8]/80">cerrados</strong>{rango ? ` (${rango})` : ''}.
                                        El porcentaje se recalcula sobre los totales del grupo; no es el promedio de los márgenes de cada sede.
                                    </p>
                                </>
                            ) : (
                                <p className="text-[#8CBBE8]/70 text-sm leading-relaxed">
                                    Ninguna sede tiene todavía un mes cerrado con gastos cargados, así que no hay margen
                                    consolidado que enseñar. Los números del mes en curso sí están, abajo.
                                </p>
                            )}

                            {/* Lo que queda FUERA del margen, con nombre propio. El
                                gasto de una sede sin ingreso no se mete en el margen
                                —derrumbaría el % con costos de un mes contra ingresos
                                de otro— pero tampoco se esconde. */}
                            {(r.gastoDeSedesSinCerrar > 0 || r.gastoPreAperturaAcumulado > 0) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                    {r.gastoDeSedesSinCerrar > 0 && (
                                        <div className="bg-[#101B33]/40 rounded-2xl p-5 border border-amber-500/25">
                                            <p className="text-[10px] text-amber-400/80 font-black uppercase tracking-widest">Gasto fuera del margen</p>
                                            <p className="text-xl font-black mt-1 text-[#FAF6EE]">{fmt(r.gastoDeSedesSinCerrar)}</p>
                                            <p className="text-[#8CBBE8]/55 text-[11px] mt-2 leading-snug">
                                                Del mes en curso de {r.sedesSinMesesCerrados} sede{r.sedesSinMesesCerrados !== 1 ? 's' : ''} sin
                                                ningún mes cerrado. Es gasto real y es suyo: queda fuera del margen porque
                                                todavía no tiene ingreso contra el cual medirse, no porque se haya perdido.
                                            </p>
                                        </div>
                                    )}
                                    {r.gastoPreAperturaAcumulado > 0 && (
                                        <div className="bg-[#101B33]/40 rounded-2xl p-5 border border-[#8CBBE8]/25">
                                            <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Invertido antes de abrir</p>
                                            <p className="text-xl font-black mt-1 text-[#FAF6EE]">{fmt(r.gastoPreAperturaAcumulado)}</p>
                                            {/* NO dice "lo que una sede le debe a otra": la base no
                                                guarda quién pagó cada gasto (MonthlyExpense no tiene
                                                ese campo). Eso es un acuerdo entre socios, no un dato. */}
                                            <p className="text-[#8CBBE8]/55 text-[11px] mt-2 leading-snug">
                                                Acumulado por sedes que todavía no reciben residentes, antes de facturar un
                                                solo dólar. No toca ningún margen: es inversión previa a la apertura.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Ocupación y mes en curso del grupo */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-[#8CBBE8]/20">
                                <div className="pt-5">
                                    <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Ocupación del grupo</p>
                                    <p className="text-2xl font-black text-[#FAF6EE] mt-1">{oc.occupancyRate}%</p>
                                    <p className="text-[11px] text-[#C5E69A] font-bold mt-0.5">{oc.ocupadas}/{oc.capacity} camas</p>
                                </div>
                                <div className="pt-5">
                                    <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Facturado del mes</p>
                                    <p className="text-2xl font-black text-[#FAF6EE] mt-1">{fmt(consolidado.mesEnCurso.facturado)}</p>
                                    <p className="text-[11px] text-[#C5E69A] font-bold mt-0.5">{fmt(consolidado.mesEnCurso.cobrado)} cobrado</p>
                                </div>
                                <div className="pt-5">
                                    <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Ingreso recurrente</p>
                                    <p className="text-2xl font-black text-[#FAF6EE] mt-1">{fmt(consolidado.mrr)}</p>
                                    <p className="text-[11px] text-[#8CBBE8]/55 font-bold mt-0.5">{consolidado.residentes.total} residentes</p>
                                </div>
                                <div className="pt-5">
                                    <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Vencido acumulado</p>
                                    <p className={`text-2xl font-black mt-1 ${consolidado.mesEnCurso.vencidoTotal > 0 ? 'text-rose-400' : 'text-[#C5E69A]'}`}>
                                        {fmt(consolidado.mesEnCurso.vencidoTotal)}
                                    </p>
                                    <p className="text-[11px] text-[#8CBBE8]/55 font-bold mt-0.5">{fmt(consolidado.mesEnCurso.brechaFacturacion)} por facturar</p>
                                </div>
                            </div>

                            {/* Un 32% se lee como "medio vacío" si no se dice que la
                                mitad de las camas están en un edificio que no ha
                                abierto. Las dos cifras son ciertas; sin la segunda,
                                la primera engaña. */}
                            {oc.camasEnPreApertura > 0 && (
                                <p className="text-[#8CBBE8]/55 text-[11px] leading-relaxed">
                                    {oc.camasEnPreApertura} de las {oc.capacity} camas están en sedes que todavía no abren
                                    {oc.occupancyRateAbiertas !== null
                                        ? <> — contando solo las sedes abiertas, la ocupación es <strong className="text-[#C5E69A]">{oc.occupancyRateAbiertas}%</strong>.</>
                                        : '.'}
                                </p>
                            )}

                            <p className="text-[#8CBBE8]/45 text-[11px] leading-snug border-t border-[#8CBBE8]/15 pt-4">
                                <strong className="text-[#8CBBE8]/70">El mes en curso va sin margen.</strong> Sumar lo
                                facturado de las dos sedes es legítimo —son dólares del mismo mes—, pero la facturación
                                sale el día 1 y los gastos llegan goteando, así que un margen del mes en curso saldría
                                inflado. Se cierra cuando termine el mes.
                            </p>
                        </section>
                    );
                })()}

                {/* Selector de sede. Solo aparece con mas de una: con una sola seria
                    una fila vacia que no aporta nada.

                    Va como control segmentado —fondo y borde propios— y no como
                    pastillas sueltas. Las pastillas quedaban flotando encima del
                    titulo de la sede y se leian como parte de el. */}
                {kpis.length > 1 && (
                    <div className="inline-flex gap-1 p-1 rounded-full bg-[#1C3170]/40 border border-[#8CBBE8]/20">
                        {kpis.map((hq, i) => (
                            <button
                                key={hq.hqId}
                                onClick={() => setSedeActiva(i)}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${
                                    i === sedeActiva
                                        ? 'bg-[#C5E69A] text-[#1C3170]'
                                        : 'text-[#8CBBE8]/70 hover:text-[#FAF6EE]'
                                }`}
                            >
                                {hq.name.replace('Vivid Senior Living ', '')}
                            </button>
                        ))}
                    </div>
                )}

                {kpis.filter((_, i) => i === sedeActiva || kpis.length === 1).map((hq) => {
                    const o = hq.ocupacion, f = hq.finanzas, c = hq.crecimiento, q = hq.calidad, e = hq.equipo, p = hq.rentabilidad;
                    const maxSerie = Math.max(...f.serie.map(s => s.facturado), 1);
                    /**
                     * La cadena no tenía rama por defecto: cualquier valor que no
                     * fuera uno de los tres primeros caía en el rojo de crisis. Con
                     * `grade: null` —Mayagüez, sede sin expedientes— la tarjeta
                     * salía en rojo, como si la salud fuera CRÍTICA, cuando lo que
                     * pasa es que no hay nada que medir todavía.
                     */
                    const gradeColor = !q.facilityHealthMedible ? 'text-[#8CBBE8]/55'
                        : q.facilityHealthGrade === 'EXCELENTE' ? 'text-[#C5E69A]'
                        : q.facilityHealthGrade === 'BUENO' ? 'text-teal-400'
                        : q.facilityHealthGrade === 'ALERTA' ? 'text-amber-400'
                        : 'text-rose-400';
                    const maxPipeline = Math.max(...Object.values(c.pipeline), 1);

                    /**
                     * EL RÓTULO SE DERIVA DEL DATO, NO SE ESCRIBE A MANO.
                     *
                     * Decía "últimos 3 meses cerrados" como literal, y las tarjetas
                     * de abajo suman DOS (jul+ago). Quien dividiera los 139.048
                     * entre tres calculaba 46.349/mes de facturación cuando la
                     * verdad son 69.524: un 33% por debajo, en la pantalla que se
                     * le enseña a los socios.
                     *
                     * Se cuenta con `mesesConDatos`, NO con `serie.length`:
                     * `summarizeProfitability` solo suma los meses con gastos
                     * cargados, así que `mesesConDatos` es el que gobierna los
                     * montos de las tarjetas. Si un mes de la ventana llegara sin
                     * gastos, `serie.length` volvería a mentir por el mismo sitio.
                     */
                    const mesesMedidos = p.serie.filter(s => s.hasExpenseData).map(s => s.mes);
                    const rangoMedido = rangoMeses(mesesMedidos);

                    return (
                        <section key={hq.hqId} className="space-y-8">
                            {/* Título de sede */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-3xl font-light text-[#FAF6EE] tracking-tight">{hq.name}</h2>
                                    {/*
                                        SE MIRA `apertura.esPreApertura`, NO `isOpen`.

                                        `isOpen` es `hq.isActive` y la API ya filtra por
                                        `isActive: true`, así que valía true para TODAS las
                                        sedes que llegan aquí: esta rama de Pre-Apertura
                                        llevaba escrita desde siempre sin ser alcanzable, y
                                        Mayagüez —que abre en octubre— salía "Operativo".
                                    */}
                                    {!hq.apertura.esPreApertura ? (
                                        <span className="px-3 py-1 bg-[#C5E69A]/10 text-[#C5E69A] border border-[#C5E69A]/25 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Operativo
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Pre-Apertura
                                        </span>
                                    )}
                                </div>
                                {hq.logoUrl && (
                                    <img src={hq.logoUrl} alt="Logo" className="max-h-10 object-contain hidden sm:block opacity-70" />
                                )}
                            </div>

                            {/* Resumen ejecutivo */}
                            <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-[#C5E69A]/25 rounded-3xl p-8">
                                <h3 className="text-sm font-black text-[#C5E69A] uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Sparkles className="w-4 h-4" /> Resumen Ejecutivo
                                </h3>
                                <ul className="space-y-2.5">
                                    {hq.resumen.map((r, i) => (
                                        <li key={i} className="text-[#FAF6EE]/80 text-[15px] leading-relaxed flex gap-3">
                                            <span className="text-[#C5E69A] font-black shrink-0">·</span>{r}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* KPIs hero */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'Ocupación', value: `${o.occupancyRate}%`, sub: `${o.ocupadas}/${o.capacity} camas`, icon: BedDouble, tone: 'text-[#C5E69A]' },
                                    { label: 'Ingreso Recurrente', value: fmt(f.mrr), sub: `ARPU ${fmt(f.arpu)}`, icon: DollarSign, tone: 'text-[#C5E69A]' },
                                    { label: 'Cobranza del Mes', value: f.tasaCobranza !== null ? `${f.tasaCobranza}%` : '—', sub: `${fmt(f.cobradoMes)} cobrado`, icon: Landmark, tone: 'text-teal-400' },
                                    /**
                                     * Interpolaba `${q.facilityHealthScore}` en un
                                     * template string: con score null eso NO desaparece,
                                     * escribe las cuatro letras. En la tarjeta hero de
                                     * Mayagüez se leía "null" bajo "Salud Operativa", y
                                     * el subtítulo, otro "null".
                                     *
                                     * La guarda va sobre el VALOR (`facilityHealthMedible`
                                     * / el propio null), no sobre un flag: el día que la
                                     * sede que no se puede medir sea otra, sigue servida.
                                     */
                                    {
                                        label: 'Salud Operativa',
                                        value: q.facilityHealthScore !== null ? `${q.facilityHealthScore}` : '—',
                                        sub: q.facilityHealthGrade ?? 'Sin medir todavía',
                                        icon: HeartPulse,
                                        tone: gradeColor,
                                    },
                                ].map(kpi => (
                                    <div key={kpi.label} className="bg-[#1C3170]/40 border border-[#8CBBE8]/20 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 text-[#8CBBE8]/55 mb-3">
                                            <kpi.icon className={`w-4 h-4 ${kpi.tone}`} />
                                            <span className="text-[11px] font-black uppercase tracking-widest">{kpi.label}</span>
                                        </div>
                                        <p className="text-3xl font-black text-[#FAF6EE]">{kpi.value}</p>
                                        <p className={`text-xs font-bold mt-1 ${kpi.tone}`}>{kpi.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Un "—" sin explicación se lee como un fallo de carga. La API
                                manda el motivo hecho texto; se pinta justo debajo del guion. */}
                            {!q.facilityHealthMedible && q.facilityHealthMotivo && (
                                <p className="text-[#8CBBE8]/45 text-[11px] leading-snug -mt-4">
                                    Salud operativa sin medir: {q.facilityHealthMotivo.toLowerCase()}.
                                </p>
                            )}

                            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                                {/* Finanzas */}
                                <div className="xl:col-span-3 bg-[#1C3170]/40 border border-[#8CBBE8]/20 rounded-3xl p-8 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-[#FAF6EE] flex items-center gap-2">
                                            <DollarSign className="w-5 h-5 text-[#C5E69A]" /> Finanzas
                                        </h3>
                                        <span className="text-[10px] text-[#8CBBE8]/55 font-bold uppercase tracking-widest">Devengado vs Caja</span>
                                    </div>

                                    {/* Serie mensual */}
                                    <div className="space-y-4">
                                        {f.serie.map(s => {
                                            const [yy, mm] = s.mes.split('-');
                                            return (
                                                <div key={s.mes} className="space-y-1.5">
                                                    <div className="flex justify-between items-baseline text-xs">
                                                        <span className="font-black text-[#8CBBE8]/70 uppercase tracking-wider">{MESES_ES[mm]} {yy}</span>
                                                        <span className="text-[#8CBBE8]/55">
                                                            <span className="text-[#FAF6EE] font-bold">{fmt(s.facturado)}</span> facturado
                                                            <span className="mx-1.5 text-[#1C3170]">·</span>
                                                            <span className="text-[#C5E69A] font-bold">{fmt(s.cobrado)}</span> cobrado
                                                        </span>
                                                    </div>
                                                    <div className="h-3 w-full bg-[#101B33] rounded-full overflow-hidden relative">
                                                        <div className="absolute inset-y-0 left-0 bg-[#C5E69A]/30 rounded-full" style={{ width: `${(s.facturado / maxSerie) * 100}%` }} />
                                                        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-[#C5E69A] rounded-full" style={{ width: `${(s.cobrado / maxSerie) * 100}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Detalle */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-[#8CBBE8]/20">
                                        {[
                                            { label: 'Facturado (mes)', value: fmt(f.facturadoMes), tone: 'text-[#FAF6EE]' },
                                            { label: 'Vencido acum.', value: fmt(f.vencidoTotal), tone: f.vencidoTotal > 0 ? 'text-rose-400' : 'text-[#C5E69A]' },
                                            { label: 'Por facturar', value: fmt(f.brechaFacturacion), tone: f.brechaFacturacion > 0 ? 'text-[#C5E69A]' : 'text-[#C5E69A]' },
                                            { label: 'Potencial 100%', value: fmt(f.potencialMensual), tone: 'text-[#FAF6EE]/80' },
                                        ].map(d => (
                                            <div key={d.label} className="pt-4">
                                                <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">{d.label}</p>
                                                <p className={`text-lg font-black mt-0.5 ${d.tone}`}>{d.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Crecimiento */}
                                <div className="xl:col-span-2 bg-[#1C3170]/40 border border-[#8CBBE8]/20 rounded-3xl p-8 space-y-6">
                                    <h3 className="text-lg font-bold text-[#FAF6EE] flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-[#C5E69A]" /> Crecimiento
                                    </h3>

                                    {/*
                                        EL EMBUDO VA PRIMERO Y VA GRANDE.

                                        Andrés, 19-sep-2026: "en crecimiento solo veo un
                                        tour pero entre más información." Sus datos SÍ
                                        estaban —36 tours en el trimestre— pero arriba y en
                                        grande estaba el PIPELINE, que es el estado del CRM
                                        hoy y tiene literalmente 1 lead en TOUR. Un 1 de
                                        titular se lee como "perdí mis datos".

                                        El embudo es la ACTIVIDAD DEL PERÍODO, que es lo que
                                        se mira en una pantalla de inversores. El pipeline
                                        pasa abajo, rotulado como lo que es.
                                    */}
                                    {c.funnel.mesesConDatos > 0 ? (
                                        <div className="space-y-4">
                                            <div className="flex items-baseline justify-between flex-wrap gap-2">
                                                <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">
                                                    Actividad comercial
                                                    {(() => {
                                                        const rangoFunnel = rangoMeses(c.funnel.serie.filter(s => s.hasData).map(s => s.mes));
                                                        return rangoFunnel ? <span className="ml-2 text-[#8CBBE8]/70 normal-case tracking-normal font-bold">{rangoFunnel}</span> : null;
                                                    })()}
                                                    <span className="ml-2 text-[#8CBBE8]/45 normal-case tracking-normal font-bold">
                                                        · {c.funnel.mesesConDatos} mes{c.funnel.mesesConDatos !== 1 ? 'es' : ''}
                                                        {/*
                                                            "1 desde CRM, 3 manual" sobre 3 meses NO suma,
                                                            y un socio que lo lee intenta sumarlo.

                                                            Desde que growth.ts devuelve `MANUAL+CRM`
                                                            (septiembre de Cupey, medido hoy) un mes cuenta
                                                            en las DOS cifras, así que dejaron de ser un
                                                            reparto. No se inventa el solape: se deduce del
                                                            propio dato —si las dos cifras suman más que los
                                                            meses, hay meses con las dos fuentes— y solo
                                                            entonces se dice. Con fuentes disjuntas la nota
                                                            no aparece, porque ahí sí es un reparto.
                                                        */}
                                                        {c.funnel.mesesDesdeCRM > 0 && (
                                                            <span className="ml-1 text-teal-400/70">
                                                                ({c.funnel.mesesManuales > 0
                                                                    ? `${c.funnel.mesesDesdeCRM} con CRM, ${c.funnel.mesesManuales} con carga manual${
                                                                        c.funnel.mesesDesdeCRM + c.funnel.mesesManuales > c.funnel.mesesConDatos
                                                                            ? '; hay meses con las dos'
                                                                            : ''}`
                                                                    : 'desde CRM'})
                                                            </span>
                                                        )}
                                                    </span>
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    {/* Las dos tasas van con `!== null` a propósito:
                                                        growth.ts devuelve null cuando el numerador
                                                        supera al denominador —hoy 36 tours contra 31
                                                        prospectos— porque los snapshots cuentan actos
                                                        del mes, no una cohorte, y un "116% de tours"
                                                        no significa nada. Los conteos crudos sí son
                                                        ciertos y se siguen enseñando. */}
                                                    {c.funnel.tourRatePct !== null && (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-300 bg-teal-400/10 border border-teal-400/25 px-2.5 py-0.5 rounded-full">
                                                            {c.funnel.tourRatePct}% llega a tour
                                                        </span>
                                                    )}
                                                    {c.funnel.conversionPct !== null && (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-[#C5E69A] bg-[#C5E69A]/10 border border-[#C5E69A]/25 px-2.5 py-0.5 rounded-full">
                                                            {c.funnel.conversionPct}% conversión
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {(() => {
                                                const t = c.funnel.totales;
                                                const steps = [
                                                    { label: 'Prospectos', v: t.prospects },
                                                    { label: 'Tours', v: t.tours },
                                                    { label: 'Evaluaciones', v: t.evaluations },
                                                    { label: 'Contratos', v: t.contracts },
                                                    { label: 'Admisiones', v: t.admissions },
                                                ];
                                                const top = Math.max(...steps.map(s => s.v), 1);
                                                return (
                                                    <div className="space-y-3.5">
                                                        {steps.map((s, i) => (
                                                            <div key={s.label} className="flex items-center gap-3">
                                                                <span className="text-[11px] text-[#8CBBE8]/70 font-black uppercase tracking-wider w-24 shrink-0">{s.label}</span>
                                                                <div className="flex-1 h-4 bg-[#101B33] rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${i === steps.length - 1 ? 'bg-gradient-to-r from-emerald-600 to-[#C5E69A]' : 'bg-gradient-to-r from-teal-600 to-teal-400'}`}
                                                                        style={{ width: `${(s.v / top) * 100}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[#FAF6EE] font-black text-xl w-10 text-right tabular-nums">{s.v}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                            <p className="text-[#8CBBE8]/45 text-[11px] leading-snug">
                                                Actos ocurridos en el período, no el estado de una lista. Un tour de
                                                septiembre puede venir de un prospecto de agosto.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center border-2 border-dashed border-[#8CBBE8]/20 rounded-2xl">
                                            <p className="text-[#8CBBE8]/70 font-bold text-sm">Sin actividad comercial registrada en el período</p>
                                            <p className="text-[#8CBBE8]/45 text-[11px] mt-1.5">
                                                Ni el CRM ni la carga mensual tienen movimiento para estos meses.
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#8CBBE8]/20">
                                        <div>
                                            <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Camas libres</p>
                                            <p className="text-2xl font-black text-[#FAF6EE] mt-0.5">{o.camasLibres}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">Full ocupación</p>
                                            <p className="text-2xl font-black text-[#FAF6EE] mt-0.5">{c.mesesAFullOcupacion !== null ? `~${c.mesesAFullOcupacion} meses` : '—'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 pt-4 border-t border-[#8CBBE8]/20 text-xs">
                                        <span className="flex items-center gap-1.5 text-[#C5E69A] font-bold">
                                            <ArrowUpRight className="w-4 h-4" /> {o.altasMes} admisión{o.altasMes !== 1 ? 'es' : ''} este mes
                                        </span>
                                        <span className="flex items-center gap-1.5 text-[#8CBBE8]/55 font-bold">
                                            <ArrowDownRight className="w-4 h-4" /> {o.bajasMes} egreso{o.bajasMes !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {/*
                                        EL PIPELINE, ABAJO Y ROTULADO.

                                        Es una FOTO del CRM hoy, no la actividad del
                                        período: cuenta cuántas fichas están paradas en cada
                                        etapa en este instante. Hoy da 1 en TOUR contra los
                                        36 tours del trimestre, y esos dos números no se
                                        contradicen — miden cosas distintas. Estaba arriba y
                                        en grande, y por eso se leía como el titular.
                                    */}
                                    <div className="pt-4 border-t border-[#8CBBE8]/20 space-y-2.5">
                                        <p className="text-[10px] text-[#8CBBE8]/45 font-black uppercase tracking-widest">
                                            Ahora mismo en el CRM
                                            <span className="ml-2 normal-case tracking-normal font-bold text-[#8CBBE8]/40">
                                                fichas abiertas por etapa, no actividad del período
                                            </span>
                                        </p>
                                        {Object.entries(c.pipeline).map(([stage, count]) => (
                                            <div key={stage} className="flex items-center gap-3">
                                                <span className="text-[10px] text-[#8CBBE8]/45 font-black uppercase tracking-wider w-24 shrink-0">{STAGE_LABELS[stage] || stage}</span>
                                                <div className="flex-1 h-1.5 bg-[#101B33] rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${stage === 'ADMISSION' ? 'bg-emerald-600/60' : 'bg-amber-600/50'}`}
                                                        style={{ width: `${(count / maxPipeline) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-[#8CBBE8]/70 font-bold text-xs w-6 text-right tabular-nums">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Rentabilidad — Fase 3 */}
                            <div className="bg-[#1C3170]/40 border border-[#8CBBE8]/20 rounded-3xl p-8 space-y-6">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <h3 className="text-lg font-bold text-[#FAF6EE] flex items-center gap-2 flex-wrap">
                                        <PiggyBank className="w-5 h-5 text-[#C5E69A]" /> Rentabilidad Operativa
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[#8CBBE8]/55 ml-1">
                                            {/*
                                                TRES ESTADOS, NO DOS — y ninguno puede contradecir
                                                al cuerpo que va justo debajo.

                                                Decir "sin meses cerrados todavía" mirando
                                                `mesesConDatos` era falso en cuanto hubiera meses
                                                cerrados SIN gastos cargados: el rótulo negaba los
                                                meses y dos líneas más abajo el cuerpo los contaba
                                                ("Hay 2 meses cerrados pero nadie cargó los
                                                gastos"). Son dos preguntas distintas y cada una
                                                tiene su campo: `ventana.mesesCerrados` dice si el
                                                mes terminó, `mesesConDatos` si alguien cargó lo
                                                que costó.

                                                Y `mesesConDatos` NO son "meses cerrados": son
                                                meses CON GASTOS CARGADOS, que es lo que gobierna
                                                los montos de abajo. Hoy coinciden (2 y 2); el día
                                                que no coincidan, que el rótulo diga el que cuenta.
                                            */}
                                            {p.ventana.mesesCerrados === 0
                                                ? 'sin meses cerrados todavía'
                                                : p.mesesConDatos === 0
                                                    ? `${p.ventana.mesesCerrados} mes${p.ventana.mesesCerrados !== 1 ? 'es' : ''} cerrado${p.ventana.mesesCerrados !== 1 ? 's' : ''} · sin gastos cargados`
                                                    : `${p.mesesConDatos} mes${p.mesesConDatos !== 1 ? 'es' : ''} con gastos cargados${rangoMedido ? ` · ${rangoMedido}` : ''}`}
                                        </span>
                                    </h3>
                                    {p.mesesSinDatos > 0 && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[#C5E69A] bg-[#C5E69A]/10 border border-[#C5E69A]/25 px-3 py-1 rounded-full">
                                            {p.mesesSinDatos} mes{p.mesesSinDatos !== 1 ? 'es' : ''} sin gastos cargados
                                        </span>
                                    )}
                                </div>

                                {/*
                                    POR QUÉ SON DOS Y NO TRES.

                                    Hasta hoy la razón vivía solo en un comentario del código
                                    (`SERIES_FLOOR` en la API), que el dueño no lee. En
                                    pantalla el número aparecía sin explicación, y un socio
                                    que ve "2 meses" donde esperaba un trimestre se pregunta
                                    si falta algo cargado. No falta: falta contexto.

                                    Se distinguen las dos causas, porque son distintas:
                                    la sede es más nueva que la ventana, o la ventana arranca
                                    en el piso global de facturación sistemática.

                                    LA GUARDA MIRA `ventana.mesesEnResumen`, NO `mesesConDatos`.
                                    Esta nota explica UNA cosa: que la ventana salió corta. Si
                                    se disparara con `mesesConDatos` afirmaría esa causa también
                                    cuando la ventana tiene sus tres meses y lo que falta son
                                    gastos cargados en uno — echándole la culpa al calendario de
                                    lo que es un dato sin cargar. Esa otra causa ya la dice la
                                    pastilla "N meses sin gastos cargados" de arriba.
                                */}
                                {p.mesesConDatos > 0 && p.ventana.mesesEnResumen < VENTANA_MESES && (
                                    <p className="text-[#8CBBE8]/45 text-[11px] leading-snug -mt-2">
                                        {p.ventana.desde <= hq.apertura.mesAlta
                                            ? <>La serie de esta sede empieza en {mesLargo(p.ventana.desde)}, cuando entró al sistema: no hay meses anteriores que medir.</>
                                            : <>La ventana arranca en {mesLargo(p.ventana.desde)}, el primer mes con facturación sistemática. Lo anterior queda fuera a propósito: eran pruebas, no operación.</>}
                                    </p>
                                )}

                                {/*
                                    DOS CAUSAS DISTINTAS QUE DECÍAN LA MISMA FRASE.

                                    "Sin datos de gastos operativos / El margen no puede
                                    calcularse hasta que se carguen los gastos del mes" era
                                    FALSO en Mayagüez, y además le echaba la culpa al dueño:
                                    sus gastos SÍ están cargados —16.666,66 de renta en
                                    septiembre— y la pantalla le pedía cargarlos. Lo que no
                                    tiene es un mes CERRADO: entró al sistema el 02-sep y
                                    septiembre no ha terminado.

                                    La API ya separa las dos con `motivoSinRentabilidad`.
                                    Aquí se dicen distinto: a una no se le pide nada.
                                */}
                                {p.mesesConDatos === 0 ? (
                                    p.ventana.motivoSinRentabilidad === 'SIN_MESES_CERRADOS' ? (
                                        <div className="py-8 px-6 border-2 border-dashed border-[#8CBBE8]/20 rounded-2xl space-y-3 max-w-2xl">
                                            <p className="text-[#FAF6EE]/85 font-bold">
                                                Todavía no hay ningún mes cerrado que medir
                                            </p>
                                            <p className="text-[#8CBBE8]/60 text-sm leading-relaxed">
                                                La serie de esta sede empieza en {mesLargo(p.ventana.desde)} y {mesLargo(p.ventana.mesEnCurso)} sigue
                                                en curso. Un margen necesita un mes terminado: ingresos y costos del mismo
                                                período, o ninguno de los dos.
                                            </p>
                                            {p.enCurso?.hasExpenseData && (
                                                <p className="text-[#8CBBE8]/60 text-sm leading-relaxed">
                                                    Los gastos del mes <strong className="text-[#C5E69A]">sí están cargados</strong> ({fmt(p.enCurso.gastos)}).
                                                    No falta nada por tu parte: el margen aparecerá solo cuando cierre el mes.
                                                </p>
                                            )}
                                            {/* Los ceros de una sede que no ha abierto son la
                                                verdad, no un hueco de datos. Sin decirlo, este
                                                bloque se lee como un negocio que se hunde. */}
                                            {hq.apertura.esPreApertura && (
                                                <p className="text-[#8CBBE8]/60 text-sm leading-relaxed border-t border-[#8CBBE8]/15 pt-3">
                                                    Esta sede todavía no recibe residentes, así que sus ceros son reales.
                                                    {hq.apertura.gastoPrevioALaSerie !== null && (
                                                        <> Lleva <strong className="text-[#FAF6EE]/90">{fmt(hq.apertura.gastoPrevioALaSerie)}</strong> de
                                                        gasto acumulado en {hq.apertura.mesesDeGastoPrevio} mes{hq.apertura.mesesDeGastoPrevio !== 1 ? 'es' : ''} desde
                                                        {' '}{hq.apertura.primerMesConGasto ? mesLargo(hq.apertura.primerMesConGasto) : '—'}, antes de facturar
                                                        un solo dólar: es inversión previa a la apertura, no una pérdida operativa.</>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        // Sí hay meses cerrados y nadie cargó los gastos.
                                        // Aquí el aviso es correcto y sí hay algo que hacer.
                                        <div className="py-10 text-center border-2 border-dashed border-[#8CBBE8]/20 rounded-2xl">
                                            <p className="text-[#8CBBE8]/70 font-bold">Sin datos de gastos operativos</p>
                                            <p className="text-[#8CBBE8]/55 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                                                Hay {p.ventana.mesesCerrados} mes{p.ventana.mesesCerrados !== 1 ? 'es' : ''} cerrado{p.ventana.mesesCerrados !== 1 ? 's' : ''} pero
                                                nadie cargó los gastos, así que el margen no puede calcularse. No mostramos un
                                                margen inflado por datos faltantes.
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    <>
                                        {/* Hero de margen */}
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            {[
                                                { label: 'Ingresos', value: fmt(p.ingresos), tone: 'text-[#FAF6EE]' },
                                                { label: 'Gastos', value: fmt(p.gastos), tone: 'text-rose-400' },
                                                /**
                                                 * "Margen antes de overhead", no "Margen" a secas.
                                                 *
                                                 * Andrés, 16-sep-2026: "hay márgenes de gastos que no se
                                                 * documentan directo en Zéndity... la idea es mantener
                                                 * abierta la posibilidad de que hay gastos que no están
                                                 * registrados". El nombre tiene que decirlo: este número
                                                 * es un techo, no el beneficio final.
                                                 */
                                                { label: 'Margen antes de overhead', value: fmt(p.margen), tone: p.margen >= 0 ? 'text-[#C5E69A]' : 'text-rose-400' },
                                                { label: '% antes de overhead', value: p.margenPct !== null ? `${p.margenPct}%` : '—', tone: (p.margenPct ?? 0) >= 0 ? 'text-[#C5E69A]' : 'text-rose-400' },
                                            ].map(k => (
                                                <div key={k.label} className="bg-[#101B33]/50 rounded-2xl p-5 border border-[#8CBBE8]/20">
                                                    <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">{k.label}</p>
                                                    <p className={`text-2xl font-black mt-1 ${k.tone}`}>{k.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Serie mensual ingresos vs gastos */}
                                        <div className="space-y-4">
                                            {p.serie.map(s => {
                                                const [yy, mm] = s.mes.split('-');
                                                const max = Math.max(...p.serie.map(x => Math.max(x.ingresos, x.gastos)), 1);
                                                return (
                                                    <div key={s.mes} className="space-y-1.5">
                                                        <div className="flex justify-between items-baseline text-xs">
                                                            <span className="font-black text-[#8CBBE8]/70 uppercase tracking-wider">{MESES_ES[mm]} {yy}</span>
                                                            {s.hasExpenseData ? (
                                                                <span className="text-[#8CBBE8]/55">
                                                                    <span className="text-[#FAF6EE] font-bold">{fmt(s.ingresos)}</span>
                                                                    <span className="mx-1.5 text-[#1C3170]">−</span>
                                                                    <span className="text-rose-400 font-bold">{fmt(s.gastos)}</span>
                                                                    <span className="mx-1.5 text-[#1C3170]">=</span>
                                                                    <span className={`font-black ${s.margen >= 0 ? 'text-[#C5E69A]' : 'text-rose-400'}`}>
                                                                        {fmt(s.margen)}{s.margenPct !== null ? ` (${s.margenPct}%)` : ''}
                                                                    </span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-[#C5E69A]/70 font-bold text-[11px] uppercase tracking-wider">
                                                                    {fmt(s.ingresos)} facturado · gastos sin cargar
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1 h-3">
                                                            <div className="flex-1 bg-[#101B33] rounded-full overflow-hidden">
                                                                <div className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full" style={{ width: `${(s.ingresos / max) * 100}%` }} />
                                                            </div>
                                                            <div className="flex-1 bg-[#101B33] rounded-full overflow-hidden">
                                                                <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full" style={{ width: `${(s.gastos / max) * 100}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Punto de equilibrio */}
                                        {p.breakEven && (
                                            <div className={`rounded-2xl p-6 border ${p.breakEven.alcanzable ? 'border-[#8CBBE8]/20 bg-[#101B33]/50' : 'border-rose-500/30 bg-rose-500/5'}`}>
                                                <h4 className="text-sm font-black text-[#8CBBE8]/55 uppercase tracking-widest flex items-center gap-2 mb-4">
                                                    <Scale className="w-4 h-4 text-[#C5E69A]" /> Punto de Equilibrio
                                                </h4>
                                                {p.breakEven.alcanzable ? (
                                                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                                                        <p className="text-[#FAF6EE]/80 text-[15px]">
                                                            Se necesitan <span className="text-[#FAF6EE] font-black text-xl">{p.breakEven.camasNecesarias}</span> camas
                                                            ocupadas <span className="text-[#8CBBE8]/55">({p.breakEven.ocupacionEquilibrioPct}% de ocupación)</span> para cubrir el costo operativo.
                                                        </p>
                                                        <span className={`text-sm font-black px-3 py-1 rounded-full ${p.breakEven.camasSobreEquilibrio >= 0 ? 'text-[#C5E69A] bg-[#C5E69A]/10 border border-[#C5E69A]/25' : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'}`}>
                                                            {p.breakEven.camasSobreEquilibrio >= 0
                                                                ? `${p.breakEven.camasSobreEquilibrio} camas por encima`
                                                                : `${Math.abs(p.breakEven.camasSobreEquilibrio)} camas por debajo`}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <p className="text-rose-300 text-[15px] leading-relaxed">
                                                        El equilibrio exige <span className="font-black">{p.breakEven.camasNecesarias}</span> camas,
                                                        más que las <span className="font-black">{o.capacity}</span> autorizadas. Al ARPU actual de {fmt(f.arpu)},
                                                        el costo operativo no se cubre ni a plena ocupación.
                                                    </p>
                                                )}
                                                {p.gastoMensualPromedio !== null && (
                                                    <p className="text-[#8CBBE8]/55 text-xs mt-3">
                                                        {/* "con gastos cargados", no "cerrados": `mesesConDatos`
                                                            cuenta meses CON GASTOS CARGADOS. Hoy coinciden con los
                                                            cerrados, pero son cosas distintas y el día que un mes
                                                            cerrado llegue sin gastos el texto diría lo que no es. */}
                                                        Base: costo operativo promedio de {fmt(p.gastoMensualPromedio)}/mes sobre {p.mesesConDatos} mes{p.mesesConDatos !== 1 ? 'es' : ''} con gastos cargados.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/*
                                            ESTRUCTURA DE COSTOS DE LOS TRES MESES, NO DE UNO.

                                            Salía del último mes con datos, y por eso "no están todas
                                            las opciones que lleno": agosto llevaba seis categorías
                                            cargadas y septiembre cuatro, así que Alimentos, Utilidades
                                            y Seguros desaparecían de la pantalla.
                                        */}
                                        {(() => {
                                            if (!p.estructura || p.estructura.categorias.length === 0) return null;
                                            const maxCat = Math.max(...p.estructura.categorias.map(c2 => c2.amount), 1);
                                            return (
                                                <div className="pt-2 border-t border-[#8CBBE8]/20">
                                                    <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest mb-4">
                                                        {/* Igual que arriba: el número sale de `mesesConDatos`, que
                                                            son meses con gastos cargados. Que el texto diga el que
                                                            cuenta. */}
                                                        Estructura de costos — {p.mesesConDatos} mes{p.mesesConDatos !== 1 ? 'es' : ''} con gastos cargados{rangoMedido ? ` · ${rangoMedido}` : ''} · {fmt(p.estructura.total)}
                                                    </p>
                                                    <div className="space-y-2.5">
                                                        {p.estructura.categorias.map(cat => (
                                                            <div key={cat.category} className="flex items-center gap-3">
                                                                <span className="text-[11px] text-[#8CBBE8]/70 font-bold w-36 shrink-0 truncate">{cat.label}</span>
                                                                <div className="flex-1 h-2.5 bg-[#101B33] rounded-full overflow-hidden">
                                                                    <div className="h-full bg-gradient-to-r from-slate-500 to-slate-400 rounded-full" style={{ width: `${(cat.amount / maxCat) * 100}%` }} />
                                                                </div>
                                                                <span className="text-[#FAF6EE] font-bold text-xs w-20 text-right">{fmt(cat.amount)}</span>
                                                                <span className="text-[#8CBBE8]/55 font-bold text-[10px] w-10 text-right">
                                                                    {cat.pct}%
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <p className="text-[#8CBBE8]/45 text-[11px] leading-snug border-t border-[#8CBBE8]/15 pt-4">
                                            <strong className="text-[#8CBBE8]/70">Antes de overhead.</strong> El margen se calcula
                                            con los gastos cargados en Zéndity. Hay costos que no se documentan aquí —los que
                                            sepas que faltan hay que restarlos por fuera—, así que este número es un techo, no el
                                            beneficio final.
                                        </p>
                                    </>
                                )}

                                {/*
                                    EL MES EN CURSO, APARTE Y CON SU AVISO.

                                    No entra en el margen ni en el punto de equilibrio: factura
                                    completo el día 1 y acumula gastos poco a poco, así que hasta
                                    el último día del mes su margen sale inflado. Se enseña para
                                    poder mirarlo, no para promediarlo.

                                    VA FUERA DEL TERNARIO. Vivía dentro de la rama "hay meses
                                    cerrados", así que en Mayagüez —mesesConDatos 0— se caía junto
                                    con ella: desaparecía justo en la única sede donde el mes en
                                    curso es lo ÚNICO que hay, y es lo que el dueño pidió ver. El
                                    dato viajaba en el payload y la pantalla lo tiraba. Se protege
                                    solo con su propio `p.enCurso`; no necesita meses cerrados.
                                */}
                                {p.enCurso && (
                                    <div className="rounded-2xl p-5 border border-[#8CBBE8]/25 bg-[#101B33]/40">
                                        <div className="flex items-baseline justify-between flex-wrap gap-2">
                                            <p className="text-[10px] text-[#8CBBE8]/55 font-black uppercase tracking-widest">
                                                Mes en curso — {MESES_ES[p.enCurso.mes.split('-')[1]]} · no entra en el margen
                                            </p>
                                            <span className="text-[#8CBBE8]/55 text-xs">
                                                <span className="text-[#FAF6EE] font-bold">{fmt(p.enCurso.ingresos)}</span>
                                                <span className="mx-1.5 text-[#1C3170]">−</span>
                                                <span className="text-rose-400 font-bold">{fmt(p.enCurso.gastos)}</span>
                                                {!p.enCurso.hasExpenseData && (
                                                    <span className="ml-2 text-[#C5E69A]/70 font-bold text-[10px] uppercase tracking-wider">gastos sin cargar</span>
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-[#8CBBE8]/45 text-[11px] mt-2 leading-snug">
                                            Va a mitad de camino: la facturación del mes ya se emitió entera y los gastos
                                            se cargan a lo largo del mes. Se cierra cuando termine.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Calidad + Equipo */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/*
                                    LA TARJETA QUE PINTABA UN HUECO Y UN "/100".

                                    Se pintaba SIN NINGUNA CONDICIÓN y el valor es null desde
                                    el 09-sep, con Z_SCORE_VISIBLE apagado: en JSX un null no
                                    escribe nada, así que quedaba un "/100" huérfano bajo
                                    "Promedio de 0 clínicos" en Mayagüez.

                                    La guarda va sobre el VALOR, no sobre el flag. Si mirara
                                    `Z_SCORE_VISIBLE`, el bug sobreviviría a su propio
                                    arreglo: el día que se encienda, Mayagüez —cero clínicos—
                                    seguiría dando null. Un null se comprueba donde está.
                                */}
                                {q.clinicalComplianceRate !== null && (
                                    <div className="bg-[#1C3170]/40 border border-[#8CBBE8]/20 rounded-2xl p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-[11px] text-[#8CBBE8]/55 font-black uppercase tracking-widest flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-blue-400" /> Compliance Clínico
                                            </p>
                                            <p className="text-[#8CBBE8]/55 text-xs mt-1">Promedio de {e.clinicalCount} clínicos</p>
                                        </div>
                                        <p className="text-3xl font-black text-[#FAF6EE]">{q.clinicalComplianceRate}<span className="text-[#8CBBE8]/45 text-lg">/100</span></p>
                                    </div>
                                )}
                                <div className="bg-[#1C3170]/40 border border-[#8CBBE8]/20 rounded-2xl p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-[#8CBBE8]/55 font-black uppercase tracking-widest flex items-center gap-2">
                                            <Users className="w-4 h-4 text-teal-400" /> Equipo
                                        </p>
                                        <p className="text-[#8CBBE8]/55 text-xs mt-1">Staff activo total</p>
                                    </div>
                                    <p className="text-3xl font-black text-[#FAF6EE]">{e.staffCount}</p>
                                </div>
                                <div className="bg-[#1C3170]/40 border border-[#8CBBE8]/20 rounded-2xl p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-[#8CBBE8]/55 font-black uppercase tracking-widest flex items-center gap-2">
                                            <UserCheck className="w-4 h-4 text-[#C5E69A]" /> Ratio Staff/Residente
                                        </p>
                                        <p className="text-[#8CBBE8]/55 text-xs mt-1">Dotación por cama ocupada</p>
                                    </div>
                                    <p className="text-3xl font-black text-[#FAF6EE]">{e.ratioStaffResidente}</p>
                                </div>
                            </div>
                        </section>
                    );
                })}

                {kpis.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-[#8CBBE8]/20 rounded-3xl">
                        <p className="text-[#8CBBE8]/55 font-bold text-lg">No hay sedes activas para mostrar.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

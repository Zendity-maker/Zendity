"use client";

/**
 * PREP. VISITA MÉDICA — el dossier que se le entrega al médico que visita
 * ──────────────────────────────────────────────────────────────────────
 * TRES COSAS CAMBIARON AQUÍ, y las tres venían del mismo sitio: esto era una
 * pantalla que se fotografiaba, no un documento.
 *
 *   · EL PDF ERA UNA CAPTURA. html2canvas hacía una imagen larguísima y la
 *     cortaba en trozos del tamaño de una hoja. Las filas se partían por la
 *     mitad en el corte, el texto no se podía seleccionar, el nombre del
 *     residente salía solo en la hoja 1 y no había "Página N de M". Ahora lo
 *     arma jsPDF en src/lib/dossier-pdf.ts, con tope duro de dos páginas.
 *
 *   · SALÍAN OCHO PÁGINAS. Se imprimían TODAS las lecturas de vitales del mes
 *     —la mediana en Cupey es 57 por residente— y casi todas normales. Un
 *     dossier de ocho páginas no se lee, se hojea. Ahora van el promedio y las
 *     que se salieron de rango, que es lo que el médico cruza con un cambio de
 *     medicamento.
 *
 *   · HABÍA DOS APPLAYOUT. El layout raíz ya envuelve toda la app; esta página
 *     montaba un segundo dentro del primero — dos barras laterales, dos
 *     cabeceras y un h-screen dentro de otro h-screen.
 *
 * Y las alergias ya no mienten: la caja la pinta el servidor con
 * src/lib/alergias.ts, así que un "N/A" en el expediente sale como NO
 * DOCUMENTADO y no como una alergia crítica.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import { descargarDossierPDF, descargarDossierCompletoPDF, type DossierMeta } from "@/lib/dossier-pdf";

interface VitalRow {
    date: string; systolic: number; diastolic: number; heartRate: number;
    temperature: number; measuredBy: string | null; isAbnormal: boolean;
}
interface MedRow { name: string; dosage: string; route: string; frequency: string; scheduleTimes: string; }
interface ClinicalAlert { date: string; notes: string | null; author: string | null; }
interface FallRow { date: string; severity: string; notes: string | null; interventions: string; }

interface DossierRawData {
    roomNumber: string | null;
    colorGroup: string | null;
    diet: string | null;
    /** Nunca null: o la alergia, o el aviso de que nadie preguntó. */
    allergies: string;
    allergiesUndocumented: boolean;
    diagnoses: string | null;
    hqId: string | null;
    hqName: string | null;
    hqLogoUrl: string | null;
    hqAddress: string | null;
    hqPhone: string | null;
    vitals: VitalRow[];
    avgVitals: { sys: number; dia: number; hr: number; temp: number } | null;
    medications: MedRow[];
    clinicalAlerts: ClinicalAlert[];
    falls: FallRow[];
}

interface DossierData {
    patientId: string;
    patientName: string;
    dossierMarkdown: string;
    /** Por qué falta el análisis de Zendi. El resto del dossier no depende de él. */
    analisisNoDisponible: string | null;
    hasRedFlags: boolean;
    redFlags: string[];
    rawData: DossierRawData;
}

const fechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Lo que la lista necesita de /api/corporate/patients. Nada más. */
interface ResidenteEnLista {
    id: string;
    name: string;
    roomNumber: string | null;
    colorGroup: string | null;
}

export default function MedicalBriefingPage() {
    const [patients, setPatients] = useState<ResidenteEnLista[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [dossiers, setDossiers] = useState<Record<string, DossierData>>({});
    const [activeDossier, setActiveDossier] = useState<string | null>(null);
    const [lote, setLote] = useState<{ hechos: number; total: number; quien: string } | null>(null);
    const [resumenLote, setResumenLote] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/corporate/patients');
                const data = await res.json();
                if (data.success) setPatients(data.patients);
            } catch (error) {
                console.error("Error fetching patients:", error);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    /** Pide un dossier. Devuelve el dato o el motivo del fallo, sin alertas. */
    const pedirDossier = async (patientId: string): Promise<DossierData | string> => {
        try {
            const res = await fetch("/api/med/briefing/monthly", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId }),
            });
            const data = await res.json();
            if (data.success) {
                setDossiers(prev => ({ ...prev, [patientId]: data as DossierData }));
                return data as DossierData;
            }
            return data.error || `El servidor respondió ${res.status}`;
        } catch (e) {
            return (e as Error).message || 'no se pudo conectar con el servidor';
        }
    };

    const handleGenerateDossier = async (patientId: string) => {
        setGenerating(patientId);
        setResumenLote(null);
        const r = await pedirDossier(patientId);
        setGenerating(null);
        if (typeof r === 'string') {
            // El motivo real, no "error interno". Si esto vuelve a fallar,
            // el mensaje dice qué arreglar.
            alert(`No se pudo generar el dossier.\n\n${r}`);
            return;
        }
        setActiveDossier(patientId);
    };

    /**
     * TODOS LOS RESIDENTES, UN SOLO ARCHIVO.
     *
     * De uno en uno a propósito: son una llamada a la IA por residente y
     * dispararlas todas a la vez es la forma de que el proveedor corte a la
     * mitad y no se sepa cuáles salieron. Va enseñando por quién va.
     *
     * Un residente que falle NO detiene el resto: se anota y se sigue. El
     * resumen final dice cuántos salieron, cuántos fallaron y cuáles se
     * quedaron sin el análisis de Zendi — porque un taco de papeles del que no
     * se sabe qué falta es peor que no tenerlo.
     */
    const generarTodos = async () => {
        const total = patients.length;
        if (total === 0) return;
        if (!confirm(
            `Se van a generar ${total} dossiers, uno por residente activo, y se descargarán en un solo PDF de ${total * 2} páginas.\n\n` +
            `Cada uno consulta a Zendi, así que tarda un rato y tiene costo. ¿Seguimos?`
        )) return;

        setResumenLote(null);
        const hechos: DossierData[] = [];
        const fallaron: string[] = [];

        for (let i = 0; i < total; i++) {
            const p = patients[i];
            setLote({ hechos: i, total, quien: p.name });
            const r = await pedirDossier(p.id);
            if (typeof r === 'string') fallaron.push(`${p.name} (${r})`);
            else hechos.push(r);
        }
        setLote(null);

        if (hechos.length === 0) {
            setResumenLote(`No salió ninguno. El primero falló así: ${fallaron[0] ?? 'sin detalle'}`);
            return;
        }

        descargarDossierCompletoPDF(hechos.map(aMeta), hechos[0].rawData.hqName ?? 'Zendity');

        const sinAnalisis = hechos.filter(d => !d.dossierMarkdown.trim()).length;
        setResumenLote([
            `${hechos.length} de ${total} dossiers descargados en un solo PDF.`,
            fallaron.length ? `No salieron ${fallaron.length}: ${fallaron.join(' · ')}.` : '',
            sinAnalisis ? `${sinAnalisis} van sin el análisis de Zendi; el papel lo dice y lo demás está completo.` : '',
        ].filter(Boolean).join(' '));
    };

    const active = activeDossier ? dossiers[activeDossier] : null;

    /** Lo mismo que ve el médico en papel, armado desde lo que hay en pantalla. */
    const aMeta = (d: DossierData): DossierMeta => {
        const r = d.rawData;
        const desde = new Date();
        desde.setDate(desde.getDate() - 30);
        return {
            nombre: d.patientName,
            habitacion: r.roomNumber,
            grupoColor: r.colorGroup,
            dieta: r.diet,
            alergias: r.allergies,
            alergiasSinDocumentar: r.allergiesUndocumented,
            diagnosticos: r.diagnoses,
            señalesDeAlarma: d.redFlags ?? [],
            vitales: r.vitals,
            promedio: r.avgVitals,
            medicamentos: r.medications,
            caidas: r.falls,
            alertas: r.clinicalAlerts,
            analisis: d.dossierMarkdown,
            analisisNoDisponible: d.analisisNoDisponible,
            hogar: { nombre: r.hqName ?? 'Zéndity', telefono: r.hqPhone, direccion: r.hqAddress, logo: r.hqLogoUrl },
            generadoAt: new Date(),
            desde,
        };
    };

    const descargar = () => { if (active) descargarDossierPDF(aMeta(active)); };

    const fuera = active ? active.rawData.vitals.filter(v => v.isAbnormal) : [];

    return (
        <div className="p-8 max-w-7xl mx-auto pb-32">
            <div className="mb-8">
                <button onClick={() => router.push('/med')} className="text-indigo-600 hover:text-indigo-800 font-bold mb-2 flex items-center gap-1">
                    &#8592; Volver a Zéndity Med
                </button>
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">Dossier médico mensual</h1>
                <p className="text-slate-500 font-medium text-lg mt-1">
                    Los últimos 30 días del residente, en dos páginas, para el médico que visita.
                </p>

                {!loading && patients.length > 0 && (
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button
                            onClick={generarTodos}
                            disabled={!!lote || !!generating}
                            className="py-3 px-6 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-black rounded-xl shadow-md transition-all active:scale-95"
                        >
                            {lote
                                ? `Generando ${lote.hechos + 1} de ${lote.total}…`
                                : `Generar los ${patients.length} y bajar un solo PDF`}
                        </button>
                        {lote && (
                            <span className="text-sm font-bold text-slate-500">
                                {lote.quien}
                            </span>
                        )}
                    </div>
                )}

                {lote && (
                    <div className="mt-3 h-2 w-full max-w-xl bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-teal-500 transition-all duration-300"
                            style={{ width: `${Math.round((lote.hechos / lote.total) * 100)}%` }}
                        />
                    </div>
                )}

                {resumenLote && (
                    <div className="mt-4 max-w-3xl rounded-xl border-2 border-teal-200 bg-teal-50 px-5 py-3">
                        <p className="text-sm font-bold text-teal-900">{resumenLote}</p>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="py-20 text-center font-bold text-slate-400 animate-pulse">Cargando residentes…</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h2 className="text-xl font-black text-slate-700 bg-white p-4 rounded-xl shadow-sm border border-slate-200">Residentes activos</h2>
                        {patients.map(p => (
                            <div key={p.id} className={`bg-white p-5 rounded-2xl shadow-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${activeDossier === p.id ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200 hover:border-indigo-300'}`}>
                                <div>
                                    <h3 className="font-black text-lg text-slate-800">{p.name}</h3>
                                    <p className="text-sm font-bold text-slate-500">Hab. {p.roomNumber || '—'} {p.colorGroup ? `· ${p.colorGroup}` : ''}</p>
                                </div>
                                <button
                                    onClick={() => handleGenerateDossier(p.id)}
                                    disabled={generating === p.id}
                                    className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black rounded-xl shadow-md transition-all active:scale-95 shrink-0"
                                >
                                    {generating === p.id ? 'Analizando…' : 'Generar dossier'}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div>
                        {active ? (
                            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 space-y-6">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-4 gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-800">{active.patientName}</h2>
                                        <p className="text-sm text-slate-500 font-medium">Vista previa — el PDF son dos páginas</p>
                                    </div>
                                    <button
                                        onClick={descargar}
                                        className="py-3 px-6 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl shadow-md transition-all active:scale-95 shrink-0"
                                    >
                                        Descargar PDF
                                    </button>
                                </div>

                                {/* Las alergias van primero y NUNCA faltan: un hueco no
                                    puede parecerse a "no tiene alergias". */}
                                <div className={`rounded-xl p-4 border-2 ${active.rawData.allergiesUndocumented ? 'bg-amber-50 border-amber-300' : 'bg-rose-50 border-rose-300'}`}>
                                    <h4 className={`text-xs font-black uppercase tracking-wider mb-1 ${active.rawData.allergiesUndocumented ? 'text-amber-800' : 'text-rose-700'}`}>Alergias</h4>
                                    <p className={`font-bold ${active.rawData.allergiesUndocumented ? 'text-amber-900 text-sm' : 'text-rose-800 text-lg'}`}>
                                        {active.rawData.allergies}
                                    </p>
                                </div>

                                {active.hasRedFlags && active.redFlags.length > 0 && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                        <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider mb-2">Señales de alarma</h4>
                                        <ul className="space-y-1">
                                            {active.redFlags.map((f, i) => (
                                                <li key={i} className="text-sm font-bold text-rose-600">• {f}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* El mismo criterio que el papel: el promedio y lo que
                                    se salio. Las normales se cuentan, no se listan. */}
                                <div>
                                    <h4 className="font-black text-sm text-slate-600 uppercase tracking-wider mb-2">
                                        Signos vitales — {active.rawData.vitals.length} lecturas en 30 días
                                    </h4>
                                    {active.rawData.avgVitals && (
                                        <p className="text-sm text-slate-500 font-medium mb-2">
                                            Promedio {active.rawData.avgVitals.sys}/{active.rawData.avgVitals.dia} mmHg · FC {active.rawData.avgVitals.hr} · {active.rawData.avgVitals.temp} °F
                                        </p>
                                    )}
                                    <p className="text-sm text-slate-500 mb-2">
                                        {fuera.length === 0
                                            ? `Las ${active.rawData.vitals.length} lecturas están dentro de rango.`
                                            : `${fuera.length} fuera de rango. Las ${active.rawData.vitals.length - fuera.length} restantes están dentro y no se listan.`}
                                    </p>
                                    {fuera.length > 0 && (
                                        <div className="text-xs overflow-auto max-h-48 border rounded-lg">
                                            <table className="w-full text-left">
                                                <thead className="bg-rose-100 sticky top-0 text-rose-800">
                                                    <tr><th className="p-2">Fecha</th><th className="p-2">Presión</th><th className="p-2">FC</th><th className="p-2">Temp</th></tr>
                                                </thead>
                                                <tbody>
                                                    {fuera.map((v, i) => (
                                                        <tr key={i} className="bg-rose-50 text-rose-800 font-bold">
                                                            <td className="p-2">{fechaHora(v.date)}</td>
                                                            <td className="p-2">{v.systolic}/{v.diastolic}</td>
                                                            <td className="p-2">{v.heartRate}</td>
                                                            <td className="p-2">{v.temperature}°F</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* El resto del dossier no depende de la IA, asi
                                    que si falta se dice y ya — no se esconde ni
                                    se tira el documento entero. */}
                                {active.dossierMarkdown.trim() ? (
                                    <div className="prose prose-slate prose-sm max-w-none">
                                        <ReactMarkdown>{active.dossierMarkdown}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
                                        <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider mb-1">Sin análisis de Zendi</h4>
                                        <p className="text-sm text-amber-900">
                                            {active.analisisNoDisponible
                                                ? `No se pudo generar: ${active.analisisNoDisponible}.`
                                                : 'No se pudo generar el análisis automático.'}{' '}
                                            El dossier se descarga igual — alergias, medicamentos y signos vitales
                                            salen del expediente y no dependen de él.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 font-bold">
                                Escoge un residente y genera su dossier para ver la vista previa.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

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
import { descargarDossierPDF, type DossierMeta } from "@/lib/dossier-pdf";

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
    hasRedFlags: boolean;
    redFlags: string[];
    rawData: DossierRawData;
}

const fechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function MedicalBriefingPage() {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [dossiers, setDossiers] = useState<Record<string, DossierData>>({});
    const [activeDossier, setActiveDossier] = useState<string | null>(null);
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

    const handleGenerateDossier = async (patientId: string) => {
        setGenerating(patientId);
        try {
            const res = await fetch("/api/med/briefing/monthly", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId }),
            });
            const data = await res.json();
            if (data.success) {
                setDossiers(prev => ({ ...prev, [patientId]: data as DossierData }));
                setActiveDossier(patientId);
            } else {
                alert(`Error consultando Zendi: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión con el motor de inteligencia clínica.");
        } finally {
            setGenerating(null);
        }
    };

    const active = activeDossier ? dossiers[activeDossier] : null;

    /** Lo mismo que ve el médico en papel, armado desde lo que hay en pantalla. */
    const descargar = () => {
        if (!active) return;
        const r = active.rawData;
        const desde = new Date();
        desde.setDate(desde.getDate() - 30);
        const meta: DossierMeta = {
            nombre: active.patientName,
            habitacion: r.roomNumber,
            grupoColor: r.colorGroup,
            dieta: r.diet,
            alergias: r.allergies,
            alergiasSinDocumentar: r.allergiesUndocumented,
            diagnosticos: r.diagnoses,
            señalesDeAlarma: active.redFlags ?? [],
            vitales: r.vitals,
            promedio: r.avgVitals,
            medicamentos: r.medications,
            caidas: r.falls,
            alertas: r.clinicalAlerts,
            analisis: active.dossierMarkdown,
            hogar: { nombre: r.hqName ?? 'Zéndity', telefono: r.hqPhone, direccion: r.hqAddress, logo: r.hqLogoUrl },
            generadoAt: new Date(),
            desde,
        };
        descargarDossierPDF(meta);
    };

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

                                <div className="prose prose-slate prose-sm max-w-none">
                                    <ReactMarkdown>{active.dossierMarkdown}</ReactMarkdown>
                                </div>
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

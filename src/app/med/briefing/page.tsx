"use client";

import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ReactMarkdown from 'react-markdown';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ── Types ── */
interface VitalRow {
    date: string;
    systolic: number;
    diastolic: number;
    heartRate: number;
    temperature: number;
    measuredBy: string | null;
    isAbnormal: boolean;
}

interface MedRow {
    name: string;
    dosage: string;
    route: string;
    frequency: string;
    scheduleTimes: string;
}

interface ClinicalAlert {
    date: string;
    notes: string | null;
    author: string | null;
}

interface FallRow {
    date: string;
    severity: string;
    notes: string | null;
    interventions: string;
}

interface DossierRawData {
    roomNumber: string | null;
    colorGroup: string | null;
    diet: string | null;
    allergies: string | null;
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
    patientPhotoUrl: string | null;
    dossierMarkdown: string;
    hasRedFlags: boolean;
    redFlags: string[];
    rawData: DossierRawData;
}

/* ── Helpers ── */
const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const fullDate = () => {
    return new Date().toLocaleDateString('es-PR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function MedicalBriefingPage() {
    const { user } = useAuth();
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [dossiers, setDossiers] = useState<Record<string, DossierData>>({});
    const [activeDossier, setActiveDossier] = useState<string | null>(null);
    const pdfRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    /* ── Fetch patients from session-protected API ── */
    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const res = await fetch('/api/corporate/patients');
                const data = await res.json();
                if (data.success) setPatients(data.patients);
            } catch (error) {
                console.error("Error fetching patients:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPatients();
    }, []);

    /* ── Generate dossier ── */
    const handleGenerateDossier = async (patientId: string) => {
        setGenerating(patientId);
        try {
            const res = await fetch("/api/med/briefing/monthly", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId })
            });
            const data = await res.json();
            if (data.success) {
                setDossiers(prev => ({
                    ...prev,
                    [patientId]: {
                        patientId: data.patientId,
                        patientName: data.patientName,
                        patientPhotoUrl: data.patientPhotoUrl,
                        dossierMarkdown: data.dossierMarkdown,
                        hasRedFlags: data.hasRedFlags,
                        redFlags: data.redFlags || [],
                        rawData: data.rawData,
                    }
                }));
                setActiveDossier(patientId);
            } else {
                alert(`Error consultando Zendi AI: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexion con el Motor de Inteligencia Clinica.");
        } finally {
            setGenerating(null);
        }
    };

    /* ── Export real PDF with jsPDF + html2canvas ── */
    const handleExportPDF = async () => {
        if (!active || !pdfRef.current) return;
        setExporting(true);
        try {
            // Show the hidden render target
            pdfRef.current.style.display = 'block';

            await new Promise(r => setTimeout(r, 600));

            const canvas = await html2canvas(pdfRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                allowTaint: true,
            });

            pdfRef.current.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            // Multi-page support
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfPageHeight;

            while (heightLeft > 0) {
                position = -(pdfPageHeight * (Math.ceil((imgHeight - heightLeft) / pdfPageHeight)));
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfPageHeight;
            }

            pdf.autoPrint();
            window.open(pdf.output('bloburl'), '_blank');
        } catch (err) {
            console.error('PDF export error:', err);
            alert('Error generando el PDF.');
        } finally {
            setExporting(false);
        }
    };

    const active = activeDossier ? dossiers[activeDossier] : null;

    return (
        <AppLayout>
            {/* ====== SCREEN UI ====== */}
            <div className="p-8 max-w-7xl mx-auto min-h-screen pb-32">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <button onClick={() => router.push('/med')} className="text-indigo-600 hover:text-indigo-800 font-bold mb-2 flex items-center gap-1">
                            &#8592; Volver al Modulo Medico
                        </button>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Dossier Medico Mensual</h1>
                        <p className="text-slate-500 font-medium text-lg mt-1">Generacion de Dossier Clinico (30 dias) impulsado por Zendi AI.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><span className="animate-spin text-4xl">&#x23F3;</span></div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Patient List */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-black text-slate-700 bg-white p-4 rounded-xl shadow-sm border border-slate-200">Residentes Activos</h2>
                            {patients.map(p => (
                                <div key={p.id} className={`bg-white p-5 rounded-2xl shadow-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${activeDossier === p.id ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200 hover:border-indigo-300'}`}>
                                    <div>
                                        <h3 className="font-black text-lg text-slate-800">{p.name}</h3>
                                        <p className="text-sm font-bold text-slate-500">Hab. {p.roomNumber || 'N/A'} | {p.colorGroup || ''}</p>
                                    </div>
                                    <button
                                        onClick={() => handleGenerateDossier(p.id)}
                                        disabled={generating === p.id}
                                        className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"
                                    >
                                        {generating === p.id ? (
                                            <><span className="animate-spin">&#x23F3;</span> Analizando...</>
                                        ) : (
                                            <><span>&#x1F9E0;</span> Zendi Dossier</>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Preview + Export */}
                        <div>
                            {active ? (
                                <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 space-y-6">
                                    <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-800">{active.patientName}</h2>
                                            <p className="text-sm text-slate-500 font-medium">Dossier generado — vista previa</p>
                                        </div>
                                        <button
                                            onClick={handleExportPDF}
                                            disabled={exporting}
                                            className="py-3 px-6 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            {exporting ? (
                                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Exportando...</>
                                            ) : (
                                                <><span>&#x1F4C4;</span> Exportar PDF</>
                                            )}
                                        </button>
                                    </div>

                                    {/* Red Flags Banner */}
                                    {active.hasRedFlags && active.redFlags.length > 0 && (
                                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                            <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider mb-2">Red Flags Detectados</h4>
                                            <ul className="space-y-1">
                                                {active.redFlags.map((f, i) => (
                                                    <li key={i} className="text-sm font-bold text-rose-600 flex items-center gap-2">
                                                        <span className="text-rose-400">&#x26A0;</span> {f}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="prose prose-slate prose-sm max-w-none">
                                        <ReactMarkdown>{active.dossierMarkdown}</ReactMarkdown>
                                    </div>

                                    {active.rawData.vitals.length > 0 && (
                                        <div>
                                            <h4 className="font-black text-sm text-slate-600 uppercase tracking-wider mb-2">Tabla de Vitales ({active.rawData.vitals.length} registros)</h4>
                                            <div className="text-xs text-slate-500 overflow-auto max-h-48 border rounded-lg">
                                                <table className="w-full text-left">
                                                    <thead className="bg-slate-100 sticky top-0">
                                                        <tr>
                                                            <th className="p-2">Fecha</th>
                                                            <th className="p-2">BP</th>
                                                            <th className="p-2">HR</th>
                                                            <th className="p-2">Temp</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {active.rawData.vitals.slice(-10).map((v, i) => (
                                                            <tr key={i} className={v.isAbnormal ? 'bg-rose-50 text-rose-800 font-bold' : ''}>
                                                                <td className="p-2">{formatDateTime(v.date)}</td>
                                                                <td className="p-2">{v.systolic}/{v.diastolic}</td>
                                                                <td className="p-2">{v.heartRate}</td>
                                                                <td className="p-2">{v.temperature}°F</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 font-bold">
                                    Seleccione un residente y genere su Dossier para ver la vista previa.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ====== HIDDEN PDF RENDER TARGET (offscreen, used by html2canvas) ====== */}
            {active && (
                <div
                    ref={pdfRef}
                    style={{ position: 'absolute', top: '-10000px', left: '-10000px', display: 'none', width: '794px', minHeight: '1123px', backgroundColor: '#FFFFFF', fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                    {/* ── Header Band ── */}
                    <div style={{ backgroundColor: '#0F172A', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 300, letterSpacing: '1px' }}>vivid senior living</div>
                            <div style={{ color: '#5EEAD4', fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>{active.rawData.hqAddress || 'Cupey, Puerto Rico'}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>Dossier Medico Oficial</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#5EEAD4', fontSize: '11px', fontWeight: 500 }}>Powered by Zendity</div>
                            <div style={{ color: '#94A3B8', fontSize: '9px', marginTop: '2px' }}>{fullDate()}</div>
                        </div>
                    </div>

                    {/* ── Facility Info Bar ── */}
                    <div style={{ backgroundColor: '#F1F5F9', padding: '10px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', fontSize: '9px', color: '#64748B', fontWeight: 600 }}>
                        <span>{active.rawData.hqName || 'Vivid Senior Living'}</span>
                        <span>{active.rawData.hqAddress || ''}</span>
                        <span>{active.rawData.hqPhone ? `Tel: ${active.rawData.hqPhone}` : ''}</span>
                    </div>

                    {/* ── Patient Identity Band ── */}
                    <div style={{ backgroundColor: '#F8FAFC', padding: '16px 40px', borderBottom: '3px solid #14B8A6' }}>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>{active.patientName}</div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '10px', color: '#475569', fontWeight: 600 }}>
                            {active.rawData.roomNumber && (
                                <span style={{ backgroundColor: '#E2E8F0', padding: '3px 10px', borderRadius: '6px' }}>Hab. {active.rawData.roomNumber}</span>
                            )}
                            {active.rawData.colorGroup && (
                                <span style={{ backgroundColor: '#E2E8F0', padding: '3px 10px', borderRadius: '6px' }}>Grupo {active.rawData.colorGroup}</span>
                            )}
                            {active.rawData.diet && (
                                <span style={{ backgroundColor: '#E2E8F0', padding: '3px 10px', borderRadius: '6px' }}>Dieta: {active.rawData.diet}</span>
                            )}
                        </div>
                    </div>

                    {/* ── Content ── */}
                    <div style={{ padding: '24px 40px', fontSize: '11px', color: '#1E293B', lineHeight: 1.7 }}>

                        {/* Red Flags Banner */}
                        {active.redFlags.length > 0 && (
                            <div style={{ borderLeft: '4px solid #EF4444', backgroundColor: '#FEF2F2', padding: '10px 16px', marginBottom: '20px', borderRadius: '0 8px 8px 0' }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Red Flags — Atencion Requerida</div>
                                {active.redFlags.map((f, i) => (
                                    <div key={i} style={{ fontSize: '11px', fontWeight: 700, color: '#7F1D1D', marginBottom: '2px' }}>&#x26A0; {f}</div>
                                ))}
                            </div>
                        )}

                        {/* Allergies Alert */}
                        {active.rawData.allergies && (
                            <div style={{ borderLeft: '4px solid #EF4444', backgroundColor: '#FEF2F2', padding: '10px 16px', marginBottom: '20px', borderRadius: '0 8px 8px 0' }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Alergias Criticas</div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#7F1D1D' }}>{active.rawData.allergies}</div>
                            </div>
                        )}

                        {/* Section: Vital Signs Table */}
                        {active.rawData.vitals.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                                    Signos Vitales — Ultimos 30 Dias ({active.rawData.vitals.length} registros)
                                </div>
                                {active.rawData.avgVitals && (
                                    <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', fontSize: '10px', color: '#475569', fontWeight: 600 }}>
                                        <span>Promedio BP: {active.rawData.avgVitals.sys}/{active.rawData.avgVitals.dia}</span>
                                        <span>FC: {active.rawData.avgVitals.hr} bpm</span>
                                        <span>Temp: {active.rawData.avgVitals.temp}°F</span>
                                    </div>
                                )}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Fecha</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Presion Arterial</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Frec. Cardiaca</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Temperatura</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Medido por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {active.rawData.vitals.map((v, i) => (
                                            <tr key={i} style={{
                                                backgroundColor: v.isAbnormal ? '#FEF2F2' : (i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'),
                                                color: v.isAbnormal ? '#991B1B' : '#1E293B',
                                                fontWeight: v.isAbnormal ? 700 : 400,
                                            }}>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{formatDateTime(v.date)}</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{v.systolic}/{v.diastolic} mmHg</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{v.heartRate} bpm</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{v.temperature}°F</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{v.measuredBy || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Section: Active Medications */}
                        {active.rawData.medications.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                                    Plan Farmacologico Activo (eMAR) — {active.rawData.medications.length} medicamentos
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Medicamento</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Dosis</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Via</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Frecuencia</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Horario</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {active.rawData.medications.map((m, i) => (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0', fontWeight: 600 }}>{m.name}</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.dosage}</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.route}</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.frequency}</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.scheduleTimes}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Section: AI Narrative */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                                Analisis Clinico Zendi AI — Ultimos 30 Dias
                            </div>
                            <div className="dossier-prose" style={{ fontSize: '11px', lineHeight: 1.8 }}>
                                <ReactMarkdown>{active.dossierMarkdown}</ReactMarkdown>
                            </div>
                        </div>

                        {/* Section: Clinical Alerts */}
                        {active.rawData.clinicalAlerts.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                                    Alertas Clinicas Reportadas ({active.rawData.clinicalAlerts.length})
                                </div>
                                {active.rawData.clinicalAlerts.map((a, i) => (
                                    <div key={i} style={{ borderLeft: '4px solid #EF4444', backgroundColor: '#FEF2F2', padding: '8px 14px', marginBottom: '6px', borderRadius: '0 6px 6px 0', fontSize: '10px' }}>
                                        <div style={{ fontWeight: 700, color: '#991B1B' }}>{formatDate(a.date)} {a.author && `— ${a.author}`}</div>
                                        <div style={{ color: '#7F1D1D', marginTop: '2px' }}>{a.notes}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Section: Falls */}
                        {active.rawData.falls.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                                    Caidas Reportadas ({active.rawData.falls.length})
                                </div>
                                {active.rawData.falls.map((f, i) => (
                                    <div key={i} style={{ borderLeft: '4px solid #F59E0B', backgroundColor: '#FFFBEB', padding: '8px 14px', marginBottom: '6px', borderRadius: '0 6px 6px 0', fontSize: '10px' }}>
                                        <div style={{ fontWeight: 700, color: '#92400E' }}>{formatDate(f.date)} — Severidad: {f.severity}</div>
                                        <div style={{ color: '#78350F', marginTop: '2px' }}>{f.notes || f.interventions}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Diagnoses */}
                        {active.rawData.diagnoses && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                                    Cuadro Clinico Base (Intake)
                                </div>
                                <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
                                    {active.rawData.diagnoses.split('\n').map((line, i) => (
                                        <div key={i} style={{ marginBottom: '4px' }}>{line.replace(/^- /, '• ')}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div style={{ borderTop: '2px solid #14B8A6', padding: '10px 40px', fontSize: '8px', color: '#64748B', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>Documento Medico Confidencial — {active.rawData.hqName || 'Vivid Senior Living'} | HIPAA Compliant Protocol</span>
                        <span>Generado por Zendity Healthcare Platform</span>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

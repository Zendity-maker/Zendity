"use client";

import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Printer, X, Loader2, AlertTriangle } from "lucide-react";

interface IncidentData {
    id: string;
    location: string;
    severity: 'NONE' | 'MILD' | 'SEVERE' | 'FATAL';
    interventions: string;
    notes: string | null;
    incidentDate: string;
    reportedAt: string;
    patient: {
        id: string;
        name: string;
        roomNumber: string | null;
        dateOfBirth: string | null;
        photoUrl: string | null;
        downtonRisk: boolean;
        colorGroup: string | null;
        headquarters: {
            name: string;
            logoUrl: string | null;
            phone: string | null;
            billingAddress: string | null;
        };
    };
}

interface RiskAssessment {
    riskLevel: string;
    morseScore: number | null;
    factors: string | null;
    evaluator: { id: string; name: string; role: string } | null;
}

interface Props {
    fallIncidentId: string;
    onClose: () => void;
}

const calcAge = (dob: string | null): string => {
    if (!dob) return '—';
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    return `${age} años`;
};

const fmtDateTime = (iso: string): string =>
    new Date(iso).toLocaleString('es-PR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const VIVID_NAVY = '#1E3A5F';
const VIVID_TEAL = '#0F6E56';

const SEVERITY_LABEL: Record<string, string> = {
    FATAL: 'FATAL',
    SEVERE: 'SEVERA',
    MILD: 'LEVE',
    NONE: 'SIN LESIÓN APARENTE',
};

export default function FallIncidentPrint({ fallIncidentId, onClose }: Props) {
    const printRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<IncidentData | null>(null);
    const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/care/fall-incident/${fallIncidentId}`);
                const json = await res.json();
                if (json.success) {
                    setData(json.incident);
                    setRiskAssessment(json.riskAssessment);
                } else {
                    setError(json.error || 'Error cargando incidente');
                }
            } catch {
                setError('Error de conexión');
            } finally {
                setLoading(false);
            }
        })();
    }, [fallIncidentId]);

    const handleExportPDF = async () => {
        if (!printRef.current || !data) return;
        setExporting(true);
        try {
            printRef.current.style.display = 'block';
            await new Promise(r => setTimeout(r, 600));
            const canvas = await html2canvas(printRef.current, {
                scale: 2, useCORS: true, logging: false, allowTaint: true,
            });
            printRef.current.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const imgWidth = pdfWidth - (margin * 2);
            const imgHeightScaled = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeightScaled;
            pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeightScaled);
            heightLeft -= (pdfPageHeight - margin);
            while (heightLeft > 0) {
                const position = heightLeft - imgHeightScaled;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position + margin, imgWidth, imgHeightScaled);
                heightLeft -= (pdfPageHeight - margin * 2);
            }
            const dateStamp = new Date(data.incidentDate).toISOString().split('T')[0];
            const nameSlug = data.patient.name.replace(/\s+/g, '_');
            pdf.save(`Reporte_Caida_${nameSlug}_${dateStamp}.pdf`);
        } catch (e) {
            console.error(e);
            alert('Error generando el PDF.');
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-rose-500 animate-spin mb-4" />
                    <p className="font-bold text-slate-600">Cargando reporte de caída...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm">
                    <p className="text-rose-600 font-bold mb-4">{error || 'Error'}</p>
                    <button onClick={onClose} className="w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold">Cerrar</button>
                </div>
            </div>
        );
    }

    const p = data.patient;
    const hq = p.headquarters;
    const severityLabel = SEVERITY_LABEL[data.severity] || data.severity;
    const severityColor = data.severity === 'SEVERE' || data.severity === 'FATAL' ? '#DC2626'
        : data.severity === 'MILD' ? '#F59E0B' : '#64748B';

    return (
        <>
            {/* Modal preview + actions */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
                    <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-black text-base leading-tight">Reporte de Incidente — Caída</h2>
                                <p className="text-xs text-rose-100 font-medium">Documento oficial para expediente clínico</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Screen preview */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-3">
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 text-sm">
                            <div>
                                <h3 className="font-black text-slate-900">{p.name}</h3>
                                <p className="text-xs text-slate-500">{calcAge(p.dateOfBirth)} · Hab. {p.roomNumber || 'N/A'}</p>
                            </div>
                            <div className="p-3 rounded-lg" style={{ backgroundColor: `${severityColor}15`, border: `1px solid ${severityColor}40` }}>
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: severityColor }}>Severidad</p>
                                <p className="text-lg font-black" style={{ color: severityColor }}>{severityLabel}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</p>
                                <p className="font-bold text-slate-800">{fmtDateTime(data.incidentDate)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ubicación</p>
                                <p className="font-bold text-slate-800">{data.location}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Evaluación</p>
                                <p className="font-medium text-slate-700">{data.interventions}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 p-4 flex items-center justify-end gap-3 bg-white">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">Cerrar</button>
                        <button
                            onClick={handleExportPDF}
                            disabled={exporting}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-xl flex items-center gap-2"
                        >
                            {exporting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generando PDF...</>) : (<><Printer className="w-4 h-4" /> Descargar PDF</>)}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── OFFSCREEN PDF TARGET ── */}
            <div
                ref={printRef}
                style={{
                    position: 'absolute', top: '-10000px', left: '-10000px', display: 'none',
                    width: '794px', backgroundColor: '#FFFFFF', fontFamily: 'Helvetica, Arial, sans-serif', color: '#1E293B',
                }}
            >
                {/* HEADER */}
                <div style={{ padding: '24px 40px 16px 40px', borderBottom: `3px solid ${VIVID_TEAL}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>{p.name} · ID {p.id.substring(0, 8)}</div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: '15px', color: VIVID_NAVY, fontWeight: 800 }}>{hq.name}</div>
                            {hq.phone && <div style={{ fontSize: '10px', color: '#64748B' }}>Tel. {hq.phone}</div>}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>
                            {new Date().toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        {hq.logoUrl && (
                            <img src={hq.logoUrl} alt={hq.name} crossOrigin="anonymous"
                                style={{ height: '56px', width: 'auto', objectFit: 'contain' }} />
                        )}
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#DC2626', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '4px' }}>
                            Reporte de Incidente — Caída
                        </div>
                    </div>
                </div>

                {/* Severity banner */}
                <div style={{
                    margin: '12px 40px 0 40px',
                    padding: '14px 20px',
                    backgroundColor: `${severityColor}15`,
                    borderLeft: `6px solid ${severityColor}`,
                    borderRadius: '0 10px 10px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 900, color: severityColor, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '4px' }}>
                            Severidad del incidente
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: severityColor }}>{severityLabel}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Fecha del incidente</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{fmtDateTime(data.incidentDate)}</div>
                    </div>
                </div>

                {/* DATOS DEL RESIDENTE */}
                <div style={{ margin: '14px 40px 0 40px' }}>
                    <SectionTitle color={VIVID_NAVY}>Datos del Residente</SectionTitle>
                    <div style={{ display: 'flex', gap: '16px', padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} crossOrigin="anonymous"
                                style={{ width: '70px', height: '70px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #CBD5E1' }} />
                        ) : (
                            <div style={{ width: '70px', height: '70px', borderRadius: '12px', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: VIVID_NAVY }}>
                                {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                        )}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{p.name}</div>
                            <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginTop: '3px' }}>
                                {calcAge(p.dateOfBirth)} · Hab. {p.roomNumber || 'N/A'}{p.colorGroup ? ` · Grupo ${p.colorGroup}` : ''}
                            </div>
                            {p.downtonRisk && (
                                <div style={{ display: 'inline-block', marginTop: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '9px', fontWeight: 800, backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Downton Risk Activo
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* DATOS DEL INCIDENTE */}
                <div style={{ margin: '14px 40px 0 40px' }}>
                    <SectionTitle color={VIVID_NAVY}>Detalle del Incidente</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                        <Field label="Fecha y hora" value={fmtDateTime(data.incidentDate)} />
                        <Field label="Ubicación" value={data.location} />
                        <Field label="Severidad" value={severityLabel} valueColor={severityColor} />
                        <Field label="Reportado" value={fmtDateTime(data.reportedAt)} />
                    </div>
                </div>

                {/* EVALUACIÓN CLÍNICA */}
                <div style={{ margin: '14px 40px 0 40px' }}>
                    <SectionTitle color={VIVID_NAVY}>Evaluación Clínica Inicial</SectionTitle>
                    <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderLeft: `4px solid ${VIVID_TEAL}`, borderRadius: '0 8px 8px 0' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', lineHeight: 1.7 }}>
                            {data.interventions}
                        </div>
                        {data.notes && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>Notas adicionales</div>
                                <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', lineHeight: 1.6 }}>"{data.notes}"</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* EVALUACIÓN DE RIESGO */}
                {riskAssessment && (
                    <div style={{ margin: '14px 40px 0 40px' }}>
                        <SectionTitle color={VIVID_NAVY}>Evaluación de Riesgo de Caídas</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                            <Field label="Nivel de riesgo" value={riskAssessment.riskLevel} valueColor={riskAssessment.riskLevel === 'HIGH' ? '#DC2626' : riskAssessment.riskLevel === 'MODERATE' ? '#F59E0B' : '#059669'} />
                            <Field label="Score Morse" value={riskAssessment.morseScore != null ? String(riskAssessment.morseScore) : 'No aplicado'} />
                            {riskAssessment.factors && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <Field label="Factores identificados" value={riskAssessment.factors} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* REPORTADO POR */}
                {riskAssessment?.evaluator && (
                    <div style={{ margin: '14px 40px 0 40px' }}>
                        <SectionTitle color={VIVID_NAVY}>Reportado por</SectionTitle>
                        <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                                {riskAssessment.evaluator.name}
                                <span style={{ color: '#64748B', fontWeight: 500, marginLeft: '8px' }}>({riskAssessment.evaluator.role})</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ESPACIO PARA FIRMA */}
                <div style={{ margin: '20px 40px 0 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <SignatureBlock label="Firma del Enfermero/a" />
                    <SignatureBlock label="Firma del Supervisor/Director" />
                </div>

                {/* FOOTER */}
                <div style={{ borderTop: `3px solid ${VIVID_TEAL}`, marginTop: '24px', padding: '14px 40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: VIVID_NAVY, marginBottom: '2px' }}>{hq.name}</div>
                    {hq.billingAddress && <div style={{ fontSize: '9px', color: '#64748B', marginBottom: '2px' }}>{hq.billingAddress}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#94A3B8', fontWeight: 600, borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '6px' }}>
                        <span>Generado por Zéndity · {new Date().toLocaleString('es-PR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>Documento Confidencial — HIPAA</span>
                    </div>
                </div>
            </div>
        </>
    );
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
    return (
        <div style={{
            fontSize: '10px', fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: '2.5px',
            marginBottom: '8px', borderBottom: `1px solid ${color}33`, paddingBottom: '4px',
        }}>{children}</div>
    );
}

function Field({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <div>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: valueColor || '#0F172A' }}>{value}</div>
        </div>
    );
}

function SignatureBlock({ label }: { label: string }) {
    return (
        <div>
            <div style={{ borderBottom: '1.5px solid #94A3B8', height: '40px' }} />
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px', textAlign: 'center' }}>{label}</div>
            <div style={{ fontSize: '8px', color: '#94A3B8', textAlign: 'center', marginTop: '2px' }}>Nombre · Fecha</div>
        </div>
    );
}

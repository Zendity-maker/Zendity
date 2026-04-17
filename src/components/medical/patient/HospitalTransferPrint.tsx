"use client";

import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Printer, X, Loader2 } from "lucide-react";

interface TransferData {
    patient: any;
    author: { name: string; role: string } | null;
    transferReason: string;
    transferDate: string; // ISO
}

interface Props {
    data: TransferData;
    onClose: () => void;
}

const calcAge = (dob: string | Date | null | undefined): string => {
    if (!dob) return '—';
    const birth = new Date(dob);
    const diff = Date.now() - birth.getTime();
    const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    return `${age} años`;
};

const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-PR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('es-PR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });

export default function HospitalTransferPrint({ data, onClose }: Props) {
    const printRef = useRef<HTMLDivElement>(null);
    const [exporting, setExporting] = useState(false);

    const patient = data.patient;
    const intake = patient?.intakeData;
    const meds = (patient?.medications || []).filter((m: any) => m.isActive);
    const vitals = patient?.vitalSigns || [];
    const hq = patient?.headquarters;

    const allergiesText = intake?.allergies?.trim() || null;
    const diagnosesText = intake?.diagnoses?.trim() || null;

    const handleExportPDF = async () => {
        if (!printRef.current) return;
        setExporting(true);
        try {
            printRef.current.style.display = 'block';
            await new Promise(r => setTimeout(r, 500));

            const canvas = await html2canvas(printRef.current, {
                scale: 2, useCORS: true, logging: false, allowTaint: true,
            });

            printRef.current.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const imgWidth = pdfWidth - (margin * 2);
            const imgHeightScaled = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeightScaled;
            let position = 0;
            pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeightScaled);
            heightLeft -= (pdfPageHeight - margin);

            while (heightLeft > 0) {
                position = heightLeft - imgHeightScaled;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position + margin, imgWidth, imgHeightScaled);
                heightLeft -= (pdfPageHeight - margin * 2);
            }

            pdf.autoPrint();
            window.open(pdf.output('bloburl'), '_blank');
        } catch (err) {
            console.error('PDF error:', err);
            alert('Error generando el PDF.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                            &#x1F691;
                        </div>
                        <div>
                            <h2 className="font-black text-lg leading-tight">Residente enviado al hospital</h2>
                            <p className="text-rose-100 text-xs font-medium">Resumen para paramédico y familiar</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Preview on screen */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 text-sm">
                        <div className="pb-3 border-b-2 border-teal-400">
                            <h3 className="font-black text-slate-800 text-base">{patient?.name}</h3>
                            <p className="text-slate-500 text-xs font-bold mt-0.5">
                                {calcAge(patient?.dateOfBirth)} · Hab. {patient?.roomNumber || 'N/A'} · {patient?.diet || 'Dieta no registrada'}
                            </p>
                        </div>

                        {/* Allergies */}
                        <div>
                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Alergias</p>
                            <p className={`text-sm font-bold ${allergiesText ? 'text-rose-700' : 'text-slate-400 italic'}`}>
                                {allergiesText || 'Sin alergias documentadas'}
                            </p>
                        </div>

                        {/* Diagnoses */}
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Diagnósticos principales</p>
                            {diagnosesText ? (
                                <div className="text-sm text-slate-700 font-medium leading-relaxed">
                                    {diagnosesText.split('\n').slice(0, 5).map((line: string, i: number) => (
                                        <div key={i}>{line.replace(/^- /, '• ')}</div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No documentados</p>
                            )}
                        </div>

                        {/* Reason */}
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Motivo del traslado</p>
                            <p className="text-sm font-bold text-rose-900">{data.transferReason}</p>
                        </div>

                        {/* Meta */}
                        <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-500 font-medium">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest">Fecha/hora</p>
                                <p className="text-slate-700 font-bold mt-0.5">{fmtDateTime(data.transferDate)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest">Autorizado por</p>
                                <p className="text-slate-700 font-bold mt-0.5">
                                    {data.author?.name || '—'}
                                    {data.author?.role && <span className="text-slate-400"> ({data.author.role})</span>}
                                </p>
                            </div>
                        </div>

                        {meds.length > 0 && (
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pt-3 border-t border-slate-100">
                                Medicamentos activos: {meds.length} · Vitales recientes: {vitals.length}
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="border-t border-slate-200 p-4 flex items-center justify-end gap-3 bg-white flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={exporting}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-xl transition-colors flex items-center gap-2"
                    >
                        {exporting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                        ) : (
                            <><Printer className="w-4 h-4" /> Imprimir resumen</>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Hidden render target (offscreen, captured by html2canvas) ── */}
            <div
                ref={printRef}
                style={{
                    position: 'absolute', top: '-10000px', left: '-10000px',
                    display: 'none', width: '794px', minHeight: '1123px',
                    backgroundColor: '#FFFFFF', fontFamily: 'system-ui, -apple-system, sans-serif',
                    paddingBottom: '40px'
                }}
            >
                {/* Branded Header */}
                <div style={{ backgroundColor: '#0F172A', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 300, letterSpacing: '1px' }}>vivid senior living</div>
                        <div style={{ color: '#5EEAD4', fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>{hq?.billingAddress || 'Cupey, Puerto Rico'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>Resumen de Traslado Hospitalario</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#5EEAD4', fontSize: '11px', fontWeight: 500 }}>Powered by Zéndity</div>
                        <div style={{ color: '#94A3B8', fontSize: '9px', marginTop: '2px' }}>{fmtDateTime(data.transferDate)}</div>
                    </div>
                </div>

                {/* Facility Info Bar */}
                <div style={{ backgroundColor: '#F1F5F9', padding: '10px 40px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0' }}>
                    <span>{hq?.name || 'Vivid Senior Living'}</span>
                    <span>{hq?.billingAddress || ''}</span>
                    <span>{hq?.phone ? `Tel: ${hq.phone}` : ''}</span>
                </div>

                {/* Patient Identity Band */}
                <div style={{ backgroundColor: '#F8FAFC', padding: '18px 40px', borderBottom: '3px solid #14B8A6' }}>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>{patient?.name}</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#475569', fontWeight: 600, flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: '#E2E8F0', padding: '4px 12px', borderRadius: '6px' }}>Edad: {calcAge(patient?.dateOfBirth)}</span>
                        <span style={{ backgroundColor: '#E2E8F0', padding: '4px 12px', borderRadius: '6px' }}>Hab. {patient?.roomNumber || 'N/A'}</span>
                        {patient?.colorGroup && (
                            <span style={{ backgroundColor: '#E2E8F0', padding: '4px 12px', borderRadius: '6px' }}>Grupo {patient.colorGroup}</span>
                        )}
                        <span style={{ backgroundColor: '#E2E8F0', padding: '4px 12px', borderRadius: '6px' }}>Dieta: {patient?.diet || 'Regular'}</span>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '24px 40px', fontSize: '12px', color: '#1E293B', lineHeight: 1.6 }}>

                    {/* Motivo del traslado — primera sección, destacada */}
                    <div style={{ borderLeft: '4px solid #DC2626', backgroundColor: '#FEF2F2', padding: '14px 18px', marginBottom: '18px', borderRadius: '0 8px 8px 0' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Motivo del Traslado Hospitalario</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#7F1D1D' }}>{data.transferReason}</div>
                    </div>

                    {/* Alergias */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#FEE2E2', color: '#991B1B', padding: '6px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                            Alergias Críticas
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: allergiesText ? 700 : 400, color: allergiesText ? '#7F1D1D' : '#94A3B8', fontStyle: allergiesText ? 'normal' : 'italic' }}>
                            {allergiesText || 'Sin alergias documentadas en el expediente.'}
                        </div>
                    </div>

                    {/* Diagnósticos */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                            Diagnósticos Principales
                        </div>
                        {diagnosesText ? (
                            <div style={{ fontSize: '12px', lineHeight: 1.7 }}>
                                {diagnosesText.split('\n').map((line: string, i: number) => (
                                    <div key={i} style={{ marginBottom: '3px' }}>{line.replace(/^- /, '• ')}</div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#64748B' }}>Sin diagnósticos documentados.</div>
                        )}
                    </div>

                    {/* Medicamentos activos */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                            Medicamentos Activos ({meds.length})
                        </div>
                        {meds.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Medicamento</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Dosis</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Frecuencia</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Horario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {meds.map((m: any, i: number) => (
                                        <tr key={m.id || i} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0', fontWeight: 600 }}>{m.medication?.name || '—'}</td>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.medication?.dosage || '—'}</td>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.frequency || '—'}</td>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.scheduleTimes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#64748B' }}>Sin medicamentos activos en eMAR.</div>
                        )}
                    </div>

                    {/* Vitales recientes */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                            Signos Vitales Recientes
                        </div>
                        {vitals.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Fecha</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Presión</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>FC</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Temp</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Glucosa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vitals.map((v: any, i: number) => (
                                        <tr key={v.id || i} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0', fontWeight: 600 }}>{fmtTime(v.createdAt)}</td>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>{v.systolic}/{v.diastolic} mmHg</td>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>{v.heartRate} bpm</td>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>{v.temperature}°F</td>
                                            <td style={{ padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>{v.glucose ? `${v.glucose} mg/dL` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#64748B' }}>Sin signos vitales recientes registrados.</div>
                        )}
                    </div>

                    {/* Autorización */}
                    <div style={{ marginTop: '20px', padding: '14px 18px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Autorizado por</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                            {data.author?.name || 'Personal de Zéndity'}
                            {data.author?.role && <span style={{ color: '#64748B', fontWeight: 500, marginLeft: '8px' }}>({data.author.role})</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500, marginTop: '4px' }}>
                            {fmtDateTime(data.transferDate)}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ borderTop: '2px solid #14B8A6', marginTop: '24px', padding: '12px 40px', fontSize: '9px', color: '#64748B', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>Documento para paramédico — {hq?.name || 'Vivid Senior Living Cupey'} | HIPAA Compliant</span>
                    <span>Generado por Zéndity Healthcare Platform</span>
                </div>
            </div>
        </div>
    );
}

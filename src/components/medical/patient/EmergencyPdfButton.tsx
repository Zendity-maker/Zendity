"use client";

import { useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";


interface EmergencyPdfButtonProps {
    patientId: string;
    className?: string;
    children?: React.ReactNode;
}

export default function EmergencyPdfButton({ patientId, className, children }: EmergencyPdfButtonProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [patientData, setPatientData] = useState<any>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            // 1. Fetch live data
            const res = await fetch(`/api/corporate/patients/${patientId}/history-report`);
            const data = await res.json();

            if (!data.success || !data.history) {
                throw new Error("No se pudo obtener el historial del residente.");
            }

            // 2. Render invisible A4 layout
            setPatientData(data.history);

            // 3. Wait for DOM and images to load (artificial delay)
            await new Promise(resolve => setTimeout(resolve, 800));

            if (!printRef.current) throw new Error("Referencia de impresión no encontrada.");

            printRef.current.style.display = 'block';

            // 4. Paint canvas
            const canvas = await html2canvas(printRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            printRef.current.style.display = 'none';

            // 5. Generate PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            // AUTO-PRINT Logic
            pdf.autoPrint();
            window.open(pdf.output('bloburl'), '_blank');

            // Clear state
            setPatientData(null);
        } catch (error) {
            console.error("Error al generar el PDF:", error);
            alert("Hubo un problema generando el documento de emergencia.");
        } finally {
            setIsExporting(false);
        }
    };

    const intake = patientData?.intakeData;
    const meds = patientData?.medications?.filter((m: any) => m.isActive) || [];

    const defaultClass = "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm";

    return (
        <>
            <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className={className || defaultClass}
            >
                {children ? (
                    isExporting ? "Generando para Impresión..." : children
                ) : (
                    <>
                        {isExporting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <span className="text-xl"></span>
                        )}
                        {isExporting ? 'Procesando...' : 'Imprimir Dossier PDF'}
                    </>
                )}
            </button>

            {patientData && (
                <div ref={printRef} className="w-[794px] min-h-[1123px] mx-auto box-border" style={{ position: 'absolute', top: '-10000px', left: '-10000px', backgroundColor: '#ffffff', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

                    {/* ── Branded Header Band ── */}
                    <div style={{ backgroundColor: '#0F172A', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 300, letterSpacing: '1px' }}>vivid senior living</div>
                            <div style={{ color: '#5EEAD4', fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>Cupey, Puerto Rico</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>Dossier Medico de Emergencia</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#5EEAD4', fontSize: '11px', fontWeight: 500 }}>Powered by Zendity</div>
                            <div style={{ color: '#94A3B8', fontSize: '9px', marginTop: '2px' }}>{new Date().toLocaleDateString('es-PR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>

                    {/* ── Facility Info Bar ── */}
                    <div style={{ backgroundColor: '#F1F5F9', padding: '10px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', fontSize: '9px', color: '#64748B', fontWeight: 600 }}>
                        <span>{patientData?.headquarters?.name || 'Vivid Senior Living Cupey'}</span>
                        <span>Calle Arroyo #178 S-91, San Juan PR 00926</span>
                        <span>Tel: (787) 239-6858</span>
                    </div>

                    {/* ── Patient Identity Band ── */}
                    <div style={{ backgroundColor: '#F8FAFC', padding: '16px 40px', borderBottom: '3px solid #14B8A6', display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {patientData?.photoUrl ? (
                            <img src={patientData.photoUrl} alt="Foto" crossOrigin="anonymous" style={{ width: '72px', height: '72px', borderRadius: '10px', objectFit: 'cover', border: '2px solid #E2E8F0' }} />
                        ) : (
                            <div style={{ width: '72px', height: '72px', borderRadius: '10px', backgroundColor: '#F1F5F9', border: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '28px' }}>
                                &#128100;
                            </div>
                        )}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>{patientData?.name}</div>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: '#475569', fontWeight: 600 }}>
                                <span style={{ backgroundColor: '#E2E8F0', padding: '3px 10px', borderRadius: '6px' }}>Hab. {patientData?.roomNumber || 'N/A'}</span>
                                {patientData?.colorGroup && (
                                    <span style={{ backgroundColor: '#E2E8F0', padding: '3px 10px', borderRadius: '6px' }}>Grupo {patientData.colorGroup}</span>
                                )}
                                <span style={{ backgroundColor: '#E2E8F0', padding: '3px 10px', borderRadius: '6px' }}>Dieta: {patientData?.diet || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Content ── */}
                    <div style={{ padding: '24px 40px', fontSize: '11px', color: '#1E293B', lineHeight: 1.7 }}>

                        {/* Critical Allergies Alert */}
                        <div style={{ borderLeft: '4px solid #EF4444', backgroundColor: '#FEF2F2', padding: '12px 16px', marginBottom: '20px', borderRadius: '0 8px 8px 0' }}>
                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Alergias Criticas Registradas</div>
                            {intake?.allergies ? (
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#7F1D1D' }}>{intake.allergies}</div>
                            ) : (
                                <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#B91C1C' }}>No documentadas en el sistema al momento de la extraccion.</div>
                            )}
                        </div>

                        {/* Diagnoses */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                                Cuadro Clinico Base
                            </div>
                            {intake?.diagnoses ? (
                                <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
                                    {intake.diagnoses.split('\n').map((line: string, i: number) => (
                                        <div key={i} style={{ marginBottom: '4px' }}>{line.replace(/^- /, '• ')}</div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#64748B' }}>No hay historial de diagnosticos transcrito en este modulo.</div>
                            )}
                        </div>

                        {/* Medications Table */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', padding: '6px 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', borderRadius: '4px' }}>
                                Plan Farmacologico Activo (eMAR) — {meds.length} medicamentos
                            </div>
                            {meds.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Medicamento</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Dosis</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Frecuencia / Pauta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {meds.map((m: any, i: number) => (
                                            <tr key={m.id} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{m.medication?.name}</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.medication?.dosage}</td>
                                                <td style={{ padding: '5px 10px', borderBottom: '1px solid #E2E8F0' }}>{m.frequency}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#64748B' }}>Sin medicamentos activos registrados en eMAR.</div>
                            )}
                        </div>

                        {/* System ID */}
                        <div style={{ fontSize: '8px', color: '#94A3B8', marginTop: '16px' }}>
                            ID del Sistema: {patientData?.id}
                        </div>
                    </div>

                    {/* ── Branded Footer ── */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '2px solid #14B8A6', padding: '10px 40px', fontSize: '8px', color: '#64748B', display: 'flex', justifyContent: 'space-between', fontWeight: 600, backgroundColor: '#FFFFFF' }}>
                        <span>Documento Medico Confidencial — Vivid Senior Living Cupey | HIPAA Compliant Protocol</span>
                        <span>Generado por Zendity Healthcare Platform</span>
                    </div>
                </div>
            )}
        </>
    );
}

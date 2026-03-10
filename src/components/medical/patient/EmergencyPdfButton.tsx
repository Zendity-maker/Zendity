"use client";

import { useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ExclamationTriangleIcon, PhotoIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";

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
                            <span className="text-xl">🖨️</span>
                        )}
                        {isExporting ? 'Procesando...' : 'Imprimir Dossier PDF'}
                    </>
                )}
            </button>

            {patientData && (
                <div ref={printRef} className="w-[794px] min-h-[1123px] p-12 mx-auto box-border font-sans" style={{ position: 'absolute', top: '-10000px', left: '-10000px', backgroundColor: '#ffffff', color: '#1e293b' }}>
                    {/* Header Institucional */}
                    <div className="flex justify-between items-center pb-6 mb-8 border-b-4" style={{ borderColor: '#1e293b' }}>
                        <div className="flex items-center gap-4">
                            {patientData?.headquarters?.logoUrl && (
                                <img src={patientData.headquarters.logoUrl} alt="Logo Sede" className="h-16 w-auto object-contain" crossOrigin="anonymous" />
                            )}
                            <div>
                                <h1 className="text-3xl font-black tracking-tight" style={{ color: '#0f172a' }}>DOSSIER MÉDICO DE EMERGENCIA</h1>
                                <p className="text-sm font-bold mt-1 uppercase tracking-widest" style={{ color: '#64748b' }}>{patientData?.headquarters?.name || 'Zendity Medical Protocol'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold" style={{ color: '#1e293b' }}>Fecha de Impresión:</p>
                            <p className="text-sm" style={{ color: '#475569' }}>{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>

                    {/* Basic Info Row */}
                    <div className="flex items-start gap-8 mb-10">
                        {patientData?.photoUrl ? (
                            <img src={patientData.photoUrl} alt="Foto Paciente" crossOrigin="anonymous" className="w-32 h-32 rounded-xl object-cover border-2 shadow-sm" style={{ borderColor: '#e2e8f0' }} />
                        ) : (
                            <div className="w-32 h-32 rounded-xl border-2 flex items-center justify-center" style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#94a3b8' }}>
                                <PhotoIcon className="w-12 h-12" />
                            </div>
                        )}

                        <div className="flex-1">
                            <h2 className="text-4xl font-black mb-4" style={{ color: '#0f172a' }}>{patientData?.name}</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                                    <p className="text-xs font-bold uppercase" style={{ color: '#64748b' }}>Habitación</p>
                                    <p className="text-lg font-bold" style={{ color: '#0f172a' }}>{patientData?.roomNumber || "N/A"}</p>
                                </div>
                                <div className="p-3 rounded-lg border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                                    <p className="text-xs font-bold uppercase" style={{ color: '#64748b' }}>Dieta</p>
                                    <p className="text-lg font-bold" style={{ color: '#0f172a' }}>{patientData?.diet || "N/A"}</p>
                                </div>
                                <div className="p-3 rounded-lg border col-span-2" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                                    <p className="text-xs font-bold uppercase" style={{ color: '#64748b' }}>ID del Sistema</p>
                                    <p className="text-sm font-mono" style={{ color: '#475569' }}>{patientData?.id}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Critical Alerts (Allergies) */}
                    <div className="mb-10 p-6 border-2 rounded-xl" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
                        <h3 className="font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: '#991b1b' }}>
                            <ExclamationTriangleIcon className="w-5 h-5" /> ALERGIAS CRÍTICAS REGISTRADAS
                        </h3>
                        {intake?.allergies ? (
                            <p className="text-xl font-bold" style={{ color: '#7f1d1d' }}>{intake.allergies}</p>
                        ) : (
                            <p className="italic" style={{ color: '#b91c1c' }}>No documentadas en el sistema al momento de la extracción.</p>
                        )}
                    </div>

                    {/* Diagnoses */}
                    <div className="mb-10">
                        <h3 className="text-lg font-bold border-b-2 pb-2 mb-4 uppercase tracking-wider" style={{ color: '#1e293b', borderColor: '#e2e8f0' }}>Cuadro Clínico Base</h3>
                        {intake?.diagnoses ? (
                            <div className="text-base leading-relaxed font-medium" style={{ color: '#334155' }}>
                                {intake.diagnoses.split('\n').map((line: string, i: number) => (
                                    <p key={i} className="mb-2">✓ {line.replace(/^- /, '')}</p>
                                ))}
                            </div>
                        ) : (
                            <p className="italic" style={{ color: '#64748b' }}>No hay historial de diagnósticos transcrito en este módulo.</p>
                        )}
                    </div>

                    {/* Medications */}
                    <div>
                        <h3 className="text-lg font-bold border-b-2 pb-2 mb-4 uppercase tracking-wider" style={{ color: '#1e293b', borderColor: '#e2e8f0' }}>Plan Farmacológico Activo (eMAR)</h3>
                        {meds.length > 0 ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-sm font-bold uppercase" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                                        <th className="p-3 border" style={{ borderColor: '#e2e8f0' }}>Medicamento</th>
                                        <th className="p-3 border" style={{ borderColor: '#e2e8f0' }}>Dosis</th>
                                        <th className="p-3 border" style={{ borderColor: '#e2e8f0' }}>Frecuencia / Pauta</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {meds.map((m: any) => (
                                        <tr key={m.id} className="text-sm font-medium" style={{ color: '#1e293b' }}>
                                            <td className="p-3 border font-bold" style={{ borderColor: '#e2e8f0' }}>{m.medication?.name}</td>
                                            <td className="p-3 border" style={{ borderColor: '#e2e8f0' }}>{m.medication?.dosage}</td>
                                            <td className="p-3 border" style={{ borderColor: '#e2e8f0' }}>{m.frequency}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="italic" style={{ color: '#64748b' }}>Sin medicamentos administrados rutinariamente registrados en eMAR.</p>
                        )}
                    </div>

                    {/* Footer Warning */}
                    <div className="absolute bottom-12 left-12 right-12 text-center border-t pt-6" style={{ borderColor: '#cbd5e1' }}>
                        <p className="text-xs font-bold" style={{ color: '#64748b' }}>
                            Este documento es confidencial y de uso exclusivo para profesionales de salud e intervenciones de emergencia (HIPAA Compliant Protocol).
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}

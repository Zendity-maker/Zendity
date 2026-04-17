"use client";

import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Printer, X, Loader2, FileText, UserCircle2, Phone, AlertTriangle } from "lucide-react";

interface ResidentSummaryPrintProps {
    patientId: string;
    /** Si se provee, se muestra el motivo del traslado como banner rojo destacado */
    transferReason?: string;
    /** Nombre de quien autorizó el traslado (si aplica) */
    authorName?: string | null;
    authorRole?: string | null;
    /** ISO string — fecha del traslado (si aplica) */
    transferDate?: string;
    /** Título del documento (default: "Resumen de Residente") */
    titleOverride?: string;
    onClose: () => void;
}

interface FullPatientData {
    id: string;
    name: string;
    roomNumber: string | null;
    dateOfBirth: string | null;
    diet: string | null;
    photoUrl: string | null;
    colorGroup: string | null;
    status: string;
    idCardUrl: string | null;
    medicalPlanUrl: string | null;
    medicareCardUrl: string | null;
    headquarters: {
        id: string;
        name: string;
        logoUrl: string | null;
        phone: string | null;
        billingAddress: string | null;
    };
    intakeData: {
        allergies: string | null;
        diagnoses: string | null;
        medicalHistory: string | null;
    } | null;
    medications: Array<{
        id: string;
        frequency: string;
        scheduleTimes: string;
        instructions: string | null;
        medication: {
            name: string;
            dosage: string;
            route: string;
        } | null;
    }>;
    vitalSigns: Array<{
        id: string;
        systolic: number;
        diastolic: number;
        heartRate: number;
        temperature: number;
        glucose: number | null;
        oxygen: number | null;
        createdAt: string;
        measuredBy: { name: string; role: string } | null;
    }>;
    familyMembers: Array<{
        id: string;
        name: string;
        email: string;
        accessLevel: string;
        isRegistered: boolean;
    }>;
}

/* ── Helpers ── */
const calcAge = (dob: string | null): string => {
    if (!dob) return '—';
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    return `${age} años`;
};

const formatDOB = (dob: string | null): string => {
    if (!dob) return '—';
    return new Date(dob).toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const fmtDateTime = (iso: string): string =>
    new Date(iso).toLocaleString('es-PR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const fmtTimeShort = (iso: string): string =>
    new Date(iso).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ResidentSummaryPrint({
    patientId, transferReason, authorName, authorRole, transferDate, titleOverride, onClose
}: ResidentSummaryPrintProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<FullPatientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isHospitalFlow = !!transferReason;
    const documentTitle = titleOverride || (isHospitalFlow ? 'Resumen de Traslado Hospitalario' : 'Resumen de Residente');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/care/resident-summary?patientId=${patientId}`);
                const json = await res.json();
                if (json.success) setData(json.patient);
                else setError(json.error || 'Error cargando datos');
            } catch (e) {
                setError('Error de conexión');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [patientId]);

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
            let position = 0;
            pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeightScaled);
            heightLeft -= (pdfPageHeight - margin);

            while (heightLeft > 0) {
                position = heightLeft - imgHeightScaled;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position + margin, imgWidth, imgHeightScaled);
                heightLeft -= (pdfPageHeight - margin * 2);
            }

            const datePart = new Date().toISOString().split('T')[0];
            const nameForFile = data.name.replace(/\s+/g, '_');
            pdf.save(`Resumen_${nameForFile}_${datePart}.pdf`);
        } catch (err) {
            console.error('PDF error:', err);
            alert('Error generando el PDF.');
        } finally {
            setExporting(false);
        }
    };

    /* ── RENDER ── */
    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-teal-500 animate-spin mb-4" />
                    <p className="font-bold text-slate-600">Cargando datos del residente...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm">
                    <p className="text-rose-600 font-bold mb-4">{error || 'Error cargando datos'}</p>
                    <button onClick={onClose} className="w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold">Cerrar</button>
                </div>
            </div>
        );
    }

    const intake = data.intakeData;
    const allergiesText = intake?.allergies?.trim() || null;
    const diagnosesText = intake?.diagnoses?.trim() || null;
    const diagnosesList = diagnosesText ? diagnosesText.split('\n').map(l => l.replace(/^-\s?/, '').trim()).filter(Boolean) : [];
    const activeMeds = data.medications;
    const vitals = data.vitalSigns;
    const hq = data.headquarters;
    const primaryFamily = data.familyMembers.find(f => f.accessLevel === 'Full') || data.familyMembers[0] || null;

    /* ── COLORES VIVID ── */
    const VIVID_NAVY = '#1E3A5F';
    const VIVID_TEAL = '#0F6E56';
    const SOFT_BG = '#F1F5F9';

    return (
        <>
            {/* Modal controls + preview */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">

                    {/* Header */}
                    <div className={`px-6 py-4 flex items-center justify-between flex-shrink-0 ${isHospitalFlow ? 'bg-rose-600' : 'bg-slate-900'} text-white`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                {isHospitalFlow ? <span className="text-xl">&#x1F691;</span> : <FileText className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 className="font-black text-base leading-tight">
                                    {isHospitalFlow ? 'Residente enviado al hospital' : 'Resumen de Residente'}
                                </h2>
                                <p className={`text-xs font-medium ${isHospitalFlow ? 'text-rose-100' : 'text-slate-400'}`}>
                                    Documento oficial para paramédico y familiar
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Screen Preview */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl mx-auto">
                            <div className="flex items-center gap-4 pb-4 border-b-2 border-teal-500">
                                {data.photoUrl ? (
                                    <img src={data.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200" />
                                ) : (
                                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
                                        <UserCircle2 className="w-10 h-10 text-slate-300" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-slate-900 text-lg leading-tight">{data.name}</h3>
                                    <p className="text-sm text-slate-500 font-medium">
                                        {calcAge(data.dateOfBirth)} · Hab. {data.roomNumber || 'N/A'} · {data.diet || 'Dieta no registrada'}
                                    </p>
                                </div>
                            </div>

                            {/* Grid preview compacto */}
                            <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                                <div className="space-y-2">
                                    <div>
                                        <p className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Familiar</p>
                                        <p className="text-slate-700 font-bold">{primaryFamily?.name || 'No registrado'}</p>
                                    </div>
                                    <div>
                                        <p className="font-black text-[10px] text-rose-600 uppercase tracking-widest">Alergias</p>
                                        <p className={`font-bold ${allergiesText ? 'text-rose-700' : 'text-slate-400 italic'}`}>
                                            {allergiesText || 'Sin alergias conocidas'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Diagnósticos</p>
                                        <p className="text-slate-700 font-medium">{diagnosesList.length} condiciones</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <p className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Medicamentos</p>
                                        <p className="text-slate-700 font-bold">{activeMeds.length} activos</p>
                                    </div>
                                    <div>
                                        <p className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Signos vitales</p>
                                        <p className="text-slate-700 font-medium">{vitals.length} registros recientes</p>
                                    </div>
                                    {transferReason && (
                                        <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                                            <p className="font-black text-[10px] text-rose-700 uppercase tracking-widest">Motivo del traslado</p>
                                            <p className="text-rose-800 font-bold leading-tight">{transferReason}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
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
                                <><Loader2 className="w-4 h-4 animate-spin" /> Generando PDF...</>
                            ) : (
                                <><Printer className="w-4 h-4" /> Descargar PDF</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── OFFSCREEN PDF RENDER ── */}
            <div
                ref={printRef}
                style={{
                    position: 'absolute', top: '-10000px', left: '-10000px',
                    display: 'none', width: '794px',
                    backgroundColor: '#FFFFFF',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    color: '#1E293B',
                }}
            >
                {/* ── HEADER ── */}
                <div style={{ padding: '24px 40px 16px 40px', borderBottom: `3px solid ${VIVID_TEAL}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>
                            {data.name}
                        </div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: '16px', color: VIVID_NAVY, fontWeight: 800, letterSpacing: '0.5px' }}>
                                {hq.name}
                            </div>
                            {hq.phone && (
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Tel. {hq.phone}</div>
                            )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                            {new Date().toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                    </div>

                    {/* LOGO + TÍTULO */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        {hq.logoUrl && (
                            <img
                                src={hq.logoUrl}
                                alt={hq.name}
                                crossOrigin="anonymous"
                                style={{ height: '60px', width: 'auto', objectFit: 'contain' }}
                            />
                        )}
                        <div style={{ fontSize: '22px', fontWeight: 800, color: VIVID_TEAL, letterSpacing: '4px', textTransform: 'uppercase', marginTop: '4px' }}>
                            {documentTitle}
                        </div>
                    </div>
                </div>

                {/* Banner de traslado hospitalario (solo si aplica) */}
                {transferReason && (
                    <div style={{ margin: '12px 40px 0 40px', padding: '12px 18px', backgroundColor: '#FEF2F2', borderLeft: '5px solid #DC2626', borderRadius: '0 8px 8px 0' }}>
                        <div style={{ fontSize: '9px', fontWeight: 900, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '4px' }}>
                            Motivo del Traslado Hospitalario
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#7F1D1D' }}>{transferReason}</div>
                        {authorName && (
                            <div style={{ fontSize: '10px', color: '#991B1B', marginTop: '4px', fontWeight: 600 }}>
                                Autorizado por {authorName}{authorRole ? ` (${authorRole})` : ''}
                                {transferDate && ` · ${fmtDateTime(transferDate)}`}
                            </div>
                        )}
                    </div>
                )}

                {/* ── 2 COLUMNAS ── */}
                <div style={{ display: 'flex', margin: '14px 0 0 0' }}>

                    {/* IZQUIERDA — datos del residente (fondo gris) */}
                    <div style={{
                        width: '42%',
                        padding: '18px 24px',
                        backgroundColor: SOFT_BG,
                        fontSize: '11px',
                        lineHeight: 1.5,
                    }}>
                        {/* Foto + nombre grande */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
                            {data.photoUrl ? (
                                <img
                                    src={data.photoUrl}
                                    alt={data.name}
                                    crossOrigin="anonymous"
                                    style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: `4px solid #FFFFFF`, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                                />
                            ) : (
                                <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `4px solid ${VIVID_TEAL}` }}>
                                    <span style={{ fontSize: '32px', fontWeight: 800, color: VIVID_NAVY }}>
                                        {data.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                    </span>
                                </div>
                            )}
                            <div style={{ fontSize: '18px', fontWeight: 800, color: VIVID_NAVY, marginTop: '12px', textAlign: 'center', lineHeight: 1.2 }}>
                                {data.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginTop: '4px', textAlign: 'center' }}>
                                {formatDOB(data.dateOfBirth)} · {calcAge(data.dateOfBirth)}
                            </div>
                            {data.roomNumber && (
                                <div style={{ fontSize: '10px', fontWeight: 700, color: VIVID_TEAL, marginTop: '4px', backgroundColor: '#FFFFFF', padding: '3px 10px', borderRadius: '999px' }}>
                                    Habitación {data.roomNumber}
                                </div>
                            )}
                        </div>

                        {/* Familiar / Encargado */}
                        <SectionTitle color={VIVID_NAVY}>Familiar / Encargado</SectionTitle>
                        {primaryFamily ? (
                            <div style={{ marginBottom: '14px' }}>
                                <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '12px' }}>{primaryFamily.name}</div>
                                <div style={{ color: '#475569', fontSize: '10px', marginTop: '2px' }}>
                                    {primaryFamily.email}
                                </div>
                                <div style={{ color: '#94A3B8', fontSize: '9px', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    {primaryFamily.accessLevel === 'Full' ? 'Acceso completo' : 'Solo lectura'}
                                    {primaryFamily.isRegistered ? ' · Activo' : ' · Pendiente'}
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: '#94A3B8', fontStyle: 'italic', marginBottom: '14px' }}>No registrado</div>
                        )}

                        {/* Contacto de Emergencia */}
                        <SectionTitle color={VIVID_NAVY}>Contacto de Emergencia</SectionTitle>
                        <div style={{ marginBottom: '14px', fontSize: '11px' }}>
                            {primaryFamily ? (
                                <div style={{ fontWeight: 600, color: '#0F172A' }}>{primaryFamily.name}<br/>
                                    <span style={{ fontSize: '10px', color: '#475569', fontWeight: 500 }}>{primaryFamily.email}</span>
                                </div>
                            ) : (
                                <div style={{ color: '#94A3B8', fontStyle: 'italic' }}>Ver familiar encargado</div>
                            )}
                        </div>

                        {/* Seguro Social */}
                        <SectionTitle color={VIVID_NAVY}>Seguro Social</SectionTitle>
                        <div style={{ marginBottom: '14px', fontFamily: 'Courier, monospace', fontSize: '13px', fontWeight: 700, color: '#475569', letterSpacing: '2px' }}>
                            XXX-XX-XXXX
                        </div>

                        {/* Plan Médico — Tarjeta de seguro */}
                        <SectionTitle color={VIVID_NAVY}>Plan Médico</SectionTitle>
                        <div style={{ marginBottom: '12px' }}>
                            {data.medicalPlanUrl ? (
                                <img
                                    src={data.medicalPlanUrl}
                                    alt="Tarjeta de plan médico"
                                    crossOrigin="anonymous"
                                    style={{ width: '100%', maxHeight: '110px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', padding: '4px', display: 'block' }}
                                />
                            ) : data.medicareCardUrl ? (
                                <img
                                    src={data.medicareCardUrl}
                                    alt="Tarjeta Medicare"
                                    crossOrigin="anonymous"
                                    style={{ width: '100%', maxHeight: '110px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', padding: '4px', display: 'block' }}
                                />
                            ) : (
                                <div style={{
                                    width: '100%', height: '90px', borderRadius: '8px',
                                    backgroundColor: '#E2E8F0', border: '1px dashed #94A3B8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#64748B', fontSize: '10px', fontStyle: 'italic', fontWeight: 600,
                                }}>
                                    Tarjeta de seguro no disponible
                                </div>
                            )}
                        </div>

                        {/* ID del Residente */}
                        <SectionTitle color={VIVID_NAVY}>Identificación</SectionTitle>
                        <div style={{ marginBottom: '14px' }}>
                            {data.idCardUrl ? (
                                <img
                                    src={data.idCardUrl}
                                    alt="ID del residente"
                                    crossOrigin="anonymous"
                                    style={{ width: '100%', maxHeight: '100px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', padding: '4px', display: 'block' }}
                                />
                            ) : (
                                <div style={{
                                    width: '100%', height: '80px', borderRadius: '8px',
                                    backgroundColor: '#E2E8F0', border: '1px dashed #94A3B8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#64748B', fontSize: '10px', fontStyle: 'italic', fontWeight: 600,
                                }}>
                                    ID no disponible
                                </div>
                            )}
                        </div>

                        {/* Diagnósticos */}
                        <SectionTitle color={VIVID_NAVY}>Diagnósticos / Condiciones</SectionTitle>
                        {diagnosesList.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#0F172A', fontWeight: 500, lineHeight: 1.6 }}>
                                {diagnosesList.slice(0, 15).map((d, i) => (
                                    <li key={i} style={{ marginBottom: '3px' }}>{d}</li>
                                ))}
                            </ul>
                        ) : (
                            <div style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '11px' }}>No documentados</div>
                        )}
                    </div>

                    {/* DERECHA — medicamentos + alergias + vitales */}
                    <div style={{ width: '58%', padding: '18px 24px 18px 24px', fontSize: '11px' }}>

                        {/* MEDICAMENTOS — título grande */}
                        <div style={{ fontSize: '22px', fontWeight: 900, color: VIVID_NAVY, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Medicamentos
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, marginBottom: '10px', letterSpacing: '1px' }}>
                            {activeMeds.length} medicamento{activeMeds.length === 1 ? '' : 's'} activo{activeMeds.length === 1 ? '' : 's'}
                        </div>

                        {activeMeds.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', marginBottom: '18px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: VIVID_NAVY, color: '#FFFFFF' }}>
                                        <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Medicamento</th>
                                        <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Dosis</th>
                                        <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Frecuencia</th>
                                        <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Horario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeMeds.map((m, i) => (
                                        <tr key={m.id} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                                            <td style={{ padding: '7px 8px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, color: '#0F172A' }}>
                                                {m.medication?.name || '—'}
                                            </td>
                                            <td style={{ padding: '7px 8px', borderBottom: '1px solid #E2E8F0' }}>{m.medication?.dosage || '—'}</td>
                                            <td style={{ padding: '7px 8px', borderBottom: '1px solid #E2E8F0' }}>{m.frequency}</td>
                                            <td style={{ padding: '7px 8px', borderBottom: '1px solid #E2E8F0', fontFamily: 'Courier, monospace', fontSize: '10px' }}>{m.scheduleTimes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ color: '#94A3B8', fontStyle: 'italic', marginBottom: '18px' }}>Sin medicamentos activos registrados en eMAR.</div>
                        )}

                        {/* ALERGIAS */}
                        <SectionTitle color={VIVID_TEAL}>Alergias</SectionTitle>
                        {allergiesText ? (
                            <div style={{
                                backgroundColor: '#FEF2F2',
                                borderLeft: '4px solid #DC2626',
                                padding: '10px 14px',
                                borderRadius: '0 6px 6px 0',
                                marginBottom: '16px',
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#7F1D1D',
                            }}>
                                {allergiesText}
                            </div>
                        ) : (
                            <div style={{
                                backgroundColor: '#ECFDF5',
                                borderLeft: '4px solid #059669',
                                padding: '10px 14px',
                                borderRadius: '0 6px 6px 0',
                                marginBottom: '16px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#065F46',
                            }}>
                                Sin alergias conocidas
                            </div>
                        )}

                        {/* SIGNOS VITALES RECIENTES */}
                        <SectionTitle color={VIVID_TEAL}>Últimos Signos Vitales</SectionTitle>
                        {vitals.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#334155', color: '#FFFFFF' }}>
                                        <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 700, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>Fecha</th>
                                        <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 700, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>PA</th>
                                        <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 700, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>FC</th>
                                        <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 700, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>Temp</th>
                                        <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 700, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>O2</th>
                                        <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 700, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>Gluc</th>
                                        <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 700, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>Por</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vitals.map((v, i) => (
                                        <tr key={v.id} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                                            <td style={{ padding: '5px 6px', borderBottom: '1px solid #E2E8F0', fontWeight: 600 }}>{fmtTimeShort(v.createdAt)}</td>
                                            <td style={{ padding: '5px 6px', borderBottom: '1px solid #E2E8F0' }}>{v.systolic}/{v.diastolic}</td>
                                            <td style={{ padding: '5px 6px', borderBottom: '1px solid #E2E8F0' }}>{v.heartRate}</td>
                                            <td style={{ padding: '5px 6px', borderBottom: '1px solid #E2E8F0' }}>{v.temperature}°F</td>
                                            <td style={{ padding: '5px 6px', borderBottom: '1px solid #E2E8F0' }}>{v.oxygen ? `${v.oxygen}%` : '—'}</td>
                                            <td style={{ padding: '5px 6px', borderBottom: '1px solid #E2E8F0' }}>{v.glucose ? `${v.glucose}` : '—'}</td>
                                            <td style={{ padding: '5px 6px', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>{v.measuredBy?.name || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ color: '#94A3B8', fontStyle: 'italic' }}>Sin vitales registrados recientemente.</div>
                        )}
                    </div>
                </div>

                {/* ── FOOTER ── */}
                <div style={{ borderTop: `3px solid ${VIVID_TEAL}`, marginTop: '14px', padding: '14px 40px 18px 40px', textAlign: 'center' }}>
                    {hq.logoUrl && (
                        <img
                            src={hq.logoUrl}
                            alt={hq.name}
                            crossOrigin="anonymous"
                            style={{ height: '28px', width: 'auto', objectFit: 'contain', marginBottom: '6px' }}
                        />
                    )}
                    <div style={{ fontSize: '10px', fontWeight: 700, color: VIVID_NAVY, marginBottom: '2px' }}>{hq.name}</div>
                    {hq.billingAddress && (
                        <div style={{ fontSize: '9px', color: '#64748B', marginBottom: '4px' }}>{hq.billingAddress}</div>
                    )}
                    {hq.phone && (
                        <div style={{ fontSize: '9px', color: '#64748B', marginBottom: '8px' }}>Tel. {hq.phone}</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#94A3B8', fontWeight: 600, borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '4px' }}>
                        <span>Generado por Zéndity · {new Date().toLocaleString('es-PR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>Documento Confidencial — HIPAA</span>
                    </div>
                </div>
            </div>
        </>
    );
}

/* Sub-componente para títulos de sección en la columna izquierda */
function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
    return (
        <div style={{
            fontSize: '9px',
            fontWeight: 900,
            color,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: '6px',
            marginTop: '2px',
            borderBottom: `1px solid ${color}33`,
            paddingBottom: '3px',
        }}>
            {children}
        </div>
    );
}

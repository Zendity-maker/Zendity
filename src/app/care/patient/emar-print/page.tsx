"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2 } from "lucide-react";

function EmarPrintContent() {
    const searchParams = useSearchParams();
    const patientId = searchParams?.get("patientId");
    
    const [patient, setPatient] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!patientId) return;

        const fetchData = async () => {
            try {
                // Endpoint existnete que retorna el expediente del paciente
                const res = await fetch(`/api/corporate/patients/${patientId}`);
                const data = await res.json();
                
                if (data.patient) {
                    setPatient(data.patient);
                }
            } catch (error) {
                console.error("Error fetching patient print data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        
    }, [patientId]);

    if (loading) return <div className="min-h-screen flex flex-col justify-center items-center bg-slate-100 text-slate-500"><Loader2 className="w-10 h-10 animate-spin mb-4" /> Generando eMAR Oficial...</div>;
    if (!patient) return <div className="p-10 text-center font-bold text-slate-500">Paciente no encontrado.</div>;

    const headquarters = patient.headquarters;
    
    // Fix Hydration Mismatch: Evaluar la fecha solo en el cliente
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => { setNow(new Date()); }, []);

    // Collect all medications logic
    const allAdministrations: any[] = [];
    if (patient.medications && Array.isArray(patient.medications)) {
        patient.medications.forEach((pm: any) => {
            if (pm.administrations && Array.isArray(pm.administrations)) {
                pm.administrations.forEach((admin: any) => {
                    allAdministrations.push({
                        ...admin,
                        medicationName: pm.medication?.name,
                        dosage: pm.medication?.dosage,
                        route: pm.medication?.route
                    });
                });
            }
        });
    }

    // Sort by administration date descending
    allAdministrations.sort((a, b) => new Date(b.administeredAt).getTime() - new Date(a.administeredAt).getTime());

    return (
        <div className="bg-slate-200 min-h-screen flex justify-center py-10 font-sans print:py-0 print:bg-white print:m-0">
            <div className="bg-white w-full max-w-[8.5in] shadow-2xl p-12 print:shadow-none print:p-0">
                
                {/* Opciones No-Imprimibles */}
                <div className="flex justify-between items-center bg-slate-800 text-white p-4 rounded-xl mb-8 print:hidden">
                    <div>
                        <p className="font-black">eMAR Cardex View</p>
                        <p className="text-xs text-slate-400">Sólo para fines de auditoría oficial.</p>
                    </div>
                    <button onClick={() => window.print()} className="bg-indigo-500 hover:bg-indigo-600 px-6 py-2 rounded-lg font-bold text-sm">
                         Imprimir Expediente
                    </button>
                </div>

                {/* Encabezado Oficial Zendity */}
                <div className="flex justify-between items-start border-b-4 border-slate-800 pb-6 mb-8">
                    <div className="flex items-center gap-6">
                        {headquarters?.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={headquarters.logoUrl} alt="Logo Sede" className="w-24 h-24 object-contain" />
                        ) : (
                            <div className="w-24 h-24 bg-slate-100 flex items-center justify-center font-black text-slate-400 text-2xl rounded-xl">HQ</div>
                        )}
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Historial Clínico (eMAR)</h1>
                            <p className="text-slate-500 text-lg font-bold mt-1">{headquarters?.name || "Zendity Medical"}</p>
                            <p className="text-sm text-slate-400 font-medium">Impreso: {now ? format(now, "PPpp", { locale: es }) : "Cargando fecha..."}</p>
                        </div>
                    </div>
                </div>

                {/* Info del Residente */}
                <div className="grid grid-cols-2 gap-8 mb-8 border-b-2 border-slate-100 pb-8">
                    <div>
                        <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">Paciente / Residente</p>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">{patient.name}</h2>
                        <div className="space-y-1 text-sm text-slate-700 font-medium">
                            <p><span className="font-bold text-slate-400 w-24 inline-block">Habitación:</span> {patient.roomNumber || 'No asignada'}</p>
                            <p><span className="font-bold text-slate-400 w-24 inline-block">Admisión:</span> {format(new Date(patient.admissionDate), "PP", {locale: es})}</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1">Condiciones Médicas</p>
                        <div className="space-y-1 text-sm text-slate-700 font-medium mt-3">
                            <p><span className="font-bold text-slate-400 w-24 inline-block">Condición:</span> {patient.lifePlan?.medicalCondition || 'N/A'}</p>
                            <p className="text-rose-600"><span className="font-bold text-rose-300 w-24 inline-block">Alergias:</span> {patient.lifePlan?.allergies || 'NKA'}</p>
                        </div>
                    </div>
                </div>

                {/* Tabla de Administraciones (Cardex Digital) */}
                <div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Registro de Entregas (Auditoría de Firmware)</p>
                    
                    {allAdministrations.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold">
                            No existen registros de medicación para este paciente.
                        </div>
                    ) : (
                        <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                            <thead className="bg-slate-100">
                                <tr className="text-left text-xs uppercase text-slate-600">
                                    <th className="py-3 px-4 font-black">Medicamento</th>
                                    <th className="py-3 px-4 font-black">Fecha y Hora Real</th>
                                    <th className="py-3 px-4 font-black">Dosis / Vía</th>
                                    <th className="py-3 px-4 font-black">Estatus / Cuidador</th>
                                    <th className="py-3 px-4 font-black text-right w-48">Firma eMAR</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {allAdministrations.map((admin: any) => (
                                    <tr key={admin.id} className="hover:bg-slate-50">
                                        <td className="py-4 px-4">
                                            <p className="font-bold text-slate-900">{admin.medicationName}</p>
                                        </td>
                                        <td className="py-4 px-4 font-medium text-slate-700">
                                            {format(new Date(admin.administeredAt), "MMM d, yyyy - h:mm a", { locale: es })}
                                        </td>
                                        <td className="py-4 px-4 text-slate-600 font-medium">
                                            {admin.dosage}  {admin.route}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase rounded w-fit ${admin.status === 'ADMINISTERED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {admin.status}
                                                </span>
                                                <span className="text-xs text-slate-500 font-bold">{admin.administeredBy?.name || 'Sistema'}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 flex justify-end">
                                            {admin.signatureBase64 ? (
                                                <div className="w-32 h-12 bg-white border border-slate-200 rounded flex items-center justify-center p-1">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={admin.signatureBase64} alt="Firma" className="max-h-full max-w-full object-contain" />
                                                </div>
                                            ) : (
                                                <span className="text-xs italic text-slate-400 font-medium">Sin firma digital</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="mt-16 text-center text-xs text-slate-400 border-t-2 border-dashed border-slate-200 pt-8 pb-12">
                    <p className="font-bold">Este reporte reemplaza oficialmente el uso del Cardex Tradicional bajo normativa digital válida.</p>
                    <p>Las firmas aquí plasmadas fueron captadas mediante autenticación de usuario y trazo táctil directo (Zendity Secure Signature).</p>
                </div>

            </div>
        </div>
    );
}

export default function EmarPrintPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex flex-col justify-center items-center bg-slate-100 text-slate-500"><Loader2 className="w-10 h-10 animate-spin mb-4" /> Cargando Módulo de Impresión eMAR...</div>}>
            <EmarPrintContent />
        </Suspense>
    );
}

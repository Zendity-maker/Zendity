import { useState } from "react";
import { PlusIcon, PhotoIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import EmergencyPdfButton from "./EmergencyPdfButton";

export default function PatientClinicalSummaryTab({ patientData, onRefresh }: { patientData: any, onRefresh: () => void }) {
    const intake = patientData?.intakeData;
    const meds = patientData?.medications?.filter((m: any) => m.isActive) || [];

    const [isUploading, setIsUploading] = useState(false);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        setIsUploading(true);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
                const res = await fetch(`/api/corporate/patients/${patientData.id}/photo`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ photoUrl: base64String })
                });

                if (res.ok) {
                    onRefresh();
                } else {
                    alert("Error subiendo fotografía");
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="relative">
            {/* Action Bar */}
            <div className="flex justify-end mb-6">
                <EmergencyPdfButton patientId={patientData.id} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
                {/* Left Column: Profile & Diet */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col items-center">
                        <div className="relative group w-32 h-32 mb-4">
                            <div className={`w-full h-full rounded-full overflow-hidden border-4 border-white shadow-lg ${patientData?.photoUrl ? '' : 'bg-slate-100'}`}>
                                {patientData?.photoUrl ? (
                                    <img src={patientData.photoUrl} alt={patientData.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                                ) : (
                                    <div className="w-full h-full flex flex-col justify-center items-center text-slate-300">
                                        <PhotoIcon className="w-10 h-10" />
                                    </div>
                                )}
                            </div>

                            <label className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded-full flex flex-col items-center justify-center cursor-pointer transition-opacity backdrop-blur-sm">
                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
                                <PhotoIcon className="w-6 h-6 mb-1" />
                                <span className="text-xs font-bold">{isUploading ? 'Subiendo...' : 'Cambiar'}</span>
                            </label>
                        </div>

                        <h3 className="text-xl font-black text-slate-800 text-center leading-tight">{patientData?.name}</h3>
                        <p className="text-slate-500 font-medium text-sm mt-1">Expediente Clínico Base</p>

                        <div className="w-full mt-6 pt-6 border-t border-slate-100 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Asignación Dietética</span>
                                <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{patientData?.diet || "Estándar"}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Habitación</span>
                                <span className="font-bold text-slate-800">{patientData?.roomNumber || "No asignada"}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Estatus</span>
                                <span className="font-bold text-emerald-600">{patientData?.status === 'ACTIVE' ? "ACTIVO" : patientData?.status}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 shadow-sm">
                        <h3 className="text-amber-800 font-bold mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                             Alergias Conocidas
                        </h3>
                        {intake?.allergies ? (
                            <p className="text-amber-900 font-medium">{intake.allergies}</p>
                        ) : (
                            <p className="text-amber-700/60 font-medium italic">Sin registro de alergias documentadas.</p>
                        )}
                    </div>
                </div>

                {/* Right Column: Diagnoses & Meds */}
                <div className="md:col-span-2 space-y-6">
                    {/* Condiciones Medicas */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 h-full flex flex-col">
                        <h3 className="text-slate-800 font-black text-lg mb-4 flex items-center gap-2">
                             Cuadro Clínico / Diagnósticos
                        </h3>

                        {intake?.diagnoses ? (
                            <div className="prose prose-sm prose-slate max-w-none font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                {intake.diagnoses.split('\n').map((line: string, i: number) => (
                                    <p key={i} className="mb-2 last:mb-0"> {line.replace(/^- /, '')}</p>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                                    <PlusIcon className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-slate-600 font-bold">No hay diagnósticos registrados</p>
                                <p className="text-slate-400 text-sm mt-1 max-w-xs">El diagnóstico base debe registrarse durante el proceso de Admisión.</p>
                            </div>
                        )}

                        <h3 className="text-slate-800 font-black text-lg mb-4 mt-8 flex items-center gap-2">
                             Tratamiento Activo (eMAR Dashboard)
                        </h3>

                        {meds.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {meds.map((m: any) => (
                                    <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3 shadow-sm">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                                            R<span className="text-xs align-top">x</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{m.medication?.name}</p>
                                            <p className="text-xs font-medium text-slate-500 mt-0.5">{m.medication?.dosage}  {m.frequency}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                <p className="text-slate-500 font-medium">No hay medicamentos activos pre-programados.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

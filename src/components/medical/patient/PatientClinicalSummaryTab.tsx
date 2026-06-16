import { useState } from "react";
import { PlusIcon, PhotoIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import EmergencyPdfButton from "./EmergencyPdfButton";
import { useAuth } from "@/context/AuthContext";

/**
 * Roles autorizados para togglear el protocolo de rotación postural.
 * MIRROR del role gate del endpoint PATCH /api/corporate/patients/[id]/rotation-protocol.
 * CAREGIVER, FAMILY, SOCIAL_WORKER, etc. no ven el botón aunque alcancen este tab.
 */
const PROTOCOL_TOGGLE_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

export default function PatientClinicalSummaryTab({ patientData, onRefresh }: { patientData: any, onRefresh: () => void }) {
    const intake = patientData?.intakeData;
    const meds = patientData?.medications?.filter((m: any) => m.isActive) || [];
    const { user } = useAuth();
    const canToggleProtocol = !!user?.role && PROTOCOL_TOGGLE_ROLES.includes(user.role);

    const requiresPostural = !!patientData?.requiresPosturalChanges;
    const [protocolModalOpen, setProtocolModalOpen] = useState(false);
    const [protocolSubmitting, setProtocolSubmitting] = useState(false);
    const [protocolConfirmCheck, setProtocolConfirmCheck] = useState(false);
    const [protocolError, setProtocolError] = useState<string | null>(null);

    const openProtocolModal = () => {
        setProtocolConfirmCheck(false);
        setProtocolError(null);
        setProtocolModalOpen(true);
    };

    const submitProtocolToggle = async () => {
        if (!protocolConfirmCheck || protocolSubmitting) return;
        setProtocolSubmitting(true);
        setProtocolError(null);
        try {
            const res = await fetch(`/api/corporate/patients/${patientData.id}/rotation-protocol`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requiresPosturalChanges: !requiresPostural,
                    confirmed: true,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setProtocolError(data.error || 'Error procesando cambio');
                return;
            }
            setProtocolModalOpen(false);
            onRefresh();
        } catch (e: any) {
            setProtocolError(e.message || 'Error de red');
        } finally {
            setProtocolSubmitting(false);
        }
    };

    const [isUploading, setIsUploading] = useState(false);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        setIsUploading(true);

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 400; // Optimal compression
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const base64String = canvas.toDataURL("image/jpeg", 0.7);

                    try {
                        const res = await fetch(`/api/corporate/patients/${patientData.id}/photo`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ photoUrl: base64String })
                        });

                        if (res.ok) {
                            onRefresh();
                        } else {
                            const data = await res.json().catch(() => ({}));
                            alert("Error subiendo fotografía: " + (data.error || "Error del servidor"));
                        }
                    } catch (error) {
                        console.error("Upload error:", error);
                        alert("Error de red al intentar subir la foto.");
                    } finally {
                        setIsUploading(false);
                    }
                }
            };
            img.src = reader.result as string;
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

                    {/* Sub-sección "Protocolo de Rotación Postural" — toggle de
                        Patient.requiresPosturalChanges. Sienta el patrón para
                        flags clínicos editables (futuros: NPO, restrictions). */}
                    <div className={`rounded-3xl p-6 border shadow-sm ${requiresPostural ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                        <h3 className={`font-bold mb-3 text-sm uppercase tracking-wider flex items-center gap-2 ${requiresPostural ? 'text-orange-800' : 'text-slate-700'}`}>
                            Protocolo de Rotación Postural
                        </h3>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                                {requiresPostural ? (
                                    <>
                                        <p className="text-orange-900 font-bold">Activo (encamado)</p>
                                        <p className="text-orange-700/80 text-xs font-medium mt-1 leading-relaxed">
                                            Grid de rotación habilitado en el tablet. El residente aparece en el dashboard del enfermero y dispara alertas cada 2 h si no se registra rotación.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-700 font-bold">Sin protocolo activo</p>
                                        <p className="text-slate-500 text-xs font-medium mt-1 leading-relaxed">
                                            Vigilancia preventiva estándar. Active solo si el residente está encamado o necesita rotaciones programadas.
                                        </p>
                                    </>
                                )}
                            </div>
                            {canToggleProtocol && (
                                <button
                                    onClick={openProtocolModal}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl shadow-sm active:scale-95 transition-all shrink-0 ${
                                        requiresPostural
                                            ? 'bg-white text-orange-700 border border-orange-300 hover:bg-orange-100'
                                            : 'bg-orange-600 text-white hover:bg-orange-700'
                                    }`}
                                >
                                    {requiresPostural ? 'Suspender' : 'Activar'}
                                </button>
                            )}
                        </div>
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

                        <h3 className="text-slate-800 font-black text-lg mb-4 mt-8 flex items-center gap-2">
                             Documentos Vitales
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {patientData?.idCardUrl ? (
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-center">Identificación ID</div>
                                    <div className="aspect-[4/3] bg-white p-2">
                                        <img src={patientData.idCardUrl} alt="ID Oficial" className="w-full h-full object-contain rounded-lg" />
                                    </div>
                                </div>
                            ) : null}
                            {patientData?.medicalPlanUrl ? (
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-center">Plan Médico</div>
                                    <div className="aspect-[4/3] bg-white p-2">
                                        <img src={patientData.medicalPlanUrl} alt="Plan Médico" className="w-full h-full object-contain rounded-lg" />
                                    </div>
                                </div>
                            ) : null}
                            {patientData?.medicareCardUrl ? (
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-center">Tarjeta Medicare</div>
                                    <div className="aspect-[4/3] bg-white p-2">
                                        <img src={patientData.medicareCardUrl} alt="Tarjeta Medicare" className="w-full h-full object-contain rounded-lg" />
                                    </div>
                                </div>
                            ) : null}
                            {!patientData?.idCardUrl && !patientData?.medicalPlanUrl && !patientData?.medicareCardUrl && (
                                <div className="col-span-full py-8 text-center bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                                    <p className="text-slate-500 font-bold mb-1">Sin Documentos Digitalizados</p>
                                    <p className="text-slate-400 text-sm font-medium">Utiliza el botón "Editar Perfil" en la cabecera para subir fotos del ID y Tarjetas de Salud.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal confirmación toggle de protocolo. Lenguaje clínico, NO
                de dev. Copy preciso por dirección — al desactivar NO promete
                que el residente desaparece del dashboard (puede seguir
                enrolado por norton o úlcera activa). */}
            {protocolModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`px-6 py-5 border-b ${requiresPostural ? 'bg-amber-50 border-amber-200' : 'bg-orange-50 border-orange-200'}`}>
                            <h2 className={`text-xl font-black ${requiresPostural ? 'text-amber-900' : 'text-orange-900'}`}>
                                {requiresPostural
                                    ? 'Suspender protocolo de rotación postural'
                                    : 'Activar protocolo de rotación postural'}
                            </h2>
                            <p className={`text-sm font-semibold mt-1 ${requiresPostural ? 'text-amber-800' : 'text-orange-800'}`}>
                                Residente: <span className="font-black">{patientData?.name}</span>
                            </p>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {!requiresPostural ? (
                                <>
                                    <p className="text-slate-700 font-medium text-sm">
                                        Vas a marcar a este residente como encamado. Esto cambia el protocolo de cuidado:
                                    </p>
                                    <ul className="space-y-2 text-sm text-slate-700">
                                        <li className="flex gap-2"><span className="text-orange-600 font-black">•</span><span>Aparece el grid de rotación postural (Izquierda / Supino / Derecha) en el tablet de cada cuidadora cuando atienda a este residente.</span></li>
                                        <li className="flex gap-2"><span className="text-orange-600 font-black">•</span><span>Entra al dashboard del enfermero (<span className="font-bold">Rotación / UPP</span>) con su tier de cumplimiento.</span></li>
                                        <li className="flex gap-2"><span className="text-orange-600 font-black">•</span><span>Si pasan más de 2 horas sin rotación registrada, el sistema envía alerta a cuidadora, enfermero y supervisor.</span></li>
                                    </ul>
                                </>
                            ) : (
                                <>
                                    <p className="text-slate-700 font-medium text-sm">
                                        Vas a desmarcar a este residente. Esto <span className="font-black">suspende el protocolo</span>:
                                    </p>
                                    <ul className="space-y-2 text-sm text-slate-700">
                                        <li className="flex gap-2"><span className="text-amber-600 font-black">•</span><span>Las cuidadoras pierden el grid rápido de rotación postural en el tablet.</span></li>
                                        <li className="flex gap-2"><span className="text-amber-600 font-black">•</span><span>El sistema deja de enviar alertas de rotación vencida específicamente por esta marca.</span></li>
                                    </ul>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 font-medium leading-relaxed">
                                        <span className="font-black text-slate-700">Nota:</span> si este residente está marcado con riesgo Norton positivo o tiene una úlcera activa, sigue apareciendo en el dashboard del enfermero y siendo monitoreado por el cron <span className="font-bold">por esas señales</span> — la suspensión solo retira la marca de encamado.
                                    </div>
                                </>
                            )}

                            <label className="flex items-start gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 cursor-pointer hover:border-slate-300">
                                <input
                                    type="checkbox"
                                    checked={protocolConfirmCheck}
                                    onChange={(e) => setProtocolConfirmCheck(e.target.checked)}
                                    disabled={protocolSubmitting}
                                    className="mt-0.5 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-slate-800 leading-snug">
                                    Entiendo el cambio de protocolo y autorizo {requiresPostural ? 'suspenderlo' : 'activarlo'}.
                                </span>
                            </label>

                            {protocolError && (
                                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700">
                                    {protocolError}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setProtocolModalOpen(false)}
                                disabled={protocolSubmitting}
                                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitProtocolToggle}
                                disabled={!protocolConfirmCheck || protocolSubmitting}
                                className={`px-5 py-2 text-sm font-black uppercase tracking-wider rounded-xl shadow-sm active:scale-95 transition-all ${
                                    !protocolConfirmCheck || protocolSubmitting
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : requiresPostural
                                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                                }`}
                            >
                                {protocolSubmitting
                                    ? 'Procesando...'
                                    : requiresPostural ? 'Suspender protocolo' : 'Activar protocolo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

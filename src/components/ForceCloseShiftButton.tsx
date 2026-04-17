"use client";

import { useState } from "react";
import { XCircle, Loader2, AlertTriangle, Clock } from "lucide-react";

interface Props {
    shiftSessionId: string;
    caregiverName: string;
    hoursOpen: number;
    /** "zombie" = >12h rojo | "active" = <12h amber */
    variant?: "zombie" | "active";
    onClosed?: () => void;
}

export default function ForceCloseShiftButton({
    shiftSessionId,
    caregiverName,
    hoursOpen,
    variant = "zombie",
    onClosed,
}: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

    const isZombie = variant === "zombie";
    const btnClass = isZombie
        ? "bg-rose-600 hover:bg-rose-700 text-white"
        : "bg-amber-500 hover:bg-amber-600 text-white";
    const btnLabel = isZombie ? "Forzar cierre" : "Cerrar turno";

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/shift/force-close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shiftSessionId, reason: reason.trim() || undefined }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: `Sesión de ${caregiverName} cerrada`, type: "ok" });
                setModalOpen(false);
                setReason("");
                setTimeout(() => {
                    setToast(null);
                    onClosed?.();
                }, 1500);
            } else {
                setToast({ msg: data.error || "Error cerrando turno", type: "err" });
                setTimeout(() => setToast(null), 4000);
            }
        } catch (err) {
            setToast({ msg: "Error de conexión", type: "err" });
            setTimeout(() => setToast(null), 4000);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setModalOpen(true)}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${btnClass}`}
                title={btnLabel}
            >
                <XCircle className="w-3.5 h-3.5" /> {btnLabel}
            </button>

            {modalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <div className={`px-6 py-4 flex items-center gap-3 border-b border-slate-100 ${isZombie ? "bg-rose-50" : "bg-amber-50"}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isZombie ? "bg-rose-600 text-white" : "bg-amber-500 text-white"}`}>
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-base">Confirmar cierre de turno</h3>
                                <p className="text-xs font-bold text-slate-500 mt-0.5">Esta acción no se puede deshacer</p>
                            </div>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cuidador</p>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{caregiverName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiempo abierta</p>
                                    <p className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${isZombie ? "text-rose-600" : "text-amber-600"}`}>
                                        <Clock className="w-3.5 h-3.5" /> {hoursOpen.toFixed(1)}h
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                    Razón del cierre (opcional)
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Ej: No se presentó, error de sistema, cuidador ya salió del piso..."
                                    rows={3}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 resize-none"
                                />
                                <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                                    La razón se registrará en el audit log y se notificará al cuidador.
                                </p>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => { setModalOpen(false); setReason(""); }}
                                disabled={submitting}
                                className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={submitting}
                                className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${isZombie ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Cerrando...</>
                                ) : (
                                    <>Confirmar cierre</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`fixed bottom-6 right-6 z-[70] px-5 py-3 rounded-xl shadow-xl border-2 font-bold text-sm animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === "ok" ? "bg-emerald-600 text-white border-emerald-700" : "bg-rose-600 text-white border-rose-700"}`}>
                    {toast.msg}
                </div>
            )}
        </>
    );
}

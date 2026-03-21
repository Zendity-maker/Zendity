"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from 'next/link';

export default function StaffPerformanceProfile({ params }: { params: Promise<{ id: string }> }) {
    const rawParams = use(params);
    const [staff, setStaff] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", email: "", pinCode: "" });
    const [isSaving, setIsSaving] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchStaffProfile = async () => {
            try {
                const res = await fetch(`/api/corporate/hr/staff/${rawParams.id}`);
                const data = await res.json();
                if (data.success) {
                    setStaff(data.staff);
                    setEditForm({ name: data.staff.name, email: data.staff.email, pinCode: data.staff.pinCode || "" });
                }
            } catch (error) {
                console.error("Failed to fetch staff profile", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStaffProfile();
    }, [rawParams.id]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 400;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const base64Photo = canvas.toDataURL("image/jpeg", 0.7);

                    try {
                        const res = await fetch(`/api/corporate/hr/staff/${rawParams.id}/photo`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ photoUrl: base64Photo })
                        });
                        const data = await res.json();
                        if (data.success) {
                            setStaff((prev: any) => ({ ...prev, photoUrl: base64Photo }));
                        } else {
                            alert("Error subiendo foto: " + data.error);
                        }
                    } catch (err) {
                        alert("Error de conexión al subir la foto.");
                    }
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/hr/staff", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: staff.id, name: editForm.name, email: editForm.email, pinCode: editForm.pinCode })
            });
            const data = await res.json();
            if (data.success) {
                setStaff({ ...staff, name: editForm.name, email: editForm.email, pinCode: editForm.pinCode });
                setIsEditing(false);
            } else {
                alert(data.error || "No se pudo actualizar el perfil.");
            }
        } catch (e) {
            alert("Error de conexión intentando guardar el perfil.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleResendWelcome = async () => {
        if (!confirm(`¿Estás seguro de que deseas reenviar el correo de credenciales a ${staff.email}?`)) return;
        setIsResending(true);
        try {
            const res = await fetch(`/api/hr/staff/${staff.id}/welcome`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                alert("✅ Correo de credenciales reenviado exitosamente.");
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            alert("Error de conexión intentando reenviar.");
        } finally {
            setIsResending(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (score >= 75) return "bg-amber-100 text-amber-700 border-amber-200";
        return "bg-rose-100 text-rose-700 border-rose-200";
    };

    const getRoleName = (role: string) => {
        const roles: Record<string, string> = {
            "NURSE": "Enfermera",
            "CAREGIVER": "Cuidadora",
            "DIRECTOR": "Directora",
            "SOCIAL_WORKER": "Trabajo Social",
            "KITCHEN": "Cocina"
        };
        return roles[role] || role;
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
    );

    if (!staff) return (
        <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
            <h1 className="text-3xl font-black text-slate-800">Empleado no encontrado</h1>
            <p className="text-slate-500">El empleado que intentas auditar no existe o ha sido dado de baja permanentemente.</p>
            <Link href="/corporate/hr" className="inline-block mt-4 text-teal-600 font-bold hover:underline">← Volver al Directorio RRHH</Link>
        </div>
    );

    const isMedicalStaff = staff.role === "NURSE" || staff.role === "CAREGIVER";

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
            {/* Nav */}
            <Link href="/corporate/hr" className="inline-flex items-center text-sm font-bold text-slate-400 hover:text-teal-600 transition-colors">
                <span>← Volver al Directorio de RRHH</span>
            </Link>

            {/* Header Profile */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
                {/* Status Indicator */}
                <div className={`absolute top-0 left-0 w-full h-2 ${staff.isActive ? (staff.isShiftBlocked ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-red-500'}`}></div>

                <div 
                    onClick={() => isEditing && fileInputRef.current?.click()}
                    className={`flex-shrink-0 relative group ${isEditing ? 'cursor-pointer' : ''}`}
                >
                    {staff.photoUrl ? (
                        <img className="h-32 w-32 rounded-full border-4 border-slate-50 object-cover shadow-sm" src={staff.photoUrl} alt={staff.name} />
                    ) : (
                        <div className="h-32 w-32 rounded-full bg-slate-100 border-4 border-slate-50 shadow-sm flex items-center justify-center">
                            <span className="text-slate-400 text-4xl font-black uppercase">{staff.name.charAt(0)}</span>
                        </div>
                    )}
                    {isEditing && (
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-bold uppercase tracking-widest text-center px-2">Subir Foto</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-3">
                    {isEditing ? (
                        <div className="space-y-4 max-w-lg bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nombre del Empleado</label>
                                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Correo Electrónico Oficial</label>
                                    <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-300 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">PIN de Acceso</label>
                                    <input type="text" value={editForm.pinCode} onChange={e => setEditForm({...editForm, pinCode: e.target.value})} placeholder="Ej: 1234" className="w-full px-4 py-2 rounded-xl border border-slate-300 font-mono tracking-widest font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none" maxLength={6} />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={() => { setIsEditing(false); setEditForm({ name: staff.name, email: staff.email, pinCode: staff.pinCode || "" }); }} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancelar</button>
                                <button onClick={handleSaveProfile} disabled={isSaving} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
                                    {isSaving ? "Guardando..." : "Guardar Cambios"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <h1 className="text-4xl font-black text-slate-800 tracking-tight">{staff.name}</h1>
                                <button onClick={() => setIsEditing(true)} className="text-xs px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg font-bold transition-colors">
                                    ✏️ Editar
                                </button>
                                <button onClick={handleResendWelcome} disabled={isResending} className="text-xs px-3 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-500 hover:text-emerald-700 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                    {isResending ? "⏳..." : "✉️ Reenviar Credenciales"}
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                                <span className="px-3 py-1 rounded-lg text-sm font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    {getRoleName(staff.role)}
                                </span>
                                {!staff.isActive && (
                                    <span className="px-3 py-1 rounded-lg text-sm font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                                        🛑 BAJA ADMINISTRATIVA
                                    </span>
                                )}
                                {staff.isShiftBlocked && staff.isActive && (
                                    <span className="px-3 py-1 rounded-lg text-sm font-bold bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                                        🔒 Turnos Bloqueados
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-6 text-slate-500 font-medium text-sm mt-3">
                                <span className="flex items-center gap-1.5">📧 {staff.email}</span>
                                <span className="flex items-center gap-1.5">🏢 Sede: {staff.facility}</span>
                            </div>
                        </>
                    )}

                    {staff.blockReason && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                            <span className="text-amber-500 text-xl font-black">!</span>
                            <div>
                                <h4 className="font-bold text-amber-900 text-sm">Motivo de Bloqueo/Baja</h4>
                                <p className="text-amber-700 text-sm mt-0.5">{staff.blockReason}</p>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Global Score Card */}
                <div className="w-full md:w-auto bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Desempeño Consolidado</p>
                    <div className={`text-5xl font-black mb-1 ${getScoreColor(staff.performanceScore).split(' ')[1]}`}>
                        {staff.performanceScore}
                    </div>
                    <p className="text-sm font-bold text-slate-500 mt-1">Suma de Academia + Clínico</p>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Evaluaciones Clínicas Metric */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Evaluaciones (HR)</h3>
                            <div className="text-3xl font-black text-slate-800">
                                {staff.avgEvalScore || 'N/A'}<span className="text-lg text-slate-400">/100</span>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-500 rounded-xl rounded-tr-sm">📋</div>
                    </div>
                    <div className="mt-4 text-sm font-medium text-slate-500">
                        Promedio de <span className="font-bold text-slate-700">{staff.evaluationsCount}</span> inspecciones
                    </div>
                </div>

                {/* Academy Metric */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Compliance Academy</h3>
                            <div className="text-3xl font-black text-slate-800">
                                {staff.complianceScore}<span className="text-lg text-slate-400">/100</span>
                            </div>
                        </div>
                        <div className="p-3 bg-violet-50 text-violet-500 rounded-xl rounded-tr-sm">🎓</div>
                    </div>
                    <div className="mt-4 text-sm font-medium text-slate-500">
                        Cursos completados: <span className="font-bold text-slate-700">{staff.courseEnrolls?.filter((c: any) => c.status === 'COMPLETED').length || 0}</span>
                    </div>
                </div>

                {/* Clinical eMAR Metric (Only Nurse/Caregiver) */}
                 <div className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm ${!isMedicalStaff ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Cumplimiento eMAR</h3>
                            <div className="flex items-baseline gap-1">
                                <div className="text-3xl font-black text-slate-800">
                                    {staff.emarCompliance !== null ? staff.emarCompliance : 'N/A'}<span className="text-lg text-slate-400">%</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl rounded-tr-sm">💊</div>
                    </div>
                    <div className="mt-4 text-sm font-medium text-slate-500 flex justify-between">
                        <span>Exitosas: <span className="font-bold text-emerald-600">{staff.medsGivenRecord || 0}</span></span>
                        <span>Omitidas: <span className="font-bold text-rose-600">{staff.medsMissedRecord || 0}</span></span>
                    </div>
                    {!isMedicalStaff && <p className="text-xs text-slate-400 mt-2 italic">*Métrica exclusiva del área clínica.</p>}
                </div>
            </div>

            {/* Evaluaciones Historial */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-lg font-black text-slate-800">Historial de Evaluaciones HR</h3>
                </div>
                
                {staff.evalsReceived?.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <p className="text-5xl mb-3 border border-slate-100 inline-block p-4 rounded-3xl bg-slate-50">📋</p>
                        <h4 className="font-bold text-lg text-slate-600">Sin Historico</h4>
                        <p className="text-sm mt-1">Este empleado aún no cuenta con evaluaciones u observaciones estructuradas del gerente.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {staff.evalsReceived?.map((eva: any) => (
                            <div key={eva.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1.5 rounded-lg border font-black text-sm flex items-center gap-1.5 ${getScoreColor(eva.score)}`}>
                                            {eva.score} / 100
                                        </div>
                                        <span className="text-sm font-medium text-slate-500">
                                            {new Date(eva.createdAt).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Por ID: {eva.evaluatorId.substring(0,8)}...
                                    </div>
                                </div>
                                
                                {eva.feedback && (
                                    <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 italic border border-slate-100">
                                        "{eva.feedback}"
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

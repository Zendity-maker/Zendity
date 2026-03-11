"use client";

import { useState, useEffect } from "react";
import { FaUserPlus, FaTrashAlt, FaKey, FaEnvelope, FaUserTag, FaUserCircle } from "react-icons/fa";

export default function PatientFamilyTab({ patientId }: { patientId: string }) {
    const [familyMembers, setFamilyMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [passcode, setPasscode] = useState("");
    const [accessLevel, setAccessLevel] = useState("Full");

    useEffect(() => {
        fetchFamilyMembers();
    }, [patientId]);

    const fetchFamilyMembers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/family`);
            const data = await res.json();
            if (data.success) {
                setFamilyMembers(data.familyMembers);
            }
        } catch (error) {
            console.error("Error fetching family members", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFamilyMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/family`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, passcode, accessLevel })
            });
            const data = await res.json();

            if (data.success) {
                alert("Familiar asignado correctamente. Ya puede acceder al Portal.");
                // Reset form
                setName("");
                setEmail("");
                setPasscode("");
                setAccessLevel("Full");
                // Refresh list
                fetchFamilyMembers();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Error creating family member", error);
            alert("Error de conexión interno.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevokeAccess = async (familyMemberId: string) => {
        if (!confirm("¿Estás seguro de que deseas revocar el acceso a este familiar? No podrá ingresar al Portal Familiar.")) return;

        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/family?familyMemberId=${familyMemberId}`, {
                method: "DELETE"
            });
            const data = await res.json();

            if (data.success) {
                alert("Acceso revocado exitosamente.");
                fetchFamilyMembers();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Error revoking access", error);
            alert("Error de conexión interno.");
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col xl:flex-row gap-8">

                {/* Directorio de Accesos - Lado Izquierdo */}
                <div className="flex-1 space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FaUserCircle className="text-teal-500" />
                            Familiares Autorizados
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Personas con acceso activo al expediente de este residente a través del Portal Familiar.
                        </p>
                    </div>

                    {loading ? (
                        <div className="animate-pulse flex flex-col gap-4">
                            {[1, 2].map(i => (
                                <div key={i} className="h-20 bg-slate-50 rounded-xl border border-slate-100 w-full"></div>
                            ))}
                        </div>
                    ) : familyMembers.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {familyMembers.map((member) => (
                                <div key={member.id} className="relative bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
                                    <div className="flex-1 pl-2">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 text-lg">{member.name}</h3>
                                            <span className="bg-teal-50 text-teal-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-teal-100">
                                                {member.accessLevel || 'Full Access'}
                                            </span>
                                        </div>
                                        <div className="mt-2 space-y-1.5">
                                            <p className="text-sm text-slate-500 flex items-center gap-2 font-medium">
                                                <FaEnvelope className="text-slate-400" /> {member.email}
                                            </p>
                                            <p className="text-sm text-slate-500 flex items-center gap-2 font-medium">
                                                <FaKey className="text-slate-400" /> PIN de Acceso: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 tracking-[0.2em]">{member.passcode || '******'}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRevokeAccess(member.id)}
                                        className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-500 hover:text-white px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 border border-rose-100 w-full sm:w-auto justify-center shadow-sm"
                                        title="Revocar Acceso"
                                    >
                                        <FaTrashAlt /> Revocar
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-xl p-8 border border-dashed border-slate-300 text-center">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                                <FaUserPlus className="text-slate-300 text-2xl" />
                            </div>
                            <h4 className="font-bold text-slate-700 text-lg mb-1">Sin Familiares Asignados</h4>
                            <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                No hay cuentas de familiares activas para este residente. Registra a un familiar en el panel lateral para otorgarle acceso al portal.
                            </p>
                        </div>
                    )}
                </div>

                {/* Formulario de Registro - Lado Derecho */}
                <div className="w-full xl:w-96 flex-shrink-0">
                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-teal-100/50 rounded-full blur-3xl pointer-events-none"></div>

                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
                            <div className="bg-teal-100 text-teal-600 p-2 rounded-lg">
                                <FaUserPlus />
                            </div>
                            Nuevo Acceso Familiar
                        </h3>

                        <form onSubmit={handleCreateFamilyMember} className="space-y-5 relative z-10">
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nombre Completo</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <FaUserTag className="text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl pl-10 p-3.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-slate-400 shadow-sm font-medium"
                                        placeholder="Ej. María Pérez"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email de Acceso (Usuario)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <FaEnvelope className="text-slate-400" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl pl-10 p-3.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-slate-400 shadow-sm font-medium"
                                        placeholder="maria@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">PIN Numérico (Contraseña)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <FaKey className="text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        minLength={4}
                                        maxLength={6}
                                        pattern="[0-9]*"
                                        value={passcode}
                                        onChange={(e) => setPasscode(e.target.value.replace(/[^0-9]/g, ''))}
                                        className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl pl-10 p-3.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-slate-400 shadow-sm font-mono tracking-[0.3em] font-black text-lg"
                                        placeholder="123456"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-2 leading-relaxed">
                                    El familiar usará su <span className="text-slate-700 font-bold">Email</span> y este <span className="text-slate-700 font-bold">PIN</span> para iniciar sesión en el portal desde /login.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(13,148,136,0.39)] hover:shadow-[0_6px_20px_rgba(13,148,136,0.23)] hover:-translate-y-0.5 transition-all duration-200 mt-4 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {isSubmitting ? 'Asignando...' : 'Otorgar Acceso al Portal'}
                            </button>
                        </form>
                    </div>
                </div>

            </div>
        </div>
    );
}

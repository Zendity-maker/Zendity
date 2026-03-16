"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";

interface EditRolesProps {
    employee: {
        id: string;
        name: string;
        role: string;
        secondaryRoles: string[];
    };
    onUpdate: (updatedData: any) => void;
}

export default function EditStaffRolesModal({ employee, onUpdate }: EditRolesProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [role, setRole] = useState(employee.role);
    const [secondaryRoles, setSecondaryRoles] = useState<string[]>(employee.secondaryRoles || []);

    const toggleSecondaryRole = (r: string) => {
        setSecondaryRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/hr/staff', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: employee.id, role, secondaryRoles })
            });

            const data = await res.json();
            if (data.success) {
                setIsOpen(false);
                onUpdate({ role, secondaryRoles });
                router.refresh();
            } else {
                alert(data.error || "Fallo al actualizar roles.");
            }
        } catch (err) {
            alert("Error de red.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95 transition-all text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 border border-slate-200"
            >
                <UserCog className="w-3.5 h-3.5" /> Doble Rol / Puestos
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg"><UserCog className="w-5 h-5" /></span>
                                Permisos y Puestos
                            </h2>
                            <p className="text-slate-500 text-sm mt-1 font-medium">
                                Editando los roles operativos de {employee.name}.
                            </p>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Rol Principal</label>
                                    <select
                                        value={role}
                                        onChange={e => setRole(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3 text-slate-800 outline-none font-bold transition-all shadow-sm cursor-pointer"
                                    >
                                        <option value="CAREGIVER">Cuidador(a)</option>
                                        <option value="NURSE">Enfermería</option>
                                        <option value="SOCIAL_WORKER">Trabajo Social</option>
                                        <option value="THERAPIST">Terapeuta</option>
                                        <option value="BEAUTY_SPECIALIST">Especialista (Belleza)</option>
                                        <option value="SUPERVISOR">Supervisor(a)</option>
                                        <option value="DIRECTOR">Director Ejecutivo</option>
                                        <option value="ADMIN">Administrador de Red</option>
                                        <option value="INVESTOR">Socio / Inversor</option>
                                        <option value="KITCHEN">Cocina y Nutrición</option>
                                        <option value="MAINTENANCE">Mantenimiento</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-indigo-500 uppercase tracking-widest mb-2 ml-1">Doble Rol (+ Puestos Adicionales)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'CAREGIVER', label: 'Cuidador(a)' },
                                            { id: 'NURSE', label: 'Enfermería' },
                                            { id: 'KITCHEN', label: 'Cocina' },
                                            { id: 'MAINTENANCE', label: 'Mantenimiento' },
                                            { id: 'SOCIAL_WORKER', label: 'Social' },
                                            { id: 'SUPERVISOR', label: 'Supervisor' }
                                        ].map(r => (
                                            <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => toggleSecondaryRole(r.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${secondaryRoles.includes(r.id) ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {secondaryRoles.includes(r.id) && '✓ '} {r.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2 ml-1">Selecciona uno o más permisos para extender sus accesos.</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[15px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Guardando cambios...' : 'Confirmar Puestos'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

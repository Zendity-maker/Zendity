"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { ETIQUETA_ROL, rolesOtorgablesPor } from "@/lib/roles-otorgables";

/**
 * Las listas de roles ya no viven aquí: están en `src/lib/roles-otorgables.ts`,
 * una sola vez para la ruta que valida y las tres pantallas que ofrecen. Se
 * reexportan para no romper a quien ya importaba de este módulo.
 */
export {
    ROLES_DE_PISO, ROLES_DE_MANDO, ETIQUETA_ROL, etiquetaDeRol,
    esDireccion, rolesOtorgablesPor,
} from '@/lib/roles-otorgables';
export type { RolOtorgable } from '@/lib/roles-otorgables';

/**
 * Lee el cuerpo sin asumir que hay JSON. Un 405 o un error del borde devuelven
 * cuerpo vacío o HTML, y `res.json()` revienta: sin esto el fallo caía al catch
 * y se anunciaba como "error de conexión", que manda a mirar el wifi en vez de
 * al servidor.
 */
export async function leerRespuesta(res: Response): Promise<any> {
    try {
        return await res.json();
    } catch {
        return { success: false, error: `El servidor respondió ${res.status} sin detalle.` };
    }
}

export default function AddStaffModal() {
    const router = useRouter();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Lo que ESTA persona puede repartir. RRHH ve los ocho de piso; Dirección
    // ve además SUPERVISOR, COORDINATOR y HR_MANAGER.
    const otorgables = rolesOtorgablesPor(user);

    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("CAREGIVER");
    const [secondaryRoles, setSecondaryRoles] = useState<string[]>([]);
    const [pinCode, setPinCode] = useState("");

    const toggleSecondaryRole = (r: string) => {
        setSecondaryRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/hr/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, role, secondaryRoles, pinCode })
            });

            const data = await leerRespuesta(res);
            if (data.success) {
                setIsOpen(false);
                // Reset form
                setName(""); setEmail(""); setRole("CAREGIVER"); setSecondaryRoles([]); setPinCode("");
                router.refresh();
            } else {
                // `data.error` es el texto del servidor —el 403 de rol dice
                // exactamente qué puedes asignar tú—. El fallback solo cubre un
                // cuerpo sin mensaje: una pantalla que recibe un error y no dice
                // nada es peor que el error.
                setError(data.error || `No se pudo registrar al empleado (${res.status}).`);
            }
        } catch (err) {
            setError("Error de conexión al portal administrativo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="bg-teal-600 hover:bg-teal-700 active:scale-95 transition-all text-white text-sm font-black py-2.5 px-5 rounded-xl shadow-[0_0_15px_rgba(20,184,166,0.2)] flex items-center gap-2"
            >
                <UserPlus className="w-4 h-4" /> Registrar Empleado
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span className="p-1.5 bg-teal-100 text-teal-700 rounded-lg"><UserPlus className="w-5 h-5" /></span>
                                Contratación de Personal
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                El empleado recibirá acceso al entorno clínico B2B de esta sede corporativa.
                            </p>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors font-bold"
                            >

                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6 pb-8">
                            {error && (
                                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 font-bold text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl p-3 text-slate-800 outline-none font-semibold transition-all shadow-sm"
                                        placeholder="Ej. María Gonzales"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Correo Electrónico (Login)</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl p-3 text-slate-800 outline-none font-semibold transition-all shadow-sm"
                                        placeholder="maria@vividsenior.com"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Rol Operativo Principal</label>
                                        <select
                                            value={role}
                                            onChange={e => setRole(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl p-3 text-slate-800 outline-none font-bold transition-all shadow-sm cursor-pointer"
                                        >
                                            {otorgables.map(r => (
                                                <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-indigo-500 uppercase tracking-widest mb-1.5 ml-1">PIN Clínico (iPads)</label>
                                        <input
                                            type="text"
                                            required
                                            value={pinCode}
                                            onChange={e => setPinCode(e.target.value)}
                                            className="w-full bg-indigo-50/50 border-2 border-indigo-100 focus:border-indigo-400 focus:bg-white rounded-xl p-3 text-indigo-700 outline-none font-mono tracking-widest font-black text-lg transition-all shadow-sm"
                                            placeholder="1234"
                                            maxLength={6}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1 ml-1 font-semibold leading-tight">Clave numérica para firmas biométricas rápidas.</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-indigo-500 uppercase tracking-widest mb-2 ml-1">Doble Rol (Accesos Simultáneos)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {otorgables.map(r => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => toggleSecondaryRole(r)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${secondaryRoles.includes(r) ? 'bg-teal-50 text-teal-700 border-teal-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {secondaryRoles.includes(r) && ' '} {ETIQUETA_ROL[r]}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 mt-2 ml-1">
                                        Dirección y los accesos corporativos (socios, red) no se otorgan desde aquí: se crean fuera de la app.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-4 py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[15px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Creando identidad...' : 'Registrar Staff en la Institución'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

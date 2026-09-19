"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ETIQUETA_ROL, esDireccion, etiquetaDeRol, rolesOtorgablesPor } from "@/lib/roles-otorgables";
import { leerRespuesta } from "@/app/hr/staff/AddStaffModal";

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
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [role, setRole] = useState(employee.role);
    const [secondaryRoles, setSecondaryRoles] = useState<string[]>(employee.secondaryRoles || []);

    // La misma lista blanca que aplica el servidor, resuelta por el rol de
    // quien mira (principal Y secundario). Ver src/lib/roles-otorgables.ts.
    const otorgables = rolesOtorgablesPor(user);

    /**
     * ROLES DE ESTA CUENTA QUE YO NO REPARTO.
     *
     * Este formulario manda SIEMPRE `role` y `secondaryRoles` completos, y el
     * servidor valida TODO lo que llega, no solo lo que cambió
     * (`rolesNoOtorgables`, route.ts:71): si al guardar sale un DIRECTOR en el
     * cuerpo, es 403 aunque ya lo tuviera antes.
     *
     * Pero el servidor corta en DOS sitios distintos y no son el mismo corte:
     *
     *  · La lista blanca (route.ts:71) mira lo que MANDAS. Cambiar un DIRECTOR
     *    a CAREGIVER manda 'CAREGIVER' — y eso SÍ pasa.
     *  · La guarda de cuenta objetivo (route.ts:466) mira lo que la cuenta YA
     *    TIENE, y solo se aplica `if (!esDireccion(auth))`.
     *
     * O sea: a RRHH la cuenta ajena le está vedada entera, pero Dirección sí
     * puede bajar de puesto a un DIRECTOR o a un socio, y podía hacerlo hasta
     * hoy desde esta misma pantalla. Cerrárselo aquí sería quitarle un botón
     * que usa por arreglar un permiso de otra persona.
     */
    const esOtorgable = (r: string) => otorgables.includes(r as any);
    const rolesDelEmpleado = [employee.role, ...(employee.secondaryRoles || [])];
    const fueraDeMiAlcance = [...new Set(
        rolesDelEmpleado.filter(r => r && !esOtorgable(r)),
    )];
    const soyDireccion = esDireccion(user);
    /** RRHH: cuenta ajena, ni se ofrece. Dirección: se ofrece, avisando. */
    const puedoEditar = soyDireccion || fueraDeMiAlcance.length === 0;
    /** Dirección bajando de puesto a alguien: el puesto viejo NO se conserva. */
    const degradando = puedoEditar && fueraDeMiAlcance.length > 0;

    const toggleSecondaryRole = (r: string) => {
        setSecondaryRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
    };

    const abrir = () => {
        // Al reabrir, partir de lo que hay guardado: si el intento anterior
        // falló, el estado se quedaba con la selección rechazada.
        //
        // Con una salvedad: lo que no se puede otorgar tampoco puede quedarse
        // en el estado, porque el formulario lo reenviaría tal cual y sería un
        // 403 seguro. El principal se deja VACÍO a propósito —no se autorrellena
        // con el primero de la lista— para que degradar a alguien sea siempre
        // una elección escrita, nunca lo que pasó por no tocar nada.
        setRole(esOtorgable(employee.role) ? employee.role : '');
        setSecondaryRoles((employee.secondaryRoles || []).filter(esOtorgable));
        setError(null);
        setIsOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/hr/staff', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: employee.id, role, secondaryRoles })
            });

            const data = await leerRespuesta(res);
            if (data.success) {
                setIsOpen(false);
                onUpdate({ role, secondaryRoles });
                router.refresh();
            } else {
                // Banner dentro del modal en vez de `alert()`: el alert se cierra
                // y el texto del servidor —que dice exactamente qué SÍ puedes
                // asignar— se pierde antes de poder corregir el formulario.
                setError(data.error || `No se pudieron actualizar los roles (${res.status}).`);
            }
        } catch (err) {
            setError("Error de red: no se guardó ningún cambio.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={abrir}
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

                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6">
                            {error && (
                                <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 font-bold text-sm text-center">
                                    {error}
                                </div>
                            )}

                            {!puedoEditar ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                                        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="text-sm text-amber-900 font-semibold leading-relaxed">
                                            <p className="font-black mb-1">Esta cuenta no la gestionas tú.</p>
                                            <p>
                                                {employee.name} tiene el puesto de{' '}
                                                <strong>{fueraDeMiAlcance.map(etiquetaDeRol).join(', ')}</strong>,
                                                que no está entre los que tú repartes. Pídeselo a Dirección
                                                — es el mismo corte que aplica el servidor.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-xl transition-all"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {degradando && (
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                                            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                            <div className="text-sm text-amber-900 font-semibold leading-relaxed">
                                                <p className="font-black mb-1">Vas a quitarle un puesto que no se puede devolver desde aquí.</p>
                                                <p>
                                                    {employee.name} es{' '}
                                                    <strong>{fueraDeMiAlcance.map(etiquetaDeRol).join(', ')}</strong>.
                                                    Ese puesto no se otorga desde esta pantalla, así que si guardas
                                                    lo PIERDE y queda solo con lo que escojas abajo. Para
                                                    devolvérselo hará falta hacerlo fuera de la app.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Rol Principal</label>
                                        <select
                                            value={role}
                                            onChange={e => setRole(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3 text-slate-800 outline-none font-bold transition-all shadow-sm cursor-pointer"
                                        >
                                            {/* Solo cuando el puesto actual no está en la lista: un select
                                                con un `value` que no es ninguna de sus opciones se pinta en
                                                blanco y el primero de la lista se guardaría por accidente. */}
                                            {!role && <option value="" disabled>— Escoge el puesto nuevo —</option>}
                                            {otorgables.map(r => (
                                                <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-indigo-500 uppercase tracking-widest mb-2 ml-1">Doble Rol (+ Puestos Adicionales)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {otorgables.map(r => (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => toggleSecondaryRole(r)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${secondaryRoles.includes(r) ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                                >
                                                    {secondaryRoles.includes(r) && ' '} {ETIQUETA_ROL[r]}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 mt-2 ml-1">Selecciona uno o más permisos para extender sus accesos.</p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !role}
                                        className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[15px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? 'Guardando cambios...' : !role ? 'Escoge un puesto' : 'Confirmar Puestos'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

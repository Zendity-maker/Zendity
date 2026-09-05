"use client";

/**
 * ACCESO DE VISITAS DE UN RESIDENTE
 * ─────────────────────────────────
 * Las dos listas y el interruptor de modo estricto. Vive junto al portal
 * familiar porque es donde se mira cuando pasa algo en recepción.
 *
 * Solo DIRECTOR y ADMIN pueden cambiar nada — detrás de "esta persona no
 * entra" suele haber una orden judicial, no una preferencia operativa.
 * Enfermería, supervisión y trabajo social LEEN, porque a ellos les llega el
 * aviso a la tablet y necesitan saber qué mirar.
 *
 * Nada se borra: se revoca. En seis meses alguien va a preguntar quién lo
 * decidió, y "ya no está en la lista" no es una respuesta.
 */
import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, ShieldX, Plus, Loader2, X, Lock, Unlock } from "lucide-react";

interface Entrada {
    id: string;
    tipo: string;
    nombre: string;
    relacion: string | null;
    telefono: string | null;
    notas: string | null;
    createdAt: string;
}

export default function AccesoVisitasCard({ patientId, patientName }: { patientId: string; patientName?: string }) {
    const [cargando, setCargando] = useState(true);
    const [estricto, setEstricto] = useState(false);
    const [motivo, setMotivo] = useState<string | null>(null);
    const [autorizados, setAutorizados] = useState<Entrada[]>([]);
    const [noAutorizados, setNoAutorizados] = useState<Entrada[]>([]);
    const [puedeEditar, setPuedeEditar] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [modal, setModal] = useState<null | 'AUTORIZADO' | 'NO_AUTORIZADO'>(null);
    const [form, setForm] = useState({ nombre: '', relacion: '', telefono: '', notas: '' });

    const cargar = useCallback(async () => {
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/acceso-visitas`);
            const d = await res.json();
            if (!d.success) { setError(d.error || 'No se pudo cargar'); return; }
            setEstricto(d.estricto);
            setMotivo(d.motivo);
            setAutorizados(d.autorizados ?? []);
            setNoAutorizados(d.noAutorizados ?? []);
            setPuedeEditar(d.puedeEditar);
            setError(null);
        } catch {
            setError('Error de red');
        } finally {
            setCargando(false);
        }
    }, [patientId]);

    useEffect(() => { cargar(); }, [cargar]);

    const anadir = async () => {
        if (!form.nombre.trim() || !modal || guardando) return;
        setGuardando(true); setError(null);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/acceso-visitas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, tipo: modal }),
            });
            const d = await res.json();
            if (!d.success) { setError(d.error); return; }
            setModal(null);
            setForm({ nombre: '', relacion: '', telefono: '', notas: '' });
            await cargar();
        } finally { setGuardando(false); }
    };

    const revocar = async (entradaId: string, nombre: string) => {
        if (!confirm(`¿Quitar a ${nombre} de la lista?\n\nQueda registrado quién lo hizo y cuándo.`)) return;
        setGuardando(true); setError(null);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/acceso-visitas`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'REVOCAR', entradaId }),
            });
            const d = await res.json();
            if (!d.success) setError(d.error);
            await cargar();
        } finally { setGuardando(false); }
    };

    const cambiarEstricto = async (activo: boolean) => {
        setGuardando(true); setError(null);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/acceso-visitas`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'ESTRICTO',
                    activo,
                    motivo: activo ? (prompt('¿Por qué se restringen las visitas? (queda en el expediente)') ?? '') : '',
                }),
            });
            const d = await res.json();
            if (!d.success) { setError(d.error); return; }
            await cargar();
        } finally { setGuardando(false); }
    };

    if (cargando) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex items-center gap-3 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando acceso de visitas…
            </div>
        );
    }

    const Lista = ({ titulo, ayuda, entradas, tipo, tono }: {
        titulo: string; ayuda: string; entradas: Entrada[]; tipo: 'AUTORIZADO' | 'NO_AUTORIZADO'; tono: 'ok' | 'veto';
    }) => (
        <div>
            <div className="flex items-start justify-between gap-3 mb-1">
                <h4 className={`font-black text-sm uppercase tracking-wider flex items-center gap-1.5 ${tono === 'ok' ? 'text-teal-700' : 'text-rose-700'}`}>
                    {tono === 'ok' ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                    {titulo}
                </h4>
                {puedeEditar && (
                    <button
                        onClick={() => { setForm({ nombre: '', relacion: '', telefono: '', notas: '' }); setModal(tipo); }}
                        className="shrink-0 flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-50 transition-colors"
                    >
                        <Plus className="w-3 h-3" /> Añadir
                    </button>
                )}
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">{ayuda}</p>
            {entradas.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-3">Nadie en esta lista.</p>
            ) : (
                <ul className="space-y-2">
                    {entradas.map(e => (
                        <li key={e.id} className={`rounded-xl border p-3 ${tono === 'ok' ? 'border-teal-100 bg-teal-50/40' : 'border-rose-100 bg-rose-50/40'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate">{e.nombre}</p>
                                    <p className="text-xs text-slate-500">
                                        {[e.relacion, e.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                                    </p>
                                    {e.notas && <p className="text-xs text-slate-600 mt-1 italic">{e.notas}</p>}
                                </div>
                                {puedeEditar && (
                                    <button
                                        onClick={() => revocar(e.id, e.nombre)}
                                        disabled={guardando}
                                        className="shrink-0 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-40"
                                        title="Quitar de la lista"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="border-b border-slate-100 pb-5 mb-6">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    {estricto ? <Lock className="w-6 h-6 text-rose-600" /> : <Unlock className="w-6 h-6 text-teal-600" />}
                    Acceso de visitas
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                    El kiosco de recepción consulta esto antes de registrar una visita
                    {patientName ? <> a <strong>{patientName}</strong></> : null}. Cuando alguien queda en espera,
                    la tablet solo le pide esperar — nunca le dice que no está autorizado.
                </p>
            </div>

            {error && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {error}
                </div>
            )}

            {/* Interruptor de modo estricto */}
            <div className={`rounded-2xl border p-5 mb-6 ${estricto ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="font-bold text-slate-800">
                            {estricto ? 'Modo estricto activo' : 'Modo estricto apagado'}
                        </p>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                            {estricto
                                ? 'Solo las personas de la lista de autorizados pueden visitar. Cualquier otra queda esperando en recepción.'
                                : 'Visita cualquiera, salvo quien esté en la lista de acceso restringido.'}
                        </p>
                        {estricto && motivo && (
                            <p className="text-sm text-rose-800 mt-2 italic">Motivo: {motivo}</p>
                        )}
                    </div>
                    {puedeEditar && (
                        <button
                            onClick={() => cambiarEstricto(!estricto)}
                            disabled={guardando}
                            className={`shrink-0 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-40 ${
                                estricto
                                    ? 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                                    : 'bg-rose-600 text-white hover:bg-rose-700'
                            }`}
                        >
                            {estricto ? 'Apagar' : 'Activar'}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Lista
                    titulo="Autorizados"
                    ayuda="Solo cuenta con el modo estricto activo. Con el modo apagado, esta lista no estorba a nadie."
                    entradas={autorizados}
                    tipo="AUTORIZADO"
                    tono="ok"
                />
                <Lista
                    titulo="Acceso restringido"
                    ayuda="Actúa siempre, con o sin modo estricto. Quien esté aquí queda esperando asistencia en recepción."
                    entradas={noAutorizados}
                    tipo="NO_AUTORIZADO"
                    tono="veto"
                />
            </div>

            {!puedeEditar && (
                <p className="text-xs text-slate-400 mt-6 italic">
                    Solo Dirección y Administración pueden cambiar estas listas.
                </p>
            )}

            {/* Modal de alta */}
            {modal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-black text-slate-800 text-lg">
                                {modal === 'AUTORIZADO' ? 'Añadir a autorizados' : 'Añadir a acceso restringido'}
                            </h3>
                            <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                            {modal === 'AUTORIZADO'
                                ? 'Escriba el nombre como esta persona lo diría en recepción.'
                                : 'Esta persona quedará esperando asistencia cada vez que se presente.'}
                        </p>

                        <div className="space-y-3">
                            <input
                                autoFocus
                                value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Nombre completo"
                                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-teal-500 outline-none"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    value={form.relacion}
                                    onChange={e => setForm({ ...form, relacion: e.target.value })}
                                    placeholder="Relación (hija, amigo…)"
                                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-teal-500 outline-none"
                                />
                                <input
                                    value={form.telefono}
                                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                                    placeholder="Teléfono"
                                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-teal-500 outline-none"
                                />
                            </div>
                            <textarea
                                value={form.notas}
                                onChange={e => setForm({ ...form, notas: e.target.value })}
                                placeholder={modal === 'NO_AUTORIZADO'
                                    ? 'Por qué. Ej: "Orden del tribunal del 12-ago-2026"'
                                    : 'Nota opcional'}
                                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:border-teal-500 outline-none min-h-[70px]"
                            />
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setModal(null)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={anadir}
                                disabled={!form.nombre.trim() || guardando}
                                className={`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-40 ${
                                    modal === 'AUTORIZADO' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                            >
                                {guardando ? 'Guardando…' : 'Añadir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

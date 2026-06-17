"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    Stethoscope, HeartHandshake, ClipboardList, Send, Loader2,
    ArrowLeft, AlertCircle, CheckCircle2,
} from "lucide-react";

/**
 * /coordinator/refer — Form único para referir al equipo.
 *
 * Reusa el endpoint POST /api/coordinator/referral. El coordinador escoge
 * destino (NURSE | SOCIAL_WORKER | ADMIN), residente, descripción y
 * prioridad. El form NO expone PHI más allá del nombre del residente
 * seleccionado.
 */

const HUB_ROLES = ['COORDINATOR', 'ADMIN', 'DIRECTOR', 'NURSE'];

type Target = 'NURSE' | 'SOCIAL_WORKER' | 'ADMIN';
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

const TARGET_OPTIONS: Array<{ key: Target; label: string; help: string; icon: any; accent: string }> = [
    { key: 'NURSE', label: 'Enfermería', help: 'Atención clínica o seguimiento del residente', icon: Stethoscope, accent: 'rose' },
    { key: 'SOCIAL_WORKER', label: 'Trabajo Social', help: 'Gestión psicosocial, beneficios, familia', icon: HeartHandshake, accent: 'violet' },
    { key: 'ADMIN', label: 'Administración', help: 'Gestión operacional / no clínica', icon: ClipboardList, accent: 'teal' },
];

const PRIORITY_OPTIONS: Array<{ key: Priority; label: string }> = [
    { key: 'LOW', label: 'Baja' },
    { key: 'NORMAL', label: 'Normal' },
    { key: 'HIGH', label: 'Alta' },
    { key: 'URGENT', label: 'Urgente' },
];

interface PatientLite {
    id: string;
    name: string;
    roomNumber?: string | null;
}

export default function ReferralPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const allowed = user && (
        HUB_ROLES.includes(user.role || '') ||
        ((user as any).secondaryRoles ?? []).some((r: string) => HUB_ROLES.includes(r))
    );

    const [patients, setPatients] = useState<PatientLite[]>([]);
    const [loadingPatients, setLoadingPatients] = useState(true);
    const [target, setTarget] = useState<Target>('NURSE');
    const [patientId, setPatientId] = useState<string>('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Priority>('NORMAL');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !allowed) router.replace('/');
    }, [authLoading, allowed, router]);

    useEffect(() => {
        if (!allowed) return;
        (async () => {
            setLoadingPatients(true);
            try {
                const r = await fetch('/api/corporate/patients');
                if (r.ok) {
                    const j = await r.json();
                    setPatients((j?.patients || []).map((p: any) => ({ id: p.id, name: p.name, roomNumber: p.roomNumber })));
                }
            } catch (e) {
                console.error('patients fetch', e);
            } finally {
                setLoadingPatients(false);
            }
        })();
    }, [allowed]);

    const submit = async () => {
        setError(null);
        setSuccess(null);
        if (!patientId) { setError('Selecciona un residente'); return; }
        if (description.trim().length < 5) { setError('Describe el motivo (mínimo 5 caracteres)'); return; }

        setSubmitting(true);
        try {
            const r = await fetch('/api/coordinator/referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetRole: target, patientId, description: description.trim(), priority }),
            });
            const j = await r.json();
            if (!r.ok || !j.success) {
                setError(j?.error || 'Error enviando referido');
                return;
            }
            setSuccess(`Referido enviado a ${TARGET_OPTIONS.find(o => o.key === target)?.label}.`);
            setPatientId('');
            setDescription('');
            setPriority('NORMAL');
        } catch (e: any) {
            setError(e?.message || 'Error de red');
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || !user) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
    }
    if (!allowed) return null;

    return (
        <div className="max-w-3xl mx-auto p-6 md:p-10">
            <button onClick={() => router.push('/coordinator')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-teal-700 mb-6">
                <ArrowLeft className="w-4 h-4" /> Volver al hub
            </button>

            <h1 className="text-3xl font-black text-slate-900 mb-2">Referir al equipo</h1>
            <p className="text-sm text-slate-500 mb-8">El referido aparece en la bandeja del rol destino. Mensaje y prioridad llegan también como notificación.</p>

            {/* Destino */}
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">¿A quién va?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {TARGET_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const active = target === opt.key;
                    return (
                        <button
                            key={opt.key}
                            onClick={() => setTarget(opt.key)}
                            className={`text-left rounded-2xl border-2 p-4 transition-all ${
                                active
                                    ? 'border-teal-500 bg-teal-50'
                                    : 'border-slate-200 bg-white hover:border-teal-300'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                                active ? 'bg-teal-600 text-white' : `bg-${opt.accent}-50 text-${opt.accent}-700`
                            }`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <p className="text-sm font-black text-slate-800">{opt.label}</p>
                            <p className="text-xs text-slate-500 mt-1">{opt.help}</p>
                        </button>
                    );
                })}
            </div>

            {/* Residente */}
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">Residente</h3>
            {loadingPatients ? (
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 mb-6 text-sm text-slate-400">Cargando residentes...</div>
            ) : (
                <select
                    value={patientId}
                    onChange={e => setPatientId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 mb-6 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="">— Selecciona un residente —</option>
                    {patients.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.name}{p.roomNumber ? ` · Hab. ${p.roomNumber}` : ''}
                        </option>
                    ))}
                </select>
            )}

            {/* Prioridad */}
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">Prioridad</h3>
            <div className="grid grid-cols-4 gap-2 mb-6">
                {PRIORITY_OPTIONS.map(p => {
                    const active = priority === p.key;
                    return (
                        <button
                            key={p.key}
                            onClick={() => setPriority(p.key)}
                            className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all ${
                                active
                                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                            }`}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>

            {/* Descripción */}
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">Motivo del referido</h3>
            <textarea
                rows={5}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe brevemente qué necesita seguimiento. Sin información clínica sensible si no es necesaria."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 mb-6 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />

            {/* Submit + feedback */}
            {error && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 text-sm text-rose-800">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                </div>
            )}
            {success && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {success}
                </div>
            )}

            <button
                onClick={submit}
                disabled={submitting || !patientId || description.trim().length < 5}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Enviando...' : 'Enviar referido'}
            </button>
        </div>
    );
}

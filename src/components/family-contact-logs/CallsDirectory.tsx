"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Phone, Search } from "lucide-react";

interface PatientRow {
    id:         string;
    name:       string;
    roomNumber: string | null;
}
interface FamilyMember {
    id:           string;
    name:         string;
    phone:        string | null;
    email:        string | null;
    relationship: string | null;
    isPrimary:    boolean;
}

export default function CallsDirectory({
    onStartLog,
}: {
    onStartLog: (patientId: string, familyMemberId?: string) => void;
}) {
    const [patients, setPatients]                 = useState<PatientRow[]>([]);
    const [loading, setLoading]                   = useState(true);
    const [search, setSearch]                     = useState('');
    const [expanded, setExpanded]                 = useState<string | null>(null);
    const [familyByPatient, setFamilyByPatient]   = useState<Record<string, FamilyMember[] | 'loading' | 'error'>>({});

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/corporate/patients');
                const data = await res.json();
                if (data.success) setPatients(data.patients);
            } catch { /* no-op */ }
            finally { setLoading(false); }
        })();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return patients;
        return patients.filter(p => p.name.toLowerCase().includes(q) || (p.roomNumber || '').toLowerCase().includes(q));
    }, [patients, search]);

    const toggle = async (patientId: string) => {
        if (expanded === patientId) { setExpanded(null); return; }
        setExpanded(patientId);
        if (familyByPatient[patientId] && familyByPatient[patientId] !== 'error') return;
        setFamilyByPatient(prev => ({ ...prev, [patientId]: 'loading' }));
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/family`);
            const data = await res.json();
            setFamilyByPatient(prev => ({ ...prev, [patientId]: data.success ? data.familyMembers : 'error' }));
        } catch {
            setFamilyByPatient(prev => ({ ...prev, [patientId]: 'error' }));
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Buscador */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o habitación…"
                    className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                />
            </div>

            {/* Lista */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center shadow-sm">
                    <p className="text-sm text-slate-500">Sin residentes que coincidan.</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
                    {filtered.map(p => {
                        const isOpen = expanded === p.id;
                        const fam = familyByPatient[p.id];
                        return (
                            <div key={p.id}>
                                <button
                                    onClick={() => toggle(p.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                                >
                                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate">{p.name}</p>
                                        {p.roomNumber && <p className="text-[11px] text-slate-400 font-semibold">Hab. {p.roomNumber}</p>}
                                    </div>
                                    <span
                                        onClick={(e) => { e.stopPropagation(); onStartLog(p.id); }}
                                        className="text-[10px] font-black uppercase px-2 py-1 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 cursor-pointer"
                                    >
                                        + Registrar
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="bg-slate-50/60 px-4 py-3 border-t border-slate-100">
                                        {fam === 'loading' ? (
                                            <p className="text-xs text-slate-400">Cargando familiares…</p>
                                        ) : fam === 'error' || !fam ? (
                                            <p className="text-xs text-red-500">No se pudo cargar familiares.</p>
                                        ) : fam.length === 0 ? (
                                            <p className="text-xs text-slate-400">Sin familiares registrados.</p>
                                        ) : (
                                            <ul className="space-y-1.5">
                                                {fam.map(f => (
                                                    <li key={f.id} className="flex items-center gap-2 text-xs bg-white border border-slate-100 rounded-xl px-3 py-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-800 truncate">
                                                                {f.name}
                                                                {f.relationship && <span className="text-slate-400 font-normal"> · {f.relationship}</span>}
                                                                {f.isPrimary && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black uppercase">Principal</span>}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500">
                                                                {f.phone || <span className="italic text-slate-300">sin teléfono</span>}
                                                                {f.email && <span className="text-slate-400"> · {f.email}</span>}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => onStartLog(p.id, f.id)}
                                                            className="flex items-center gap-1 bg-teal-500 hover:bg-teal-600 text-white text-[10px] font-black uppercase px-2 py-1.5 rounded-lg"
                                                        >
                                                            <Phone className="w-3 h-3" />
                                                            Registrar
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

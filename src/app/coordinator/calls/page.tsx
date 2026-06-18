"use client";

import { useState } from "react";
import { Phone, Plus, BookOpen } from "lucide-react";
import NewContactLogModal from "@/components/family-contact-logs/NewContactLogModal";
import ContactLogList from "@/components/family-contact-logs/ContactLogList";
import CallsDirectory from "@/components/family-contact-logs/CallsDirectory";

type View = 'history' | 'directory';

export default function CoordinatorCallsPage() {
    const [view, setView]                       = useState<View>('history');
    const [modalOpen, setModalOpen]             = useState(false);
    const [lockedPatientId, setLockedPatientId] = useState<string | undefined>(undefined);
    const [refreshKey, setRefreshKey]           = useState(0);

    const openModalForPatient = (patientId: string) => {
        setLockedPatientId(patientId);
        setModalOpen(true);
    };
    const openModalBlank = () => {
        setLockedPatientId(undefined);
        setModalOpen(true);
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-teal-500 rounded-2xl flex items-center justify-center shadow-md shadow-teal-200">
                    <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-extrabold text-slate-900 leading-tight">Bitácora de Llamadas</h1>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Registra y consulta contactos con familiares</p>
                </div>
                <button
                    onClick={openModalBlank}
                    className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white font-black text-xs px-3 py-2.5 rounded-2xl shadow-sm transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    <span>Registrar</span>
                </button>
            </div>

            {/* Toggle Historial / Directorio */}
            <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
                <button
                    onClick={() => setView('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        view === 'history' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <BookOpen className="w-3.5 h-3.5" />
                    Historial
                </button>
                <button
                    onClick={() => setView('directory')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        view === 'directory' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Phone className="w-3.5 h-3.5" />
                    Directorio
                </button>
            </div>

            {/* Contenido */}
            {view === 'history' ? (
                <ContactLogList refreshKey={refreshKey} showResidentColumn={true} />
            ) : (
                <CallsDirectory onStartLog={openModalForPatient} />
            )}

            {/* Modal */}
            <NewContactLogModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCreated={() => { setRefreshKey(k => k + 1); setView('history'); }}
                lockedPatientId={lockedPatientId}
            />
        </div>
    );
}

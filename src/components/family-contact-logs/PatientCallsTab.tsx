"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import NewContactLogModal from "./NewContactLogModal";
import ContactLogList from "./ContactLogList";

// Sprint Coordinador Paso 3C (jun-2026): tab "Llamadas" del perfil residente.
// Vive en /corporate/medical/patients/[id]?tab=calls. lockedPatientId queda
// fijo al residente del perfil — no se puede registrar para otro desde aquí.
export default function PatientCallsTab({ patientId }: { patientId: string }) {
    const [modalOpen, setModalOpen]   = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-extrabold text-slate-800">Contactos con familiares</h3>
                    <p className="text-xs text-slate-500">Historial de llamadas, videos y visitas registradas</p>
                </div>
                <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white font-black text-xs px-3 py-2 rounded-2xl shadow-sm transition-all active:scale-95"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar
                </button>
            </div>

            <ContactLogList patientId={patientId} refreshKey={refreshKey} showResidentColumn={false} />

            <NewContactLogModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCreated={() => setRefreshKey(k => k + 1)}
                lockedPatientId={patientId}
            />
        </div>
    );
}

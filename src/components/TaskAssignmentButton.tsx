"use client";

import { useState } from "react";

export default function TaskAssignmentButton({
  user,
  buttonLabel = "Asignar Tarea",
  buttonStyle = "px-5 py-3 font-black bg-white text-indigo-700 rounded-xl shadow-lg border border-indigo-200 hover:scale-105 transition-all flex items-center gap-2",
  activeStaffIds = [],
}: {
  user: any;
  buttonLabel?: string;
  buttonStyle?: string;
  activeStaffIds?: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hubCaregiverId, setHubCaregiverId] = useState("");
  const [hubDescription, setHubDescription] = useState("");
  const [hubCaregiversOnShift, setHubCaregiversOnShift] = useState<any[]>([]);
  const [hubCaregiversOffShift, setHubCaregiversOffShift] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const fetchCaregiversTarget = async () => {
    setLoadingStaff(true);
    try {
      const hqId = user?.hqId || user?.headquartersId || "hq-demo-1";
      const res = await fetch(`/api/corporate/staff/caregivers?hqId=${hqId}`);
      const data = await res.json();

      // New structured response: onShift / offShift arrays
      if (data.onShift && data.offShift) {
        setHubCaregiversOnShift(data.onShift);
        setHubCaregiversOffShift(data.offShift);
      } else if (data.caregivers) {
        // Fallback: old format
        const on = data.caregivers.filter((c: any) => c.isOnShift || activeStaffIds.includes(c.id));
        const off = data.caregivers.filter((c: any) => !c.isOnShift && !activeStaffIds.includes(c.id));
        setHubCaregiversOnShift(on);
        setHubCaregiversOffShift(off);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleOpen = () => {
    setHubCaregiverId("");
    setHubDescription("");
    setHubCaregiversOnShift([]);
    setHubCaregiversOffShift([]);
    fetchCaregiversTarget();
    setIsOpen(true);
  };

  const submitSupervisorFastAction = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/care/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: null,
          assignedToId: hubCaregiverId,
          assignedById: user?.id,
          headquartersId: user?.hqId || user?.headquartersId || "hq-demo-1",
          description: hubDescription,
          type: "FAST_ACTION",
          priority: "HIGH",
          slaMinutes: 15,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Tarea asignada exitosamente con SLA de 15 minutos.");
        setIsOpen(false);
      } else {
        alert("Error al asignar tarea: " + data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión al enviar la orden.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCaregiverCard = (c: any, isOnShift: boolean) => (
    <button
      key={c.id}
      onClick={(e) => { e.stopPropagation(); setHubCaregiverId(c.id); }}
      className={`p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all outline-none ${
        hubCaregiverId === c.id
          ? 'border-indigo-500 bg-white shadow-md ring-2 ring-indigo-500/20'
          : 'border-slate-200 bg-white hover:border-indigo-300 opacity-90'
      }`}
    >
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
        isOnShift
          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
          : 'bg-slate-300'
      }`} />
      <div className="flex-1">
        <p className="font-bold text-slate-800 text-sm leading-tight">{c.name}</p>
        <p className={`text-[10px] uppercase tracking-widest font-bold mt-0.5 ${
          isOnShift ? 'text-emerald-600' : 'text-slate-400'
        }`}>
          {isOnShift ? 'En Turno Activo' : 'Off-shift'}
        </p>
      </div>
    </button>
  );

  return (
    <>
      <button onClick={handleOpen} className={buttonStyle}>
        <span>⚡</span> {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] flex flex-col text-left">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 md:w-12 md:h-12 bg-slate-100 text-slate-500 rounded-full font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors z-20"
            >
              X
            </button>

            <div className="space-y-4 pr-2 pb-4 overflow-y-auto custom-scrollbar flex-1">
              <p className="font-black text-slate-800 uppercase text-lg border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                <span>⚡</span> Asignación de Tarea SLA (15-Min)
              </p>
              <p className="text-slate-500 font-medium text-sm">
                El cuidador seleccionado recibirá la alerta In-App y tendrá 15 minutos exactos para cumplirla o se penalizará su Score de Cumplimiento.
              </p>

              <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200">
                  <label className="text-sm font-bold text-indigo-900 block mb-3">Empleado Destino (Cuidador)</label>

                  {loadingStaff ? (
                    <div className="flex items-center justify-center py-8 text-slate-400 text-sm font-medium gap-2">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                      Cargando equipo...
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                      {/* ON-SHIFT: primero, con header */}
                      {hubCaregiversOnShift.length > 0 && (
                        <>
                          <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            En Turno ({hubCaregiversOnShift.length})
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {hubCaregiversOnShift.map(c => renderCaregiverCard(c, true))}
                          </div>
                        </>
                      )}

                      {/* OFF-SHIFT: después, con header */}
                      {hubCaregiversOffShift.length > 0 && (
                        <>
                          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-2 mt-2">
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            Fuera de Turno ({hubCaregiversOffShift.length})
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {hubCaregiversOffShift.map(c => renderCaregiverCard(c, false))}
                          </div>
                        </>
                      )}

                      {hubCaregiversOnShift.length === 0 && hubCaregiversOffShift.length === 0 && (
                        <p className="text-sm text-slate-400 font-medium py-4 text-center">No se encontraron empleados.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <label className="text-sm font-bold text-slate-500 block mb-2">Mandato u Orden (Obligatorio)</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-slate-800 text-sm h-32 resize-none focus:border-indigo-500 outline-none"
                    placeholder="Ej. Realizar reporte del residente Artemia por cambio de salud..."
                    value={hubDescription}
                    onChange={(e) => setHubDescription(e.target.value)}
                  />
                </div>

                <button
                  onClick={submitSupervisorFastAction}
                  disabled={submitting || !hubCaregiverId || !hubDescription}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-all flex justify-center items-center gap-2"
                >
                  {submitting ? "Despachando..." : "Despachar Asignación (15 minutos reloj)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

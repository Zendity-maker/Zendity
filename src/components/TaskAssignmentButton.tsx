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
  const [hubCaregiversList, setHubCaregiversList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchCaregiversTarget = async () => {
    try {
      const hqId = user?.hqId || user?.headquartersId || "hq-demo-1";
      const res = await fetch(`/api/corporate/staff/caregivers?hqId=${hqId}`);
      const data = await res.json();
      setHubCaregiversList(data.caregivers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpen = () => {
    setHubCaregiverId("");
    setHubDescription("");
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
          patientId: null, // Global task
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
        alert(" Tarea asignada exitosamente con SLA de 15 minutos.");
        setIsOpen(false);
      } else {
        alert(" Error al asignar tarea: " + data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión al enviar la orden.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button onClick={handleOpen} className={buttonStyle}>
        <span></span> {buttonLabel}
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
                <span></span> Asignación de Tarea SLA (15-Min)
              </p>
              <p className="text-slate-500 font-medium text-sm">
                El cuidador seleccionado recibirá la alerta In-App y tendrá 15 minutos exactos para cumplirla o se penalizará su Score de Cumplimiento.
              </p>

              <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200">
                  <label className="text-sm font-bold text-indigo-900 block mb-3">Empleado Destino (Cuidador)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {hubCaregiversList
                      .sort((a, b) => {
                          const aActive = activeStaffIds.includes(a.id);
                          const bActive = activeStaffIds.includes(b.id);
                          if (aActive && !bActive) return -1;
                          if (!aActive && bActive) return 1;
                          return a.name.localeCompare(b.name);
                      })
                      .map((c) => {
                        const isActive = activeStaffIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={(e) => { e.stopPropagation(); setHubCaregiverId(c.id); }}
                            className={`p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all outline-none ${hubCaregiverId === c.id ? 'border-indigo-500 bg-white shadow-md ring-2 ring-indigo-500/20' : 'border-slate-200 bg-white hover:border-indigo-300 opacity-90'}`}
                          >
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-slate-300'}`}></div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-800 text-sm leading-tight">{c.name}</p>
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-0.5">{isActive ? 'En Turno Físico' : 'Off-shift'}</p>
                            </div>
                          </button>
                        );
                    })}
                  </div>
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

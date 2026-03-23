"use client";

import { useState } from "react";

export default function TaskAssignmentButton({
  user,
  buttonLabel = "Asignar Tarea",
  buttonStyle = "px-5 py-3 font-black bg-white text-indigo-700 rounded-xl shadow-lg border border-indigo-200 hover:scale-105 transition-all flex items-center gap-2",
}: {
  user: any;
  buttonLabel?: string;
  buttonStyle?: string;
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
        alert("🎯 Tarea asignada exitosamente con SLA de 15 minutos.");
        setIsOpen(false);
      } else {
        alert("⚠️ Error al asignar tarea: " + data.error);
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
        <span>🎯</span> {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] flex flex-col text-left">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 md:w-12 md:h-12 bg-slate-100 text-slate-500 rounded-full font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors z-20"
            >
              X
            </button>

            <div className="space-y-4 pr-2 pb-4 overflow-y-auto custom-scrollbar flex-1">
              <p className="font-black text-slate-800 uppercase text-lg border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                <span>🎯</span> Asignación de Tarea SLA (15-Min)
              </p>
              <p className="text-slate-500 font-medium text-sm">
                El cuidador seleccionado recibirá la alerta In-App y tendrá 15 minutos exactos para cumplirla o se penalizará su Score de Cumplimiento.
              </p>

              <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200">
                  <label className="text-sm font-bold text-indigo-900 block mb-2">Empleado Destino (Cuidador)</label>
                  <select
                    value={hubCaregiverId}
                    onChange={(e) => setHubCaregiverId(e.target.value)}
                    className="w-full p-4 rounded-xl border-2 border-indigo-200 bg-white font-bold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Seleccionar Personal Activo --</option>
                    {hubCaregiversList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.role})
                      </option>
                    ))}
                  </select>
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

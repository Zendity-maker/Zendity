import React from "react";
import { getGlobalDashboardMetrics } from "@/actions/hq/dashboard.actions";
import { startImpersonation } from "@/actions/audit/impersonate.actions";
import { redirect } from "next/navigation";

// Simula el ID del Director Corporativo activo en sesión
const DEMO_SUPER_ADMIN_ID = "SUPERADMIN-001";

export default async function SuperAdminDashboard() {
  const result = await getGlobalDashboardMetrics(DEMO_SUPER_ADMIN_ID);
  
  if (!result.success) {
    return (
      <div className="p-8 text-red-600 bg-red-50 text-center rounded-xl mx-auto max-w-3xl mt-12 border border-red-200">
        <h2 className="text-2xl font-bold">Fallo en Conexión B2B</h2>
        <p>No se pudo establecer el túnel global corporativo.</p>
      </div>
    );
  }

  const hqFleet = result.data || [];
  const globalTotalOccupancy = result.globalTotalOccupancy || 0;
  const globalTotalCapacity = result.globalTotalCapacity || 1;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      {/* Header Corporativo (Agnóstico a Pacientes y PHP) */}
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Zendity Corporate</h1>
        <p className="text-slate-500 mt-2 text-lg">Visor Estratégico Multi-Sede (Fleet View)</p>
      </div>

      {/* Tarjetas Analíticas Superiores (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-500 uppercase">Sedes Operativas</p>
          <div className="text-5xl font-black text-slate-800 mt-2">{hqFleet.length}</div>
          <p className="text-xs text-green-600 font-semibold mt-2">↑ 100% Infraestructura Activa</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-500 uppercase">Ocupación Global (Censo)</p>
          <div className="text-5xl font-black text-slate-800 mt-2 flex items-baseline gap-2">
            {globalTotalOccupancy} <span className="text-2xl text-slate-500 font-medium">/ {globalTotalCapacity} Camas</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${(globalTotalOccupancy / (globalTotalCapacity || 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-500 uppercase">Salud de Red (Riesgos Abiertos)</p>
          <div className="text-5xl font-black text-red-600 mt-2">
            {hqFleet.reduce((acc: number, curr: any) => acc + curr.criticalIncidentsOpen, 0)}
          </div>
          <p className="text-xs text-red-500 font-semibold mt-2">Nivel Crítico o Alto (Incidentes Triage)</p>
        </div>
      </div>

      {/* Flota de Sedes (Fleet Grid) */}
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Operaciones Desplegadas</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {hqFleet.map((hq: any) => (
          <div key={hq.id} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow border border-slate-200 group">
            
            {/* Cabecera Sede */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{hq.name}</h3>
                <p className="text-sm text-slate-500 mt-1">Dueño: {hq.ownerEmail}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                hq.alertStatus === "WARNING" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                {hq.alertStatus === "WARNING" ? "⚠️ Requiere Atención" : "✓ Óptimo"}
              </div>
            </div>

            {/* Micro-Métricas HQ */}
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-sm text-slate-600 font-medium">Ocupación Física</span>
                <span className="font-bold text-slate-800">{hq.occupiedBeds} / {hq.capacity}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-sm text-slate-600 font-medium">Staff Conectado</span>
                <span className="font-bold text-slate-800">{hq.activeStaff} Perfiles</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-sm text-slate-600 font-medium">Alarmas Críticas</span>
                <span className={`font-bold ${hq.criticalIncidentsOpen > 0 ? "text-red-600" : "text-slate-800"}`}>
                  {hq.criticalIncidentsOpen} Sin Resolver
                </span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-sm text-slate-600 font-medium">Suscripción B2B</span>
                <span className={`font-bold ${hq.licenseActive ? "text-emerald-600" : "text-red-600"}`}>
                  {hq.licenseActive ? "Al Día" : "Suspendida"}
                </span>
              </div>
            </div>

            {/* Acción Corporativa / Impersonation */}
            <div className="pt-4 border-t border-slate-100 pb-2">
              <form action={async () => {
                "use server";
                await startImpersonation(hq.id, hq.name, DEMO_SUPER_ADMIN_ID);
                redirect("/corporate");
              }}>
               <button 
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition text-sm flex justify-center items-center gap-2 group-hover:bg-blue-600"
                type="submit"
               >
                 🔍 Auditar Sede (Impersonation)
               </button>
              </form>
               <p className="text-center text-[10px] text-gray-500 mt-2 italic">Dejará registro en AuditLog bajo HIPPA</p>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

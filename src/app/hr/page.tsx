"use client";
import React, { useEffect, useState } from "react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from "@/context/AuthContext";

export default function HRScorecardPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [rankedStaff, setRankedStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchRanking = async () => {
      try {
        const hqId = user.hqId || user.headquartersId;
        const res = await fetch(`/api/hr/staff?hqId=${hqId}`);
        const data = await res.json();
        if (data.success) {
          // Filtrar solo los evaluados y ordenar descendente
          const sorted = data.staff.sort((a: any, b: any) => b.complianceScore - a.complianceScore);
          setRankedStaff(sorted);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [user]);

  if (loading) return <div className="p-20 text-center font-bold text-slate-400 animate-pulse text-xl">Cargando Ranking HR...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Recursos Humanos (RRHH)</h1>
          <p className="text-slate-500 mt-1">Monitoreo continuo del staff por sede, evaluaciones e integración con Zendity Academy.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl shadow-inner gap-1">
          <Link href="/hr" className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${pathname === '/hr' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Desempeño</Link>
          <Link href="/hr/staff" className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${pathname === '/hr/staff' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Directorio / Turnos</Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6 animate-in slide-in-from-bottom-4">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-xl">🏆</span> Ranking Global: Todas las Sedes</h3>
          <Link href="/hr/evaluate" className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-sm transition-colors block">Realizar Auditoría</Link>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-white uppercase font-semibold border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Empleado</th>
              <th className="px-6 py-4">Rol</th>
              <th className="px-6 py-4 text-center">Última Evaluación</th>
              <th className="px-6 py-4 text-center">Métrica Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rankedStaff.map((emp, idx) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-black shadow-inner border border-slate-200">
                    {idx + 1}
                  </div>
                  <div className="flex flex-col">
                    <span>{emp.name}</span>
                    <span className="text-xs font-medium text-slate-400">{emp.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600 font-medium">{emp.role}</td>
                <td className="px-6 py-4 text-center text-slate-500 font-medium whitespace-nowrap">
                  —
                </td>
                <td className="px-6 py-4 text-center">
                  {emp.complianceScore >= 90 ? (
                    <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-black tracking-widest border border-emerald-200 shadow-sm">
                      {emp.complianceScore} PTA.
                    </span>
                  ) : emp.complianceScore >= 75 ? (
                    <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-xs font-black tracking-widest border border-amber-200 shadow-sm">
                      {emp.complianceScore} PTA.
                    </span>
                  ) : (
                    <span className="bg-rose-100 text-rose-700 px-4 py-1.5 rounded-full text-xs font-black tracking-widest border border-rose-200 shadow-sm">
                      {emp.complianceScore} PTA.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rankedStaff.length === 0 && (
          <div className="p-10 text-center text-slate-500 font-medium">No hay personal registrado en la Sede.</div>
        )}
      </div>
    </div>
  );
}

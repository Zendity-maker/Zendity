"use client";
import React, { useEffect, useState } from "react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from "@/context/AuthContext";
import { UserCog, Award, UserPlus, ClipboardCheck, Users, Search } from 'lucide-react';

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
        if (Array.isArray(data)) {
          setRankedStaff(data.sort((a: any, b: any) => b.complianceScore - a.complianceScore));
        } else if (data.success && Array.isArray(data.staff)) {
          setRankedStaff(data.staff.sort((a: any, b: any) => b.complianceScore - a.complianceScore));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [user]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-500">
          <UserCog className="w-6 h-6" />
        </div>
        <p className="font-bold text-slate-400 tracking-wider text-sm uppercase">Cargando Directorio HR...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-[0.98] duration-500 pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end border-b border-slate-200/60 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-teal-600"><UserCog className="w-7 h-7" /></span>
            Recursos Humanos
          </h1>
          <p className="text-slate-500 mt-3 font-medium text-sm">Monitoreo continuo del staff por sede e integración con Zendity Academy.</p>
        </div>
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl shadow-inner gap-1 border border-slate-200/50">
          <Link href="/hr" className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${pathname === '/hr' ? 'bg-white text-teal-700 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>
            <Award className="w-4 h-4" /> Desempeño
          </Link>
          <Link href="/hr/staff" className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${pathname === '/hr/staff' ? 'bg-white text-teal-700 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>
            <Users className="w-4 h-4" /> Directorio / Turnos
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200/80 overflow-hidden mt-6">
        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300 shadow-sm flex items-center justify-center text-amber-700">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">Ranking Global de Sede</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Top Performers</p>
            </div>
          </div>
          <Link href="/hr/evaluate" className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl shadow-md shadow-teal-500/10 transition-colors flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" /> Iniciar Auditoría
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-400 bg-white uppercase font-black tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-5"># Empleado</th>
                <th className="px-6 py-5">Rol / Posición</th>
                <th className="px-6 py-5 text-center">Última Evaluación</th>
                <th className="px-6 py-5 text-center">Score de Calidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rankedStaff.map((emp, idx) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-black shadow-none border border-slate-200/60 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                      {idx + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{emp.name}</span>
                      <span className="text-[11px] font-semibold text-slate-400">{emp.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-semibold">{emp.role}</td>
                  <td className="px-6 py-4 text-center text-slate-400 font-medium">
                    <span className="bg-slate-100 px-3 py-1 rounded-md text-xs border border-slate-200/60">—</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {emp.complianceScore >= 90 ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-widest border border-emerald-200/60 shadow-sm">
                        {emp.complianceScore} PTA.
                      </span>
                    ) : emp.complianceScore >= 75 ? (
                      <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-widest border border-amber-200/60 shadow-sm">
                        {emp.complianceScore} PTA.
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-widest border border-rose-200/60 shadow-sm">
                        {emp.complianceScore} PTA.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rankedStaff.length === 0 && (
          <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center gap-3 bg-slate-50/50">
            <Users className="w-8 h-8 opacity-50" />
            No hay personal registrado en la Sede.
          </div>
        )}
      </div>
    </div>
  );
}


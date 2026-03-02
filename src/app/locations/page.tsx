"use client";
import React from "react";
export default function LocationsDirectoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Directorio de Sedes (Hogares)</h1>
      <p className="text-slate-500 mt-1">Administración de licenciamiento y perfiles por localización.</p>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-semibold border-b">
            <tr>
              <th className="px-6 py-4">Sede HQ</th>
              <th className="px-6 py-4">Ubicación</th>
              <th className="px-6 py-4">Capacidad</th>
              <th className="px-6 py-4 text-right">Estatus Licencia DF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-6 py-4 font-bold text-slate-800">Sede San Juan</td>
              <td className="px-6 py-4 text-slate-600">San Juan, PR</td>
              <td className="px-6 py-4 text-slate-600">60 Camas</td>
              <td className="px-6 py-4 text-right"><span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Vigente (2027)</span></td>
            </tr>
            <tr>
              <td className="px-6 py-4 font-bold text-slate-800">Sede Ponce</td>
              <td className="px-6 py-4 text-slate-600">Ponce, PR</td>
              <td className="px-6 py-4 text-slate-600">45 Camas</td>
              <td className="px-6 py-4 text-right"><span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Vigente (2028)</span></td>
            </tr>
            <tr>
              <td className="px-6 py-4 font-bold text-slate-800">Sede Mayagüez</td>
              <td className="px-6 py-4 text-slate-600">Mayagüez, PR</td>
              <td className="px-6 py-4 text-slate-600">40 Camas</td>
              <td className="px-6 py-4 text-right"><span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">Renovación Pend.</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

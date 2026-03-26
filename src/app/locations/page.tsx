import React from "react";
import { prisma } from '@/lib/prisma';



export const dynamic = "force-dynamic";

export default async function LocationsDirectoryPage() {
  const hqs = await prisma.headquarters.findMany({
    orderBy: { createdAt: "desc" }
  });

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
            {hqs.map((hq) => {
              // Extract a simplistic location from the name or billing address
              const location = hq.billingAddress || (hq.name.includes('Cupey') ? 'Cupey, PR' : hq.name.includes('Mayag') ? 'Mayagüez, PR' : 'San Juan, PR');
              const expYear = new Date(hq.licenseExpiry).getFullYear();

              return (
                <tr key={hq.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800">{hq.name}</td>
                  <td className="px-6 py-4 text-slate-600">{location}</td>
                  <td className="px-6 py-4 text-slate-600">{hq.capacity} Camas</td>
                  <td className="px-6 py-4 text-right">
                    {hq.licenseActive ? (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                        Vigente ({expYear})
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                        Suspendida
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {hqs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No hay sedes registradas en la base de datos de Zendity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

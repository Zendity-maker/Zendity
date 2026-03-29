import React from "react";
import { cookies } from "next/headers";
import { stopImpersonation } from "@/actions/audit/impersonate.actions";

export default function ImpersonationBanner() {
  const cookieStore = cookies();
  const impersonatedHqId = cookieStore.get("Zendity-Impersonated-HQ")?.value;
  const impersonatedName = cookieStore.get("Zendity-Impersonated-Name")?.value || impersonatedHqId;

  if (!impersonatedHqId) return null;

  return (
    <div className="bg-yellow-500 text-yellow-900 px-6 py-2 text-sm font-extrabold flex justify-between items-center z-50 sticky top-0 border-b-4 border-yellow-600 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-xl animate-pulse">⚠️</span>
        <span>MODO AUDITORÍA ELEVADA (IMPERSONATION) ACTIVO:</span>
        <span className="font-mono bg-yellow-400 px-2 py-0.5 rounded text-black ml-1">
          {impersonatedName}
        </span>
      </div>
      <form action={async () => {
        "use server";
        await stopImpersonation("SUPERADMIN-001"); // Simulando fallback del perfil autenticado
      }}>
        <button 
          type="submit"
          className="bg-yellow-900 border border-yellow-400 hover:bg-black text-white px-4 py-1 rounded-full text-xs transition"
        >
          CERRAR TÚNEL Y VOLVER AL CORPORATIVO
        </button>
      </form>
    </div>
  );
}

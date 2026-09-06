'use client';

import { useState } from 'react';

/**
 * DOS SALIDAS, Y LA BUENA VA PRIMERO.
 *
 * "Descargar PDF" genera el documento: el nombre del residente en CADA hoja,
 * las alergias arriba del todo, "Página 2 de 2". Es el que se entrega, porque
 * este papel se separa en una camilla y la hoja 2 no puede ser una lista de
 * medicamentos sin dueño.
 *
 * "Imprimir" sigue siendo la pantalla — limpia desde el arreglo de AppLayout,
 * pero con la cabecera que le ponga el navegador de cada quien.
 *
 * El botón decía "Imprimir / Guardar PDF", que sugería que las dos cosas eran
 * lo mismo. No lo eran.
 */
export default function PrintButton({ patientId }: { patientId: string }) {
  const [bajando, setBajando] = useState(false);

  const descargar = () => {
    setBajando(true);
    window.location.href = `/api/corporate/patients/${patientId}/emergency-card/pdf`;
    setTimeout(() => setBajando(false), 2500);
  };

  return (
    <div className="no-print inline-flex items-center gap-2">
      <button
        onClick={descargar}
        disabled={bajando}
        className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-60 transition-colors"
      >
        {bajando ? 'Generando…' : 'Descargar PDF'}
      </button>
      <button
        onClick={() => window.print()}
        title="Imprime la pantalla. Para entregar en el hospital, usa Descargar PDF."
        className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
      >
        Imprimir
      </button>
    </div>
  );
}

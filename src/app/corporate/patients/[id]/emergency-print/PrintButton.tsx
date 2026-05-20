'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 transition-colors"
    >
      Imprimir / Guardar PDF
    </button>
  );
}

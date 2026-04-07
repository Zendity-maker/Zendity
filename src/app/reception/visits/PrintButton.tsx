"use client";

export default function PrintButton() {
    return (
        <button
            onClick={() => window.print()}
            className="print:hidden bg-teal-600 hover:bg-teal-500 text-white font-bold px-6 py-2 rounded-xl text-sm transition-all"
        >
            Imprimir registro
        </button>
    );
}

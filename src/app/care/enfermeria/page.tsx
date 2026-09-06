"use client";

/**
 * ENFERMERÍA — LO QUE TE TOCA HOY
 * ───────────────────────────────
 * No es un tablero: es una lista de trabajo. Cada línea es algo que alguien
 * tiene que hacer, con su número y su enlace.
 *
 * POR QUÉ EXISTE. Lo de enfermería vive repartido en siete pantallas y ninguna
 * dice si hay algo pendiente: hay que entrar a las siete a comprobarlo. Quien no
 * sabe que hay algo pendiente no entra — así fue como 16 planes de cuido
 * completos pasaron 106 días sin firmar.
 *
 * NADA SE TACHA A MANO. Cada número sale de una consulta contra la realidad y
 * desaparece cuando el trabajo se hace de verdad. Una lista que se puede tachar
 * sin hacer el trabajo es peor que no tenerla.
 *
 * LO QUE ESTA PANTALLA NO ES: no sustituye a ninguna de las otras. Es la puerta,
 * no el cuarto. Por eso cada línea lleva a donde ya se hace el trabajo en vez de
 * repetirlo aquí.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, ChevronRight } from "lucide-react";

interface Pendiente {
    codigo: string;
    titulo: string;
    detalle: string;
    total: number;
    urgencia: 'ALTA' | 'MEDIA' | 'BAJA';
    href: string;
}

const COLOR: Record<Pendiente['urgencia'], string> = {
    ALTA:  'border-rose-300 bg-rose-50 text-rose-900',
    MEDIA: 'border-amber-300 bg-amber-50 text-amber-900',
    BAJA:  'border-slate-200 bg-white text-slate-800',
};
const NUMERO: Record<Pendiente['urgencia'], string> = {
    ALTA:  'bg-rose-600 text-white',
    MEDIA: 'bg-amber-500 text-white',
    BAJA:  'bg-slate-200 text-slate-700',
};

export default function EnfermeriaPage() {
    const [pendientes, setPendientes] = useState<Pendiente[]>([]);
    const [cargando, setCargando] = useState(true);
    const [revisado, setRevisado] = useState(0);

    useEffect(() => {
        const cargar = async () => {
            try {
                const res = await fetch('/api/care/enfermeria/pendientes');
                const data = await res.json();
                if (data.success) { setPendientes(data.pendientes); setRevisado(data.revisado); }
            } catch { /* la pantalla se queda como está */ }
            finally { setCargando(false); }
        };
        cargar();
        const t = setInterval(cargar, 120000);
        return () => clearInterval(t);
    }, []);

    // Sin <AppLayout> aqui: el layout raiz ya envuelve toda la app, asi que
    // montarlo otra vez daba dos barras laterales, dos cabeceras y un h-screen
    // dentro de otro h-screen.
    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900">Enfermería</h1>
                    <p className="text-slate-500 font-medium mt-1">Lo que espera una decisión. Lo más urgente primero.</p>
                </div>

                {cargando ? (
                    <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
                    </div>
                ) : pendientes.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                        <p className="font-black text-emerald-900">Todo al día.</p>
                        {/* Decir CUÁNTAS cosas se miraron: "todo al día" sin eso puede
                            significar que no se comprobó nada. */}
                        <p className="text-emerald-700/70 text-sm mt-1">
                            Se revisaron {revisado} frentes y ninguno tiene trabajo pendiente.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendientes.map(p => (
                            <Link
                                key={p.codigo}
                                href={p.href}
                                className={`flex items-center gap-4 p-5 rounded-3xl border-2 shadow-sm transition-all hover:shadow-md active:scale-[0.99] ${COLOR[p.urgencia]}`}
                            >
                                <span className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${NUMERO[p.urgencia]}`}>
                                    {p.total > 99 ? '99+' : p.total}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block font-black leading-tight">{p.titulo}</span>
                                    <span className="block text-sm opacity-70 mt-0.5 leading-snug">{p.detalle}</span>
                                </span>
                                <ChevronRight className="w-5 h-5 shrink-0 opacity-40" />
                            </Link>
                        ))}
                    </div>
                )}
        </div>
    );
}

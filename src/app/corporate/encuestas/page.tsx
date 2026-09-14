"use client";

/**
 * ENCUESTAS A LAS FAMILIAS — pantalla propia.
 *
 * Hasta el 14-sep-2026 esto vivía como una tarjeta del panel gerencial, y esa
 * mañana, al reescribir el panel, la quité. Fue un error mío: era el ÚNICO
 * sitio del producto desde donde se podían mandar las encuestas y leer lo que
 * las familias habían escrito. Andrés lo notó el mismo día — "no tengo dónde
 * trabajar con las encuestas".
 *
 * No vuelve al panel, y es deliberado: el panel es sobre el turno de hoy, y la
 * satisfacción es trimestral. Pero sobre todo porque LEER lo que escribió una
 * familia necesita espacio, no una tarjeta de dos líneas.
 *
 * Lo que sí conserva el espíritu del comentario original —"una métrica que hay
 * que ir a buscar no se mira"— es que el panel avisa: cuando hay respuestas sin
 * leer o toca mandar la del trimestre, sale una línea en "Esperando tu
 * decisión" con el enlace aquí. Ver src/lib/pantalla-direccion.ts.
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import SatisfaccionFamilias from '@/components/corporate/SatisfaccionFamilias';
import { useActiveHq } from '@/contexts/ActiveHqContext';

export default function EncuestasPage() {
    const router = useRouter();
    const { activeHqId } = useActiveHq();

    return (
        <div className="min-h-screen bg-slate-50 pb-16">
            <div className="max-w-3xl mx-auto px-5 py-8 md:py-12">
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium mb-6 transition-colors"
                >
                    <ArrowLeft size={16} /> Volver
                </button>

                <div className="mb-7">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Star className="text-amber-500" size={26} /> Encuestas a las familias
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1.5 leading-snug">
                        Tres preguntas, una vez por trimestre. La respuesta llega identificada,
                        para poder darle seguimiento a quien la escribió.
                    </p>
                </div>

                <SatisfaccionFamilias hqId={activeHqId ?? undefined} />
            </div>
        </div>
    );
}

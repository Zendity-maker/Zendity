'use client';
/** Captura del lector de un curso, para comprobar que una foto se ve dentro. */
import { Andamio, instalar } from '../andamio';
import { useEffect } from 'react';
import InteractiveCourseCard from '@/components/academy/InteractiveCourseCard';

const CONTENIDO = `---META---
TITULO: El Cuidador en Zendity
PROMPT_ZENDI: Evalua si sabe donde esta cada cosa.
TERMINOS_CLAVE: turno, relevo, caidas
PREGUNTA_REFLEXION: Cuentame un turno tuyo.

---SECCION_1---
LECTURA:
# Donde se registra una caida

Cuando encuentras a un residente en el piso, lo primero no es la pantalla: es el
residente. Pero en cuanto esta atendido, la caida **se registra el mismo turno**.

La pantalla de Caidas se abre desde enfermeria y ensena tres cosas a la vez:

![La pantalla de Caidas. Arriba, el bloque de riesgo con los cuatro contadores: fijate en "Sin evaluar", que es el grupo que pide trabajo. Abajo, las caidas de los ultimos 90 dias con su chip de gravedad.](/academy/capturas/caidas-panel.jpg)

| Lo que SI te toca | Lo que NO te toca |
| --- | --- |
| Escribir lo que viste | Decir si hay fractura |
| Poner la hora exacta | Decidir si va al hospital |

1. Atiendes al residente
2. Avisas
3. Lo registras

PREGUNTAS:
P: Cuando se registra una caida?
a) Al final de la semana
*b) El mismo turno
c) Cuando lo pida el supervisor
d) Solo si hubo lesion
EXPLICACION: El mismo turno, siempre.
`;

instalar({
    // El contenido ya NO viaja con el catálogo: la tarjeta lo pide aquí al
    // pulsar "Comenzar". Este andamio prueba ese camino, no el viejo.
    '/api/academy/curso/': { success: true, curso: { id: 'demo', title: 'El Cuidador en Zendity', content: CONTENIDO } },
    '/api/academy': { success: true, enrollments: [] },
});

export default function Captura() {
    useEffect(() => {
        const t = setTimeout(() => {
            const b = Array.from(document.querySelectorAll('button'))
                .find(x => x.textContent?.trim() === 'Comenzar') as HTMLButtonElement | undefined;
            b?.click();
            setTimeout(() => {
                const c = Array.from(document.querySelectorAll('button'))
                    .find(x => x.textContent?.includes('Comenzar la lectura')) as HTMLButtonElement | undefined;
                c?.click();
            }, 400);
        }, 600);
        return () => clearTimeout(t);
    }, []);

    return (
        <Andamio ancho={1000}>
            <div className="p-8 max-w-sm">
                <InteractiveCourseCard
                    course={{ id: 'demo', title: 'El Cuidador en Zendity', description: 'Donde esta cada cosa.', category: 'Tecnologia Zendity', durationMins: 25, bonusCompliance: 20, imageUrl: null }}
                    user={{ id: 'demo-user', hqId: 'demo-hq' }}
                />
            </div>
        </Andamio>
    );
}

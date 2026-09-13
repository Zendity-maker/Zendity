'use client';
/**
 * TEMPORAL en producción (404) — captura de /care/profile.
 *
 * Comprueba que el bloque del Z-Score quedó apagado y que en su lugar aparece
 * la explicación, en vez de un hueco sin motivo. La API real ya devuelve
 * `score: null`; aquí se sirve esa misma respuesta.
 */
import { Andamio, instalar, comoSi } from '../andamio';
import PerfilCuidadora from '@/app/care/profile/page';
import { Z_SCORE_OCULTO_MOTIVO } from '@/lib/z-score-visible';

instalar(
    {
        // Lo que devuelve /api/care/my-score desde el 13-sep-2026.
        '/api/care/my-score': { success: true, score: null, breakdown: null, oculto: true, motivo: Z_SCORE_OCULTO_MOTIVO },
        '/api/academy': {
            success: true,
            enrollments: [
                { id: 'c1', status: 'COMPLETED', courseName: 'Cuidado Geriátrico General', completedAt: '2026-08-14T00:00:00.000Z', course: { title: 'Cuidado Geriátrico General' } },
                { id: 'c2', status: 'COMPLETED', courseName: 'Protocolo de Respuesta a Caídas', completedAt: '2026-09-02T00:00:00.000Z', course: { title: 'Protocolo de Respuesta a Caidas' } },
            ],
        },
    },
    comoSi({ id: 'demo-user', name: 'Joaneliz Pérez', role: 'CAREGIVER' }),
);

export default function Captura() {
    return <Andamio ancho={820}><PerfilCuidadora /></Andamio>;
}

/**
 * ENFERMERÍA PIDE UNA TOMA DE VITALES. LA VÍA QUE NO EXISTÍA.
 *
 * ═══ QUÉ FALTABA ═══
 *
 * Andrés, 01-oct-2026: «la noche toma vitales por orden de enfermería. O sea
 * que si hay alguien en observación se le deja saber al personal y se debe
 * hacer el registro en Zéndity de esas tomas.»
 *
 * Ese circuito existe en el piso y no existía en el sistema. Medido el mismo
 * día: de las 13.417 `VitalsOrder` de toda la historia, las ÚNICAS 47 que no
 * las creó un reloj son la revisión de observación —que dispara el propio
 * sistema cuando unos vitales salen críticos—. Ninguna la pidió una persona.
 *
 * El aviso de enfermería viajaba de viva voz. Llegaba, probablemente; pero no
 * quedaba escrito quién lo pidió, por qué, ni si se hizo.
 *
 * ═══ QUIÉN PUEDE PEDIRLA ═══
 *
 * `requireRole(['NURSE'])`, que mira TAMBIÉN los secundarios. Hoy eso alcanza a
 * exactamente una persona: Celia Sierra, DIRECTOR con NURSE de secundario —
 * medido, hay CERO usuarios con NURSE primario en el hogar. Gatear por el
 * primario no habría alcanzado a nadie. Ver src/lib/roles-clinicos.ts.
 *
 * Y a un DIRECTOR sin NURSE NO se le abre: una orden de vitales es un acto de
 * enfermería. Ensanchar esa lista es una decisión clínica, no técnica.
 *
 * ═══ POR QUÉ `autoCreated: false` IMPORTA ═══
 *
 * Es lo que separa «alguien decidió que hay que mirar a esta persona» de «abrió
 * un turno». Las métricas de cumplimiento ya distinguen por ese campo, así que
 * una orden de enfermería no se diluye entre las 84 diarias que pone el reloj.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyUser } from '@/lib/notifications';
import { VITALS_WINDOW_MS } from '@/lib/vitals-window';

export const dynamic = 'force-dynamic';

/** Una razón de una palabra no le dice nada a quien la va a leer de madrugada. */
const MINIMO_MOTIVO = 10;

/** Ventana para no duplicar por doble toque. Ver CLAUDE.md, antipatrón 1. */
const VENTANA_DUPLICADO_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
    const auth = await requireRole(['NURSE']);
    if (auth instanceof NextResponse) return auth;

    try {
        const { patientId, motivo } = await req.json().catch(() => ({}));
        if (!patientId || typeof patientId !== 'string') {
            return NextResponse.json({ success: false, error: 'Falta el residente' }, { status: 400 });
        }
        const razon = String(motivo ?? '').trim();
        if (razon.length < MINIMO_MOTIVO) {
            return NextResponse.json({
                success: false,
                error: `Di por qué hay que tomarlos — quien lo lea de madrugada necesita saberlo (mínimo ${MINIMO_MOTIVO} caracteres).`,
            }, { status: 400 });
        }

        /**
         * LA SEDE SALE DE LA SESIÓN, Y EL RESIDENTE SE COMPRUEBA CONTRA ELLA.
         *
         * `headquartersId` nunca del cuerpo (CLAUDE.md). Y no basta el rol: hay
         * que verificar que ESTE residente es de la sede de quien pide, o una
         * enfermera de una sede podría abrir órdenes sobre residentes de otra.
         */
        const paciente = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: auth.headquartersId, status: 'ACTIVE' },
            select: { id: true, name: true },
        });
        if (!paciente) {
            return NextResponse.json(
                { success: false, error: 'Residente no encontrado en tu sede, o ya no está activo' },
                { status: 404 },
            );
        }

        const ahora = new Date();

        /**
         * DOBLE TOQUE: SE DEVUELVE LA QUE YA HAY, Y EN VERDE.
         *
         * Un error en rojo haría que lo intentara otra vez, que es justo lo que
         * fabrica el duplicado. Ver CLAUDE.md, «los dos que más se repiten».
         */
        const yaPedida = await prisma.vitalsOrder.findFirst({
            where: {
                patientId: paciente.id,
                status: 'PENDING',
                completedAt: null,
                autoCreated: false,
                orderedById: auth.id,
                orderedAt: { gte: new Date(ahora.getTime() - VENTANA_DUPLICADO_MS) },
            },
            select: { id: true, expiresAt: true },
        });
        if (yaPedida) {
            return NextResponse.json({ success: true, yaExistia: true, orden: yaPedida });
        }

        /**
         * EL PLAZO ES EL MISMO QUE EL DE LA RONDA: 4 h.
         *
         * No se inventa un número nuevo. `VITALS_WINDOW_MS` lo fijó la enfermera
         * del hogar el 01-sep-2026 y es el plazo que el piso ya conoce — pedir
         * una toma «de enfermería» con un reloj distinto solo añadiría una regla
         * más que recordar. Ver src/lib/vitals-window.ts.
         */
        const orden = await prisma.vitalsOrder.create({
            data: {
                headquartersId: auth.headquartersId,
                patientId: paciente.id,
                orderedById: auth.id,
                // Sin `caregiverId`: no se asigna a nadie en concreto, la hace
                // quien esté cubriendo. La orden sale en la tarjeta del
                // residente, que es donde la va a ver.
                reason: razon,
                orderedAt: ahora,
                expiresAt: new Date(ahora.getTime() + VITALS_WINDOW_MS),
                status: 'PENDING',
                autoCreated: false,
                penaltyApplied: false,
            },
            select: { id: true, expiresAt: true },
        });

        /**
         * «SE LE DEJA SABER AL PERSONAL» — A QUIEN ESTÁ EN PISO, NO A LOS TRECE.
         *
         * La primera versión usaba `notifyRoles(hq, ROLES_DE_PISO, …)`, que
         * avisa a TODOS los cuidadores de la sede estén trabajando o no.
         * Comprobado en la rama: una sola orden generó **12 notificaciones**.
         *
         * Eso es el mismo error que esta sesión entera vino a quitar: un aviso
         * que le llega a quien no puede actuar es un aviso que se aprende a
         * ignorar, y arrastra con él a los que sí importan. Quien está en su
         * casa no va a tomarle los vitales a nadie.
         *
         * Se avisa a quien tiene turno ABIERTO ahora mismo. Si no hay nadie
         * —puede pasar entre turnos— no se avisa a nadie y la orden igual sale
         * en la tarjeta del residente, que es donde la verá quien entre.
         *
         * Sin PHI más allá del nombre y del motivo que la propia enfermera
         * escribió: es una notificación interna, no un correo (CLAUDE.md 7).
         */
        const enPiso = await prisma.shiftSession.findMany({
            where: { headquartersId: auth.headquartersId, actualEndTime: null },
            select: { caregiverId: true },
        });
        const destinatarios = [...new Set(enPiso.map(s => s.caregiverId))].filter(id => id !== auth.id);
        await Promise.all(destinatarios.map(id => notifyUser(id, {
            type: 'EMAR_ALERT',
            title: `Enfermería pide vitales — ${paciente.name.trim()}`,
            message: `${razon} · Tómalos y regístralos en la tarjeta del residente.`,
            link: '/care',
        }).catch(() => false)));

        return NextResponse.json({ success: true, orden });
    } catch (error: any) {
        console.error('[care/vitals/orden]', error?.message ?? error);
        return NextResponse.json({ success: false, error: 'No se pudo crear la orden' }, { status: 500 });
    }
}

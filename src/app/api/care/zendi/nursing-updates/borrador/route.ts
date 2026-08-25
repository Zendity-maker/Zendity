import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { generarBorrador } from '@/lib/nursing-update';

/**
 * POST /api/care/zendi/nursing-updates/borrador  { patientId }
 *
 * Genera un borrador de actualización clínica para la familia de UN residente
 * concreto — el que la enfermera tiene delante en su expediente.
 *
 * Sustituye al modelo de rotación, que elegía el residente por su cuenta y
 * empujaba la tarjeta en /care. Ver src/lib/nursing-update.ts.
 *
 * Roles: la enfermera del hogar, mas directores y admin. Celia pidió mantener
 * a direccion para que la funcion no dependa de una sola persona.
 */
const ALLOWED_ROLES = ['NURSE', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { patientId } = await req.json();
        if (!patientId) {
            return NextResponse.json({ success: false, error: 'Falta el residente.' }, { status: 400 });
        }

        const r = await generarBorrador(patientId, auth.headquartersId);
        if (!r) {
            return NextResponse.json(
                { success: false, error: 'Este residente no tiene familiares registrados en Zéndity, o ya no está en el hogar.' },
                { status: 400 },
            );
        }

        // Se guarda en PENDING para que el envio quede trazado igual que antes:
        // optionGen1/2 conservan lo que propuso Zendi y selectedOption guardara
        // lo que realmente salio, aunque la enfermera lo edite.
        const update = await prisma.zendiNursingUpdate.create({
            data: {
                patientId,
                authorId: auth.id,
                headquartersId: auth.headquartersId,
                status: 'PENDING',
                optionGen1: r.borrador.opcion1,
                optionGen2: r.borrador.opcion2,
            },
            select: { id: true, optionGen1: true, optionGen2: true },
        });

        return NextResponse.json({
            success: true,
            update,
            nombre: r.nombre,
            contexto: r.borrador.contexto,
        });
    } catch (e: any) {
        console.error('[nursing-updates/borrador] error:', e);
        return NextResponse.json({ success: false, error: 'No se pudo generar el borrador.' }, { status: 500 });
    }
}

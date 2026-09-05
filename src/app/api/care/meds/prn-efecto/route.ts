/**
 * ¿HIZO EFECTO EL PRN?
 * ────────────────────
 * GET devuelve las dosis por razón necesaria que todavía no tienen respuesta.
 * POST la escribe.
 *
 * El porqué completo está en src/lib/prn.ts. En corto: un PRN se da PARA algo, y
 * si nadie pregunta si funcionó, la información que decide qué hacer después
 * —repetir, cambiar, llamar al médico— se pierde. Hoy vive en notas de turno:
 * "se administró 50 mg de Seroquel, pero no se ha logrado estabilizar".
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyRoles } from '@/lib/notifications';
import { esEfectoValido, etiquetaEfecto, requiereSeguimiento, HORAS_PARA_EXIGIR_EFECTO } from '@/lib/prn';

export const dynamic = 'force-dynamic';

const PUEDEN = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * GET — PRN sin respuesta. `?patientId=` para uno solo.
 *
 * La ventana es de 12 horas: cubre el turno completo más el relevo. Quien lo dio
 * pudo irse a casa, y entonces le toca al siguiente cerrar lo que vio.
 */
export async function GET(req: Request) {
    const auth = await requireRole(PUEDEN);
    if (auth instanceof NextResponse) return auth;

    try {
        const patientId = new URL(req.url).searchParams.get('patientId');
        const desde = new Date(Date.now() - HORAS_PARA_EXIGIR_EFECTO * 3600000);

        const pendientes = await prisma.medicationAdministration.findMany({
            where: {
                status: 'ADMINISTERED',
                prnMotivo: { not: null },
                prnEfecto: null,
                createdAt: { gte: desde },
                patientMedication: {
                    patient: {
                        headquartersId: auth.headquartersId,
                        ...(patientId ? { id: patientId } : {}),
                    },
                },
            },
            select: {
                id: true, prnMotivo: true, administeredAt: true, createdAt: true,
                patientMedication: {
                    select: {
                        patient: { select: { id: true, name: true } },
                        medication: { select: { name: true, dosage: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
            take: 50,
        });

        return NextResponse.json({
            success: true,
            pendientes: pendientes.map(a => ({
                id: a.id,
                medicamento: `${a.patientMedication.medication.name} ${a.patientMedication.medication.dosage}`.trim(),
                motivo: a.prnMotivo,
                administradoAt: a.administeredAt ?? a.createdAt,
                residente: {
                    id: a.patientMedication.patient.id,
                    nombre: a.patientMedication.patient.name.trim(),
                },
            })),
        });
    } catch (error) {
        console.error('PRN efecto GET:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const auth = await requireRole(PUEDEN);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json().catch(() => ({}));
        const id = String(body.id ?? '').trim();
        const efecto = String(body.efecto ?? '').trim();
        const nota = String(body.nota ?? '').trim();

        if (!esEfectoValido(efecto)) {
            return NextResponse.json({ success: false, error: 'Respuesta no válida' }, { status: 400 });
        }

        // Ownership por id — el rol no basta.
        const admin = await prisma.medicationAdministration.findFirst({
            where: {
                id,
                patientMedication: { patient: { headquartersId: auth.headquartersId } },
            },
            select: {
                id: true, prnEfecto: true, prnMotivo: true, notes: true,
                patientMedication: {
                    select: {
                        patient: { select: { name: true } },
                        medication: { select: { name: true } },
                    },
                },
            },
        });
        if (!admin) {
            return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
        }
        if (admin.prnEfecto) {
            return NextResponse.json({ success: false, error: 'Ya tiene respuesta.' }, { status: 409 });
        }

        await prisma.medicationAdministration.update({
            where: { id },
            data: {
                prnEfecto: efecto,
                prnEfectoAt: new Date(),
                prnEfectoPorId: auth.id,
                // La nota se anexa a lo que ya hubiera, no lo pisa.
                notes: nota
                    ? `${admin.notes ?? ''}${admin.notes ? ' ' : ''}[Efecto] ${nota.slice(0, 300)}`.trim()
                    : admin.notes,
            },
        });

        /**
         * "Se dio y no sirvió" es una decisión clínica pendiente, no un dato de
         * archivo. Es literalmente lo que decía una nota de turno de Cupey —"se
         * le administró su medicación sin observarse efecto, lo que sugiere una
         * posible ineficacia"— y no llegó a nadie.
         */
        if (requiereSeguimiento(efecto)) {
            notifyRoles(auth.headquartersId, ['NURSE', 'SUPERVISOR'], {
                type: 'EMAR_ALERT',
                title: `PRN ${etiquetaEfecto(efecto)?.toLowerCase()} — ${admin.patientMedication.patient.name.trim()}`,
                message: `${admin.patientMedication.medication.name} para "${admin.prnMotivo}". `
                    + `${etiquetaEfecto(efecto)}.${nota ? ` ${nota.slice(0, 160)}` : ''}`,
                link: '/care/supervisor',
            }, auth.id).catch(e => console.error('Aviso de PRN sin efecto:', e));
        }

        return NextResponse.json({ success: true, mensaje: etiquetaEfecto(efecto) });
    } catch (error) {
        console.error('PRN efecto POST:', error);
        return NextResponse.json({ success: false, error: 'No se pudo registrar' }, { status: 500 });
    }
}

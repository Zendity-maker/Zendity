import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { SystemAuditAction, CareModality } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/corporate/patients/[id]/care-modality
 *
 * Marca la modalidad de cuidado de un residente: NONE, PALLIATIVE o HOSPICE.
 *
 * Los campos existian en el schema desde una sesion anterior con el comentario
 * "ningun consumidor activo lo usa todavia". Y era literal: 47 residentes en
 * NONE, cero fechas de inicio, cero proveedor, ninguna pantalla que los
 * escribiera. Lo unico que los leia era el prefill de trabajo social, que por
 * tanto siempre decia "sin hospicio". Esto lo termina.
 *
 * POR QUE IMPORTA MARCARLO, mas alla del expediente: entrar en hospicio cambia
 * el objetivo del cuidado, y hay automatismos que se vuelven crueles si nadie
 * los frena. Una encuesta de "¿cómo lo estamos haciendo?" a la familia de
 * alguien en hospicio, o un mensaje alegre redactado solo, son eso. Ver los
 * consumidores en src/lib/encuesta-familia.ts y src/lib/nursing-update.ts.
 *
 * Contrato igual al de rotation-protocol, que es el precedente de esta casa:
 *   Body: { modalidad: 'NONE'|'PALLIATIVE'|'HOSPICE', proveedor?, fechaInicio?, confirmed: true }
 *   confirmed:true OBLIGATORIO — defensa de backend, no solo del modal.
 *   Idempotente: mismo valor → changed:false y SIN fila de auditoria.
 *
 * Roles: enfermeria y direccion. Una cuidadora no cambia la modalidad de
 * cuidado de nadie.
 */
const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const MODALIDADES: CareModality[] = ['NONE', 'PALLIATIVE', 'HOSPICE'];

async function patchHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const { modalidad, proveedor, fechaInicio, confirmed } = body as Record<string, unknown>;

        if (confirmed !== true) {
            return NextResponse.json(
                { success: false, error: 'Falta confirmación explícita del cambio de modalidad (confirmed:true)' },
                { status: 400 },
            );
        }
        if (typeof modalidad !== 'string' || !MODALIDADES.includes(modalidad as CareModality)) {
            return NextResponse.json(
                { success: false, error: 'modalidad debe ser NONE, PALLIATIVE o HOSPICE' },
                { status: 400 },
            );
        }
        const nueva = modalidad as CareModality;

        // La fecha se acepta del cliente porque el ingreso a hospicio suele
        // registrarse dias despues de que ocurre. Si no viene, hoy.
        let inicio: Date | null = null;
        if (nueva !== 'NONE') {
            const parsed = typeof fechaInicio === 'string' && fechaInicio ? new Date(fechaInicio) : new Date();
            if (Number.isNaN(parsed.getTime())) {
                return NextResponse.json({ success: false, error: 'fechaInicio inválida' }, { status: 400 });
            }
            // Una fecha futura no es un dato, es un dedazo.
            if (parsed.getTime() > Date.now() + 86400000) {
                return NextResponse.json({ success: false, error: 'La fecha de inicio no puede ser futura' }, { status: 400 });
            }
            inicio = parsed;
        }

        const prov = nueva === 'HOSPICE' && typeof proveedor === 'string' && proveedor.trim()
            ? proveedor.trim().slice(0, 200)
            : null;

        // Tenant + existencia. hqId sale de la sesion, nunca del body.
        const patient = await prisma.patient.findUnique({
            where: { id },
            select: {
                id: true, name: true, headquartersId: true,
                careModality: true, hospiceStartDate: true, hospiceProvider: true,
            },
        });
        if (!patient || patient.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        // Idempotencia: solo la modalidad decide. Cambiar proveedor o fecha de
        // una modalidad ya puesta SI es un cambio real y se audita.
        const igual = patient.careModality === nueva
            && (patient.hospiceProvider ?? null) === prov
            && (patient.hospiceStartDate?.toISOString().slice(0, 10) ?? null) === (inicio?.toISOString().slice(0, 10) ?? null);
        if (igual) {
            return NextResponse.json({ success: true, changed: false, patient: { id, careModality: nueva } });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.patient.update({
                where: { id },
                // Volver a NONE limpia fecha y proveedor: dejarlos seria un
                // expediente que dice hospicio a medias.
                data: {
                    careModality: nueva,
                    hospiceStartDate: inicio,
                    hospiceProvider: prov,
                },
                select: { id: true, careModality: true, hospiceStartDate: true, hospiceProvider: true },
            });
            const audit = await tx.systemAuditLog.create({
                data: {
                    headquartersId: auth.headquartersId,
                    entityName: 'Patient',
                    entityId: id,
                    action: SystemAuditAction.PATIENT_PROTOCOL_CHANGED,
                    performedById: auth.id,
                    payloadChanges: {
                        protocol: 'careModality',
                        before: {
                            modalidad: patient.careModality,
                            inicio: patient.hospiceStartDate,
                            proveedor: patient.hospiceProvider,
                        },
                        after: { modalidad: nueva, inicio, proveedor: prov },
                        patientName: patient.name,
                        operatorRole: auth.role,
                    } as any,
                },
                select: { id: true },
            });
            return { updated, audit };
        });

        return NextResponse.json({ success: true, changed: true, patient: result.updated, audit: result.audit });
    } catch (error: any) {
        console.error('[care-modality PATCH] error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error cambiando la modalidad de cuidado' },
            { status: 500 },
        );
    }
}

export const PATCH = withPhiAccessLog(patchHandler, {
    resourceType: 'Patient',
    getPatientId: async ({ params }) => (await params).id,
});

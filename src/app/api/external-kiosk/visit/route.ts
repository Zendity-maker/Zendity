import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice, touchKioskDevice } from '@/lib/external-kiosk-auth';
import { notifyRoles } from '@/lib/notifications';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/external-kiosk/visit
 *
 * Auth: header `x-device-token`.
 *
 * Body:
 *   - providerId       (string, required)
 *   - serviceType      (string, optional — texto libre, ej. "Sesión de terapia")
 *   - comment          (string, optional — visible a familia tras aprobación)
 *   - isFacilityWide   (boolean, default false)
 *   - patientIds       (string[], required si !isFacilityWide)
 *   - notifyFamilies   (boolean, default true)
 *
 * Crea ExternalServiceVisit con status PENDING_REVIEW. Si isFacilityWide,
 * NO crea filas en ExternalServiceVisitPatient (la visita se considera global a
 * todos los residentes activos al momento de la aprobación). Si no, crea N
 * filas en pivot.
 *
 * Notifica a DIRECTOR/ADMIN del HQ: "Nueva visita por aprobar".
 *
 * No notifica familias todavía — eso pasa cuando el director aprueba (o cuando
 * el cron SLA auto-publica a las 24h).
 */
export async function POST(req: Request) {
    try {
        const device = await requireKioskDevice(req);
        if (device instanceof NextResponse) return device;
        const { headquartersId, floorNumber, id: deviceId } = device;

        void touchKioskDevice(deviceId);

        const body = await req.json().catch(() => ({}));
        const providerId: string | undefined = body.providerId;
        const serviceType: string | null = (body.serviceType || '').toString().trim() || null;
        const comment: string | null = (body.comment || '').toString().trim() || null;
        const isFacilityWide: boolean = !!body.isFacilityWide;
        const patientIds: string[] = Array.isArray(body.patientIds) ? body.patientIds.filter((x: any) => typeof x === 'string') : [];
        const notifyFamilies: boolean = body.notifyFamilies !== false; // default true

        // Validación de entrada
        if (!providerId) {
            return NextResponse.json({ success: false, error: 'providerId requerido' }, { status: 400 });
        }
        if (!isFacilityWide && patientIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Debes seleccionar al menos un residente o marcar "Toda la sede"' },
                { status: 400 },
            );
        }
        if (comment && comment.length > 2000) {
            return NextResponse.json({ success: false, error: 'El comentario es demasiado largo (máx 2000 caracteres)' }, { status: 400 });
        }

        // Verificar proveedor pertenece a la misma sede (tenant guard)
        const provider = await prisma.externalProvider.findFirst({
            where: { id: providerId, headquartersId, isActive: true },
            select: { id: true, name: true, category: { select: { name: true, icon: true } } },
        });
        if (!provider) {
            return NextResponse.json({ success: false, error: 'Proveedor no válido' }, { status: 404 });
        }

        // Si no es facilityWide, verificar que los pacientes pertenezcan a la sede
        // y estén activos. Filtrar silenciosamente los inválidos.
        let validPatientIds: string[] = [];
        if (!isFacilityWide) {
            const found = await prisma.patient.findMany({
                where: {
                    id: { in: patientIds },
                    headquartersId,
                    status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
                },
                select: { id: true },
            });
            validPatientIds = found.map(p => p.id);
            if (validPatientIds.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'Ninguno de los residentes seleccionados está disponible' },
                    { status: 400 },
                );
            }
        }

        // Crear visita + pivot en transacción
        const visit = await prisma.$transaction(async (tx) => {
            const v = await tx.externalServiceVisit.create({
                data: {
                    headquartersId,
                    providerId,
                    serviceType,
                    comment,
                    isFacilityWide,
                    notifyFamilies,
                    registeredFromFloor: floorNumber,
                    deviceTokenId: deviceId,
                    // status default: PENDING_REVIEW
                },
            });
            if (!isFacilityWide && validPatientIds.length > 0) {
                await tx.externalServiceVisitPatient.createMany({
                    data: validPatientIds.map(pid => ({ visitId: v.id, patientId: pid })),
                });
            }
            return v;
        });

        // Notificar al director/admin — best effort
        try {
            const residentDesc = isFacilityWide
                ? 'toda la sede'
                : `${validPatientIds.length} residente${validPatientIds.length === 1 ? '' : 's'}`;
            await notifyRoles(headquartersId, ['DIRECTOR', 'ADMIN'], {
                type: 'EXTERNAL_VISIT_PENDING',
                title: 'Nueva visita externa por aprobar',
                message: `${provider.category.icon || ''} ${provider.name} registró una visita para ${residentDesc}. Toca para revisar.`,
                link: '/corporate/external-services',
            });
        } catch (e) {
            logWarn('external-kiosk.visit.notify_director', e, { visitId: visit.id });
        }

        // Audit log
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId,
                    entityName: 'ExternalServiceVisit',
                    entityId: visit.id,
                    action: SystemAuditAction.CREATED,
                    payloadChanges: {
                        trigger: 'KIOSK_REGISTER',
                        providerId,
                        providerName: provider.name,
                        categoryName: provider.category.name,
                        isFacilityWide,
                        patientCount: validPatientIds.length,
                        floor: floorNumber,
                        deviceId,
                    },
                },
            });
        } catch (e) {
            logWarn('external-kiosk.visit.audit', e, { visitId: visit.id });
        }

        return NextResponse.json({
            success: true,
            visitId: visit.id,
            message: '¡Gracias! Tu visita fue registrada. El director la revisará y la familia recibirá una notificación cuando se publique.',
        });
    } catch (err: any) {
        logError('external-kiosk.visit.post', err);
        return NextResponse.json(
            { success: false, error: 'Error registrando visita' },
            { status: 500 },
        );
    }
}

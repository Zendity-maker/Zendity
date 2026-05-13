import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/care/dialysis
 *
 * Gestiona la salida y el retorno de residentes que van a diálisis.
 *
 * action: 'DEPART' → marca al residente TEMPORARY_LEAVE + leaveType DIALYSIS
 * action: 'RETURN' → marca al residente ACTIVE y limpia leaveType
 *
 * Crea una entrada en DailyLog para ambas acciones y notifica al supervisor.
 */

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        // Admitir también el caregiverId del body (petición desde tablet sin sesión completa)
        const body = await req.json();
        if (!session?.user && !body.caregiverId) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const { patientId, action, caregiverId: bodyCaregiverId } = body;

        if (!patientId || !action) {
            return NextResponse.json({ success: false, error: 'patientId y action son requeridos' }, { status: 400 });
        }
        if (!['DEPART', 'RETURN'].includes(action)) {
            return NextResponse.json({ success: false, error: 'action debe ser DEPART o RETURN' }, { status: 400 });
        }

        // Resolver rol e id del invocador
        let invokerRole: string = (session?.user as any)?.role || '';
        let invokerId: string = (session?.user as any)?.id || '';
        let hqId: string = (session?.user as any)?.headquartersId || '';

        if (!invokerRole && bodyCaregiverId) {
            const caregiver = await prisma.user.findUnique({
                where: { id: bodyCaregiverId },
                select: { role: true, headquartersId: true }
            });
            if (!caregiver) return NextResponse.json({ success: false, error: 'Cuidador no encontrado' }, { status: 403 });
            invokerRole = caregiver.role;
            invokerId = bodyCaregiverId;
            hqId = caregiver.headquartersId;
        }

        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Sin permiso para esta acción' }, { status: 403 });
        }

        // Verificar que el residente pertenece a la sede y tiene el flag de diálisis
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true, name: true, needsDialysis: true, status: true, leaveType: true }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });
        }
        if (!patient.needsDialysis) {
            return NextResponse.json({ success: false, error: 'Este residente no tiene configurado el tratamiento de diálisis' }, { status: 400 });
        }

        const now = new Date();

        if (action === 'DEPART') {
            if (patient.status === 'TEMPORARY_LEAVE' && patient.leaveType === 'DIALYSIS') {
                return NextResponse.json({ success: false, error: 'El residente ya está registrado en salida de diálisis' }, { status: 409 });
            }

            await prisma.patient.update({
                where: { id: patientId },
                data: {
                    status: 'TEMPORARY_LEAVE',
                    leaveType: 'DIALYSIS',
                    leaveDate: now
                }
            });

            await prisma.dailyLog.create({
                data: {
                    patientId,
                    authorId: invokerId,
                    bathCompleted: false,
                    foodIntake: 0,
                    notes: `[SALIDA DIÁLISIS] ${patient.name} salió a tratamiento de diálisis. Hora de salida: ${now.toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}.`,
                    isClinicalAlert: false
                }
            });

            await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'SHIFT_ALERT',
                title: `Salida a Diálisis — ${patient.name}`,
                message: `${patient.name} salió a tratamiento de diálisis a las ${now.toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}.`,
                link: '/care/supervisor'
            });

            return NextResponse.json({ success: true, action: 'DEPART', patientId, timestamp: now });
        }

        // action === 'RETURN'
        if (patient.status !== 'TEMPORARY_LEAVE' || patient.leaveType !== 'DIALYSIS') {
            return NextResponse.json({ success: false, error: 'El residente no está registrado en salida de diálisis' }, { status: 409 });
        }

        await prisma.patient.update({
            where: { id: patientId },
            data: {
                status: 'ACTIVE',
                leaveType: null,
                leaveDate: null
            }
        });

        await prisma.dailyLog.create({
            data: {
                patientId,
                authorId: invokerId,
                bathCompleted: false,
                foodIntake: 0,
                notes: `[RETORNO DIÁLISIS] ${patient.name} regresó de tratamiento de diálisis. Hora de retorno: ${now.toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}.`,
                isClinicalAlert: false
            }
        });

        await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
            type: 'SHIFT_ALERT',
            title: `Retorno de Diálisis — ${patient.name}`,
            message: `${patient.name} regresó de diálisis a las ${now.toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}. Asegúrese de tomar vitales post-diálisis.`,
            link: '/care/supervisor'
        });

        return NextResponse.json({ success: true, action: 'RETURN', patientId, timestamp: now });

    } catch (err: any) {
        console.error('[dialysis]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * PAI COMPLETO PARA LA FAMILIA
 * ────────────────────────────
 * `/api/family/pai` (la lista) devuelve solo la carátula de cada plan: tipo,
 * fechas y quién lo aprobó. Suficiente para elegir uno, insuficiente para
 * imprimirlo.
 *
 * La pantalla de impresión del portal familiar resolvía eso llamando a
 * `/api/corporate/patients/[id]` y `.../pai`, cuyos roles permitidos son
 * SUPERVISOR, DIRECTOR, ADMIN, NURSE, SOCIAL_WORKER y COORDINATOR. FAMILY no
 * está: devolvían 403 siempre. Encima le pasaba el id del PLAN donde esos
 * endpoints esperan el id del RESIDENTE, así que aunque el rol hubiera pasado
 * tampoco habría encontrado nada.
 *
 * El resultado no era un error visible. Los dos fetch fallaban, el plan
 * quedaba vacío, y la pantalla concluía y mostraba: "Aún no hay un Plan
 * Asistencial Interdisciplinario firmado para visualizar." A la familia se le
 * decía que su residente no tiene plan de cuido, teniéndolo aprobado y
 * firmado. Nunca funcionó: nació así.
 *
 * AISLAMIENTO. El `patientId` sale del FamilyMember de la sesión, nunca de la
 * petición. Un familiar solo puede leer planes de SU residente: pedir el id de
 * un plan ajeno devuelve 404, no 403 — no se confirma que exista.
 *
 * Solo planes APPROVED. Un borrador no es un documento; enseñarle a la familia
 * un plan a medio escribir es peor que no enseñarle nada.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        // Por CORREO, igual que /api/family/pai. La sesión de un familiar no
        // lleva el id del FamilyMember, así que buscarlo por id devolvería null
        // y todos los planes saldrían "no encontrados".
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { patientId: true },
        });
        if (!familyMember?.patientId) {
            return NextResponse.json({ success: false, error: 'Sin residente asociado' }, { status: 404 });
        }

        const { id } = await params;

        const plan = await prisma.lifePlan.findFirst({
            // El patientId de la sesión va en el WHERE, no se comprueba después:
            // así un id de otro residente simplemente no encuentra fila.
            where: { id, patientId: familyMember.patientId, status: 'APPROVED' },
            include: { approvedBy: { select: { name: true } } },
        });
        if (!plan) {
            return NextResponse.json({ success: false, error: 'Plan no encontrado' }, { status: 404 });
        }

        const patient = await prisma.patient.findUnique({
            where: { id: familyMember.patientId },
            select: {
                name: true, roomNumber: true, dateOfBirth: true,
                headquarters: {
                    // Solo el membrete. NADA de taxId, datos del dueño ni
                    // suscripción: la familia no tiene por qué ver la relación
                    // comercial entre el hogar y Zéndity.
                    select: { name: true, logoUrl: true, phone: true, address: true, billingAddress: true, licenseNumber: true },
                },
            },
        });

        return NextResponse.json({ success: true, plan, patient });
    } catch (error: any) {
        console.error('Error cargando PAI de familia:', error);
        return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
    }
}

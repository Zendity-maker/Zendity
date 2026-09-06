/**
 * EL eMAR DE UN RESIDENTE, EN PDF
 * ───────────────────────────────
 * El porqué está en src/lib/emar-pdf.ts. En corto: es el documento que pide un
 * inspector, y el residente con más historial tiene 1 978 dosis — 71 páginas.
 * Imprimir la pantalla para eso no es una opción.
 *
 * `?from=&to=` en formato YYYY-MM-DD. Sin rango, los últimos 30 días: un eMAR
 * completo casi nunca es lo que alguien pide, y generarlo por defecto sería
 * regalar setenta hojas a quien queria una semana.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logPhiAccess } from '@/lib/phi-audit';
import { generarEmarPDF, type DosisEmar } from '@/lib/emar-pdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Los mismos que pueden leer el eMAR de un residente en /api/emar/patient/[id]. */
const PUEDEN = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER'];

/** Tope duro. Por encima de esto el papel deja de leerse y hay que acotar. */
const TOPE = 1500;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(PUEDEN);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await ctx.params;
        const url = new URL(req.url);

        const hasta = url.searchParams.get('to')
            ? new Date(url.searchParams.get('to') + 'T23:59:59')
            : new Date();
        const desde = url.searchParams.get('from')
            ? new Date(url.searchParams.get('from') + 'T00:00:00')
            : new Date(hasta.getTime() - 30 * 86400000);

        // Por id Y por sede: una operación por ID verifica acceso a ESE id.
        const p = await prisma.patient.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            select: {
                id: true, name: true, roomNumber: true,
                headquarters: { select: { name: true, phone: true } },
            },
        });
        if (!p) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        const where = {
            patientMedication: { patientId: id },
            createdAt: { gte: desde, lte: hasta },
        };

        const [totalEnRango, filas] = await Promise.all([
            prisma.medicationAdministration.count({ where }),
            prisma.medicationAdministration.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: TOPE,
                select: {
                    status: true, administeredAt: true, createdAt: true,
                    scheduleTime: true, notes: true, prnMotivo: true, prnEfecto: true,
                    administeredBy: { select: { name: true } },
                    patientMedication: {
                        select: { medication: { select: { name: true, dosage: true, route: true } } },
                    },
                },
            }),
        ]);

        const dosis: DosisEmar[] = filas.map(f => ({
            medicamento: f.patientMedication.medication.name,
            dosis: f.patientMedication.medication.dosage,
            via: f.patientMedication.medication.route,
            estado: f.status,
            administradoAt: f.administeredAt,
            registradoAt: f.createdAt,
            slot: f.scheduleTime,
            porQuien: f.administeredBy?.name ?? null,
            notas: f.notes,
            prnMotivo: f.prnMotivo,
            prnEfecto: f.prnEfecto,
        }));

        const pdf = generarEmarPDF({
            residente: p.name.trim(),
            habitacion: p.roomNumber,
            hogar: p.headquarters?.name ?? 'Hogar',
            hogarTelefono: p.headquarters?.phone ?? null,
            desde, hasta,
            generadoAt: new Date(),
            totalEnRango,
            dosis,
        });

        logPhiAccess({
            action: 'EXPORT',
            resourceType: 'eMAR',
            patientId: p.id,
            hqId: auth.headquartersId,
            userId: auth.id,
            routePath: '/api/care/patient/[id]/emar-pdf',
            context: { dosis: dosis.length, totalEnRango, desde: desde.toISOString(), hasta: hasta.toISOString() },
        });

        const slug = p.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return new NextResponse(Buffer.from(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="emar-${slug}-${desde.toISOString().slice(0, 10)}_${hasta.toISOString().slice(0, 10)}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('PDF de eMAR:', error);
        return NextResponse.json({ success: false, error: 'No se pudo generar el registro' }, { status: 500 });
    }
}

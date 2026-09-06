/**
 * EL TRASLADO A EMERGENCIAS, EN PDF
 * ─────────────────────────────────
 * El porqué está en src/lib/traslado-pdf.ts. En corto: este papel lo lee
 * alguien de pie, con prisa, sin conocer al residente, y puede separarse en una
 * camilla — así que el nombre va en cada hoja y las alergias van primero.
 *
 * Los mismos datos y los mismos roles que la pantalla. Si los dos caminos
 * dieran cosas distintas tendríamos dos versiones del mismo papel clínico.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logPhiAccess } from '@/lib/phi-audit';
import { edadEnAnios, fechaNacimientoLarga } from '@/lib/edad';
import { generarTrasladoPDF } from '@/lib/traslado-pdf';
import { alergiasSinDocumentar, textoDeAlergias } from '@/lib/alergias';

export const dynamic = 'force-dynamic';

const PUEDEN = ['SUPERVISOR', 'NURSE', 'DIRECTOR', 'ADMIN'];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(PUEDEN);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await ctx.params;

        // Por id Y por sede. Ver el comentario de emergency-card: la ruta
        // hermana comprobaba el rol y no el residente.
        const p = await prisma.patient.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            include: {
                headquarters: { select: { name: true, phone: true, address: true, billingAddress: true } },
                medications: {
                    where: { status: 'ACTIVE' },
                    include: { medication: { select: { name: true, dosage: true, route: true } } },
                    orderBy: { startDate: 'asc' },
                },
                primaryFamilyMember: { select: { name: true, phone: true, relationship: true } },
                intakeData: { select: { allergies: true, diagnoses: true } },
            },
        });
        if (!p) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        // "N/A" no es una alergia. Ver src/lib/alergias.ts.
        const alergias = p.intakeData?.allergies;
        const contacto = p.primaryFamilyMember;

        const pdf = generarTrasladoPDF({
            nombre: p.name.trim(),
            habitacion: p.roomNumber,
            // Con los helpers de UTC: la fecha de nacimiento se guarda a
            // medianoche UTC y leerla en local devuelve el dia anterior.
            fechaNacimiento: p.dateOfBirth ? fechaNacimientoLarga(p.dateOfBirth) : null,
            edad: p.dateOfBirth ? edadEnAnios(p.dateOfBirth) : null,
            alergias: textoDeAlergias(alergias),
            alergiasSinDocumentar: alergiasSinDocumentar(alergias),
            diagnosticos: p.intakeData?.diagnoses ?? null,
            dieta: p.diet ?? null,
            dialisis: p.needsDialysis,
            modalidadCuidado: p.careModality ?? null,
            hospitalPreferido: p.preferredHospital ?? null,
            seguro: {
                plan: p.insurancePlanName ?? null,
                poliza: p.insurancePolicyNumber ?? null,
                medicare: p.medicareNumber ?? null,
                medicaid: p.medicaidNumber ?? null,
            },
            contacto: contacto ? { name: contacto.name, phone: contacto.phone ?? '', relationship: contacto.relationship ?? '' } : null,
            hogar: {
                nombre: p.headquarters?.name ?? 'Hogar',
                telefono: p.headquarters?.phone ?? null,
                direccion: p.headquarters?.address ?? p.headquarters?.billingAddress ?? null,
            },
            medicamentos: p.medications.map(pm => ({
                name: pm.medication.name,
                dosage: pm.medication.dosage,
                route: pm.medication.route,
                frequency: pm.frequency,
                instructions: pm.instructions,
            })),
            generadoAt: new Date(),
        });

        logPhiAccess({
            action: 'EXPORT',
            resourceType: 'TrasladoEmergencia',
            patientId: p.id,
            hqId: auth.headquartersId,
            userId: auth.id,
            routePath: '/api/corporate/patients/[id]/emergency-card/pdf',
            context: { medicamentos: p.medications.length, alergiasDocumentadas: !alergiasSinDocumentar(alergias) },
        });

        const slug = p.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return new NextResponse(Buffer.from(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="traslado-${slug}-${new Date().toISOString().slice(0, 10)}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('PDF de traslado:', error);
        return NextResponse.json({ success: false, error: 'No se pudo generar el documento' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { logError } from '@/lib/logger';
import { generateContinuityPDF, ContinuityResident } from '@/lib/continuity-pdf';
import { lineaModalidad } from '@/lib/cuidado-final';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sedes/[id]/continuity-pdf
 *
 * Hoja de Continuidad Operativa: censo + eMAR vigente + alergias + cuidados
 * especiales, para que un hogar suspendido pueda operar en papel SIN trabajar
 * de memoria. Se entrega al suspender la sede.
 *
 * Contiene PHI por necesidad — es justamente el punto. Queda registrado en el
 * audit log: quién lo generó, para qué sede y cuántos residentes incluía.
 *
 * Auth: SUPER_ADMIN.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        /**
         * SUPER_ADMIN para cualquier sede; enfermeria y direccion para la suya.
         *
         * Nacio solo para SUPER_ADMIN porque su escenario era una suspension por
         * facturacion: Zendity corta el servicio y le entrega el paquete al
         * hogar desde fuera. Pero el 29-ago-2026 el escenario real fue otro —el
         * login caido— y quien necesitaba el paquete estaba DENTRO, sin poder
         * pedirselo a nadie.
         *
         * Andres aporto el dato que decide esto: durante la caida el si pudo
         * entrar desde su telefono. El acceso no se cae parejo, asi que cuanta
         * mas gente pueda generarlo, mas probable que alguien lo consiga cuando
         * empiece a fallar.
         *
         * Cada quien solo la SUYA. Esto lleva PHI de todos los residentes de una
         * sede: un supervisor de Cupey no descarga el censo de Mayaguez.
         */
        const auth = await requireRole(['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'NURSE', 'SUPERVISOR']);
        if (auth instanceof NextResponse) return auth;
        const invokerId = auth.id;

        const { id } = await params;
        if (auth.role !== 'SUPER_ADMIN' && id !== auth.headquartersId) {
            return NextResponse.json(
                { success: false, error: 'Solo puedes generar el paquete de tu propia sede' },
                { status: 403 },
            );
        }
        const hq = await prisma.headquarters.findUnique({ where: { id }, select: { name: true } });
        if (!hq) return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });

        // Residentes presentes o con cama reservada: los hospitalizados
        // regresan y su medicación sigue vigente.
        const patients = await prisma.patient.findMany({
            where: { headquartersId: id, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
            select: {
                name: true, roomNumber: true, status: true, diet: true,
                needsDialysis: true, requiresPosturalChanges: true, nortonRisk: true,
                careModality: true, hospiceProvider: true,
                intakeData: { select: { allergies: true } },
                pressureUlcers: {
                    where: { status: { not: 'RESOLVED' } },
                    select: { stage: true, bodyLocation: true },
                },
                medications: {
                    where: { isActive: true, status: 'ACTIVE' },
                    select: {
                        frequency: true, scheduleTimes: true, instructions: true,
                        medication: { select: { name: true, dosage: true } },
                    },
                },
            },
            orderBy: { roomNumber: 'asc' },
        });

        const residents: ContinuityResident[] = patients.map(p => {
            const alerts: string[] = [];
            if (p.status === 'TEMPORARY_LEAVE') alerts.push('Fuera de la facilidad (hospital/permiso)');
            for (const u of p.pressureUlcers) alerts.push(`UPP estadio ${u.stage} en ${u.bodyLocation}`);
            if (p.requiresPosturalChanges) alerts.push('Rotación postural c/2h');
            else if (p.nortonRisk) alerts.push('Riesgo Norton — vigilar piel');
            if (p.needsDialysis) alerts.push('Diálisis periódica');
            // Objetivos de cuidado en el papel de continuidad de la sede.
            const mod = lineaModalidad(p.careModality, p.hospiceProvider);
            if (mod) alerts.push(mod);

            return {
                name: p.name.trim(),
                roomNumber: p.roomNumber,
                allergies: p.intakeData?.allergies?.trim() || null,
                diet: p.diet?.trim() || null,
                alerts,
                meds: p.medications.map(m => ({
                    name: m.medication.name,
                    dosage: m.medication.dosage,
                    instructions: m.instructions,
                    // scheduleTimes es CSV o JSON según antigüedad del registro.
                    times: parseTimes(m.scheduleTimes, m.frequency),
                })),
            };
        });

        const pdf = generateContinuityPDF({
            hqName: hq.name,
            generatedAt: new Date(),
            residents,
        });

        await logAudit({
            headquartersId: id,
            performedById: invokerId,
            action: 'AUDIT_REPORT_SENT',
            entityName: 'ContinuitySheet',
            entityId: id,
            resourceName: `Hoja de continuidad — ${hq.name}`,
            payloadChanges: {
                residents: residents.length,
                meds: residents.reduce((s, r) => s + r.meds.length, 0),
            },
            request: req,
        });

        const fileDate = new Date().toISOString().slice(0, 10);
        const safe = hq.name.replace(/[^a-zA-Z0-9]/g, '_');
        return new NextResponse(pdf as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Continuidad_${safe}_${fileDate}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: any) {
        logError('admin.sedes.continuity-pdf', err);
        return NextResponse.json({ success: false, error: 'Error generando la hoja de continuidad' }, { status: 500 });
    }
}

/** scheduleTimes puede venir como JSON `["08:00"]` o CSV `"08:00, 14:00"`. */
function parseTimes(raw: string, frequency: string): string[] {
    if (frequency === 'PRN') return ['PRN — por razón necesaria'];
    if (!raw) return [];
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
        } catch { /* cae al CSV */ }
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
}

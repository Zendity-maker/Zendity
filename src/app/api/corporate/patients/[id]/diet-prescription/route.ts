import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { DietTexture } from '@prisma/client';
import { buildLegacyDietString, DIET_PEG_DENSIDADES } from '@/lib/diet';

/**
 * PUT /api/corporate/patients/[id]/diet-prescription
 *
 * Endpoint canónico del Sprint Diet System. Reemplaza al viejo
 * /api/corporate/patients/[id]/diet (que escribía Patient.diet string libre
 * con vocabularios drift).
 *
 * Body:
 *   {
 *     dietTexture:    DietTexture | null,
 *     dietDiabetic:   boolean,
 *     dietLowSodium:  boolean,
 *     dietRenal:      boolean,
 *     dietVegetarian: boolean
 *   }
 *
 * Escribe:
 *   - Patient.dietTexture + 4 flags (fuente de verdad nueva)
 *   - Patient.diet (string legacy, sincronizado para back-compat durante
 *     la transición; consumers viejos siguen funcionando)
 *
 * Audit: PHI WRITE — withPhiAccessLog automático.
 */

const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const VALID_TEXTURES: ReadonlyArray<DietTexture> = [
    'REGULAR', 'BLANDA', 'MAJADA', 'PUREE', 'LICUADO', 'LIQUIDOS_CLAROS', 'PEG',
];

export const PUT = withPhiAccessLog(putDietPrescriptionHandler, {
    resourceType: 'DietPrescription',
    getPatientId: async ({ params }) => (await params).id,
});

async function putDietPrescriptionHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await req.json();

    // Validar dietTexture (acepta null o uno de los valores del enum)
    const dietTexture: DietTexture | null = body.dietTexture ?? null;
    if (dietTexture !== null && !VALID_TEXTURES.includes(dietTexture)) {
        return NextResponse.json(
            { success: false, error: `dietTexture inválida: ${dietTexture}` },
            { status: 400 }
        );
    }

    // Coerce flags a boolean (defensive — JSON puede traer strings, undefined, etc.)
    const dietDiabetic   = Boolean(body.dietDiabetic);
    const dietLowSodium  = Boolean(body.dietLowSodium);
    const dietRenal      = Boolean(body.dietRenal);
    const dietVegetarian = Boolean(body.dietVegetarian);

    /**
     * Densidad de la fórmula enteral. Solo con PEG: en una dieta oral no
     * significa nada, y guardarla ahí dejaría un valor que la cocina leería
     * como si fuera una orden.
     *
     * Vocabulario cerrado a propósito (DIET_PEG_DENSIDADES). El sistema de
     * dietas existe justamente porque tres pantallas escribían texto libre con
     * vocabularios incompatibles; abrir este campo repetiría esa historia.
     */
    let dietPegKcalMl: number | null = null;
    if (dietTexture === 'PEG' && body.dietPegKcalMl != null) {
        const valor = Number(body.dietPegKcalMl);
        if (!DIET_PEG_DENSIDADES.includes(valor as any)) {
            return NextResponse.json(
                { success: false, error: `Densidad inválida: ${body.dietPegKcalMl}. Válidas: ${DIET_PEG_DENSIDADES.join(', ')}` },
                { status: 400 }
            );
        }
        dietPegKcalMl = valor;
    }

    // Tenant check — paciente debe pertenecer a la sede del invocador
    const existing = await prisma.patient.findFirst({
        where: { id, headquartersId: auth.headquartersId },
        select: { id: true },
    });
    if (!existing) {
        return NextResponse.json(
            { success: false, error: 'Residente no encontrado' },
            { status: 404 }
        );
    }

    // Mantener Patient.diet legacy sincronizado para back-compat.
    // El día que dropeemos la columna, esto se borra.
    const legacyDietString = buildLegacyDietString({
        dietTexture, dietDiabetic, dietLowSodium, dietRenal, dietVegetarian, dietPegKcalMl,
    });

    const patient = await prisma.patient.update({
        where: { id },
        data: {
            dietTexture,
            dietDiabetic,
            dietLowSodium,
            dietRenal,
            dietVegetarian,
            dietPegKcalMl,
            diet: legacyDietString, // sync legacy
        },
        select: {
            id: true, dietTexture: true, dietDiabetic: true, dietLowSodium: true,
            dietRenal: true, dietVegetarian: true, dietPegKcalMl: true, diet: true,
        },
    });

    return NextResponse.json({ success: true, patient });
}

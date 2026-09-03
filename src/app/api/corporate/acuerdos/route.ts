import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { textoBAA, BAA_VERSION } from '@/lib/baa-texto';
import { hashContenido, baaPlano } from '@/lib/acuerdos-sede';

/**
 * Acuerdos de la sede del invocador: leer y aceptar.
 *
 * La sede sale SIEMPRE de la sesion, nunca del body: aceptar un acuerdo por
 * otra sede seria firmar en nombre ajeno.
 */

const ROLES = ['DIRECTOR', 'ADMIN'];

async function sedeDelInvocador() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { error: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 }) };
    const role = (session.user as any).role;
    if (!ROLES.includes(role)) {
        return { error: NextResponse.json({ success: false, error: 'Solo el director o el administrador de la sede pueden firmar acuerdos' }, { status: 403 }) };
    }
    const hqId = (session.user as any).headquartersId as string | undefined;
    if (!hqId) return { error: NextResponse.json({ success: false, error: 'Tu usuario no tiene sede asignada' }, { status: 400 }) };
    return { hqId, userId: (session.user as any).id as string, nombre: (session.user as any).name as string };
}

export async function GET() {
    try {
        const auth = await sedeDelInvocador();
        if ('error' in auth) return auth.error;

        const hq = await prisma.headquarters.findUnique({
            where: { id: auth.hqId },
            select: { id: true, name: true, billingAddress: true, createdAt: true },
        });
        if (!hq) return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });

        // El texto se arma en cada lectura con los datos vigentes de la sede.
        // servicioDesde = cuando se creo la sede en Zendity. Si el hogar lleva
        // meses usando la plataforma, el acuerdo lo hace constar en vez de fingir
        // que la relacion empezo el dia de la firma.
        const doc = textoBAA({ hqNombre: hq.name, hqDireccion: hq.billingAddress, servicioDesde: hq.createdAt });

        const acuerdos = await prisma.acuerdoSede.findMany({
            where: { headquartersId: hq.id },
            select: {
                id: true, tipo: true, version: true, aceptadoEn: true,
                firmanteNombre: true, firmanteCargo: true,
                aceptadoPor: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const baa = acuerdos.find(a => a.tipo === 'BAA' && a.aceptadoEn);

        return NextResponse.json({
            success: true,
            sede: { nombre: hq.name },
            baa: { version: BAA_VERSION, titulo: doc.titulo, secciones: doc.secciones },
            aceptado: baa ?? null,
            acuerdos,
        });
    } catch (e: any) {
        console.error('[acuerdos GET]', e);
        return NextResponse.json({ success: false, error: 'Error de lectura' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await sedeDelInvocador();
        if ('error' in auth) return auth.error;

        const { tipo, firmanteNombre, firmanteCargo } = await req.json();
        if (tipo !== 'BAA') {
            return NextResponse.json({ success: false, error: 'Tipo de acuerdo no soportado' }, { status: 400 });
        }
        // El nombre tecleado ES la firma. Si no coincide con nadie, no hay
        // constancia de quien acepto — se exige explicito, no una casilla.
        if (!String(firmanteNombre ?? '').trim() || !String(firmanteCargo ?? '').trim()) {
            return NextResponse.json({ success: false, error: 'Escribe tu nombre completo y tu cargo para firmar' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: auth.hqId },
            select: { name: true, billingAddress: true, createdAt: true },
        });
        if (!hq) return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });

        const yaAceptado = await prisma.acuerdoSede.findFirst({
            where: { headquartersId: auth.hqId, tipo: 'BAA', version: BAA_VERSION, aceptadoEn: { not: null } },
            select: { id: true },
        });
        if (yaAceptado) {
            return NextResponse.json({ success: false, error: 'Esta versión del acuerdo ya fue aceptada' }, { status: 409 });
        }

        // Hash del texto exacto que se le mostro, no de una plantilla generica.
        const hash = hashContenido(baaPlano({ hqNombre: hq.name, hqDireccion: hq.billingAddress, servicioDesde: hq.createdAt }));
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('x-real-ip') ?? null;

        const acuerdo = await prisma.acuerdoSede.upsert({
            where: { headquartersId_tipo_version: { headquartersId: auth.hqId, tipo: 'BAA', version: BAA_VERSION } },
            update: {
                aceptadoEn: new Date(),
                aceptadoPorId: auth.userId,
                firmanteNombre: String(firmanteNombre).trim(),
                firmanteCargo: String(firmanteCargo).trim(),
                aceptadoIp: ip,
                contenidoHash: hash,
            },
            create: {
                headquartersId: auth.hqId,
                tipo: 'BAA',
                version: BAA_VERSION,
                contenidoHash: hash,
                aceptadoEn: new Date(),
                aceptadoPorId: auth.userId,
                firmanteNombre: String(firmanteNombre).trim(),
                firmanteCargo: String(firmanteCargo).trim(),
                aceptadoIp: ip,
            },
            select: { id: true, aceptadoEn: true, firmanteNombre: true, version: true },
        });

        return NextResponse.json({ success: true, acuerdo });
    } catch (e: any) {
        console.error('[acuerdos POST]', e);
        return NextResponse.json({ success: false, error: 'No se pudo registrar la firma' }, { status: 500 });
    }
}

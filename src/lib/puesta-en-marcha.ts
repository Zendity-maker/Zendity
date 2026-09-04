/**
 * PUESTA EN MARCHA DE UNA SEDE
 * ────────────────────────────
 * Después del alta, una sede nueva necesita varias cosas antes de poder operar:
 * el BAA firmado, personal, grupos de color, horario, residentes. Hasta
 * sep-2026 nada lo decía. Vivid Mayagüez se levantó y quedó vacía, sin ninguna
 * pantalla que dijera por dónde empezar ni qué faltaba.
 *
 * Mismo principio que el contador del PAI: **cada paso se calcula contra la
 * realidad**, no se marca a mano. Si alguien añade una cuidadora, el paso se
 * completa solo. Nadie tiene que acordarse de tachar nada, y por lo tanto nadie
 * puede tacharlo sin haberlo hecho.
 *
 * Los pasos van en el orden en que hay que hacerlos, no por importancia: sin
 * BAA no se puede registrar a nadie, sin personal no hay quien cuide, sin
 * grupos de color el tablet no sabe a quién mostrarle qué residente.
 */
import { prisma } from '@/lib/prisma';
import { tieneBAAaceptado } from '@/lib/acuerdos-sede';

export interface PasoPuestaEnMarcha {
    clave: string;
    titulo: string;
    /** Qué significa y por qué hace falta. */
    porque: string;
    hecho: boolean;
    /** Sin esto la sede no puede operar en absoluto. */
    bloqueante: boolean;
    /** Cuántos hay, cuando el paso es de cantidad. */
    detalle?: string;
    /** A dónde ir a resolverlo. */
    ruta?: string;
}

export interface PuestaEnMarcha {
    sede: string;
    pasos: PasoPuestaEnMarcha[];
    completados: number;
    total: number;
    /** true cuando no queda ningún bloqueante. */
    puedeOperar: boolean;
}

export async function puestaEnMarcha(hqId: string): Promise<PuestaEnMarcha> {
    const hq = await prisma.headquarters.findUnique({
        where: { id: hqId },
        select: {
            name: true, logoUrl: true, brandPrimary: true, colorFloorMap: true,
            phone: true, address: true, billingAddress: true,
        },
    });
    if (!hq) throw new Error('Sede no encontrada');

    const [baa, contrato, personal, cuidadoras, clinico, residentes, horarios] = await Promise.all([
        tieneBAAaceptado(hqId),
        prisma.saaSContract.count({ where: { headquartersId: hqId } }),
        prisma.user.count({ where: { headquartersId: hqId, isActive: true } }),
        prisma.user.count({ where: { headquartersId: hqId, isActive: true, role: 'CAREGIVER' } }),
        prisma.user.count({
            where: {
                headquartersId: hqId, isActive: true,
                OR: [{ role: 'NURSE' }, { role: 'SUPERVISOR' }, { secondaryRoles: { has: 'NURSE' } }],
            },
        }),
        prisma.patient.count({ where: { headquartersId: hqId, status: 'ACTIVE' } }),
        prisma.schedule.count({ where: { headquartersId: hqId, status: 'PUBLISHED' } }),
    ]);

    const pasos: PasoPuestaEnMarcha[] = [
        {
            clave: 'CONTRATO',
            titulo: 'Contrato de servicio',
            porque: 'Define cuántas camas se contrataron y cuánto se factura al mes.',
            hecho: contrato > 0,
            bloqueante: false,
            ruta: '/admin',
        },
        {
            clave: 'BAA',
            titulo: 'Acuerdo de Asociado Comercial (BAA)',
            porque: 'Requisito de HIPAA. Sin él, Zéndity no puede recibir información de salud: no se puede registrar ni un residente.',
            hecho: baa,
            bloqueante: true,
            ruta: '/corporate/acuerdos',
        },
        {
            clave: 'DATOS_SEDE',
            titulo: 'Datos de contacto de la sede',
            porque: 'Teléfono y dirección salen en el formulario de traslado de emergencia que va con el residente al hospital, en el PAI y en las evaluaciones de Trabajo Social.',
            // `address` es la dirección física del hogar; `billingAddress`, la
            // postal. Vale cualquiera de las dos —muchos hogares tienen una
            // sola— y se prefiere la física, que es la que el hospital
            // necesita. Mismo criterio que ya usaba el PDF de evaluaciones de
            // Trabajo Social.
            //
            // Antes esto miraba `billingAddress` a secas, y el teléfono lo
            // buscaba en `phone` mientras la única casilla de la pantalla
            // escribía `ownerPhone` —el del dueño. Andrés llenó el teléfono y
            // el paso siguió diciendo que faltaba.
            hecho: !!hq.phone && !!(hq.address || hq.billingAddress),
            bloqueante: false,
            detalle: [!hq.phone && 'falta teléfono', !(hq.address || hq.billingAddress) && 'falta dirección'].filter(Boolean).join(', ') || undefined,
            ruta: '/corporate/sedes',
        },
        {
            clave: 'MARCA',
            titulo: 'Logo y colores',
            porque: 'Es lo que ve la familia en cada correo. Sin esto, los correos salen con la paleta genérica de Zéndity.',
            hecho: !!hq.logoUrl && !!hq.brandPrimary,
            bloqueante: false,
            ruta: '/corporate/sedes',
        },
        {
            clave: 'CUIDADORAS',
            titulo: 'Cuidadoras registradas',
            porque: 'Sin personal de cuido no hay quien registre baños, medicamentos ni rotaciones.',
            hecho: cuidadoras > 0,
            bloqueante: true,
            detalle: `${cuidadoras} registrada${cuidadoras === 1 ? '' : 's'}`,
            ruta: '/hr/staff',
        },
        {
            clave: 'CLINICO',
            titulo: 'Enfermería o supervisión',
            porque: 'Alguien tiene que aprobar planes de cuido, revisar observaciones y cerrar turnos. Una cuidadora no puede hacerlo sola.',
            hecho: clinico > 0,
            bloqueante: true,
            detalle: `${clinico} persona${clinico === 1 ? '' : 's'}`,
            ruta: '/hr/staff',
        },
        {
            clave: 'GRUPOS_COLOR',
            titulo: 'Grupos de color por piso',
            porque: 'El tablet decide qué residentes le muestra a cada cuidadora según su color. Sin el mapa, ve una lista sin orden.',
            hecho: !!hq.colorFloorMap,
            bloqueante: false,
            ruta: '/corporate/sedes',
        },
        {
            clave: 'HORARIO',
            titulo: 'Primer horario publicado',
            porque: 'Sin turnos publicados nadie puede iniciar su jornada en el tablet.',
            hecho: horarios > 0,
            bloqueante: false,
            detalle: `${horarios} publicado${horarios === 1 ? '' : 's'}`,
            ruta: '/hr/schedule',
        },
        {
            clave: 'RESIDENTES',
            titulo: 'Primer residente admitido',
            porque: 'Con esto la sede empieza a operar de verdad.',
            hecho: residentes > 0,
            bloqueante: false,
            detalle: `${residentes} activo${residentes === 1 ? '' : 's'}`,
            ruta: '/corporate/patients/intake',
        },
    ];

    const completados = pasos.filter(p => p.hecho).length;
    return {
        sede: hq.name,
        pasos,
        completados,
        total: pasos.length,
        puedeOperar: pasos.filter(p => p.bloqueante).every(p => p.hecho),
    };
}

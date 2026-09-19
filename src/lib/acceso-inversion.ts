/**
 * QUIÉN PUEDE VER LOS NÚMEROS DEL NEGOCIO.
 *
 * Nace el 16-sep-2026. Hasta hoy el área de inversión se protegía con una lista
 * de roles —`['INVESTOR','ADMIN','DIRECTOR','SUPER_ADMIN']`— copiada palabra por
 * palabra en dos archivos (la ruta de KPIs y la pantalla). Por esa lista pasaban
 * 5 cuentas activas, y una era Celia Sierra, DIRECTOR de Cupey, que no es dueña
 * de nada: escribiendo la URL veía el margen, el punto de equilibrio, la
 * estructura de costos y la proyección del negocio de su patrón.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA REGLA
 *
 * Entra quien es SUPER_ADMIN —es Zendity, la empresa—, quien POSEE al menos una
 * sede (`Headquarters.ownerId`), o quien tiene un `SedeVinculo`. Nadie más. El
 * rol DIRECTOR por sí solo deja de bastar.
 *
 * DOS COSAS QUE NO SE HACEN AQUÍ, Y POR QUÉ:
 *
 *  1. NO hay correos ni ids en el código. El permiso lo decide la fila de la
 *     base, para que el día que se venda una sede o entre un socio el acceso
 *     cambie sin desplegar. Una lista de correos habría que recordar tocarla.
 *
 *  2. El rol INVESTOR NO entra por sí mismo. El único inversionista real (CG)
 *     entra por su vínculo con Mayagüez, que es un dato comprobable. Un usuario
 *     creado con rol INVESTOR bajo una sede donde esa persona no invierte vería
 *     los números sin que ningún dato lo justifique: el rol dice cómo se usa la
 *     app, no de qué es dueño.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERMISO NO ES ALCANCE
 *
 * No confundir con el OR de `investors/kpis` que arma `targetHqs`. Ese incluye
 * `{ id: auth.headquartersId }` —la sede de ADSCRIPCIÓN— porque responde a otra
 * pregunta: qué sedes entran en los números de quien YA pasó. Aquí se contesta
 * si pasa o no, y la sede donde a alguien lo dieron de alta para trabajar no le
 * da participación en el negocio. Por eso esta consulta mira SOLO propiedad y
 * vínculo.
 *
 * Tampoco se filtra por `isActive` de la sede: quien es dueño lo es aunque la
 * sede esté cerrada. Lo que se le enseña ya lo acota el alcance.
 */
import { prisma } from '@/lib/prisma';

/** Lo mínimo que hace falta para decidir: sale igual de `requireRole` que de la sesión de servidor. */
export interface ActorInversion {
    id: string;
    role: string;
}

/**
 * ¿Esta persona puede entrar al área de inversión?
 *
 * Una sola consulta: `count` sobre sedes donde es dueña O está vinculada.
 */
export async function puedeVerInversion(actor: ActorInversion | null | undefined): Promise<boolean> {
    if (!actor?.id) return false;

    // Zendity entra siempre: opera el producto y necesita ver lo que ve el
    // cliente para sostenerlo.
    if (actor.role === 'SUPER_ADMIN') return true;

    const sedesSuyas = await prisma.headquarters.count({
        where: {
            OR: [
                // Dueña de la sede.
                { ownerId: actor.id },
                // O vinculada sin poseerla: un socio puede tener participación
                // en varias sedes sin ser dueño de ninguna. Ver SedeVinculo.
                { vinculos: { some: { userId: actor.id } } },
            ],
        },
    });

    return sedesSuyas > 0;
}

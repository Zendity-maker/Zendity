import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * QUÉ SEDE ES LA TUYA CUANDO PIDES OTRA.
 *
 * Este archivo decide, en cada request, sobre qué sede trabaja el invocador.
 * Lo importan 38 ficheros de `src/app/api` con 48 llamadas (medido el
 * 16-sep-2026), y 13 de ellas ESCRIBEN con un hqId que llega del request:
 * el body de un PUT o la query de un GET.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO QUE COMPROBABA ANTES, Y LO QUE PERMITÍA
 *
 * Para un rol multi-sede (DIRECTOR/ADMIN) con un `requestedHqId`, la
 * comprobación era una sola:
 *
 *     findFirst({ where: { id: requestedHqId, isActive: true } })
 *
 * O sea: que la sede EXISTA y esté ACTIVA. Nunca que sea TUYA. Ni ownerId, ni
 * SedeVinculo, ni la sede donde te dieron de alta.
 *
 * Con eso, Celia Sierra —DIRECTOR de Cupey, directora clínica, que no posee
 * ninguna sede— podía cambiar el hqId de la petición y escribir en Mayagüez:
 *
 *   · `corporate/expenses/route.ts:108` (PUT) → `monthlyExpense.deleteMany` +
 *     `upsert`: la estructura de costos de la otra sede.
 *   · `corporate/growth/route.ts:100` (PUT) → resuelve `body.hqId` y en la
 *     línea 128 hace `monthlyGrowthSnapshot.deleteMany(...)`: BORRA el embudo
 *     comercial de un mes de la sede que le pidas.
 *
 * El dueño aprobó QUÉ puede hacer Celia (sí, toca costos y embudo). No aprobó
 * DE QUIÉN son los datos. Esa es la línea que se arregla aquí, y solo esa: no
 * se le quita ningún permiso sobre Cupey.
 *
 * La puerta ya estaba cerrada con llave por un lado: el conmutador de sede
 * (`AppLayout.tsx:1386`) se alimenta de `GET /api/corporate/headquarters`, que
 * en su línea 50 ya filtra `OR: [{ id: miHqId }, { ownerId: miUserId }]`. A
 * Celia la UI solo le ofrece Cupey. Lo que faltaba era que el servidor
 * aplicara la misma regla cuando el hqId llega por otra vía.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA REGLA AHORA
 *
 * Una sede es tuya si se cumple una de tres: es tu sede de ADSCRIPCIÓN, la
 * POSEES (`Headquarters.ownerId`), o tienes un `SedeVinculo` con ella. Sigue
 * exigiéndose `isActive`, como antes.
 *
 * Medido en producción el 16-sep-2026 (2 sedes, las 2 activas, las 2 con
 * `ownerId = ff718a04-…`; 1 solo `SedeVinculo` en toda la base):
 *
 *   andrestyflores@gmail.com  DIRECTOR Cupey    → Cupey SÍ, Mayagüez SÍ (ownerId)
 *   vividmayaguez@gmail.com   DIRECTOR Mayagüez → Cupey NO,  Mayagüez SÍ (adscripción)
 *   sierracelia55@gmail.com   DIRECTOR Cupey    → Cupey SÍ,  Mayagüez NO  ← el bug
 *
 * El caso que no se podía romper queda intacto: el dueño entra a Mayagüez por
 * `ownerId`, no por adscripción.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HERMANA, PERO NO LA MISMA: `src/lib/acceso-inversion.ts`
 *
 * `puedeVerInversion` resuelve un OR parecido (ownerId OR SedeVinculo) y por
 * eso NO se reutiliza aquí: le falta a propósito el tercer término.
 *
 *   · Aquella contesta «¿tienes participación en el negocio?» y EXCLUYE la
 *     adscripción a propósito — si la incluyera, Celia entraría al panel de
 *     inversión a ver el margen de su patrón.
 *   · Esta contesta «¿puedes trabajar en esta sede?» e INCLUYE la adscripción
 *     obligatoriamente — Celia tiene que poder operar Cupey.
 *
 * Son dos preguntas distintas con dos respuestas distintas para la misma
 * persona y la misma sede. Compartir la consulta habría significado arreglar
 * una y romper la otra dentro de seis meses. Si tocas una, lee la otra.
 */

/**
 * Roles a los que se les permite cambiar de sede.
 *
 * NO se amplía en este cambio, a propósito. SUPER_ADMIN e INVESTOR siguen
 * anclados a su sede de adscripción por este mismo corte, igual que antes —
 * el conmutador de la UI tampoco se les ofrece (`ActiveHqContext.tsx:7`).
 * Si algún día se les quiere dar, basta añadirlos aquí: la regla de abajo ya
 * los contempla (SUPER_ADMIN pasa siempre; el inversionista, por su
 * `SedeVinculo`). Este parche hace una sola cosa.
 */
const MULTI_HQ_ROLES = ["DIRECTOR", "ADMIN"] as const;

/**
 * El rechazo tiene que ser legible.
 *
 * Sigue siendo un `Error` lanzado, y el mensaje sigue viajando en `e.message`,
 * porque 27 de los 48 callsites hacen `catch (e) { … e.message || 'Sede
 * inválida' … status: 400 }`. Cambiar el contrato obligaría a tocar las 38
 * rutas, y no se tocan.
 *
 * Lo que se añade es `code` y `status` para que una ruta pueda mapear a 403 —
 * que es lo correcto: el id es válido, lo que falla es el permiso— sin
 * comparar cadenas en español. Hoy nadie los lee todavía.
 *
 * LOS OTROS 21 CALLSITES, EN 17 FICHEROS, NO ENSEÑAN ESTE MENSAJE (recontado
 * el 19-sep-2026 emparejando cada `try` con su `catch` por llaves, no por
 * indentación: 27 devuelven `e.message`, 18 no, y 3 no tienen try/catch
 * alguno). Se reparten en tres formas, no una:
 *
 *  · 16 caen en el catch externo de la función y salen como 500 genérico —
 *    `patients/route.ts:39` "Failed to fetch patients",
 *    `corporate/estado-hoy/route.ts:34` "Error interno",
 *    `hr/staff/route.ts:182` "Failed to fetch staff".
 *  · 2 SÍ tienen catch propio y devuelven 400, pero con texto fijo en vez del
 *    mensaje: `corporate/facility-health/route.ts:36` ("Sede inválida") e
 *    `care/supervisor/inbox-count/route.ts:38` (`{ count: 0 }`, sin texto).
 *    Esos no quedan mudos, quedan sordos: el 400 es correcto y el motivo no.
 *  · 3 NO tienen try/catch en absoluto y el throw sale como rechazo no
 *    capturado de Next, sin cuerpo JSON: `corporate/staff/caregivers:14`,
 *    `corporate/onboarding-status:31` y `care/zone-inspection:15`. Son tres,
 *    no uno — conviene saberlo antes de mandar a nadie a arreglar "la ruta".
 *
 * Eso es una pantalla muda: la persona ve un error de sistema donde debería
 * leer "no tienes acceso a esa sede". NO se arregla desde aquí —son 17 ficheros
 * ajenos—, y por eso existe `esSedeNoAccesible`: el arreglo por ruta son tres
 * líneas en su catch. Lista completa de los 21 en el informe de revisión.
 *
 * Hoy nadie legítimo debería llegar a ellos: el conmutador
 * (`contexts/ActiveHqContext.tsx:70`) solo ofrece lo que devuelve
 * `GET /api/corporate/headquarters`, que ya filtra por adscripción+ownerId, y
 * valida el localStorage contra esa lista (`:105`). El 500 es el camino del
 * que manipula el hqId a mano, no el de la directora.
 */
export class SedeNoAccesibleError extends Error {
    readonly code = "SEDE_NO_ACCESIBLE";
    readonly status = 403;
    readonly sedePedida: string;

    constructor(sedePedida: string) {
        // Un solo mensaje para "no existe", "inactiva" y "no es tuya". No se
        // distinguen a propósito: decirle a quien prueba ids cuál existe es
        // enumeración, y además obligaría a una segunda consulta.
        super("No tienes acceso a esa sede");
        this.name = "SedeNoAccesibleError";
        this.sedePedida = sedePedida;
    }
}

/** Para que una ruta pueda devolver 403 sin comparar mensajes. */
export function esSedeNoAccesible(e: unknown): e is SedeNoAccesibleError {
    return e instanceof SedeNoAccesibleError;
}

function readUser(session: Session): { id: string | null; role: string; hqId: string } {
    const user = session.user as any;
    const role = user?.role as string | undefined;
    const hqId = user?.headquartersId as string | undefined;
    const id = (user?.id as string | undefined) ?? null;
    if (!role) throw new Error("Sesión sin rol");
    if (!hqId) throw new Error("Usuario sin sede asignada");
    // `id` se lee suave: solo hace falta cuando alguien pide OTRA sede, y ese
    // camino lo comprueba. Las rutas que arman una sesión sintética —
    // `medical/handovers/route.ts:38` pasa `{ user: auth }` con el SessionUser
    // de `requireRole`— sí lo traen (`api-auth.ts:12`).
    return { id, role, hqId };
}

function isMultiHq(role: string): boolean {
    return (MULTI_HQ_ROLES as readonly string[]).includes(role);
}

/**
 * EL hqId TIENE QUE SER UNA CADENA. Si no, toda la regla de arriba no sirve.
 *
 * La firma dice `string | null | undefined`, pero TypeScript no existe en
 * runtime y 9 de los 48 callsites —en 8 ficheros; `encuestas` lo hace dos
 * veces— le pasan un valor que sale crudo de
 * `await req.json()` — o sea, del cuerpo que manda el navegador:
 *
 *   corporate/expenses:108, corporate/growth:100, corporate/encuestas:47 y :118,
 *   corporate/crm:63, corporate/settings/integrations:79, audit:51,
 *   hr/staff:197, kitchen/menu:89
 *
 * Si ahí llega un OBJETO, Prisma NO lo trata como un id: lo trata como un
 * filtro de cadena. `where: { id: { not: 'zzz' } }` casa con TODAS las sedes,
 * el `OR` de abajo lo satisface tu PROPIA sede de adscripción, la comprobación
 * dice «sí, es tuya» y la función devuelve el objeto intacto. La ruta lo mete
 * entonces donde esperaba un id —`where: { headquartersId: hqId }`— y el
 * filtro deja de acotar a una sede.
 *
 * Comprobado contra producción el 16-sep-2026 con la sesión real de Celia
 * (DIRECTOR de Cupey, no posee ninguna sede), corriendo esta misma consulta:
 *
 *   'cfbb214a-…' (Mayagüez, cadena) → NIEGA   ← la regla nueva funciona
 *   { not: 'zzz' }                  → PASA    ← y se la salta entera
 *   { in: [Cupey, Mayagüez] }       → PASA
 *   { contains: '' }                → PASA
 *   { startsWith: '' }              → PASA
 *
 * Con ese valor, el `monthlyExpense.deleteMany` de `corporate/expenses:108`
 * alcanza las 32 filas de estructura de costos que hay hoy (20 de Cupey + 12
 * de Mayagüez) en vez de las 20 suyas. Mismo camino en
 * `corporate/growth:128` sobre `monthlyGrowthSnapshot`.
 *
 * Esto NO es regresión del cambio: la comprobación vieja
 * (`findFirst({ id: requestedHqId, isActive: true })`) se lo tragaba igual.
 * Pero deja el arreglo en nada justo en las rutas que ESCRIBEN, que son las
 * que motivaron el arreglo. Por eso se cierra aquí y no en las 8 rutas: una
 * cadena no puede convertirse en operador de Prisma, y este es el único sitio
 * por el que pasan todas.
 */
function esIdDeSede(v: unknown): v is string {
    return typeof v === "string";
}

/**
 * ¿Puede esta persona trabajar sobre esta sede?
 *
 * UNA consulta, no una por candidato: el `some` de `vinculos` baja a un
 * EXISTS dentro del mismo SELECT. Corre en cada request de 38 rutas.
 */
async function sedeEsSuya(actorId: string, sessionHqId: string, hqId: string): Promise<boolean> {
    const sede = await prisma.headquarters.findFirst({
        where: {
            id: hqId,
            isActive: true,
            OR: [
                // Donde te dieron de alta para trabajar.
                { id: sessionHqId },
                // Donde eres el dueño. Así agrupa el dueño sus dos sedes.
                { ownerId: actorId },
                // Vinculada sin poseerla (hoy: un inversionista con Mayagüez).
                { vinculos: { some: { userId: actorId } } },
            ],
        },
        select: { id: true },
    });
    return sede !== null;
}

/**
 * Las sedes sobre las que esta persona puede ver datos.
 *
 * Devuelve `'TODAS'` solo para SUPER_ADMIN —es Zendity, la empresa—, y si no
 * la lista de ids. El OR de abajo es el mismo que el de `sedeEsSuya`.
 *
 * DONDE **NO** COINCIDE CON `sedeEsSuya`, Y HAY QUE SABERLO ANTES DE ADOPTARLA:
 * aquí no hay corte por `MULTI_HQ_ROLES`. El OR se aplica a cualquier rol, y
 * `resolveEffectiveHqId` en cambio devuelve la sede de adscripción y punto a
 * todo el que no sea DIRECTOR/ADMIN. Medido contra producción el 19-sep-2026
 * con el único INVESTOR real (`c.gonzalez.esmeril@gmail.com`, adscrito a Cupey,
 * `SedeVinculo` con Mayagüez — el único vínculo de toda la base):
 *
 *   sedesVisiblesPara   → [Cupey, Mayagüez]   (entra por el vínculo)
 *   resolveEffectiveHqId → Cupey              (no es multi-sede, se ancla)
 *
 * La misma persona y dos respuestas. No es un bug hoy: `resolveHqFilter` corta
 * por `isMultiHq` antes de llamar aquí, así que por dentro del fichero solo la
 * alcanzan DIRECTOR/ADMIN, donde las dos coinciden. Pero está exportada, y quien
 * la ponga en una ruta a la que entre un INVESTOR le estará ampliando el alcance
 * sin quererlo. Si eso pasa, el corte de rol va en la ruta o aquí — decidirlo,
 * no heredarlo.
 */
export async function sedesVisiblesPara(session: Session): Promise<string[] | "TODAS"> {
    const { id: actorId, role, hqId: sessionHqId } = readUser(session);

    if (role === "SUPER_ADMIN") return "TODAS";
    if (!actorId) return [sessionHqId];

    // `take` explícito (antipatrón 11). Hoy son 2 sedes; el tope es para que
    // el día que sean muchas esto no cargue la tabla entera. Si alguna vez se
    // alcanza, el filtro truncaría en silencio — por eso avisa.
    const TOPE = 200;
    const sedes = await prisma.headquarters.findMany({
        where: {
            isActive: true,
            OR: [
                { id: sessionHqId },
                { ownerId: actorId },
                { vinculos: { some: { userId: actorId } } },
            ],
        },
        select: { id: true },
        take: TOPE,
    });
    if (sedes.length === TOPE) {
        console.warn(`[hq-resolver] sedesVisiblesPara alcanzó el tope de ${TOPE}: el filtro puede estar truncando sedes`);
    }

    // Nunca vacío: la sede de adscripción entra siempre, salvo que esté
    // inactiva, y en ese caso devolverla igual haría ver datos de una sede
    // apagada. Si está inactiva, la lista queda vacía y no se ve nada.
    return sedes.map(s => s.id);
}

/**
 * Devuelve un hqId concreto (siempre string, nunca 'ALL').
 *
 * Reglas:
 *  - SUPERVISOR/CAREGIVER/NURSE/etc. → SIEMPRE su propia sede, ignora requestedHqId.
 *  - DIRECTOR/ADMIN sin requestedHqId o con 'ALL' → su propia sede.
 *  - DIRECTOR/ADMIN con requestedHqId → tiene que ser SUYA (adscripción,
 *    ownerId o SedeVinculo) y estar activa. Si no, lanza SedeNoAccesibleError.
 *
 * Para endpoints que necesitan un hqId único (ej. el tablet del caregiver,
 * el schedule builder, el supervisor live).
 */
export async function resolveEffectiveHqId(
    session: Session,
    requestedHqId?: string | null
): Promise<string> {
    const { id: actorId, role, hqId: sessionHqId } = readUser(session);

    if (!isMultiHq(role)) {
        return sessionHqId;
    }

    if (!requestedHqId || requestedHqId === "ALL") {
        return sessionHqId;
    }

    // Lo primero, antes de tocar la base: que sea una cadena. Un objeto se
    // convertiría en filtro de Prisma y anularía la comprobación entera —
    // ver `esIdDeSede` arriba, con lo medido. Nadie legítimo llega aquí con
    // otra cosa: los GET traen `searchParams.get()`, que es string o null.
    if (!esIdDeSede(requestedHqId)) {
        console.warn(
            `[hq-resolver] hqId no es una cadena, rechazado: actor=${actorId} rol=${role} sesion=${sessionHqId} tipo=${typeof requestedHqId}`
        );
        throw new SedeNoAccesibleError("(hqId inválido)");
    }

    // Pedir la propia sede por su id no necesita consulta: es la misma
    // respuesta que no pedir nada, y ahorra una query en el caso más común
    // (el conmutador manda siempre el id, incluso el de tu propia sede).
    //
    // Efecto secundario conocido y aceptado: este atajo NO comprueba
    // `isActive`, así que un director de una sede desactivada que mande su
    // propio id ya no es rechazado — antes sí lo era. Se acepta porque los
    // otros dos caminos hacia la sede propia (sin hqId, y 'ALL') nunca la
    // comprobaron tampoco: dejarlo estricto solo aquí haría que la misma
    // pantalla funcionara o no según mandara el id o lo omitiera. La sede
    // suspendida se corta antes, en `requireSession` (402).
    if (requestedHqId === sessionHqId) {
        return sessionHqId;
    }

    if (!actorId) {
        // Sin id no se puede comprobar propiedad. Se niega el cambio de sede y
        // se sigue con la propia: fallar hacia lo tuyo, nunca hacia lo ajeno.
        throw new SedeNoAccesibleError(requestedHqId);
    }

    if (!(await sedeEsSuya(actorId, sessionHqId, requestedHqId))) {
        // Sin PHI y sin secretos: ids y rol. Que alguien pida una sede ajena
        // es justo el evento que hay que poder ver después.
        console.warn(
            `[hq-resolver] sede ajena rechazada: actor=${actorId} rol=${role} sesion=${sessionHqId} pedida=${requestedHqId}`
        );
        throw new SedeNoAccesibleError(requestedHqId);
    }

    return requestedHqId;
}

/**
 * Devuelve un filtro de Prisma acotado a lo que esta persona puede ver.
 *
 * Reglas:
 *  - Todo rol que no sea DIRECTOR/ADMIN → `{ headquartersId: su sede }`, sin
 *    importar requestedHqId. SUPER_ADMIN incluido, ver abajo.
 *  - DIRECTOR/ADMIN con 'ALL' o sin requestedHqId → `{ headquartersId: { in: [sus sedes] } }`.
 *  - DIRECTOR/ADMIN con requestedHqId → `{ headquartersId: validado }`.
 *
 * EL CORTE DE ROL TIENE QUE SER EL MISMO QUE EL DE `resolveEffectiveHqId`.
 * Una versión anterior de este parche dejaba pasar a SUPER_ADMIN aquí (para
 * darle `{}` en 'ALL') pero no allí, y el resultado era peor que el bug que
 * venía a arreglar: con un hqId concreto, esta función delega en
 * `resolveEffectiveHqId`, que a un rol NO multi-sede le devuelve SIEMPRE su
 * propia sede. O sea que un SUPER_ADMIN pidiendo Mayagüez recibía
 * `{ headquartersId: Cupey }` — las filas de otra sede, sin error y sin aviso,
 * rotuladas como las que pidió. Mientras `MULTI_HQ_ROLES` no incluya a
 * SUPER_ADMIN, este `if` tampoco puede incluirlo.
 *
 * (`sedesVisiblesPara` sí le dice 'TODAS' a SUPER_ADMIN, y no es contradicción:
 * esa contesta "qué sedes puedes VER en una lista" —la misma regla que ya
 * aplica `corporate/headquarters/route.ts:46`— y ésta contesta "sobre cuál
 * OPERAS". Son las dos preguntas de siempre.)
 *
 * ANTES 'ALL' devolvía `{}` —literalmente TODAS las sedes del sistema— para
 * cualquier DIRECTOR. Hoy no se nota porque las 2 sedes son del mismo dueño;
 * el día que entre un segundo cliente, cada director vería los agregados del
 * otro. Ahora 'ALL' significa "todas las que ESTA persona puede ver": para el
 * dueño siguen siendo las dos, para Celia pasa a ser solo Cupey.
 *
 * OJO: hoy NADIE importa esta función (comprobado el 16-sep-2026:
 * `grep -rn "resolveHqFilter" src/` fuera de este fichero → 0 resultados). Se
 * corrige en vez de borrarse para que nadie la adopte mañana creyendo que la
 * versión con `{}` era la buena. El `{}` que sí está vivo lo arman a mano las
 * rutas que llaman `resolveEffectiveHqIdOrAll` — ver el informe.
 */
export async function resolveHqFilter(
    session: Session,
    requestedHqId?: string | null
): Promise<{ headquartersId: string } | { headquartersId: { in: string[] } } | {}> {
    const { role, hqId: sessionHqId } = readUser(session);

    // Mismo corte que `resolveEffectiveHqId`, a propósito. Ver la cabecera.
    if (!isMultiHq(role)) {
        return { headquartersId: sessionHqId };
    }

    if (!requestedHqId || requestedHqId === "ALL") {
        const visibles = await sedesVisiblesPara(session);
        if (visibles === "TODAS") return {};
        return { headquartersId: { in: visibles } };
    }

    const effective = await resolveEffectiveHqId(session, requestedHqId);
    return { headquartersId: effective };
}

/**
 * Helper de conveniencia: devuelve un literal `'ALL' | string` para endpoints
 * que necesitan distinguir ambos casos explícitamente en su lógica (ej.
 * /api/corporate, /api/corporate/trends que exponen effectiveHqId en la respuesta).
 *
 * El caso concreto queda validado por `resolveEffectiveHqId`, así que hereda
 * la regla nueva. El literal 'ALL' NO: los 3 llamadores lo materializan cada
 * uno a su manera (dos de ellos en un `{}`), y arreglarlo es tocar esas rutas.
 * Ver el informe — no se tocan desde aquí.
 */
export async function resolveEffectiveHqIdOrAll(
    session: Session,
    requestedHqId?: string | null
): Promise<string | "ALL"> {
    const { role } = readUser(session);
    if (!isMultiHq(role)) {
        const { hqId } = readUser(session);
        return hqId;
    }
    if (!requestedHqId || requestedHqId === "ALL") {
        return "ALL";
    }
    // Valida contra DB
    return await resolveEffectiveHqId(session, requestedHqId);
}

/**
 * La misma resolución, pero devolviendo el 403 ya armado en vez de lanzar.
 *
 * Existe porque `SedeNoAccesibleError` pasó a ser un camino NORMAL —antes de
 * hoy, pedir una sede ajena simplemente funcionaba— y 21 llamadores lo
 * convierten en un 500 genérico. Tres de ellos ni siquiera tienen `try/catch`:
 * el rechazo salía como excepción no capturada de Next, sin cuerpo JSON.
 *
 * La forma es la de `requireRole` (src/lib/api-auth.ts), que es como el resto
 * del repo lee una guarda:
 *
 *     const hqId = await resolverSedeOResponder(session, pedido);
 *     if (hqId instanceof NextResponse) return hqId;
 *
 * Migrar un llamador son dos líneas. Los que sigan con `resolveEffectiveHqId`
 * funcionan igual: lo que cambia es qué ve quien manipula el hqId a mano.
 */
export async function resolverSedeOResponder(
    session: Session,
    requestedHqId?: string | null,
): Promise<string | NextResponse> {
    try {
        return await resolveEffectiveHqId(session, requestedHqId);
    } catch (e) {
        if (esSedeNoAccesible(e)) {
            return NextResponse.json({ success: false, error: e.message }, { status: e.status });
        }
        throw e;
    }
}

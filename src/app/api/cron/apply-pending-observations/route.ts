import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { IncidentStatus } from '@prisma/client';
import { aplicarObservacion } from '@/lib/incidente-aplicar';
import { HORAS_PARA_RESPONDER, avisadoEn, puedeAplicarse } from '@/lib/incidente-politica';

// Vercel Cron: cada 6 horas (vercel.json: "0 */6 * * *")
// Aplica automáticamente las observaciones PENDING_EXPLANATION
// que no recibieron respuesta del empleado en 72 horas.
//
// ESTE CRON DECIDE CUÁNDO, NUNCA CUÁNTO.
//
// Hasta el 13-sep-2026 decidía las dos cosas y las dos mal: contaba el plazo
// desde `createdAt` —la fecha del BORRADOR del supervisor, no la del aviso al
// empleado—, no miraba el acuse, usaba una tabla de puntos que /decide había
// abandonado, y no dejaba ni una fila en ScoreEvent. Medido ese día: 49 de las
// 83 aplicadas salieron de aquí, con 70 puntos escritos donde correspondían
// 217, y CERO ScoreEvent de las 49. Los puntos y el aviso ahora los pone
// src/lib/incidente-aplicar.ts, el mismo que usa el director.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no configurado en entorno' }, { status: 500 });
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Firma CRON inválida' }, { status: 401 });
    }

    try {
        const now = new Date();

        /**
         * Se traen TODAS las pendientes sin respuesta y el plazo se mide en
         * memoria, no en el `where`.
         *
         * Porque el reloj no es una sola columna: `notifiedAt` lo escribe
         * "Pedir explicación", pero el patrón de ausencias
         * (/api/hr/schedule/absent) crea la observación ya visible y avisa al
         * empleado en el mismo acto, así que ahí el reloj es `createdAt`. Ver
         * `avisadoEn()`. Y si no consta que se le avisara, no se aplica: un
         * plazo no puede correr contra alguien que no sabe que existe.
         *
         * El volumen lo permite de sobra: el 13-sep-2026 había DOS
         * observaciones en este estado en toda la producción.
         */
        const pendientes = await prisma.incidentReport.findMany({
            where: {
                status: IncidentStatus.PENDING_EXPLANATION,
                employeeResponse: null,
            },
            include: {
                employee: {
                    // isActive/isDeleted: hacen falta para no aplicarle el
                    // descuento a quien ya no puede entrar a contestar. Ver la
                    // guarda CUENTA_CERRADA abajo.
                    select: { id: true, name: true, complianceScore: true, isActive: true, isDeleted: true }
                },
                hq: { select: { name: true } }
            }
        });

        const saltadas: { id: string; employee: string; motivo: string }[] = [];
        const overdue = pendientes.filter(i => {
            const desde = avisadoEn(i);
            if (!desde) {
                saltadas.push({ id: i.id, employee: i.employee?.name ?? i.employeeId, motivo: 'SIN_AVISAR' });
                return false;
            }

            /**
             * CUENTA CERRADA — el plazo no corre contra quien no tiene puerta.
             *
             * Es el mismo argumento que SIN_AVISAR dos líneas más arriba, con
             * otra causa: allí el plazo corría contra alguien que no sabía que
             * existía; aquí corre contra alguien que lo sabe y NO PUEDE
             * responder, porque `src/lib/auth.ts` le contesta "Acceso Denegado.
             * Cuenta inactiva." al intentar entrar.
             *
             * Medido el 21-sep-2026: de las DIEZ observaciones sin respuesta
             * que hay en toda la producción, CINCO son de cuentas cerradas
             * —Joaneliz Rosario ×3, Paola M. Maldonado y Dieudilta Macier—,
             * avisadas el 19-sep, con el plazo de 72 h venciendo el 22. Sin
             * esta guarda, mañana por la noche el cron le restaba 5 puntos a
             * cada una. Joaneliz está en 55 y se llevaba tres descuentos.
             *
             * Un expediente disciplinario contra alguien que ya se fue no
             * corrige nada ni lo sabe nadie: solo deja el historial mintiendo.
             * "Veracidad, no puntuación".
             *
             * Va a `saltadas` y no al `where` A PROPÓSITO: filtrarlas en la
             * consulta las haría desaparecer del informe del cron, y entonces
             * nadie sabría que hay cinco observaciones abiertas que ya no se
             * pueden cerrar por la vía normal. Se saltan diciéndolo.
             */
            if (i.employee && (i.employee.isActive === false || i.employee.isDeleted === true)) {
                saltadas.push({ id: i.id, employee: i.employee.name ?? i.employeeId, motivo: 'CUENTA_CERRADA' });
                return false;
            }
            const horas = (now.getTime() - desde.getTime()) / 3600000;
            if (horas < HORAS_PARA_RESPONDER) return false;

            // La misma guarda que el director: sin acuse ni rehúso hay que
            // haber esperado DIAS_ESPERA_ACUSE desde el aviso.
            const veredicto = puedeAplicarse(i, now);
            if (!veredicto.ok) {
                saltadas.push({ id: i.id, employee: i.employee?.name ?? i.employeeId, motivo: veredicto.code });
                return false;
            }
            return true;
        });

        if (saltadas.length > 0) {
            // Que no se apliquen en silencio ni se salten en silencio.
            console.warn('[cron/apply-pending-observations] saltadas:', JSON.stringify(saltadas));
        }

        if (overdue.length === 0) {
            return NextResponse.json({
                ok: true,
                message: 'Sin observaciones vencidas.',
                applied: 0,
                revisadas: pendientes.length,
                saltadas,
                runAt: now.toISOString(),
            });
        }

        const results: { id: string; employee: string; hq: string; status: string }[] = [];

        for (const incident of overdue) {
            try {
                // Los puntos, el ScoreEvent y el aviso, en el MISMO sitio que
                // usa el director. Aquí ya no se calcula nada.
                await aplicarObservacion(incident, { ahora: now, automatica: true });

                results.push({
                    id: incident.id,
                    employee: incident.employee?.name || incident.employeeId,
                    hq: incident.hq?.name || incident.headquartersId,
                    status: 'APPLIED',
                });

                console.log(`[cron/apply-pending-observations] APPLIED ${incident.id} — ${incident.employee?.name} (${incident.hq?.name})`);
            } catch (err: any) {
                console.error(`[cron/apply-pending-observations] Error en ${incident.id}:`, err.message);
                results.push({
                    id: incident.id,
                    employee: incident.employee?.name || incident.employeeId,
                    hq: incident.hq?.name || incident.headquartersId,
                    status: `ERROR: ${err.message}`,
                });
            }
        }

        const appliedCount = results.filter(r => r.status === 'APPLIED').length;

        return NextResponse.json({
            ok: true,
            message: `${appliedCount} observación(es) aplicada(s) automáticamente por vencimiento de ${HORAS_PARA_RESPONDER}h.`,
            applied: appliedCount,
            errors: results.length - appliedCount,
            revisadas: pendientes.length,
            saltadas,
            runAt: now.toISOString(),
            details: results,
        });

    } catch (error: any) {
        console.error('[cron/apply-pending-observations] error fatal:', error);
        return NextResponse.json(
            { error: 'Fallo interno en cron', detail: error.message },
            { status: 500 }
        );
    }
}

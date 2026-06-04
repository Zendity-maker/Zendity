/**
 * phi-audit — Audit trail de acceso a PHI (HIPAA Fase A · Pilar 1).
 *
 * Archivo dedicado y SEPARADO de src/lib/audit.ts (que registra eventos de
 * negocio). Aquí registramos TODO acceso a PHI: lecturas (requisito 2026),
 * escrituras, exports, eventos de auth y disclosures.
 *
 * Garantías de diseño:
 *  - NO bloquea el response: el INSERT a Postgres se difiere con `after()`
 *    de next/server (estable en Next 16) — corre tras enviar el response,
 *    dentro del mismo ciclo de la invocación serverless (Vercel espera a
 *    que termine antes de congelar la función → no-pérdida).
 *  - NUNCA propaga error al caller: cualquier fallo del audit se captura y
 *    se reporta vía logger.ts (no hay Sentry en el proyecto).
 *  - Fuera de scope de request (`after` lanza): degrada a fire-and-forget.
 *
 * Dos formas de uso:
 *  - logPhiAccess(params): llamada directa de bajo nivel (EXPORT en un PDF,
 *    DISCLOSURE a un vendor, casos especiales dentro de un handler).
 *  - withPhiAccessLog(handler, opts): envuelve un route handler del App
 *    Router; resuelve actor/contexto y registra automáticamente.
 *
 * NOTA sessionId: con strategy 'jwt' no hay tabla de sesiones ni jti estable
 * expuesto, así que sessionId queda null en esta fase (decisión consciente).
 */

import { after } from 'next/server';
import { Prisma, PhiAccessAction } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';
import { getSessionUser } from '@/lib/api-auth';

export interface LogPhiAccessParams {
    action: PhiAccessAction;
    /** 'Patient', 'eMAR', 'Vital', 'Note', 'CarePlan', 'PatientList', etc. */
    resourceType: string;
    resourceId?: string | null;
    patientId?: string | null;
    userId?: string | null;
    /** Snapshot del rol al momento del acceso (el rol puede cambiar después). */
    userRole?: string | null;
    hqId?: string | null;
    success?: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
    sessionId?: string | null;
    routePath?: string | null;
    context?: Record<string, unknown> | null;
}

/**
 * Escribe la fila. Envuelto en try/catch — NUNCA propaga: si el audit falla,
 * la operación principal del usuario no se ve afectada.
 */
async function writeRow(p: LogPhiAccessParams): Promise<void> {
    try {
        await prisma.phiAccessLog.create({
            data: {
                action: p.action,
                resourceType: p.resourceType,
                resourceId: p.resourceId ?? null,
                patientId: p.patientId ?? null,
                userId: p.userId ?? null,
                userRole: p.userRole ?? null,
                hqId: p.hqId ?? null,
                success: p.success ?? true,
                ipAddress: p.ipAddress ?? null,
                userAgent: p.userAgent ?? null,
                sessionId: p.sessionId ?? null,
                routePath: p.routePath ?? null,
                context: p.context
                    ? (p.context as Prisma.InputJsonValue)
                    : undefined,
            },
        });
    } catch (err) {
        // Non-fatal: el fallo de auditoría nunca rompe la operación principal.
        logError('phi-audit.write', err, {
            action: p.action,
            resourceType: p.resourceType,
            patientId: p.patientId ?? null,
        });
    }
}

/**
 * Difiere `fn` para correr tras el response (no bloquea). Si estamos fuera
 * de scope de request, `after` lanza → degradamos a fire-and-forget.
 */
function deferAfterResponse(fn: () => Promise<void>): void {
    try {
        after(fn);
    } catch {
        void fn().catch(() => { });
    }
}

/**
 * Encola un registro de acceso a PHI y retorna de inmediato (no async).
 */
export function logPhiAccess(params: LogPhiAccessParams): void {
    deferAfterResponse(() => writeRow(params));
}

// ─────────────────────────────────────────────────────────────────────────
// Wrapper de route handlers
// ─────────────────────────────────────────────────────────────────────────

type RouteContext<P extends Record<string, string> = Record<string, string>> = {
    params: Promise<P>;
};

type RouteHandler<P extends Record<string, string> = Record<string, string>> = (
    req: Request,
    ctx: RouteContext<P>,
) => Promise<Response>;

export interface WithPhiAccessOpts<P extends Record<string, string> = Record<string, string>> {
    resourceType: string;
    /** Default por método: GET→READ, POST/PUT/PATCH→WRITE, DELETE→DELETE. */
    action?: PhiAccessAction | ((method: string) => PhiAccessAction);
    /** Extrae patientId — SOLO de params/query/URL, JAMÁS de req.body (rompe el stream). */
    getPatientId?: (ctx: { req: Request; params: Promise<P> }) => string | undefined | Promise<string | undefined>;
    getResourceId?: (ctx: { req: Request; params: Promise<P> }) => string | undefined | Promise<string | undefined>;
}

function defaultAction(method: string): PhiAccessAction {
    switch (method.toUpperCase()) {
        case 'GET':
            return PhiAccessAction.READ;
        case 'DELETE':
            return PhiAccessAction.DELETE;
        case 'POST':
        case 'PUT':
        case 'PATCH':
            return PhiAccessAction.WRITE;
        default:
            return PhiAccessAction.READ;
    }
}

function extractIp(req: Request): string | null {
    const fwd = req.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0]?.trim() || null;
    return req.headers.get('x-real-ip');
}

/**
 * Envuelve un route handler para registrar el acceso a PHI.
 *
 * El handler conserva su propia auth (requireRole) intacta — este wrapper
 * solo audita; no añade ni cambia controles de acceso.
 *
 * El actor (userId/userRole/hqId) se resuelve antes del response (requiere
 * scope de request para leer la sesión), pero el INSERT del log se difiere
 * con `after()` → el response no espera por la escritura.
 */
export function withPhiAccessLog<P extends Record<string, string> = Record<string, string>>(
    handler: RouteHandler<P>,
    opts: WithPhiAccessOpts<P>,
): RouteHandler<P> {
    return async (req: Request, routeCtx: RouteContext<P>): Promise<Response> => {
        const method = req.method;
        const action: PhiAccessAction =
            typeof opts.action === 'function'
                ? opts.action(method)
                : opts.action ?? defaultAction(method);

        const params = routeCtx?.params ?? (Promise.resolve({} as P));
        const extractCtx = { req, params };

        // Datos disponibles sin scope especial.
        const ipAddress = extractIp(req);
        const userAgent = req.headers.get('user-agent');
        let routePath: string | null = null;
        try {
            routePath = new URL(req.url).pathname;
        } catch {
            routePath = null;
        }

        // Helper que resuelve actor + ids y encola el log. success explícito.
        const record = async (success: boolean): Promise<void> => {
            let userId: string | null = null;
            let userRole: string | null = null;
            let hqId: string | null = null;
            try {
                const user = await getSessionUser();
                if (user) {
                    userId = user.id;
                    userRole = user.role;
                    hqId = user.headquartersId;
                }
            } catch {
                // sesión irresoluble → actor null, no rompemos el audit
            }

            let patientId: string | null = null;
            let resourceId: string | null = null;
            try {
                if (opts.getPatientId) patientId = (await opts.getPatientId(extractCtx)) ?? null;
                if (opts.getResourceId) resourceId = (await opts.getResourceId(extractCtx)) ?? null;
            } catch {
                // extractor falló → ids null, no rompemos el audit
            }

            logPhiAccess({
                action,
                resourceType: opts.resourceType,
                resourceId,
                patientId,
                userId,
                userRole,
                hqId,
                success,
                ipAddress,
                userAgent,
                sessionId: null,
                routePath,
            });
        };

        let res: Response;
        try {
            res = await handler(req, routeCtx);
        } catch (e) {
            // El handler lanzó: registramos el intento fallido y re-lanzamos.
            await record(false);
            throw e;
        }

        await record(res.status < 400);
        return res;
    };
}

/**
 * Logger estructurado mínimo.
 *
 * Por debajo usa console.error / console.warn / console.log porque Vercel Logs
 * (y la mayoría de plataformas) los capturan automáticamente. La diferencia
 * con un console.error pelado:
 *
 *   - Salida en JSON una línea, parseable por dashboards de logs.
 *   - Stack traces preservados (Error.stack).
 *   - Context arbitrario (hqId, userId, requestId, etc) bajo una key estable.
 *   - Severidad explícita (error/warn/info).
 *
 * Patrón de uso en route handlers:
 *
 *   import { logError } from '@/lib/logger';
 *   try { ... }
 *   catch (err) {
 *       logError('care.vitals.post', err, { hqId, userId, patientId });
 *       return NextResponse.json({ success: false, error: 'Error' }, { status: 500 });
 *   }
 *
 * Para errores soft (no rompen la transacción principal):
 *
 *   try { await notifyUser(...); }
 *   catch (e) { logWarn('care.vitals.notify', e, { userId }); }
 */

type LogContext = Record<string, unknown>;

function serializeError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
        };
    }
    if (typeof err === 'object' && err !== null) {
        try {
            return JSON.parse(JSON.stringify(err));
        } catch {
            return { value: String(err) };
        }
    }
    return { value: String(err) };
}

function emit(level: 'error' | 'warn' | 'info', scope: string, err: unknown, context?: LogContext) {
    const entry = {
        level,
        scope,
        ts: new Date().toISOString(),
        error: serializeError(err),
        ...(context ? { ctx: context } : {}),
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

export function logError(scope: string, err: unknown, context?: LogContext) {
    emit('error', scope, err, context);
}

export function logWarn(scope: string, err: unknown, context?: LogContext) {
    emit('warn', scope, err, context);
}

export function logInfo(scope: string, msg: string, context?: LogContext) {
    emit('info', scope, { message: msg }, context);
}

import { redirect } from 'next/navigation';

/**
 * Sprint P.4 — Redirect al wizard maestro.
 *
 * La ruta legacy /intake fue consolidada en /corporate/patients/intake.
 * El endpoint POST /api/intake sigue activo (con auth hardening) para
 * cualquier cliente externo que dependa de él, pero la UI legacy se
 * deprecó completamente.
 */
export default function DeprecatedIntakeRedirect() {
    redirect('/corporate/patients/intake');
}

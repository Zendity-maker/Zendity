import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

/**
 * /corporate/superadmin — Redirige al panel real del Super Admin.
 *
 * Esta página era el prototipo legacy sin autenticación (DEMO_SUPER_ADMIN_ID hardcodeado).
 * Fue reemplazado por /admin (CEO Dashboard con auth real). Mantenemos la ruta
 * para no romper bookmarks, redirigiendo según el rol del visitante.
 */
export default async function SuperAdminLegacyRedirect() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        redirect('/login');
    }

    const role = (session.user as any).role;

    if (role === 'SUPER_ADMIN') {
        redirect('/admin');
    }

    // Cualquier otro rol no tiene acceso a esta área
    redirect('/corporate');
}

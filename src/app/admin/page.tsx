import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';

/**
 * /admin — Panel del CEO de Zéndity Corp (admin.zendity.com).
 * Solo SUPER_ADMIN puede entrar. Ni ADMIN ni DIRECTOR ven esto.
 */
export default async function AdminPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') {
        redirect('/');
    }
    return <AdminDashboard userName={session.user.name || 'SuperAdmin'} />;
}

import HandoverForm from './HandoverForm';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

export default async function NursingHandoversPage() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        redirect('/login');
    }

    // @ts-ignore
    const hqId = session.user.headquartersId;
    
    // Fetch residents assigned to HQ
    const patients = await prisma.patient.findMany({
        where: { headquartersId: hqId, status: 'ACTIVE' },
        select: { id: true, name: true }
    });

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-extrabold text-slate-900">Módulo Clínico</h1>
                    <p className="mt-2 text-sm text-slate-500">Transición Digital de Cuidados y Reportes Clínicos</p>
                </div>
                <HandoverForm patients={patients} />
            </div>
        </div>
    );
}

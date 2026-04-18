import { prisma } from '@/lib/prisma';
import ShiftClosureClient from './ShiftClosureClient';
import {  ShiftType } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';


export default async function ShiftClosurePage() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        redirect('/login');
    }

    // @ts-ignore
    const hqId = session.user.headquartersId;
    
    // Server-side pre-validation query to inform the UI about current blockers
    const blockingTicketsCount = await prisma.triageTicket.count({
        where: { 
            headquartersId: hqId, 
            status: { not: 'RESOLVED' },
            priority: { in: ['HIGH', 'CRITICAL'] },
            isVoided: false
        }
    });

    // Check if nursing handover was submitted for current shift date.
    // todayStartAST() = ventana rodante de 24h, timezone-safe para AST (PR).
    // Evita el bug de setHours(0,0,0,0) que ancla a medianoche UTC y en la
    // tarde-noche de PR salta al "día siguiente" excluyendo el handover real.
    const todayMorning = todayStartAST();

    const handover = await prisma.nursingHandover.findFirst({
        where: {
            headquartersId: hqId,
            shiftDate: { gte: todayMorning },
            status: { in: ['SUBMITTED', 'ACCEPTED'] }
        }
    });

    const handoverExists = !!handover;

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="mb-4 text-center">
                    <h1 className="text-3xl font-extrabold text-slate-900">Operaciones Zendity</h1>
                    <p className="mt-2 text-sm text-slate-500">Módulo Administrativo de Cierre de Planta</p>
                </div>
                
                <ShiftClosureClient 
                    blockingTicketsCount={blockingTicketsCount} 
                    handoverExists={handoverExists} 
                />
            </div>
        </div>
    );
}

import { PrismaClient, TicketPriority } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { resolveTriageTicket } from '@/actions/operational/triage';
import Link from 'next/link';
import { ArrowLeftIcon, DocumentTextIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const prisma = new PrismaClient();

export default async function TriageInboxPage() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) redirect('/login');
    
    // @ts-ignore
    const hqId = session.user.headquartersId;

    const tickets = await prisma.triageTicket.findMany({
        where: { 
            headquartersId: hqId,
            status: { not: 'RESOLVED' },
            isVoided: false
        },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' }
        ]
    });

    return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-10 font-sans">
            <div className="max-w-[1400px] mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/corporate" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition mb-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                            <ArrowLeftIcon className="w-4 h-4" /> Volver al Dashboard
                        </Link>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tight">Centro de Triage</h1>
                        <p className="text-slate-500 font-medium mt-2 text-lg">Bandeja de Entrada Administrativa MVP (Server Actions)</p>
                    </div>
                    <div className="bg-white px-8 py-5 rounded-xl shadow-xl border border-slate-100 flex items-center gap-5">
                        <div className="w-16 h-16 bg-indigo-50 border-4 border-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-2xl">
                            {tickets.length}
                        </div>
                        <div>
                            <p className="font-black text-slate-800 text-xl">Tickets Activos</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4">
                    {tickets.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                            No hay tickets activos. Op. Normalizada.
                        </div>
                    ) : tickets.map(ticket => (
                        <div key={ticket.id} className={`p-6 bg-white rounded-2xl border-l-4 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center ${
                            ticket.priority === 'CRITICAL' ? 'border-red-500 bg-red-50/20' : 
                            ticket.priority === 'HIGH' ? 'border-amber-500' : 
                            'border-slate-300'
                        }`}>
                            <div className="space-y-2 flex-1">
                                <div className="flex gap-3 items-center">
                                    {ticket.priority === 'CRITICAL' && <ExclamationTriangleIcon className="w-5 h-5 text-red-600 animate-pulse" />}
                                    <span className={`text-xs font-black px-2 py-1 rounded-md ${
                                        ticket.priority === 'CRITICAL' ? 'bg-red-100 text-red-800 tracking-wider' : 
                                        ticket.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 
                                        'bg-slate-100 text-slate-700'
                                    }`}>
                                        {ticket.priority}
                                    </span>
                                    <span className="text-sm text-slate-500 font-medium">
                                        {new Date(ticket.createdAt).toLocaleString()}
                                    </span>
                                    {ticket.isEscalated && (
                                        <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                                            ESCALADO SLA &gt; 120m
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">
                                    {ticket.description}
                                </h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                    Origen: {ticket.originType}
                                </p>
                            </div>

                            <form action={async (formData) => {
                                "use server";
                                const note = formData.get('resolution') as string;
                                await resolveTriageTicket(ticket.id, note || 'Atendido rápidamente');
                            }} className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
                                <input required name="resolution" type="text" placeholder="Nota de resolución obligatoria..." className="flex-1 md:w-64 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner bg-slate-50" />
                                <button type="submit" className="bg-slate-900 hover:bg-black active:scale-95 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2">
                                    <DocumentTextIcon className="w-4 h-4" /> Firmar Resolución
                                </button>
                            </form>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

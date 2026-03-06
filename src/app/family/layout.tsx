import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FaHome, FaHeartbeat, FaCommentDots, FaSignOutAlt, FaSpa, FaFileInvoiceDollar } from "react-icons/fa";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "FAMILY") {
        redirect("/login");
    }

    const hqId = (session.user as any).headquartersId;
    const hq = await prisma.headquarters.findUnique({ where: { id: hqId } });
    const hqName = hq?.name || "Zendity Partner";
    const logoUrl = hq?.logoUrl || null;

    return (
        <div className="absolute inset-0 bg-slate-50 font-sans text-slate-800 overflow-y-auto w-full h-full pb-20">
            {/* Nav B2C - Mobile Friendly, Clean look */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-slate-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        <div className="flex items-center gap-3">
                            {logoUrl ? (
                                <img src={logoUrl} alt={hqName} className="h-10 object-contain" />
                            ) : (
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-rose-200">
                                    {hqName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex flex-col justify-center">
                                {!logoUrl && <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500">{hqName}</h1>}
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{!logoUrl ? "Portal Familiar" : "Portal Familiar"}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <Link href="/family" className="text-slate-500 hover:text-rose-500 transition-colors hidden sm:flex items-center gap-2 font-medium">
                                <FaHome /> Inicio
                            </Link>
                            <Link href="/family/concierge" className="text-slate-500 hover:text-indigo-500 transition-colors hidden sm:flex items-center gap-2 font-medium">
                                <FaSpa /> Concierge
                            </Link>
                            <Link href="/family/messages" className="text-slate-500 hover:text-rose-500 transition-colors hidden sm:flex items-center gap-2 font-medium">
                                <FaCommentDots /> Mensajes
                            </Link>
                            <Link href="/family/billing" className="text-slate-500 hover:text-indigo-900 transition-colors hidden sm:flex items-center gap-2 font-medium">
                                <FaFileInvoiceDollar /> Facturación
                            </Link>
                            <Link href="/api/auth/signout" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-all">
                                <FaSignOutAlt />
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main B2C Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-32 sm:pb-12">
                {children}
            </main>

            {/* Mobile Bottom Nav */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe z-50">
                <div className="flex justify-around items-center h-16">
                    <Link href="/family" className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-rose-500">
                        <FaHome className="text-xl mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Inicio</span>
                    </Link>
                    <Link href="/family/concierge" className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-indigo-500">
                        <FaSpa className="text-xl mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Concierge</span>
                    </Link>
                    <Link href="/family/messages" className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-rose-500">
                        <FaCommentDots className="text-xl mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Mensajes</span>
                    </Link>
                    <Link href="/family/billing" className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-indigo-900">
                        <FaFileInvoiceDollar className="text-xl mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Facturación</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

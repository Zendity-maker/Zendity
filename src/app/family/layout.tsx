import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Home,
    BookOpen,
    MessageCircle,
    Calendar,
    Receipt,
    LogOut,
    ShoppingBag,
    FileText,
} from "lucide-react";
import { prisma } from '@/lib/prisma';

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "FAMILY") {
        redirect("/login");
    }

    const hqId = (session.user as any).headquartersId;
    const hq = await prisma.headquarters.findUnique({ where: { id: hqId } });
    const hqName = hq?.name || "Zendity Partner";

    // Conteo de mensajes no leídos para badge en navegación
    let unreadMessages = 0;
    try {
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { patientId: true },
        });
        if (familyMember?.patientId) {
            unreadMessages = await prisma.familyMessage.count({
                where: { patientId: familyMember.patientId, senderType: 'STAFF', isRead: false },
            });
        }
    } catch { /* no-fatal */ }

    // mobile: true → visible en bottom nav mobile. false → solo desktop top nav.
    const navLinks = [
        { href: "/family", label: "Inicio", icon: Home, badge: 0, mobile: true },
        { href: "/family/feed", label: "Diario", icon: BookOpen, badge: 0, mobile: true },
        { href: "/family/messages", label: "Mensajes", icon: MessageCircle, badge: unreadMessages, mobile: true },
        { href: "/family/calendar", label: "Citas", icon: Calendar, badge: 0, mobile: true },
        { href: "/family/concierge", label: "Servicios", icon: ShoppingBag, badge: 0, mobile: true },
        { href: "/family/billing", label: "Facturación", icon: Receipt, badge: 0, mobile: false },
        { href: "/family/documents", label: "Documentos", icon: FileText, badge: 0, mobile: false },
    ];

    return (
        <div className="absolute inset-0 bg-[#FAFAF8] text-slate-800 overflow-y-auto w-full h-full pb-20 sm:pb-0">

            {/* ═══ TOP NAV — minimalista Propuesta C ═══════════════════════ */}
            <nav className="bg-white border-b border-stone-100 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-5 sm:px-8">
                    <div className="flex justify-between h-14 sm:h-16 items-center">

                        {/* Brand */}
                        <Link href="/family" className="flex items-center gap-2 group">
                            <span className="text-sm font-bold text-teal-700 tracking-widest">
                                ZÉNDITY
                            </span>
                            <span className="hidden sm:inline text-xs text-stone-400">
                                · {hqName}
                            </span>
                        </Link>

                        {/* Nav links desktop */}
                        <div className="hidden sm:flex items-center gap-1">
                            {navLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="relative flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium text-slate-500 hover:text-teal-700 transition-colors"
                                    >
                                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                                        <span>{link.label}</span>
                                        {link.badge > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                                {link.badge > 9 ? "9+" : link.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Sign out */}
                        <Link
                            href="/api/auth/signout"
                            className="flex items-center justify-center w-9 h-9 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                            title="Cerrar sesión"
                        >
                            <LogOut className="w-4 h-4" strokeWidth={1.5} />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ═══ MAIN CONTENT ═══════════════════════════════════════════ */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-32 sm:pb-12">
                {children}
            </main>

            {/* ═══ MOBILE BOTTOM NAV — Propuesta C ═══════════════════════ */}
            <div
                className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 z-50"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div className="flex justify-around items-stretch h-16">
                    {navLinks.filter(l => l.mobile).map((link) => {
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="relative flex flex-col items-center justify-center w-full text-slate-400 hover:text-teal-700 active:scale-95 transition-all"
                            >
                                <div className="relative">
                                    <Icon className="w-[22px] h-[22px] mb-0.5" strokeWidth={1.5} />
                                    {link.badge > 0 && (
                                        <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                            {link.badge > 9 ? "9+" : link.badge}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] font-medium">
                                    {link.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

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
} from "lucide-react";
import { prisma } from '@/lib/prisma';

// ── Helper: monograma del HQ (2 letras máx) ──
function hqMonogram(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join("");
}

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "FAMILY") {
        redirect("/login");
    }

    const hqId = (session.user as any).headquartersId;
    const hq = await prisma.headquarters.findUnique({ where: { id: hqId } });
    const hqName = hq?.name || "Zendity Partner";
    const logoUrl = hq?.logoUrl || null;

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

    const navLinks = [
        { href: "/family", label: "Inicio", icon: Home, badge: 0 },
        { href: "/family/feed", label: "Diario", icon: BookOpen, badge: 0 },
        { href: "/family/messages", label: "Mensajes", icon: MessageCircle, badge: unreadMessages },
        { href: "/family/calendar", label: "Citas", icon: Calendar, badge: 0 },
        { href: "/family/billing", label: "Facturación", icon: Receipt, badge: 0 },
    ];

    return (
        <div className="absolute inset-0 bg-stone-50 font-sans text-stone-800 overflow-y-auto w-full h-full pb-24 sm:pb-0">

            {/* ═══ TOP NAV — minimalista, editorial ═══════════════════════ */}
            <nav className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-stone-100">
                <div className="max-w-5xl mx-auto px-5 sm:px-8">
                    <div className="flex justify-between h-16 sm:h-20 items-center">

                        {/* Logo + nombre sede */}
                        <Link href="/family" className="flex items-center gap-3 group">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={hqName}
                                    className="h-9 sm:h-10 object-contain"
                                />
                            ) : (
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-display text-sm tracking-tight shadow-[0_4px_12px_-2px_rgba(15,110,120,0.25)]"
                                    style={{ background: "linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%)" }}
                                >
                                    {hqMonogram(hqName)}
                                </div>
                            )}
                            <div className="hidden sm:flex flex-col leading-tight">
                                <span className="font-display text-base text-stone-900 group-hover:text-teal-700 transition-colors">
                                    {hqName}
                                </span>
                                <span className="text-[10px] text-stone-400 tracking-wide">
                                    Portal Familiar
                                </span>
                            </div>
                        </Link>

                        {/* Nav links desktop */}
                        <div className="hidden sm:flex items-center gap-1">
                            {navLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="relative flex items-center gap-2 px-3 py-2 rounded-full text-sm text-stone-600 hover:text-teal-700 hover:bg-teal-50/60 transition-all"
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
                            className="flex items-center justify-center w-9 h-9 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all"
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

            {/* ═══ MOBILE BOTTOM NAV — refinado ═══════════════════════════ */}
            <div
                className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-stone-100 z-50"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div className="flex justify-around items-stretch h-[68px]">
                    {navLinks.slice(0, 4).map((link) => {
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="relative flex flex-col items-center justify-center w-full text-stone-500 hover:text-teal-700 active:scale-95 transition-all"
                            >
                                <div className="relative">
                                    <Icon className="w-[22px] h-[22px] mb-1" strokeWidth={1.5} />
                                    {link.badge > 0 && (
                                        <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                            {link.badge > 9 ? "9+" : link.badge}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] font-medium tracking-wide">
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

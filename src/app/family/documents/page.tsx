import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShieldAlert, CheckCircle2, FileText, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FamilyDocumentsPage() {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "FAMILY") {
        // /auth/signin nunca existió — la ruta canónica es /login.
        redirect("/login");
    }

    const documents = await prisma.legalDocument.findMany({
        where: { familyMemberId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: { patient: true }
    });

    const pending   = documents.filter((d: any) => d.status === "PENDING");
    const completed = documents.filter((d: any) => d.status === "SIGNED");

    return (
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16 sm:py-24">

                {/* ═══ MASTHEAD ═══════════════════════════════════════════ */}
                <header className="text-center mb-12">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-medium mb-6">
                        Documentos legales
                    </p>
                    <div className="flex justify-center mb-5">
                        <FileText className="w-14 h-14 text-teal-700" strokeWidth={1.25} />
                    </div>
                    <h1
                        className="font-serif text-stone-900 leading-[1.05] tracking-tight"
                        style={{
                            fontSize: "clamp(2.25rem, 7vw, 3.5rem)",
                            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                        }}
                    >
                        Documentos
                    </h1>
                    <div className="flex items-center justify-center gap-3 mt-5">
                        <span className="block w-12 h-px bg-stone-300" />
                        <span className="text-stone-300 text-xs">◆</span>
                        <span className="block w-12 h-px bg-stone-300" />
                    </div>
                    <p className="font-serif italic text-stone-500 text-sm mt-4 max-w-md mx-auto leading-relaxed">
                        Contratos y permisos clínicos que requieren tu revisión y firma.
                    </p>
                </header>

                {/* ═══ Pendientes de firma ═══════════════════════════════ */}
                {pending.length > 0 && (
                    <section className="mb-16">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-6 text-center flex items-center justify-center gap-2">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.5} />
                            Requieren tu firma · {pending.length}
                        </p>

                        <div className="max-w-lg mx-auto">
                            {pending.map((doc: any) => (
                                <Link
                                    key={doc.id}
                                    href={`/family/documents/${doc.id}`}
                                    className="group flex items-baseline justify-between py-5 border-b border-stone-200 last:border-b-0 hover:bg-stone-100/50 -mx-4 px-4 transition-colors"
                                >
                                    <div className="flex-1 pr-4">
                                        <p className="font-serif text-stone-900 text-xl tracking-tight group-hover:text-teal-700 transition-colors">
                                            {doc.title}
                                        </p>
                                        <p className="text-xs text-stone-400 italic font-serif mt-1">
                                            {doc.patient?.name} · expedido el {new Date(doc.createdAt).toLocaleDateString("es-PR", { day: "numeric", month: "long" })}
                                        </p>
                                    </div>
                                    <ArrowUpRight
                                        className="w-5 h-5 text-stone-300 group-hover:text-teal-600 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                                        strokeWidth={1.25}
                                    />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* ═══ Diamond separator si hay ambas secciones ════════ */}
                {pending.length > 0 && completed.length > 0 && (
                    <div className="flex justify-center py-8">
                        <span className="text-stone-300 text-base tracking-[1em]">◆ ◆ ◆</span>
                    </div>
                )}

                {/* ═══ Historial firmado ═══════════════════════════════ */}
                {completed.length > 0 && (
                    <section>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-6 text-center flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" strokeWidth={1.5} />
                            Historial firmado · {completed.length}
                        </p>

                        <div className="max-w-lg mx-auto">
                            {completed.map((doc: any) => (
                                <Link
                                    key={doc.id}
                                    href={`/family/documents/${doc.id}`}
                                    className="group flex items-baseline justify-between py-5 border-b border-stone-200 last:border-b-0 hover:bg-stone-100/50 -mx-4 px-4 transition-colors"
                                >
                                    <div className="flex-1 pr-4">
                                        <p className="font-serif text-stone-800 text-lg tracking-tight group-hover:text-teal-700 transition-colors">
                                            {doc.title}
                                        </p>
                                        <p className="text-xs text-stone-400 italic font-serif mt-1">
                                            Firmado el {doc.signedAt ? new Date(doc.signedAt).toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                                        </p>
                                    </div>
                                    <ArrowUpRight
                                        className="w-4 h-4 text-stone-300 group-hover:text-teal-600 transition-colors flex-shrink-0"
                                        strokeWidth={1.25}
                                    />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* ═══ Empty state ═══════════════════════════════════════ */}
                {documents.length === 0 && (
                    <div className="text-center py-20 max-w-md mx-auto">
                        <p
                            className="font-serif italic text-stone-500 leading-relaxed"
                            style={{ fontSize: "1.25rem" }}
                        >
                            No tienes documentos pendientes.
                        </p>
                        <p className="font-serif italic text-stone-400 text-sm mt-3">
                            Cuando el equipo te pida firmar algo, lo verás aquí.
                        </p>
                    </div>
                )}

                {/* ═══ COLOFÓN ═══════════════════════════════════════════ */}
                <footer className="text-center mt-20 sm:mt-28 pb-8 max-w-md mx-auto">
                    <p className="text-stone-300 text-xs tracking-[0.5em] mb-3">◆ ◆ ◆</p>
                    <p className="font-serif italic text-stone-400 text-xs leading-relaxed">
                        Todos los documentos firmados quedan respaldados<br />
                        legalmente con sello de tiempo.
                    </p>
                </footer>

            </div>
        </div>
    );
}

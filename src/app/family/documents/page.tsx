import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShieldAlert, CheckCircle2, FileText, FileSignature, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FamilyDocumentsPage() {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "FAMILY") {
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
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">

            {/* ═══ HEADER ═══ */}
            <div className="bg-white border-b border-stone-100 px-4 py-5">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-brand" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-slate-800 leading-tight">
                            Documentos
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Contratos y autorizaciones
                        </p>
                    </div>
                </div>
            </div>

            {/* ═══ BODY ═══ */}
            <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-28">

                {/* Pendientes */}
                {pending.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-amber-700 tracking-widest uppercase mb-3 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Requieren tu firma · {pending.length}
                        </p>
                        <div className="space-y-3">
                            {pending.map((doc: any) => (
                                <Link
                                    key={doc.id}
                                    href={`/family/documents/${doc.id}`}
                                    className="block bg-white rounded-2xl border border-slate-100 p-4 hover:border-brand/25 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                                            <FileSignature className="w-5 h-5 text-amber-700" strokeWidth={1.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-base font-semibold text-slate-800 leading-tight">
                                                {doc.title}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {doc.patient?.name} · {new Date(doc.createdAt).toLocaleDateString("es-PR", { day: "numeric", month: "long" })}
                                            </p>
                                        </div>
                                        <span className="bg-amber-50 text-amber-700 text-xs font-semibold rounded-full px-2.5 py-0.5 flex-shrink-0">
                                            Pendiente
                                        </span>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end">
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                                            Ver y firmar
                                            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Historial firmado */}
                {completed.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-brand" strokeWidth={1.5} />
                            Historial firmado · {completed.length}
                        </p>
                        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
                            {completed.map((doc: any) => (
                                <Link
                                    key={doc.id}
                                    href={`/family/documents/${doc.id}`}
                                    className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                                        <CheckCircle2 className="w-4 h-4 text-brand" strokeWidth={1.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
                                            {doc.title}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Firmado el {doc.signedAt ? new Date(doc.signedAt).toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" strokeWidth={2} />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {documents.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" strokeWidth={1.25} />
                        <p className="text-sm text-slate-500 font-medium">
                            No tienes documentos pendientes
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                            Cuando el equipo te pida firmar algo, lo verás aquí.
                        </p>
                    </div>
                )}

                {/* Nota inferior */}
                {documents.length > 0 && (
                    <p className="text-xs text-slate-400 text-center pt-4">
                        Todos los documentos firmados quedan respaldados legalmente con sello de tiempo.
                    </p>
                )}
            </div>
        </div>
    );
}

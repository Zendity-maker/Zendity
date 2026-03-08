import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { FileSignature, ShieldAlert, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FamilyDocumentsPage() {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "FAMILY") {
        redirect("/auth/signin");
    }

    const documents = await prisma.legalDocument.findMany({
        where: {
            familyMemberId: session.user.id
        },
        orderBy: {
            createdAt: "desc"
        },
        include: {
            patient: true
        }
    });

    const pending = documents.filter(d => d.status === "PENDING");
    const completed = documents.filter(d => d.status === "SIGNED");

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                    <FileSignature className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Documentos y Acuerdos
                    </h1>
                    <p className="text-gray-500">Revise y firme los contratos legales y permisos hospitalarios.</p>
                </div>
            </div>

            {pending.length > 0 && (
                <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 shadow-sm">
                    <h2 className="text-xl font-bold text-amber-800 mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5" />
                        Requieren su Firma ({pending.length})
                    </h2>
                    <div className="space-y-3">
                        {pending.map(doc => (
                            <div key={doc.id} className="bg-white p-4 rounded-xl border border-amber-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-800">{doc.title}</h3>
                                    <p className="text-sm text-gray-500">Residente: {doc.patient?.name} | Expedido: {doc.createdAt.toLocaleDateString()}</p>
                                </div>
                                <Link
                                    href={`/family/documents/${doc.id}`}
                                    className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2 rounded-lg transition-colors"
                                >
                                    Leer y Firmar
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {completed.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Historial de Archivos
                    </h2>
                    <div className="space-y-3">
                        {completed.map(doc => (
                            <div key={doc.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-600">{doc.title}</h3>
                                    <p className="text-sm text-gray-400">Firmado el: {doc.signedAt?.toLocaleDateString()}</p>
                                </div>
                                <Link
                                    href={`/family/documents/${doc.id}`}
                                    className="text-blue-500 hover:text-blue-600 font-medium px-4 py-2 border border-blue-100 bg-white rounded-lg transition-colors"
                                >
                                    Ver PDF Legal
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {documents.length === 0 && (
                <div className="text-center py-20">
                    <FileSignature className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-400">Su bóveda está vacía</h3>
                    <p className="text-gray-400">No hay documentos legales pendientes de firma.</p>
                </div>
            )}
        </div>
    );
}

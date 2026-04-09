"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function CaregiverProfilePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [certificates, setCertificates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.role !== "CAREGIVER") {
            router.replace("/care");
            return;
        }
        if (user?.id) {
            fetchCertificates();
        }
    }, [user]);

    const fetchCertificates = async () => {
        try {
            const hqId = user?.hqId || user?.headquartersId || "";
            const res = await fetch(`/api/academy?hqId=${hqId}&employeeId=${user?.id}`);
            const data = await res.json();
            if (data.success) {
                setCertificates(data.enrollments.filter((e: any) => e.status === "COMPLETED"));
            }
        } catch (e) {
            console.error("Error fetching certificates:", e);
        } finally {
            setLoading(false);
        }
    };

    const initials = user?.name
        ?.split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";

    return (
        <div className="min-h-screen bg-slate-900 text-white pb-20">
            {/* Header */}
            <div className="px-6 py-4">
                <button
                    onClick={() => router.push("/care")}
                    className="text-slate-400 hover:text-white text-sm font-medium flex items-center gap-2 transition-colors"
                >
                    ← Volver
                </button>
            </div>

            {/* Identidad */}
            <div className="flex flex-col items-center px-6 pt-4 pb-10">
                {user?.photoUrl ? (
                    <img
                        src={user.photoUrl}
                        alt={user.name}
                        className="w-24 h-24 rounded-full object-cover border-4 border-teal-500 shadow-lg mb-4"
                    />
                ) : (
                    <div className="w-24 h-24 rounded-full bg-teal-700 border-4 border-teal-500 flex items-center justify-center text-white font-black text-2xl shadow-lg mb-4">
                        {initials}
                    </div>
                )}
                <h1 className="text-xl font-semibold text-white mb-1">{user?.name || "Cuidadora"}</h1>
                <p className="text-teal-400 text-sm font-medium mb-1">Cuidadora</p>
                <p className="text-slate-400 text-sm">{user?.email || ""}</p>
            </div>

            {/* Certificados */}
            <div className="max-w-lg mx-auto px-6">
                <h2 className="text-white font-bold text-base mb-4">Certificados obtenidos</h2>

                {loading ? (
                    <div className="text-slate-500 text-sm text-center py-8 animate-pulse">Cargando certificados...</div>
                ) : certificates.length === 0 ? (
                    <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700">
                        <p className="text-slate-400 text-sm mb-4">
                            Aun no tienes certificados. Completa un curso en Academy!
                        </p>
                        <Link
                            href="/academy"
                            className="inline-block bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
                        >
                            Ir a Academy
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {certificates.map((cert: any) => (
                            <div
                                key={cert.id}
                                className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4"
                            >
                                <div className="w-10 h-10 bg-teal-900 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-lg">🎓</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-sm truncate">
                                        {cert.course?.title || "Curso"}
                                    </p>
                                    <p className="text-slate-400 text-xs">
                                        {cert.completedAt
                                            ? new Date(cert.completedAt).toLocaleDateString("es-PR", {
                                                  year: "numeric",
                                                  month: "long",
                                                  day: "numeric",
                                              })
                                            : "Completado"}
                                    </p>
                                </div>
                                <span className="text-teal-400 text-xs font-bold uppercase tracking-widest flex-shrink-0">
                                    Aprobado
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

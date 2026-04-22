"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export type Role = "ADMIN" | "DIRECTOR" | "NURSE" | "FAMILY" | "CAREGIVER" | "THERAPIST" | "BEAUTY_SPECIALIST" | "SUPERVISOR" | "MAINTENANCE" | "KITCHEN" | "CLEANING" | "INVESTOR" | null;

export interface AuthUser {
    id: string;
    name: string;
    role: Role;
    hqId?: string; // Legacy
    headquartersId?: string; // Real
    hqName?: string;
    email?: string;
    photoUrl?: string | null;
    complianceScore?: number;
    secondaryRoles?: string[]; // FASE 51: roles secundarios (ej. SUPERVISOR + CAREGIVER)
}

interface AuthContextType {
    user: AuthUser | null;
    login: (user: AuthUser) => void; // Dummy keeping it to not break existing apps
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    const loading = status === "loading";

    // Transformamos la sesión al AuthUser de Zendity que todos los componentes necesitan
    const user: AuthUser | null = session?.user ? {
        id: session.user.id || "",
        name: session.user.name || "Usuario",
        email: session.user.email || "",
        role: (session.user as any).role as Role,
        hqId: (session.user as any).headquartersId,
        hqName: (session.user as any).headquartersName,
        photoUrl: (session.user as any).photoUrl || null,
        secondaryRoles: (session.user as any).secondaryRoles || [],
    } : null;

    useEffect(() => {
        if (loading) return;

        const isLoginRoute = pathname === "/login";

        if (!user) {
            // Bloqueo Anónimo Global
            if (!isLoginRoute) {
                router.replace("/login");
            }
        } else {
            // Reglas de Navegación por Rol Estricto
            if (isLoginRoute) {
                if (user.role === "ADMIN") router.replace("/corporate");
                else if (user.role === "FAMILY") router.replace("/family");
                else if (user.role === "CAREGIVER") router.replace("/care");
                else if (user.role === "THERAPIST" || user.role === "BEAUTY_SPECIALIST") router.replace("/specialists");
                else if (user.role === "INVESTOR") router.replace("/corporate/investors");
                else if (user.role === "MAINTENANCE") router.replace("/maintenance");
                else if (user.role === "KITCHEN") router.replace("/kitchen");
                else if (user.role === "CLEANING") router.replace("/cleaning");
                else router.replace("/"); // NURSE, SUPERVISOR, DIRECTOR
            } else {
                // Protección de Rutas (Básico)
                if (user.role === "FAMILY" && !pathname.startsWith("/family")) {
                    router.replace("/family");
                }
                else if ((user.role === "THERAPIST" || user.role === "BEAUTY_SPECIALIST") && !pathname.startsWith("/specialists")) {
                    router.replace("/specialists");
                }
                else if (user.role === "NURSE" &&
                    (pathname.startsWith("/family") || pathname.startsWith("/hr") || pathname.startsWith("/specialists") ||
                        (pathname.startsWith("/corporate") && !pathname.startsWith("/corporate/medical/handovers")))) {
                    router.replace("/");
                }
                else if (user.role === "CAREGIVER" && !pathname.startsWith("/care") && !pathname.startsWith("/cuidadores") && !pathname.startsWith("/corporate/medical/handovers") && !pathname.startsWith("/academy")) {
                    router.replace("/care");
                }
                else if (user.role === "MAINTENANCE" && !pathname.startsWith("/maintenance")) {
                    router.replace("/maintenance");
                }
                else if (user.role === "KITCHEN" && !pathname.startsWith("/kitchen")) {
                    router.replace("/kitchen");
                }
                else if (user.role === "CLEANING" && !pathname.startsWith("/cleaning")) {
                    router.replace("/cleaning");
                }
                else if (user.role === "INVESTOR" && !pathname.startsWith("/corporate/investors")) {
                    router.replace("/corporate/investors");
                }
            }
        }
    }, [user, loading, pathname, router]);

    const login = (userData: AuthUser) => {
        // Obsoleto por NextAuth, pero se mantiene la firma para componentes Legacy que no se han migrado
        console.warn("Llamada a método deprecado 'login'. NextAuth maneja la sesión.");
    };

    const logout = () => {
        signOut({ callbackUrl: "/login" });
    };

    if (loading) return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-900">
            <div className="text-center animate-pulse">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-teal-500/20 mb-4 flex items-center justify-center text-teal-400 font-black text-2xl">Z</div>
                <p className="text-teal-400 font-bold uppercase tracking-widest text-sm">Autenticando Red...</p>
            </div>
        </div>
    );

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            <div className="flex h-screen w-full bg-[#f4f7f6]">
                {children}
            </div>
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

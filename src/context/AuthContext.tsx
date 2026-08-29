"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { esRutaPublica } from '@/lib/rutas-publicas';

export type Role = "ADMIN" | "DIRECTOR" | "NURSE" | "FAMILY" | "CAREGIVER" | "THERAPIST" | "BEAUTY_SPECIALIST" | "SUPERVISOR" | "MAINTENANCE" | "KITCHEN" | "CLEANING" | "INVESTOR" | "SOCIAL_WORKER"
    // Recursos Humanos (24-ago-2026): gestión de personal sin acceso clínico.
    | "HR_MANAGER"
    | null;

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

        // Las demas rutas publicas viven en src/lib/rutas-publicas.ts, que es
        // la MISMA lista que usa AppLayout para no envolverlas en el marco de
        // la app.
        //
        // Antes esto era una cadena de banderas aqui y otra lista alla, y
        // anadir una ruta publica exigia acordarse de los dos sitios. No me
        // acorde dos veces seguidas: con /verificar y con /encuesta. En ambos
        // casos la pagina se renderizaba bien en el servidor —invisible por
        // curl— y el navegador la echaba al login al hidratar. Mismo patron que
        // el incidente de mar-2026 con el link de invitacion familiar.
        //
        // Dos veces el mismo error no es descuido: la lista estaba en el sitio
        // equivocado.
        const esPublica = esRutaPublica(pathname);

        // Publica es publica PARA TODOS, con sesion o sin ella.
        //
        // Tercera vez con este mismo error, y las tres por mirar la lista en el
        // sitio equivocado. La ultima: esPublica solo se consultaba en la rama
        // de "no hay usuario". Un familiar CON sesion abria el enlace de la
        // encuesta, /encuesta/TOKEN no empieza por /family, y la regla de rol
        // lo rebotaba a su perfil. Reportado por una familia el 28-ago-2026:
        // "al entrar a la encuesta le pide login, y al entrar abre perfil".
        //
        // Por eso la salida es ANTES de todo lo demas y no dentro de una rama:
        // una ruta publica no tiene ninguna regla de navegacion que aplicarle.
        // /login es publica —se ve sin sesion— pero NO puede salirse aqui: es
        // la unica ruta publica que ademas necesita la logica de abajo, la que
        // manda a cada rol a su pantalla DESPUES de autenticarse.
        //
        // Sin esta excepcion, la cuidadora escribia sus credenciales, NextAuth
        // las validaba bien, y nadie la redirigia: se quedaba en "verificando
        // credenciales" para siempre. Roto el 28-ago a las 14:24 por mi, al
        // arreglar el rebote de la encuesta. Afectaba a TODOS los roles.
        if (esPublica && !isLoginRoute) return;

        if (!user) {
            router.replace("/login");
        } else {
            // Reglas de Navegación por Rol Estricto
            if (isLoginRoute) {
                if (user.role === "ADMIN") router.replace("/corporate");
                else if (user.role === "FAMILY") router.replace("/family");
                else if (user.role === "CAREGIVER") router.replace("/care/hub");
                else if (user.role === "THERAPIST" || user.role === "BEAUTY_SPECIALIST") router.replace("/specialists");
                else if (user.role === "INVESTOR") router.replace("/corporate/investors");
                else if (user.role === "MAINTENANCE") router.replace("/maintenance");
                else if (user.role === "KITCHEN") router.replace("/kitchen");
                else if (user.role === "CLEANING") router.replace("/cleaning");
                else if (user.role === "SOCIAL_WORKER") router.replace("/corporate/social");
                // Sprint Coordinador (jun-2026): COORDINATOR aterriza directamente
                // en el hub. Sin este caso caía al else → "/" → sidebar clinical
                // sin link de salida al hub.
                // Cast a string — el tipo literal de AuthUser.role todavía no
                // lista COORDINATOR (legacy del codebase, no bloquea runtime).
                else if ((user.role as string) === "COORDINATOR") router.replace("/coordinator");
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
                        (pathname.startsWith("/corporate") && !pathname.startsWith("/corporate/medical")))) {
                    router.replace("/");
                }
                else if (user.role === "CAREGIVER" && !pathname.startsWith("/care") && !pathname.startsWith("/cuidadores") && !pathname.startsWith("/corporate/medical/handovers") && !pathname.startsWith("/academy") && !pathname.startsWith("/my-observations")) {
                    router.replace("/care/hub");
                }
                else if (user.role === "MAINTENANCE" && !pathname.startsWith("/maintenance")) {
                    router.replace("/maintenance");
                }
                else if (user.role === "KITCHEN" && !pathname.startsWith("/kitchen")) {
                    router.replace("/kitchen");
                }
                else if (user.role === "CLEANING" && !pathname.startsWith("/cleaning") && !pathname.startsWith("/academy")) {
                    router.replace("/cleaning");
                }
                else if (user.role === "INVESTOR" && !pathname.startsWith("/corporate/investors")) {
                    router.replace("/corporate/investors");
                }
                // SOCIAL_WORKER — confinado a su sandbox operacional:
                //   - /corporate/social (dashboard global)
                //   - /corporate/medical/patients/* (perfil residente: lee clínico,
                //     escribe solo en la pestaña Trabajo Social)
                //   - "/" homepage redirige por el efecto post-login arriba
                // ⚠️ ESTO ES UX / DEFENSA-EN-PROFUNDIDAD — el control de seguridad
                // real son los role-lists de los endpoints (Parte 2 del sprint).
                // Si esta cláusula falla, el SW NO puede leer ni escribir lo que
                // no debe — los endpoints lo rechazan con 401. Esta solo evita
                // que vea shells de páginas vacías o reciba 401s ruidosos.
                else if (user.role === "SOCIAL_WORKER" &&
                    pathname !== "/" &&
                    !pathname.startsWith("/corporate/social") &&
                    !pathname.startsWith("/corporate/medical/patients") &&
                    // FASE 2 SW Eval: el page de la evaluación vive en su propia ruta
                    !pathname.startsWith("/corporate/sw-evaluations")) {
                    router.replace("/corporate/social");
                }
                // COORDINATOR-PURO (sin DIR/ADMIN/SUP/NURSE/SW como secondary) —
                // confinado al hub de comunicación familiar. Sprint Coordinador
                // (jun-2026). Mismo patrón que SOCIAL_WORKER + criterio de
                // "puro" IDÉNTICO al del filtro de tabs en
                // /corporate/medical/patients/[id] (un solo concepto, una sola
                // definición). UX guard — el control de seguridad real son
                // los role-lists de los endpoints.
                //
                // Allowlist (startsWith, sin slash final → cubre lista Y detalle):
                //   - /coordinator/*               (Inicio, Refer, Messages, Appts, Residents)
                //   - /corporate/family-*          (family-messages, family-appointments,
                //                                   family-broadcast — los 3 items del hub)
                //   - /corporate/medical/patients  (directorio + detalle ?id/...)
                //   - /corporate/calendar          (vista calendario; el GET del endpoint
                //                                   scopea data a FAMILY_* para COORDINATOR-puro,
                //                                   defensa-en-profundidad complementaria)
                //
                // Si DIR/ADMIN/NURSE/SUP/SW está como primary o secondary,
                // skipea — esos roles ya tienen acceso amplio legítimo.
                else if (
                    (() => {
                        const FULL_VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'SOCIAL_WORKER'];
                        const allRoles = [user.role, ...((user as any).secondaryRoles ?? [])];
                        return allRoles.includes('COORDINATOR') && !allRoles.some(r => FULL_VIEW_ROLES.includes(r));
                    })() &&
                    !pathname.startsWith("/coordinator") &&
                    !pathname.startsWith("/corporate/family-") &&
                    !pathname.startsWith("/corporate/medical/patients") &&
                    !pathname.startsWith("/corporate/calendar")
                ) {
                    router.replace("/coordinator");
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

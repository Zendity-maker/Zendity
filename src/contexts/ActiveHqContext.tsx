"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "zendity_active_hq";
const MULTI_HQ_ROLES = ["DIRECTOR", "ADMIN"] as const;
const ALL_NAME = "Todas las sedes";

export interface AccessibleHq {
    id: string;
    name: string;
    capacity?: number;
}

interface ActiveHqContextValue {
    /** ID de la sede activa, o 'ALL' si DIRECTOR/ADMIN está viendo todas. */
    activeHqId: string | "ALL";
    /** Nombre visible de la sede activa. */
    activeHqName: string;
    /** Cambia la sede activa y persiste en localStorage. */
    setActiveHq: (id: string | "ALL", name: string) => void;
    /** Lista de sedes visibles al usuario (DIRECTOR/ADMIN = todas; otros = la propia). */
    accessibleHqs: AccessibleHq[];
    /** true si el usuario puede cambiar de sede (DIRECTOR/ADMIN). */
    isMultiHqRole: boolean;
    /** Cargando lista de sedes / hidratando localStorage. */
    loading: boolean;
}

const ActiveHqContext = createContext<ActiveHqContextValue | undefined>(undefined);

export function ActiveHqProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();

    const [activeHqId, setActiveHqId] = useState<string | "ALL">("ALL");
    const [activeHqName, setActiveHqName] = useState<string>(ALL_NAME);
    const [accessibleHqs, setAccessibleHqs] = useState<AccessibleHq[]>([]);
    const [loading, setLoading] = useState(true);

    const isMultiHqRole = !!user && (MULTI_HQ_ROLES as readonly string[]).includes(user.role as any);

    const persist = useCallback((id: string | "ALL", name: string) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name }));
        } catch {
            /* ignore storage errors (private mode, etc.) */
        }
    }, []);

    const setActiveHq = useCallback((id: string | "ALL", name: string) => {
        setActiveHqId(id);
        setActiveHqName(name);
        persist(id, name);
    }, [persist]);

    // Hidratación: cargar sedes accesibles + aplicar localStorage
    useEffect(() => {
        if (authLoading || !user) return;

        let cancelled = false;

        async function hydrate() {
            setLoading(true);

            // 1) Construir la lista de sedes accesibles
            let hqs: AccessibleHq[] = [];
            if (isMultiHqRole) {
                try {
                    const res = await fetch("/api/corporate/headquarters");
                    const data = await res.json();
                    if (data?.success && Array.isArray(data.headquarters)) {
                        hqs = data.headquarters.map((h: any) => ({
                            id: h.id,
                            name: h.name,
                            capacity: typeof h.capacity === "number" ? h.capacity : undefined,
                        }));
                    }
                } catch (err) {
                    console.error("[ActiveHq] fetch /api/corporate/headquarters", err);
                }
            } else if (user?.hqId) {
                hqs = [{ id: user.hqId, name: user.hqName || "Mi Sede" }];
            }

            if (cancelled) return;
            setAccessibleHqs(hqs);

            // 2) Determinar activeHq según localStorage + permisos
            let next: { id: string | "ALL"; name: string } | null = null;
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.id && typeof parsed.name === "string") {
                        next = { id: parsed.id as string | "ALL", name: parsed.name };
                    }
                }
            } catch {
                /* ignore parse errors */
            }

            if (isMultiHqRole) {
                // DIRECTOR/ADMIN: honor localStorage si es válido (ALL o id existente en la lista)
                if (next && (next.id === "ALL" || hqs.some(h => h.id === next!.id))) {
                    setActiveHqId(next.id);
                    setActiveHqName(next.name);
                } else {
                    // Default → ALL
                    setActiveHqId("ALL");
                    setActiveHqName(ALL_NAME);
                    persist("ALL", ALL_NAME);
                }
            } else {
                // Otros roles: SIEMPRE anclados a su propia sede (ignorar localStorage)
                const ownId = user!.hqId || "";
                const ownName = user!.hqName || "Mi Sede";
                setActiveHqId(ownId);
                setActiveHqName(ownName);
                if (ownId) persist(ownId, ownName);
            }

            if (!cancelled) setLoading(false);
        }

        hydrate();
        return () => {
            cancelled = true;
        };
    }, [authLoading, user, isMultiHqRole, persist]);

    return (
        <ActiveHqContext.Provider
            value={{ activeHqId, activeHqName, setActiveHq, accessibleHqs, isMultiHqRole, loading }}
        >
            {children}
        </ActiveHqContext.Provider>
    );
}

export function useActiveHq() {
    const ctx = useContext(ActiveHqContext);
    if (!ctx) throw new Error("useActiveHq must be used within ActiveHqProvider");
    return ctx;
}

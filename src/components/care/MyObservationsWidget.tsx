"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileWarning, Clock } from "lucide-react";

/**
 * Sprint S — Widget compacto en el tablet que avisa al cuidador cuando tiene
 * observaciones HR pendientes de respuesta o apelación. Link directo a
 * /my-observations. Silencioso si no hay nada pendiente.
 */
export default function MyObservationsWidget() {
    const [count, setCount] = useState(0);
    const [hasPending, setHasPending] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch('/api/hr/incidents?myOwn=true');
                const data = await res.json();
                if (cancelled) return;
                if (data.success && Array.isArray(data.incidents)) {
                    const actionable = data.incidents.filter((i: any) =>
                        i.status === 'PENDING_EXPLANATION' ||
                        (i.status === 'APPLIED' && !i.appealText)
                    );
                    setCount(actionable.length);
                    setHasPending(actionable.some((i: any) => i.status === 'PENDING_EXPLANATION'));
                }
            } catch (e) {
                console.error('[MyObservationsWidget]', e);
            }
        };
        load();
        const iv = setInterval(load, 60000); // refresca cada minuto
        return () => { cancelled = true; clearInterval(iv); };
    }, []);

    if (count === 0) return null;

    return (
        <Link
            href="/my-observations"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 shadow-sm ${
                hasPending
                    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 animate-pulse'
                    : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
            }`}
        >
            {hasPending ? <Clock size={16} /> : <FileWarning size={16} />}
            <span>
                {count} observación{count === 1 ? '' : 'es'} {hasPending ? 'pendiente de respuesta' : 'activa'}{count > 1 && !hasPending ? 's' : ''}
            </span>
        </Link>
    );
}

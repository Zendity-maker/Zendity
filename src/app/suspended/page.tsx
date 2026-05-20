import Link from 'next/link';
import { ShieldAlert, Mail, Phone } from 'lucide-react';

/**
 * /suspended — Pantalla para sedes con licencia vencida o suspendida.
 * El cliente ve instrucciones claras para contactar a Zéndity.
 */
export default function SuspendedPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-lg w-full text-center space-y-6">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-10 h-10 text-amber-600" />
                </div>

                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        Acceso suspendido
                    </h1>
                    <p className="text-slate-600 mt-2 text-lg">
                        La licencia de tu sede no está activa en este momento.
                    </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-left space-y-4 shadow-sm">
                    <p className="text-slate-700 font-medium">
                        Para reactivar el acceso, contacta al equipo de Zéndity:
                    </p>
                    <div className="space-y-3">
                        <a
                            href="mailto:zendityinfo@gmail.com"
                            className="flex items-center gap-3 text-[#0F6B78] font-bold hover:underline"
                        >
                            <Mail className="w-5 h-5" />
                            zendityinfo@gmail.com
                        </a>
                        <a
                            href="https://wa.me/17872000000"
                            className="flex items-center gap-3 text-[#0F6B78] font-bold hover:underline"
                        >
                            <Phone className="w-5 h-5" />
                            WhatsApp: (787) 200-0000
                        </a>
                    </div>
                </div>

                <p className="text-xs text-slate-400">
                    Tu información y datos de residentes están seguros y disponibles
                    en cuanto se reactive la licencia.
                </p>

                <Link
                    href="/login"
                    className="inline-block text-sm text-slate-500 hover:text-slate-700 underline"
                >
                    ← Volver al inicio de sesión
                </Link>
            </div>
        </div>
    );
}

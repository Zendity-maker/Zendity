"use client";

import Link from "next/link";
import { Monitor, UserPlus, ArrowRight, QrCode } from "lucide-react";

/**
 * /corporate/kiosks — Hub de configuración de kioskos
 *
 * Página landing que agrupa todas las configuraciones de kioskos físicos
 * que viven en la sede. Permite a Celia/admin saber de un vistazo qué
 * tablets hay y cómo configurarlas. Cada card abre la página específica
 * (no se duplica funcionalidad — solo navegación).
 */
export default function KiosksHubPage() {
    return (
        <div className="max-w-5xl mx-auto p-6 pb-16 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <QrCode className="w-6 h-6 text-teal-600" />
                    Configuración de Kioskos
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Gestiona las tablets que operan en la sede: recepción de familias y registro de servicios externos.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kiosco de Recepción */}
                <Link
                    href="/corporate/reception-setup"
                    className="group bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-teal-500 transition"
                >
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <Monitor className="w-7 h-7 text-teal-700" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-black text-slate-900">Kiosco de Recepción</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Tablet en la entrada para que las familias registren sus visitas con voz y firma digital.
                            </p>
                        </div>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1.5 mb-4 ml-1">
                        <li className="flex items-start gap-2">
                            <span className="text-teal-600 font-black mt-0.5">·</span>
                            <span>URL única por sede + código QR</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-teal-600 font-black mt-0.5">·</span>
                            <span>Reconocimiento de voz (Web Speech API)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-teal-600 font-black mt-0.5">·</span>
                            <span>Firma digital del visitante</span>
                        </li>
                    </ul>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Configurar</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition" />
                    </div>
                </Link>

                {/* Kiosco de Servicios Externos */}
                <Link
                    href="/corporate/admin/external-services"
                    className="group bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-teal-500 transition"
                >
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <UserPlus className="w-7 h-7 text-teal-700" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-black text-slate-900">Kiosco de Servicios Externos</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Tablets en los pisos donde proveedores externos (hospicios, terapias, médicos) registran sus visitas.
                            </p>
                        </div>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1.5 mb-4 ml-1">
                        <li className="flex items-start gap-2">
                            <span className="text-teal-600 font-black mt-0.5">·</span>
                            <span>Catálogo de categorías y proveedores</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-teal-600 font-black mt-0.5">·</span>
                            <span>Una tablet por piso (device token único)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-teal-600 font-black mt-0.5">·</span>
                            <span>Aprobación del director antes de publicar a familia</span>
                        </li>
                    </ul>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Administrar</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition" />
                    </div>
                </Link>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-800">¿Cuál es la diferencia?</strong> El de Recepción es para que las
                familias firmen su entrada al edificio (1 sola tablet en lobby). El de Servicios Externos es para
                proveedores que vienen a atender residentes (tabletas en cada piso, una por piso). Ambos generan
                actualizaciones que la familia ve en su portal.
            </div>
        </div>
    );
}

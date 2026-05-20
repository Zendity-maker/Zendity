"use client";

import { useState } from "react";
import Link from "next/link";
import {
    AlertTriangle, CheckCircle2, Phone, Wifi, WifiOff, Pill,
    Users, ShieldAlert, ClipboardList, FileText, ExternalLink,
    ChevronDown, ChevronRight, Activity, Building2
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Section {
    id: string;
    icon: React.ReactNode;
    title: string;
    color: string;
    borderColor: string;
    bgColor: string;
    steps: string[];
    note?: string;
}

const RUNBOOK_SECTIONS: Section[] = [
    {
        id: "no-internet",
        icon: <WifiOff className="w-5 h-5" />,
        title: "Sistema sin conexión a internet",
        color: "text-orange-700",
        borderColor: "border-orange-200",
        bgColor: "bg-orange-50",
        steps: [
            "Acceder al directorio de residentes desde el último caché del navegador (disponible sin internet en la mayoría de dispositivos).",
            "Imprimir las tarjetas de emergencia antes de perder acceso: ir a Directorio Global → seleccionar residente → botón 'Tarjeta de Emergencia'.",
            "Continuar el eMAR en papel usando los formularios impresos del turno anterior.",
            "Documentar cada administración de medicamento en papel con hora y firma.",
            "Al restaurarse la conexión, registrar retroactivamente en el sistema con nota 'Registro retroactivo — falla de conectividad'.",
            "Notificar al Director de turno en los primeros 15 minutos de la interrupción.",
        ],
        note: "Mantener una copia impresa de la lista de medicamentos activos en el puesto de enfermería.",
    },
    {
        id: "medication-error",
        icon: <Pill className="w-5 h-5" />,
        title: "Error de medicación",
        color: "text-red-700",
        borderColor: "border-red-200",
        bgColor: "bg-red-50",
        steps: [
            "Evaluar inmediatamente el estado del residente afectado.",
            "Notificar al supervisor de turno y al médico responsable de forma inmediata.",
            "Reportar el incidente en Zéndity: Incidentes → Nuevo Incidente → tipo 'Error de Medicación'.",
            "Documentar: medicamento administrado, dosis real vs. dosis correcta, hora exacta, signos vitales post-incidente.",
            "No administrar antídoto ni medicación correctiva sin orden médica.",
            "Notificar al familiar primario si el médico lo considera necesario.",
            "Preservar el envase del medicamento como evidencia hasta que el médico lo revise.",
            "Completar el informe de incidentes antes de finalizar el turno.",
        ],
        note: "Todo error de medicación debe registrarse en el sistema aunque el residente no presente síntomas.",
    },
    {
        id: "fall",
        icon: <AlertTriangle className="w-5 h-5" />,
        title: "Caída de residente",
        color: "text-amber-700",
        borderColor: "border-amber-200",
        bgColor: "bg-amber-50",
        steps: [
            "NO mover al residente hasta evaluar posibles lesiones.",
            "Evaluar nivel de conciencia, sangrado visible, dolor localizado.",
            "Llamar al supervisor de turno y a enfermería de inmediato.",
            "Si hay sospecha de fractura o trauma: llamar al 911 antes de mover al residente.",
            "Reportar en Zéndity: Incidentes → Nuevo Incidente → tipo 'Caída'. El sistema crea un ticket de triage automáticamente.",
            "Registrar: ubicación exacta de la caída, condiciones del piso, calzado del residente, última dosis de medicamentos sedantes.",
            "Evaluar riesgo post-caída con la escala de Downton (el sistema actualiza el perfil automáticamente).",
            "Notificar al familiar primario dentro de las 2 horas siguientes.",
            "Completar evaluación de riesgo de caída en el perfil del residente.",
        ],
    },
    {
        id: "medical-emergency",
        icon: <Activity className="w-5 h-5" />,
        title: "Emergencia médica",
        color: "text-rose-700",
        borderColor: "border-rose-200",
        bgColor: "bg-rose-50",
        steps: [
            "Llamar al 911 si hay paro cardiorrespiratorio, pérdida de conciencia, dificultad respiratoria severa o convulsiones.",
            "Iniciar RCP si aplica (seguir protocolo de la instalación y órdenes DNR si vigentes).",
            "Designar a un empleado para recibir a los paramédicos en la entrada.",
            "Imprimir o tener lista la tarjeta de emergencia del residente para entregársela a los paramédicos.",
            "Notificar al Director y al médico responsable en los primeros 5 minutos.",
            "Abrir Triage Center en Zéndity y crear ticket CRÍTICO si no se generó automáticamente.",
            "Notificar al familiar primario inmediatamente.",
            "Documentar el evento completo en el sistema antes de que termine el turno.",
        ],
        note: "Hospital preferido de cada residente está en su Tarjeta de Emergencia y en su perfil.",
    },
    {
        id: "evacuation",
        icon: <Building2 className="w-5 h-5" />,
        title: "Evacuación de la instalación",
        color: "text-purple-700",
        borderColor: "border-purple-200",
        bgColor: "bg-purple-50",
        steps: [
            "Activar protocolo de evacuación según el plan físico de la instalación.",
            "Imprimir el listado de residentes activos desde Directorio Global antes de evacuar.",
            "Asignar un cuidador por cada 3 residentes con movilidad reducida.",
            "Llevar las tarjetas de emergencia impresas de todos los residentes.",
            "Punto de reunión: definido en el plan de emergencias de la instalación.",
            "Hacer conteo nominal usando el listado impreso. Reportar discrepancias de inmediato.",
            "Notificar a los familiares una vez todos los residentes estén en zona segura.",
            "Contactar a Zéndity soporte (info@zendity.com) para coordinar acceso remoto si se necesita.",
        ],
    },
    {
        id: "shift-handover",
        icon: <ClipboardList className="w-5 h-5" />,
        title: "Protocolo de cierre de turno",
        color: "text-teal-700",
        borderColor: "border-teal-200",
        bgColor: "bg-teal-50",
        steps: [
            "Verificar que todos los medicamentos del turno estén registrados en eMAR.",
            "Revisar el Triage Center: resolver o escalar tickets abiertos.",
            "Completar el Reporte de Turno en Zéndity con: novedades clínicas, incidentes, cambios de estado.",
            "Actualizar el estado de higiene (baño, cambio de pañal) de cada residente.",
            "Comunicar verbalmente al personal entrante: residentes en vigilancia especial, cambios de medicación, visitas familiares pendientes.",
            "Confirmar que la enfermera entrante firma el Reporte de Turno en el sistema.",
            "Cerrar sesión del dispositivo al finalizar.",
        ],
    },
];

// ── Componente de sección colapsable ──────────────────────────────────────────
function RunbookSection({ section }: { section: Section }) {
    const [open, setOpen] = useState(false);

    return (
        <div className={`border rounded-xl overflow-hidden ${section.borderColor}`}>
            <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between p-4 text-left ${section.bgColor} hover:opacity-90 transition-opacity`}
            >
                <div className="flex items-center gap-3">
                    <span className={section.color}>{section.icon}</span>
                    <span className={`font-semibold ${section.color}`}>{section.title}</span>
                </div>
                {open
                    ? <ChevronDown className={`w-4 h-4 ${section.color}`} />
                    : <ChevronRight className={`w-4 h-4 ${section.color}`} />
                }
            </button>

            {open && (
                <div className="bg-white p-5 border-t border-slate-100">
                    <ol className="space-y-3">
                        {section.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 text-sm text-slate-700">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center mt-0.5">
                                    {i + 1}
                                </span>
                                <span className="leading-relaxed">{step}</span>
                            </li>
                        ))}
                    </ol>
                    {section.note && (
                        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 flex gap-2 text-xs text-slate-600">
                            <ShieldAlert className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span>{section.note}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RunbookPage() {
    return (
        <div className="max-w-3xl mx-auto pb-16">

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Runbook Operacional</h1>
                        <p className="text-sm text-slate-500">Procedimientos de emergencia y operación estándar</p>
                    </div>
                </div>
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-sm text-amber-800">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>
                        Este documento contiene los procedimientos oficiales de la instalación. En caso de duda,
                        escalar siempre al Director de turno antes de actuar de forma independiente.
                    </span>
                </div>
            </div>

            {/* Accesos rápidos de emergencia */}
            <div className="mb-8">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Accesos Rápidos
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Link
                        href="/corporate/medical/patients"
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-teal-300 hover:bg-teal-50 transition-all"
                    >
                        <Users className="w-5 h-5 text-teal-600" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Directorio</p>
                            <p className="text-xs text-slate-500">Tarjetas de emergencia</p>
                        </div>
                    </Link>
                    <Link
                        href="/corporate/triage"
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-all"
                    >
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Triage Center</p>
                            <p className="text-xs text-slate-500">Tickets abiertos</p>
                        </div>
                    </Link>
                    <Link
                        href="/corporate/incidents"
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-amber-300 hover:bg-amber-50 transition-all"
                    >
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Incidentes</p>
                            <p className="text-xs text-slate-500">Reportar incidente</p>
                        </div>
                    </Link>
                    <Link
                        href="/corporate/reports"
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                        <ClipboardList className="w-5 h-5 text-blue-500" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Reportes de Turno</p>
                            <p className="text-xs text-slate-500">Historial de turnos</p>
                        </div>
                    </Link>
                    <a
                        href="mailto:soporte@zendity.com"
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-all"
                    >
                        <Phone className="w-5 h-5 text-slate-500" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Soporte Zéndity</p>
                            <p className="text-xs text-slate-500">soporte@zendity.com</p>
                        </div>
                    </a>
                    <Link
                        href="/audit"
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all"
                    >
                        <Activity className="w-5 h-5 text-purple-500" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Audit Log</p>
                            <p className="text-xs text-slate-500">Trazabilidad</p>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Cómo imprimir tarjetas de emergencia */}
            <div className="mb-8 p-5 bg-teal-50 border border-teal-200 rounded-xl">
                <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-teal-800 mb-2">Cómo imprimir tarjetas de emergencia</h3>
                        <ol className="space-y-1.5 text-sm text-teal-700">
                            <li className="flex gap-2"><span className="font-bold">1.</span> Ir a <Link href="/corporate/medical/patients" className="underline font-medium">Directorio Global de Residentes</Link></li>
                            <li className="flex gap-2"><span className="font-bold">2.</span> Hacer clic en el residente deseado</li>
                            <li className="flex gap-2"><span className="font-bold">3.</span> Buscar el botón <strong>"Tarjeta de Emergencia"</strong> en el perfil del residente</li>
                            <li className="flex gap-2"><span className="font-bold">4.</span> En la página que se abre, pulsar <strong>Ctrl+P</strong> (o el botón "Imprimir")</li>
                            <li className="flex gap-2"><span className="font-bold">5.</span> Seleccionar tamaño carta, sin márgenes extra</li>
                        </ol>
                        <p className="text-xs text-teal-600 mt-3">
                            Recomendación: imprimir las tarjetas de todos los residentes activos al inicio de cada semana y guardarlas en el puesto de enfermería.
                        </p>
                    </div>
                </div>
            </div>

            {/* Secciones del runbook */}
            <div className="mb-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Procedimientos Operacionales
                </h2>
                <div className="space-y-3">
                    {RUNBOOK_SECTIONS.map(section => (
                        <RunbookSection key={section.id} section={section} />
                    ))}
                </div>
            </div>

            {/* Lista de verificación diaria */}
            <div className="mb-8">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Verificación Diaria del Sistema
                </h2>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="space-y-3">
                        {[
                            { label: "eMAR al día — todos los medicamentos del turno registrados", link: "/care", linkLabel: "Ir a eMAR" },
                            { label: "Triage Center sin tickets CRITICAL sin atender", link: "/corporate/triage", linkLabel: "Ver Triage" },
                            { label: "Reportes de turno firmados por el supervisor", link: "/corporate/reports", linkLabel: "Ver Reportes" },
                            { label: "Vitales registradas para residentes en vigilancia", link: "/care/vitals", linkLabel: "Ver Vitales" },
                            { label: "Sin incidentes sin documentar en las últimas 8h", link: "/corporate/incidents", linkLabel: "Ver Incidentes" },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-700">{item.label}</span>
                                </div>
                                <Link
                                    href={item.link}
                                    className="text-xs text-teal-600 font-semibold flex items-center gap-1 whitespace-nowrap hover:text-teal-800"
                                >
                                    {item.linkLabel}
                                    <ExternalLink className="w-3 h-3" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-100">
                Zéndity Runbook Operacional · Actualizado automáticamente · Uso exclusivo de personal autorizado
            </div>
        </div>
    );
}

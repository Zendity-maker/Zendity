"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    FileCheck,
    Clock,
    Send,
    Eye,
    X,
    CheckCircle2,
    AlertCircle,
    Shield,
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────
type BAAEstado = "FIRMADO" | "PENDIENTE";

type Sede = {
    id: string;
    nombre: string;
    plan: string;
    fechaFirma: string | null;
    estado: BAAEstado;
};

// ─── Datos mock ─────────────────────────────────────────────────────────────
const SEDES_MOCK: Sede[] = [
    {
        id: "1",
        nombre: "Vivid Senior Living Cupey",
        plan: "PRO",
        fechaFirma: "2024-11-15",
        estado: "FIRMADO",
    },
    {
        id: "2",
        nombre: "Serenity Elderly Home",
        plan: "LITE",
        fechaFirma: null,
        estado: "PENDIENTE",
    },
    {
        id: "3",
        nombre: "Hogar Santa Rosa de Bayamón",
        plan: "PRO",
        fechaFirma: null,
        estado: "PENDIENTE",
    },
];

// ─── Texto legal del BAA ──────────────────────────────────────────────────
const BAA_TEXTO = `ACUERDO DE ASOCIADO DE NEGOCIO (BUSINESS ASSOCIATE AGREEMENT)
HIPAA — Health Insurance Portability and Accountability Act of 1996

Este Acuerdo de Asociado de Negocio ("Acuerdo") se celebra entre la entidad cubierta identificada en el encabezado ("Entidad Cubierta") y Zéndity LLC ("Asociado de Negocio"), con vigencia a partir de la fecha de firma o activación de la cuenta en la plataforma app.zendity.com.

────────────────────────────────────────────────────────────────
ARTÍCULO 1 — DEFINICIONES
────────────────────────────────────────────────────────────────

1.1 "Información de Salud Protegida" (PHI, por sus siglas en inglés) significa cualquier información de salud individualmente identificable que sea creada, recibida, mantenida o transmitida por el Asociado de Negocio en nombre de la Entidad Cubierta, según lo define el Reglamento HIPAA (45 CFR §160.103).

1.2 "PHI Electrónica" (ePHI) significa PHI que se transmite o mantiene en forma electrónica.

1.3 "Subcontratistas" significa aquellos proveedores de servicios contratados por Zéndity LLC para procesar, almacenar o transmitir PHI en nombre de la Entidad Cubierta, incluyendo pero no limitado a: proveedores de infraestructura en la nube (Neon PostgreSQL — Neon, Inc.), servicios de correo electrónico transaccional (SendGrid — Twilio Inc.) y plataformas de despliegue (Vercel Inc.). Todos los subcontratistas están obligados contractualmente a cumplir con HIPAA.

1.4 "Brecha de Seguridad" significa el acceso, uso, divulgación o adquisición no autorizada de PHI que comprometa la seguridad o privacidad de dicha información, según lo define 45 CFR §164.402.

1.5 "Reglamento HIPAA" significa colectivamente el Reglamento de Privacidad (45 CFR Parte 164, Subpartes A y E), el Reglamento de Seguridad (45 CFR Parte 164, Subpartes A y C), el Reglamento de Notificación de Brechas (45 CFR Parte 164, Subparte D), y el Reglamento de Cumplimiento (45 CFR Parte 160, Subpartes B, C y D).

────────────────────────────────────────────────────────────────
ARTÍCULO 2 — OBLIGACIONES DE ZÉNDITY COMO ASOCIADO DE NEGOCIO
────────────────────────────────────────────────────────────────

2.1 Zéndity se compromete a:

(a) No usar ni divulgar PHI de ninguna manera que no esté permitida o requerida por este Acuerdo, o que sea requerida por ley.

(b) Implementar salvaguardas administrativas, físicas y técnicas apropiadas para proteger la confidencialidad, integridad y disponibilidad de la ePHI que cree, reciba, mantenga o transmita en nombre de la Entidad Cubierta.

(c) Garantizar que cualquier agente, incluyendo subcontratistas, que tengan acceso a PHI acuerden las mismas restricciones y condiciones que aplican a Zéndity con respecto a dicha información.

(d) Reportar a la Entidad Cubierta cualquier uso o divulgación de PHI no permitida por este Acuerdo de la que tenga conocimiento, incluyendo brechas de PHI no asegurada según lo establece 45 CFR §164.410.

(e) Hacer disponible PHI en un conjunto designado de registros para la Entidad Cubierta según lo necesiten para responder a solicitudes de acceso de individuos (45 CFR §164.524).

(f) Incorporar enmiendas a PHI en un conjunto designado de registros (45 CFR §164.526).

(g) Poner a disposición de la Entidad Cubierta la información necesaria para proporcionar una contabilidad de divulgaciones (45 CFR §164.528).

(h) Poner sus prácticas, libros y registros internos relacionados con el uso y divulgación de PHI a disposición del Secretario del Departamento de Salud y Servicios Humanos de los EE.UU. para determinar el cumplimiento de HIPAA.

────────────────────────────────────────────────────────────────
ARTÍCULO 3 — USOS PERMITIDOS DE LA INFORMACIÓN
────────────────────────────────────────────────────────────────

3.1 Excepto según se establezca de otra manera en este Acuerdo, Zéndity podrá usar o divulgar PHI solamente para:

(a) Llevar a cabo las funciones de administración de hogares de ancianos para las cuales fue contratado, incluyendo: registro y gestión de residentes, administración de medicamentos (eMAR), gestión de turnos del personal de cuidado, comunicación con familias autorizadas, y reportes de cumplimiento regulatorio.

(b) La gestión y administración propias de Zéndity, o para cumplir con obligaciones legales de Zéndity, siempre que:
    (i) la divulgación sea requerida por ley; o
    (ii) Zéndity obtenga garantías razonables de que la información será tratada de manera confidencial.

(c) Servicios de análisis de datos para mejorar la plataforma, exclusivamente mediante datos agregados y anonimizados que no constituyan PHI.

3.2 Zéndity no usará ni divulgará PHI para propósitos de marketing, ni venderá PHI a terceros.

────────────────────────────────────────────────────────────────
ARTÍCULO 4 — SALVAGUARDAS DE SEGURIDAD
────────────────────────────────────────────────────────────────

4.1 Salvaguardas Técnicas:
- Cifrado en tránsito: TLS 1.2 o superior para todas las comunicaciones.
- Cifrado en reposo: AES-256 para bases de datos y almacenamiento de archivos.
- Autenticación: Control de acceso basado en roles (RBAC) con autenticación multifactor disponible.
- Registros de auditoría: Logs inmutables de acceso y modificaciones a PHI, retenidos mínimo 6 años.
- Segregación de datos: Cada cliente (tenant) tiene sus datos completamente aislados mediante controles de acceso a nivel de base de datos.

4.2 Salvaguardas Administrativas:
- Designación de un Oficial de Privacidad y Seguridad HIPAA.
- Capacitación anual obligatoria del personal de Zéndity en privacidad y seguridad HIPAA.
- Evaluaciones de riesgos periódicas conforme a 45 CFR §164.308(a)(1).
- Procedimientos documentados para respuesta a incidentes de seguridad.

4.3 Salvaguardas Físicas:
- Los servidores de producción están alojados en centros de datos certificados SOC 2 Tipo II.
- Controles de acceso físico a instalaciones donde se procesa ePHI.
- Políticas de eliminación segura de medios que contengan PHI.

────────────────────────────────────────────────────────────────
ARTÍCULO 5 — NOTIFICACIÓN DE BRECHAS DE SEGURIDAD
────────────────────────────────────────────────────────────────

5.1 Descubrimiento. Zéndity considerará una brecha descubierta el primer día en que un empleado o agente de Zéndity (excepto el responsable de la brecha) tenga conocimiento de la misma.

5.2 Notificación a la Entidad Cubierta. Zéndity notificará a la Entidad Cubierta sin demora indebida y dentro de los 60 días calendario siguientes al descubrimiento de una brecha de PHI no asegurada. La notificación incluirá, en la medida de lo posible:

(a) Una descripción de la naturaleza de la brecha, incluyendo las categorías de PHI involucradas.
(b) La identidad de los individuos cuya PHI fue involucrada (o descripción si se desconoce).
(c) Las acciones tomadas por Zéndity para investigar la brecha, mitigar sus efectos y prevenir su recurrencia.
(d) Información de contacto del representante de Zéndity disponible para dar seguimiento.

5.3 Para brechas que afecten más de 500 residentes de Puerto Rico, Zéndity asistirá a la Entidad Cubierta en notificar a los medios de comunicación prominentes del Estado, según lo requiere 45 CFR §164.406.

────────────────────────────────────────────────────────────────
ARTÍCULO 6 — TÉRMINO Y TERMINACIÓN
────────────────────────────────────────────────────────────────

6.1 Vigencia. Este Acuerdo tendrá una vigencia inicial de un (1) año a partir de la fecha de firma o activación, y se renovará automáticamente por períodos anuales adicionales, a menos que alguna de las partes notifique a la otra por escrito con al menos 30 días de anticipación su intención de no renovarlo.

6.2 Terminación por Incumplimiento. La Entidad Cubierta podrá terminar este Acuerdo si descubre que Zéndity ha incumplido materialmente cualquier obligación HIPAA bajo este Acuerdo, siempre que:
(a) La Entidad Cubierta notifique a Zéndity del incumplimiento.
(b) Zéndity no remedie el incumplimiento dentro de los 30 días siguientes a la notificación.

6.3 Terminación Inmediata. Si la Entidad Cubierta determina que la terminación inmediata es necesaria para proteger la PHI de individuos, podrá terminar el Acuerdo sin previo aviso.

────────────────────────────────────────────────────────────────
ARTÍCULO 7 — DEVOLUCIÓN Y DESTRUCCIÓN DE DATOS
────────────────────────────────────────────────────────────────

7.1 Al terminar este Acuerdo por cualquier razón, Zéndity:

(a) Devolverá a la Entidad Cubierta, o destruirá, toda la PHI recibida de la Entidad Cubierta o creada en nombre de esta, que Zéndity mantenga en cualquier forma, dentro de los 90 días calendario siguientes a la terminación efectiva.

(b) Retendrá ninguna copia de dicha PHI después del período de 90 días, excepto en la medida en que la ley aplicable requiera que Zéndity mantenga dicha PHI por un período adicional. Si se requiere retención adicional, las protecciones de este Acuerdo permanecerán vigentes durante ese período.

(c) Certificará por escrito a la Entidad Cubierta la destrucción de toda PHI dentro de los 30 días siguientes al vencimiento del período de devolución/destrucción.

7.2 Formato de exportación. Los datos se entregarán en formato JSON estructurado o CSV, según elija la Entidad Cubierta, sin costo adicional para suscripciones activas.

────────────────────────────────────────────────────────────────
ARTÍCULO 8 — DISPOSICIONES GENERALES
────────────────────────────────────────────────────────────────

8.1 Ley Aplicable. Este Acuerdo se regirá por las leyes del Estado Libre Asociado de Puerto Rico y las leyes federales aplicables de los Estados Unidos de América.

8.2 Enmiendas. Las partes acuerdan enmendar este Acuerdo según sea necesario para cumplir con los requisitos de HIPAA y las regulaciones que se promulguen en el futuro.

8.3 Supervivencia. Las obligaciones de las partes bajo este Acuerdo que sean necesarias para proteger la PHI de individuos sobrevivirán a la terminación de este Acuerdo.

8.4 Contacto de Cumplimiento HIPAA — Zéndity:
    Oficial de Privacidad: compliance@zendity.com
    Teléfono: (787) 000-0000
    Dirección: San Juan, Puerto Rico 00901

Este documento fue generado el ` + new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" }) + ` y refleja los compromisos vigentes de Zéndity LLC.`;

// ─── Componente principal ────────────────────────────────────────────────
export default function BAAPage() {
    const router = useRouter();
    const [sedes, setSedes] = useState<Sede[]>(SEDES_MOCK);
    const [modalBAAOpen, setModalBAAOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    // Verificación de rol
    useEffect(() => {
        fetch("/api/auth/session")
            .then((r) => r.json())
            .then((session) => {
                if (!session?.user || (session.user as any).role !== "SUPER_ADMIN") {
                    router.push("/");
                } else {
                    setCheckingAuth(false);
                }
            })
            .catch(() => router.push("/"));
    }, [router]);

    const mostrarToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3500);
    };

    const enviarBAA = (id: string) => {
        setSedes((prev) =>
            prev.map((s) =>
                s.id === id ? { ...s, estado: "PENDIENTE" as BAAEstado } : s
            )
        );
        mostrarToast("BAA enviado por email a la sede");
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const firmadas = sedes.filter((s) => s.estado === "FIRMADO").length;
    const pendientes = sedes.filter((s) => s.estado === "PENDIENTE").length;

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200">
            {/* Toast */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-teal-600 text-white px-5 py-3 rounded-xl shadow-2xl shadow-teal-900/40 animate-in slide-in-from-top-4 duration-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-semibold">{toast}</span>
                </div>
            )}

            {/* Header */}
            <header className="border-b border-slate-800/80 bg-[#0f172a]/90 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-900/40">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
                                Acuerdos BAA (HIPAA)
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Business Associate Agreements — gestión centralizada
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-teal-700 to-teal-500 text-white shadow-lg shadow-teal-900/30">
                            Super Admin
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-8 py-10 pb-20 space-y-10">
                {/* KPIs rápidos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                            Total Sedes
                        </p>
                        <p className="text-3xl font-black text-white">{sedes.length}</p>
                    </div>
                    <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-5">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                            BAAs Firmados
                        </p>
                        <p className="text-3xl font-black text-emerald-400">{firmadas}</p>
                    </div>
                    <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-5">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                            Pendientes de Firma
                        </p>
                        <p className="text-3xl font-black text-amber-400">{pendientes}</p>
                    </div>
                </div>

                {/* Tabla de sedes */}
                <section>
                    <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-teal-400" />
                        Estado de BAAs por Sede
                    </h2>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-950/60">
                                <tr>
                                    <th className="text-left p-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                        Sede
                                    </th>
                                    <th className="text-center p-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                        Plan
                                    </th>
                                    <th className="text-center p-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                        Fecha Firma
                                    </th>
                                    <th className="text-center p-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                        Estado
                                    </th>
                                    <th className="text-center p-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                        Acción
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {sedes.map((sede) => (
                                    <tr
                                        key={sede.id}
                                        className="hover:bg-slate-800/20 transition-colors"
                                    >
                                        {/* Sede */}
                                        <td className="p-4">
                                            <p className="font-bold text-white">{sede.nombre}</p>
                                        </td>

                                        {/* Plan */}
                                        <td className="p-4 text-center">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 border border-slate-700">
                                                {sede.plan}
                                            </span>
                                        </td>

                                        {/* Fecha firma */}
                                        <td className="p-4 text-center">
                                            {sede.fechaFirma ? (
                                                <span className="text-slate-300 text-sm">
                                                    {new Date(sede.fechaFirma).toLocaleDateString(
                                                        "es-PR",
                                                        {
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "numeric",
                                                        }
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 text-sm italic">
                                                    Sin fecha
                                                </span>
                                            )}
                                        </td>

                                        {/* Estado */}
                                        <td className="p-4 text-center">
                                            {sede.estado === "FIRMADO" ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    FIRMADO
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    PENDIENTE
                                                </span>
                                            )}
                                        </td>

                                        {/* Acción */}
                                        <td className="p-4 text-center">
                                            {sede.estado === "PENDIENTE" ? (
                                                <button
                                                    onClick={() => enviarBAA(sede.id)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600/20 text-teal-400 text-xs font-bold border border-teal-600/30 hover:bg-teal-600/30 transition-colors"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    Enviar BAA
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800/40 text-slate-600 text-xs font-bold border border-slate-700/40 cursor-default">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    Completado
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Card — Ver plantilla BAA */}
                <section>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-teal-600/20 border border-teal-600/30 flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-teal-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white">
                                        Plantilla BAA — Zéndity LLC
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        Acuerdo de Asociado de Negocio HIPAA estándar · Vigencia 1 año renovable
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalBAAOpen(true)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition-colors shadow-lg shadow-teal-900/30"
                            >
                                <Eye className="w-4 h-4" />
                                Ver Plantilla BAA
                            </button>
                        </div>

                        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                "Definiciones HIPAA",
                                "Obligaciones del BA",
                                "Salvaguardas de seguridad",
                                "Notificación de brechas",
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="flex items-center gap-2 bg-slate-800/40 rounded-lg px-3 py-2"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                    <span className="text-xs text-slate-400">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* Modal del BAA */}
            {modalBAAOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8">
                    {/* Overlay */}
                    <div
                        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
                        onClick={() => setModalBAAOpen(false)}
                    />

                    {/* Contenido del modal */}
                    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                        {/* Header del modal */}
                        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-teal-600/20 border border-teal-600/30 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-teal-400" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white">
                                        Plantilla BAA — Zéndity LLC
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        HIPAA Business Associate Agreement · Versión 1.0 · 2025
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalBAAOpen(false)}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Texto legal con scroll */}
                        <div className="overflow-y-auto flex-1 px-6 py-6">
                            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed">
                                {BAA_TEXTO}
                            </pre>
                        </div>

                        {/* Footer del modal */}
                        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-6 py-4 flex items-center justify-between rounded-b-2xl shrink-0">
                            <p className="text-xs text-slate-500">
                                Vigencia: 1 año — renovación automática anual. Regulado por las leyes de Puerto Rico y HIPAA federal.
                            </p>
                            <button
                                onClick={() => setModalBAAOpen(false)}
                                className="px-5 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

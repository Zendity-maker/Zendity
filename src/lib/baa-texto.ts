/**
 * ACUERDO DE ASOCIADO COMERCIAL (BAA) — TEXTO BASE
 * ────────────────────────────────────────────────
 * Zéndity procesa información de salud protegida (PHI) de residentes que
 * pertenecen al hogar, no a Zéndity. Bajo HIPAA eso convierte al hogar en
 * *covered entity* y a Zéndity en *business associate*, y exige un acuerdo
 * escrito entre ambos antes de que Zéndity toque el primer expediente.
 *
 * Este texto cubre las cláusulas que **45 CFR 164.504(e)(2)** requiere de forma
 * obligatoria, redactadas en español y aterrizadas a un hogar de envejecientes
 * en Puerto Rico. Se siguió la estructura estándar del sector: uso y divulgación
 * permitidos, salvaguardas, reporte de incidentes, subcontratistas, derechos del
 * residente, acceso del HHS, devolución o destrucción al terminar, y terminación
 * por incumplimiento.
 *
 * ⚠️ REVISIÓN LEGAL PENDIENTE. Esto es un borrador técnico completo y fiel al
 * reglamento, no un documento revisado por abogado. Antes de usarlo con un
 * cliente real tiene que pasar por un licenciado en Puerto Rico, sobre todo:
 *   · las cláusulas de indemnización y límite de responsabilidad, que HIPAA no
 *     dicta y son negociación comercial;
 *   · los plazos de notificación, que aquí se fijan más cortos que el mínimo
 *     federal a propósito, y hay que confirmar que se pueden sostener;
 *   · la interacción con la Ley 194 de PR y con los requisitos del
 *     Departamento de la Familia para establecimientos de larga estadía.
 */

export const BAA_VERSION = '2026.09';

export interface DatosBAA {
    hqNombre: string;
    hqDireccion?: string | null;
    /** Quién firma por el hogar. */
    representante?: string | null;
    fechaEfectiva?: Date;
}

const NOMBRE_PROVEEDOR = 'Zéndity';

export function textoBAA(d: DatosBAA): { titulo: string; secciones: { titulo: string; cuerpo: string }[] } {
    const hogar = d.hqNombre;
    const fecha = (d.fechaEfectiva ?? new Date()).toLocaleDateString('es-PR', {
        day: '2-digit', month: 'long', year: 'numeric',
    });

    return {
        titulo: 'Acuerdo de Asociado Comercial (Business Associate Agreement)',
        secciones: [
            {
                titulo: 'Partes y fecha de vigencia',
                cuerpo:
                    `Este Acuerdo se celebra entre ${hogar}${d.hqDireccion ? `, con dirección en ${d.hqDireccion}` : ''} ` +
                    `(el "Hogar", entidad cubierta bajo HIPAA) y ${NOMBRE_PROVEEDOR} (el "Asociado Comercial"), ` +
                    `con fecha de vigencia ${fecha}.\n\n` +
                    `El Hogar utiliza la plataforma ${NOMBRE_PROVEEDOR} para documentar el cuidado de sus residentes. ` +
                    `En el curso de ese servicio, ${NOMBRE_PROVEEDOR} crea, recibe, mantiene y transmite información de ` +
                    `salud protegida ("PHI") que pertenece al Hogar y a sus residentes. Este Acuerdo regula ese manejo ` +
                    `conforme a la Regla de Privacidad y la Regla de Seguridad de HIPAA (45 CFR Partes 160 y 164).`,
            },
            {
                titulo: 'Usos y divulgaciones permitidos',
                cuerpo:
                    `${NOMBRE_PROVEEDOR} usará y divulgará PHI únicamente para prestar los servicios contratados por el ` +
                    `Hogar: documentación clínica y de cuidado, administración de medicamentos, planes de atención, ` +
                    `comunicación con familiares autorizados por el Hogar, y los informes que el Hogar solicite.\n\n` +
                    `${NOMBRE_PROVEEDOR} NO usará ni divulgará PHI para ningún otro fin. En particular, no venderá PHI, ` +
                    `no la usará para mercadeo, y no la usará para entrenar modelos de inteligencia artificial de uso ` +
                    `general. El procesamiento con inteligencia artificial ocurre exclusivamente para generar documentos ` +
                    `del propio residente —como su plan de atención— por instrucción del Hogar.\n\n` +
                    `${NOMBRE_PROVEEDOR} podrá usar PHI para su administración interna y para cumplir obligaciones ` +
                    `legales, dentro de lo permitido por 45 CFR 164.504(e)(4).`,
            },
            {
                titulo: 'Salvaguardas',
                cuerpo:
                    `${NOMBRE_PROVEEDOR} implementará salvaguardas administrativas, físicas y técnicas razonables y ` +
                    `apropiadas para proteger la confidencialidad, integridad y disponibilidad de la PHI electrónica, ` +
                    `conforme a la Regla de Seguridad (45 CFR Parte 164, Subparte C). Esto incluye, como mínimo: ` +
                    `cifrado en tránsito y en reposo, control de acceso por rol y por sede, registro de auditoría de ` +
                    `accesos y cambios, y respaldo de la información.\n\n` +
                    `${NOMBRE_PROVEEDOR} limitará el acceso a PHI al personal que lo necesite para prestar el servicio, ` +
                    `bajo el principio de mínimo necesario.`,
            },
            {
                titulo: 'Reporte de incidentes y brechas',
                cuerpo:
                    `${NOMBRE_PROVEEDOR} notificará al Hogar cualquier uso o divulgación de PHI no permitido por este ` +
                    `Acuerdo, cualquier incidente de seguridad, y cualquier brecha de PHI no asegurada, ` +
                    `SIN DEMORA IRRAZONABLE y en ningún caso después de CINCO (5) DÍAS CALENDARIO desde que ` +
                    `${NOMBRE_PROVEEDOR} tenga conocimiento del hecho.\n\n` +
                    `La notificación incluirá, en la medida en que se conozca: qué ocurrió, cuándo, qué residentes y qué ` +
                    `tipo de información se vieron afectados, qué se hizo para mitigarlo y qué se está haciendo para ` +
                    `evitar su repetición. ${NOMBRE_PROVEEDOR} cooperará con el Hogar en cualquier notificación que ` +
                    `este deba emitir bajo 45 CFR 164.400-414.\n\n` +
                    `El plazo de cinco días es más corto que el máximo federal, y se asume deliberadamente: el Hogar ` +
                    `tiene sus propios plazos de notificación a residentes y a reguladores, y no puede cumplirlos si se ` +
                    `entera tarde.`,
            },
            {
                titulo: 'Subcontratistas',
                cuerpo:
                    `${NOMBRE_PROVEEDOR} exigirá, mediante acuerdo escrito, que todo subcontratista que cree, reciba, ` +
                    `mantenga o transmita PHI en su nombre acepte las mismas restricciones y condiciones que aplican a ` +
                    `${NOMBRE_PROVEEDOR} bajo este Acuerdo, conforme a 45 CFR 164.502(e)(1)(ii).\n\n` +
                    `A la fecha de vigencia, ${NOMBRE_PROVEEDOR} utiliza proveedores de infraestructura para alojamiento ` +
                    `de aplicación, base de datos, almacenamiento de respaldos y envío de correo. El Hogar puede ` +
                    `solicitar en cualquier momento la lista vigente de subcontratistas con acceso a PHI.`,
            },
            {
                titulo: 'Derechos del residente',
                cuerpo:
                    `${NOMBRE_PROVEEDOR} pondrá la PHI a disposición del Hogar para que este pueda cumplir sus ` +
                    `obligaciones frente a los residentes:\n\n` +
                    `· Acceso del residente a su expediente (45 CFR 164.524).\n` +
                    `· Enmienda de información incorrecta o incompleta (45 CFR 164.526).\n` +
                    `· Rendición de cuentas de divulgaciones (45 CFR 164.528).\n\n` +
                    `${NOMBRE_PROVEEDOR} responderá a las solicitudes del Hogar en un plazo que le permita a este cumplir ` +
                    `los suyos, y en ningún caso mayor de DIEZ (10) DÍAS HÁBILES.`,
            },
            {
                titulo: 'Acceso del Departamento de Salud federal',
                cuerpo:
                    `${NOMBRE_PROVEEDOR} pondrá sus prácticas internas, libros y registros relacionados con el uso y ` +
                    `divulgación de PHI a disposición del Secretario del Department of Health and Human Services (HHS) ` +
                    `para determinar el cumplimiento del Hogar con HIPAA, conforme a 45 CFR 164.504(e)(2)(ii)(H).`,
            },
            {
                titulo: 'Terminación',
                cuerpo:
                    `El Hogar puede terminar este Acuerdo y el servicio si ${NOMBRE_PROVEEDOR} incumple una obligación ` +
                    `material y no la subsana dentro de TREINTA (30) DÍAS de notificado.\n\n` +
                    `Al terminar, ${NOMBRE_PROVEEDOR} devolverá al Hogar toda la PHI en un formato utilizable y legible ` +
                    `—incluyendo expedientes clínicos, registros de medicamentos y planes de atención— y destruirá las ` +
                    `copias que conserve, salvo aquellas cuya retención exija la ley. Mientras conserve cualquier PHI, ` +
                    `las obligaciones de este Acuerdo siguen vigentes.\n\n` +
                    `El Hogar tendrá acceso a la exportación de su información durante al menos SESENTA (60) DÍAS ` +
                    `después de la terminación, independientemente del motivo de esta, incluido el impago. La ` +
                    `información clínica de un residente no se retiene como garantía de cobro.`,
            },
            {
                titulo: 'Disposiciones generales',
                cuerpo:
                    `Este Acuerdo se interpretará conforme a HIPAA y a las leyes del Estado Libre Asociado de Puerto Rico. ` +
                    `Cuando una disposición admita más de una lectura, prevalecerá la que permita al Hogar cumplir con ` +
                    `HIPAA.\n\n` +
                    `Si la reglamentación aplicable cambia, las partes acuerdan negociar de buena fe las enmiendas ` +
                    `necesarias para mantener el cumplimiento.\n\n` +
                    `Este Acuerdo no crea derechos a favor de terceros, y sobrevive a la terminación del contrato de ` +
                    `servicio mientras ${NOMBRE_PROVEEDOR} conserve PHI del Hogar.`,
            },
        ],
    };
}

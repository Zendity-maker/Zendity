/**
 * QUIÉN ES EL FAMILIAR PRINCIPAL
 * ──────────────────────────────
 * `Patient.primaryFamilyMemberId` solo se llenaba si alguien marcaba una casilla
 * al crear o editar un familiar. Nadie la marcaba: al 02-sep-2026 solo 4 de 19
 * residentes con contacto lo tenían asignado.
 *
 * El efecto no era cosmético. El correo del PAI aprobado sale ÚNICAMENTE al
 * familiar principal, así que aprobar un plan de alguien sin ese campo lo dejaba
 * firmado y en silencio. Le pasó a Rosa M. Solis De Arce: su plan quedó aprobado
 * el 01-sep y su hija Ivette —que tiene correo y cuenta activa— nunca supo.
 *
 * Regla acordada: **el primero de la lista, salvo que se marque otro.**
 *
 * "Primero de la lista" necesita definición porque FamilyMember no guarda fecha
 * de creación: se usa el marcado como principal si existe, y si no el primero
 * por orden alfabético. Es determinista y estable. Para un residente con un solo
 * familiar —13 de los 15 sin asignar— la respuesta es obvia de todos modos; los
 * que tienen varios se resuelven con una decisión humana al aprobar el PAI.
 */

export type FamiliarCandidato = {
    id: string;
    name: string;
    email?: string | null;
    isPrimary?: boolean | null;
};

/**
 * Devuelve el familiar principal de un residente, o null si no tiene ninguno.
 *
 * @param familiares  todos los FamilyMember del residente
 * @param asignadoId  Patient.primaryFamilyMemberId, si está puesto
 */
export function resolverFamiliarPrincipal<T extends FamiliarCandidato>(
    familiares: T[],
    asignadoId?: string | null,
): T | null {
    if (!familiares?.length) return null;

    // 1. Lo elegido a mano manda siempre.
    if (asignadoId) {
        const elegido = familiares.find(f => f.id === asignadoId);
        if (elegido) return elegido;
        // Si apunta a un familiar que ya no está, se cae a la regla general
        // en vez de devolver null: el residente sí tiene a quién avisar.
    }

    // 2. El marcado con isPrimary.
    const marcado = familiares.find(f => f.isPrimary);
    if (marcado) return marcado;

    // 3. El primero de la lista, en orden estable.
    return [...familiares].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'es'),
    )[0];
}

/**
 * ¿Hay que preguntarle a un humano quién es el principal?
 * Solo cuando hay varios candidatos y nadie ha elegido: ahí la inferencia
 * alfabética sería una decisión de la máquina sobre a quién se le avisa de la
 * salud de un residente, y esa no le toca.
 */
export function requiereElegirPrincipal(
    familiares: FamiliarCandidato[],
    asignadoId?: string | null,
): boolean {
    if (!familiares?.length) return false;
    if (asignadoId && familiares.some(f => f.id === asignadoId)) return false;
    if (familiares.some(f => f.isPrimary)) return false;
    return familiares.length > 1;
}

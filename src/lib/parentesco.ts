/**
 * Parentescos que se ofrecen al registrar un familiar.
 *
 * Una sola lista para las dos pantallas que registran familia —el alta del
 * perfil y el paso 5 del asistente de admisión— porque si divergen, el mismo
 * dato se guarda escrito de dos formas distintas y deja de poder agruparse.
 */
export const PARENTESCOS = ["Hijo/a", "Esposo/a", "Nieto/a", "Hermano/a", "Sobrino/a", "Otro"] as const;

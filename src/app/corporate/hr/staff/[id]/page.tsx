import { redirect } from 'next/navigation';

/**
 * Perfil de empleado — consolidado en /hr/staff/[id] (19-ago-2026).
 *
 * Existían DOS perfiles del mismo empleado, con 458 y 702 líneas de código
 * separado y secciones distintas: este tenía evaluaciones de RRHH, Academia y
 * cumplimiento eMAR; el otro tenía el Z-Score con su historial, asistencia e
 * incidentes. Ninguno era el viejo — cada uno mostraba cosas que el otro no,
 * así que la información de una persona dependía de qué ruta abrieras.
 *
 * El síntoma que lo destapó: un rediseño aplicado a un perfil no se veía en el
 * otro. Iba a repetirse en cada cambio.
 *
 * Todo vive ahora en /hr/staff/[id]. Esta ruta redirige para no romper los
 * enlaces existentes ni los que estén guardados en marcadores.
 */
export default async function CorporateStaffProfileRedirect({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    redirect(`/hr/staff/${id}`);
}

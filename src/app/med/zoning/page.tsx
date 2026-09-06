import { redirect } from 'next/navigation';

/**
 * ESTA PANTALLA ERA UN TERCER CAMINO AL MISMO CAMPO.
 *
 * `/med/zoning` reasignaba el grupo de color de un residente. El problema no
 * era que estuviera rota — funcionaba — sino que:
 *
 *   · NADIE PODÍA LLEGAR. Ningún enlace del sistema apuntaba aquí. El menú dice
 *     "Med & Zoning" pero lleva a /med, que no tiene zoning.
 *   · YA HABÍA DOS CAMINOS. El color del residente se cambia desde su ficha
 *     (/api/corporate/patients/[id], en dos sitios distintos del mismo archivo).
 *     Tres formas de escribir el mismo campo es tres formas de que una se quede
 *     sin el registro de auditoría que tienen las otras.
 *
 * Se redirige al directorio de residentes, que es donde el color se cambia de
 * verdad. No se borra el archivo: nadie enlazaba aquí, pero quien tuviera la URL
 * guardada merece llegar al sitio bueno y no a un 404.
 *
 * Su API —/api/nursing/zoning— se eliminó en el mismo commit: esta pantalla era
 * su único llamador.
 */
export default function ZoningRedirect() {
    redirect('/corporate/medical/patients');
}

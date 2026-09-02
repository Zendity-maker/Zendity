import { NextResponse } from 'next/server';

/**
 * RUTA RETIRADA — el PAI se aprueba en un solo lugar.
 *
 * Esta ruta era el segundo camino para firmar un LifePlan, desde /cuidadores,
 * detrás de un campo "PIN Médico". Se retira el 02-sep-2026 por tres razones:
 *
 * 1. El PIN no validaba nada. La ruta exigía 4 caracteres cualesquiera y el
 *    firmante salía de la sesión, no del PIN. Daba sensación de control clínico
 *    que no estaba ocurriendo.
 * 2. Firmaba a medias. Ponía status APPROVED y sellaba el firmante, pero no
 *    guardaba el contenido editado, no exigía la versión familiar y NO enviaba
 *    el correo a la familia. Un plan aprobado por aquí quedaba en silencio.
 * 3. Sus permisos no cuadraban con los de la propia lista: listar exigía
 *    NURSE/SUPERVISOR/DIRECTOR/ADMIN y firmar aceptaba también CAREGIVER.
 *
 * El PAI se aprueba en su propia pantalla —/corporate/medical/patients/[id]/pai—
 * con el botón "Firmar Clínicamente", que guarda el contenido, exige la versión
 * familiar y dispara el correo al familiar principal.
 *
 * Se responde 410 Gone en vez de borrar el archivo: si algo quedó apuntando aquí
 * (un enlace guardado, una pestaña vieja), tiene que fallar con un mensaje que
 * explique a dónde ir, no con un 404 mudo.
 */
export async function POST() {
    return NextResponse.json(
        {
            success: false,
            error: 'El PAI ya no se firma desde aquí. Ábrelo desde el expediente del residente y apruébalo ahí, para que la familia reciba su copia.',
        },
        { status: 410 },
    );
}

import { redirect } from 'next/navigation';

/**
 * LA TARJETA DE EMERGENCIA YA NO EXISTE — SU URL SÍ.
 *
 * Hacía el mismo trabajo que el Resumen del Residente, y el hogar decidió cuál
 * gana probándolos de verdad: en emergencias PRIMERO ADMITEN A LA PERSONA y
 * después la tratan, y para admitirla piden la tarjeta del plan médico. Esta
 * tarjeta llevaba el NOMBRE del plan; el resumen lleva LA IMAGEN de la tarjeta
 * —28 de 32 residentes de Cupey la tienen guardada— más la foto del residente y
 * los últimos signos vitales.
 *
 * Dos papeles para el mismo momento es garantizar que alguien saque el
 * equivocado con prisa, y quien lo recibe no tiene forma de saber cuál le tocó.
 * Es lo mismo que le pasaba al PAI con sus dos caminos.
 *
 * NO SE BORRA, SE REDIRIGE. Se enlazaba desde la ficha del residente, así que
 * alguien puede tener la URL guardada. Borrarla daría un 404 a quien iba con
 * prisa a por un papel para un traslado.
 */
export default async function TarjetaEmergenciaRedirect(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    redirect(`/corporate/medical/patients/${id}`);
}

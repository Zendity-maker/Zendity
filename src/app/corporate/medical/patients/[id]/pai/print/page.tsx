import { redirect } from 'next/navigation';

/**
 * ESTA PANTALLA YA NO EXISTE — SU URL SÍ.
 *
 * El PAI tenía DOS caminos para sacar el mismo papel:
 *
 *   /pai        genera un PDF de verdad con `generatePaiPDF` — membrete,
 *               paginación, saltos controlados
 *   /pai/print  llamaba a `window.print()` sobre una pantalla, con varias
 *               clases rotas (`print:border-blacklack`) que perdían los bordes
 *
 * Dos formas de producir el mismo documento clínico con resultados distintos,
 * según por dónde entrara cada quien. Eso es pedir que alguien entregue el
 * equivocado, y quien lo recibe no tiene forma de saber cuál le tocó.
 *
 * NO SE BORRA, SE REDIRIGE. Nadie enlaza aquí desde sep-2026, pero la URL puede
 * estar en los marcadores de alguien. Borrarla daría un 404 a quien hacía lo
 * correcto; redirigirla lo lleva al papel bueno sin que tenga que enterarse.
 *
 * El portal de familias usa el mismo `generatePaiPDF`, así que el hogar y la
 * familia reciben exactamente el mismo documento — que es la única forma de que
 * una conversación sobre el plan de cuido tenga sentido.
 */
export default async function PAIPrintRedirect(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    redirect(`/corporate/medical/patients/${id}/pai`);
}

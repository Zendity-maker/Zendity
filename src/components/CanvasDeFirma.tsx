/**
 * EL RECUADRO DE FIRMA. UNA SOLA DEFINICIÓN.
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * `react-signature-canvas` trae este valor por omisión:
 *
 *     static defaultProps = { clearOnResize: true }
 *     on() { window.addEventListener('resize', this._checkClearOnResize) }
 *
 * y `_checkClearOnResize` acaba en `_resizeCanvas()`, que hace esto
 * (node_modules/react-signature-canvas/src/index.tsx):
 *
 *     canvas.width  = canvas.offsetWidth  * ratio
 *     canvas.height = canvas.offsetHeight * ratio
 *     canvas.getContext('2d').scale(ratio, ratio)
 *     this.clear()                      // ← LA FIRMA SE VA
 *
 * Solo se salva quien pase `width` Y `height` dentro de `canvasProps`, porque
 * entonces la función sale antes de tocar nada. Las SEIS instancias del repo
 * pasan `className: 'w-full h-NN'` y ninguna pasa width ni height:
 *
 *     care/page.tsx:5872 (pack de medicamentos) · care/page.tsx:6021 (PRN)
 *     ShiftClosureWizard.tsx:735 (cierre de turno) · HandoverSignDrawer.tsx:253
 *     corporate/reports/page.tsx:391 · family/documents/[id]/page.tsx:131
 *
 * O sea que las seis borraban la firma en CADA evento `resize` de la ventana.
 * Y `clear()` no se salta ni cuando el recuadro mide exactamente lo mismo que
 * antes: se llama sin condición.
 *
 * ═══ QUÉ SIGNIFICA ESO EN UNA TABLETA ═══
 *
 * `resize` no es un evento raro en un navegador móvil. Lo dispara girar la
 * tableta, lo dispara el teclado en pantalla al abrirse y al cerrarse, y lo
 * dispara la barra de direcciones al colapsarse con el scroll.
 *
 * El caso del teclado tiene nombre y sitio: en el PRN (`care/page.tsx`) la
 * cuidadora escribe primero PARA QUÉ dio la dosis en un `<input type="text">`
 * y firma después, en un recuadro que está justo debajo. Tocar el recuadro
 * cierra el teclado — y cerrar el teclado dispara `resize`, que llamaba a
 * `clear()` encima del trazo que estaba empezando.
 *
 * Lo MEDIDO es que cualquier `resize` borraba (está en el código de la
 * librería, arriba). Lo INFERIDO es con qué frecuencia le pasa a cada persona:
 * eso depende del navegador de su tableta y no hay telemetría que lo diga.
 *
 * Y no todas las seis perdían el trabajo igual. Depende de DÓNDE se lee la
 * firma al enviar:
 *
 *   · Del canvas en el momento del submit → se pierde entera. Pack de
 *     medicamentos, PRN, reportes y documentos de familia.
 *   · De un `useState` que se llenó en `onEnd` → el envío sobrevive, pero la
 *     pantalla queda mintiendo: borde verde de «firmado» sobre un recuadro en
 *     blanco. Cierre de turno y relevo.
 *
 * ═══ POR QUÉ NO BASTA `clearOnResize={false}` ═══
 *
 * Porque entonces el bitmap no se reescala nunca. Si el recuadro cambia de
 * ancho de verdad, el trazo viejo se estira y los trazos nuevos caen
 * desplazados, porque signature_pad calcula el punto contra
 * `getBoundingClientRect()` y el bitmap ya no le corresponde.
 *
 * Así que este componente hace las dos cosas que la librería no hace:
 *
 *   1. Si el recuadro mide lo mismo, NO TOCA NADA. Ese es el caso mayoritario
 *      en tableta —la ventana cambió de alto, el recuadro no—, y ahí el
 *      arreglo consiste precisamente en no hacer nada.
 *   2. Si cambió de verdad, guarda los trazos con `toData()`, reescala, y los
 *      repone con `fromData()`. Los puntos se guardan en coordenadas CSS, así
 *      que vuelven al mismo sitio y no estirados.
 */

'use client';

import React, { useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

/** Las mismas props de la librería, menos la que aquí se decide siempre igual. */
export type PropsCanvasDeFirma = Omit<React.ComponentProps<typeof SignatureCanvas>, 'clearOnResize'>;

export const CanvasDeFirma = React.forwardRef<SignatureCanvas, PropsCanvasDeFirma>(
    function CanvasDeFirma(props, refExterna) {
        const interno = useRef<SignatureCanvas | null>(null);

        /** Una ref para los dos: la de dentro para el resize, la de fuera para quien nos usa. */
        const asignarRef = (instancia: SignatureCanvas | null) => {
            interno.current = instancia;
            if (typeof refExterna === 'function') refExterna(instancia);
            else if (refExterna) refExterna.current = instancia;
        };

        useEffect(() => {
            const alRedimensionar = () => {
                const pad = interno.current;
                if (!pad) return;

                let canvas: HTMLCanvasElement;
                try {
                    // getCanvas() lanza si la ref es null (montaje / desmontaje).
                    canvas = pad.getCanvas();
                } catch {
                    return;
                }

                /**
                 * El mismo cálculo que hace la librería, con la misma truncación:
                 * `canvas.width` es un entero sin signo, así que asignarle 514,5
                 * guarda 514. Calcularlo distinto daría una diferencia de un
                 * píxel y el componente se pondría a reescalar en cada resize
                 * sin que nada hubiera cambiado.
                 */
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                const anchoQueToca = Math.trunc(canvas.offsetWidth * ratio);
                const altoQueToca = Math.trunc(canvas.offsetHeight * ratio);

                // El recuadro está oculto o aún sin medir: no se mide, no se toca.
                if (anchoQueToca === 0 || altoQueToca === 0) return;

                // No cambió nada de verdad. Aquí es donde se salva la firma.
                if (canvas.width === anchoQueToca && canvas.height === altoQueToca) return;

                let trazos: ReturnType<SignatureCanvas['toData']> = [];
                try {
                    trazos = pad.toData() ?? [];
                } catch {
                    trazos = [];
                }

                canvas.width = anchoQueToca;
                canvas.height = altoQueToca;
                canvas.getContext('2d')?.scale(ratio, ratio);

                try {
                    // clear() siempre: asignar `canvas.width` ya borró los píxeles,
                    // pero el estado interno (`_data`, `_isEmpty`) hay que dejarlo
                    // de acuerdo con lo que se ve.
                    pad.clear();
                    if (trazos.length > 0) pad.fromData(trazos);
                } catch (e) {
                    console.error('[CanvasDeFirma] no se pudo reponer el trazo tras el resize', e);
                }
            };

            window.addEventListener('resize', alRedimensionar);
            return () => window.removeEventListener('resize', alRedimensionar);
        }, []);

        return <SignatureCanvas ref={asignarRef} clearOnResize={false} {...props} />;
    }
);

export default CanvasDeFirma;

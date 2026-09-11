/**
 * Convierte un documento HTML de scripts/documentos/ en PDF.
 *
 * El HTML vive en el repo A PROPOSITO. Un PDF suelto en el escritorio de
 * alguien es exactamente como se quedaron viejos los cursos de Academy: cuando
 * la pantalla cambia, nadie sabe de donde salio la foto ni como rehacerla.
 *
 *   npx tsx scripts/documentos/render.ts guia-del-ingreso-al-piso
 *
 * Deja el PDF en la raiz del repo con el nombre que lleve el <title>.
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';

const nombre = process.argv[2]?.replace(/\.html$/, '');
if (!nombre) { console.error('uso: npx tsx scripts/documentos/render.ts <nombre>'); process.exit(1); }

const ORIGEN = resolve(`scripts/documentos/${nombre}.html`);
const DESTINO = process.argv[3] ?? resolve(`${nombre}.pdf`);

(async () => {
    if (!existsSync(ORIGEN)) throw new Error(`no existe ${ORIGEN}`);
    const nav = await chromium.launch();
    const pag = await nav.newPage();
    const fallos: string[] = [];
    pag.on('pageerror', e => fallos.push(e.message));
    await pag.goto('file://' + ORIGEN, { waitUntil: 'networkidle' });

    /**
     * QUE NO SALGA UN PDF CON FOTOS ROTAS SIN QUE NADIE SE ENTERE.
     *
     * Una captura renombrada deja un hueco blanco del tamaño exacto del texto
     * alternativo, y el PDF se genera igual. Se revienta aqui.
     */
    const rotas = await pag.evaluate(() =>
        [...document.querySelectorAll('img')]
            .filter(i => !i.complete || i.naturalWidth === 0)
            .map(i => i.getAttribute('src')));
    if (rotas.length) throw new Error('imagenes que no cargaron:\n  ' + rotas.join('\n  '));

    await pag.pdf({ path: DESTINO, format: 'Letter', printBackground: true });
    await nav.close();
    if (fallos.length) console.log('avisos:', fallos.slice(0, 3));
    console.log('OK →', DESTINO);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });

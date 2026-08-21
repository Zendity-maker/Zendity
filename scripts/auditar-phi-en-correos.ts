/**
 * Busca contenido clínico interpolado dentro de cuerpos de correo.
 *
 * Regla del proyecto: el correo avisa, no informa. Nada de diagnósticos,
 * medicación, planes de atención ni nombres de residentes en el cuerpo o el
 * asunto — el detalle vive en el portal, detrás de autenticación.
 *
 * Auditoría del 21-ago-2026: cuatro envíos la rompían. Este script existe para
 * que el quinto se detecte solo.
 *
 * Uso: npx tsx scripts/auditar-phi-en-correos.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Interpolaciones que no deben aparecer dentro de un sgMail.send.
const SOSPECHOSOS: { patron: RegExp; que: string }[] = [
    { patron: /\$\{[^}]*patient[^}]*\.?name/i,        que: 'nombre del residente' },
    { patron: /\$\{[^}]*patientName/i,                que: 'nombre del residente' },
    { patron: /\$\{[^}]*familyVersion/i,              que: 'plan de atención' },
    { patron: /\$\{[^}]*(diagnos|medicat|medicamento)/i, que: 'diagnóstico o medicación' },
    { patron: /\$\{[^}]*providerName/i,               que: 'proveedor externo' },
    { patron: /\$\{[^}]*(selectedOption|cleanText|selectedText)/i, que: 'texto clínico generado' },
    { patron: /\$\{[^}]*\bnotes\b/i,                  que: 'notas de turno' },
];

/**
 * Excepciones justificadas. Un chequeo que siempre falla se ignora, y ahí
 * vuelve el problema — la misma lección que las 286 alertas que nadie cerraba.
 * Cada excepción lleva su razón por escrito.
 */
const PERMITIDOS: { archivo: string; razon: string }[] = [
    {
        archivo: 'src/lib/family-invite-link.ts',
        razon: 'Invitación al portal. Nombrar al residente es lo que hace la invitación comprensible, y no revela nada clínico.',
    },
    {
        archivo: 'src/app/api/corporate/billing/[id]/pay/route.ts',
        razon: 'Recibo de pago. Misma razón que la factura: identifica por quién se pagó, y no lleva nada clínico.',
    },
    {
        archivo: 'src/lib/monthly-invoicing.ts',
        razon: 'Factura. Un documento de cobro tiene que identificar por quién se cobra; el destinatario es quien paga.',
    },
];

function archivos(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) out.push(...archivos(full));
        else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
    }
    return out;
}

let hallazgos = 0;
for (const f of archivos('src')) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('sgMail.send')) continue;
    if (PERMITIDOS.some(x => f.endsWith(x.archivo))) continue;

    // Aísla cada llamada de envío y mira solo dentro.
    let i = src.indexOf('sgMail.send');
    while (i !== -1) {
        const bloque = src.slice(i, i + 4000);
        const corte = bloque.indexOf('\n        });');
        const cuerpo = corte > 0 ? bloque.slice(0, corte) : bloque;
        for (const { patron, que } of SOSPECHOSOS) {
            const m = cuerpo.match(patron);
            if (m) {
                hallazgos++;
                console.log(`⚠️  ${f}`);
                console.log(`    ${que} → ${m[0].slice(0, 70)}`);
            }
        }
        i = src.indexOf('sgMail.send', i + 1);
    }
}

for (const x of PERMITIDOS) {
    console.log(`◦  ${x.archivo}`);
    console.log(`   permitido — ${x.razon}`);
}

console.log(hallazgos === 0
    ? '\n✅ Ningún cuerpo de correo interpola contenido clínico.'
    : `\n❌ ${hallazgos} posibles fugas. El correo avisa; el detalle va en el portal.`);
process.exit(hallazgos === 0 ? 0 : 1);

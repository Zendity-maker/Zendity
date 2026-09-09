/**
 * Correo de orientación al piso: "Algo cambió en el residente".
 *
 * POR QUÉ EXISTE. Medido el 09-sep-2026 contra producción, 90 días:
 *
 *   203 reportes escritos a mano en ~820 turnos.
 *   Las dos supervisoras firman la mitad.
 *   Diez cuidadoras con más de 500 turnos entre todas: de 0 a 19 cada una.
 *
 * Cuando diez de doce hacen lo mismo, no son diez problemas de actitud. El
 * botón de reportar vivía en la barra lateral —donde trabaja la supervisora,
 * no la cuidadora— y pedía escoger al residente de una lista de 33 nombres,
 * al residente que tiene delante.
 *
 * El botón de la tarjeta se puso el 05-sep-2026 y en cuatro días ya llevaba
 * cinco reportes. Los tres mejores los escribió la cuidadora que tenía CERO
 * notas en noventa días. No era que no reportara: no tenía dónde.
 *
 * Por eso este correo es de orientación, no de señalamiento. Se avisa que se
 * va a dar seguimiento —eso es honesto y Andrés lo pidió— pero lo que se pide
 * es una cosa concreta: que lo que se ve quede DENTRO de Zéndity y no en un
 * pasillo o un WhatsApp.
 *
 * SIN PHI. Regla 7 de CLAUDE.md: ni nombres de residentes, ni diagnósticos, ni
 * medicamentos. Los ejemplos son inventados a propósito, con el tono de los
 * reportes reales pero sin ningún dato de nadie.
 *
 * USO
 *   npx tsx scripts/orientacion-boton-cambios.ts              (solo lo escribe y lo abre)
 *   npx tsx scripts/orientacion-boton-cambios.ts --para-mi    (se lo manda a Andrés)
 *   npx tsx scripts/orientacion-boton-cambios.ts --enviar     (al piso)
 */
import sgMail from '@sendgrid/mail';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { prisma } from '../src/lib/prisma';

const HQ = 'a792f420-07a5-4088-8097-5ef47ca05ac8';
const ANDRES = 'serenityelderlyhome@gmail.com';
const PARA_MI = process.argv.includes('--para-mi');
const ENVIAR = process.argv.includes('--enviar');

const ASUNTO = '"Algo cambió en el residente" — cómo se reporta desde ahora';

const T = '#12211D';        // texto
const G = '#66766F';        // gris
const V = '#0F6E56';        // teal Zéndity
const F = '#F1F7F4';        // fondo suave

const p = (txt: string, extra = '') =>
    `<p style="margin:0 0 16px;font-size:15px;color:${T};${extra}">${txt}</p>`;
const h = (txt: string) =>
    `<p style="margin:26px 0 12px;font-size:15px;font-weight:800;color:${T};">${txt}</p>`;

const CUERPO = `<meta charset="utf-8"><div style="background:#ffffff;color:${T};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.65;padding:28px;max-width:560px;margin:0 auto;">

<p style="margin:0 0 6px;font-size:19px;font-weight:800;">Algo cambió en el residente</p>
<p style="margin:0 0 24px;font-size:14px;color:${G};">Cómo se reporta desde ahora · Vivid Senior Living Cupey</p>

${p('Buenos días,')}

${p('Ustedes son las que están con los residentes las ocho horas. Lo que ustedes notan en el turno no lo nota nadie más, y muchas veces es lo primero que avisa de algo que viene.')}

${p(`Desde el <strong>5 de septiembre</strong> hay un botón nuevo en la tarjeta de cada residente, debajo de los de Medicamentos, Vitales, Bitácora y Preventiva. Dice <strong>"Algo cambió en el residente"</strong>.`)}

<div style="background:${F};border-left:4px solid ${V};padding:16px 18px;margin:0 0 20px;">
<p style="margin:0;font-size:15px;">Es un toque desde la tarjeta del residente que tienes delante. Escoges el área —piel, apetito, dolor, movilidad, cognición, ánimo u otro—, escribes con tus palabras lo que viste, y ya. No hay que llenar nada más.</p>
</div>

${h('Qué se escribe ahí')}

${p('Lo que notaste, tal como se lo dirías a una compañera. No hace falta lenguaje médico:')}

<div style="margin:0 0 16px;padding-left:16px;border-left:2px solid #d9e5e0;">
<p style="margin:0 0 8px;font-size:15px;color:${G};font-style:italic;">"Cuando camina como que se va de lado."</p>
<p style="margin:0 0 8px;font-size:15px;color:${G};font-style:italic;">"No quiere comer, y antes comía bien."</p>
<p style="margin:0 0 8px;font-size:15px;color:${G};font-style:italic;">"Se queja de dolor en el pecho."</p>
<p style="margin:0;font-size:15px;color:${G};font-style:italic;">"Está mucho más callada que de costumbre."</p>
</div>

${p('Eso es exactamente lo que sirve. No hay que estar segura de que es importante — para eso está enfermería. Si esperas a estar segura, el aviso ya se perdió.')}

${h('Qué pasa después')}

${p('Enfermería y supervisión lo ven. Alguien lo revisa y decide qué se hace. Y cuando se decide, <strong>la respuesta te llega a ti</strong>, para que sepas en qué quedó lo que reportaste. No se queda en el aire.')}

${h('Y esto es lo importante: tiene que quedar en Zéndity')}

${p('Lo que se dice de palabra en el pasillo, o por WhatsApp, se queda ahí. No le llega al turno que entra. No le llega a la enfermera. No está cuando el médico pregunta. Y no existe si dentro de tres meses hay que saber desde cuándo viene pasando algo.')}

${p('No es papeleo de más. Es el camino más corto para que lo que tú viste llegue a donde tiene que llegar.')}

${h('Le vamos a dar seguimiento')}

${p('A partir de ahora vamos a estar dando seguimiento al uso del botón y a la información que entra por ahí. No es para medir a nadie: es para saber si la herramienta está sirviendo de verdad y qué le falta.')}

${p('Si algo no te funciona, si no encuentras el botón, o si hay algo que quieres reportar y no ves dónde — dilo. Eso también lo queremos saber, y se arregla.')}

<div style="border-top:1px solid #e4ebe8;margin:28px 0 0;padding-top:18px;">
<p style="margin:0 0 4px;font-size:15px;color:${T};">Gracias por lo que hacen.</p>
<p style="margin:0;font-size:14px;color:${G};">Andrés Flores · Dirección<br>Vivid Senior Living Cupey · app.zendity.com</p>
</div>

</div>`;

async function main() {
    const archivo = '/tmp/correo-orientacion-boton.html';
    writeFileSync(archivo, CUERPO);
    console.log(`Asunto: ${ASUNTO}`);
    console.log(`Cuerpo escrito en: ${archivo}`);

    const destinatarios = await prisma.user.findMany({
        where: {
            headquartersId: HQ, isActive: true, isDeleted: false,
            OR: [{ role: { in: ['CAREGIVER', 'SUPERVISOR'] } }, { secondaryRoles: { hasSome: ['CAREGIVER'] } }],
        },
        select: { name: true, email: true },
        orderBy: { name: 'asc' },
    });
    const emails = [...new Set(destinatarios.map(d => d.email).filter((e): e is string => !!e && e.includes('@')))];

    console.log(`\nIría a ${emails.length} personas:`);
    destinatarios.forEach(d => console.log(`   ${d.name.trim().padEnd(28)} ${d.email ?? '(SIN CORREO)'}`));

    if (!PARA_MI && !ENVIAR) {
        console.log('\n[SOLO ESCRITO] --para-mi para verlo en tu correo · --enviar para mandarlo al piso');
        try { execSync(`open ${archivo}`); } catch { /* sin navegador, da igual */ }
        return;
    }

    const remitente = process.env.SENDGRID_FROM_EMAIL;
    if (!process.env.SENDGRID_API_KEY || !remitente) {
        console.log('\nSendGrid no está configurado en este shell. No se mandó nada.');
        return;
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const to = PARA_MI ? [ANDRES] : emails;
    await sgMail.send({
        to, from: remitente, isMultiple: true,
        subject: PARA_MI ? `[PRUEBA] ${ASUNTO}` : ASUNTO,
        html: CUERPO,
    });
    console.log(`\nEnviado a ${to.length}: ${to.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

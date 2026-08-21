/**
 * Avisa al personal que le falta la certificación geriátrica.
 *
 * Manda notificación dentro de la app y correo. El correo es el que llega al
 * teléfono aunque no abran Zendity, y por eso dice explícitamente que pueden
 * hacer el curso desde ahí.
 *
 * Repetible a propósito: córrelo hoy y otra vez cerca del plazo. Solo escribe a
 * quien AÚN no ha aprobado el curso, así que nadie recibe un recordatorio de
 * algo que ya hizo.
 *
 * Sin PHI: es formación, no información clínica.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/avisar-certificacion.ts            # simula
 *   DATABASE_URL="..." npx tsx scripts/avisar-certificacion.ts --confirmar
 *   ... --solo-app     (sin correo)
 */
import { PrismaClient } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import { CURSO_CAMPANA, FECHA_LIMITE_TEXTO, textoPlazo, diasRestantes } from '../src/lib/campana-certificacion';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--confirmar');
const SOLO_APP = process.argv.includes('--solo-app');
const HQ_NOMBRE = 'Vivid Senior Living Cupey';

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function correo(nombre: string, minutos: number) {
    const plazo = textoPlazo();
    return {
        subject: `Tu certificación vence el ${FECHA_LIMITE_TEXTO}`,
        text: `Hola ${nombre},\n\nTe falta completar el curso "${CURSO_CAMPANA}". `
            + `${plazo} — la fecha límite es el ${FECHA_LIMITE_TEXTO}.\n\n`
            + `Son ${minutos} minutos y LO PUEDES HACER DESDE TU TELÉFONO: entra a `
            + `app.zendity.com con tu correo y tu PIN, y busca Academia.\n\n`
            + `Este curso es el que acredita tu preparación como cuidador.\n\n— ${HQ_NOMBRE}`,
        html: `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <div style="background:#0F6E56;padding:24px 32px;">
      <div style="color:#fff;font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;opacity:.85;">Academia Zéndity</div>
      <div style="color:#fff;font-size:20px;font-weight:900;margin-top:4px;">Tu certificación está pendiente</div>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#0F172A;">Hola <strong>${nombre}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
        Te falta completar <strong>${CURSO_CAMPANA}</strong>, el curso que acredita tu preparación como cuidador.
      </p>
      <div style="background:#F0FDF9;border-left:4px solid #0F6E56;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#0F6E56;">${plazo}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#334155;">Fecha límite: ${FECHA_LIMITE_TEXTO}</p>
      </div>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
        Son <strong>${minutos} minutos</strong> y <strong>lo puedes hacer desde tu teléfono</strong>.
        Entra con tu correo y tu PIN, y busca <strong>Academia</strong>.
      </p>
      <div style="text-align:center;margin:8px 0 8px;">
        <a href="https://app.zendity.com/academy" style="background:#0F6E56;color:#fff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          Tomar el curso ahora
        </a>
      </div>
    </div>
    <div style="background:#F8FAFC;padding:14px 32px;border-top:1px solid #E2E8F0;text-align:center;">
      <p style="margin:0;color:#94A3B8;font-size:11px;">${HQ_NOMBRE} · Zéndity</p>
    </div>
  </div>
</body></html>`,
    };
}

async function main() {
    console.log(APLICAR ? '📣 Enviando avisos\n' : '🔍 SIMULACIÓN — no se envía nada\n');
    console.log(`Curso: ${CURSO_CAMPANA}`);
    console.log(`Plazo: ${textoPlazo()} (${FECHA_LIMITE_TEXTO})\n`);

    if (diasRestantes() < 0) console.log('⚠️  El plazo ya venció; el mensaje lo dice así.\n');

    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    let avisados = 0, correos = 0;

    for (const hq of sedes) {
        const curso = await prisma.course.findFirst({
            where: { headquartersId: hq.id, title: CURSO_CAMPANA, isActive: true },
            select: { id: true, durationMins: true },
        });
        if (!curso) continue;

        const asignaciones = await prisma.academyAssignment.findMany({
            where: { headquartersId: hq.id, moduleCode: curso.id },
            select: { userId: true },
        });
        const completados = new Set(
            (await prisma.userCourse.findMany({
                where: { courseId: curso.id, status: 'COMPLETED' },
                select: { employeeId: true },
            })).map(x => x.employeeId)
        );

        const gente = await prisma.user.findMany({
            where: { id: { in: asignaciones.map(a => a.userId) }, isActive: true, isDeleted: false },
            select: { id: true, name: true, email: true },
        });
        const faltan = gente.filter(u => !completados.has(u.id));

        console.log(`── ${hq.name} — ${faltan.length} de ${gente.length} sin completar`);

        for (const u of faltan) {
            const nombre = u.name?.trim() || 'Compañero';
            console.log(`   ${APLICAR ? '✅' : '→ '} ${nombre}`);
            if (!APLICAR) { avisados++; continue; }

            await prisma.notification.create({
                data: {
                    userId: u.id,
                    type: 'COURSE_COMPLETED',
                    title: '🎓 Tu certificación vence pronto',
                    message: `${CURSO_CAMPANA} — ${textoPlazo().toLowerCase()}, hasta el ${FECHA_LIMITE_TEXTO}. ${curso.durationMins} min, desde tu teléfono.`,
                    link: '/academy',
                },
            });
            avisados++;

            if (!SOLO_APP && u.email && process.env.SENDGRID_API_KEY) {
                try {
                    const c = correo(nombre, curso.durationMins);
                    await sgMail.send({
                        to: u.email,
                        from: {
                            email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                            name: 'Academia Zéndity',
                        },
                        ...c,
                    });
                    correos++;
                } catch (e: any) {
                    console.log(`        ⚠️  correo falló: ${e?.message ?? e}`);
                }
            }
        }
    }

    console.log(`\n${avisados} avisos${APLICAR ? ` · ${correos} correos` : ''}`);
    console.log(APLICAR
        ? '\nListo. Puedes correrlo otra vez más cerca del plazo: solo escribe a quien siga faltando.'
        : '\nPara enviar de verdad, agrega --confirmar');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

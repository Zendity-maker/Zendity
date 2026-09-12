/**
 * AVISA AL PISO DEL CURSO DE CAÍDAS, CON LO QUE HA PASADO DE VERDAD.
 *
 * El curso "Protocolo de Respuesta a Caídas" quedó asignado el 12-sep-2026 a las
 * 14 personas que pisan el piso en Cupey. El backfill no notificó a nadie a
 * propósito —catorce avisos idénticos el mismo minuto son ruido— y este script
 * es la otra mitad: el aviso que sí explica por qué.
 *
 * LOS NÚMEROS NO SE ESCRIBEN A MANO. Se cuentan de FallIncident cada vez que se
 * corre, así que el correo dice lo que pasa hoy y no lo que pasaba el día que
 * alguien redactó la plantilla.
 *
 * SIN PHI — regla 7 de CLAUDE.md. Ni un nombre de residente, ni una habitación,
 * ni un diagnóstico. Solo cuántas, de qué gravedad y en qué franja horaria. El
 * script ABORTA si detecta el nombre de un residente en el cuerpo.
 *
 * LA CAÍDA DUPLICADA SE CUENTA UNA VEZ. El 30-ago-2026 quedaron dos registros
 * del mismo suceso —mismo residente, mismo minuto, misma gravedad—, que es el
 * anti-patrón 1 de CLAUDE.md. Decir "8 caídas" sería contar una que no pasó.
 *
 *   npx tsx scripts/avisar-caidas.ts               simula y escribe el HTML en /tmp
 *   npx tsx scripts/avisar-caidas.ts --confirmar   manda de verdad
 *   npx tsx scripts/avisar-caidas.ts --solo-app    notificación en la app, sin correo
 */
import { PrismaClient } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--confirmar');
const SOLO_APP = process.argv.includes('--solo-app');
const CURSO = 'Protocolo de Respuesta a Caidas';
const DIAS = 90;

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/** Hora local de Puerto Rico. AST todo el año: no hay horario de verano. */
const horaPR = (d: Date) => (d.getUTCHours() - 4 + 24) % 24;

interface Cifras {
    total: number;
    graves: number;
    residentes: number;
    repetidores: number;
    ultimos30: number;
    graves30: number;
    deMadrugada: number;
    sinCerrar: number;
    duplicadasDescartadas: number;
}

async function contar(hqId: string): Promise<Cifras> {
    const desde = new Date(Date.now() - DIAS * 86400000);
    const todas = await prisma.fallIncident.findMany({
        where: { patient: { headquartersId: hqId }, incidentDate: { gte: desde } },
        select: { patientId: true, incidentDate: true, severity: true, resolvedAt: true },
        orderBy: { incidentDate: 'asc' },
    });

    /**
     * Deduplicado por (residente, minuto).
     *
     * Dos filas del mismo residente en el mismo minuto son el mismo suceso
     * escrito dos veces, no dos caídas. Ver `src/lib/residente-duplicado.ts` y
     * el anti-patrón 1: el POST de incidentes no tenía guarda contra el doble
     * toque cuando se registraron estas.
     */
    const vistas = new Set<string>();
    const c = todas.filter(x => {
        const k = `${x.patientId}::${x.incidentDate.toISOString().slice(0, 16)}`;
        if (vistas.has(k)) return false;
        vistas.add(k);
        return true;
    });

    const grave = (s: string) => s === 'SEVERE' || s === 'FATAL';
    const hace30 = new Date(Date.now() - 30 * 86400000);
    const ult30 = c.filter(x => x.incidentDate >= hace30);
    const porResidente = new Map<string, number>();
    for (const x of c) porResidente.set(x.patientId, (porResidente.get(x.patientId) ?? 0) + 1);

    return {
        total: c.length,
        graves: c.filter(x => grave(x.severity)).length,
        residentes: porResidente.size,
        repetidores: [...porResidente.values()].filter(n => n > 1).length,
        ultimos30: ult30.length,
        graves30: ult30.filter(x => grave(x.severity)).length,
        deMadrugada: c.filter(x => { const h = horaPR(x.incidentDate); return h >= 22 || h < 6; }).length,
        sinCerrar: c.filter(x => !x.resolvedAt).length,
        duplicadasDescartadas: todas.length - c.length,
    };
}

function frase(n: Cifras): string {
    const partes = [
        `En los últimos ${DIAS} días se han registrado <strong>${n.total} caídas</strong> en ${n.residentes} residentes`,
        n.repetidores > 0 ? `, y ${n.repetidores === 1 ? 'uno de ellos se ha caído' : `${n.repetidores} de ellos se han caído`} más de una vez` : '',
        '. ',
        n.graves > 0 ? `<strong>${n.graves}</strong> ${n.graves === 1 ? 'fue grave' : 'fueron graves'} —con sangrado o con dolor fuerte—` : '',
        n.ultimos30 > 0 ? `${n.graves > 0 ? ', y ' : ''}<strong>${n.ultimos30}</strong> ${n.ultimos30 === 1 ? 'ocurrió' : 'ocurrieron'} en el último mes` : '',
        '.',
    ];
    return partes.join('');
}

function correo(nombre: string, n: Cifras, minutos: number) {
    const texto =
        `Hola ${nombre},\n\n` +
        `Te asignamos el curso "Protocolo de Respuesta a Caídas" en tu Academia.\n\n` +
        `Por qué ahora: en los últimos ${DIAS} días se han registrado ${n.total} caídas en ${n.residentes} residentes` +
        `${n.repetidores > 0 ? `, y ${n.repetidores} de ellos se han caído más de una vez` : ''}. ` +
        `${n.graves} fueron graves${n.ultimos30 > 0 ? `, y ${n.ultimos30} ocurrieron en el último mes` : ''}.\n\n` +
        `El curso son ${minutos} minutos y lo puedes hacer desde tu teléfono: entra a app.zendity.com con tu correo y tu PIN, y busca Academia.\n\n` +
        `Lo que enseña no es teoría: es exactamente qué pulsar en tu tableta cuando pasa, qué pregunta el sistema y por qué esas respuestas deciden lo que queda escrito en el expediente.\n\n` +
        `Gracias por lo que hacen cada turno.\n\n— Vivid Senior Living`;

    return {
        subject: `Curso asignado: qué hacer cuando un residente se cae`,
        text: texto,
        html: `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <div style="background:#0F6E56;padding:24px 32px;">
      <div style="color:#fff;font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;opacity:.85;">Academia Zéndity</div>
      <div style="color:#fff;font-size:20px;font-weight:900;margin-top:4px;line-height:1.3;">Qué hacer cuando un residente se cae</div>
    </div>

    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#0F172A;">Hola <strong>${nombre}</strong>,</p>

      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
        Tienes asignado en tu Academia el curso
        <strong>Protocolo de Respuesta a Caídas</strong>. Te contamos por qué ahora.
      </p>

      <!-- Los números, sin un solo nombre. Regla 7. -->
      <div style="background:#FFF7ED;border-left:4px solid #C2410C;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#7C2D12;">${frase(n)}</p>
      </div>

      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155;">
        No es un regaño: <strong>las caídas pasan en todos los hogares</strong>, y las que
        están registradas lo están porque ustedes las reportaron. Lo que cambia el
        resultado es lo que ocurre en los cinco minutos siguientes, y eso sí se aprende.
      </p>

      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#334155;">
        El curso no es teoría. Enseña, con fotos de tu propia tableta:
      </p>
      <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.7;color:#334155;">
        <li>dónde está el botón <strong>Alerta Caída</strong> y qué abre;</li>
        <li>por qué el deslizador del dolor decide cómo queda la caída en el expediente;</li>
        <li>qué marcar cuando <strong>no la viste</strong> y te la contaron;</li>
        <li>a quién avisa el sistema solo — y a quién <strong>hay que llamar a mano</strong>.</li>
      </ul>

      <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#334155;">
        Son <strong>${minutos} minutos</strong> y <strong>lo puedes hacer desde tu teléfono</strong>.
        Entra con tu correo y tu PIN, y busca <strong>Academia</strong>.
      </p>

      <div style="text-align:center;margin:8px 0;">
        <a href="https://app.zendity.com/academy" style="background:#0F6E56;color:#fff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          Tomar el curso
        </a>
      </div>
    </div>

    <div style="background:#F8FAFC;padding:14px 32px;border-top:1px solid #E2E8F0;text-align:center;">
      <p style="margin:0;color:#94A3B8;font-size:11px;">Vivid Senior Living · Zéndity</p>
    </div>
  </div>
</body></html>`,
    };
}

/**
 * NINGÚN NOMBRE DE RESIDENTE EN EL CUERPO.
 *
 * Se comprueba contra la lista real de residentes de la sede, no contra una
 * heurística: es la misma comprobación que hace el previsualizador del reporte
 * semanal. Si aparece uno, se aborta sin mandar nada.
 */
async function sinPHI(hqId: string, cuerpo: string): Promise<string[]> {
    const residentes = await prisma.patient.findMany({
        where: { headquartersId: hqId },
        select: { name: true },
    });
    const plano = cuerpo.toLowerCase();
    return residentes
        .map(r => (r.name ?? '').trim())
        .filter(n => n.length > 3)
        .flatMap(n => n.split(/\s+/).filter(p => p.length > 3))
        .filter(parte => plano.includes(parte.toLowerCase()));
}

async function main() {
    console.log(APLICAR ? '📣 Enviando de verdad\n' : '🔍 SIMULACIÓN — no se manda nada\n');

    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    let avisados = 0, correos = 0;

    for (const hq of sedes) {
        const curso = await prisma.course.findFirst({
            where: { headquartersId: hq.id, title: { contains: CURSO }, isActive: true },
            select: { id: true, durationMins: true, title: true },
        });
        if (!curso) { console.log(`── ${hq.name}: sin el curso activo`); continue; }

        const n = await contar(hq.id);
        if (n.total === 0) {
            console.log(`── ${hq.name}: cero caídas en ${DIAS} días — no se manda nada.`);
            console.log('   Un aviso que dice "han pasado 0 caídas" no explica por qué hay que hacer el curso.');
            continue;
        }

        // Solo a quien lo tiene asignado y NO lo ha aprobado.
        const asignados = await prisma.academyAssignment.findMany({
            where: { headquartersId: hq.id, moduleCode: curso.id },
            select: { userId: true },
        });
        const aprobados = new Set(
            (await prisma.userCourse.findMany({
                where: { courseId: curso.id, status: 'COMPLETED' },
                select: { employeeId: true },
            })).map(x => x.employeeId)
        );
        const gente = (await prisma.user.findMany({
            where: { id: { in: asignados.map(a => a.userId) }, isActive: true, isDeleted: false },
            select: { id: true, name: true, email: true, role: true },
        })).filter(u => !aprobados.has(u.id));

        console.log(`── ${hq.name}`);
        console.log(`   ${n.total} caídas en ${DIAS} días · ${n.graves} graves · ${n.residentes} residentes · ${n.repetidores} repetidores`);
        console.log(`   ${n.ultimos30} en los últimos 30 días (${n.graves30} graves) · ${n.deMadrugada} de madrugada · ${n.sinCerrar} sin cerrar`);
        if (n.duplicadasDescartadas > 0) {
            console.log(`   ${n.duplicadasDescartadas} registro(s) duplicado(s) descartado(s) del conteo`);
        }
        console.log(`   ${gente.length} personas sin completar el curso`);

        const muestra = correo(gente[0]?.name?.split(' ')[0] ?? 'Compañera', n, curso.durationMins);
        const encontrados = await sinPHI(hq.id, muestra.html + muestra.text + muestra.subject);
        if (encontrados.length > 0) {
            console.log(`\n   ⛔ ABORTADO: el cuerpo menciona a un residente (${[...new Set(encontrados)].join(', ')}).`);
            process.exit(1);
        }
        console.log('   PHI: limpio — ningún nombre de residente en el cuerpo');

        if (!APLICAR) {
            const f = `/tmp/aviso-caidas-${hq.name.toLowerCase().replace(/[^a-z]+/g, '-')}.html`;
            writeFileSync(f, muestra.html);
            console.log(`   Cuerpo: ${f}`);
            console.log(`   Asunto: ${muestra.subject}`);
            for (const u of gente) console.log(`     → ${u.name} <${u.email ?? 'sin correo'}> · ${u.role}`);
            avisados += gente.length;
            continue;
        }

        for (const u of gente) {
            const nombre = u.name?.trim().split(' ')[0] || 'Compañera';
            await prisma.notification.create({
                data: {
                    userId: u.id,
                    type: 'COURSE_COMPLETED',
                    title: 'Curso asignado: caídas',
                    message: `${n.total} caídas en ${DIAS} días, ${n.graves} graves. El curso son ${curso.durationMins} min desde tu teléfono.`,
                    link: '/academy',
                },
            });
            avisados++;

            if (!SOLO_APP && u.email && process.env.SENDGRID_API_KEY) {
                try {
                    const c = correo(nombre, n, curso.durationMins);
                    await sgMail.send({
                        to: u.email,
                        from: {
                            email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                            name: 'Vivid Senior Living',
                        },
                        subject: c.subject, text: c.text, html: c.html,
                    });
                    correos++;
                    console.log(`   ✅ ${nombre} <${u.email}>`);
                } catch (e: any) {
                    console.log(`   ⚠️  ${nombre}: correo falló — ${e?.message?.slice(0, 60)}`);
                }
            } else {
                console.log(`   ✅ ${nombre} (solo app)`);
            }
        }
    }

    console.log(`\n${APLICAR ? 'Avisados' : 'Se avisaría a'}: ${avisados}${APLICAR ? ` · correos enviados: ${correos}` : ''}`);
    if (!APLICAR) console.log('Para mandarlo: npx tsx scripts/avisar-caidas.ts --confirmar');
    await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });

import { prisma } from '@/lib/prisma';
import { evaluarVitales, nivelDe } from '@/lib/vitals-thresholds';

/**
 * Señales clínicas — el cruce que nadie estaba haciendo.
 *
 * Zendity guarda cada eslabón por separado —vitales, eMAR, ingesta, rotación,
 * úlceras— y nadie los miraba juntos. La enfermera del hogar lo preguntó
 * directo: "¿me da sugerencias de verificación por residente?". La respuesta
 * era no.
 *
 * POR QUÉ ESTO NO USA IA. El asistente Zendi ya arma este mismo contexto por
 * residente, pero para redactarle mensajes cálidos a la familia. Habría sido
 * fácil pedirle en cambio que dijera "posible infección urinaria". No se hizo,
 * y la razón importa:
 *
 *   1. El hogar no diagnostica. Ese es el marco de todo el producto y de toda
 *      la formación. Un sistema que escupe diagnósticos le enseña al personal
 *      exactamente lo contrario de lo que dicen los cursos.
 *   2. Una señal determinista se puede explicar. "4 de los últimos 7 días
 *      comió 50% o menos" es verificable; "posible deshidratación" hay que
 *      creérselo.
 *   3. Un falso positivo de un modelo, en un expediente clínico, es un
 *      problema legal además de operativo.
 *
 * Esto no dice qué tiene el residente. Dice **qué conviene mirar**, con la
 * evidencia al lado, y deja el juicio clínico donde pertenece.
 */

export type Gravedad = 'REVISAR' | 'VIGILAR';

export interface SenalClinica {
    codigo: string;
    gravedad: Gravedad;
    titulo: string;
    /** Los datos concretos que la produjeron. Sin esto no se puede verificar. */
    evidencia: string[];
}

export interface ResidenteConSenales {
    patientId: string;
    nombre: string;
    senales: SenalClinica[];
}

/** Ventana de análisis. Siete días captura un patrón sin diluirlo. */
const DIAS = 7;

export async function detectarSenales(hqId: string, dias = DIAS): Promise<ResidenteConSenales[]> {
    const desde = new Date(Date.now() - dias * 24 * 3600 * 1000);

    const pacientes = await prisma.patient.findMany({
        where: { headquartersId: hqId, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
        select: {
            id: true,
            name: true,
            dailyLogs: {
                where: { createdAt: { gte: desde } },
                select: { foodIntake: true, createdAt: true, isClinicalAlert: true, isResolved: true },
                orderBy: { createdAt: 'asc' },
            },
            vitalSigns: {
                where: { createdAt: { gte: desde } },
                select: { systolic: true, diastolic: true, heartRate: true, temperature: true, spo2: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
            },
            pressureUlcers: { where: { status: { in: ['ACTIVE', 'HEALING'] } }, select: { id: true } },
        },
    });

    const salida: ResidenteConSenales[] = [];

    for (const p of pacientes) {
        const senales: SenalClinica[] = [];

        // ── Ingesta ────────────────────────────────────────────────────
        const bajas = p.dailyLogs.filter(l => l.foodIntake <= 50);
        if (bajas.length >= 3) {
            senales.push({
                codigo: 'INGESTA_BAJA',
                gravedad: bajas.length >= 5 ? 'REVISAR' : 'VIGILAR',
                titulo: 'Está comiendo poco de forma sostenida',
                evidencia: [`${bajas.length} de ${p.dailyLogs.length} registros con ingesta de 50% o menos en ${dias} días`],
            });
        }

        // Caída reciente: compara la mitad nueva contra la vieja de la ventana.
        if (p.dailyLogs.length >= 4) {
            const mitad = Math.floor(p.dailyLogs.length / 2);
            const prom = (xs: typeof p.dailyLogs) => xs.reduce((a, b) => a + b.foodIntake, 0) / xs.length;
            const antes = prom(p.dailyLogs.slice(0, mitad));
            const ahora = prom(p.dailyLogs.slice(mitad));
            if (antes - ahora >= 25) {
                senales.push({
                    codigo: 'INGESTA_EN_CAIDA',
                    gravedad: 'REVISAR',
                    titulo: 'La ingesta bajó respecto a días anteriores',
                    evidencia: [`Promedio pasó de ${Math.round(antes)}% a ${Math.round(ahora)}%`],
                });
            }
        }

        // ── Vitales ────────────────────────────────────────────────────
        // Calibrado contra Cupey: la mediana de residentes ya tiene 8% de sus
        // lecturas fuera de umbral, con 13 lecturas por semana. Marcar a partir
        // de 2 señalaba a 12 de 32 residentes — eso es variación normal, no
        // patrón. Se exige nivel LLAMAR repetido, que aparece en 3 de 32.
        const fuera = p.vitalSigns
            .map(v => ({ v, nivel: nivelDe(evaluarVitales(v)) }))
            .filter(x => x.nivel !== null);
        const llamar = fuera.filter(x => x.nivel === 'LLAMAR').length;
        const proporcion = p.vitalSigns.length > 0 ? fuera.length / p.vitalSigns.length : 0;

        if (llamar >= 3) {
            senales.push({
                codigo: 'VITALES_FUERA',
                gravedad: 'REVISAR',
                titulo: 'Vitales cruzando el umbral de llamar, repetidamente',
                evidencia: [`${llamar} lecturas de nivel llamar en ${dias} días, de ${p.vitalSigns.length} tomadas`],
            });
        } else if (proporcion >= 0.4 && p.vitalSigns.length >= 5) {
            // Muchas lecturas rozando el límite dicen algo aunque ninguna llame.
            senales.push({
                codigo: 'VITALES_INESTABLES',
                gravedad: 'VIGILAR',
                titulo: 'Buena parte de sus lecturas está fuera de rango',
                evidencia: [`${fuera.length} de ${p.vitalSigns.length} lecturas fuera de umbral`],
            });
        }

        // Sin vitales recientes: la ausencia de dato también es información.
        if (p.vitalSigns.length === 0) {
            senales.push({
                codigo: 'SIN_VITALES',
                gravedad: 'VIGILAR',
                titulo: 'Sin vitales registrados en la ventana',
                evidencia: [`Ninguna lectura en ${dias} días`],
            });
        }

        // ── Medicación ─────────────────────────────────────────────────
        const [rechazos, perdidas] = await Promise.all([
            prisma.medicationAdministration.count({
                where: { patientMedication: { patientId: p.id }, status: 'REFUSED', createdAt: { gte: desde } },
            }),
            prisma.medicationAdministration.count({
                where: { patientMedication: { patientId: p.id }, status: 'MISSED', createdAt: { gte: desde } },
            }),
        ]);
        if (rechazos >= 3) {
            senales.push({
                codigo: 'RECHAZO_MEDICACION',
                gravedad: 'REVISAR',
                titulo: 'Rechaza su medicación de forma repetida',
                evidencia: [`${rechazos} rechazos en ${dias} días`],
            });
        }
        if (perdidas >= 3) {
            senales.push({
                codigo: 'MEDICACION_NO_ADMINISTRADA',
                gravedad: 'REVISAR',
                titulo: 'Dosis que pasaron sin administrarse',
                evidencia: [`${perdidas} dosis no administradas en ${dias} días`],
            });
        }

        // ── Alerta clínica abierta ─────────────────────────────────────
        // isResolved NO se usa como señal a propósito. En Cupey hay 286 alertas
        // clínicas abiertas y CERO resueltas: nadie ha cerrado una nunca. Ese
        // campo mide acumulación, no urgencia, y usarlo marcaría a medio hogar.
        //
        // Lo que sí dice algo es la CONCENTRACIÓN: varias alertas del mismo
        // residente en una sola semana es un cambio de ritmo, no un pendiente
        // viejo — la ventana ya filtra por fecha.
        const abiertas = p.dailyLogs.filter(l => l.isClinicalAlert && !l.isResolved).length;
        if (abiertas >= 3) {
            senales.push({
                codigo: 'ALERTAS_CONCENTRADAS',
                gravedad: 'REVISAR',
                titulo: 'Varias alertas de turno en pocos días',
                evidencia: [`${abiertas} alertas levantadas en ${dias} días`],
            });
        }

        // ── Piel ───────────────────────────────────────────────────────
        if (p.pressureUlcers.length > 0 && bajas.length >= 3) {
            senales.push({
                codigo: 'PIEL_Y_NUTRICION',
                gravedad: 'REVISAR',
                titulo: 'Lesión activa y comiendo poco',
                evidencia: ['Una herida no cierra sin proteína ni líquido'],
            });
        }

        if (senales.length > 0) {
            salida.push({ patientId: p.id, nombre: p.name, senales });
        }
    }

    // Primero quien tiene más señales de revisar.
    const peso = (r: ResidenteConSenales) =>
        r.senales.filter(s => s.gravedad === 'REVISAR').length * 10 + r.senales.length;
    return salida.sort((a, b) => peso(b) - peso(a));
}

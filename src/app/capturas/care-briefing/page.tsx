'use client';
/**
 * TEMPORAL en producción (404) — captura del BRIEFING DE INICIO DE TURNO.
 *
 * La pantalla real es el overlay de `briefingMode` dentro de src/app/care/page.tsx
 * (~2767-2887), alimentado por POST /api/care/briefing. Lo que el curso promete
 * es UN bloque de esa pantalla: el teal "Relevo de tu turno anterior" — la hora
 * de cierre, quién lo entregó, el texto, y el botón al reporte completo.
 *
 * ── POR QUÉ ESTE ANDAMIO NECESITA UN CLIC Y LOS OTROS NO ──────────────────
 *
 * El overlay NO se pinta al cargar. Vive detrás de `briefingMode`, y a ese
 * estado solo se llega por `continueToBriefing()`, que se invoca desde
 * `startTurnAndBriefing()` — o sea, TOCANDO UN COLOR. No hay forma de montarlo
 * sin ese toque sin tocar el código de producción, y tocar el código de
 * producción para una foto es fabricar una pantalla que no existe.
 *
 * Así que el andamio deja el flujo real en el escalón justo anterior, y la
 * TOMA da el toque:
 *
 *   1. GET /api/care/shift/start → hay turno abierto  (activeSession)
 *   2. GET /api/hr/schedule/my-color → `shift_not_current`, sin color
 *      → la pantalla LIMPIA el color a propósito y cae al selector
 *        ("Continúa tu Turno Activo"). Es el caso real de la cuidadora que
 *        entra antes de que su pauta aplique, o que llega a cubrir.
 *   3. La toma pulsa AZUL → `startTurnAndBriefing('BLUE')`. Con turno ya
 *      abierto NO pasa por el censo: persiste la cobertura y llama
 *      `continueToBriefing('BLUE')` → briefingMode.
 *   4. POST /api/care/briefing → el payload de aquí abajo.
 *
 * ── Y EL SEGUNDO ESCALÓN: `showQuickRead` ────────────────────────────────
 *
 * El bloque teal está DENTRO de `showQuickRead`. En producción se llega ahí de
 * dos maneras, y las dos dejan el MISMO estado (`isSpeaking:false`,
 * `showQuickRead:true`, mismo render): o termina el audio de Zendi
 * (`audio.onended`), o falla (`onerror` / el catch de `play()`).
 *
 * Aquí no hay servidor de voz: `/api/zendi/speak` devuelve JSON, el navegador
 * no puede decodificarlo como audio y `synthesizeZendiBriefing` cae por su
 * propio catch a `setShowQuickRead(true)`. Por eso la TOMA **no** pulsa
 * "Omitir Audio": para cuando Playwright llegara, el botón ya no está y el
 * clic fallaría. Se espera al texto del bloque, que es la señal honesta de que
 * la pantalla está en el estado que se quiere fotografiar.
 *
 * NADA DE ESTO TOCA LA BASE. Todo lo de abajo está escrito a mano, y los cinco
 * residentes son inventados: el material de formación no lleva PHI (regla 7).
 */
import { Andamio, instalar, comoSi } from '../andamio';
import PantallaCare from '@/app/care/page';

/**
 * FECHA FIJA. La hora del relevo se imprime con `toLocaleTimeString`, así que
 * con `new Date()` la foto diría otra cosa cada vez que se repitiera.
 * Se construye en hora LOCAL y se serializa: así vuelve a leerse igual.
 */
const HOY = (hora: string) => {
    const d = new Date('2026-09-20T12:00:00');
    const [h, m] = hora.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toISOString();
};

/**
 * EL RELEVO QUE DEJA EL TURNO DE NOCHE.
 *
 * 85 palabras, que es lo que mide uno de verdad. La pantalla NO las enseña
 * todas: hace `.slice(0, 300)` y pone "…", y debajo el botón "Ver reporte
 * completo". El texto está medido para que ese corte caiga justo después de un
 * punto y no parta una palabra — el corte se ve, pero se lee entero.
 *
 * Lo que cuenta cuadra con el resto de la escena: la fiebre de Rosa Medina es
 * la `vitalsAlerts: 1` del contador y la primera viñeta del prólogo; el rechazo
 * de Elena Figueroa es `foodAlerts: 1`. Un relevo que contradijera sus propios
 * contadores enseñaría a leerlos mal.
 */
const RELEVO_DE_LA_NOCHE = `Turno de noche en el grupo azul, sin caídas. Rosa Medina (204) marcó 100.8 °F a las 4:10; se le dio agua y quedó pendiente repetir la toma antes del desayuno. Carmen Delgado (210) se despertó dos veces pidiendo agua y volvió a acostarse sola. Elena Figueroa (208) rechazó la merienda de la madrugada. Luis Ortega no quiso levantarse al baño a las 5:00: revisar el pañal al entrar. Pedro Santana (103) sigue en el hospital y no hubo llamada de la familia esta noche.`;

/**
 * EL PRÓLOGO DE LAS 6:00, que lo escribe otro sitio: el cron
 * /api/cron/clinical-day-start, con GPT y en markdown con viñetas y negritas.
 * Va así a propósito — la pantalla hace `.replace(/[#*]/g, '')`, de modo que
 * los asteriscos desaparecen y los guiones quedan. Escribirlo ya limpio daría
 * una foto de algo con una forma que el cron nunca produce.
 *
 * ── ESTE BLOQUE TAMBIÉN SE CORTA, Y A 400, NO A 300 ──────────────────────
 *
 * La pantalla hace `.replace(/[#*]/g,'').trim().slice(0, 400)`. El primer
 * borrador medía 614 limpios y el corte caía en "…fuera del censo de comida" —
 * partiendo la palabra "comidas" por la mitad. Y se llevaba por delante la
 * última viñeta, que era justo la cita: la foto enseñaba el contador "1 · Citas
 * Hoy" y un prólogo donde la cita NO se veía. Enseñar a leer un contador contra
 * un texto que no lo respalda es peor que no enseñar nada.
 *
 * Reescrito y medido: 491 limpios, la cita SUBE por encima de las 400 y el
 * corte cae exactamente tras el punto de "…fuera del censo de comidas." — la
 * elipsis queda pegada al punto, no flotando sola ni a media palabra. Lo que se
 * pierde es la línea de prioridad del final, que es lo que se quiere: el corte
 * tiene que VERSE, porque el prólogo de verdad también se corta.
 *
 * SI SE TOCA UNA COMA DE AQUÍ, HAY QUE VOLVER A MEDIR DÓNDE CAE EL 400.
 */
const PROLOGO_DEL_DIA = `**Prólogo del Día Clínico — 20 de septiembre del 2026**

- **Rosa Medina (204):** temperatura de 100.8 °F a las 4:10 AM. Repetir la toma antes del desayuno.
- **Elena Figueroa (208):** rechazó la merienda de la madrugada. Ofrecer alternativa y anotar qué acepta.
- **Agendado hoy:** videollamada de familia a las 11:00 con **Carmen Delgado (210)**.
- **Pedro Santana (103):** sigue hospitalizado; fuera del censo de comidas.

Prioridad del turno de mañana: cerrar las tomas de vitales pendientes antes de las 10:00.`;

instalar(
    {
        // ── 1. Hay turno abierto ──────────────────────────────────────────
        // PLANA: la pantalla lee `data.activeSession`, no `data.data`. Sin
        // esto no hay forma de saltarse el censo, y el censo pediría una lista
        // de residentes que esta foto no necesita.
        '/api/care/shift/start': {
            success: true,
            activeSession: {
                id: 'ss-demo-briefing',
                caregiverId: 'demo-user',
                headquartersId: 'demo-hq',
                shiftType: 'MORNING',
                startTime: HOY('06:00'),
                actualEndTime: null,
                initialCensus: 5,
                colorGroup: null,
            },
        },

        // ── 2. ¿Qué grupo cubro? NINGUNO TODAVÍA ──────────────────────────
        // `shift_not_current` es el caso documentado en el propio código
        // (src/app/care/page.tsx ~895): la cuidadora tiene pauta hoy, pero de
        // otro turno, así que su color no aplica ahora y la pantalla la manda
        // a elegir. Es el único estado real desde el que un toque lleva
        // DIRECTO al briefing, sin pasar por el censo.
        //
        // No vale devolver un color: la pantalla se iría derecha a la lista de
        // residentes y el overlay no se pintaría nunca.
        '/api/hr/schedule/my-color': {
            success: true,
            color: null,
            colors: [] as string[],
            source: 'shift_not_current',
            shiftNotes: null,
        },

        // ── 3. Cobertura: todo cubierto ───────────────────────────────────
        // `absentColors` VACÍO no es decoración. Con un grupo sin cubrir, el
        // selector abre solo el modal de "toma este grupo" y tapa el botón
        // que la toma tiene que pulsar.
        '/api/care/shift/coverage': {
            success: true,
            coveredColors: ['RED', 'YELLOW', 'GREEN', 'BLUE'],
            absentColors: [] as string[],
            alreadyRedistributed: [] as string[],
            activeCaregivers: [
                { userId: 'c1', name: 'Marisol Vega', color: 'RED' },
                { userId: 'c2', name: 'Damaris Soto', color: 'GREEN' },
                { userId: 'c3', name: 'Ivelisse Ramos', color: 'YELLOW' },
            ],
            activeOverrides: [] as unknown[],
            colorFloorMap: null,
        },

        // Se llama al pulsar el color con turno ya abierto. La pantalla lo
        // espera (`await`) antes de seguir al briefing: sin fixture responde
        // igual por el vacío genérico, pero dejarlo escrito documenta que el
        // toque pasa por aquí.
        '/api/care/shift/claim-coverage': { success: true, claimed: 5 },

        // ── 4. EL BRIEFING ────────────────────────────────────────────────
        // Forma exacta de src/app/api/care/briefing/route.ts:173-194.
        '/api/care/briefing': {
            success: true,
            briefing: {
                // Solo se ve durante el audio; en la lectura rápida la pantalla
                // lo esconde. Va escrito de todos modos porque es lo que Zendi
                // dice en voz alta, y tiene que contar LOS MISMOS TRES avisos
                // que los contadores de abajo.
                //
                // Armado con las frases LITERALES de route.ts:113-169 y en su
                // orden (saludo → fiebre → comida → cita → cierre). Antes estaba
                // parafraseado: decía "Bienvenida" —el código escribe
                // "Bienvenido" fijo para todo el mundo, hombre o mujer— y se
                // saltaba dos frases enteras. No sale en la foto, pero un
                // fixture que inventa lo que dice el servidor deja de servir
                // para comprobar nada.
                ttsMessage: 'Buen día, Caridad. Bienvenido al Grupo BLUE. He revisado los expedientes de este turno y estoy lista para asistirte en los cuidados de hoy. Por favor, mantén en observación a Rosa Medina, presentó una temperatura elevada de 100.8 grados recientemente. Sugiero aumentar su ingesta hídrica. Noté que Elena Figueroa tuvo una ingesta reducida en su última comida. Recomiendo ofrecer una alternativa o suplemento para asegurar su perfil nutricional. También te recuerdo que hay una videollamada de familia programada para Carmen Delgado el día de hoy y debemos estar preparados. He enviado estas alertas a tu pantalla principal para fácil referencia. Cuando gustes, empezamos a atender estos frentes.',

                // Los tres contadores de la lectura rápida. NO van en cero: un
                // briefing de ceros enseña una pantalla que no dice nada, y es
                // justo la que no hay que aprender a leer.
                quickRead: { vitalsAlerts: 1, foodAlerts: 1, appointments: 1 },

                // EL BLOQUE TEAL — lo que el curso promete.
                //
                // En producción esto solo aparece si hay un ShiftHandover
                // FIRMADO, de hoy, cuyo `colorGroups` solapa el color de quien
                // entra (route.ts:90-109). Por eso este relevo es del grupo
                // azul, firmado, y cerrado a las 5:52 de esta misma mañana:
                // quitarle cualquiera de las tres cosas y el bloque no sale.
                colorHandover: {
                    id: 'ho-demo-noche',
                    report: RELEVO_DE_LA_NOCHE,
                    fromCaregiver: 'Yarelis Cruz',
                    closedAt: HOY('05:52'),
                    shiftType: 'NIGHT',
                },

                // El prólogo del cron de las 6:00. Va puesto porque a media
                // mañana SIEMPRE está —el cron lo escribe una vez y la consulta
                // lo encuentra el resto del día—, así que una foto sin él
                // enseñaría una pantalla más corta que la real.
                dailyPrologue: {
                    id: 'pro-demo-hoy',
                    report: PROLOGO_DEL_DIA,
                    generatedAt: HOY('06:00'),
                },
            },
        },

        // ── 5. La voz ─────────────────────────────────────────────────────
        // Aquí en producción vuelve un MP3. Devolver JSON no es un descuido:
        // es lo que hace que el navegador falle al decodificarlo y la pantalla
        // pase sola a la lectura rápida, que es el estado que se fotografía.
        // Sin este fixture pasaría lo mismo por el vacío genérico; escrito,
        // queda dicho que es deliberado.
        '/api/zendi/speak': { success: false, error: 'sin voz en el andamio' },
    },
    // La tableta del briefing la abre quien entra a cuidar, no quien supervisa.
    // En este estado la pantalla no imprime el nombre de quien la mira por
    // ningún lado —solo el de quien ENTREGÓ el relevo—, pero la sesión tiene
    // que ser coherente con la pantalla que se está enseñando.
    //
    // OJO CON EL NOMBRE. Aquí decía 'Marisol Vega', y Marisol es el nombre
    // de pila de una cuidadora REAL del hogar (prisma/seed-vivid-production.ts,
    // scripts/seed-vivid-team.ts). El apellido cambiado no disimula nada: en un
    // curso que ve todo el personal, ese nombre de pila solo se puede leer como
    // una persona concreta. Se usa 'Caridad Veras', que ya es la cuidadora
    // inventada de otro andamio (capturas/mi-desempeno-nueva) y no coincide con
    // nadie de la plantilla.
    comoSi({ id: 'demo-user', name: 'Caridad Veras', role: 'CAREGIVER' }),
);

export default function Captura() {
    // El overlay es `fixed inset-0`: ocupa la ventana entera y no hace caso al
    // ancho del marco. El encuadre lo decide `ancho`/`alto` de la TOMA.
    return <Andamio ancho={1400}><PantallaCare /></Andamio>;
}

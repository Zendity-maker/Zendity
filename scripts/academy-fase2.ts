/**
 * Cursos de Fase 2 — la formación del OFICIO, no del software.
 *
 * Los 16 cursos originales enseñan a usar Zendity (pantalla /care, eMAR, cierre
 * de turno). Ninguno enseñaba a cuidar. Estos cubren lo que el Departamento de
 * la Familia exige para certificar cuidadores.
 *
 * MARCO CLÍNICO (definido por el dueño, 19-ago-2026): un hogar de envejecientes
 * NO toma decisiones clínicas. El plan de cuidado lo establece la enfermera de
 * home care; el hogar hace CONTINUIDAD — ejecuta, documenta y escala. Por eso
 * ningún curso enseña a decidir: enseñan a observar, ejecutar y reportar, y a
 * reconocer dónde termina el rol.
 *
 * Idempotente: correrlo dos veces actualiza en vez de duplicar (busca por
 * título dentro de cada sede).
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/academy-fase2.ts --dry-run
 *   DATABASE_URL="..." npx tsx scripts/academy-fase2.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

interface CursoFase2 {
    title: string;
    description: string;
    durationMins: number;
    bonusCompliance: number;
    emoji: string;
    category: string;
    order: number;
    /** null = todo el personal lo necesita. */
    targetRole: string | null;
    content: string;
}

const CURSOS: CursoFase2[] = [
    {
        title: 'Cuidado Geriátrico General',
        description: 'La base del cuidado del adulto mayor: qué es envejecimiento normal, qué se reporta, cómo preservar autonomía y dónde termina el rol del hogar.',
        durationMins: 40,
        // Máximo de la escala: es la formación que acredita ante el
        // Departamento y la base sobre la que se apoya todo lo demás.
        bonusCompliance: 30,
        emoji: '🌿',
        // Categoría propia: separa la formación del oficio de la del sistema.
        category: 'Cuidado Geriátrico',
        order: 100,
        // Global: en un hogar de envejecientes esto lo debería saber todo el
        // que tenga contacto con residentes, no solo quien tiene el título.
        targetRole: null,
        content: `---META---
TITULO: Cuidado Geriátrico General
PROMPT_ZENDI: Evalúa si el empleado comprende las necesidades del adulto mayor, distingue el envejecimiento normal del deterioro que debe reportarse, y reconoce el límite de su rol: el hogar ejecuta y documenta el plan de cuidado, no lo decide.
TERMINOS_CLAVE: envejecimiento normal, deterioro, dignidad, autonomía, observar y reportar, continuidad del plan, enfermera de home care, escalamiento, dependencia, ABVD
PREGUNTA_REFLEXION: Una residente que siempre camina sola al comedor hoy se apoya en las paredes y llega tarde. No se queja de nada. ¿Qué haces?

---SECCION_1---
LECTURA:
# Envejecer no es enfermarse

Este es el punto de partida de todo el cuidado geriátrico, y el que más se confunde: **envejecer no es una enfermedad**. Un cuerpo de 85 años funciona distinto a uno de 40, y eso es normal. Lo que no es normal es un cambio brusco.

Saber distinguir una cosa de la otra es, probablemente, la habilidad más valiosa de un cuidador. Porque tú eres quien está con el residente todos los días, y por eso eres quien nota primero cuando algo cambió.

**Cambios normales del envejecimiento:**

- La piel se vuelve más fina, más seca y tarda más en sanar
- El equilibrio y los reflejos son más lentos
- Se duerme menos horas seguidas y con sueño más ligero
- Se siente menos sed, aunque el cuerpo la necesite igual
- Disminuye la audición y la visión, sobre todo de noche
- La memoria de nombres y fechas recientes se vuelve menos precisa

**Cambios que NO son normales y siempre se reportan:**

- Confusión que aparece de un día para otro
- Dejar de comer o beber sin explicación
- Una caída, aunque el residente diga que está bien
- Piel enrojecida que no recupera color al presionarla
- Cambio brusco de carácter: agresividad, apatía, llanto sin motivo
- Fiebre, vómito, dificultad para respirar

La diferencia clave está en la **velocidad**. El envejecimiento normal es lento y gradual, se mide en meses o años. Lo que aparece en horas o días es un aviso.

PREGUNTAS:
P: ¿Cuál es la señal más útil para distinguir el envejecimiento normal de algo que debe reportarse?
a) La edad del residente
b) Si el residente se queja o no
*c) La velocidad del cambio: lo brusco se reporta, lo gradual es esperable
d) Si el cambio es visible a simple vista
EXPLICACION: El envejecimiento normal es gradual — se mide en meses o años. Un cambio que aparece en horas o días es un aviso, sin importar la edad ni si el residente se queja. Muchos adultos mayores no reportan molestias, así que esperar la queja es esperar demasiado.

P: Una residente de 88 años duerme menos horas seguidas que antes y se despierta varias veces. ¿Qué haces?
a) Lo reporto de inmediato como cambio brusco
*b) Es un cambio normal del envejecimiento; lo registro en su bitácora y observo si empeora
c) Le pido que se quede en cama más tiempo
d) No hago nada, no tiene importancia
EXPLICACION: El sueño más ligero y fragmentado es un cambio normal de la edad. No es una emergencia, pero registrarlo importa: si más adelante empeora bruscamente, ese registro es lo que permite ver el patrón.

---SECCION_2---
LECTURA:
# Lo que el residente todavía puede hacer

Existe una tentación natural en el cuidado: hacer las cosas por el residente porque es más rápido. Vestirlo tú toma tres minutos; que se vista solo toma quince.

Pero cada cosa que haces por alguien que todavía puede hacerla sola, es una capacidad que esa persona pierde un poco antes. Esto tiene nombre en geriatría: **dependencia inducida por el cuidado**.

El principio es simple: **ayudar lo necesario, no más**.

**Las Actividades Básicas de la Vida Diaria (ABVD)** son las seis que se evalúan para medir la autonomía de un residente:

1. **Comer** — llevarse el alimento a la boca
2. **Bañarse** — lavarse el cuerpo
3. **Vestirse** — ponerse y quitarse la ropa
4. **Usar el baño** — llegar, usarlo y limpiarse
5. **Trasladarse** — pasar de la cama a la silla, levantarse
6. **Continencia** — controlar esfínteres

Un residente puede ser independiente en unas y dependiente en otras. Esa combinación cambia con el tiempo, y tu registro diario es lo que permite verlo.

**En la práctica, esto significa:**

- Si puede abotonarse la camisa aunque tarde, deja que lo haga
- Si puede caminar con andador, no lo lleves en silla porque es más rápido
- Si puede comer solo aunque riegue, acompaña — no le des la comida en la boca
- Si necesita ayuda, ofrécela con palabras antes que con las manos: "¿Le ayudo con el brazo?"

La dignidad no es un valor abstracto. Es esto: tratar a un adulto como adulto, aunque necesite ayuda.

PREGUNTAS:
P: Un residente tarda 20 minutos en vestirse solo. Tienes prisa porque faltan residentes por atender. ¿Qué haces?
a) Lo visto yo para ganar tiempo, es lo práctico
*b) Dejo que se vista solo y organizo mi turno contando con ese tiempo
c) Lo visto yo y anoto que él no puede vestirse
d) Le digo que se apure
EXPLICACION: Hacer por él lo que todavía puede hacer solo acelera su pérdida de autonomía — es dependencia inducida por el cuidado. El tiempo que tarda no es tiempo perdido: es capacidad que conserva. La organización del turno debe contar con eso.

P: ¿Qué son las ABVD?
a) Los medicamentos básicos que todo residente recibe
*b) Las seis actividades básicas de la vida diaria que miden la autonomía del residente
c) El protocolo de baño diario
d) Las visitas de la familia
EXPLICACION: Comer, bañarse, vestirse, usar el baño, trasladarse y continencia. Son la referencia estándar para medir cuánta ayuda necesita una persona, y cambian con el tiempo — por eso el registro diario importa.

---SECCION_3---
LECTURA:
# Tu rol en la cadena clínica: observar y reportar

Este es el punto más importante de todo el curso, y conviene decirlo sin rodeos:

**Un hogar de envejecientes no toma decisiones clínicas.**

El plan de cuidado de un residente —el tratamiento de una herida, la dieta indicada, los medicamentos, la frecuencia de rotación— lo establece **la enfermera de home care** o el médico. El hogar hace **continuidad**: ejecuta ese plan, lo documenta y avisa cuando algo cambia.

Esto no te quita importancia. Al contrario: **tú eres el sensor**. La enfermera visita una vez por semana; tú ves al residente tres veces al día. Nadie va a notar antes que tú que algo cambió.

**La diferencia entre observar y diagnosticar:**

| Lo que SÍ te toca | Lo que NO te toca |
|---|---|
| "Tiene la piel del talón enrojecida y no cede al presionar" | "Tiene una úlcera grado 1" |
| "No terminó el almuerzo tres días seguidos" | "Está deprimida" |
| "Se quejó de dolor al levantarse" | "Le duele la cadera, debe ser artritis" |
| "Está más callada que de costumbre" | "Tiene principio de demencia" |

Fíjate en el patrón: la columna izquierda describe **lo que ves**. La derecha **interpreta**, y esa interpretación le corresponde a un profesional clínico.

Esto no es burocracia. Tiene tres razones concretas:

- **Protege al residente**: un diagnóstico equivocado de tu parte puede desviar la atención del problema real
- **Te protege a ti**: escribir un diagnóstico en un expediente sin licencia para hacerlo es una exposición legal innecesaria
- **Hace útil tu reporte**: "piel enrojecida que no cede" le dice a la enfermera exactamente qué mirar; "tiene una úlcera" la obliga a empezar de cero

**Cómo se reporta bien:**

1. **Qué viste** — descripción concreta, sin interpretar
2. **Cuándo** — hora aproximada
3. **Desde cuándo** — ¿es la primera vez o lleva días?
4. **Qué hiciste** — si aplicaste alguna medida

PREGUNTAS:
P: Notas que un residente tiene la piel del talón enrojecida. ¿Cómo lo reportas?
a) "Tiene una úlcera por presión en el talón"
*b) "Piel enrojecida en el talón derecho, no recupera color al presionar. Observado hoy en el baño de la mañana"
c) Espero a ver si mejora sola antes de decir algo
d) Le aplico crema y lo anoto como resuelto
EXPLICACION: Describir lo que se ve —sin nombrar un diagnóstico— es lo que le corresponde al cuidador y lo que hace útil el reporte. Nombrarlo "úlcera" es un diagnóstico que le toca a la enfermera. Esperar o tratar por cuenta propia retrasa la atención.

P: ¿Quién decide el tratamiento de una herida en un residente?
a) El cuidador que la encontró
b) El supervisor de turno
*c) La enfermera de home care o el médico; el hogar ejecuta y documenta ese plan
d) La familia del residente
EXPLICACION: El hogar de envejecientes hace continuidad del plan clínico, no lo establece. El cuidador ejecuta la indicación, la documenta y reporta los cambios — ese es su rol en la cadena, y es un rol crítico.

---SECCION_4---
LECTURA:
# Seguridad: el entorno también cuida

Una de cada tres personas mayores de 65 años sufre una caída al año. En un hogar de envejecientes, la mayoría de esas caídas ocurren en tres momentos predecibles: al levantarse de la cama, al ir al baño de noche, y al trasladarse de la silla.

La buena noticia es que gran parte son prevenibles, y la prevención es trabajo de piso — tuyo.

**El entorno, antes que la persona:**

- Piso seco: el 30% de las caídas ocurre sobre superficie mojada
- Camino libre: sin cables, sin cajas, sin muebles fuera de sitio
- Luz de noche encendida en el trayecto al baño
- Cama en posición baja cuando el residente está solo
- Calzado cerrado y con suela — nunca medias solas ni chancletas
- Andador o bastón **al alcance de la mano**, no guardado en el clóset

**Al mover a un residente:**

Movilizar mal lesiona a dos personas: al residente y a ti. La lesión de espalda es la causa número uno de baja laboral en este trabajo.

- Avisa siempre lo que vas a hacer antes de tocarlo
- Acerca al residente al borde de la cama antes de levantarlo
- Dobla las rodillas, no la espalda
- Sostén por el tronco, nunca jales de un brazo — el hombro del adulto mayor se disloca con facilidad
- Si el traslado requiere dos personas según su plan, **espera a la segunda persona**. Siempre.

**Si un residente se cae:**

1. **No lo muevas.** Mover a alguien con posible fractura de cadera o lesión cervical puede causar daño irreversible
2. Quédate con él y pide ayuda
3. Observa: ¿está consciente? ¿responde? ¿hay sangrado? ¿alguna parte del cuerpo se ve en posición extraña?
4. Avisa de inmediato a supervisión
5. Documenta lo que viste, no lo que supones que pasó

Un residente que dice "estoy bien" después de una caída se reporta **igual**. Muchas fracturas y sangrados internos no duelen en los primeros minutos.

PREGUNTAS:
P: Encuentras a un residente en el piso. Está consciente y dice que está bien. ¿Qué haces primero?
a) Lo ayudo a levantarse ya que dice estar bien
b) Lo levanto y lo siento en la cama para revisarlo
*c) No lo muevo, me quedo con él y pido ayuda
d) Le pregunto si quiere que reporte la caída
EXPLICACION: Nunca se mueve a alguien tras una caída hasta descartar lesión. Una fractura de cadera o lesión cervical puede empeorar irreversiblemente al moverlo, y muchas lesiones no duelen en los primeros minutos. Que el residente diga estar bien no cambia el protocolo.

P: El plan de un residente indica traslado entre dos personas, pero tu compañera está ocupada y él quiere ir al baño ahora. ¿Qué haces?
*a) Espero a la segunda persona y acompaño al residente mientras tanto
b) Lo traslado sola con cuidado, es una urgencia
c) Le digo que aguante hasta el próximo turno
d) Lo traslado sola y lo reporto después
EXPLICACION: Un traslado de dos personas es de dos personas, sin excepción — hacerlo sola arriesga una caída del residente y una lesión de espalda tuya. Acompañarlo mientras llega la ayuda atiende su necesidad sin romper el plan.

---SECCION_5---
LECTURA:
# Hablar con quien está delante

El adulto mayor con dificultad para oír, para recordar o para expresarse **sigue siendo un adulto**. Es el error más común y el que más lastima: hablarle como a un niño.

**Lo que funciona:**

- Llámalo por su nombre, no "abuelito", "mi amor" ni "papito"
- Colócate de frente y a su altura — si está sentado, siéntate
- Habla despacio y claro, no más fuerte. Gritar distorsiona el sonido y no ayuda a quien no oye bien
- Una idea por frase. "Vamos a bañarnos" y después "primero el brazo", no las dos juntas
- Da tiempo para responder. Un adulto mayor puede tardar varios segundos en procesar una pregunta
- Avisa antes de tocar: "Le voy a levantar el brazo"

**Cuando hay demencia o confusión:**

- No discutas con la realidad del residente. Si cree que es 1985, preguntar "¿no se acuerda que estamos en 2026?" solo genera angustia
- Redirige en vez de corregir: "Cuénteme de esa época" funciona mejor que "eso no es cierto"
- El tono importa más que las palabras: aunque no entienda la frase, entiende si estás molesta

**Con la familia:**

La familia pregunta mucho y a veces con ansiedad. Es normal: dejaron a alguien que aman al cuidado de otros.

- Puedes contar lo que observaste: si comió, si durmió, si estuvo de ánimo
- No des información clínica ni interpretaciones: eso le corresponde a la enfermera o al director
- Si preguntan algo que no te toca, la respuesta honesta es la mejor: "Eso lo maneja la enfermera, le paso el mensaje para que se comunique con usted"

**Con el equipo:**

Lo que no se comunica en el relevo, se pierde. Un residente que no comió, que se quejó de dolor, o que estuvo raro, es información que el próximo turno necesita para hacer bien su trabajo. Tu reporte de turno no es un trámite: es la continuidad del cuidado de una persona.

PREGUNTAS:
P: Un residente con demencia insiste en que tiene que ir a trabajar. ¿Qué haces?
a) Le explico que está retirado y que ya no trabaja
b) Le sigo la corriente y le digo que lo llevo al trabajo
*c) Redirijo la conversación sin discutir: le pregunto por su trabajo y lo acompaño a otra actividad
d) Lo ignoro hasta que se le olvide
EXPLICACION: Corregir la realidad de una persona con demencia genera angustia sin ningún beneficio. Redirigir —reconocer lo que siente y llevar la conversación a otro lugar— calma sin engañar ni confrontar.

P: La hija de un residente te pregunta por qué su mamá está tomando un medicamento nuevo. ¿Qué respondes?
a) Le explico para qué sirve ese medicamento
b) Le digo que no sé nada de eso
*c) Le digo que esa información la maneja la enfermera y que le paso el mensaje para que se comunique con ella
d) Le muestro el expediente para que lo lea
EXPLICACION: La información clínica le corresponde a la enfermera o al director, no al cuidador — y mostrar el expediente además viola la confidencialidad. Canalizar la pregunta con honestidad responde a la familia sin salirte de tu rol.
`,
    },
];

async function main() {
    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    console.log(DRY ? '🔍 SIMULACIÓN — no se escribe nada\n' : '✏️  Sembrando cursos de Fase 2\n');

    for (const hq of sedes) {
        console.log(`── ${hq.name}`);
        for (const c of CURSOS) {
            const existente = await prisma.course.findFirst({
                where: { headquartersId: hq.id, title: c.title },
                select: { id: true, content: true },
            });

            const datos = {
                title: c.title,
                description: c.description,
                content: c.content,
                durationMins: c.durationMins,
                bonusCompliance: c.bonusCompliance,
                emoji: c.emoji,
                category: c.category,
                order: c.order,
                targetRole: c.targetRole,
                isGlobal: c.targetRole === null,
                isActive: true,
            };

            if (existente) {
                const cambio = existente.content !== c.content;
                console.log(`   ${cambio ? '↻ actualiza' : '= sin cambios'}  ${c.title}`);
                if (!DRY && cambio) {
                    await prisma.course.update({ where: { id: existente.id }, data: datos });
                }
            } else {
                console.log(`   + crea       ${c.title}  (${c.content.length} chars, +${c.bonusCompliance} créditos)`);
                if (!DRY) {
                    await prisma.course.create({ data: { ...datos, headquartersId: hq.id } });
                }
            }
        }
    }

    console.log(DRY ? '\nPara aplicar, corre el mismo comando sin --dry-run' : '\nListo.');
}

main()
    .catch(e => { console.error('❌', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

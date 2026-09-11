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

P: Doña Carmen lleva toda la mañana sin tomar agua y cuando le ofreces dice que no tiene sed. ¿Qué haces?
*a) Le sigo ofreciendo líquidos durante todo el turno
b) Si no tiene sed, no la obligo — el cuerpo pide lo que necesita
c) Le dejo la jarra llena en la mesa y lo doy por atendido
d) Lo reporto de inmediato como un cambio brusco
EXPLICACION: Con la edad se siente menos sed, pero la necesidad de agua no baja con ella: por eso se ofrece, no se espera a que la pidan. Dejar la jarra y seguir de largo no es lo mismo que ofrecer, porque quien no tiene sed no se sirve sola.

P: Don Luis siempre supo dónde estaba. Esta mañana te pregunta dos veces en qué casa está y no reconoce su cuarto. Ayer estaba igual que siempre. ¿Cómo lo lees?
a) Es normal: con la edad la memoria de nombres y fechas se vuelve menos precisa
b) Espero unos días a ver si se repite antes de decir algo
*c) Es un cambio brusco: confusión que aparece de un día para otro se reporta hoy
d) Es normal si durmió mal, el sueño ligero es propio de la edad
EXPLICACION: La memoria de nombres y fechas se vuelve imprecisa poco a poco, en meses o años. Confusión que aparece de un día para otro no es envejecimiento, es un aviso, y el aviso pierde valor si lo guardas unos días.

P: Un residente lleva tres días dejando casi todo el almuerzo. No se queja, no tiene fiebre y por lo demás se ve igual. ¿Qué haces?
a) Espero: con la edad baja el apetito y es de esperarse
*b) Lo reporto hoy, aunque no tenga fiebre ni se queje
c) Le doy la comida en la boca para asegurarme de que coma
d) Lo reporto solo si empieza a bajar de peso
EXPLICACION: Dejar de comer sin explicación no es un cambio de la edad: está en la lista de lo que siempre se reporta, porque el apetito no desaparece por cumplir años. Esperar a que baje de peso es esperar semanas a que aparezca la consecuencia de algo que ya estás viendo.

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

P: Don Pedro come solo sin problema, pero necesita ayuda para bañarse. Una compañera te dice: "ese es dependiente, hazle todo". ¿Qué haces?
a) Le hago todo: si necesita ayuda en una cosa, ya no es independiente
b) Le hago todo esta semana y lo evalúo más adelante
c) Lo ayudo en el baño y también le doy la comida, por si acaso se cansa
*d) Lo ayudo en el baño y lo dejo comer solo, como hasta ahora
EXPLICACION: La autonomía se mide actividad por actividad: un residente puede ser independiente en unas básicas y dependiente en otras, y esa combinación cambia con el tiempo. Tratarlo como "dependiente en todo" le quita de golpe lo que todavía hace solo, y tu registro deja de reflejar lo que de verdad puede.

P: Ves que don Ramón lleva rato batallando para meter el brazo en la manga. ¿Qué haces?
a) Le subo la manga yo sin decir nada, es cuestión de segundos
*b) Le ofrezco con palabras antes de tocarlo y espero su respuesta
c) Lo dejo batallar: si intervengo le quito autonomía
d) Le digo que si no puede, mejor se la pongo yo de ahora en adelante
EXPLICACION: "¿Le ayudo con el brazo?" — con palabras antes que con las manos. Ayudar lo necesario no es no ayudar nunca: es ofrecer y que él decida. Meterle mano sin avisar lo trata como objeto, y decidir que "de ahora en adelante" lo haces tú le quita una capacidad que todavía tiene.

P: Una residente come sola pero riega comida y ensucia la mesa. Tu compañera sugiere darle la comida en la boca para que quede todo limpio. ¿Qué haces?
a) Le doy la comida en la boca: así come más y no se ensucia
b) La dejo empezar sola y le quito el plato en cuanto riega
*c) La dejo comer sola, me quedo cerca acompañando y limpio al terminar
d) Le doy la comida en la boca solo cuando hay visita en el comedor
EXPLICACION: Comer es una de las seis actividades básicas de la vida diaria; quitársela por comodidad de limpieza le cuesta a ella una capacidad y a ti te ahorra un trapo. Acompañar es estar cerca por si hace falta, no sustituirla.

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

P: La enfermera de home care indicó cambiar de posición a doña Ana cada dos horas. Hoy la ves cómoda, dormida y con la piel sin señales. ¿Qué haces?
*a) Cumplo la rotación como está indicada y lo documento en el momento
b) La dejo dormir y retomo la rotación en el próximo turno
c) Espacío la rotación a cada cuatro horas mientras la piel se vea bien
d) Le pregunto a la familia si prefieren que la dejemos descansar
EXPLICACION: Si crees que algo no cuadra, lo reportas; no lo cambias. La frecuencia de rotación es parte del plan clínico y la establece la enfermera o el médico. Que la piel se vea bien hoy es el RESULTADO de la rotación, no una razón para bajarla — y esa decisión no le toca al cuidador ni a la familia.

P: Doña Elena lleva tres días más callada y ya no se sienta con las demás. En el registro escribes "está deprimida" y tu supervisora te pide cambiarlo. ¿Por qué?
a) Porque el registro es para tareas cumplidas, no para observaciones
b) Porque eso se dice de palabra y no se escribe en el expediente
*c) Porque "deprimida" es una conclusión tuya, no lo que viste
d) Porque hay que esperar una semana antes de anotar algo así
EXPLICACION: Lo que viste sí se escribe, y con detalle: "más callada tres días y ya no se sienta con las demás" le dice a la enfermera exactamente qué mirar. "Deprimida" la manda a una pista que quizá no es la correcta, y puede tapar un dolor, una infección o un medicamento nuevo.

P: Tu reporte dice: "A doña Ana le dolía la pierna". Tu supervisora te pide completarlo. ¿Qué le falta?
a) Falta decir qué crees tú que puede ser ese dolor
*b) Falta a qué hora fue y desde cuándo le pasa
c) Nada: ya dice lo que observaste, que es lo que te toca
d) Falta el nombre del médico que la atiende
EXPLICACION: Un reporte útil lleva cuatro cosas: qué viste, cuándo, desde cuándo, y qué hiciste. Sin el "desde cuándo" nadie puede saber si empezó hoy o lleva una semana, y eso es justo lo que decide la urgencia.

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

P: Cruzas el pasillo con las manos llenas y ves un charco de jugo en el piso. En unos minutos los residentes pasan al comedor. ¿Qué haces?
a) Aviso a limpieza y sigo con lo mío
b) Le digo a los residentes que pasen por el otro lado
*c) Suelto lo que llevo y seco el piso ahora
d) Pongo una silla al lado para que lo vean y lo reporto al final del turno
EXPLICACION: O te quedas ahí hasta que alguien lo seque. Cerca de un tercio de las caídas ocurre sobre piso mojado, y el charco sigue ahí mientras el aviso viaja. Señalizarlo ayuda, pero una silla no detiene a quien ve poco de lejos: lo que quita el riesgo es secarlo.

P: Don José se ladea al levantarse de la silla y ves que se va de lado. ¿De dónde lo sostienes?
*a) Por el tronco, con las rodillas dobladas
b) Del brazo, que es lo que tengo más cerca
c) De la mano, halando hacia arriba
d) De la camisa, por la espalda
EXPLICACION: Por el tronco, rodillas dobladas y espalda recta. El hombro del adulto mayor se disloca con facilidad, así que jalar de un brazo o de una mano puede lesionarlo justo cuando intentas protegerlo. Y doblar las rodillas te cuida a ti: la lesión de espalda es la causa número uno de baja laboral en este trabajo.

P: Estás acomodando el cuarto de doña Luz. El andador estorba junto a la cama y el cuarto se ve más despejado si lo guardas en el clóset. ¿Qué haces?
a) Lo guardo en el clóset: el camino libre también previene caídas
b) Lo dejo en el pasillo, fuera del cuarto
c) Lo guardo y se lo saco cuando ella me lo pida
*d) Lo dejo junto a la cama, al alcance de su mano
EXPLICACION: El camino se despeja de cables, cajas y muebles fuera de sitio; el andador no es un estorbo, es lo que la sostiene. Guardado, lo que pasa de verdad es que se levanta sin él, y levantarse de la cama es uno de los tres momentos en que más se cae.

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

P: Entras al cuarto de doña Carmen, de 91 años, para abrirle la cortina. ¿Cómo le hablas?
a) "Abuelita, buenos días, ya amaneció"
*b) "Doña Carmen, buenos días. Le voy a abrir la cortina"
c) "Mi amor, vamos a levantarnos que ya es tarde, que la están esperando"
d) "Mami, ¿cómo dormimos hoy?"
EXPLICACION: El nombre trata a un adulto como adulto; "abuelita", "mi amor" o "mami" le hablan como a un niño aunque salgan del cariño. Avisar lo que vas a hacer antes de hacerlo es parte de lo mismo: ese cuarto es de ella.

P: Le dices a don Pedro: "vamos a bañarnos, quítese la bata, coja la toalla y siéntese". Se queda mirándote sin moverse. ¿Qué haces?
a) Se lo repito más fuerte, seguro no me oyó
b) Se lo repito igual pero más rápido, para no perder tiempo
*c) Me pongo de frente y le digo una cosa a la vez
d) Lo empiezo a desvestir mientras le sigo hablando, así vamos avanzando y no se atrasa
EXPLICACION: De frente, a su altura, y dándole tiempo para responder. Fueron cuatro instrucciones en una sola frase, y un adulto mayor puede tardar varios segundos solo en procesar una. Subir la voz no arregla eso: gritar distorsiona el sonido y no ayuda a quien no oye bien.

P: A media tarde un residente se quejó de dolor en la espalda. Ya lo reportaste a supervisión y quedó anotado. Llega la hora del relevo y vas con prisa. ¿Lo mencionas al turno que entra?
*a) Sí: el próximo turno necesita saberlo para observar si se repite
b) No: ya lo reporté a supervisión, con eso está cubierto
c) No: si ya está escrito, quien entra lo va a leer
d) Solo si el dolor seguía cuando terminó mi turno
EXPLICACION: Lo que no se comunica en el relevo se pierde, aunque esté escrito en algún lado. El turno que entra no puede notar que algo se repite si no sabe qué pasó antes: el relevo no es un trámite, es la continuidad del cuidado de una persona.
`,
    },
    {
        title: 'Demencia y Alzheimer: Manejo Diario',
        description: 'Qué es la demencia, por qué la conducta es un mensaje, cómo validar y redirigir en vez de corregir, y qué cambio se reporta de inmediato.',
        durationMins: 35,
        bonusCompliance: 25,
        emoji: '🧠',
        category: 'Cuidado Geriátrico',
        order: 101,
        targetRole: null,
        content: `---META---
TITULO: Demencia y Alzheimer: Manejo Diario
PROMPT_ZENDI: Evalúa si el empleado comprende qué es la demencia, sabe responder a la agitación, la deambulación y la resistencia al cuidado sin confrontar, y reconoce que un cambio brusco de conducta se reporta en vez de manejarse solo.
TERMINOS_CLAVE: demencia, Alzheimer, agitación, deambulación, resistencia al cuidado, validación, redirección, síndrome vespertino, delirium, desencadenante
PREGUNTA_REFLEXION: Una residente con Alzheimer te acusa de haberle robado su cartera. La cartera está en su gaveta, donde ella la guardó. ¿Qué haces?

---SECCION_1---
LECTURA:
# La demencia no es "estar viejito"

La demencia es una enfermedad del cerebro, no una etapa normal del envejecimiento. Eso cambia cómo se responde a todo lo que sigue: la persona no está "portándose mal", "haciéndose la difícil" ni "buscando atención". Su cerebro está funcionando distinto.

El Alzheimer es la forma más común, pero no la única. Lo que verás en el día a día suele seguir este orden:

- **Primero se pierde la memoria reciente.** Puede contarte con detalle su boda de hace 50 años y no recordar que desayunó hace una hora
- **Después el juicio y la orientación.** Confunde el día, el lugar, a las personas
- **Luego el lenguaje.** Le cuesta encontrar palabras, o dice una por otra
- **Al final, las funciones básicas.** Tragar, caminar, controlar esfínteres

**Lo que se conserva hasta el final:** la capacidad de sentir. Una persona con demencia avanzada puede no reconocerte ni entender tus palabras, pero **sí percibe si estás apurada, molesta o tranquila**. El tono importa más que el contenido.

**Una distinción que salva vidas:**

La demencia avanza despacio, en meses y años. Cuando la confusión aparece **de un día para otro**, no es la demencia empeorando: es otra cosa. Se llama **delirium** y casi siempre tiene una causa tratable — una infección urinaria, deshidratación, dolor, un medicamento nuevo.

Un residente que ayer conversaba normal y hoy no sabe dónde está **se reporta de inmediato**. No es "que ya está más avanzado".

PREGUNTAS:
P: Un residente con demencia leve, que ayer conversaba con normalidad, hoy está confuso, no reconoce el lugar y habla incoherencias. ¿Qué haces?
a) Es la progresión normal de su demencia, lo anoto en la bitácora
*b) Lo reporto de inmediato: un cambio brusco no es la demencia avanzando, puede ser una causa tratable
c) Espero unos días a ver si se estabiliza
d) Le explico dónde está hasta que lo entienda
EXPLICACION: La demencia avanza en meses o años, nunca de un día para otro. Un cambio brusco sugiere delirium, que suele tener causa tratable — infección urinaria, deshidratación, dolor o un medicamento nuevo. Reportarlo a tiempo puede evitar una hospitalización.

P: ¿Qué capacidad conserva una persona con demencia avanzada, aunque ya no reconozca a nadie?
a) La memoria de nombres
*b) La capacidad de percibir el estado de ánimo de quien la atiende
c) La orientación en el tiempo
d) La capacidad de tomar decisiones complejas
EXPLICACION: La percepción emocional se conserva hasta etapas muy avanzadas. Aunque no entienda tus palabras, la persona nota si estás apurada, molesta o tranquila — por eso el tono con el que te acercas cambia el resultado del cuidado.

P: Un residente te cuenta con detalle su boda de hace cincuenta años, pero a los diez minutos de desayunar te dice que no le han dado de comer. Una compañera dice que lo hace para que le sirvan otra vez. ¿Qué está pasando realmente?
*a) La memoria reciente se pierde primero; lo antiguo se conserva
b) Está manipulando para conseguir comida extra
c) Le está fallando la audición y no entendió la pregunta
d) Es un cambio brusco y hay que reportarlo como emergencia
EXPLICACION: En la demencia lo primero que se va es la memoria reciente, mientras lo de hace cincuenta años sigue intacto — por eso parece que recuerda solo cuando le conviene. No es manipulación: su cerebro no guardó el desayuno.

P: Una residente con Alzheimer te señala el vaso de agua y te dice "dame el zapato". ¿Qué haces?
a) La corrijo hasta que diga bien la palabra
b) Le digo que no le entiendo y espero a que se explique
*c) Le doy el vaso de agua y sigo con naturalidad
d) Doy por hecho que ya no entiende nada y dejo de hablarle
EXPLICACION: La demencia afecta el lenguaje: se pierden las palabras o se cambia una por otra. Corregirla no se la devuelve y sí la frustra. Y aunque el lenguaje falle, ella sigue percibiendo tu tono, así que dejar de hablarle es lo peor que puedes hacer.

P: Una compañera nueva dice que doña Rosa está así "porque ya está viejita, a todos les pasa". ¿Qué le explicas?
a) Que tiene razón, olvidar así es parte normal de la edad
b) Que con ejercicios de memoria va a recuperar lo que perdió
c) Que demencia y Alzheimer son la misma cosa con otro nombre
*d) Que la demencia es una enfermedad, no parte de envejecer
EXPLICACION: Envejecer no produce demencia: es una enfermedad del cerebro, y el Alzheimer es solo su forma más común, no la única. Importa porque quien cree que "es la edad" deja de buscar causas y de ajustar el cuidado.

---SECCION_2---
LECTURA:
# La conducta es un mensaje

Cuando alguien con demencia grita, se resiste al baño o intenta salir por la puerta, la reacción instintiva es preguntarse cómo detenerlo. La pregunta útil es otra: **¿qué está tratando de decir?**

Una persona que ya no puede explicar con palabras que le duele, que tiene frío, que quiere ir al baño o que está asustada, lo expresa con conducta. Casi toda conducta difícil tiene un **desencadenante**.

**Los desencadenantes más frecuentes:**

- **Dolor** que no puede nombrar
- **Necesidad de ir al baño**
- Hambre, sed, frío o calor
- **Demasiado ruido o gente** — un pasillo con TV alta y varias voces satura
- Cansancio, sobre todo al final del día
- Sentirse apurada o invadida en su espacio
- Un rostro que no reconoce acercándose sin avisar

**El síndrome vespertino (sundowning):** muchas personas con demencia se agitan más al caer la tarde. La luz cambia, el turno cambia, hay más movimiento. No es casualidad ni capricho — es un patrón conocido. Anticiparlo ayuda: bajar estímulos, encender luces antes de que oscurezca, mantener rutinas.

**Antes de reaccionar, revisa lo básico:**

1. ¿Le duele algo?
2. ¿Necesita el baño?
3. ¿Tiene hambre, sed, frío?
4. ¿Hay demasiado ruido o movimiento alrededor?
5. ¿Está cansada?

Muchas veces la "conducta difícil" se resuelve con una de esas cinco.

PREGUNTAS:
P: Un residente con demencia se resiste con fuerza al baño, algo que antes aceptaba sin problema. ¿Cuál es tu primer paso?
a) Insisto con firmeza, la higiene no es opcional
b) Lo dejo sin bañar y lo anoto
*c) Busco el desencadenante: si le duele algo, si tiene frío, si el ambiente lo abruma
d) Pido a otra persona que lo intente
EXPLICACION: Un cambio de conducta suele tener causa. Alguien que antes aceptaba el baño y ahora se resiste puede tener dolor, sentir frío, o estar abrumado por el ruido. Revisar lo básico resuelve la mayoría de estas situaciones sin confrontación.

P: ¿Qué es el síndrome vespertino?
a) Una enfermedad distinta del Alzheimer
*b) El patrón de mayor agitación al caer la tarde, frecuente en personas con demencia
c) La somnolencia después del almuerzo
d) La dificultad para dormir de noche
EXPLICACION: Muchas personas con demencia se agitan más al atardecer, cuando cambia la luz y aumenta el movimiento del cambio de turno. Es un patrón conocido y anticiparlo —bajando estímulos y encendiendo luces antes— reduce los episodios.

P: Casi todos los días, como a las cinco de la tarde, doña Carmen empieza a caminar de un lado a otro, ansiosa y molesta. ¿Qué es lo más útil que puedes hacer?
a) Esperar a que se le pase sola, siempre termina cansándose
*b) Anticiparme antes de que empiece: luz, menos ruido, rutina
c) Pedir que la mediquen para esa hora
d) Llevarla al pasillo con la TV puesta para que se distraiga
EXPLICACION: Encender las luces antes de que oscurezca, bajar el ruido y sostener la rutina de siempre. La agitación al caer la tarde es un patrón conocido, no un capricho, y lo que funciona es prepararse antes. Medicar no es decisión tuya, y más ruido y estímulo casi siempre empeora el episodio.

P: Doña Ana está tranquila en su cuarto, pero cada vez que la llevas al pasillo donde la TV está alta y hay varias voces, se pone ansiosa y quiere irse. ¿Qué te dice eso?
*a) Que el ruido y el movimiento la saturan
b) Que hay que llevarla más seguido para que se acostumbre
c) Que no quiere compañía y hay que dejarla sola siempre
d) Que su demencia entró de golpe en una etapa más avanzada
EXPLICACION: Le conviene un lugar más tranquilo. Demasiado ruido y gente es uno de los desencadenantes más comunes de agitación, y no se arregla exponiéndola más. Aislarla del todo tampoco: el problema es el estímulo, no la compañía.

P: Un residente que casi no habla lleva dos días gritando cuando lo mueves para vestirlo. Antes se dejaba sin problema. ¿Qué haces?
a) Lo visto lo más rápido posible para que dure menos
b) Le doy un acetaminofén de los que la familia dejó en la gaveta
*c) Sospecho dolor, lo reporto, y mientras tanto lo muevo despacio y avisándole
d) Anoto "resistencia al cuidado" y mañana sigo igual
EXPLICACION: Quien ya no puede decir que le duele lo dice con conducta, y una conducta nueva casi siempre tiene causa. Dar medicina por tu cuenta nunca es opción: tú observas y reportas, el manejo lo decide la enfermera.

---SECCION_3---
LECTURA:
# Validar y redirigir, nunca corregir

Este es el conjunto de técnicas que más diferencia hace en el día a día.

**No corrijas la realidad de la persona.** Si una residente pregunta por su mamá, que murió hace 30 años, decirle "su mamá falleció" la obliga a recibir esa noticia como si fuera nueva. Vas a ver el duelo completo, otra vez. Y mañana, otra vez.

**Valida el sentimiento, no el dato:**

- Ella: "¿Dónde está mi mamá? Tengo que ir a verla"
- ❌ "Su mamá murió hace muchos años"
- ✅ "Se ve que la extraña mucho. Cuénteme de ella, ¿cómo era?"

No estás mintiendo: estás respondiendo a lo que realmente está expresando, que es añoranza, no una pregunta de información.

**Redirige hacia otra cosa:**

- Él: "Tengo que ir a trabajar, se me hace tarde"
- ❌ "Usted está retirado, ya no trabaja"
- ✅ "¿En qué trabajaba usted? ... Venga, acompáñeme mientras tanto"

**La acusación:** que te acusen de robar es de lo más común y de lo más doloroso. La persona no encuentra su objeto, y su cerebro completa el vacío con la explicación disponible: alguien lo tomó. No es sobre ti.

- ❌ "Yo no le robé nada, revise bien"
- ✅ "Qué molesto que no aparezca. La ayudo a buscarla"

Discutir nunca gana. La persona con demencia no puede razonar de vuelta al lugar donde tú estás — y cada discusión la deja agitada y a ti agotada.

**Cómo acercarte:**

- De frente, nunca por detrás
- A su altura
- Di quién eres y qué vas a hacer, aunque creas que ya lo sabe
- Una instrucción por vez: "Vamos a levantarnos" y después "ahora el brazo"

PREGUNTAS:
P: Una residente con Alzheimer te acusa de haberle robado su cartera, que está en su propia gaveta. ¿Qué respondes?
a) "Yo no le robé nada, su cartera está en la gaveta"
b) "Ahora mismo la llamo a la policía si quiere"
*c) "Qué molesto que no aparezca. La ayudo a buscarla"
d) No respondo y me retiro para no discutir
EXPLICACION: La acusación no es sobre ti: el cerebro llena el vacío de un objeto perdido con la explicación disponible. Defenderte genera confrontación; acompañarla a buscar reconoce su angustia y suele resolver el episodio en minutos.

P: Un residente pregunta repetidamente por su esposa, que falleció hace años. ¿Qué haces?
a) Le explico con delicadeza que ella falleció
*b) Valido el sentimiento y redirijo: "Se nota que la quiere mucho, cuénteme de ella"
c) Le digo que ella viene más tarde
d) Cambio de tema bruscamente
EXPLICACION: Darle la noticia lo obliga a vivir el duelo como si fuera nuevo, hoy y cada vez que pregunte. Validar el sentimiento responde a lo que realmente expresa —añoranza— sin mentirle ni lastimarlo.

P: Una compañera lleva diez minutos enseñándole el calendario a un residente para probarle que hoy no es domingo. Él está cada vez más alterado. ¿Qué le dices a ella?
a) Que siga, así se va orientando poco a poco
*b) Que lo deje: él no puede razonar de vuelta
c) Que llame a la familia para que ellos se lo expliquen
d) Que se aleje y no le hable hasta que acepte la fecha
EXPLICACION: Cada discusión lo deja agitado y no lo trae de vuelta: la persona no puede volver al lugar donde tú estás. Retirarle la palabra tampoco sirve; lo que funciona es soltar el dato y seguir con otra cosa.

P: Un residente se viste de calle a las seis de la mañana y dice que llega tarde al trabajo. ¿Qué le dices?
a) "Usted está retirado hace años, ya no trabaja"
b) "Hoy es domingo, hoy no hay trabajo"
c) "Si sale por esa puerta se va a meter en un lío"
*d) "¿En qué trabajaba usted? Cuénteme mientras nos tomamos un café"
EXPLICACION: Corregirlo lo confronta y amenazarlo lo asusta; inventarle un cuento te obliga a sostenerlo mañana y pasado. Preguntarle por su trabajo reconoce lo que siente y te deja redirigirlo hacia otra cosa sin pelear.

P: Una residente está sentada mirando por la ventana. Tienes que llevarla al baño. ¿Cómo te acercas?
*a) De frente, a su altura, diciéndole quién soy
b) Por detrás, la tomo del brazo y la levanto para no interrumpirla
c) Le aviso desde la puerta mientras sigo haciendo otra cosa
d) La levanto sin hablarle, total ya me conoce
EXPLICACION: De frente, a su altura, diciendo quién eres y qué van a hacer. Una persona con demencia puede no reconocerte, y una mano que aparece por detrás se siente como un ataque: acercarte así te evita la mitad de los forcejeos del día.

---SECCION_4---
LECTURA:
# Deambulación y seguridad

Caminar sin rumbo aparente es común en la demencia. Suele tener una razón: buscar a alguien, ir "a la casa", buscar el baño, o simplemente descargar inquietud.

**La deambulación en sí no es el problema.** Caminar es bueno para el cuerpo y para el ánimo. El riesgo es que salga de la facilidad o entre a un lugar peligroso.

**Qué funciona:**

- Dejarlo caminar en un espacio seguro, acompañado si hace falta
- Caminar **con** la persona en vez de detenerla: es la forma más rápida de calmar el episodio
- Rutina de actividad física durante el día — quien se mueve, deambula menos de noche
- Puertas de salida a la vista del personal
- Señalización clara del baño: mucha deambulación es alguien buscando dónde orinar

**Qué NO se hace:**

- **No se sujeta ni se amarra a un residente.** Las sujeciones físicas causan lesiones, agitación y pérdida de movilidad, y su uso está estrictamente regulado. Si un residente parece necesitar contención, eso se reporta a supervisión — no se decide en el piso
- No se encierra en la habitación
- No se le grita ni se le persigue: correr detrás de alguien confundido aumenta su miedo

**Si un residente intenta salir:**

1. Acércate de frente, con calma, sin bloquear con el cuerpo
2. No lo confrontes: "Sí, vamos" y camina con él unos pasos
3. Redirige hacia adentro con una excusa natural: "Antes de irnos, ¿me acompaña a tomar café?"
4. Avisa a supervisión — un intento de salida siempre se reporta

**Si no encuentras a un residente**, avisa de inmediato. No pierdas minutos buscando sola: los primeros minutos son los que importan.

PREGUNTAS:
P: Un residente con demencia camina hacia la puerta de salida diciendo que se va a su casa. ¿Qué haces?
a) Me paro frente a la puerta para bloquearle el paso
b) Lo llevo a su habitación y cierro la puerta
*c) Camino con él unos pasos, valido lo que dice y lo redirijo con una invitación
d) Le explico que esta es su casa ahora
EXPLICACION: Bloquear o encerrar aumenta la agitación y el riesgo de forcejeo. Acompañarlo y redirigir con algo concreto —un café, una actividad— desactiva el episodio sin confrontación. El intento se reporta siempre a supervisión.

P: Un residente muy inquieto parece necesitar sujeción para que no se lastime. ¿Qué haces?
a) Uso una sábana para sujetarlo a la silla mientras se calma
b) Lo encierro en su habitación por su seguridad
*c) Lo reporto a supervisión: las sujeciones no se deciden en el piso
d) Le pido a un compañero que lo sostenga
EXPLICACION: Las sujeciones físicas causan lesiones, agitación y pérdida de movilidad, y su uso está estrictamente regulado. Nunca se improvisan en el piso: la situación se reporta para que la evalúe quien corresponde.

P: Vas a buscar a don Luis a su habitación y no está. No lo ves en el comedor ni en el pasillo. ¿Qué haces?
a) Lo busco yo sola por toda la facilidad antes de alarmar a nadie
b) Espero un rato, siempre anda dando vueltas y aparece
*c) Aviso de inmediato y seguimos buscando entre todos
d) Termino lo que estaba haciendo y después sigo buscando
EXPLICACION: Cuando un residente no aparece, los primeros minutos son los que deciden. Buscar sola para no alarmar a nadie es el error más caro: se pierde justo el tiempo que importa.

P: Un residente camina de arriba a abajo por un pasillo interior seguro. Está tranquilo y no intenta salir. Una compañera quiere sentarlo para que no se caiga. ¿Qué haces?
a) La ayudo a sentarlo, caminar tanto termina en caída
b) Lo llevo a su cuarto y cierro la puerta
c) Lo siento frente a la TV para que se quede quieto
*d) Lo dejo caminar ahí y lo mantengo a la vista
EXPLICACION: Ese pasillo es un espacio seguro, y caminar no es el problema: le hace bien al cuerpo y al ánimo, y quien se mueve de día deambula menos de noche. El riesgo es que salga o entre donde no debe, y eso se cuida con supervisión, no sentándolo.

P: Doña Luz se levanta muchas veces en la tarde y camina abriendo puertas, inquieta. ¿Qué revisas primero?
a) Si hace falta sujetarla para que no se lastime
*b) Si está buscando el baño y no lo encuentra
c) Si conviene encerrarla en su cuarto hasta que se calme
d) Si se le puede dar algo para que duerma un rato
EXPLICACION: Buena parte de la deambulación es exactamente eso: alguien que no encuentra dónde orinar. Se resuelve con una señal clara y visible en la puerta del baño. Sujetar, encerrar o medicar no son cosas que se decidan en el piso.

---SECCION_5---
LECTURA:
# El día a día: rutina, entorno y familia

**La rutina es tratamiento.** Para un cerebro que ya no puede anticipar, que las cosas ocurran siempre igual —a la misma hora, en el mismo orden, con las mismas personas— reduce la ansiedad más que cualquier otra intervención disponible en el piso.

Por eso importa que el relevo se haga bien: si el turno de la tarde no sabe que esta residente se baña antes de cenar y no después, le cambia el día entero.

**El entorno ayuda o estorba:**

- Luz suficiente: la penumbra genera sombras que se confunden con personas
- Menos ruido: la TV alta de fondo satura y confunde
- Objetos familiares a la vista — fotos, una manta propia
- Relojes y calendarios grandes
- Espejos: en demencia avanzada pueden asustar, porque la persona no se reconoce

**Con la familia:**

La familia de alguien con demencia carga una pérdida particular: la persona está viva pero ya no es la misma. Suelen llegar con culpa, con negación, o esperando que "reaccione".

- Cuéntales lo concreto y bueno del día: qué comió, si caminó, si estuvo tranquila
- No interpretes ni pronostiques. "¿Cuánto le queda así?" no es una pregunta que te toque contestar — canalízala al director o a la enfermera
- Si preguntan por qué su familiar no los reconoce, la respuesta honesta ayuda: sigue sintiendo el afecto aunque no ponga el nombre

**Lo que siempre se reporta:**

- Confusión que aparece de golpe
- Agresividad nueva en alguien que no la tenía
- Dejar de comer o beber
- Caída o intento de salida
- Cualquier lesión, por pequeña que sea

Recuerda el marco: tú observas y reportas. El plan de manejo —incluida cualquier medicación— lo establece la enfermera o el médico.

PREGUNTAS:
P: La hija de una residente con demencia avanzada te pregunta llorando cuánto tiempo le queda así. ¿Qué respondes?
a) Le doy mi opinión basada en lo que he visto en otros residentes
b) Le digo que nadie sabe y cambio de tema
*c) Le digo con honestidad que esa pregunta la maneja el director o la enfermera, y le ofrezco pasar el mensaje
d) Le explico las etapas de la demencia
EXPLICACION: El pronóstico es información clínica que no le corresponde al cuidador, por más humana que sea la pregunta. Canalizarla con honestidad y calidez responde a la familia sin salirte de tu rol ni arriesgar una respuesta equivocada.

P: ¿Por qué importa tanto mantener la rutina de un residente con demencia?
a) Porque facilita el trabajo del personal
*b) Porque para un cerebro que ya no puede anticipar, la repetición reduce la ansiedad
c) Porque lo exige el reglamento
d) Porque ayuda a que recupere la memoria
EXPLICACION: La rutina es una de las intervenciones más efectivas disponibles en el piso. Cuando las cosas ocurren siempre igual, la persona no necesita anticipar lo que no puede — y eso baja la ansiedad y las conductas difíciles.

P: Una residente con demencia avanzada se asusta cada tarde en el baño y dice que "hay alguien ahí". ¿Qué revisas?
*a) El espejo y la luz del baño
b) Nada, son alucinaciones y lo que hace falta es medicarla
c) Le digo que ahí no hay nadie y cierro la puerta
d) La baño más tarde y no lo comento con nadie
EXPLICACION: En demencia avanzada el espejo asusta porque la persona no se reconoce, y la poca luz convierte cualquier sombra en alguien. Ajustar el entorno resuelve el episodio, y lo que observaste igual se reporta.

P: Doña Elsa se baña antes de cenar, no después, porque después se agita. Vas a entregar turno. ¿Qué haces?
a) No digo nada, cada turno se acomoda como puede
b) Se lo digo a ella para que se lo pida al turno de la tarde
*c) Lo paso en el relevo, con la razón
d) Lo dejo así, total ella no se va a acordar de reclamarlo
EXPLICACION: Si el otro turno no sabe la rutina, le cambia el día entero. Para un cerebro que ya no puede anticipar, la rutina es tratamiento, y una rutina que no se transmite en el relevo se pierde. Esperar que la residente la reclame es pedirle justo lo que la enfermedad le quitó.

P: Don Ramón siempre fue tranquilo. Lleva dos días empujando y diciendo malas palabras cuando lo tocas. ¿Qué haces?
a) Lo anoto como residente de mal carácter y evito tocarlo
*b) Lo reporto: una agresividad nueva siempre se reporta
c) Espero a ver si se le quita durante la semana
d) Le pido a la familia que hable con él
EXPLICACION: Lo que se reporta no es la conducta en sí, es que sea NUEVA en quien no la tenía: detrás puede haber dolor, una infección o un medicamento. Etiquetarlo de "mal carácter" cierra la puerta a encontrar la causa.
`,
    },
    {
        title: 'Movilización y Transferencias Seguras',
        description: 'Mover a un residente sin lastimarlo ni lastimarte: mecánica corporal, transferencias paso a paso, reposicionamiento y prevención de caídas.',
        durationMins: 35,
        bonusCompliance: 25,
        emoji: '🦿',
        category: 'Cuidado Geriátrico',
        order: 102,
        targetRole: null,
        content: `---META---
TITULO: Movilización y Transferencias Seguras
PROMPT_ZENDI: Evalúa si el empleado sabe mover a un residente sin lastimarlo ni lastimarse, reconoce cuándo una transferencia requiere dos personas o equipo, y entiende que el nivel de asistencia lo establece el plan de cuidado, no su criterio del momento.
TERMINOS_CLAVE: transferencia, mecánica corporal, cinturón de marcha, pivote, nivel de asistencia, carga, caída controlada, reposicionamiento, cizallamiento, plan de cuidado
PREGUNTA_REFLEXION: Un residente que necesita dos personas para levantarse te pide que lo ayudes al baño. Estás sola en el pasillo y él insiste en que puede. ¿Qué haces?

---SECCION_1---
LECTURA:
# Dos cuerpos en riesgo

Cada vez que mueves a un residente hay dos personas expuestas: él, que puede caerse o lesionarse la piel, y tú, que puedes lesionarte la espalda. Las lesiones de espalda son la causa número uno de incapacidad en el personal de cuidado, y casi siempre vienen de una transferencia mal hecha — no de una, sino de cientos repetidas mal.

**El nivel de asistencia no lo decides tú.** Cada residente tiene establecido cuánta ayuda necesita, y eso viene del plan de cuidado, no de cómo lo veas hoy:

- **Independiente** — se mueve solo, tú supervisas
- **Asistencia de contacto** — una persona a su lado, guiando
- **Asistencia de una persona** — una persona sostiene parte de su peso
- **Asistencia de dos personas** — se requieren dos, siempre
- **Con equipo** — grúa o tabla de transferencia

**Ese nivel no se baja porque el residente diga que puede.** Un residente que hoy se siente fuerte sigue siendo el mismo que ayer necesitaba dos personas. Si notas que su capacidad cambió —para mejor o para peor— eso se reporta para que se reevalúe. Lo que no se hace es improvisar en el pasillo.

**Antes de mover a alguien, siempre:**

1. Verifica su nivel de asistencia
2. Explícale qué van a hacer, aunque no responda
3. Despeja el camino: frenos puestos, obstáculos fuera, zapatos puestos
4. Asegúrate de tener la ayuda que hace falta

Si falta cualquiera de las cuatro, no empieces.

PREGUNTAS:
P: Un residente con asistencia de dos personas te dice que hoy se siente fuerte y que puede levantarse contigo sola. ¿Qué haces?
a) Lo ayudo sola, él conoce su cuerpo mejor que nadie
*b) Espero a un segundo compañero: el nivel de asistencia viene del plan, no del ánimo del día
c) Lo dejo intentarlo solo mientras yo observo
d) Le digo que no puede levantarse hoy
EXPLICACION: El nivel de asistencia lo establece la evaluación, no cómo se sienta el residente esa mañana. Bajarlo por su cuenta es la forma más común de que ocurra una caída con lesión. Si notas que su capacidad mejoró, se reporta para que se reevalúe.

P: ¿Cuál es la causa más frecuente de lesión de espalda en el personal de cuidado?
a) Estar mucho tiempo de pie
*b) Transferencias mal hechas, repetidas muchas veces
c) Cargar suministros
d) Trabajar turnos largos
EXPLICACION: La lesión rara vez viene de un solo movimiento dramático: viene de cientos de transferencias hechas con mala mecánica corporal. Por eso la técnica correcta importa incluso cuando el residente pesa poco.

P: Un residente que siempre se ha levantado con asistencia de contacto lleva tres días temblando y con menos fuerza al pararse. ¿Qué haces?
a) Le subo el nivel a dos personas por mi cuenta y no lo menciono, total es más seguro
b) Sigo con asistencia de contacto hasta que alguien me diga lo contrario
*c) Lo reporto para que se reevalúe su nivel, y mientras tanto no improviso sola en el pasillo
d) Espero unos días a ver si vuelve a estar como antes
EXPLICACION: Pedir más ayuda hoy siempre se puede y se debe — lo que no se hace es callarlo. La regla no es simétrica: un cambio de capacidad se reporta para que se reevalúe el nivel, y lo que nunca se baja por cuenta propia es la ayuda que él tiene asignada. Seguir igual "hasta que alguien diga" lo deja en un nivel que ya no le sirve.

P: Vas a mover a una residente con demencia avanzada que casi no habla ni parece entenderte. ¿Le explicas lo que vas a hacer?
*a) Sí, siempre: se le explica antes de moverla aunque no responda
b) No, si no entiende es tiempo perdido
c) Solo si hay familia presente
d) Le explico después, ya sentada, para que no se asuste antes
EXPLICACION: Explicar antes de mover es uno de los cuatro pasos obligatorios y no depende de que la persona conteste. Quien no entiende las palabras sí siente que la mueven de golpe, y eso es lo que produce el forcejeo.

P: Vas a pasar a un residente de la cama a la silla. Tienes su nivel verificado y a tu compañera lista, pero él está en medias y sus zapatos están en el closet. Vas atrasada. ¿Qué haces?
a) Lo transfiero en medias, son dos pasos
*b) Busco los zapatos y empiezo cuando estén puestos
c) Le pongo dos pares de medias para que agarren mejor
d) Lo transfiero descalzo, el piso no está mojado
EXPLICACION: Los zapatos puestos son parte de la preparación, igual que los frenos y el camino despejado: si falta cualquiera de los cuatro pasos, no se empieza. Las medias sobre piso liso resbalan justo cuando él carga su peso.

---SECCION_2---
LECTURA:
# Mecánica corporal: tu propio cuerpo

La regla que resume todo: **usa las piernas, nunca la espalda**.

**Antes de levantar cualquier peso:**

- **Pies separados** al ancho de tus hombros, uno ligeramente adelante — es tu base
- **Dobla las rodillas**, no la cintura. Si tu espalda se curva, ya estás mal
- **Espalda recta**, abdomen firme
- **Acerca la carga a tu cuerpo.** El peso a un brazo de distancia pesa varias veces más para tu espalda que el mismo peso pegado al torso
- **Nunca gires la cintura con peso encima.** Mueve los pies para girar — el torcer cargado es lo que rompe discos

**Empuja o desliza en vez de levantar.** Levantar es el último recurso. Deslizar a un residente sobre una sábana, o pedirle que empuje con sus piernas mientras tú guías, mueve el mismo cuerpo con una fracción de la carga.

**Cuenta en voz alta.** "A la de tres: uno, dos, tres." Suena obvio y es lo que separa una transferencia coordinada de un tirón. Sirve para el residente y para tu compañero.

**Si algo se siente demasiado pesado, lo es.** No hay premio por hacerlo sola. Pedir ayuda toma dos minutos; una hernia discal toma meses.

**El calzado importa** — el tuyo y el del residente. Nunca transfieras a alguien en medias sobre piso liso.

PREGUNTAS:
P: Vas a levantar a un residente desde una silla. ¿Cuál es la posición correcta?
a) Piernas rectas, doblo la cintura para alcanzarlo
*b) Pies separados, rodillas dobladas, espalda recta, el residente pegado a mi cuerpo
c) Me paro de lado y giro la cintura para moverlo
d) Estiro los brazos para no invadir su espacio
EXPLICACION: La fuerza sale de las piernas. Doblar la cintura o girar el torso con peso encima es exactamente el mecanismo que lesiona los discos, y sostener la carga lejos del cuerpo multiplica el peso efectivo sobre la espalda.

P: Necesitas girar a un residente hacia la cama mientras lo sostienes. ¿Qué haces?
a) Giro la cintura manteniendo los pies fijos
*b) Muevo los pies para girar todo el cuerpo a la vez
c) Le pido que gire él solo
d) Lo suelto un momento para reacomodarme
EXPLICACION: Girar la cintura con peso encima es uno de los movimientos más lesivos que existen. Reposicionar los pies mantiene el torso alineado y distribuye el esfuerzo en las piernas.

P: Un residente puede empujar con sus piernas, pero tú vas rápida y te sale más fácil levantarlo tú completo. ¿Qué haces?
a) Lo levanto yo completo, es más rápido
b) Lo halo por los brazos hacia arriba hasta pararlo
c) Le pido que se agarre de mi cuello mientras yo halo
*d) Le pido que empuje con sus piernas mientras yo guío
EXPLICACION: Levantar es el último recurso: si él empuja y tú guías el movimiento, se mueve el mismo cuerpo con una fracción de la carga sobre tu espalda. Además, cada vez que usa sus piernas, las mantiene.

P: Entre dos van a mover a un residente en la cama y tu compañera empieza a halar antes de que tú estés lista. ¿Qué hace falta?
a) Que la más fuerte haga el movimiento y la otra solo acompañe
*b) Acordar el movimiento y contar en voz alta: "a la de tres"
c) Nada, con práctica una se acopla sola
d) Avisarse con la mirada para no asustar al residente
EXPLICACION: Contar en voz alta suena obvio y es lo que separa una transferencia coordinada de un tirón: las dos mueven a la vez y el residente sabe cuándo viene. Sin la cuenta, una carga el peso que la otra soltó.

P: A mitad de una transferencia sientes que el residente pesa más de lo que puedes controlar. ¿Qué haces?
a) Termino el movimiento, ya está a medio camino
b) Halo con los brazos y aprieto el abdomen para aguantar
*c) Paro, lo dejo sentado seguro y busco ayuda
d) Lo hago más rápido para que dure menos
EXPLICACION: Antes de seguir, y sin que te dé apuro pedirla. Si algo se siente demasiado pesado, lo es: esa señal es tu cuerpo avisando. Terminar "porque ya empezaste" es el momento exacto en que se lesiona la espalda; pedir ayuda toma dos minutos y una hernia toma meses.

---SECCION_3---
LECTURA:
# La transferencia paso a paso

**De la cama a la silla (asistencia de una persona):**

1. **Prepara.** Silla al lado de la cama, en ángulo, **con los frenos puestos**. Cama a la altura correcta si es ajustable
2. **Siéntalo al borde.** Que quede con los pies planos en el piso. Déjalo ahí unos segundos
3. **Espera.** Si se levanta de golpe puede marearse — la presión le baja al cambiar de posición. Pregúntale si siente mareo antes de seguir
4. **Zapatos puestos**, con suela que agarre
5. **Cinturón de marcha** si su plan lo indica. Se agarra el cinturón, **nunca al residente por debajo de los brazos** — así se dislocan hombros
6. **Tus rodillas frente a las suyas**, bloqueándolas para que no se le doblen
7. **Cuenta.** "A la de tres." Que él empuje con las piernas mientras tú guías
8. **Pivota** con pasos cortos. No lo cargues ni lo arrastres
9. **Siéntalo despacio**, con tu espalda recta

**Qué nunca se hace:**

- Halar por las axilas o por un brazo
- Transferir sin frenos puestos
- Dejar a alguien parado esperando mientras acomodas algo
- Transferir en medias o descalzo

**Si el residente empieza a caerse:** no intentes sostener todo su peso — te vas a lesionar y probablemente caigan los dos. **Acompaña la caída al piso**: acércalo a tu cuerpo, protégele la cabeza, y bájalo controladamente doblando tus rodillas. Un residente en el piso sin golpe en la cabeza está mucho mejor que dos personas lesionadas.

**Después de cualquier caída, aunque no se vea daño**: no lo levantes de inmediato, avisa, y repórtala. Siempre.

PREGUNTAS:
P: Durante una transferencia el residente pierde fuerza y empieza a caerse. ¿Qué haces?
a) Lo sostengo con toda mi fuerza para que no toque el piso
*b) Lo acerco a mi cuerpo, le protejo la cabeza y lo bajo al piso de forma controlada
c) Me quito para que no me arrastre
d) Lo suelto y pido ayuda
EXPLICACION: Intentar sostener el peso completo suele terminar con los dos en el piso y con una lesión de espalda. Bajarlo de forma controlada protegiendo la cabeza es la técnica correcta, y toda caída se reporta aunque no se vea daño.

P: ¿Dónde se sujeta a un residente durante una transferencia asistida?
a) Por debajo de las axilas
b) Por las manos, halando hacia arriba
*c) Por el cinturón de marcha, si su plan lo indica
d) Por la ropa
EXPLICACION: Halar por las axilas puede dislocar hombros —una lesión frecuente y evitable— y halar por las manos no da control. El cinturón de marcha reparte la fuerza sobre la cintura y te deja guiar sin cargar.

P: Sientas al residente al borde de la cama con los pies en el piso. Vas atrasada y quieres pararlo de una vez. ¿Qué haces?
*a) Espero unos segundos y le pregunto si siente mareo
b) Lo paro enseguida y si se marea lo sostengo
c) Lo paro rápido: mientras menos tiempo de pie, mejor
d) Le pido que cierre los ojos y respire mientras lo levanto
EXPLICACION: Antes de pararlo. Al cambiar de posición la presión le baja y se puede marear; esos segundos sentado son los que evitan que se vaya al piso ya estando de pie. "Si se marea lo sostengo" es justo la situación que no quieres resolver cargando su peso.

P: Ya lo pusiste de pie y te das cuenta de que la silla quedó lejos y sin frenos. ¿Qué haces?
a) Le digo que se agarre del pasamanos mientras acomodo la silla
b) Halo la silla con el pie mientras lo sostengo
c) Lo dejo parado agarrado del andador, es un segundo
*d) Lo siento de vuelta en la cama y empiezo otra vez
EXPLICACION: Con la silla ya acomodada y los frenos puestos. Dejar a alguien parado esperando mientras acomodas algo está en la lista de lo que nunca se hace: de pie, cansado y sin apoyo firme es donde ocurre la caída. Empezar de nuevo cuesta un minuto.

P: Cuando pones de pie a un residente, sus rodillas tienden a doblársele hacia adelante. ¿Cómo te preparas para eso?
a) Le paso el brazo por debajo de las axilas para aguantarlo
*b) Coloco mis rodillas frente a las suyas para bloquearlas
c) Lo levanto en peso y lo cargo los dos pasos hasta la silla
d) Le pido que se agarre de la baranda y lo halo hacia mí
EXPLICACION: Bloquear sus rodillas con las tuyas evita que se le doblen justo cuando carga su peso, y te deja pivotar con pasos cortos. Sujetar por debajo de las axilas es lo que disloca hombros.

---SECCION_4---
LECTURA:
# Reposicionamiento en cama

Una persona que no se mueve sola necesita cambiar de posición con regularidad. El intervalo lo establece su plan de cuidado — típicamente cada dos horas, pero eso no lo decides tú.

**Por qué importa tanto:** el peso del propio cuerpo comprime la piel contra el hueso y le corta la circulación. Sin circulación, el tejido empieza a dañarse en horas. Ese daño es el que termina siendo una úlcera por presión.

**Cizallamiento — el error más común y el menos conocido.** Cuando arrastras a alguien sobre la sábana en vez de levantarlo, la piel se queda pegada a la tela mientras el hueso se mueve por dentro. Se desgarra el tejido por debajo, sin que se vea nada por fuera.

Por eso: **nunca arrastres. Levanta o usa sábana de deslizamiento**, y siempre entre dos personas cuando el residente no colabora.

**La cabecera de la cama** por encima de 30 grados hace que el cuerpo resbale hacia abajo — puro cizallamiento sobre el sacro. Súbela para comer y bájala después.

**Al reposicionar, revisa la piel.** Es el momento en que la ves. Lo que se reporta:

- Piel enrojecida que **no se aclara al presionar**
- Cualquier zona morada, ampolla o piel abierta
- Humedad persistente
- Sábanas arrugadas debajo del residente — una arruga sostenida marca la piel

**Recuerda el marco:** tú observas y reportas. El tratamiento de una lesión de piel lo establece la enfermera de home care; el hogar ejecuta lo que ella indique y documenta lo que ve.

PREGUNTAS:
P: Vas a subir a un residente que resbaló hacia los pies de la cama. ¿Cómo lo haces?
a) Lo halo por debajo de los brazos hasta la cabecera
*b) Con otra persona, levantándolo con una sábana de deslizamiento en vez de arrastrarlo
c) Lo halo por las piernas
d) Le pido que se empuje solo
EXPLICACION: Arrastrar produce cizallamiento: la piel se queda pegada a la sábana mientras el hueso se desplaza, desgarrando el tejido por dentro sin señal visible por fuera. Levantar entre dos con sábana evita ese daño.

P: Al reposicionar ves una zona enrojecida en el sacro que no se aclara al presionarla. ¿Qué haces?
a) Le doy masaje en la zona para activar la circulación
*b) Alivio la presión de esa zona, lo documento y lo reporto
c) Le aplico una crema que tengo disponible
d) Espero al próximo turno a ver si mejora
EXPLICACION: El enrojecimiento que no cede al presionar indica que la circulación ya está comprometida. Nunca se da masaje sobre esa zona —aumenta el daño— ni se aplica nada por cuenta propia: se alivia la presión, se documenta y lo evalúa la enfermera.

P: Un residente se resbala hacia los pies de la cama varias veces al día. Cada vez que entras, la cabecera está bien alta. ¿Qué haces?
a) Es normal en cama articulada; lo vuelvo a subir cada vez que pase
b) Le pongo una almohada bajo los pies para que no siga bajando
*c) Bajo la cabecera cuando no esté comiendo y lo acomodo bien
d) Lo dejo como está y se lo comento al próximo turno
EXPLICACION: La cabecera alta es justo lo que lo hace resbalar. Por encima de 30 grados el cuerpo se desliza solo, y ese deslizamiento es cizallamiento sobre el sacro: el daño pasa por dentro sin que se vea nada por fuera. Subirlo una y otra vez sin bajar la cabecera repite la fricción varias veces al día.

P: Le toca cambio de posición a un residente que no se mueve solo, y está profundamente dormido. ¿Qué haces?
a) Lo dejo dormir, el descanso también es salud
*b) Lo reposiciono en el intervalo que dice su plan
c) Espero a que despierte solo y ahí lo cambio
d) Lo dejo hasta el próximo turno porque tiene colchón especial
EXPLICACION: Con cuidado y explicándole, aunque no despierte del todo. El peso sigue comprimiendo la piel contra el hueso aunque él duerma, y el tejido empieza a dañarse en horas. El intervalo lo establece su plan de cuidado, no el sueño ni el colchón.

P: Vas a acostar a un residente y notas que la sábana quedó arrugada debajo de su espalda. Él no se queja. ¿Qué haces?
a) Lo dejo así, si no se queja no le molesta
b) Lo dejo así, la sábana se acomoda sola con el movimiento
c) Le pongo una almohada encima de la arruga
*d) Estiro la sábana y la dejo lisa antes de acostarlo
EXPLICACION: Una arruga sostenida marca la piel igual que la presión del hueso, y quien no se mueve solo tampoco se puede quitar de encima. Que no se queje no significa que no le esté haciendo daño.

---SECCION_5---
LECTURA:
# Caminar, prevenir caídas y usar el equipo

**Caminar es tratamiento.** Cada día que un residente no camina, pierde fuerza que le costará semanas recuperar. Un residente que deja de caminar entra en una espiral: menos fuerza, más miedo, menos ganas, más dependencia. Acompañar a caminar a quien puede hacerlo es de las cosas más valiosas que haces en el turno.

**Al acompañar a caminar:**

- Camina **al lado y ligeramente detrás**, del lado más débil
- Con cinturón de marcha si su plan lo indica
- Deja que use su bastón o andador — no se lo quites para ir más rápido
- Vayan al ritmo de él, no al tuyo

**Las caídas casi siempre tienen las mismas causas, y casi todas son evitables:**

- Piso mojado o recién trapeado sin señalizar
- Calzado inadecuado — chancletas, medias, suela lisa
- Falta de luz, sobre todo de noche camino al baño
- Obstáculos: cables, alfombras sueltas, un carrito en el pasillo
- Cama demasiado alta
- Frenos sin poner en cama o silla de ruedas
- Necesidad urgente de ir al baño — el apuro es un factor enorme
- Un medicamento nuevo que produce mareo

**Lo que puedes hacer en cada turno:** secar de inmediato, señalizar, mantener los pasillos despejados, verificar frenos, dejar el llamador al alcance, y ofrecer el baño antes de que sea urgencia.

**El equipo se revisa antes de usarlo.** Frenos que agarren, ruedas firmes, andador con las cuatro conteras puestas, cinturón sin desgaste. Equipo dañado se saca de circulación y se reporta — no se sigue usando "con cuidado".

**Después de una caída:** no lo levantes de inmediato, verifica si responde y si le duele algo, avisa a supervisión y documenta. Una caída no reportada es la que se repite.

PREGUNTAS:
P: Acompañas a caminar a un residente con debilidad del lado izquierdo. ¿Dónde te colocas?
a) Al frente, sosteniéndole ambas manos
*b) A su lado izquierdo y ligeramente detrás
c) Detrás, empujándolo suavemente
d) A su derecha, que es el lado fuerte
EXPLICACION: Colocarte del lado débil y algo atrás te permite reaccionar hacia donde realmente se va a desequilibrar, sin bloquearle el paso ni quitarle el control de su propia marcha.

P: Notas que el andador de un residente tiene una contera de goma desgastada. ¿Qué haces?
a) Lo sigo usando con cuidado hasta que se pueda cambiar
*b) Lo saco de circulación y lo reporto
c) Le digo al residente que camine más despacio
d) Le pongo cinta adhesiva
EXPLICACION: Una contera gastada resbala justo cuando el residente carga su peso sobre ella. El equipo defectuoso se retira y se reporta: "usarlo con cuidado" no cambia la física, y la caída ocurre igual.

P: Vas atrasada y el residente camina lento con su andador. Una compañera te dice que lo lleves del brazo sin el andador para ir más rápido. ¿Qué haces?
*a) Voy a su ritmo, con su andador, aunque tarde más
b) Le quito el andador y lo llevo del brazo, es un trayecto corto
c) Lo llevo en silla de ruedas y así llegamos a tiempo
d) Le pido que apure el paso y me quedo pendiente
EXPLICACION: Caminar es tratamiento: cada día que no camina pierde fuerza que le costará semanas recuperar. Llevarlo en silla "solo por hoy" es como empieza la espiral de menos fuerza, más miedo y más dependencia.

P: Un residente se levantó solo de noche y casi se cae camino al baño. Te dice que no aguantaba más. ¿Qué cambias para el próximo turno?
a) Le digo que aguante hasta que yo pase por su cuarto
b) Le subo las barandas de la cama para que no se levante
*c) Le ofrezco el baño antes de que sea urgencia
d) Anoto que es un residente que no colabora
EXPLICACION: Y le dejo el llamador al alcance de la mano y luz en el camino. El apuro por llegar al baño es uno de los factores más grandes en caídas de noche, y se previene antes de que empiece. Pedirle que aguante no le quita la urgencia: se levanta igual, pero más apurado y a oscuras.

P: Entras al cuarto y encuentras a un residente sentado en el piso al lado de la cama. Está despierto y te dice que está bien. ¿Qué haces primero?
a) Lo levanto entre dos rápido, antes de que se apene
b) Lo levanto y si camina bien no hace falta reportarlo
c) Lo ayudo a sentarse en la cama y espero a ver si más tarde se queja de algo
*d) No lo levanto todavía: verifico si responde y si le duele algo, aviso a supervisión y documento
EXPLICACION: Levantarlo de inmediato puede empeorar una fractura que todavía no se ve, y "se ve bien" no es una evaluación. Toda caída se avisa y se documenta: la caída que no se reporta es la que se vuelve a repetir.
`,
    },
    {
        title: 'Higiene, Piel y Control de Infecciones',
        description: 'Asistir en la higiene con dignidad, reconocer y reportar las señales de la piel, y aplicar precauciones estándar que cortan la cadena de infección.',
        durationMins: 35,
        bonusCompliance: 25,
        emoji: '🧼',
        category: 'Cuidado Geriátrico',
        order: 103,
        targetRole: null,
        content: `---META---
TITULO: Higiene, Piel y Control de Infecciones
PROMPT_ZENDI: Evalúa si el empleado sabe asistir en la higiene preservando la dignidad, reconoce las señales de piel que debe reportar sin tratarlas por su cuenta, y aplica lavado de manos, guantes y precauciones estándar de forma consistente.
TERMINOS_CLAVE: precauciones estándar, lavado de manos, guantes, dignidad, incontinencia, dermatitis, úlcera por presión, puntos de presión, higiene perineal, cadena de infección
PREGUNTA_REFLEXION: Un residente se niega a bañarse por tercer día seguido. ¿Qué haces?

---SECCION_1---
LECTURA:
# El baño es el momento más íntimo del día

Para la persona que estás cuidando, el baño puede ser el momento más humillante de su día: alguien mucho más joven la ve desnuda y la toca. Muchos residentes que "se ponen difíciles" a la hora del baño en realidad están defendiendo lo último que sienten propio.

**Cómo se hace con dignidad:**

- **Toca la puerta y espera.** Aunque esté abierta, aunque tenga demencia
- **Explica antes de cada paso.** "Le voy a lavar la espalda ahora." Nunca destapes ni toques sin avisar
- **Cubre lo que no estás lavando.** Una toalla sobre el resto del cuerpo, siempre
- **Cierra la puerta y la cortina.** Que nadie más entre a mitad del baño
- **No converses de él con otro compañero** mientras lo bañas, como si no estuviera
- **Deja que haga lo que pueda.** Si puede lavarse la cara, que se lave la cara. Cada cosa que hace sola es autonomía que conserva

**El agua:** tíbia, y se comprueba en tu antebrazo antes. La piel del adulto mayor es más delgada y siente menos — un agua que a ti te parece bien puede quemarlo.

**Si se niega:** la negativa casi nunca es sobre el baño. Puede tener frío, sentir dolor, estar avergonzado con esa persona en particular, o simplemente querer decidir algo. Pregunta, ofrece más tarde, ofrece que lo haga otra persona, empieza por lavar solo lo esencial.

**Lo que no se hace: forzar.** Bañar a alguien que se resiste es un forcejeo con riesgo de lesión para los dos, y rompe la confianza para todas las veces siguientes. Si la negativa se repite varios días, se reporta — no se resuelve a la fuerza.

PREGUNTAS:
P: Un residente lleva tres días negándose a bañarse. ¿Qué haces?
a) Lo baño de todas formas, la higiene no es negociable
b) Lo dejo así, es su derecho
*c) Busco la causa, ofrezco alternativas y lo reporto si se repite
d) Le digo que no podrá salir de su cuarto hasta bañarse
EXPLICACION: La negativa suele esconder frío, dolor, vergüenza o necesidad de decidir algo. Forzar produce forcejeo, riesgo de lesión y pérdida de confianza permanente. Buscar la causa resuelve la mayoría de los casos; si persiste, se reporta.

P: ¿Cómo compruebas la temperatura del agua antes de bañar a un residente?
a) Con la mano, como en casa
*b) En el antebrazo, porque su piel siente menos y se quema más fácil
c) Le pregunto a él si está bien
d) Uso siempre la misma posición del grifo
EXPLICACION: La piel del adulto mayor es más delgada y su sensibilidad térmica está disminuida, así que puede quemarse sin retirarse a tiempo. El antebrazo es más sensible que la mano y da una lectura más confiable.

P: Vas a bañar a una residente con demencia avanzada. La puerta del cuarto está abierta y ella casi no habla. ¿Qué haces?
a) Entro directo, con demencia no se entera de esas cosas
*b) Toco la puerta y le aviso que voy a entrar
c) Entro sin tocar, pero cierro la puerta detrás de mí
d) Voy avisando desde el pasillo mientras entro
EXPLICACION: Se toca y se espera un momento antes de entrar. La demencia no le quita la vergüenza ni el susto de que alguien aparezca de pronto sobre ella; tocar es tratarla como persona aunque ya no pueda reclamarlo. Cerrar la puerta protege su privacidad de los demás, pero no de ti entrando sin aviso.

P: Estás dando un baño en cama y vas apurada. ¿Qué haces con las toallas y la ropa de cama?
a) Lo destapo completo, así lavo más rápido y el cuarto está caliente
b) Lo destapo completo pero cierro la puerta, que es lo que de verdad importa
c) Lo dejo tapado y lavo por debajo de la sábana sin mirar
*d) Descubro solo la parte que estoy lavando
EXPLICACION: El resto queda cubierto con una toalla. Estar desnudo delante de alguien mucho más joven es lo que más pesa de ese momento, y cubrir lo que no estás lavando además lo mantiene tibio. Lavar a ciegas por debajo de la sábana es peor todavía: no puedes ver la piel, que es justo lo que tienes que estar revisando.

P: Una residente puede lavarse la cara y los brazos sola, pero tarda y tú tienes cuatro baños pendientes. ¿Qué haces?
*a) La dejo lavarse lo que puede mientras yo asisto en el resto
b) Se lo hago yo todo, rinde el turno y ella queda igual de limpia
c) Le dejo la toalla, la dejo sola y vuelvo cuando termine
d) Le digo que hoy no hay tiempo y que mañana sí
EXPLICACION: Cada cosa que hace sola es capacidad que conserva, y cuando se la quitas por rapidez la va perdiendo de verdad. Dejarla sola tampoco es la salida: te quedas ahí, asistiendo lo que ella no alcanza.

---SECCION_2---
LECTURA:
# Piel: lo que ves y lo que reportas

La piel es el órgano donde primero aparecen los problemas. Y tú, que bañas y cambias al residente, eres quien la ve — la enfermera de home care viene una o dos veces por semana; tú estás ahí todos los días.

**Recuerda el marco:** el hogar no diagnostica ni trata lesiones de piel. La enfermera establece el tratamiento; el hogar **observa, documenta, reporta y ejecuta lo indicado**. Esa distinción no es burocracia: aplicar una crema por tu cuenta sobre una lesión puede empeorarla y borra la evidencia de cómo evolucionó.

**La prueba del dedo.** Presiona la zona enrojecida con el dedo unos segundos y suelta:

- **Se pone blanca y vuelve al rosado** → la circulación responde. Alivia la presión y vigila
- **Sigue roja, no cambia** → la circulación ya está comprometida. **Se reporta**

Esa es la señal más temprana y la más importante que vas a encontrar.

**Los puntos donde el hueso está cerca de la piel** son donde aparece el daño: sacro y coxis, talones, caderas, codos, hombros, orejas, y la parte de atrás de la cabeza en quien pasa mucho tiempo acostado.

**Se reporta siempre:**

- Enrojecimiento que no cede al presionar
- Piel morada u oscura
- Ampollas
- Cualquier piel abierta, por pequeña que sea
- Zonas húmedas o maceradas
- Mal olor
- Piel muy seca, agrietada o descamada
- Cualquier cambio respecto a ayer

**Lo que nunca se hace:** dar masaje sobre una zona enrojecida (aumenta el daño), aplicar cremas o remedios propios, destapar o manipular un apósito que puso la enfermera, ni "esperar a ver si mejora". Lo que se ve, se documenta y se pasa.

PREGUNTAS:
P: Presionas una zona enrojecida en el talón y el color no cambia. ¿Qué significa y qué haces?
a) Es irritación normal del roce, la vigilo mañana
*b) La circulación está comprometida: alivio la presión, documento y reporto
c) Le doy masaje para reactivar la circulación
d) Le aplico crema hidratante y sigo
EXPLICACION: Si el enrojecimiento no cede al presionar, el tejido ya no está recibiendo circulación adecuada. Es la señal más temprana de daño por presión. El masaje empeora el daño y aplicar productos por cuenta propia altera la evolución que la enfermera necesita ver.

P: La enfermera dejó un apósito en una lesión y al bañar al residente notas que está algo despegado. ¿Qué haces?
a) Lo retiro y pongo uno nuevo
b) Lo despego para ver cómo va la lesión y lo vuelvo a poner
*c) No lo manipulo, lo documento y lo reporto
d) Le pongo cinta adhesiva encima
EXPLICACION: El cuidado de heridas lo establece y ejecuta la enfermera. Destapar una lesión rompe la barrera estéril y expone al residente a infección; además pierde la referencia de cómo iba. Lo que corresponde es documentarlo y reportarlo.

P: La hija de un residente te trae una crema y te pide que se la apliques en una zona enrojecida de la espalda. ¿Qué haces?
a) Se la aplico, la familia sabe lo que le funciona a su papá
b) Se la aplico solo hoy, a ver si mejora
*c) No se la aplico: documento la zona y paso la crema al supervisor
d) Le digo a la hija que se la aplique ella y lo dejo así
EXPLICACION: Para que la enfermera decida. El tratamiento de la piel lo establece ella; el hogar observa, documenta y ejecuta lo indicado. Una crema por tu cuenta puede empeorar la lesión y además borra cómo venía evolucionando, que es lo que la enfermera necesita ver en la próxima visita.

P: Un residente pasa casi todo el día acostado boca arriba. Al bañarlo, ¿qué zonas revisas con más cuidado?
*a) Sacro y coxis, talones, codos, hombros, orejas y nuca
b) Solo el sacro, que es donde siempre sale
c) Las rodillas y la parte de adelante de las piernas
d) Las manos y la cara, que es donde mejor se ve el color
EXPLICACION: El daño aparece donde el hueso está cerca de la piel y el peso del cuerpo aplasta el tejido contra el colchón. Acostado boca arriba eso incluye los talones y la parte de atrás de la cabeza, dos zonas que casi nadie mira.

P: Al vestir a un residente ves una mancha morada del tamaño de una peseta en el codo que ayer no estaba. Él dice que no le duele. ¿Qué haces?
a) Como no le duele, la vigilo y la reporto si crece
b) Le doy masaje suave para que se disuelva
c) Le pongo una curita para que no siga rozando
*d) La documento y la reporto hoy mismo, aunque no le duela
EXPLICACION: La piel morada y cualquier cambio respecto a ayer se reportan, duela o no: el dolor no mide el daño y en esta población la sensibilidad suele estar disminuida. El masaje sobre una zona dañada la empeora, y "esperar a ver" es como se pierden los días que importan.

---SECCION_3---
LECTURA:
# Incontinencia y cuidado perineal

El manejo de la incontinencia es donde más dignidad se pierde y donde más piel se daña. Ambas cosas son evitables.

**La orina y las heces dañan la piel rápido.** No es solo la humedad: son químicamente agresivas. Una piel expuesta durante horas se irrita, se abre y se infecta. La dermatitis asociada a incontinencia se ve como enrojecimiento difuso, brillante, en toda la zona del pañal — distinta de la úlcera por presión, que es localizada sobre un hueso.

**El principio es simple: cambio pronto, limpieza suave, secado completo, barrera si está indicada.**

**Al hacer higiene perineal:**

- **Guantes siempre**
- Agua tibia y jabón suave, o toallitas sin alcohol
- **Siempre de adelante hacia atrás**, tanto en mujeres como en hombres — arrastrar bacterias del ano hacia la uretra es la causa principal de infección urinaria
- Un paso, una superficie limpia de la toallita
- **Seca completamente**, sin frotar. Toca suave. Los pliegues, con especial cuidado
- Barrera protectora solo si está indicada en el plan

**El pañal:** no se aprieta ni se dobla. Un pañal ajustado de más corta circulación y marca la piel; uno doblado crea una arruga que presiona. Y no se ponen dos, ni se añade una toalla adentro — atrapa humedad contra la piel.

**Con dignidad:** cubre, avisa, no hagas gestos ni comentarios sobre el olor, y nunca hables del episodio delante de otras personas. Un residente que se avergüenza empieza a esconder que se mojó, y ahí la piel se daña de verdad.

**Se reporta:** orina turbia, con sangre o de olor fuerte; ardor o quejas al orinar; disminución notable de la orina; diarrea; cambio en el patrón habitual; y cualquier piel irritada o abierta en la zona.

PREGUNTAS:
P: ¿En qué dirección se realiza la limpieza perineal y por qué?
*a) De adelante hacia atrás, para no arrastrar bacterias hacia la uretra
b) De atrás hacia adelante, es más cómodo
c) En círculos, para cubrir mejor
d) La dirección no importa si se usa jabón
EXPLICACION: Limpiar hacia atrás evita llevar bacterias intestinales hacia la uretra, que es el mecanismo principal de las infecciones urinarias en residentes con incontinencia. Es un detalle pequeño con un impacto enorme.

P: Al cambiar a una residente ves enrojecimiento brillante y difuso en toda la zona del pañal. ¿Qué es y qué haces?
a) Es una úlcera por presión, alivio la presión de la cadera
*b) Parece dermatitis por incontinencia: lo documento y lo reporto para que la enfermera indique el manejo
c) Le aplico la crema que uso con otros residentes
d) Le dejo el área destapada toda la noche
EXPLICACION: El enrojecimiento difuso y brillante en toda la zona sugiere daño químico por humedad, distinto de la úlcera por presión, que es localizada sobre una prominencia ósea. Distinguirlo importa, pero el manejo lo indica la enfermera — no se aplican productos de otros residentes.

P: Una residente se orina mucho de noche y una compañera te dice que le pongas dos pañales, o una toalla adentro, para que aguante hasta la mañana. ¿Qué haces?
a) Le pongo los dos pañales, así duerme de corrido
*b) Le pongo uno solo y la cambio cuando haga falta
c) Le pongo la toalla adentro, que absorbe y no aprieta
d) Le aprieto bien el pañal para que no se salga nada
EXPLICACION: Y si el patrón de noche cambió, eso se reporta. Doblar capas atrapa la humedad contra la piel, que es justo lo que la irrita y la abre; y un pañal apretado corta circulación y marca. Lo único que resuelve es cambiar a tiempo.

P: Al cambiar a un residente notas la orina turbia y con olor fuerte, y él se queja de ardor al orinar. ¿Qué haces?
a) Le doy más agua y espero a ver si aclara mañana
b) Le aviso a la familia que tiene una infección urinaria
c) Lo anoto en mi libreta y lo comento en el cambio de turno
*d) Lo documento y lo reporto al supervisor ahora mismo
EXPLICACION: Orina turbia, olor fuerte y ardor están en la lista de lo que se reporta enseguida, no al final del turno. Tú describes lo que viste y lo pasas; ponerle nombre a lo que tiene, y más decírselo a la familia, no le toca al cuidador.

P: Encuentras ropa interior mojada escondida en la gaveta de una residente que antes siempre avisaba. ¿Qué haces?
a) Le explico delante de sus compañeras que no debe esconderla, para que no lo repita
b) La boto y no digo nada, para no avergonzarla
*c) La recojo sin comentarios, la cambio con naturalidad y reporto el cambio de conducta
d) Le empiezo a poner pañal desde hoy sin decirle nada
EXPLICACION: Esconder la ropa mojada es vergüenza, y mientras esconda, la piel pasa horas en contacto con orina, que es donde de verdad se daña. Callarlo por bondad tampoco ayuda: el cambio de conducta se reporta para que se revise qué pasó.

---SECCION_4---
LECTURA:
# Control de infecciones: la cadena y cómo se rompe

En un hogar de envejecientes una infección no se queda en una persona. Un solo virus gastrointestinal puede recorrer la facilidad en 48 horas, y los residentes tienen menos defensas para resistirlo.

**Cómo se transmite:** casi todo pasa por **las manos** — las tuyas. De un residente a una superficie, de la superficie a tu guante, de tu guante al próximo residente.

**El lavado de manos es la medida más efectiva que existe.** No es un trámite:

- Al llegar al turno y al irte
- **Antes y después de cada residente** — cada uno, sin excepción
- Antes de guantes y **después de quitártelos**
- Después del baño o de manejar fluidos
- Antes de manipular alimentos o medicamentos
- Después de toser, sonarte o ir al baño

**Cómo:** agua y jabón, frotando **al menos 20 segundos** — palmas, entre los dedos, dorso, pulgares, uñas, muñecas. El gel de alcohol sirve entre contactos, pero **no** cuando las manos están visiblemente sucias ni ante diarrea, donde solo el agua y jabón arrastran el organismo.

**Guantes — el malentendido más común.** Los guantes protegen contra fluidos, pero **no reemplazan el lavado de manos**. Y usar el mismo par entre dos residentes es peor que no usarlos, porque transporta todo con una falsa sensación de limpieza. **Un residente, un par. Una tarea sucia, un par.**

**Precauciones estándar:** se aplican con **todos**, siempre, sin importar si sabes que alguien tiene algo. No sabes lo que aún no se ha diagnosticado.

**Lo demás que rompe la cadena:**

- Uñas cortas, sin postizas
- Sin anillos ni pulseras en el turno
- Ropa de trabajo que se cambia al llegar a casa
- Nada de compartir vasos, toallas, termómetros ni cortaúñas entre residentes
- Ropa sucia en su bolsa, nunca contra tu uniforme
- Superficies de contacto frecuente desinfectadas: barandas, llamadores, manijas, andadores

**Y una que cuesta:** si tienes fiebre, vómitos o diarrea, **no vayas a trabajar**. Repórtalo. Un turno tuyo enfermo puede costar un brote.

PREGUNTAS:
P: Terminas de asistir a un residente con guantes puestos y vas a atender al siguiente. ¿Qué haces?
a) Mantengo los mismos guantes, no toqué nada sucio
b) Me echo gel de alcohol sobre los guantes
*c) Me quito los guantes, me lavo las manos y me pongo un par nuevo
d) Me cambio solo el guante de la mano dominante
EXPLICACION: Los guantes usados transportan microorganismos igual que las manos, con el agravante de la falsa sensación de limpieza. Un residente, un par — y el lavado de manos después de quitárselos es obligatorio, no opcional.

P: Un residente tiene diarrea. ¿Basta con usar gel de alcohol entre contactos?
a) Sí, el gel elimina todo
*b) No: ante diarrea hay que lavarse con agua y jabón, que arrastran el organismo
c) Sí, si uso doble cantidad
d) Solo si no toqué al residente
EXPLICACION: El gel de alcohol no es efectivo contra varios organismos que causan diarrea, entre ellos los que producen brotes en facilidades. El lavado con agua y jabón los arrastra mecánicamente, que es lo único que funciona en ese caso.

P: Una compañera te dice que con doña Carmen no hace falta ponerse guantes para el cambio, porque "ella no tiene nada". ¿Qué haces?
*a) Me pongo guantes igual: las precauciones estándar son con todos, siempre
b) Le hago caso, ella lleva más tiempo y conoce a los residentes
c) Me pongo guantes solo si veo heces
d) Me lavo bien las manos antes y después y así no me hacen falta
EXPLICACION: Las precauciones estándar se aplican con todos porque no sabes lo que todavía no se ha diagnosticado, y el residente que "no tiene nada" muchas veces es el que nadie ha estudiado. Lavarte bien es obligatorio, pero no sustituye la barrera cuando vas a manejar fluidos.

P: Vas corriendo entre dos residentes, te echas jabón, enjuagas cinco segundos y sales. ¿Qué te faltó?
a) Nada, lo importante es que usé jabón
b) Nada, porque después me voy a poner guantes
*c) El tiempo: se frota al menos 20 segundos
d) Echarme gel de alcohol encima para reforzar
EXPLICACION: Veinte segundos, incluyendo entre los dedos, pulgares, uñas y muñecas. El jabón no limpia por contacto: lo que arrastra los microorganismos es la fricción sostenida, y en cinco segundos no da tiempo de llegar a donde más queda. Los guantes encima de unas manos mal lavadas no arreglan nada.

P: Amaneces con vómito y diarrea. El turno está corto de personal y sabes que te van a necesitar. ¿Qué haces?
a) Voy con mascarilla y me lavo las manos más seguido
*b) No voy y lo reporto de una vez
c) Voy pero solo hago limpieza, sin tocar residentes
d) Voy y allá decido según cómo me sienta
EXPLICACION: Reportarlo temprano es lo que les da tiempo de buscar reemplazo. Un virus gastrointestinal puede recorrer la facilidad en 48 horas y los residentes tienen mucho menos con qué resistirlo: un solo turno tuyo enfermo puede costar un brote. La mascarilla no contiene algo que se transmite por las superficies que vas tocando todo el día.

---SECCION_5---
LECTURA:
# El resto del cuidado personal

**Boca.** La higiene bucal es de lo más descuidado y de lo que más consecuencias tiene. Una boca en mal estado duele, quita el apetito, y **las bacterias de la boca aspiradas al pulmón causan neumonía** — una de las principales causas de hospitalización en esta población.

- Cepillado suave dos veces al día, incluidas encías y lengua
- **También a quien usa dentadura postiza**: se limpian las encías igual
- La dentadura se retira de noche, se cepilla y se guarda en agua, **identificada** — una dentadura perdida tarda semanas y cuesta cientos de dólares
- Se reporta: encías sangrantes o inflamadas, llagas, mal aliento persistente, dientes flojos, dentadura que ya no ajusta, dolor al comer

**Pies.** En un adulto mayor, y sobre todo si tiene diabetes, el pie es zona de alto riesgo.

- Se lavan y se **secan bien entre los dedos** — la humedad ahí produce hongos
- Se revisan a diario: heridas, ampollas, uñas encarnadas, enrojecimiento, cambio de color
- **Las uñas de los pies de un residente diabético no las corta el cuidador.** Un corte mínimo puede terminar en una úlcera que no cierra. Se reporta

**Uñas de las manos, cabello, afeitado.** Son cuidado y son dignidad. Un residente bien peinado y afeitado se siente persona; uno descuidado se abandona a sí mismo. No es cosmético — cambia el ánimo y el ánimo cambia el apetito y la movilidad.

**Vestirse.** Deja que escoja la ropa aunque tarde. Empieza por el lado más débil al poner, y por el fuerte al quitar. Ropa cómoda, calzado cerrado con suela que agarre.

**Lo que se reporta de esta sección:** cualquier herida o cambio de color en los pies, uñas encarnadas, problemas de boca, y cualquier resistencia nueva al cuidado personal en alguien que antes lo aceptaba.

PREGUNTAS:
P: Un residente diabético tiene las uñas de los pies largas. ¿Qué haces?
a) Se las corto con cuidado, es parte del cuidado personal
*b) Lo reporto: las uñas de un residente diabético no las corta el cuidador
c) Le pido a la familia que traiga un cortaúñas
d) Se las limo yo para no cortar
EXPLICACION: En un pie diabético la circulación y la sensibilidad están comprometidas: un corte mínimo puede convertirse en una úlcera que no cierra y terminar en una complicación grave. Ese cuidado le corresponde a personal capacitado y se gestiona reportándolo.

P: ¿Por qué la higiene bucal es especialmente importante en el adulto mayor?
a) Solo por estética y aliento
*b) Porque las bacterias de la boca aspiradas al pulmón pueden causar neumonía
c) Porque lo exige el reglamento
d) Porque evita que se caigan los dientes
EXPLICACION: La neumonía por aspiración es una de las principales causas de hospitalización en esta población, y una boca en mal estado multiplica el riesgo. Además el dolor bucal reduce el apetito, lo que arrastra pérdida de peso y debilidad.

P: Al acostar a una residente le retiras la dentadura postiza. ¿Qué haces con ella y con su boca?
a) La envuelvo en una servilleta y la dejo en la mesa de noche
b) La guardo seca en su gaveta y le dejo la boca tranquila hasta mañana
c) Se la dejo puesta de noche, así no se pierde ni se ensucia
*d) La cepillo y la guardo en agua, en su envase
EXPLICACION: Y le cepillo las encías y la lengua. Quien usa dentadura también necesita esa limpieza: ahí siguen las bacterias que, aspiradas al pulmón, terminan en neumonía. Y la dentadura envuelta en servilleta es como más se pierden —van a parar a la basura— y reponerla tarda semanas y cuesta cientos de dólares.

P: Vas a ponerle la camisa a un residente que tiene el brazo izquierdo débil por un derrame. ¿Por dónde empiezas?
a) Por el brazo fuerte, así él ayuda y vamos más rápido
*b) Por el brazo débil, y al quitarla empiezo por el fuerte
c) Por la cabeza primero y después acomodo los dos brazos
d) Da igual el orden, lo importante es no halarle el brazo
EXPLICACION: Metiendo primero el brazo débil la manga ya tiene espacio y no hay que forzar ni estirar esa articulación; al quitar se hace al revés por la misma razón. "Da igual" es justo como se producen los halones que lastiman un hombro.

P: Terminas de lavarle los pies a un residente y andas de prisa. ¿Qué no te puedes saltar?
*a) Secar bien entre los dedos y revisar la piel
b) Echarle talco en vez de secar, que el talco absorbe la humedad
c) Ponerle las medias enseguida para que no coja frío
d) Dejarlos secar al aire mientras atiendo a otro residente
EXPLICACION: Revisar buscando heridas, ampollas o cambio de color. La humedad que queda entre los dedos es donde se forman los hongos, y el pie es la zona donde una herida pequeña pasa desapercibida hasta que se complica. Poner la media sobre un pie húmedo es sellar la humedad adentro.
`,
    },
    {
        title: 'Alimentación, Hidratación y Atragantamiento',
        description: 'Asistir a comer con seguridad, reconocer las señales de disfagia y deshidratación, y actuar correctamente ante un atragantamiento.',
        durationMins: 35,
        bonusCompliance: 25,
        emoji: '🍽️',
        category: 'Cuidado Geriátrico',
        order: 104,
        targetRole: null,
        content: `---META---
TITULO: Alimentación, Hidratación y Atragantamiento
PROMPT_ZENDI: Evalúa si el empleado sabe asistir en la alimentación con seguridad, reconoce las señales de dificultad para tragar y de deshidratación, actúa correctamente ante un atragantamiento, y entiende que la dieta y su consistencia las establece el plan, no su criterio.
TERMINOS_CLAVE: disfagia, aspiración, atragantamiento, consistencia modificada, espesante, deshidratación, posición a 90 grados, Heimlich, dieta indicada, ingesta
PREGUNTA_REFLEXION: Un residente con dieta blanda te pide un pedazo de la carne que están comiendo los demás. Insiste en que puede masticarla bien. ¿Qué haces?

---SECCION_1---
LECTURA:
# Comer es más que nutrición

Para muchos residentes la comida es lo mejor del día: el sabor, la compañía, el momento de conversar. Y para el cuerpo, comer bien es lo que sostiene la fuerza, la piel y las defensas. Un residente que pierde peso pierde también movilidad, cicatrización y resistencia a infecciones.

**Lo que cambia con la edad:**

- **Menos sensación de sed.** El cuerpo deja de avisar. Esta es la razón número uno de deshidratación
- Menos gusto y olfato — la comida sabe a menos, y el apetito baja con ella
- Menos saliva, muchas veces por medicamentos
- Menos apetito por menor actividad
- Problemas de boca: dentadura floja, dientes que duelen, llagas
- Dificultad para tragar

**La dieta la establece el plan de cuidado**, y eso incluye la consistencia. Cuando ves "dieta blanda", "líquidos espesados" o "puré", eso no es una preferencia ni una sugerencia: alguien determinó que esa persona no puede manejar otra cosa con seguridad.

**Dar algo fuera de la dieta indicada, aunque el residente lo pida, puede matarlo.** Suena fuerte porque lo es: la aspiración —comida o líquido que entra al pulmón— es una de las principales causas de neumonía y muerte en esta población. Y ocurre exactamente así: alguien le dio "un pedacito" por complacerlo.

Si el residente reclama la dieta, se reporta para que se reevalúe. No se ajusta en la bandeja.

PREGUNTAS:
P: Un residente con dieta blanda te pide un pedazo de carne del menú regular, insistiendo en que puede masticarla. ¿Qué haces?
a) Se lo doy cortado en trozos pequeños
b) Se lo doy, él conoce su capacidad
*c) Le explico que su dieta la indicó su evaluación y reporto que la está reclamando
d) Le digo que no y no lo menciono a nadie
EXPLICACION: La consistencia de la dieta no es una preferencia: alguien determinó que esa persona no puede manejar otra textura sin riesgo de aspiración. Dar algo fuera de la dieta indicada es una de las formas más frecuentes de causar una neumonía por aspiración. Si la reclama, se reporta para reevaluación.

P: ¿Por qué los adultos mayores se deshidratan con tanta facilidad?
a) Porque toman menos agua a propósito
*b) Porque la sensación de sed disminuye con la edad y el cuerpo deja de avisar
c) Porque sudan más
d) Porque los medicamentos siempre deshidratan
EXPLICACION: El mecanismo de la sed se debilita con la edad, así que la persona puede estar deshidratada sin sentir ninguna necesidad de tomar agua. Por eso el líquido se ofrece de forma activa durante todo el turno, sin esperar a que lo pidan.

P: Una residente dice que la comida "no sabe a nada" y cada día deja más en el plato. ¿Qué está pasando y qué haces?
a) Está exagerando, la comida es la misma de siempre
b) Le echo sal y adobo a su bandeja para que le sepa mejor
c) Le digo que tiene que comer porque le hace falta y ahí lo dejo
*d) Reporto que está comiendo menos, con cuánto deja
EXPLICACION: Con la edad se apagan el gusto y el olfato, y muchos medicamentos resecan la boca: la misma comida sabe a menos y el apetito cae con ella. Condimentarle la bandeja por tu cuenta es cambiarle la dieta a alguien que quizás tiene restricción de sal; lo que sí te toca es dejar constancia de cuánto está comiendo.

P: A una residente le empezó a quedar floja la ropa y bajó de peso. Una compañera dice "mejor, así pesa menos para moverla". ¿Por qué esa idea es peligrosa?
*a) Porque al perder peso pierde fuerza y defensas
b) Porque la familia se va a quejar cuando la vea
c) Porque el peso hay que mantenerlo igual toda la vida
d) Porque descuadra los números del expediente
EXPLICACION: Y porque tarda más en cerrar cualquier herida. Un residente que adelgaza pierde movilidad, cicatriza peor y se infecta más fácil. Bajar de peso sin explicación nunca es una ventaja: es una señal que se reporta.

P: Un residente casi no toca la comida y al preguntarle se queja de que le duele masticar; le notas la dentadura floja. ¿Qué haces?
a) Le quito la dentadura para que coma más cómodo
b) Le paso la comida a puré yo mismo
*c) Lo reporto, con lo que me dijo de la boca
d) Le digo que coma despacio y que se vaya acostumbrando
EXPLICACION: Dientes flojos, llagas y dolor al masticar son una causa común de que dejen de comer sin decir por qué, y eso arrastra pérdida de peso. Cambiarle la consistencia por tu cuenta no te toca: la dieta la establece el plan.

---SECCION_2---
LECTURA:
# Asistir a comer con seguridad

**La posición es lo primero y lo más importante:**

- **Sentado derecho, a 90 grados.** En silla si puede; si está en cama, con la cabecera bien elevada
- **Nunca se alimenta a alguien acostado.** Nunca, por más apurado que sea el turno
- **La cabeza ligeramente hacia adelante**, la barbilla algo bajada. Con la cabeza hacia atrás, la vía respiratoria queda abierta y el alimento entra directo al pulmón
- **Se mantiene sentado 30 minutos después** de comer

**Al asistir:**

- Siéntate **a su altura**, de frente. Alimentar de pie y desde arriba obliga a levantar la cabeza — la peor posición posible
- **Bocados pequeños.** Media cucharada, no cucharada llena
- **Espera a que trague antes del siguiente.** Verifica que la boca quedó vacía
- **No lo apures.** El apuro es el factor de riesgo más común en un atragantamiento
- **Alterna** sólido y líquido
- **No converses con él mientras tiene comida en la boca**, y no le hagas preguntas que lo obliguen a contestar
- Dile qué le estás dando. "Ahora un poco de arroz"

**Deja que haga lo que pueda.** Un residente que puede sostener la cuchara la sostiene, aunque tarde y se ensucie. Cada vez que le quitas la cuchara para ir más rápido, pierde un poco más de independencia.

**Ambiente:** sin TV alta, sin apuro, buena luz. Comer distraído aumenta el riesgo de atragantarse.

**Al terminar, revisa la boca.** Comida guardada en el cachete es señal de dificultad para tragar y se reporta — además puede aspirarla después, ya acostado.

PREGUNTAS:
P: Vas a asistir a comer a un residente encamado. ¿Cuál es la posición correcta?
a) Acostado de lado, para que sea más cómodo
*b) Sentado a 90 grados con la barbilla ligeramente hacia abajo, y así 30 minutos después
c) Semisentado con la cabeza hacia atrás para que pase mejor
d) Como esté, si solo son unas cucharadas
EXPLICACION: Con la cabeza hacia atrás la vía respiratoria queda abierta y la comida entra directo al pulmón. Sentado derecho con la barbilla algo baja se cierra esa vía. Los 30 minutos posteriores evitan que el contenido regrese y se aspire.

P: Al terminar de comer notas que el residente tiene comida acumulada en el cachete. ¿Qué significa?
a) Que come despacio, es normal
*b) Es señal de dificultad para tragar: se limpia la boca y se reporta
c) Que no le gustó la comida
d) Que necesita bocados más grandes
EXPLICACION: La comida retenida indica que el residente no está tragando bien, y ya acostado puede aspirarla. Es una de las señales tempranas de disfagia y se reporta para que se evalúe la consistencia de su dieta.

P: Una residente puede sostener la cuchara, pero tarda y se ensucia. Te faltan cuatro bandejas más. ¿Qué haces?
a) Le quito la cuchara y la alimento yo, que es más rápido
*b) La dejo comer sola y la asisto en lo que no logre
c) La alimento yo hoy y mañana la dejo practicar
d) Le pido que se apure porque tengo más bandejas esperando
EXPLICACION: Cada vez que le quitas la cuchara para ganar tiempo, la residente pierde un poco más de independencia y después ya no la recupera. El atraso del turno no es razón para alimentar a alguien que todavía puede hacerlo.

P: El comedor tiene la televisión a todo volumen y el residente al que asistes se queda mirándola con la comida en la boca. ¿Qué haces?
a) Lo dejo, la televisión lo entretiene y así come más
b) Le hablo y le hago preguntas para que me ponga atención a mí
*c) Bajo la televisión y lo ayudo a enfocarse en la comida
d) Aprovecho que está entretenido para darle los bocados más rápido
EXPLICACION: Comer distraído aumenta el riesgo de atragantarse, porque tragar necesita atención. Hacerle preguntas con la boca llena es igual de riesgoso, porque lo obligas a contestar con comida adentro: la conversación se deja para cuando ya tragó.

P: El turno viene atrasado y una compañera te dice que le des las cucharadas más seguido para terminar antes. ¿Qué le contestas?
a) Que tiene razón, si los bocados son pequeños no pasa nada
b) Que mejor le doy cucharadas llenas para acabar en menos viajes
c) Que le doy agua entre bocado y bocado para que baje más rápido
*d) Que el apuro es el riesgo más común de atragantamiento
EXPLICACION: Media cucharada, esperar a que trague y verificar que la boca quedó vacía es lo que evita que el próximo bocado caiga encima de comida que todavía va en camino. El tiempo que "ahorras" apurando es el que después te cuesta una emergencia.

---SECCION_3---
LECTURA:
# Señales de que algo anda mal al tragar

La **disfagia** —dificultad para tragar— casi nunca aparece de golpe. Da avisos, y quien está en la mesa todos los días es quien los ve.

**Se reporta si observas:**

- **Tos durante o después de comer o beber** — la señal más importante de todas
- Voz "húmeda" o gorgoteo después de tragar
- Carraspera constante en las comidas
- Le toma varios intentos tragar un bocado
- Comida que se queda en la boca
- Babeo o comida que se le sale
- Se queja de que "se le queda atorado"
- Evita ciertas comidas o líquidos que antes tomaba
- Come mucho más lento que antes
- Fiebres repetidas sin causa clara — puede ser aspiración silenciosa

**Aspiración silenciosa:** algunos residentes aspiran sin toser. No hay señal en la mesa; aparece días después como fiebre o neumonía. Por eso las fiebres repetidas en alguien que come con dificultad siempre se reportan juntas con esa observación.

**Los espesantes** se usan porque el líquido delgado es lo que más fácil se cuela a la vía respiratoria — más fácil que la comida sólida. Si un residente tiene líquidos espesados, **todo** líquido va espesado: agua, jugo, café, sopa. No hay excepciones "por esta vez".

**Documenta lo que realmente comió.** "Comió el 50%" o "solo tomó el jugo" no es papeleo: es el dato con el que se detecta una pérdida de peso antes de que sea grave. Un residente que lleva tres días comiendo la mitad es una alerta, pero solo si alguien lo anotó.

**Se reporta también:** rechazo de comida por más de una comida, pérdida de peso visible, ropa que le queda floja, y cualquier queja de dolor al comer.

PREGUNTAS:
P: Un residente tose cada vez que toma agua, pero come sólidos sin problema. ¿Qué haces?
a) Le doy el agua más despacio y no lo reporto
b) Le suspendo el agua hasta que mejore
*c) Lo reporto: la tos con líquidos es señal de disfagia y puede requerir espesantes
d) Le doy el agua con pajilla para que pase más rápido
EXPLICACION: El líquido delgado es lo que más fácil se cuela a la vía respiratoria, por eso muchas personas tosen con agua antes que con sólidos. La tos al beber es la señal más importante de disfagia y quien indica el espesante es la evaluación, no el cuidador.

P: Un residente con líquidos espesados te pide agua normal porque tiene mucha sed. ¿Qué haces?
a) Le doy un vaso pequeño, la sed es real
*b) Le ofrezco agua espesada: la indicación aplica a todo líquido, sin excepciones
c) Le doy agua normal con pajilla
d) Le doy hielo en vez de agua
EXPLICACION: Si tiene líquidos espesados es porque el líquido delgado se le cuela a la vía respiratoria. Eso incluye agua, jugo, café y sopa — y el hielo derretido también. Una sola excepción puede causar una neumonía por aspiración.

P: Un residente come lento y a veces se le queda comida en la boca. En el último mes ha tenido tres fiebres sin resfriado ni causa clara. ¿Qué haces?
a) Espero a ver si la fiebre le vuelve una cuarta vez
*b) Lo reporto junto con lo que ves en la mesa
c) Le paso los líquidos a espesados por mi cuenta
d) Es normal, a los mayores les sube la fiebre sola
EXPLICACION: Puede ser aspiración silenciosa: hay residentes que aspiran sin toser, en la mesa no se ve nada y aparece días después como fiebre o neumonía. Por eso las fiebres repetidas en alguien que come con dificultad se reportan junto con esa observación, no como dos cosas sueltas.

P: Llevas tres días anotando que una residente "comió el 50%". Una compañera te dice que no pierdas tiempo en eso. ¿Por qué sí importa?
a) Por si viene una inspección del Departamento
b) Porque así la cocina ajusta el tamaño de las porciones
*c) Porque tres días comiendo la mitad es una alerta
d) Porque la familia siempre pregunta si comió
EXPLICACION: Una alerta de pérdida de peso — pero solo si alguien lo anotó. El registro de la ingesta es lo que permite ver la caída antes de que se note en la ropa o en la báscula. Sin ese dato, la pérdida se descubre meses más tarde y ya con debilidad encima.

P: Después de cada cucharada de sopa, la voz de un residente suena aguada, como con gorgoteo. Él dice que está bien. ¿Qué haces?
a) Le creo: si no tose, no hay problema
b) Le doy agua para que se le aclare la voz
c) Le pido que carraspee fuerte y sigo dándole
*d) Lo reporto: la voz aguada después de tragar es señal
EXPLICACION: Señal de dificultad para tragar. Ese sonido indica que quedó líquido cerca de la vía respiratoria. Que no tosa no tranquiliza, porque hay quien aspira sin toser: se reporta aunque el residente diga que se siente bien.

---SECCION_4---
LECTURA:
# Atragantamiento: los primeros segundos

Es la emergencia más frecuente en el comedor y la que más depende de que reacciones bien de inmediato.

**Lo primero: distinguir obstrucción parcial de completa.** No es lo mismo y la respuesta es opuesta.

**Obstrucción PARCIAL — la persona tose con fuerza, hace ruido, puede hablar:**

- **NO le des golpes en la espalda**
- **NO le des agua**
- **NO le metas los dedos en la boca**
- **Anímalo a toser.** La tos es el mecanismo más efectivo que existe para expulsar algo
- Quédate al lado, observando
- Si la tos se debilita, se vuelve completa: pasa a lo siguiente

**Obstrucción COMPLETA — no puede toser, no puede hablar, no hace ruido, se agarra el cuello, se pone morado:**

Esto es una emergencia inmediata.

1. **Pide ayuda a gritos.** Que alguien llame al 911 mientras tú actúas
2. **Compresiones abdominales (Heimlich):** párate detrás, rodéalo con los brazos, un puño arriba del ombligo y debajo del esternón, la otra mano encima, y empuja **hacia adentro y hacia arriba** con fuerza
3. **Repite hasta que expulse el objeto o pierda el conocimiento**
4. **Si pierde el conocimiento:** bájalo al piso con cuidado y empieza RCP si estás certificado. Que el 911 ya venga en camino

**En silla de ruedas:** aplica las compresiones desde atrás con los frenos puestos. **Si la persona es muy obesa o está embarazada:** las compresiones van en el pecho, no en el abdomen.

**Después de cualquier atragantamiento, aunque lo resuelva:** se reporta y se documenta. Siempre. Un atragantamiento es aviso de que algo en la dieta o en la técnica necesita revisarse — y muchas veces el próximo es el grave.

**Certificación:** el Heimlich y el RCP se aprenden con práctica presencial, no leyendo. Este módulo te dice qué hacer; la certificación te da la mano entrenada. Si la tuya está vencida, repórtalo.

PREGUNTAS:
P: Un residente empieza a toser con fuerza durante la comida, pero puede hablar. ¿Qué haces?
a) Le doy golpes fuertes en la espalda
b) Le doy agua para que baje
*c) Lo animo a seguir tosiendo y me quedo observando
d) Le meto el dedo en la boca para sacar la comida
EXPLICACION: Si tose con fuerza y puede hablar, la obstrucción es parcial y su propia tos es el mecanismo más efectivo para expulsarla. Los golpes, el agua o meter los dedos pueden empujar el objeto más adentro y convertirla en completa.

P: Un residente se agarra el cuello, no puede hablar ni toser y se está poniendo morado. ¿Qué haces primero?
a) Le doy agua
b) Lo acuesto para revisarle la boca
*c) Pido ayuda a gritos para que llamen al 911 y empiezo compresiones abdominales
d) Espero unos segundos a ver si tose
EXPLICACION: No poder toser ni hablar indica obstrucción completa: sin aire, el daño cerebral empieza en minutos. Se pide ayuda y se actúa simultáneamente con compresiones hacia adentro y hacia arriba, sin esperar.

P: Un residente se atraganta, tose con fuerza, expulsa el pedazo solo y sigue comiendo tranquilo. ¿Qué haces después?
*a) Lo reporto y lo documento, aunque haya terminado bien
b) Nada, se resolvió solo
c) Se lo comento a una compañera por si acaso
d) Lo anoto solamente si le vuelve a pasar
EXPLICACION: Un atragantamiento avisa que hay que revisar la dieta o la técnica con que se le asiste. Muchas veces el leve es el aviso del que viene después, y sin ese reporte nadie revisa nada.

P: Una residente en silla de ruedas no puede hablar ni toser y se está poniendo morada. ¿Cómo aplicas las compresiones?
a) La paso primero a una silla normal para tener mejor agarre
*b) Le pongo los frenos y aplico las compresiones desde atrás
c) La bajo al piso y empiezo RCP enseguida
d) Espero a que llegue alguien con más experiencia
EXPLICACION: Cambiarla de sitio cuesta segundos que no tienes: con los frenos puestos trabajas desde atrás igual que si estuviera de pie, empujando hacia adentro y hacia arriba. El piso y el RCP entran solo si pierde el conocimiento.

P: Un residente estaba tosiendo fuerte y podía hablar. Ahora la tos se le apagó, no hace ruido y se agarra el cuello. ¿Qué pasó y qué haces?
a) Se está calmando: lo dejo descansar un momento
b) Ya pasó lo peor: le doy agua
*c) Pido ayuda a gritos y empiezo compresiones abdominales
d) Le reviso la boca con el dedo para sacarle lo que tenga
EXPLICACION: La obstrucción pasó de parcial a completa. Mientras tose con fuerza, su propia tos trabaja mejor que cualquier cosa que tú hagas; cuando se debilita y deja de hacer ruido es porque ya casi no mueve aire, y ahí cambia todo.

---SECCION_5---
LECTURA:
# Hidratación: el problema invisible

La deshidratación es de los problemas más comunes y más subestimados en un hogar de envejecientes. No se ve, no duele al principio, y termina en confusión, infección urinaria, caída u hospitalización.

**Por qué pasa tan fácil:**

- La sed no avisa
- Muchos residentes **toman menos a propósito** para no ir tanto al baño, o para no tener que pedir ayuda
- Diuréticos y otros medicamentos aumentan la pérdida
- Quien tiene demencia sencillamente no recuerda tomar agua
- Quien tiene disfagia toma menos porque le cuesta
- El calor de Puerto Rico acelera todo lo anterior

**Señales de deshidratación — se reportan:**

- **Orina oscura, concentrada, o mucho menos orina de lo normal** — el indicador más práctico que tienes
- Boca y labios secos, lengua áspera
- **Confusión nueva o más somnolencia** — en el adulto mayor la deshidratación se manifiesta primero en la cabeza
- Piel que al pellizcarla suavemente tarda en volver
- Mareo al levantarse
- Debilidad, dolor de cabeza
- Estreñimiento

**Lo que sí puedes hacer, cada turno:**

- **Ofrecer líquido activamente**, sin esperar a que lo pidan. En cada ronda
- Dejar el vaso **al alcance** y lleno — un vaso lejos es un vaso que no se toma
- Ofrecer lo que le guste: jugo, té frío, gelatina, frutas con agua. No tiene que ser agua
- Respetar el espesante si lo tiene
- **Ofrecer el baño con regularidad**, porque el miedo a no llegar es la razón real por la que muchos dejan de tomar
- Anotar lo que tomó

**En calor o si tiene fiebre, diarrea o vómito, la necesidad sube.** Esos días la hidratación se vigila de cerca y cualquier señal se reporta rápido.

Y recuerda: una confusión nueva en un residente siempre se reporta. Puede ser deshidratación, puede ser una infección urinaria — las dos se tratan si se detectan a tiempo.

PREGUNTAS:
P: Una residente que siempre está orientada hoy amanece confusa y somnolienta, y su orina está muy oscura. ¿Qué haces?
a) La dejo descansar, seguramente durmió mal
*b) Lo reporto de inmediato: puede ser deshidratación o una infección urinaria
c) Le doy mucha agua de golpe y espero
d) Lo anoto para el próximo cambio de turno
EXPLICACION: En el adulto mayor la deshidratación y la infección urinaria se manifiestan primero como confusión, no como sed o ardor. Ambas son tratables si se detectan pronto, y ambas terminan en hospitalización si se dejan pasar un turno más.

P: ¿Cuál es la razón más frecuente por la que un residente toma menos líquido de lo que necesita?
a) Que no le gusta el agua
*b) Que toma menos a propósito para no ir tanto al baño o no tener que pedir ayuda
c) Que ya tomó suficiente
d) Que el vaso es muy pequeño
EXPLICACION: Es un cálculo consciente y muy común: prefieren la sed a la incomodidad de pedir ayuda o al miedo de no llegar a tiempo. Por eso ofrecer el baño con regularidad hace tanto por la hidratación como ofrecer el vaso.

P: Entras al cuarto y el vaso de agua está lleno, pero en la mesa del otro lado, fuera de su alcance. ¿Qué haces?
a) Lo dejo así, está lleno
*b) Se lo acerco y le ofrezco un trago
c) Le digo que me llame cuando tenga sed
d) Anoto que no tomó nada en el turno
EXPLICACION: Un vaso lejos es un vaso que no se toma, y esperar a que lo pidan tampoco sirve: con la edad la sed deja de avisar. El líquido se ofrece activamente en cada ronda, no se deja disponible y ya.

P: Una residente con demencia rechaza el agua durante todo tu turno. ¿Qué puedes hacer?
*a) Ofrecerle lo que sí le guste y anotar lo que tomó
b) Dejarla tranquila, si no quiere no quiere
c) Insistirle con el mismo vaso hasta que se lo tome
d) Reportar que se niega y no volver a ofrecerle en el turno
EXPLICACION: Jugo, té frío, gelatina, fruta con agua: la hidratación no tiene que entrar como agua. Y quien tiene demencia muchas veces no rechaza el líquido, simplemente no recuerda tomarlo, así que se vuelve a ofrecer en cada ronda. Si tiene espesante, todo lo que le ofrezcas va espesado.

P: Un residente amaneció con diarrea y el día está bien caluroso. ¿Qué cambia en tu turno?
a) Nada, la rutina de líquidos es igual todos los días
b) Le doy menos líquido para no empeorarle la diarrea
c) Espero a que pida agua, que es cuando de verdad la necesita
*d) Le ofrezco líquido más seguido y vigilo de cerca
EXPLICACION: Y cualquier señal que aparezca se reporta rápido. Con calor, fiebre, diarrea o vómito la pérdida de líquido sube y la deshidratación llega en horas, no en días. Aguantarle el líquido por la diarrea es justo lo contrario de lo que ese residente necesita.
`,
    },
    {
        title: 'Trato Digno, Derechos y Comunicación',
        description: 'Los derechos del residente en el turno real: privacidad, autonomía, confidencialidad, y la obligación de reportar cualquier sospecha de maltrato.',
        durationMins: 35,
        bonusCompliance: 25,
        emoji: '🤝',
        category: 'Cuidado Geriátrico',
        order: 105,
        targetRole: null,
        content: `---META---
TITULO: Trato Digno, Derechos y Comunicación
PROMPT_ZENDI: Evalúa si el empleado conoce los derechos del residente, se comunica de forma que preserva su dignidad y autonomía, maneja la confidencialidad correctamente, y sabe que está obligado a reportar cualquier sospecha de maltrato aunque involucre a un compañero.
TERMINOS_CLAVE: dignidad, autonomía, derechos del residente, confidencialidad, consentimiento, maltrato, negligencia, reporte obligatorio, infantilización, privacidad
PREGUNTA_REFLEXION: Ves a un compañero hablarle con brusquedad a un residente y halarlo del brazo. Es alguien que te cae bien y que sabes que está pasando por un mal momento. ¿Qué haces?

---SECCION_1---
LECTURA:
# Es su casa, no tu área de trabajo

Un hogar de envejecientes es, antes que nada, **la casa de quien vive ahí**. Tú entras a trabajar; ellos ya están en su casa. Ese cambio de perspectiva ordena casi todo lo demás.

**Los derechos que tiene cada residente, siempre:**

- **A ser tratado con respeto y dignidad**
- **A la privacidad** — de su cuerpo, de su cuarto, de sus cosas, de sus llamadas, de sus visitas
- **A decidir** sobre su cuidado, incluso a negarse a algo
- **A la confidencialidad** de su información médica y personal
- **A sus pertenencias** y a que estén seguras
- **A quejarse** sin miedo a represalias
- **A recibir visitas** y mantener sus relaciones
- **A participar** en su plan de cuidado
- **A no ser sujetado** física ni químicamente por conveniencia del personal
- **A estar libre de maltrato** de cualquier tipo

Estos no son ideales bonitos: son derechos, y violarlos tiene consecuencias legales para la persona que lo hace y para la facilidad.

**Lo que significan en el turno real:**

- Tocar la puerta y **esperar respuesta** antes de entrar
- No revisar sus cosas sin permiso
- No hablar de un residente en el pasillo, ni delante de otro
- No decidir por él lo que él puede decidir
- No apurarlo porque tú vas apurada

**La autonomía se pierde de a poquito.** No con un gesto grande, sino con cien decisiones pequeñas que alguien más tomó por él porque era más rápido: qué ropa, a qué hora, con quién sentarse, qué ver en la TV. Cada decisión que le devuelves es dignidad que conserva.

PREGUNTAS:
P: Un residente se niega a bajar al comedor y quiere comer en su cuarto. ¿Qué haces?
a) Lo bajo igual, la rutina es la rutina
*b) Respeto su decisión, se lo llevo al cuarto y lo documento
c) Le digo que si no baja no come
d) Lo dejo sin comer hasta que cambie de opinión
EXPLICACION: Decidir sobre su cuidado es un derecho, y comer en su cuarto no pone en riesgo a nadie. Se respeta y se documenta. Si la negativa a bajar se vuelve un patrón, eso sí se reporta — puede indicar depresión o un conflicto con otro residente.

P: ¿Qué significa en la práctica el derecho a la privacidad?
a) Que el residente puede cerrar su puerta cuando quiera
*b) Tocar y esperar respuesta antes de entrar, no revisar sus cosas, y no hablar de él delante de otros
c) Que la familia no puede recibir información
d) Que no se documenta lo que ocurre en su cuarto
EXPLICACION: La privacidad no es solo la puerta: incluye su cuerpo durante el cuidado, sus pertenencias, sus conversaciones y su información. Hablar de un residente en el pasillo o delante de otro es una violación tan real como entrar sin tocar.

P: Doña Rosa se tarda escogiendo qué ponerse y tú vas atrasada con la ronda. ¿Qué haces?
a) Escojo yo la ropa, es más rápido y ella no nota la diferencia
b) Le pongo siempre el mismo conjunto para no perder tiempo
*c) Le ofrezco dos o tres opciones y espero a que ella decida
d) Llamo a la familia para que ellos decidan qué se pone
EXPLICACION: Qué ropa se pone es de esas decisiones pequeñas que sostienen su autonomía, y se pierde de a poquito cuando alguien más las toma por rapidez. Ofrecer opciones toma segundos y le devuelve la decisión.

P: El turno está corto de personal y una residente se levanta sola de la silla todo el tiempo. Una compañera sugiere amarrarla a la silla con una sábana mientras terminan. ¿Qué haces?
*a) No se hace, y lo reporto a supervisión
b) Lo hacemos un ratito nada más, mientras acabamos la ronda
c) Lo hacemos si la familia lo autoriza por teléfono
d) Le pido a otra residente que la vigile y me avise si se para
EXPLICACION: Sujetarla por conveniencia del personal viola su derecho. Ningún residente puede ser sujetado física ni químicamente para ahorrarle trabajo al personal, y ninguna autorización de la familia lo cambia. Si el riesgo de caída es real, se reporta para que lo evalúe quien corresponde.

P: Una residente se quejó con el director de que tardas en contestar su llamador. Te toca atenderla el resto del turno. ¿Qué haces?
a) Le digo que por su queja ahora tengo problemas
b) Le pido a una compañera que la atienda ella, yo no
*c) La atiendo igual que siempre: quejarse es su derecho y no puede costarle nada
d) La atiendo, pero de última, para que aprenda a pedir las cosas de otra manera
EXPLICACION: Quejarse sin miedo a represalias es un derecho, y una represalia no es solo un mal gesto: atender de última a propósito también lo es. Si la queja tiene razón, es información para mejorar, no un ataque personal.

---SECCION_2---
LECTURA:
# Cómo se habla

La forma de hablarle a un adulto mayor comunica, antes que cualquier contenido, si lo estás tratando como persona adulta o no.

**La infantilización es el error más común y el menos consciente.** Casi nadie lo hace por mala intención:

- ❌ "Abuelita", "mi amor", "mamita", "papito", "nene"
- ✅ **Su nombre**, como él prefiera que lo llamen. Pregúntaselo
- ❌ "¿Vamos a bañarnos?" cuando el que se baña es él
- ✅ "Le voy a ayudar a bañarse"
- ❌ Voz aguda y cantadita, como con un bebé
- ✅ Tu voz normal, más despacio y más claro si hace falta
- ❌ Hablar de él en tercera persona estando presente: "Ella no come bien"
- ✅ Hablarle a él: "Doña Carmen, ¿hoy no tuvo apetito?"

**Ser viejo no es ser sordo, y ser sordo no es ser bobo.** Si no oye bien:

- Ponte **de frente**, a su altura, con luz en tu cara para que lea tus labios
- Habla **más claro y más despacio**, no más alto — gritar distorsiona
- Baja el ruido de fondo
- Si no entendió, **di la frase de otra manera** en vez de repetir la misma más fuerte
- Verifica que tenga su audífono puesto y con batería

**Si tiene dificultad para hablar** (después de un derrame, por ejemplo): dale tiempo. No completes sus frases. No adivines para ir más rápido. Ofrece sí/no cuando se frustre.

**Y lo que más cuenta y menos toma:** escuchar. Un residente que cuenta la misma historia por quinta vez no está fallando; está buscando conexión. Dos minutos de atención real hacen más por su ánimo que cualquier otra cosa que hagas ese turno.

PREGUNTAS:
P: Una residente tiene dificultad para oír. ¿Cómo te comunicas?
a) Le hablo más alto, casi gritando
*b) De frente, a su altura, más claro y despacio, y reformulo si no entendió
c) Le escribo todo en papel
d) Le hablo a su familiar para que le transmita
EXPLICACION: Gritar distorsiona el sonido y además avergüenza a la persona delante de otros. Ponerte de frente le permite leer los labios, y reformular funciona mucho mejor que repetir la misma frase más fuerte.

P: ¿Por qué no se debe llamar "abuelita" o "mi amor" a un residente?
a) Porque suena poco profesional ante las visitas
*b) Porque lo infantiliza: es una persona adulta con su propio nombre
c) Porque puede confundirlo
d) No hay problema si se dice con cariño
EXPLICACION: La intención suele ser cariñosa, pero el efecto es tratarlo como un niño y no como el adulto que es. Usar su nombre, como él prefiera que lo llamen, es una de las formas más simples y directas de sostener su dignidad.

P: La hija de doña Carmen llega de visita y te pregunta delante de ella cómo ha comido. Doña Carmen está sentada al lado y entiende bien. ¿Cómo respondes?
*a) Me dirijo a doña Carmen: "¿Hoy no tuvo apetito?"
b) Le contesto a la hija: "Ella no come bien últimamente"
c) Le contesto a la hija en voz baja para que doña Carmen no escuche
d) Le digo a la hija que salgamos al pasillo a hablar
EXPLICACION: Se habla CON ella estando presente, no DE ella. Hablar de alguien en tercera persona delante suyo la saca de su propia conversación, aunque nadie lo haga con mala intención. Incluirla es lo que la mantiene como adulta delante de su familia.

P: Don Julio quedó con dificultad para hablar después de un derrame. Le toma mucho armar cada frase y tú llevas la ronda atrasada. ¿Qué haces?
a) Le completo las frases, casi siempre adivino bien lo que quiere decir
b) Le hablo más alto y más despacio, así se le hace más fácil contestar
c) Le pido que me lo escriba en un papel para ir más rápido
*d) Le doy tiempo, sin completarle las frases
EXPLICACION: Y si se frustra, le ofrezco preguntas de sí o no. Adivinar o completar le quita la poca conversación que le queda, y muchas veces lo que adivinaste no era lo que iba a decir. El sí/no es la salida cuando se frustra, no el punto de partida.

P: Doña Ana te cuenta por quinta vez esta semana la misma historia de su boda. ¿Qué haces?
a) Le recuerdo con cariño que ya me la contó, para orientarla
b) La escucho a medias mientras sigo con lo mío, total ya me la sé
*c) La escucho dos minutos con atención: lo que busca es conexión, no contar algo nuevo
d) Le cambio el tema a algo del día de hoy para que no se quede pegada
EXPLICACION: Repetir una historia no es una falla que haya que corregir, es una manera de buscar compañía. Corregirla o desviarle el tema la deja con la sensación de estorbar, y dos minutos de atención real le cambian el ánimo del turno.

---SECCION_3---
LECTURA:
# Confidencialidad

Todo lo que sabes de un residente por trabajar aquí es información protegida: su diagnóstico, sus medicamentos, su situación familiar, su dinero, lo que te contó en confianza, incluso el hecho de que vive aquí.

**Dónde se rompe en la vida real** — casi nunca por maldad:

- Comentar un caso **en el pasillo, el comedor o el elevador**, donde otros escuchan
- Contarlo en casa "sin nombres" — en un pueblo pequeño, los detalles bastan
- **Publicar en redes sociales.** Una foto en el fondo, un comentario sobre "una residente que hoy...", una historia de Instagram desde el trabajo. Esto es despido y consecuencia legal, no un regaño
- Dejar el expediente o la pantalla abierta a la vista
- Darle información a un familiar por teléfono **sin verificar quién es**
- Hablarlo con un residente sobre otro

**Con la familia:** no toda la familia tiene derecho a toda la información. Solo el contacto autorizado. Y aun a él, la información clínica la da la enfermera o el director — tú puedes contarle del día: si comió, si durmió, si participó, si estaba de buen ánimo.

**Nunca:** fotos de residentes sin autorización escrita, ni siquiera para un grupo de la facilidad. Ni siquiera "porque se veía linda en la actividad".

**Lo que sí se comparte, y debe compartirse:** lo que otro cuidador necesita saber para cuidarlo bien, en el relevo de turno y en la documentación. Confidencialidad no es esconder información del equipo — es no sacarla del equipo.

**Regla práctica:** si estás por decir algo sobre un residente, pregúntate si él estaría cómodo escuchándolo, y si quien te escucha necesita saberlo para cuidarlo. Si alguna respuesta es no, no lo digas.

PREGUNTAS:
P: Llama alguien diciendo ser hijo de una residente y pide saber cómo sigue. ¿Qué haces?
a) Le doy la información, es de la familia
*b) No doy información: verifico si es el contacto autorizado y refiero al director o la enfermera
c) Le doy solo el diagnóstico, no los medicamentos
d) Le pido que llame más tarde
EXPLICACION: Por teléfono no puedes verificar quién llama, y no toda la familia tiene derecho a toda la información — solo el contacto autorizado. La información clínica además la da la enfermera o el director, no el cuidador.

P: Tomaste una foto en una actividad donde salen varios residentes sonriendo. ¿Qué puedes hacer con ella?
a) Publicarla, se ven contentos y es buena publicidad
b) Compartirla solo en el grupo de WhatsApp del personal
*c) Nada sin autorización escrita: no se publican ni se comparten fotos de residentes
d) Publicarla si no se ven las caras claramente
EXPLICACION: Las imágenes de residentes son información protegida y requieren autorización escrita, incluso para uso interno. Compartirlas en un grupo de personal las saca del control de la facilidad y es motivo de despido y consecuencia legal.

P: En el relevo te preguntan por qué doña Luz estuvo llorosa todo el día y qué la calma. Piensas que eso es algo privado de ella. ¿Qué haces?
a) No lo digo, es información confidencial de la residente
*b) Lo cuento en el relevo: el próximo turno lo necesita para cuidarla bien
c) Se lo cuento aparte solo a la compañera con la que tengo más confianza
d) Lo escribo en un papel y se lo entrego a la familia
EXPLICACION: Confidencialidad no es esconderle información al equipo, es no sacarla del equipo. Callar en el relevo lo que el próximo turno necesita saber no protege a la residente, la deja peor cuidada.

P: Llegas a casa y le cuentas a tu pareja lo que pasó hoy con "una residente", sin decir el nombre. ¿Está bien?
a) Sí, mientras no digas nombres no hay problema
b) Sí, porque tu pareja no trabaja en el hogar
*c) No: en un pueblo pequeño los detalles bastan para saber de quién hablas
d) Solo si lo que cuentas es algo bonito, como que se puso contenta en la actividad
EXPLICACION: Quitar el nombre no esconde a nadie cuando el pueblo es chiquito y la facilidad es una sola: la edad, el cuarto o la anécdota alcanzan para identificarla. La regla práctica es preguntarte si ella estaría cómoda escuchándote.

P: Una residente te pregunta por qué se llevaron al hospital a su vecina de cuarto. ¿Qué le dices?
a) Le cuento lo que pasó, viven juntas y se preocupa de verdad
b) Le doy una versión suavizada, sin mencionar el diagnóstico
c) Le pregunto a otra compañera delante de ella qué fue lo que pasó
*d) No doy detalles de otra residente: la escucho
EXPLICACION: Y le digo que la enfermera o la familia informarán lo que corresponda. La información de una residente no se comparte con otra, aunque sean vecinas y la preocupación sea genuina: lo que necesita es que alguien la escuche, no el expediente de la vecina.

---SECCION_4---
LECTURA:
# Maltrato: reconocerlo y reportarlo

Esta es la sección más incómoda del curso y la más importante. **Tú eres, por ley y por posición, quien puede detenerlo.**

**El maltrato no es solo golpear:**

- **Físico** — golpear, empujar, sujetar sin indicación, forzar el cuidado, manejar el cuerpo con brusquedad
- **Verbal y emocional** — gritar, insultar, amenazar, humillar, burlarse, ignorar a propósito, aislar como castigo
- **Negligencia** — dejar sin comida, sin líquido, sin cambiar, sin atender el llamador, sin asistencia para moverse. **Es la forma más común y la más silenciosa**
- **Financiero** — quedarse con dinero o pertenencias, hacer que firme algo, "prestado" que no se devuelve
- **Sexual** — cualquier contacto de esa naturaleza, sin excepción

**Señales que debes reportar:**

- Moretones, quemaduras o marcas sin explicación clara, o en lugares poco usuales
- Miedo, silencio o tensión al acercarse una persona específica
- Cambio brusco de conducta, retraimiento nuevo
- Pérdida de peso, deshidratación o piel deteriorada sin causa
- Higiene descuidada de forma sostenida
- Dinero o cosas que desaparecen
- Un residente que dice que lo maltrataron — **siempre se toma en serio**, aunque tenga demencia

**Tu obligación de reportar:**

Reportar **no es opcional** y **no depende de estar seguro**. No tienes que investigar, ni confirmar, ni decidir si fue grave. Tu trabajo es **reportar lo que viste**, con hechos y sin interpretar.

**Reportas aunque:**

- Sea un compañero que aprecias
- Sea alguien con más rango que tú
- No estés seguro de lo que viste
- Temas que se moleste contigo

**No reportar te hace responsable.** El silencio es lo que permite que el maltrato continúe — casi siempre hay varias personas que vieron algo y ninguna habló.

**Y protégete de acusaciones injustas:** trabaja siempre de forma que puedas explicar lo que hiciste. Documenta. Pide un segundo par de manos cuando el cuidado sea íntimo o el residente esté resistente. La buena documentación te protege a ti también.

PREGUNTAS:
P: Ves a un compañero que aprecias hablarle con brusquedad a un residente y halarlo del brazo. ¿Qué haces?
a) Hablo con él en privado y lo dejo ahí, todos tenemos días malos
b) No digo nada, no estoy seguro de lo que vi
c) Se lo comento a otros compañeros a ver qué opinan
*d) Lo reporto a supervisión describiendo lo que vi, sin interpretar
EXPLICACION: Reportar no es opcional ni depende de estar seguro: tu trabajo es describir lo que viste y que lo evalúe quien corresponde. Manejarlo entre compañeros o callarlo es lo que permite que se repita — y no reportar te hace responsable.

P: Una residente con demencia dice que alguien del personal le pegó. ¿Qué haces?
a) No le hago caso, su demencia la hace confundir cosas
b) Le pregunto a los compañeros del turno si es verdad
*c) Lo reporto de inmediato: un señalamiento de maltrato siempre se toma en serio
d) Espero a ver si lo repite otro día
EXPLICACION: Tener demencia no invalida un señalamiento de maltrato — precisamente las personas con demencia son las más vulnerables y las menos creídas. Reportarlo no acusa a nadie: activa que lo evalúe quien corresponde.

P: Notas que en el turno de una compañera el llamador de don Pedro suena largo rato y ella dice "ese llama por to'". ¿Qué es eso?
a) Una manera de organizarse, hay que priorizar a los más graves
b) Un problema de actitud de ella, pero no llega a ser maltrato
c) Un problema de falta de personal, no es responsabilidad de ella
*d) Negligencia: dejar de atender el llamador es maltrato
EXPLICACION: Y es la forma más común y silenciosa, porque no deja marcas: es dejar a alguien sin comida, sin líquido, sin cambiar o sin atender el llamador. Se reporta igual que un golpe.

P: Una residente te cuenta que le prestó $200 a un empleado hace dos meses y no se los ha devuelto. ¿Qué haces?
*a) Lo reporto: quedarse con dinero de un residente es maltrato financiero
b) Le digo al empleado que se los devuelva y lo dejo ahí
c) No me meto, fue un acuerdo entre ellos dos
d) Le aconsejo que no le preste más dinero a nadie del personal
EXPLICACION: Un "préstamo" que no vuelve es maltrato financiero, aunque ella lo haya ofrecido: la relación de dependencia hace que no sea un trato entre iguales. No te toca investigarlo ni cobrarlo, te toca reportarlo.

P: Ves un moretón grande en el brazo de una residente y nadie sabe explicarlo. Tú sospechas de alguien del turno de noche. ¿Qué pones en el reporte?
a) Que sospechas de esa persona, para que investiguen por ahí
*b) Lo que viste: dónde está, de qué tamaño y qué dijo ella
c) Espero unos días a ver si aparecen más moretones antes de reportar
d) Le pregunto primero al turno de noche y reporto solo si la explicación no cuadra
EXPLICACION: Y cuándo lo notaste. Tu reporte son hechos observables, no conclusiones, porque quien evalúa necesita el dato limpio. Poner tu sospecha por escrito puede dañar a alguien inocente y desviar la investigación hacia donde tú apuntaste.

---SECCION_5---
LECTURA:
# Lo que sostiene el trato digno todos los días

Nadie maltrata a un residente en su primer día. El trato se deteriora por desgaste, por prisa y por costumbre. Reconocer eso a tiempo es parte del oficio.

**Lo que erosiona el trato:**

- **La prisa.** Cuando vas corriendo, dejas de tocar la puerta, dejas de explicar, dejas de esperar. La prisa es la puerta de entrada
- **La costumbre.** Ver el cuerpo de alguien todos los días hace que dejes de pedir permiso
- **El agotamiento propio.** Un cuidador quemado tiene menos paciencia, y lo paga el residente
- **El grupo.** Si en tu turno se normaliza hablar con desprecio de un residente, cuesta mucho ser el que no lo hace

**Cuídate para poder cuidar.** No es un consejo de bienestar: un cuidador agotado comete más errores y trata peor. Si estás llegando al límite, dilo. Es información operativa, no una queja.

**Cuando el residente es difícil.** Algunos insultan, escupen, pegan. A veces por demencia, a veces por dolor, a veces porque siempre fueron así. Tienes derecho a no ser agredido:

- Retírate y respira. No respondas en el momento
- Pide relevo con esa persona si lo necesitas
- **Reporta la agresión.** No la aguantes en silencio
- Lo que no haces: responder igual, castigar con indiferencia, o tomártelo como algo personal

**Al final del turno, el relevo también es trato digno.** Pasar bien la información —qué comió, cómo durmió, qué le molestó, qué funciona con él— es lo que hace que el próximo turno lo trate como persona conocida y no como una cama.

**Lo que siempre se reporta:** cualquier sospecha de maltrato o negligencia, cualquier agresión que recibas, un residente que se queja de trato, y un compañero que veas al límite. Reportar a tiempo protege al residente y también protege a tu compañero.

PREGUNTAS:
P: Un residente te insulta y te escupe mientras lo asistes. ¿Qué haces?
a) Le respondo con firmeza para que entienda que no se hace
b) Lo dejo sin asistir el resto del turno
*c) Me retiro, me calmo, pido relevo si lo necesito y reporto la agresión
d) Lo aguanto en silencio, es parte del trabajo
EXPLICACION: Tienes derecho a no ser agredido, y aguantarlo en silencio desgasta hasta que el trato se deteriora. Retirarte evita responder en caliente; reportarlo permite que se evalúe la causa —dolor, demencia, un medicamento— en vez de que se repita cada turno.

P: ¿Cuál es el factor que más frecuentemente erosiona el trato digno en un turno?
a) La mala intención del personal
*b) La prisa: cuando vas corriendo dejas de tocar, de explicar y de esperar
c) La falta de reglas escritas
d) El tamaño de la facilidad
EXPLICACION: El maltrato rara vez empieza con mala intención. Empieza con prisa y costumbre: se deja de tocar la puerta, se deja de avisar antes de destapar, se deja de esperar la respuesta. Reconocerlo a tiempo es lo que evita que se normalice.

P: Llevas ocho meses bañando a don Tomás todos los días. Ya no le avisas antes de destaparlo ni le explicas lo que vas a hacer, porque él ya se lo sabe. ¿Qué está pasando?
*a) La costumbre te hizo dejar de pedir permiso
b) Nada, ya hay confianza y explicarle lo mismo a diario lo aburre
c) Está bien mientras él no se queje
d) Está bien porque es un cuidado de rutina, no un procedimiento
EXPLICACION: Hay que volver a avisar y explicar cada vez. Ver el cuerpo de alguien todos los días hace que dejes de pedir permiso sin darte cuenta, y él puede callarse justamente por no ser problema. Que no se queje no es lo mismo que haber consentido.

P: En tu turno se volvió normal hacer chistes de doña Elena y decirle "la loca esa" entre el personal. Ella no los oye. ¿Qué haces?
a) Me río para no quedar mal con el grupo, pero yo no lo digo
b) Nada: si ella no lo oye, no le hace daño
c) Le aviso a doña Elena que se cuide de ese grupo
*d) No participo y lo reporto
EXPLICACION: Cuando hablar con desprecio se normaliza en un turno, el trato termina siguiendo. Lo que se dice del residente a sus espaldas es el ensayo de cómo se le va a tratar de frente, y burlarse ya es maltrato verbal. Reírse sin decirlo también sostiene la costumbre.

P: Llevas tres semanas doblando turnos, no estás durmiendo y hoy le contestaste seco a dos residentes. ¿Qué haces?
*a) Lo digo a supervisión antes de que se me note más
b) Aguanto, porque pedir alivio se ve como que no puedes con el trabajo
c) Me controlo mejor con los residentes y ya, el cansancio es asunto mío
d) Espero a que pase el mes, siempre se calma solo
EXPLICACION: Estar llegando al límite es información operativa, no una queja. Un cuidador agotado comete más errores y trata peor, y quien lo paga es el residente. Decirlo a tiempo permite ajustar el turno; aguantarlo callada es justo como empieza a deteriorarse el trato.
`,
    },
    {
        title: 'Emergencias: Los Primeros Minutos',
        description: 'Reconocer, proteger, activar la ayuda y documentar: caídas, derrame, dolor de pecho, convulsiones y qué entregar cuando llegan los paramédicos.',
        durationMins: 40,
        bonusCompliance: 30,
        emoji: '🚑',
        category: 'Cuidado Geriátrico',
        order: 106,
        targetRole: null,
        content: `---META---
TITULO: Emergencias: Los Primeros Minutos
PROMPT_ZENDI: Evalúa si el empleado sabe reconocer una emergencia real, actuar en los primeros minutos sin salirse de su rol, cuándo llamar al 911 sin pedir permiso, y qué información entregar cuando llegue la ayuda.
TERMINOS_CLAVE: 911, cadena de emergencia, caída, derrame cerebral, dolor de pecho, convulsión, cambio de estado mental, signos vitales, escalamiento, documentación
PREGUNTA_REFLEXION: Encuentras a un residente en el piso, consciente pero confundido. No sabes cuánto tiempo lleva ahí. ¿Cuáles son tus primeros tres pasos?

---SECCION_1---
LECTURA:
# Tu rol en una emergencia

En una emergencia el hogar no diagnostica ni trata: **reconoce, protege, activa la ayuda y documenta**. Ese es tu papel completo, y hacerlo bien salva vidas.

Lo que sí decides tú, y no necesita permiso de nadie: **llamar al 911 cuando hay una emergencia real**. Nunca esperes autorización para eso. Nadie va a sancionarte por activar el 911 ante una señal de alarma; el problema es siempre el contrario.

**El orden que aplica en toda emergencia:**

1. **Mantén la calma.** Tu tono baja o sube el pánico de todos, incluido el residente
2. **Verifica que la escena sea segura** para ti — no puedes ayudar si te lesionas
3. **Verifica si responde.** Llámalo por su nombre, tócale el hombro
4. **Pide ayuda a gritos.** Nunca manejes una emergencia sola si hay alguien más
5. **Llama al 911** si aplica, o que alguien llame mientras tú atiendes
6. **No muevas al residente** salvo que esté en peligro donde está
7. **Quédate con él.** No lo dejes solo
8. **Avisa a supervisión**
9. **Documenta** todo con hora exacta

**Llama al 911 sin pensarlo dos veces si hay:**

- No responde, o no respira normalmente
- Dificultad respiratoria evidente
- Dolor de pecho
- Señales de derrame cerebral
- Sangrado que no se detiene
- Convulsión, sobre todo si es la primera o dura más de 5 minutos
- Caída con golpe en la cabeza, o sospecha de fractura
- Quemadura grande
- Cambio brusco e inexplicable del estado mental
- Cualquier situación donde dudes — **la duda se resuelve llamando**

**Lo que nunca haces:** dar medicamentos por tu cuenta "para el dolor", dar de comer o beber a alguien alterado, ni esperar "a ver si se le pasa" ante una de esas señales.

PREGUNTAS:
P: Un residente presenta una señal que podría ser grave, pero no estás seguro y tu supervisor no contesta. ¿Qué haces?
a) Espero a localizar al supervisor antes de decidir
*b) Llamo al 911: la duda se resuelve llamando, no esperando
c) Lo observo 30 minutos a ver si mejora
d) Le pregunto a un compañero qué opina
EXPLICACION: Activar el 911 ante una emergencia real no requiere autorización de nadie. El costo de una llamada de más es cero; el de esperar puede ser la vida del residente. Se llama y después se avisa a supervisión.

P: ¿Cuál es tu rol en una emergencia dentro del hogar?
a) Diagnosticar qué le pasa para informarlo bien
*b) Reconocer, proteger, activar la ayuda y documentar
c) Aplicar el tratamiento que corresponda hasta que llegue ayuda
d) Esperar instrucciones antes de hacer nada
EXPLICACION: El hogar no diagnostica ni trata. Reconocer la señal, proteger al residente, activar la ayuda y documentar es el rol completo — y hacerlo rápido y bien es lo que determina el resultado.

P: Un residente se golpeó y se queja de dolor fuerte mientras esperas la ayuda. En su gaveta está la pastilla que él toma para el dolor. ¿Qué haces?
a) Se la doy, es de él y es justo para eso
b) Le doy agua y algo de comer para que se distraiga del dolor
*c) No le doy nada, me quedo con él y reporto el dolor
d) Llamo a la familia para que me autorice a dársela
EXPLICACION: Con la hora exacta, que es lo que de verdad le sirve a quien llegue. Dar medicamentos por tu cuenta "para el dolor" queda fuera de tu rol aunque el frasco sea del residente: puede tapar una señal o chocar con lo que ya toma, y ningún permiso de la familia cambia eso.

P: Oyes un golpe en el baño y encuentras a una residente en el piso, con agua y jabón regados por todo el suelo. ¿Qué haces primero?
a) Entro corriendo, cada segundo cuenta
*b) Miro el piso y entro con cuidado
c) Limpio el agua primero para que nadie más resbale
d) Llamo al supervisor desde la puerta y espero ahí
EXPLICACION: Si me caigo yo, nadie la ayuda. Verificar que la escena sea segura protege a los dos y toma segundos, no minutos: una cuidadora en el piso convierte una emergencia en dos. Limpiar primero o quedarte en la puerta sí la deja sola en el suelo.

P: Un residente se desploma en el pasillo. Está consciente pero no puede levantarse y hay visitas mirando. Tu compañera dice de llevarlo al cuarto para que no lo vean así. ¿Qué haces?
a) Entre las dos lo cargamos al cuarto, ahí va a estar más cómodo
b) Lo sentamos en una silla ahí mismo mientras llega la ayuda
c) Lo muevo yo sola mientras ella busca el expediente
*d) No lo movemos: pedimos que despejen el pasillo
EXPLICACION: Lo cubrimos y activamos la ayuda ahí donde está. Después de un desplome no se mueve a nadie salvo que corra peligro en ese sitio, porque mover empeora una lesión que todavía no ves. La privacidad se resuelve despejando el área, no cargando al residente.

---SECCION_2---
LECTURA:
# Caídas

La emergencia más frecuente. Lo que hagas en el primer minuto importa más de lo que parece.

**Encuentras a un residente en el piso. NO lo levantes.**

Levantar a alguien que puede tener una fractura de cadera o una lesión de columna convierte un problema en uno mucho peor. Y es el impulso natural de todo el mundo — por eso hay que decirlo explícito.

**Los pasos:**

1. **Quédate con él.** Pide ayuda a gritos
2. **¿Responde?** Si no responde o no respira normal → **911 inmediato**
3. **Pregúntale qué pasó y qué le duele**, sin moverlo
4. **Mira sin mover:** ¿alguna pierna se ve más corta o girada hacia afuera? Eso sugiere fractura de cadera → **911, no lo muevas**
5. **¿Se golpeó la cabeza?** ¿O no sabes si se la golpeó? → **911**. Un golpe en la cabeza puede sangrar por dentro durante horas sin señal visible, y es mucho más peligroso en quien toma anticoagulantes
6. **Si no hay señal de lesión** y él puede moverse solo: que se levante **con calma, por sus propios medios**, con dos personas asistiendo y una silla al lado. Nunca halándolo del brazo
7. **Cúbrelo** — el piso enfría rápido
8. **Avisa a supervisión y documenta**

**Se documenta siempre**, aunque se levante como si nada: hora, dónde estaba, en qué posición lo encontraste, si hubo testigos, qué dijo, qué observaste, qué hiciste. Y si no viste la caída, se escribe **"encontrado en el piso"** — no "se cayó". No inventes lo que no viste.

**Después de una caída, vigila las siguientes 24-48 horas:** dolor nuevo, confusión, somnolencia inusual, vómito, dificultad para caminar o cargar peso. Cualquiera de esas se reporta de inmediato.

**Toda caída se reporta.** La caída que no se reporta es la que se repite, porque nadie revisó qué la causó.

PREGUNTAS:
P: Encuentras a un residente en el piso, consciente, que dice estar bien y quiere levantarse. No sabes si se golpeó la cabeza. ¿Qué haces?
a) Lo ayudo a levantarse, él sabe cómo se siente
*b) No lo muevo y llamo al 911: un posible golpe en la cabeza requiere evaluación
c) Lo levanto y lo observo el resto del turno
d) Lo dejo levantarse solo y lo documento
EXPLICACION: Un golpe en la cabeza puede producir un sangrado interno que tarda horas en dar señales, y el riesgo se multiplica si el residente toma anticoagulantes. Cuando no sabes si se golpeó, se asume que sí y se evalúa.

P: No presenciaste la caída. ¿Cómo lo documentas?
a) "Se cayó mientras caminaba al baño"
*b) "Encontrado en el piso" con la hora, la posición y lo que observé
c) "Se resbaló, probablemente por el piso mojado"
d) Lo dejo sin documentar porque no lo vi
EXPLICACION: Documentar lo que no viste como si lo hubieras visto compromete la investigación y tu credibilidad. Se escribe exactamente lo observado — encontrado en el piso, en qué posición, a qué hora — y lo que el residente dijo entre comillas.

P: Encuentras a una residente en el piso, despierta, diciendo que le duele mucho la cadera. Ves que una pierna se ve más corta y girada hacia afuera. ¿Qué haces?
*a) No la muevo, llamo al 911, la cubro y me quedo con ella
b) Le acomodo la pierna en su posición normal para que esté cómoda
c) Entre dos la sentamos en la silla de ruedas y la llevamos al cuarto
d) Le pongo una almohada debajo y espero al supervisor para decidir
EXPLICACION: Pierna más corta y girada hacia afuera sugiere fractura de cadera. Acomodarla o sentarla mueve los fragmentos y agranda el daño; lo único que toca es no moverla, cubrirla —el piso enfría rápido—, llamar al 911 y quedarte al lado.

P: Ayer una residente se cayó, se levantó sin problema y todo quedó documentado. Hoy, en tu turno, está más dormida que de costumbre y vomitó una vez. ¿Qué haces?
a) Es normal, el susto de ayer la dejó cansada
b) Lo anoto y lo comento en el cambio de turno
*c) Lo reporto ya, sin esperar al cambio de turno
d) La dejo dormir y la reviso al final del turno
EXPLICACION: Somnolencia inusual y vómito después de una caída pueden ser un sangrado en la cabeza que tardó horas en dar la cara. Por eso la vigilancia dura 24 a 48 horas y el hallazgo se reporta al momento.

P: Un residente se resbaló al sentarse. No se golpeó la cabeza, no le duele nada, no ves nada raro y quiere pararse. ¿Cómo lo levantas?
a) Lo halo del brazo hacia arriba, es lo más rápido
*b) Con otra persona y una silla al lado, que se levante solo
c) Lo cargo yo sola por debajo de las axilas
d) Lo dejo que se las arregle solo mientras voy a buscar ayuda
EXPLICACION: Con calma y por sus propios medios. Halarlo del brazo o cargarlo por las axilas puede dislocarle un hombro y además te lesiona a ti. Y la caída se documenta y se reporta igual, aunque se haya parado como si nada.

---SECCION_3---
LECTURA:
# Derrame cerebral, dolor de pecho y dificultad para respirar

Las tres emergencias donde **cada minuto cuenta literalmente**.

## Derrame cerebral — la prueba RÁPIDO

Un derrame se trata con medicamentos que solo funcionan dentro de las primeras horas. Reconocerlo temprano es la diferencia entre recuperarse y quedar con secuela permanente.

- **R**ostro — pídele que sonría. ¿Un lado se queda caído?
- **A**rmas (brazos) — que levante los dos. ¿Uno se cae o no sube?
- **P**alabra — que repita una frase. ¿Arrastra, confunde palabras, no puede hablar?
- **I**mprevisto — visión borrosa de golpe, mareo intenso, pérdida de equilibrio
- **DO**lor de cabeza súbito y muy fuerte, distinto a cualquier otro

**Una sola de estas señales basta para llamar al 911.** Y anota **la hora exacta en que lo viste normal por última vez** — es el dato que el hospital necesita para decidir el tratamiento, y muchas veces solo tú lo tienes.

No le des nada de comer ni beber: si tiene el tragado afectado, lo aspira.

## Dolor de pecho

**Siempre se trata como emergencia cardíaca hasta que se demuestre lo contrario.**

Señales: dolor u opresión en el pecho, dolor que se corre al brazo, cuello, mandíbula o espalda, sudor frío, náusea, falta de aire, palidez, angustia intensa.

**En adultos mayores, y especialmente en mujeres y en personas con diabetes, el infarto puede no doler.** Puede presentarse como debilidad súbita, falta de aire, náusea o sudor frío sin dolor alguno.

Qué haces: **911 de inmediato**, siéntalo cómodo y semisentado, afloja la ropa, mantenlo tranquilo, no lo dejes caminar y **no le des nada** — ni agua, ni aspirina, ni medicamento de otro residente.

## Dificultad para respirar

Señales: respiración rápida o muy trabajosa, labios o uñas azulados, no puede completar una oración, se agarra el pecho, ruidos al respirar, angustia.

Qué haces: **911**, **siéntalo derecho** (nunca acostado), afloja la ropa, ventila el cuarto, quédate con él y háblale con calma — el pánico empeora la falta de aire. Oxígeno solo si está indicado en su plan y sabes usarlo.

PREGUNTAS:
P: Una residente sonríe con un lado de la cara caído y arrastra las palabras. ¿Qué haces?
a) La acuesto a descansar y la vigilo
*b) Llamo al 911 y anoto la hora en que la vi normal por última vez
c) Le doy agua y espero a ver si se recupera
d) Llamo primero a la familia
EXPLICACION: Es la prueba RÁPIDO positiva y una sola señal basta para activar el 911. El tratamiento del derrame depende de una ventana de horas, y la hora en que se la vio normal por última vez es el dato con el que el hospital decide qué puede hacer.

P: Un residente se queja de opresión en el pecho que se le corre al brazo, con sudor frío. ¿Qué haces?
a) Le doy una aspirina y lo acuesto
*b) Llamo al 911, lo siento semisentado, aflojo su ropa y no le doy nada
c) Le doy agua y lo llevo caminando a su cuarto
d) Espero 15 minutos a ver si el dolor cede
EXPLICACION: Todo dolor de pecho se maneja como emergencia cardíaca. Caminar aumenta la demanda del corazón y dar cualquier medicamento por cuenta propia —incluida la aspirina— está fuera del rol del cuidador y puede ser peligroso según lo que ya tome.

P: Doña Luz, de 84 años, de momento se pone pálida, con sudor frío, náusea y falta de aire. Te repite que el pecho no le duele nada. ¿Qué haces?
a) Como no le duele el pecho, la acuesto a descansar y la vigilo
b) Le doy agua fría y la siento a que se le pase la náusea
c) Espero un rato: si empieza el dolor de pecho, llamo
*d) Llamo al 911, la dejo semisentada y no le doy nada por boca
EXPLICACION: En adultos mayores el infarto muchas veces no duele: se presenta como debilidad, falta de aire, náusea o sudor frío. Esperar a que aparezca el dolor de pecho para llamar es justo lo que quema la ventana en que todavía se puede hacer algo.

P: Un residente respira rápido y trabajoso, no puede terminar una oración y tiene los labios azulados. ¿Qué haces mientras llega el 911?
*a) Lo siento derecho, le aflojo la ropa y me quedo con él
b) Lo acuesto en la cama para que descanse y no se agite
c) Le pongo el oxígeno del residente de al lado, total es oxígeno
d) Le doy agua y lo dejo tranquilo solo
EXPLICACION: Ventilando el cuarto y hablándole con calma. Acostado se respira peor; derecho, el pecho se expande mejor. El oxígeno se usa solo si está indicado en su plan y sabes manejarlo, nunca prestado de otro residente, y quedarte hablándole baja el pánico, que empeora la falta de aire.

P: Esperas la ambulancia por una residente con señales de derrame. Habla enredado y te pide agua porque tiene la boca seca. ¿Qué haces?
a) Le doy sorbitos pequeños, total es agua
b) Le doy un pedacito de hielo para la boca seca
*c) No le doy nada por boca
d) Le doy su pastilla de la presión, que además es su hora
EXPLICACION: Y le explico con calma por qué no puedo. En un derrame el tragado puede quedar afectado y cualquier cosa por boca —agua, hielo o una pastilla— se le va a los pulmones. Explicárselo es parte de mantenerla tranquila hasta que llegue la ayuda.

---SECCION_4---
LECTURA:
# Convulsiones, azúcar y cambios de estado mental

## Convulsión

Ver una convulsión asusta, y el instinto lleva a hacer justo lo que no se debe.

**Qué haces:**

- **Protégelo del entorno:** retira lo que tenga cerca, pon algo suave bajo la cabeza
- **Afloja la ropa** del cuello
- **Anota la hora en que empezó** — la duración decide todo lo demás
- Cuando termine, **ponlo de lado** para que no aspire saliva o vómito
- **Quédate con él.** Después queda confuso y agotado: háblale con calma, oriéntalo
- **Documenta** cómo empezó, qué partes del cuerpo, cuánto duró, cómo quedó

**Qué NUNCA haces:**

- **No lo sujetes** ni intentes detener los movimientos
- **No le metas nada en la boca.** Nada. Es imposible que se trague la lengua, y meter un objeto rompe dientes y provoca aspiración
- No le des agua ni medicamentos durante o justo después

**Llama al 911 si:** es la primera convulsión, dura más de 5 minutos, viene otra seguida, no recupera la conciencia, se lesionó, o tiene dificultad para respirar después.

## Azúcar baja

Frecuente en residentes con diabetes, sobre todo si comieron poco. Señales: sudor frío, temblor, debilidad súbita, confusión, irritabilidad nueva, palidez, hambre intensa, mareo.

Qué haces: **si está consciente y traga bien**, dale de inmediato algo dulce de absorción rápida — jugo, refresco regular, azúcar — según lo indicado en su plan, y **repórtalo**. **Si está inconsciente o no traga, no le des nada por boca: 911.** Dar líquido a alguien que no puede tragar lo hace aspirar.

## Cambio de estado mental

Repito esto porque es lo que más se pasa por alto: **una confusión nueva es una emergencia hasta que se demuestre lo contrario.**

Un residente que ayer estaba orientado y hoy no reconoce el lugar, o que está anormalmente somnoliento, agitado o no responde como siempre, puede tener una infección urinaria, deshidratación, azúcar baja, un derrame o una reacción a un medicamento. Todas se tratan si se detectan a tiempo.

**Nunca lo atribuyas a "que ya está mayor" ni a "que su demencia avanzó".** Se reporta el mismo turno.

PREGUNTAS:
P: Un residente está convulsionando en el piso. ¿Qué haces?
a) Lo sujeto para que no se lastime con los movimientos
b) Le pongo algo en la boca para que no se trague la lengua
*c) Retiro objetos, protejo su cabeza, anoto la hora y lo pongo de lado al terminar
d) Lo siento en una silla y le doy agua
EXPLICACION: Sujetar produce fracturas y no detiene la convulsión. Meter un objeto en la boca rompe dientes y provoca aspiración — tragarse la lengua es imposible. Lo correcto es proteger el entorno, cronometrar y girarlo de lado al terminar.

P: Un residente diabético está sudoroso, tembloroso y confuso, pero consciente y traga bien. ¿Qué haces?
a) Lo acuesto a descansar y lo vigilo
*b) Le doy algo dulce de absorción rápida según su plan y lo reporto
c) Le doy agua y espero
d) No le doy nada y espero al supervisor
EXPLICACION: Son señales clásicas de azúcar baja, que se corrige en minutos con azúcar de absorción rápida si la persona está consciente y traga. Si estuviera inconsciente o sin poder tragar, no se le da nada por boca: se llama al 911.

P: Doña Ana siempre está orientada. Hoy no sabe dónde está y anda más dormida que de costumbre. Tu compañera te dice que "ya la demencia le avanzó". ¿Qué haces?
a) Le hago caso, a esa edad es lo más probable
*b) Lo reporto en el mismo turno
c) Lo anoto y espero a mañana a ver si sigue igual
d) Le doy café y comida a ver si reacciona
EXPLICACION: Una confusión nueva es emergencia hasta que se demuestre lo contrario. Detrás casi siempre hay algo que se trata: infección de orina, deshidratación, azúcar baja, un derrame o una reacción a un medicamento. Achacarla a la edad o a la demencia es lo que hace perder el tiempo en que todavía se podía resolver.

P: Un residente diabético está muy somnoliento, casi no te responde y no traga bien. ¿Qué haces?
a) Le doy jugo con cuchara, poquito a poquito
b) Lo acuesto de lado y espero a que despierte solo
c) Espero al supervisor para que él decida
*d) No le doy nada por boca y llamo al 911
EXPLICACION: Dar líquido a quien no puede tragar lo hace aspirar y le suma una neumonía a la emergencia. El azúcar por boca es solo para quien está consciente y traga bien; si no traga o no responde, es 911 de una vez.

P: Un residente con historial de convulsiones lleva casi seis minutos convulsionando. Tu compañera dice que no llames, que a él le pasa y se le quita. ¿Qué haces?
*a) Llamo al 911: ya pasó de cinco minutos
b) Espero, ella lleva más tiempo aquí y lo conoce
c) Le doy su medicamento de convulsiones por mi cuenta
d) Lo sujeto fuerte para que paren los movimientos
EXPLICACION: Tener diagnóstico no cambia el límite: pasados los cinco minutos se llama, igual que si es la primera, si viene otra seguida o si no recupera la conciencia. Y ni sujetarlo ni medicarlo por tu cuenta está en tus manos: sujetar fractura y no detiene nada.

---SECCION_5---
LECTURA:
# Cuando llega la ayuda, y lo que queda después

**Prepara la información antes de que lleguen.** Los paramédicos tienen minutos y cada dato que no tengan lo tienen que adivinar.

Ten listo:

- **Nombre y edad**
- **Qué pasó y a qué hora exacta.** Sé preciso: "a las 2:15 lo encontré en el piso"
- **Cómo lo encontraste** y qué has hecho desde entonces
- **Sus condiciones médicas** y su **lista de medicamentos** — sobre todo si toma anticoagulantes
- **Alergias**
- **Su nivel habitual**: si camina solo, si está orientado normalmente. Sin eso, los paramédicos no pueden saber qué es cambio y qué es su base
- **Signos vitales** si los tomaste, con la hora
- Directrices anticipadas si las tiene

**Al llamar al 911:** di la dirección exacta y clara, qué pasa, si respira y si responde. **No cuelgues hasta que te lo digan** — te van a guiar mientras llega la ambulancia.

**Después de la emergencia:**

1. **Documenta de inmediato**, mientras está fresco. Hora exacta de cada cosa, qué observaste, qué hiciste, quién estuvo, qué dijo el residente entre comillas
2. **Hechos, no interpretaciones.** "Encontrado en el piso, decúbito lateral derecho, refiere dolor en cadera izquierda" — no "se cayó porque estaba mareado"
3. **A la familia la notifica quien corresponde**, no tú por tu cuenta
4. **Atiende a los otros residentes.** Vieron todo y quedan asustados; explícales con calma que hay ayuda
5. **Y atiéndete tú.** Manejar una emergencia deja el cuerpo temblando y la cabeza dando vueltas. No es debilidad, es normal. Si te quedaste mal, dilo

**Antes de que pase algo, hoy mismo, revisa que sepas:**

- Dónde está el botiquín y el desfibrilador si hay
- Dónde está la lista de contactos de emergencia
- Cuál es la ruta de evacuación
- Dónde están los expedientes y las listas de medicamentos
- Si tu certificación de RCP está vigente

Buscar eso durante la emergencia es tiempo que no tienes.

PREGUNTAS:
P: Llegan los paramédicos por un residente que encontraste en el piso. ¿Qué información es la más importante que puedes darles?
a) Mi opinión de lo que probablemente le pasó
*b) La hora exacta, cómo lo encontré, sus condiciones, medicamentos —sobre todo anticoagulantes— y su nivel habitual
c) El nombre del supervisor de turno
d) El historial completo de su expediente
EXPLICACION: Los paramédicos necesitan hechos con hora y una referencia de su estado normal, porque sin saber su nivel habitual no pueden distinguir qué es un cambio. Los anticoagulantes cambian el manejo de cualquier golpe y son de los datos más críticos.

P: ¿Cómo documentas después de una emergencia?
a) Al final del turno, con un resumen general
*b) De inmediato, con horas exactas y hechos observados, sin interpretar causas
c) Solo si el residente resultó lesionado
d) Con mi conclusión de qué provocó el episodio
EXPLICACION: La memoria se distorsiona en minutos, y la documentación es lo que protege al residente, a la facilidad y a ti. Se escriben hechos con hora —lo observado y lo dicho entre comillas— no la causa que uno supone.

P: Llamaste al 911, diste la dirección y te dicen que la ambulancia va en camino. Todavía te falta avisar a supervisión y buscar la lista de medicamentos. ¿Qué haces?
a) Cuelgo y llamo al supervisor, que es lo próximo en el orden
b) Cuelgo y voy por la lista de medicamentos para tenerla lista
*c) Me quedo en la línea hasta que me digan que cuelgue
d) Cuelgo y voy a abrir la entrada para esperarlos afuera
EXPLICACION: Y pido que otra persona haga lo demás. El 911 te va guiando mientras llega la ambulancia, y esa guía puede ser lo que cambie el resultado. Avisar, buscar papeles y abrir la puerta lo hace otro; si estás sola, se lo dices a quien está en la línea.

P: Mientras esperas la ambulancia, la hija de la residente te llama al celular y te pregunta qué está pasando. ¿Qué haces?
*a) Le digo que enseguida la llama quien corresponde
b) Le cuento todo lo que vi y lo que yo creo que pasó
c) Le digo que no pasa nada, para que no se asuste
d) Le mando una foto por texto para que vea cómo está
EXPLICACION: Y sigo con la residente, que es donde tengo que estar. A la familia la notifica quien corresponde, con información completa y verificada, no tú desde el pasillo y a medias. Ni minimizar ni adelantar conclusiones.

P: Llevas dos semanas en el hogar y nunca has visto dónde está el botiquín ni la lista de contactos de emergencia. Hasta ahora no ha pasado nada. ¿Qué haces?
a) Lo busco el día que haga falta, siempre hay alguien que sabe
*b) Pregunto hoy mismo dónde está todo eso
c) Se lo dejo al supervisor, que es quien maneja las emergencias
d) Lo apunto en mis pendientes para cuando tenga tiempo
EXPLICACION: Y cuál es la ruta de evacuación. Buscar el botiquín, los contactos o los expedientes en plena emergencia es tiempo que no tienes: eso se revisa en un día tranquilo —junto con si tu certificación de RCP está vigente— precisamente porque no sabes qué turno te va a tocar.
`,
    },
    {
        title: 'Continuidad del Plan de Cuidado',
        description: 'Tu documentación es lo que el servicio externo lee para decidir: la cadena de escalamiento, los estados del eMAR, y por dónde entra de verdad un cambio de orden.',
        durationMins: 35,
        bonusCompliance: 25,
        emoji: '🔗',
        // Capa B: la continuidad con el servicio externo. Aprobada por la
        // enfermera del hogar el 21-ago-2026 tras dos vueltas de revisión.
        category: 'Cuidado Geriátrico',
        order: 107,
        targetRole: null,
        content: `---META---
TITULO: Continuidad del Plan de Cuidado
PROMPT_ZENDI: Evalúa si el empleado entiende que su documentación es lo que el servicio externo usa para decidir, conoce la cadena de escalamiento del hogar, usa correctamente los estados del eMAR, y sabe que ningún cambio de orden entra por un familiar.
TERMINOS_CLAVE: continuidad, servicio externo, enfermera del hogar, supervisor de turno, eMAR, rechazado, no administrado, escalamiento, relevo de turno, canal de orden
PREGUNTA_REFLEXION: Un familiar te dice que el médico indicó suspender un medicamento. ¿Qué haces antes de la próxima dosis?

---SECCION_1---
LECTURA:
# Tu documentación es lo que él lee

El servicio externo —home care, hospicio, médico primario, especialistas, terapias— no está aquí todos los días. El resto del tiempo, **lo que sabe del residente es lo que tú escribiste**.

Eso cambia el peso de la documentación. No es papeleo: es el instrumento con el que se decide. Si documentas que un residente rechazó su medicamento tres veces esta semana, se puede cambiar la presentación o el horario. Si no lo documentas, para quien lee ese residente está tomando su tratamiento completo — y va a seguir así.

**Dentro del hogar hay dos eslabones más**, y saber cuál te toca evita la mitad de los errores:

- **El supervisor de turno** — a quien le reportas lo que ves
- **La enfermera del hogar** — quien recibe del supervisor, decide si hace falta consulta y coordina con el servicio externo

**La cadena completa:**

1. El **servicio externo** evalúa y establece el plan
2. El hogar **ejecuta** exactamente lo indicado
3. El **cuidador documenta** lo que pasó, incluido lo que no se pudo hacer
4. El **cuidador escala al supervisor de turno**
5. El **supervisor lo pasa a la enfermera del hogar**
6. La **enfermera del hogar** coordina la consulta con el servicio externo
7. El **servicio externo ajusta** con lo que el hogar documentó

**Nunca saltes eslabones.** Un cuidador no llama al médico: reporta al supervisor. Y tampoco se queda con la información esperando a ver si mejora.

**Lo que NO decide el hogar, nunca:** qué medicamento se da y en qué dosis, cambiar un horario, suspender una dosis, qué tratamiento lleva una herida, si una lesión es una úlcera y en qué etapa, cuándo se cambia un apósito, o si alguien necesita ir al hospital.

**Lo que sí es tuyo, y nadie más lo puede hacer:** observar todos los días, ejecutar el plan como está escrito, documentar con precisión y a tiempo, escalar sin demora, y decir cuando algo no se pudo hacer.

PREGUNTAS:
P: Notas que un residente lleva tres días comiendo la mitad. ¿Por qué importa escribirlo?
a) Porque lo exige el reglamento del hogar
*b) Porque el servicio externo no está aquí a diario: decide con lo que el hogar documentó
c) Porque así queda constancia de que hiciste tu turno
d) Porque la familia puede pedir el expediente
EXPLICACION: El servicio externo viene una o dos veces por semana. Lo que sabe del residente el resto del tiempo es exactamente lo que el hogar escribió. Un cambio no documentado no existe para quien tiene que decidir.

P: Ves algo que te preocupa en un residente. ¿A quién se lo dices primero?
a) Directamente al médico o al servicio externo
b) A la familia, que es quien paga
*c) Al supervisor de turno, que lo pasa a la enfermera del hogar
d) Lo anoto y espero a que alguien lo lea
EXPLICACION: La cadena del hogar es cuidador → supervisor de turno → enfermera del hogar → servicio externo. Saltar eslabones hacia arriba deja al hogar sin saber lo que pasa, y anotarlo sin avisar retrasa la respuesta.

P: Una residente se negó a la ducha y al final del turno no se hizo. ¿Qué haces?
a) Lo dejo para mañana, por un día no pasa nada
b) Lo marco como hecho para que no le afecte al reporte del turno
*c) Documento que no se pudo hacer y por qué
d) Se lo comento a la compañera que entra y ella verá
EXPLICACION: Y se lo digo al supervisor de turno. Decir cuando algo no se pudo hacer es parte de tu trabajo, no una falta que haya que esconder. Si el expediente dice que la ducha se dio, nadie se entera de que esa residente lleva días negándose, y detrás de eso puede haber dolor, piel o miedo.

P: Encuentras una lesión en el talón de un residente. Una compañera con años aquí te dice que es una úlcera etapa 2 y que le pongas cierta crema. ¿Qué haces?
a) Le pongo la crema, ella tiene más experiencia que yo
b) Espero unos días a ver si empeora antes de mover a nadie
c) Anoto "úlcera etapa 2" en el expediente y sigo con mi turno
*d) Describo lo que veo sin ponerle etapa, y lo escalo
EXPLICACION: Al supervisor de turno, el mismo día. Decir si una lesión es úlcera, en qué etapa está y qué tratamiento lleva no lo decide el hogar, ni aunque quien lo diga lleve años trabajando.

P: Un residente lleva dos días más callado y caminando menos. Piensas esperar unos días a ver si se compone antes de decir algo. ¿Qué tiene de malo?
a) Nada, observar primero antes de reportar es lo correcto
*b) Que guardarte la información retrasa la respuesta
c) Que en un caso así deberías llamar tú mismo al médico primario
d) Que primero hay que avisarle a la familia y después al hogar
EXPLICACION: Se documenta y se escala aunque no sepas la causa. Tu trabajo es observar, documentar y escalar, no confirmar por tu cuenta si el cambio es importante antes de decirlo. Quien decide si hace falta consulta es la enfermera del hogar, y no puede decidir con información que se quedó contigo.

---SECCION_2---
LECTURA:
# eMAR: los estados y qué significa cada uno

En Zendity cada medicamento programado tiene un estado. **Elegir el correcto no es un detalle de sistema: es lo que la enfermera va a leer.**

- **PENDIENTE** — aún no llega la hora
- **ADMINISTRADO** — se dio y el residente lo tomó
- **RECHAZADO** — el residente se negó
- **OMITIDO** — no se dio por una razón documentada
- **NO ADMINISTRADO** — pasó la hora y no se dio. Es una falla de continuidad

**"Retenido" no se usa en este hogar.** Existe en el sistema porque en otros sitios se marca cuando hay una instrucción previa de no dar un medicamento bajo cierta condición. Aquí no hay ninguna cargada, y **nadie retiene un medicamento por criterio propio**.

Si piensas que un medicamento no se debe dar —porque el residente se ve mal, porque acaba de vomitar, por lo que sea— eso **no lo decides tú**: se lo dices al supervisor de turno **antes de la hora**, no después.

**La distinción que más importa: rechazado no es lo mismo que no administrado.**

- **Rechazado** = el residente ejerció su derecho a negarse. Tú hiciste tu parte
- **No administrado** = nadie se lo ofreció. Es una falla

Marcar "no administrado" cuando en realidad lo rechazó esconde un dato clínico importante — que esa persona está rechazando su tratamiento. Y marcar "rechazado" cuando en realidad se olvidó es falsear el expediente.

**Si un residente rechaza:** no insistas ni lo escondas en la comida. Averigua por qué —sabor, dolor al tragar, desconfianza, ya se sentía mal—, ofrécelo otra vez un poco después, **márcalo como rechazado con la razón en tus palabras**, y repórtalo. Un rechazo repetido cambia el plan.

**Si se pasó la hora:** no lo des tarde por tu cuenta. Repórtalo de inmediato y documenta con la verdad. Un medicamento dado fuera de horario puede ser peor que uno no dado, y esa decisión no es del cuidador.

PREGUNTAS:
P: Un residente se niega a tomar su medicamento después de ofrecérselo dos veces. ¿Qué marcas?
a) No administrado, porque al final no se lo tomó
*b) Rechazado, con la razón escrita en tus palabras
c) Omitido, para no perjudicar al residente
d) Retenido, porque se retuvo la dosis
EXPLICACION: Rechazado significa que el residente ejerció su derecho y tú hiciste tu parte. Marcarlo como no administrado esconde un dato clínico —que está rechazando su tratamiento— y además te atribuye una falla que no cometiste.

P: Piensas que un medicamento no se le debe dar a un residente porque se ve mal. ¿Qué haces?
*a) Se lo digo al supervisor de turno antes de la hora
b) Lo marco como retenido y sigo
c) Se lo doy igual, la orden es la orden
d) Espero al próximo turno para que decidan ellos
EXPLICACION: Retener una dosis por criterio propio no es una opción del cuidador, y "retenido" no se usa en este hogar. La duda se plantea antes de la hora, para que decida quien corresponde y aún se esté a tiempo.

P: Una residente escupe la pastilla. Una compañera te sugiere machacarla y ponérsela en el puré para que no se dé cuenta. ¿Qué haces?
*a) No se esconde en la comida: la marco como rechazada, con la razón
b) Se la escondo en el puré, lo importante es que tome su tratamiento
c) Insisto hasta que se la tome, para eso está indicada
d) La marco como no administrada y sigo con el resto
EXPLICACION: Y averiguo por qué la rechaza para ofrecérsela otra vez más tarde. Esconder el medicamento en la comida engaña a la residente y además borra el dato clínico del rechazo. Un rechazo que se repite es justo lo que hace que se cambie la presentación o el horario, pero solo si queda escrito.

P: Entras al turno y ves que la dosis de las 8:00 am quedó sin darse. Ya son las 10:30. ¿Qué haces?
a) Se la doy ahora, mejor tarde que nunca
b) La marco como omitida y sigo con mi turno
c) La dejo pasar y espero la dosis de la tarde sin decir nada
*d) Lo reporto al supervisor y lo documento como no administrado
EXPLICACION: Que es lo que pasó. Dar un medicamento fuera de horario puede ser peor que no darlo, y esa decisión no es del cuidador. "No administrado" es incómodo porque señala una falla de continuidad, y por eso mismo es el dato que la enfermera necesita ver.

P: Una compañera te pide que marques como "rechazada" una dosis que en realidad se le pasó, para que no le cuenten la falla. ¿Qué haces?
a) Lo hago, el residente no sufrió ningún daño
b) La marco como omitida, que suena más suave
*c) No lo hago: eso falsea el expediente
d) La marco como retenida, así no queda como culpa de nadie
EXPLICACION: "Rechazado" dice que el residente se negó: si nadie se lo ofreció, esa palabra le inventa una conducta al residente y le esconde a la enfermera una falla real. El expediente es un documento clínico, no un registro de desempeño.

---SECCION_3---
LECTURA:
# Órdenes y cambios: por dónde entran de verdad

**Un cambio en el plan de cuidado llega por un canal, no por conversación.**

El riesgo más común y más real: alguien de la familia dice *"la enfermera dijo que ya no le den esa pastilla"*, o trae un frasco nuevo y pide que se lo den.

**Ningún cambio de medicamento entra por un familiar.** Ni por teléfono, ni verbal, ni con el frasco en la mano. Ningún medicamento nuevo se administra sin estar en el plan y en el sistema.

Esto no es desconfianza hacia la familia. Es que suelen tener información incompleta o desactualizada, y el residente es quien paga el error.

**Si la familia trae medicamentos:**

1. **Se reciben.** No se rechazan ni se devuelven en la puerta
2. **Se llevan a enfermería** y se guardan ahí, no en la habitación
3. **Se identifican debidamente** — nombre del residente en el envase
4. **Se notifica al supervisor de turno**, o se pasa a enfermería por Zendity
5. **No se administran** hasta que estén en el plan

**Cómo entra un cambio de verdad:**

1. Lo que hayas oído, **se lo dices verbalmente al supervisor de turno**
2. El supervisor lo comunica a la **enfermera del hogar**
3. Ella decide y, si hace falta, **lleva al residente a consulta con el servicio externo**
4. El cambio vuelve al plan y **aparece en el sistema**
5. Desde ahí, y solo desde ahí, se ejecuta

**Si no está en el sistema, no se da.** Ese es el resumen de toda la sección.

Un residente que se niega a todo su tratamiento no es un problema de disciplina: es un cambio clínico, y se reporta.

PREGUNTAS:
P: Un familiar trae un frasco de medicamento nuevo y pide que se lo den a su mamá. ¿Qué haces?
a) Se lo devuelvo y le explico que no se aceptan medicamentos
b) Lo guardo en la habitación de la residente por si acaso
*c) Lo recibo, lo llevo a enfermería identificado y aviso al supervisor de turno
d) Se lo administro, la familia sabe lo que su mamá necesita
EXPLICACION: El medicamento se recibe —no se rechaza en la puerta— pero va a enfermería, identificado y bajo aviso al supervisor. No se administra hasta estar en el plan y en el sistema, porque la familia suele tener información incompleta.

P: Un familiar te asegura que el doctor suspendió una pastilla. ¿Qué pasa con la próxima dosis?
*a) Se administra según el plan, y se lo digo verbalmente al supervisor de turno
b) Se suspende, el doctor manda más que el sistema
c) Se suspende solo si el familiar lo pone por escrito
d) Se decide en el relevo del próximo turno
EXPLICACION: Un cambio de orden no entra por un familiar. Mientras el plan diga que se administra, se administra — y en paralelo se escala al supervisor para que la enfermera del hogar lo verifique con el servicio externo.

P: Una hija se molesta porque no le dieron a su mamá el medicamento que ella trajo, y te pregunta si es que no confían en ella. ¿Qué le contestas?
*a) Que no es desconfianza: ningún medicamento se da hasta estar en el plan
b) Que la regla es así y que vaya a hablar con la administración
c) Que si trae la receta escrita se lo damos hoy mismo
d) Que ella misma se lo puede dar cuando venga de visita
EXPLICACION: Y que ya se pasó a enfermería para que lo revisen. La familia muchas veces tiene información incompleta o vieja, y quien paga el error es el residente. Tampoco basta una receta en mano: el cambio pasa por la enfermera del hogar y el servicio externo, y se ejecuta cuando aparece en el sistema.

P: Te dicen que ya se aprobó un medicamento nuevo para un residente, pero cuando abres el eMAR no aparece. ¿Se lo das?
a) Sí, si ya se aprobó el sistema se actualizará después
*b) No: no se administra hasta que esté en el sistema
c) Sí, siempre que el frasco tenga el nombre del residente
d) Espero al próximo turno a ver si aparece, sin decir nada
EXPLICACION: Y lo hablo con el supervisor de turno. El cambio se ejecuta desde que está en el plan y en el sistema, no desde que alguien dice que ya se aprobó. Esperar callado tampoco resuelve: hay que avisar para que se corrija antes de la próxima dosis.

P: Una residente lleva una semana negándose a todo su tratamiento. Una compañera dice que es necia y que hay que ponerle límites. ¿Cómo lo ves?
a) Tiene razón, esto se arregla con firmeza
b) Hay que llamar a la familia para que la convenza
*c) Negarse a todo el tratamiento es un cambio clínico
d) Se le mezcla en la comida hasta que se le pase la etapa
EXPLICACION: Se documenta y se reporta. Cuando alguien rechaza todo su tratamiento, el rechazo mismo es el dato: puede haber dolor, náusea, desconfianza o algo que cambió. Tratarlo como conducta que hay que corregir borra el motivo y retrasa la respuesta.

---SECCION_4---
LECTURA:
# Escalar: qué se reporta ya y qué espera

No todo tiene la misma urgencia, y tratarlo todo igual es tan malo como no reportar. **Si todo es urgente, nada lo es.**

**AHORA MISMO — se interrumpe lo que estés haciendo:**

- No responde, respira con dificultad, dolor de pecho
- Señales de derrame cerebral
- Caída, sobre todo con golpe en la cabeza
- Sangrado que no se detiene
- Convulsión
- **Confusión que aparece de golpe** en alguien que estaba orientado
- Fiebre alta
- Atragantamiento
- Cualquier cosa que te haga dudar

**EL MISMO TURNO — se reporta antes de irte:**

- Rechazo de medicamento
- Rechazo de comida o de líquido
- Piel enrojecida que no cede al presionar, o cualquier piel abierta
- Dolor nuevo o que aumentó
- Cambio de conducta
- Orina de olor fuerte, turbia o con sangre
- Diarrea o vómito
- Menos movilidad que ayer

**EN EL RELEVO — se pasa al próximo turno:**

- Cómo durmió, cómo comió
- Estado de ánimo y actividades
- Cómo se logró que aceptara algo que suele rechazar
- Lo que la familia comentó

**Cómo se reporta bien:** hechos, con hora, sin interpretar la causa.

- Mal: "Estaba raro, creo que le duele algo"
- Bien: "A las 3:15 se quejó de dolor en la cadera derecha al levantarse. No quiso caminar al comedor. Comió el 30%."

La segunda versión le sirve a la enfermera. La primera no.

PREGUNTAS:
P: Una residente que siempre está orientada amanece confusa y no reconoce el lugar. ¿Qué nivel de urgencia tiene?
*a) Ahora mismo — se interrumpe lo que estés haciendo
b) El mismo turno, antes de irte
c) En el relevo, con el resto de la información
d) Se observa unos días a ver si se estabiliza
EXPLICACION: Una confusión que aparece de golpe puede ser infección urinaria, deshidratación, azúcar baja o un derrame — todas tratables si se detectan a tiempo. La demencia avanza en meses, nunca de un día para otro.

P: ¿Cuál de estas dos notas le sirve a la enfermera?
a) "El residente estaba raro en la tarde, creo que algo le molesta"
*b) "A las 3:15 se quejó de dolor en la cadera derecha al levantarse. Comió el 30%."
c) "Todo normal durante el turno"
d) "Parece que le está empezando una infección"
EXPLICACION: La documentación útil tiene hora, hecho observado y dato concreto, sin interpretar la causa. La primera no permite actuar y la última introduce un diagnóstico que no le corresponde al cuidador.

P: Al bañar a una residente ves un área roja en el sacro que no se aclara cuando la presionas. ¿Cuándo lo reportas?
a) Ahora mismo, interrumpiendo lo que esté haciendo
*b) El mismo turno, antes de irme
c) En el relevo, junto con lo demás del día
d) Cuando vuelva el servicio externo en su próxima visita
EXPLICACION: La piel enrojecida que no cede al presionar va en el grupo del mismo turno: no se interrumpe todo por ella, pero tampoco espera al relevo ni a la próxima visita. Reportarla el mismo día es lo que evita que avance.

P: Un residente no se ve bien y no sabes decir qué tiene. No encaja en ninguna de las listas que te enseñaron. ¿Qué haces?
a) Espero al relevo para comentarlo
b) Lo anoto y sigo; no puedo reportar lo que no sé nombrar
c) Le pregunto a un compañero si a él le parece grave y decido con eso
*d) Lo reporto ahora mismo: cualquier cosa que te haga dudar va en el grupo urgente
EXPLICACION: La lista de "ahora mismo" termina en "cualquier cosa que te haga dudar" precisamente para esto. No tienes que saber qué es: describir lo que ves y decirlo a tiempo es tu parte.

P: Descubres que una residente acepta el baño sin pelear si se lo ofreces después del desayuno y no antes. ¿Qué haces con ese dato?
a) Nada, es mi manera de trabajar con ella
b) Se lo reporto al supervisor ahora mismo
*c) Lo paso en el relevo del turno
d) Me lo guardo para cuando alguien me pregunte
EXPLICACION: Para que el próximo turno no empiece de cero. Cómo se logró que alguien aceptara algo que suele rechazar es información de relevo: no es urgente, pero si no se pasa, cada turno repite la misma pelea con la residente.

---SECCION_5---
LECTURA:
# El relevo: lo que se firma, se cumple

En Zendity el cierre de turno se firma. Esa firma es tu declaración de que **lo que documentaste es lo que ocurrió**.

**Lo que pasa en un buen relevo:**

- Lo que cambió respecto a ayer
- Medicamentos rechazados, omitidos o no administrados, **con su razón**
- Piel: cualquier cosa nueva
- Comida y líquido: quién comió poco
- Rotaciones y movilidad
- Lo que quedó pendiente y por qué

**Lo que más se pierde hoy: lo que la familia preguntó.**

Es la información que más se queda sin pasar, y la que más cuesta después. Un familiar pregunta en la tarde por qué su mamá está durmiendo más, nadie lo anota, y cuando llama al día siguiente el turno nuevo no sabe de qué le hablan — o peor, le contesta otra cosa.

**Se pasa siempre:** qué preguntó el familiar y **quién era**, qué se le contestó, qué quedó pendiente de contestarle, y si se le prometió que alguien lo llamaría. Una pregunta de familia sin registrar se convierte en una queja a los tres días.

**Lo que rompe la continuidad:**

- Firmar sin haber documentado durante el turno, de memoria al final
- Dejar el pendiente sin decir que quedó pendiente
- Pasar la información hablada pero no escrita — el próximo turno se la lleva, el de pasado mañana no
- Documentar lo que debió haber pasado en vez de lo que pasó

**Un turno mal cerrado le cuesta al residente**, no al sistema: la enfermera llega y decide con información de la que falta la mitad.

PREGUNTAS:
P: Un familiar te pregunta en la tarde por qué su mamá está durmiendo más. Le contestas y él se va tranquilo. ¿Qué haces con eso?
*a) Lo paso en el relevo: quién preguntó, qué se le contestó y qué quedó pendiente
b) Nada, ya quedó resuelto en el momento
c) Se lo comento de palabra al compañero que entra
d) Lo anoto solo si el familiar se fue molesto
EXPLICACION: Lo que la familia preguntó es la información que más se pierde en el relevo. Si no queda escrito, el turno siguiente contesta otra cosa cuando el familiar vuelva a llamar — y ahí nace la queja.

P: ¿Qué significa firmar el cierre de turno en Zendity?
a) Que terminaste tu jornada
*b) Que lo que documentaste durante el turno es lo que realmente ocurrió
c) Que el próximo turno ya recibió la información de palabra
d) Que no quedaron pendientes
EXPLICACION: La firma es una declaración sobre el contenido, no un marcador de salida. Por eso documentar de memoria al final del turno, o registrar lo que debió pasar en vez de lo que pasó, compromete un expediente clínico.

P: Le cuentas de palabra al compañero que entra todo lo que pasó en tu turno y él te entiende bien. ¿Por qué eso no basta?
a) Porque el supervisor exige que todo esté escrito
*b) Porque el turno de pasado mañana no estuvo ahí
c) Porque tu compañero puede que se le olvide algún detalle
d) Porque el relevo hablado no está permitido en el hogar
EXPLICACION: Ni la enfermera del hogar. Lo hablado se lo lleva el próximo turno y nadie más, y quien decide —la enfermera y el servicio externo— decide con lo escrito. Ahí es donde esa información tiene que quedar.

P: Se te quedó sin hacer un cambio de posición porque estuviste atendiendo una caída. ¿Cómo cierras el turno?
a) Lo marco como hecho, fue por una emergencia de verdad
b) No lo menciono, el próximo turno lo hará de todos modos
c) Se lo digo de palabra a quien entra y lo dejo así
*d) Documento que quedó pendiente y por qué
EXPLICACION: Y lo paso en el relevo. Un pendiente que no se declara desaparece: nadie lo recoge y el expediente dice que se hizo. La razón importa tanto como el pendiente, porque es lo que explica el turno que tuviste.

P: Tu relevo escrito dice: "Turno tranquilo, sin novedad". En el turno doña Rosa rechazó la pastilla de la mañana y comió la mitad del almuerzo. ¿Qué falta?
a) Nada: si no hubo emergencia, el turno fue tranquilo
b) Falta poner la hora en que terminó tu turno
*c) Faltan las dos cosas que sí pasaron
d) Falta que lo firme también el supervisor de turno
EXPLICACION: El medicamento rechazado con su razón, y quién comió poco. "Sin novedad" no es un resumen: es un turno en blanco. Esas dos son parte de lo que se pasa siempre, porque son con las que la enfermera del hogar decide al día siguiente.
`,
    },
    {
        title: 'Piel: Prevención, Observación y Continuidad',
        description: 'Prevenir la lesión por presión, rotar con la posición de hamaca, describir sin clasificar, y saber cuándo se maneja un apósito y cuándo se llama al supervisor.',
        durationMins: 35,
        bonusCompliance: 25,
        emoji: '🩹',
        // Capa B: la continuidad con el servicio externo. Aprobada por la
        // enfermera del hogar el 21-ago-2026 tras dos vueltas de revisión.
        category: 'Cuidado Geriátrico',
        order: 108,
        targetRole: null,
        content: `---META---
TITULO: Piel: Prevención, Observación y Continuidad
PROMPT_ZENDI: Evalúa si el empleado sabe prevenir una lesión por presión, ejecuta la rotación con la técnica correcta, reconoce y describe lo que ve sin clasificarlo, y sabe cuándo puede manejar un apósito y cuándo debe llamar al supervisor.
TERMINOS_CLAVE: presión, cizallamiento, humedad, escala de Braden, posición de hamaca, prueba del dedo, rotación, apósito, servicio externo, higiene y aspecto
PREGUNTA_REFLEXION: Al rotar a un residente ves una zona roja en el sacro que no se aclara al presionarla. ¿Cuáles son tus tres pasos?

---SECCION_1---
LECTURA:
# Por qué aparece una lesión por presión

El peso del propio cuerpo comprime la piel contra el hueso y le corta la circulación. Sin circulación, el tejido empieza a morir. En una persona mayor, encamada y con la piel delgada, eso puede empezar **en dos horas**.

**Los tres factores que la producen:**

- **Presión** — el peso sostenido sobre un mismo punto
- **Cizallamiento** — arrastrar en vez de levantar: la piel se queda pegada a la sábana mientras el hueso se mueve por dentro
- **Humedad** — orina, heces o sudor que macera la piel y la vuelve frágil

Casi siempre están los tres juntos, y casi siempre son evitables.

**Dónde aparecen:** sacro y coxis, talones, caderas, codos, hombros, orejas y la parte de atrás de la cabeza.

**Una lesión por presión es, en la mayoría de los casos, un evento prevenible.** No es algo que le pasa a los viejitos: es lo que ocurre cuando la rotación, la piel seca y la nutrición no se sostienen todos los días.

## La escala de Braden

Sirve para poner número al riesgo en vez de dejarlo en intuición. Se puntúan seis factores: percepción sensorial, humedad, actividad, movilidad, nutrición, y fricción y cizallamiento.

**Se suman los seis. Mientras más bajo el total, mayor el riesgo:** de 19 a 23 sin riesgo; 15 a 18 riesgo leve; 13 a 14 moderado; 10 a 12 alto; 9 o menos muy alto.

**Quién la aplica: solo la enfermera del hogar**, y la reevalúa **cada seis meses** o antes si el residente cambia.

**El cuidador no puntúa.** Lo que sí tiene que hacer es **entender la escala**, por dos razones: para saber por qué a un residente se le vigila más que a otro, y sobre todo para **reportar lo que mueve la puntuación** entre una evaluación y la siguiente — que empezó a comer menos, que ya no se gira solo, que está amaneciendo mojado. Seis meses es mucho tiempo, y lo que pasa en medio lo ve el cuidador, no la escala.

PREGUNTAS:
P: ¿Cuánto tiempo basta para que empiece el daño por presión en un residente encamado?
a) Un turno completo de ocho horas
*b) Dos horas sobre el mismo punto
c) Un día entero sin moverse
d) Depende solo del peso del residente
EXPLICACION: Sin circulación el tejido empieza a dañarse en horas, y en una persona mayor con piel delgada eso puede comenzar a las dos horas. Por eso el intervalo de rotación es el que es.

P: Un residente con Braden de 16 hace dos meses ahora come poco y ya no se gira solo. ¿Qué te toca hacer?
a) Bajarle la puntuación de Braden en el sistema
b) Nada, la escala se reevalúa a los seis meses
*c) Reportar los cambios: son justo lo que mueve la puntuación entre evaluaciones
d) Aumentar la rotación por mi cuenta a cada hora
EXPLICACION: El cuidador no puntúa la escala —eso es de la enfermera del hogar, cada seis meses— pero es quien ve lo que la mueve en medio. Reportar que come menos y que perdió movilidad es exactamente el aporte que se espera.

P: Estás sola y subes a una residente hacia la cabecera halándola por la sábana. Fue rápido y no se quejó. ¿Qué le acabas de hacer a la piel?
a) Nada, fue rápido y no se quejó
b) Le sumaste presión, que es el peso sostenido sobre un mismo punto
*c) Cizallamiento: la piel se queda pegada mientras el hueso se mueve
d) Humedad, porque la sábana roza y da calor
EXPLICACION: La piel se queda pegada a la sábana mientras el hueso se mueve por dentro. Arrastrar en vez de levantar es cizallamiento, uno de los tres factores que producen la lesión, y que sea rápido no lo hace inofensivo: el daño ocurre por dentro, donde tú no lo ves.

P: La enfermera del hogar te dice que doña Ana tiene Braden de 11 y don Luis de 20. ¿A quién hay que vigilarle más la piel?
*a) A doña Ana: mientras más bajo el total, mayor el riesgo
b) A don Luis: el número más alto es el de más riesgo
c) A los dos igual, la escala solo ordena el papeleo
d) No se puede saber hasta ver la piel de cada uno
EXPLICACION: En Braden se suman seis factores y el total baja mientras peor está el residente: 11 es riesgo alto y 20 es sin riesgo. Entender la escala es lo que te explica por qué a uno se le vigila más que a otro.

P: Una compañera te dice que las úlceras "salen solas a esa edad, es parte de envejecer". ¿Qué le contestas?
a) Que tiene razón, la piel del mayor se rompe sola
b) Que solo salen si el residente ya venía enfermo del hospital
c) Que dependen del peso del residente más que del cuidado
*d) Que en la mayoría de los casos son prevenibles
EXPLICACION: Aparecen cuando la rotación, la piel seca y la nutrición dejan de sostenerse. La lesión por presión no es consecuencia de la edad sino de un cuidado que se cayó, y creer que sale sola es justo lo que hace que nadie la busque a tiempo.

---SECCION_2---
LECTURA:
# La rotación y la posición de hamaca

En Zendity el cambio postural se registra, y el sistema marca cuando se hizo **fuera de la ventana de dos horas**. Esa alerta no es para castigar: es la señal de que un residente pasó demasiado tiempo sobre el mismo punto.

**Cada dos horas, para todos.** No hay excepciones por residente. Si alguien necesita más frecuencia, la enfermera del hogar lo indica — pero nadie rota menos de cada dos horas.

**Las posiciones que se alternan:** supino (boca arriba), decúbito lateral izquierdo y decúbito lateral derecho.

**La posición de hamaca.** Es la forma correcta de dejar a alguien de lado. En vez de acostarlo sobre la cadera, se le inclina unos 30 grados y se le **sostiene con almohadas por detrás de la espalda**, de modo que el cuerpo quede apoyado en la almohada y no en el hueso. Otra almohada entre las rodillas, y los tobillos separados.

El residente queda como en una hamaca, sostenido por los lados, con **la cadera y el sacro sin carga directa**. Acostarlo a 90 grados sobre la cadera —que es lo que sale natural— concentra todo el peso en el trocánter, uno de los puntos donde más rápido aparece una lesión.

**Lo que se hace en cada rotación, sin excepción:**

1. Cambiar la posición según toque
2. **Mirar la piel** — es el momento en que la ves
3. Estirar las sábanas: una arruga sostenida marca
4. Almohadas para separar rodillas y tobillos
5. **Talones al aire**, sobre almohada, no apoyados en el colchón
6. Verificar que no esté húmedo
7. **Registrarlo**

**Lo que nunca se hace:** arrastrar (se levanta entre dos o con sábana de deslizamiento), dar masaje sobre una zona enrojecida, usar flotadores o donas, o dejar la cabecera sobre 30 grados más tiempo del necesario.

**Si no pudiste rotar a tiempo, se documenta con la razón real.** Un registro tardío con explicación sirve; un registro puesto al día a las once de la noche para que no salga la alerta es información falsa en un expediente clínico.

PREGUNTAS:
P: Vas a dejar a un residente de lado. ¿Cómo lo colocas?
a) A 90 grados, apoyado sobre la cadera
*b) Inclinado unos 30 grados, sostenido con almohadas por detrás de la espalda
c) Boca abajo, para descargar totalmente el sacro
d) Sentado con la cabecera bien alta
EXPLICACION: Es la posición de hamaca: el cuerpo se apoya en la almohada y no en el hueso, dejando cadera y sacro sin carga directa. Acostarlo sobre la cadera concentra el peso en el trocánter, donde la lesión aparece rápido.

P: Terminó tu turno y no alcanzaste a rotar a un residente a la hora que tocaba. ¿Qué haces?
a) Lo registro a la hora correcta para que no salga la alerta
*b) Lo documento tarde, con la razón real de por qué no se pudo
c) No lo registro, así no queda constancia del retraso
d) Le pido al turno siguiente que lo registre como si lo hubiera hecho yo
EXPLICACION: La alerta de rotación tardía no es un castigo: avisa que un residente pasó demasiado tiempo sobre el mismo punto. Registrar una hora falsa deja información inventada en un expediente clínico y le quita a la enfermera el dato que necesita.

P: Acomodas a un residente boca arriba. ¿Qué haces con los talones?
a) Los dejo sobre el colchón con una sábana suave debajo
*b) Al aire, sobre una almohada, sin que toquen el colchón
c) Les pongo una dona o un flotador debajo para descargarlos
d) Les doy masaje para que les llegue circulación
EXPLICACION: Los talones son de los puntos que más rápido se lesionan y la única forma de descargarlos es levantarlos sobre almohada. Los flotadores y las donas están entre lo que nunca se usa, y el masaje sobre una zona enrojecida empeora el daño.

P: Un residente camina un poco, se ve bien, y de noche le molesta que lo muevan. ¿Cada cuánto lo rotas?
a) Cada cuatro horas, mientras se vea bien
b) De noche se espacia, para no interrumpirle el sueño
c) Lo que pida la familia, que lo conoce mejor
*d) Cada dos horas, igual que todos
EXPLICACION: Nadie rota menos que eso. Las dos horas son el piso para todos, sin excepciones por residente ni por turno; solo la enfermera del hogar puede indicar más frecuencia, nunca menos. Que se vea bien es exactamente como se ve alguien antes de que aparezca la lesión.

P: Rotaste a un residente a las 2 y le miraste la piel: todo bien. Llegan las 4 y toca rotarlo otra vez. ¿Hay que volver a mirarle la piel?
*a) Sí: mirar la piel es parte de cada rotación
b) No, con una revisión por turno es suficiente
c) Solo si se queja de dolor al moverlo
d) Solo en el turno de mañana, cuando se baña
EXPLICACION: Es el momento en que la ves. Entre las 2 y las 4 pudo aparecer un enrojecimiento que antes no estaba, y por eso mirar va en la lista de lo que se hace en cada cambio de posición, sin excepción.

---SECCION_3---
LECTURA:
# Observar la piel: la prueba del dedo

Esto es lo más importante que hace el hogar en materia de piel: **ver a tiempo**.

**La prueba del dedo.** Presiona la zona enrojecida unos segundos y suelta:

- **Se pone blanca y vuelve al rosado** → la circulación responde. Alivia la presión y vigila de cerca
- **Sigue roja, no cambia** → la circulación ya está comprometida. **Se reporta**

Esa es la señal más temprana que existe, y llega antes de que haya nada abierto.

**En piel oscura el enrojecimiento no se ve igual.** Busca una zona más oscura o morada que el resto, cambio de temperatura al tacto, dureza, hinchazón, o que el residente se queje de dolor ahí. **La queja de dolor en un punto de presión es señal, aunque no veas nada.**

**Se reporta siempre, el mismo turno:** enrojecimiento que no cede al presionar, zona morada u oscura, ampolla, cualquier piel abierta por pequeña que sea, piel macerada por humedad, mal olor, aumento de tamaño de algo ya conocido, o dolor nuevo en un punto de presión.

**Sobre las etapas 1 a 4:** el sistema las registra porque se clasifican clínicamente. **El cuidador no clasifica.** Decir "creo que es una etapa 2" introduce en el expediente un dato que no te corresponde.

**El tamaño se dice por comparación, no en centímetros.** Nadie anda con una regla en el turno, y un número inventado es peor que ninguno: como una moneda de diez centavos, como una peseta, como una moneda de un peso, como la palma de la mano.

**Y se toma foto en Zendity.** Es el dato más útil que puede dar el hogar: deja ver la evolución real entre una visita y otra del servicio externo, sin depender de cómo cada persona describa lo mismo.

- Mal: "Úlcera etapa 2 en sacro"
- Bien: "Zona abierta en sacro, como una peseta, roja, sin mal olor. Se queja al girar." + foto

PREGUNTAS:
P: Presionas una zona enrojecida en el talón y el color no cambia. ¿Qué significa?
a) Es irritación normal del roce de la sábana
*b) La circulación ya está comprometida: se alivia la presión, se documenta y se reporta
c) Que la piel está sana, porque no duele
d) Que hay que darle masaje para reactivar la circulación
EXPLICACION: El enrojecimiento que no cede al presionar indica que el tejido ya no recibe circulación adecuada. Es la señal más temprana de daño por presión, y el masaje sobre esa zona empeora el daño en vez de ayudar.

P: Encuentras una zona abierta en el sacro. ¿Cómo la describes en el reporte?
a) "Úlcera etapa 2 en sacro"
*b) "Zona abierta en sacro, como una peseta, roja, sin mal olor" y le tomo foto
c) "Lesión de 2 por 3 centímetros aproximadamente"
d) "Herida en la espalda baja, parece infectada"
EXPLICACION: El cuidador describe, no clasifica ni diagnostica. El tamaño va por comparación —nadie carga una regla en el turno— y la foto deja ver la evolución real entre visitas del servicio externo.

P: Un residente de piel oscura se queja de dolor en la cadera cada vez que lo giras, pero tú no le ves nada rojo. ¿Qué haces?
a) Espero a que aparezca el enrojecimiento para tener algo concreto que reportar
b) Le doy masaje en la cadera para aliviarle la molestia
*c) Lo reporto igual, aunque no se vea nada
d) Lo dejo anotado para la próxima visita del servicio externo
EXPLICACION: El dolor en un punto de presión ya es señal. En piel oscura el enrojecimiento no se ve igual: se busca zona más oscura o morada, dureza, hinchazón o cambio de temperatura al tacto. El masaje sobre un punto de presión empeora el daño en vez de aliviarlo.

P: Faltan veinte minutos para que acabe tu turno y le ves una ampolla pequeña en el talón a una residente. ¿Cuándo se reporta?
a) En la ronda de mañana, cuando haya más luz
*b) El mismo turno, aunque sea lo último que hagas
c) Cuando crezca o se abra; mientras tanto se vigila
d) Se lo digo de palabra al turno que entra y ellos deciden
EXPLICACION: Una ampolla es de las cosas que se reportan el mismo turno, por pequeña que sea. Pasar el dato solo de palabra es casi como no reportarlo: mañana nadie va a saber desde cuándo está ahí.

P: Ya describiste bien la lesión en el registro. ¿Hace falta también la foto?
a) No, si la descripción está completa la foto sobra
b) Solo si la lesión es grande o se ve fea
c) Solo la enfermera del hogar toma fotos de lesiones
*d) Sí: la foto deja ver la evolución real
EXPLICACION: Entre una visita y otra del servicio externo. Cada persona describe distinto lo mismo, y la foto es lo único que compara de verdad cómo estaba y cómo está: es el dato más útil que el hogar le puede dar.

---SECCION_4---
LECTURA:
# Continuidad del tratamiento y la regla de los apósitos

Cuando ya hay una lesión en tratamiento, **el hogar no cura: sostiene lo que se indicó**.

**Lo que sí hace el hogar:** mantener la zona **sin presión** —ese es el tratamiento más importante y es del hogar—, mantener la piel limpia y seca, cumplir la rotación sin fallar, asegurar que coma y beba, avisar cuando el apósito se despegó o se mojó, y documentar lo que se observa en cada cambio de posición.

**Lo que NO hace el hogar, nunca:** aplicar cremas, pomadas, remedios caseros o productos de otro residente; limpiar una herida con nada que no esté indicado; retirar tejido, costras o nada adherido; o decidir que ya está bien y suspender el cuidado.

## Los apósitos: la regla real

Aquí no hay una prohibición absoluta. **Depende de dos cosas a la vez:**

1. **Que las instrucciones del servicio externo permitan** que el personal del hogar maneje o cambie el apósito, y
2. **Que el cuidador a cargo tenga el conocimiento** para hacerlo

**Si se cumplen las dos**, el cuidador lo hace y lo documenta.

**Si falta cualquiera de las dos** —no hay instrucción que lo permita, o el cuidador no sabe— **no se improvisa: se contacta al supervisor de turno**, y él toma la acción: que lo haga alguien capacitado, o que la enfermera del hogar coordine consulta con el servicio externo.

**No saber no es una falla; hacerlo sin saber sí lo es.** Si nunca has cambiado ese apósito, dilo. Nadie espera que todos sepan todo, y un apósito mal puesto puede infectar una herida que iba cerrando.

**Lo que sigue estando prohibido siempre:** destapar un apósito solo para mirar cómo va. Eso rompe la barrera contra la infección y no aporta nada — para eso está la foto del registro anterior.

**Se reporta:** apósito despegado, sucio, mojado o con filtración; mal olor nuevo; aumento de dolor; enrojecimiento alrededor; fiebre; o que el residente empezó a evitar apoyarse de ese lado.

PREGUNTAS:
P: Encuentras un apósito despegado a las 2 de la mañana y nunca has cambiado uno. ¿Qué haces?
a) Lo cambio con cuidado, no puede quedarse así
*b) Contacto al supervisor de turno para que él tome la acción
c) Lo despego para ver cómo va la herida y lo vuelvo a pegar
d) Lo dejo y lo reporto al final del turno
EXPLICACION: El personal maneja apósitos cuando las instrucciones lo permiten Y el cuidador sabe hacerlo. Si falta cualquiera de las dos, se llama al supervisor. No saber no es una falla; hacerlo sin saber sí lo es.

P: Un residente tiene un apósito puesto y quieres saber cómo va la herida. ¿Puedes destaparlo?
a) Sí, si lo vuelves a tapar enseguida
b) Sí, siempre que uses guantes
*c) No: destaparlo solo para mirar rompe la barrera contra la infección
d) Sí, pero solo en el turno de día
EXPLICACION: Destapar un apósito para mirar expone la herida a infección y no aporta nada, porque la referencia de cómo iba está en la foto del registro anterior. Esa es la parte que sigue prohibida siempre.

P: La hija de un residente te trae una pomada que "le funcionó a su abuela" y te pide que se la pongas en la herida. ¿Qué haces?
*a) No se la pongo y paso la solicitud al supervisor
b) Se la pongo, es natural y no le va a hacer daño
c) Se la pongo solo alrededor, no encima de la herida
d) Se la pongo si la familia lo deja por escrito
EXPLICACION: O a la enfermera del hogar. El hogar no aplica cremas, pomadas ni remedios caseros sobre una lesión, y el permiso de la familia no cambia eso: la indicación tiene que venir del tratamiento. Lo que sí te toca es pasar el pedido a quien puede contestarlo.

P: Un residente tiene una lesión en tratamiento con el servicio externo. ¿Cuál es la parte del tratamiento que le toca al hogar?
a) Limpiar la herida cada turno para que no se infecte
b) Retirar las costras cuando ya se vean despegadas
*c) Mantener la zona sin presión, la piel limpia y seca
d) Decidir cuándo la herida ya no necesita apósito
EXPLICACION: Y la rotación sin fallar. Quitarle la presión a la zona es el tratamiento más importante que existe, y ese sí es del hogar. Limpiar con lo que sea, retirar costras o decidir que ya está bien quedan fuera.

P: La lesión de una residente se ve mucho mejor y la familia te pregunta si ya puede dormir sin tantas almohadas. ¿Qué haces?
a) Le digo que sí; si ya cerró, no hace falta seguir
*b) Sostengo el cuidado igual y paso la pregunta
c) Le destapo el apósito para enseñarle que ya cerró
d) Le dejo una almohada nada más, como punto medio
EXPLICACION: Al supervisor de turno o a la enfermera del hogar. Decidir que ya está bien y suspender el cuidado no es del hogar, y la zona que cerró es justo la que se vuelve a abrir si le devuelves la presión. Destapar el apósito para enseñarlo rompe la barrera contra la infección.

---SECCION_5---
LECTURA:
# Lo que sostiene la piel todos los días

La piel no se cuida en el momento de la lesión. Se cuida en las cosas aburridas que se hacen bien todos los días.

**Higiene:** agua tibia, jabón suave, **secar sin frotar** y con cuidado en los pliegues. Hidratar la piel seca — la piel agrietada se rompe antes. **Nunca hidratar sobre una zona enrojecida ni sobre piel abierta.**

**Humedad:** cambio pronto tras cada episodio de incontinencia. El pañal ni apretado ni doblado, y nunca dos ni con toalla adentro.

**Ropa de cama:** estirada, sin arrugas, sin migas. Una arruga bajo el sacro durante ocho horas deja marca.

**Nutrición e hidratación:** una herida no cierra sin proteína ni líquido. Por eso **reportar que alguien está comiendo poco es cuidado de la piel**, aunque no lo parezca.

**Movilidad:** quien puede caminar, camina. Quien puede sentarse, se sienta — pero **también en la silla hay que reacomodar, cada hora aproximadamente**. Sentado el peso se concentra en los isquiones, y una silla no protege más que la cama.

**Dispositivos:** revisar que nada roce. Sondas, tubos de oxígeno, férulas y hasta el elástico de la media dejan lesión por presión si quedan debajo del cuerpo o aprietan.

## Higiene y aspecto: no es cosmético

**Todos los días, todos los residentes:** peinado, afeitado —o la barba arreglada, si la usa—, bien vestido con ropa limpia que le quede y que él haya podido escoger, uñas cortas y limpias, boca cuidada.

**Y con especial cuidado en los horarios de visita.** Cuando la familia llega y encuentra a su mamá despeinada y con la ropa de ayer, lo que ve no es un detalle estético: concluye —muchas veces con razón— que si eso no se cuidó, tampoco se cuidó lo demás.

**Por qué importa clínicamente:** un residente bien arreglado se siente persona. Uno descuidado se abandona — come menos, se mueve menos, participa menos. Y todo eso termina en la piel.

PREGUNTAS:
P: Un residente pasa el día sentado en su silla en vez de en cama. ¿Está protegido de una lesión por presión?
a) Sí, sentado el peso se reparte mejor
*b) No: sentado hay que reacomodar cada hora aproximadamente
c) Sí, siempre que tenga un cojín
d) Solo si se levanta a caminar una vez al día
EXPLICACION: Sentado el peso se concentra en los isquiones, y una silla no protege más que la cama. Por eso el intervalo de reacomodo en silla es incluso más corto que el de rotación en cama.

P: ¿Por qué se insiste en que el residente esté peinado, afeitado y bien vestido, sobre todo en horario de visita?
a) Solo por la impresión que se lleva la familia
*b) Porque un residente bien arreglado se siente persona, y el que se abandona come y se mueve menos
c) Porque lo exige el Departamento de la Familia
d) Porque así se distingue quién recibe visitas
EXPLICACION: No es cosmético: el aspecto sostiene el ánimo, y el ánimo sostiene el apetito y la movilidad, que son dos de los factores que protegen la piel. La impresión de la familia es real, pero es la consecuencia, no la razón.

P: Le ves el sacro rojo a una residente y la piel reseca. Tienes la crema hidratante en la mano. ¿Qué haces?
a) Le pongo crema: la piel seca se rompe antes
b) Le pongo crema y le doy masaje para activar la circulación
c) Le pongo crema solo en el borde, no en el centro rojo
*d) Ahí no se hidrata. Alivio la presión y lo reporto
EXPLICACION: Hidratar es para la piel seca sana; sobre zona enrojecida o piel abierta no se pone nada. Y el masaje sobre un punto de presión empeora el daño en vez de ayudar.

P: Un residente amanece muy mojado y una compañera propone ponerle dos pañales de noche, o uno con una toalla adentro. ¿Qué es lo correcto?
*a) Ni dos pañales ni toalla adentro: se cambia pronto
b) Dos pañales está bien si es solo para la noche
c) Mejor uno más apretado, así no se sale
d) La toalla sí, porque absorbe y no aprieta
EXPLICACION: Lo que evita la maceración es cambiarlo pronto tras cada episodio. Doblar, apretar o meter capas extra crea humedad y roce justo en la zona que quieres proteger: más pañal no resuelve la humedad.

P: Acomodas a un residente que usa oxígeno por cánula y tiene sonda. Además de mirarle la piel, ¿qué revisas?
a) Nada más: los tubos son blandos y no hacen presión
b) Solo que el oxígeno no se le haya salido de la nariz
*c) Que ningún tubo, sonda ni elástico le quede debajo
d) Que la familia no le haya cambiado nada de sitio
EXPLICACION: Ni apretando — tampoco una férula ni el elástico de la media. Un tubo o un elástico dejan lesión por presión igual que el hueso contra el colchón, y salen en sitios donde nadie los busca: revisar los dispositivos es parte de acomodar, no un extra.
`,
    },
    {
        title: 'Signos Vitales, Observación y Escalamiento',
        description: 'Tomar bien cada signo, los umbrales que obligan a llamar, y por qué el cambio respecto a lo habitual dice más que el valor absoluto.',
        durationMins: 35,
        bonusCompliance: 25,
        emoji: '🌡️',
        // Capa B: la continuidad con el servicio externo. Aprobada por la
        // enfermera del hogar el 21-ago-2026 tras dos vueltas de revisión.
        category: 'Cuidado Geriátrico',
        order: 109,
        targetRole: null,
        content: `---META---
TITULO: Signos Vitales, Observación y Escalamiento
PROMPT_ZENDI: Evalúa si el empleado toma bien cada signo vital, conoce los umbrales que obligan a llamar al supervisor, describe sin diagnosticar, y entiende que el cambio respecto a lo habitual dice más que el valor absoluto.
TERMINOS_CLAVE: ventana de vitales, presión ortostática, umbral, hipotermia, describir sin diagnosticar, escalamiento, base del residente, cambio de estado mental, observación
PREGUNTA_REFLEXION: Los vitales de un residente salen todos normales, pero algo te dice que no está como siempre. ¿Qué haces?

---SECCION_1---
LECTURA:
# La ventana de vitales al abrir turno

En Zendity, al abrir tu turno se crea una **ventana de tres horas** para tomar los signos vitales de los residentes que te corresponden. Si se vence sin completarla, el sistema pide una razón.

Eso no es una tarea del sistema: es la foto del estado del residente al inicio del turno. Sin ella, cuando algo cambie a las tres de la tarde nadie sabrá desde cuándo — y ese "desde cuándo" es lo primero que pregunta la enfermera o el paramédico.

**Una toma buena por turno es suficiente.** No se trata de medir muchas veces: se trata de que la que se tome esté bien tomada. Una lectura hecha con prisa, con el residente recién llegado de caminar, vale menos que ninguna — porque queda escrita como si fuera su estado real.

**La excepción: si algo sale muy distinto de lo habitual, se repite en una o dos horas.** No se espera al próximo turno para confirmar un valor que llamó la atención.

**Lo que hace útil la toma:**

- **A la misma hora**, para poder comparar
- **Con el residente en reposo** — no justo después de caminar, comer o alterarse
- **Anotarlo en el momento**, no de memoria al final del turno
- Si un valor sale raro, **tómalo otra vez** antes de reportar: brazo mal puesto, brazalete flojo o el residente hablando dan lecturas falsas

**Si no pudiste completar la ventana**, escribe la razón real: que estaba en terapia, que se negó, que estaba fuera con la familia. Una razón verdadera sirve; una inventada para cerrar la alerta contamina el expediente.

**Si un residente se niega a que lo midan**, no se fuerza: se ofrece más tarde, se documenta el rechazo y se reporta si se repite.

PREGUNTAS:
P: ¿Cuánto dura la ventana para tomar los vitales al abrir turno?
a) Una hora
*b) Tres horas, y con una toma buena por turno basta
c) Todo el turno
d) Hasta que el supervisor lo pida
EXPLICACION: Son tres horas. No se trata de medir muchas veces sino de que la toma esté bien hecha: una lectura con prisa queda escrita como si fuera el estado real del residente.

P: Una lectura sale muy distinta de lo habitual en ese residente. ¿Qué haces?
a) La anoto y espero al próximo turno para confirmar
*b) La repito en una o dos horas, además de reportarla
c) La descarto y tomo solo la siguiente
d) La anoto sin más, los aparatos no fallan
EXPLICACION: Un valor que llama la atención se confirma antes de que pase el turno, porque puede ser un error de técnica o el inicio de un cambio real. Esperar al próximo turno pierde las horas que importan.

P: Vas a tomarle los vitales a un residente que acaba de llegar caminando del pasillo, y tú andas corriendo. ¿Qué haces?
*a) Espero unos minutos a que descanse
b) Se los tomo ahí mismo; el número es el número
c) Se los tomo dos veces seguidas y anoto el promedio
d) Los dejo para el próximo turno
EXPLICACION: Y ahí se los tomo. Una toma hecha con prisa vale menos que ninguna, porque queda escrita como si fuera su estado real y nadie que la lea después va a saber que venía caminando. La ventana es de tres horas justamente para que quepan esos minutos.

P: A las 3:00 de la tarde un residente se pone mal y llamas a la enfermera. ¿Qué es lo primero que te va a preguntar?
a) Qué medicamentos toma
b) Si ya avisaste a la familia
*c) Desde cuándo está así
d) Quién estaba de turno antes que tú
EXPLICACION: Y eso se contesta con los vitales del inicio del turno, que son la foto del estado del residente ese día. Sin ella nadie sabe desde cuándo cambió, y ese "desde cuándo" es lo primero que pregunta la enfermera o el paramédico.

P: Se venció la ventana de vitales de una residente: se negó dos veces y después salió con la familia. El sistema te pide una razón. ¿Qué escribes?
a) La razón más corta que cierre la alerta
b) Que no dio tiempo por la carga de trabajo
c) Nada; dejo la alerta abierta para que la cierre el supervisor
*d) Lo que pasó de verdad: se negó dos veces y salió
EXPLICACION: Una razón verdadera sirve, y además deja ver que la residente se está negando, que es cosa que hay que reportar si se repite. Una inventada para cerrar la alerta contamina el expediente.

---SECCION_2---
LECTURA:
# Cómo se toma cada uno

**Temperatura.** En el hogar se mide con **termómetro láser de frente**. Es rápido y no molesta al residente, pero tiene una limitación que hay que conocer: **mide la piel, no el interior**. Y la piel de alguien que lleva la noche en una habitación con aire acondicionado está fría.

Por eso las lecturas del hogar salen medio grado por debajo de lo esperado, y el turno de mañana es el más frío de todos.

**Para que la lectura sirva:**

- **Frente seca y despejada** — sin sudor, sin pelo, sin gorro
- A la distancia que indica el aparato, apuntando al centro de la frente
- **Siempre en el mismo punto**, para poder comparar
- **Espera unos minutos** si el residente acaba de llegar de la calle, de bañarse, o de estar bajo el chorro del aire

**Y lo más importante: una lectura baja o alta se confirma por vía axilar antes de escalar.** El termómetro de frente sirve para vigilar a todos rápido; cuando marca algo raro, se confirma con otro método. Anota las dos lecturas y con qué método tomaste cada una.

**Pulso.** En la muñeca, con los dedos —nunca con el pulgar— durante un minuto completo. Fíjate no solo en cuántos: **si es regular o irregular**, y si se siente fuerte o débil. Un pulso irregular nuevo se reporta.

**Respiración.** **Sin avisarle.** En cuanto le dices que vas a contar su respiración, la persona la cambia sin querer. Cuenta un minuto discretamente, después del pulso.

**Presión arterial.** El residente sentado, en reposo cinco minutos, brazo apoyado a la altura del corazón, pies en el piso, sin hablar. **Brazalete del tamaño correcto**: uno pequeño da lecturas falsamente altas, un error muy común. Sobre la piel, no sobre la manga.

**Oxígeno.** Dedo limpio, sin esmalte, mano tibia. Una mano fría da lecturas falsamente bajas: caliéntala y repite antes de alarmarte.

**Peso.** Misma báscula, misma hora, ropa similar. Es de las señales más valiosas y de las más ignoradas: una pérdida sostenida se ve semanas antes de que el residente se vea mal.

## Presión ortostática

Explica por qué un residente se marea o se cae al levantarse, y es una de las causas de caída más fáciles de detectar.

**Se toma la presión tres veces, en tres posiciones:** acostado tras cinco minutos en reposo; de pie al minuto de haberse levantado; y de pie otra vez a los tres minutos. Se anotan las tres con su posición y su hora.

**Qué se busca:** una caída de la presión al ponerse de pie. Si la sistólica baja de forma marcada respecto a la de acostado, o si el residente se marea, se tambalea o se pone pálido, **eso se reporta** — es riesgo de caída, y muchas veces se corrige ajustando un medicamento.

**Seguridad:** no lo dejes solo de pie; alguien a su lado o una silla justo detrás. **Si se marea, siéntalo de inmediato** y no completes la prueba.

**Cuándo se hace:** cuando la enfermera del hogar lo indique — típicamente en residentes que se han caído, que se quejan de mareo al levantarse, o que empezaron un medicamento nuevo para la presión.

PREGUNTAS:
P: El termómetro de frente marca 35.1 en un residente que se ve bien. ¿Qué haces?
*a) Lo confirmo por vía axilar antes de escalar y anoto las dos lecturas
b) Aviso de inmediato, es hipotermia
c) Lo anoto y sigo, se ve bien
d) Vuelvo a medir en la frente hasta que dé normal
EXPLICACION: El termómetro de frente mide la piel, y con aire acondicionado marca por debajo. Una lectura baja es señal para confirmar bien, no un diagnóstico. Repetir en la misma frente solo repite el mismo error.

P: Vas a contar la respiración de un residente. ¿Cómo lo haces?
a) Le aviso para que se quede quieto y respire normal
*b) Sin avisarle, discretamente, después de tomarle el pulso
c) Le pido que respire hondo mientras cuento
d) Le pregunto cuántas veces siente que respira
EXPLICACION: En cuanto la persona sabe que le están contando la respiración, la cambia sin querer. Contarla justo después del pulso, sin avisar, es la única forma de obtener el valor real.

P: Durante la prueba de presión ortostática el residente se marea al ponerse de pie. ¿Qué haces?
a) Completo las tres tomas rápido para tener el dato
*b) Lo siento de inmediato, no completo la prueba y lo reporto
c) Lo sostengo del brazo y sigo
d) Lo acuesto y repito la prueba desde el principio
EXPLICACION: La seguridad del residente manda sobre el dato. El mareo al levantarse ya es en sí mismo el hallazgo que se buscaba, así que no hace falta completar la prueba para reportarlo.

P: El residente es grande y el brazalete de su tamaño no aparece, así que le tomas la presión con el normal, que le queda apretado. Sale alta. ¿Qué pasó?
a) Está alta de verdad; el brazalete no cambia el número
*b) Un brazalete que queda chico sube la lectura
c) Sirve igual mientras el brazo esté a la altura del corazón
d) Se la tomo en el otro brazo con ese mismo brazalete
EXPLICACION: Hay que repetirla con el tamaño correcto. Es de los errores más comunes y manda a reportar presiones que no existen. Cambiar de brazo no arregla nada: lo que hay que cambiar es el brazalete, y ponerlo sobre la piel, no sobre la manga.

P: Un residente con las manos heladas marca 88% en el oxímetro. Está tranquilo y no le falta el aire. ¿Qué haces primero?
*a) Le caliento la mano y repito
b) Llamo al supervisor de una vez
c) Le pido que respire hondo mientras mido
d) Lo anoto y sigo; se ve bien
EXPLICACION: Una mano fría da lecturas falsamente bajas, por eso el umbral dice "menos de 90%, confirmado con la mano tibia". Si después de calentarla sigue bajo, entonces sí se llama de inmediato.

P: Le tomas el pulso a un residente y lo sientes saltado, irregular. Nunca lo había sido, y la frecuencia está en 78. ¿Qué haces?
a) Nada; entre 60 y 100 está bien
b) Anoto solo el número, que es lo que pide el sistema
c) Lo confirmo con el pulgar antes de decir nada
*d) Lo reporto: un pulso irregular nuevo se reporta
EXPLICACION: Aunque la frecuencia esté normal. El pulso no es solo cuántos: es si es regular y si se siente fuerte o débil. Y ojo con el pulgar, que tiene pulso propio: con él terminas contando el tuyo.

---SECCION_3---
LECTURA:
# Los umbrales del hogar

Estos son los valores aprobados. Hay dos niveles, y la diferencia importa: **llamar** interrumpe el turno; **anotar** llega al reporte de enfermería sin interrumpir a nadie.

**LLAMA AL SUPERVISOR DE INMEDIATO si:**

- **Temperatura** 38.0 °C o más
- **Temperatura baja** — en un adulto mayor la hipotermia también puede indicar infección, y es la que más se deja pasar porque nadie la espera
- **Pulso** más de 110, menos de 50, o **irregular cuando antes no lo era**
- **Sistólica** más de 180, o menos de 90
- **Diastólica** más de 110, o menos de 50
- **Oxígeno** menos de 90%, confirmado con la mano tibia
- **Peso** con aumento de un kilo en un día o dos en una semana

**ANOTA Y PÁSALO EN EL REPORTE si:** temperatura de 37.5 a 37.9; pulso de 100 a 110 sostenido; sistólica de 160 a 180; diastólica de 100 a 110; oxígeno de 90 a 93%; o pérdida de peso sostenida en dos pesajes.

**Dos notas sobre la tabla.** El aumento rápido de peso **no es que comió bien**: un kilo en un día es líquido retenido, y suele verse antes de que se compliquen los pulmones o el corazón. Y la hipotermia asusta menos que la fiebre y avisa igual.

**Lo más importante de esta sección:** el número que más dice **no es el valor absoluto, es el cambio respecto a lo habitual de esa persona**. Un residente que siempre anda en 90/60 y hoy está en 130/85 puede estar peor que otro que siempre anduvo en 130/85. Por eso hay que conocer su base, y por eso importa que las tomas sean consistentes.

**Señales que se reportan aunque los números salgan bien:** confusión nueva o más somnolencia, dejó de comer o beber, no orinó como de costumbre, dolor nuevo, menos movilidad, o simplemente que **no está como siempre**.

PREGUNTAS:
P: Un residente tiene la temperatura por debajo de lo normal. ¿Es preocupante?
a) No, lo preocupante es la fiebre
*b) Sí: en un adulto mayor la hipotermia también puede indicar infección
c) Solo si además tiene frío
d) Solo si es menor de 30 grados
EXPLICACION: La hipotermia avisa igual que la fiebre y se deja pasar más, precisamente porque nadie la espera. En un adulto mayor una infección puede manifestarse bajando la temperatura en vez de subiéndola.

P: Un residente que siempre anda en 90/60 hoy tiene 130/85. ¿Qué haces?
a) Nada, 130/85 está dentro de lo normal
*b) Lo reporto: lo que dice más es el cambio respecto a su base, no el valor absoluto
c) Repito la toma hasta que dé 90/60
d) Solo lo anoto si además se siente mal
EXPLICACION: Un valor "normal" puede ser anormal para esa persona. Por eso se conoce la base de cada residente y por eso las tomas tienen que ser consistentes: sin base no hay con qué comparar.

P: Doña Rosa amaneció un kilo más pesada que ayer. Ha estado comiendo bien. ¿Qué haces?
a) Nada; comió bien, es buena señal
b) Lo anoto y lo paso en el reporte de enfermería
*c) Llamo al supervisor: un kilo en un día es líquido retenido
d) Repito el pesaje la semana que viene para ver si se mantiene
EXPLICACION: Nadie engorda un kilo de comida en un día: eso es líquido, y suele verse antes de que se compliquen los pulmones o el corazón. Por eso está entre los que obligan a llamar, no entre los que solo se anotan.

P: Un residente marca 37.6 °C y por lo demás está igual que siempre. ¿Llamas al supervisor?
*a) No: de 37.5 a 37.9 se anota
b) Sí; de 37 para arriba ya es fiebre
c) No, y tampoco hace falta anotarlo
d) Solo si además tiene tos o se queja
EXPLICACION: Se anota y se pasa en el reporte de enfermería. Hay dos niveles y la diferencia importa: llamar interrumpe el turno, anotar llega a la enfermera sin interrumpir a nadie. De 38.0 en adelante se llama; 37.6 se escribe para que lo vea junto con lo demás.

P: Don Luis tiene todos los vitales dentro de rango, pero hoy está confundido, cosa que no es de él, y no ha orinado como de costumbre. ¿Qué haces?
a) Espero a la próxima toma a ver si los números cambian
*b) Lo reporto aunque los números salgan bien
c) Le doy más agua y lo vuelvo a mirar mañana
d) Lo anoto al final del turno y ya
EXPLICACION: La tabla de umbrales no lo cubre todo. Confusión nueva, más somnolencia, dejar de comer o beber y no orinar como de costumbre se reportan por sí solos, con los números buenos o malos.

---SECCION_4---
LECTURA:
# Describir sin diagnosticar

Lo que escribes se queda en un expediente clínico. **Interpretar es lo que no te toca; describir es lo que nadie más puede hacer.**

- En vez de "parece que tiene infección urinaria" → **"Orina turbia y de olor fuerte. Se quejó al orinar dos veces."**
- En vez de "está deprimido" → **"No quiso salir del cuarto ni bajar al comedor. Llevaba tres días participando en actividades."**
- En vez de "le duele por la artritis" → **"Se quejó de dolor en la rodilla derecha al levantarse. Caminó apoyándose en la pared."**
- En vez de "estaba agresivo" → **"A las 4:10 gritó y empujó la bandeja al intentar asistirlo con el baño."**
- En vez de "comió mal" → **"Comió el 25% del almuerzo. Tomó todo el jugo."**

**Las reglas:** hora exacta; lo que observaste, no lo que supones; lo que el residente dijo **entre comillas** con sus palabras; lo que hiciste después; y números cuando los haya.

**Documenta durante el turno, no al final.** La memoria se distorsiona en horas, y un turno de ocho horas reconstruido a las 9:55 pierde exactamente los detalles que importan.

**Tres formas de escribir que le quitan información a quien lee:**

**El pasivo sin persona ni hora.** "Se observó que no se administró el medicamento de las 8 p.m." no dice quién lo notó ni cuándo. Mejor: "El medicamento de las 8:00 p.m. no se administró. Lo noté a las 9:30 al revisar el eMAR. Lo reporté al supervisor a las 9:35."

**El resumen que no dice qué pasó.** "Se registró una observación relacionada con el cuidado de un residente" podría ser cualquier cosa. Mejor: "A las 2:10 encontré a doña X con el pañal sin cambiar desde el turno anterior. Piel enrojecida en el sacro, cede al presionar."

**La conclusión en lugar del hecho.** "Estuvo agresivo" deja una etiqueta pegada al residente. Mejor: "A las 4:10 gritó y empujó la bandeja cuando lo asistí con el baño. Me retiré y volví a las 4:40; aceptó sin problema."

**Nunca:** borrar o alterar lo escrito, documentar algo que no hiciste, ni firmar por otra persona.

PREGUNTAS:
P: ¿Cómo se documenta lo que parece una infección urinaria?
a) "Posible infección urinaria, favor evaluar"
*b) "Orina turbia y de olor fuerte. Se quejó al orinar dos veces."
c) "El residente tiene molestias urinarias por su edad"
d) "Sospecho infección, ya le di más agua"
EXPLICACION: El diagnóstico no le corresponde al cuidador, pero la observación sí — y es la que nadie más puede aportar. Describir lo concreto le da a quien decide exactamente lo que necesita.

P: ¿Cuándo se documenta lo ocurrido en el turno?
a) Al final, en un resumen ordenado
*b) Durante el turno, en el momento
c) Al día siguiente, con la cabeza fresca
d) Solo si pasó algo fuera de lo normal
EXPLICACION: La memoria se distorsiona en horas. Un turno de ocho horas reconstruido al final pierde justo los detalles —la hora exacta, las palabras del residente— que hacen útil la documentación.

P: A las 7:20 de la noche don Pedro gritó y te apartó la mano cuando ibas a cambiarlo. Volviste a las 8:00 y se dejó sin problema. ¿Cómo lo escribes?
a) "Paciente agresivo en la noche, no colaboró en ningún momento."
b) "No colaboró por su condición; se dejó para el próximo turno."
c) "Se negó al cambio de pañal en la noche, aunque después de un rato terminó aceptándolo sin mayor problema."
*d) "7:20 pm: gritó y me apartó la mano al ir a cambiarlo. A las 8:00 aceptó sin problema."
EXPLICACION: "Agresivo" es una etiqueta que se le queda pegada al residente y no dice qué pasó. La hora, lo que hizo y lo que pasó cuando volviste sí le sirven al próximo turno, porque le enseñan qué funciona con él.

P: A las 9:30, revisando el eMAR, ves que el medicamento de las 8:00 p.m. no se dio. Se lo reportas al supervisor a las 9:35. ¿Cómo queda mejor escrito?
a) "Se observó que no se administró el medicamento de las 8:00 p.m. y se tomaron las medidas correspondientes con el supervisor de turno."
b) "Hubo un problema con la medicación de la noche; ya se resolvió."
*c) "El medicamento de las 8:00 p.m. no se administró. Lo noté a las 9:30 y lo reporté al supervisor a las 9:35."
d) "El turno anterior no dio el medicamento de las 8:00 p.m."
EXPLICACION: El pasivo no dice quién lo notó ni cuándo, y sin eso nadie puede reconstruir lo que pasó. Fíjate que tampoco hace falta señalar a nadie: basta con el hecho, la hora y lo que hiciste.

P: Una compañera salió corriendo y te pide por teléfono que le firmes la nota del baño que ella sí dio. ¿Qué haces?
*a) No firmo por ella; se lo paso al supervisor
b) Se la firmo; el baño sí se dio
c) La escribo a mi nombre, como si lo hubiera dado yo
d) La firmo y le pongo entre paréntesis que fue ella
EXPLICACION: Para que lo resuelva quien puede. Firmar por otra persona y documentar lo que no hiciste están en la lista de lo que nunca se hace, aunque el cuidado sí se haya dado: el expediente tiene que decir quién hizo qué de verdad.

---SECCION_5---
LECTURA:
# La cadena completa

Este curso cierra donde empezó: **tú eres los ojos del servicio externo los días que no está**.

**Cómo se ve la cadena cuando funciona:**

1. **Lunes** — la cuidadora anota: "comió el 30%, rechazó el jugo, orina oscura"
2. **Martes** — otra cuidadora anota: "más callada, se durmió en el comedor"
3. **Martes noche** — se reporta confusión nueva
4. **La enfermera del hogar** lo lee junto y ve el patrón: posible infección urinaria o deshidratación
5. **Se coordina consulta y se trata** — sin hospitalización

**Cómo se ve cuando falla:** los mismos tres días ocurren, nadie los escribe porque cada uno por separado "no era nada", y el jueves la residente va a emergencias.

La diferencia no fue el conocimiento clínico de nadie. Fue que alguien anotó.

**Lo que sostiene la cadena:** tomar los vitales en su ventana y bien tomados; anotar en el momento; describir sin diagnosticar; escalar según urgencia, sin inflar ni minimizar; pasar el relevo completo por escrito; y **decir cuando algo no se pudo hacer**.

**Y lo último, que es lo más difícil de enseñar:** cuando algo te dé mala espina y no sepas explicar por qué, repórtalo igual. Ese instinto viene de ver a esa persona todos los días, y es información clínica real aunque no tenga nombre. Prefieren un reporte de más que enterarse en emergencias.

PREGUNTAS:
P: Tres días seguidos anotas cosas pequeñas de una residente: comió poco, orina oscura, más callada. Por separado ninguna parecía nada. ¿Para qué sirvió anotarlas?
*a) Juntas dejan ver un patrón —posible infección o deshidratación— que se puede tratar a tiempo
b) Para tener respaldo si la familia reclama
c) Para cumplir con el registro diario
d) Para que el próximo turno sepa cómo tratarla
EXPLICACION: Ninguna de las tres, sola, justifica una consulta. Juntas dibujan un patrón que se atiende antes de que termine en emergencias. Esa es toda la razón de ser de la documentación diaria.

P: Los vitales de un residente salen normales, pero algo te dice que no está como siempre. ¿Qué haces?
a) Confío en los números y sigo con el turno
*b) Lo reporto igual: ese instinto viene de verlo todos los días y es información real
c) Espero al próximo turno a ver si alguien más lo nota
d) Repito los vitales hasta que salga algo anormal
EXPLICACION: Conocer al residente todos los días produce una lectura que ningún aparato da. Un reporte de más cuesta una conversación; uno de menos puede costar una hospitalización.

P: Se te acabó el turno y no pudiste bañar a una residente ni tomarle los vitales, porque estuviste atendiendo una caída. ¿Qué haces?
a) Nada; el próximo turno se va a dar cuenta
*b) Lo dejo por escrito en el relevo
c) Se lo digo de palabra a la compañera al salir
d) Lo marco como hecho para no dejar el turno con pendientes
EXPLICACION: Lo que no se pudo hacer, y por qué. Decir eso es una de las cosas que sostienen la cadena: el próximo turno lo recoge y nadie tiene que adivinar. De palabra se pierde, y marcarlo como hecho es documentar algo que no hiciste.

P: El servicio externo no está todos los días. Los días que no está, ¿qué te toca a ti?
a) Evaluar al residente y decidir si hace falta una consulta
b) Guardarlo todo en la cabeza y contarlo cuando vengan
c) Anotar solo lo que creo que va a parecer importante
*d) Observar, anotar en el momento y escalar
EXPLICACION: Eres los ojos del servicio externo los días que no está, pero quien lee lo que escribiste y ve el patrón es la enfermera del hogar: ella decide si hace falta consulta. Decidir no te toca, y filtrar tampoco: lo pequeño de hoy es lo que cobra sentido junto a lo de mañana.

P: Ves un cambio en un residente y dudas si llamar ahora o dejarlo para el reporte. Se te ocurre decirlo más grave de lo que es para que te hagan caso. ¿Qué haces?
*a) Lo cuento tal como es y que el supervisor decida
b) Lo digo más grave; así seguro alguien viene
c) Lo dejo para el reporte; mejor no molestar
d) Espero al próximo turno a ver si alguien más lo nota
EXPLICACION: Con la urgencia que tiene, ni más ni menos. Inflar y minimizar rompen lo mismo: la confianza en lo que reportas. Y si de verdad dudas, prefieren un reporte de más que enterarse en emergencias.
`,
    },
];

async function main() {
    // Filtro de sede. El 02-sep-2026 apareció una segunda sede en producción
    // —Vivid Mayagüez, con su Director y sin residentes todavía— y este script
    // siembra en TODAS las que encuentra. Sembrar una sede nueva es una
    // decisión, no un efecto secundario de actualizar el contenido de otra.
    //
    //   npx tsx scripts/academy-fase2.ts --dry-run
    //   npx tsx scripts/academy-fase2.ts --hq=Cupey
    const filtro = process.argv.find(a => a.startsWith('--hq='))?.slice(5);

    const todas = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    const sedes = filtro
        ? todas.filter(h => h.name.toLowerCase().includes(filtro.toLowerCase()))
        : todas;

    if (filtro && sedes.length === 0) {
        console.log(`Ninguna sede contiene "${filtro}". Hay: ${todas.map(h => h.name).join(', ')}`);
        return;
    }
    if (filtro) console.log(`Solo: ${sedes.map(h => h.name).join(', ')}\n`);
    else if (todas.length > 1) console.log(`TODAS las sedes (${todas.length}). Para una sola: --hq=<nombre>\n`);

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

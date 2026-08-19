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

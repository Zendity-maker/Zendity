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

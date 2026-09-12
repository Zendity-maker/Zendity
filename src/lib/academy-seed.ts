// ── Academy Seed Data ──────────────────────────────────────────────────────────
// 3 cursos completos con formato estructurado ---META--- / ---SECCION_N---
// Ejecutar: npx tsx src/lib/academy-seed.ts

export interface AcademySeedCourse {
    id: string;
    title: string;
    description: string;
    content: string;
    durationMins: number;
    bonusCompliance: number;
    emoji: string;
    category?: string;
    order?: number;
}

export const ACADEMY_SEED_COURSES: AcademySeedCourse[] = [

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 1: ACCESO Y ROLES EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ACCESO_ROLES_101',
    title: 'Acceso y Roles en Zendity',
    description: 'Aprende a navegar el sistema Zendity, comprender los roles de usuario y aplicar las mejores practicas de seguridad digital en tu facilidad.',
    durationMins: 25,
    bonusCompliance: 75,
    emoji: '🔐',
    category: 'Roles y Acceso',
    order: 1,
    content: `---META---
TITULO: Acceso y Roles en Zendity
PROMPT_ZENDI: Evalúa si el empleado conecta su sesión abierta con lo que queda firmado a su nombre: busca que cuente una situación real de su turno con la tableta compartida, que reconozca que el registro sigue a la sesión y no a quien teclea, y que proponga un cambio concreto que pueda hacer mañana, no una promesa general de tener más cuidado.
TERMINOS_CLAVE: Sede, rol, doble rol, PIN, sesión, trazabilidad, HIPAA, hub de cuidado, Corporate HQ, Clinical Care, grupo de color, entregar turno, formación asignada
PREGUNTA_REFLEXION: Piensa en la tableta que usas en tu turno: desde que la abres con tu PIN hasta que entregas el turno, ¿cuántas veces se queda sin ti al lado? Cuenta una situación real de esta semana y di qué vas a hacer distinto mañana para que lo que se registre ahí sea tuyo de verdad.

---SECCION_1---
LECTURA:
# Tu Sede, y por qué todo lleva tu nombre

Zéndity es donde vive el trabajo del hogar: quién entró, qué se le dio, qué cambió y quién lo vio. No sustituye lo que tú sabes hacer. Guarda lo que haces para que quien entre después no tenga que adivinar.

**La Sede**

Cada hogar es una **Sede**: un espacio digital propio, separado del de los demás. Vivid Cupey y Vivid Mayagüez son dos Sedes distintas. Lo que se escribe en una no aparece en la otra, ni por error ni pidiéndolo.

Quien dirige más de una sede las mira con el selector **Sede Activa**, en la barra de arriba. Lo que se pinta en pantalla depende de cuál esté escogida. Solo lo ven Director Ejecutivo y Administrador de Red.

**Todo lleva tu nombre. También lo que solo miras.**

Cada acción guarda quién, cuándo y sobre quién. Eso ya lo sabías de lo que escribes. Lo que casi nadie sabe es que **abrir un expediente también queda grabado**: el sistema anota la lectura igual que anota una firma. Si entras al expediente de Rosa Medina (204), lees una nota y sales sin escribir nada, ahí queda tu nombre y la hora.

No es para vigilarte. Es lo que hace que la regla de no abrir el expediente de quien no está bajo tu cuidado signifique algo de verdad.

**Si un día no puedes entrar**

Puede pasar que la pantalla de entrada te conteste con el nombre de tu hogar y te diga que no tiene el servicio activo. No perdiste tu cuenta ni te dieron de baja: es un asunto de facturación de la Sede. El propio sistema lo dice con estas palabras: la operación **debe continuar con documentación manual**. Documentas en papel, avisas a dirección y sigues trabajando.

PREGUNTAS:
P: ¿Qué es una Sede en Zéndity?
*a) El espacio digital propio de cada hogar, separado del resto
b) La oficina de la empresa Zéndity en San Juan
c) El área del hogar donde duermen los residentes
d) El grupo de cuidadoras que trabajan el mismo turno de mañana
EXPLICACION: Cupey y Mayagüez son dos Sedes distintas: lo que se escribe en una no aparece en la otra, ni por error ni a propósito.

P: ¿Qué quiere decir que Zéndity tenga trazabilidad?
a) Que funciona sin internet desde cualquier tableta del piso
b) Que los residentes consultan su expediente
*c) Que cada acción guarda quién, cuándo y sobre quién
d) Que el sistema corrige solo los errores de quien documenta tarde
EXPLICACION: Por eso ninguna nota es anónima: el nombre que queda es el de la sesión que estaba abierta en ese aparato.

P: Abres el expediente de Rosa Medina (204), lees una nota y sales sin escribir nada. ¿Qué queda guardado?
a) Nada, porque el registro solo se activa cuando escribes
b) Una notificación al supervisor para que apruebe esa consulta
c) Solo queda si la residente no es tuya
*d) Que tú abriste ese expediente y a qué hora lo hiciste
EXPLICACION: Zéndity audita las lecturas, no solo lo que escribes: abrir un expediente deja tu nombre igual que firmar un medicamento.

P: Ana dirige el hogar y abre una segunda sede en Mayagüez. ¿Cómo mira los datos de cada una?
a) Entra con un correo distinto para cada una de las dos sedes
*b) Con el selector Sede Activa de la barra de arriba
c) Aparecen juntos y se separan por el número de habitación
d) Pide a Zéndity un reporte aparte cada vez que lo necesita
EXPLICACION: Solo Director Ejecutivo y Administrador de Red lo ven, y lo que se pinta en pantalla depende de cuál sede esté escogida.

P: Un lunes a las 7 de la mañana la entrada contesta con el nombre de tu hogar y dice que no tiene el servicio activo. ¿Qué pasa?
a) Tu PIN venció: pide uno nuevo
b) El internet se cayó: reinicia la tableta y vuelve a entrar
*c) La sede está suspendida: documenta en papel y avisa
d) Te dieron de baja: no trabajes hasta que te llamen de RRHH
EXPLICACION: Ese mensaje es de la facturación de la Sede, no de tu cuenta; el propio sistema avisa que la operación sigue con documentación manual.

---SECCION_2---
LECTURA:
# Los roles: el tuyo y el de al lado

El rol te lo pone la administración cuando te da de alta. Decide dónde caes al entrar y qué botones te aparecen.

| Como se lee en pantalla | Lo que hace en Zéndity |
|---|---|
| **Cuidador(a)** | La tableta del piso. Administra y firma medicamentos, toma vitales, registra baño, comidas, rotación y rondas, levanta alertas y cierra el turno. |
| **Enfermería** | Todo lo anterior, más piel y úlceras, caídas, plan de cuido y los cambios que reporta el piso. |
| **Supervisor(a)** | Triage, horarios, firma de relevos y desempeño del personal. |
| **Director Ejecutivo** y **Administrador de Red** | Dentro del hogar, prácticamente el mismo poder: sedes, facturación, acuerdos, kioscos. |
| **Recursos Humanos** | Personal, observaciones, asistencia, horarios y evaluaciones. No entra al expediente ni al eMAR. |
| **Trabajo Social** | Evaluaciones sociales, beneficios y su propio tablero. Entra al expediente y lee el eMAR, pero no administra medicamentos. |
| **Comunicación Familiar** | Mensajes, citas y llamadas con las familias. No se escoge en el alta de personal: lo habilita dirección. |
| **Terapeuta** y **Especialista (Belleza)** | Su propia pantalla de especialistas. |
| **Cocina y Nutrición**, **Limpieza & Sanitización**, **Mantenimiento** | Su módulo de trabajo. |
| **Socio / Inversor** | Los números del negocio, sin nada clínico. |

Aparte queda **SUPER_ADMIN**: ese es Zéndity, no el hogar. Da de alta las sedes y es el único que puede entrar cuando una sede está cerrada.

Y aparte quedan las **familias**. No son un rol del sistema: tienen su propia cuenta con su PIN familiar, y el portal se cierra solo cuando el residente egresa o fallece. Quien busque un rol llamado FAMILY en el alta de personal no lo va a encontrar nunca.

**Lo que hace una cuidadora, y lo que no**

| Lo que SÍ | Lo que NO |
|---|---|
| Administrar y firmar el pack de medicamentos del turno | Dar de alta a otro empleado |
| Tomar y escribir signos vitales | Publicar el horario de la semana |
| Registrar seco, húmedo, evacuación y rotación en sus rondas | Cambiar el plan de cuido de un residente |
| Levantar alerta de caída, de piel y de cambio de condición | Revisar y cerrar un cambio de condición |
| Cerrar su turno firmando el relevo | Abrir expedientes desde el menú corporativo |

Sí: la cuidadora administra los medicamentos y los firma. Es el acto de más consecuencia de su turno, y queda con su nombre.

**Una persona, dos roles**

En el alta de personal hay una fila que dice **Doble Rol (Accesos Simultáneos)**. Ahí se marcan los puestos que esa persona también hace. El sistema te deja hacer todo lo de cualquiera de tus roles, no solo el principal. En este hogar pasa todos los días: la enfermería la lleva la dirección con Enfermería de secundario, y una supervisora con Cuidador(a) de secundario puede abrir turno en la tableta.

**Cocina también ve datos del residente**

La pantalla de Cocina y Nutrición lista a cada residente con su nombre, su cuarto y su dieta prescrita: PEG, majada, licuada, renal, diabética. Eso es información clínica, porque una dieta PEG o renal dice algo del diagnóstico. No se fotografía, no se comenta fuera y no sale de la plataforma. Lo mismo vale para limpieza y mantenimiento con lo que ven dentro de las habitaciones.

PREGUNTAS:
P: Carmen, cuidadora, tiene el pack de las 8:00 AM de Rosa Medina (204). ¿Qué le toca hacer?
a) Esperar a la enfermera, que es quien firma los medicamentos
b) Dejarlos en la mesa de noche y anotarlo en el relevo
c) Darlos y después escribir una nota diciendo cuáles dio
*d) Darlos y firmar el pack con el dedo en la tableta
EXPLICACION: El eMAR acepta la firma de la cuidadora: administrar es su acto y queda con su nombre, no con el de la enfermera.

P: Zuleyka entra como supervisora, pero hoy cubre el piso y necesita abrir turno de cuidadora. ¿Qué hace falta?
*a) Que tenga Cuidador(a) marcado como rol secundario
b) Que le presten el correo y el PIN de una cuidadora
c) Que dirección le cambie el rol principal cada vez
d) Nada, cualquier rol puede abrir turno en la tableta
EXPLICACION: En el alta de personal hay una fila que dice Doble Rol (Accesos Simultáneos), y el sistema deja hacer lo de cualquiera de tus roles.

P: La pantalla de Cocina lista a cada residente con su nombre, su cuarto y su dieta: PEG, majada, renal. ¿Qué es eso?
a) Datos de logística para la compra de la semana
*b) Datos clínicos del residente, y se protegen igual
c) Datos públicos del hogar, porque no hay diagnóstico escrito
d) Datos de dieta sin valor clínico, porque no son medicamentos
EXPLICACION: Una dieta PEG o renal dice algo del diagnóstico; esa pantalla no se fotografía ni se comenta fuera del hogar.

P: Una directora quiere dar acceso a la hija de Rosa Medina y busca el rol FAMILY en el alta de personal. ¿Qué se encuentra?
a) Lo encuentra al final de la lista de roles operativos
b) Lo encuentra, pero tiene que marcarlo también como secundario
*c) No está: la familia se invita aparte, con su propio PIN
d) Lo encuentra solo si la residente sigue activa en el hogar
EXPLICACION: El familiar no es empleado ni tiene rol del sistema; su cuenta va aparte y el portal se cierra cuando la residente egresa o fallece.

P: Recursos Humanos lleva observaciones, asistencia, horarios y evaluaciones. ¿A qué no entra?
*a) Al expediente clínico y al eMAR de los residentes
b) Al directorio de empleados y a sus evaluaciones
c) A las observaciones que se escriben desde el piso
d) Al constructor de horarios de la semana del personal
EXPLICACION: Es un rol propio justamente por eso: quien lleva personal no necesita ver un diagnóstico para hacer su trabajo.

---SECCION_3---
LECTURA:
# Dónde aterrizas y cómo te mueves

**No eliges dónde entras.** Escribes tu correo y tu PIN, y Zéndity te lleva a la pantalla de tu puesto.

| Tu rol | Dónde caes al entrar |
|---|---|
| Cuidador(a) | Tu hub de cuidado |
| Cocina | El tablero de cocina |
| Limpieza | El tablero de limpieza |
| Mantenimiento | El tablero de mantenimiento |
| Terapeuta y Especialista | La pantalla de especialistas |
| Comunicación Familiar | Inicio de coordinación |
| Trabajo Social | Su tablero de trabajo social |
| Administrador de Red | Corporate HQ |
| Enfermería, Supervisión, Dirección | La pantalla de Insights |

**El hub del cuidador**

![Tres puertas y nada más. Fíjate en el número naranja de Mis Observaciones: eso es lo que está esperando respuesta tuya, no del turno.](/academy/capturas/care-hub-aterrizaje.jpg)

**Iniciar Turno** abre la tableta del piso. **Academy** es tu formación. **Mis Observaciones** son las que alguien te escribió a ti. Cuando ya llevas turnos trabajados, arriba te sale tu puntuación del momento con una frase de qué la está moviendo.

**La tableta del piso**

![Arriba está todo lo que necesitas del turno: que es Mañana, tu color del día (BLUE) y Entregar Turno. Debajo, cuántos residentes son tuyos y cuál llevas por cobertura.](/academy/capturas/care-turno-lista.jpg)

**Los dos entornos, para quien trabaja en los dos**

Supervisión y dirección se mueven entre dos espacios, y el color de la barra lateral dice en cuál estás: **Corporate HQ** con barra oscura, **Clinical Care** con barra blanca. Se cambia con la pastilla de la barra de arriba, que va rotulada con el sitio donde estás; al tocarla ofrece **Entorno Clínico** y **Global Corporativo**.

En celular y tableta la barra lateral se esconde. El botón de tres rayas la abre.

Si tocas una opción del menú y la pantalla te devuelve a tu inicio, no es culpa tuya ni un error que hayas hecho: es un enlace que no te corresponde. Repórtalo y sigue.

**Los grupos de color**

Los residentes se reparten en cuatro colores, Rojo, Amarillo, Verde y Azul, y además hay residentes todavía sin asignar, que el sistema trata aparte.

Tu color **no lo eliges tú**. Sale del horario de la semana que publica tu supervisora, y el sistema te lo aplica al abrir turno. Si abres turno y la lista de residentes sale vacía, casi siempre es lo mismo: el horario de esa semana está en borrador, sin publicar. Avisa a tu supervisora; no es algo que se arregle desde la tableta.

PREGUNTAS:
P: Carmen es cuidadora. Escribe su correo y su PIN. ¿Dónde cae?
a) Escoge en un menú cuál módulo quiere abrir ese día
b) Cae en el tablero corporativo y desde ahí baja al piso
c) Cae donde se quedó la cuidadora del turno anterior
*d) Cae directo en su hub de cuidado, sin escoger nada
EXPLICACION: Cada rol tiene su pantalla de aterrizaje: cocina cae en cocina, limpieza en limpieza y el Administrador de Red en Corporate HQ.

P: Desde el hub del cuidador salen tres puertas. ¿Cuáles son?
a) Residentes, Medicamentos y Vitales del turno
*b) Iniciar Turno, Academy y Mis Observaciones
c) eMAR, Rondas y Reporte de relevo firmado
d) Mi Perfil, Notificaciones y Horario semanal
EXPLICACION: El turno se abre desde Iniciar Turno; las otras dos son tu formación y las observaciones que alguien te escribió.

P: Ana es supervisora, está en una pantalla corporativa y quiere volver al piso. ¿Cómo lo hace?
*a) Con la pastilla de Cambiar Entorno de la barra de arriba
b) Cerrando sesión y volviendo a entrar con su correo y su PIN
c) Bajando hasta el final del menú oscuro y tocando Salir
d) Escribiendo a mano la dirección de la tableta del piso
EXPLICACION: La pastilla dice dónde estás, Corporate HQ o Clinical Care, y el desplegable ofrece Entorno Clínico y Global Corporativo.

P: ¿De dónde sale tu grupo de color?
a) Lo escoges tú al abrir el turno en la tableta
b) Lo hereda del color de la cuidadora anterior
c) Lo reparte el sistema al azar entre las que están de turno
*d) Del horario de la semana que publica tu supervisora
EXPLICACION: Hay cuatro colores, Rojo, Amarillo, Verde y Azul, y además residentes todavía sin asignar, que el sistema trata aparte.

P: Carmen abre turno un lunes y la lista de residentes le sale vacía. ¿Qué pasó?
a) Se le venció el PIN y tiene que pedir uno nuevo
b) Le toca escoger su grupo de color a mano primero
*c) El horario de esa semana no está publicado todavía
d) Todos sus residentes están hoy en el hospital o de alta
EXPLICACION: Pasa a principio de semana: la pauta existe en borrador, nadie le dio a publicar, y el sistema no lee borradores. Avisa a supervisión.

---SECCION_4---
LECTURA:
# Entrar, firmar, y lo que queda con tu nombre

**Dos cosas, no una**

La pantalla de entrada pide dos datos: **Identificación (Email)** y **PIN Clínico / Familiar**. El correo te lo da la administración al darte de alta; el PIN es tuyo. Sin los dos no entras.

La sesión dura **ocho horas como máximo** y después se cierra sola. Es un tope, no una promesa: si se te cierra a mitad del turno, vuelves a entrar y sigues.

**Esto es lo que hay que entender del PIN**

El PIN abre la sesión. **De ahí en adelante, todo lo que se registre en ese aparato lleva tu nombre, aunque lo teclee otra persona.**

La tableta no te vuelve a pedir el PIN para firmar. Cuando firmas el pack de medicamentos, lo que dejas es un trazo con el dedo, y ese trazo se guarda a nombre de la sesión que está abierta. Nadie comprueba de quién es la mano.

Por eso la regla no es solo no prestes tu PIN. Es esta:

- La tableta con tu sesión abierta **es tu firma**. Si la dejas sola, la dejas firmada.
- Al terminar, entregas el turno y cierras sesión. En cada aparato que usaste.
- Si crees que alguien sabe tu PIN, se dice ese mismo día. No se espera a que pase algo.

**El único sitio donde el PIN firma solo**

En el kiosco del lobby, cuando llega una visita fuera de horario, la tableta pide un PIN para autorizarla. Ahí sí el PIN funciona como firma suelta, y solo lo pueden teclear supervisión, enfermería y dirección (Director Ejecutivo o Administrador de Red). El PIN se comprueba y se descarta, no se guarda en ninguna parte. Lo que queda escrito en el registro de la visita es el nombre de quien autorizó.

**HIPAA, en dos líneas**

El dato clínico no sale de la plataforma: ni foto, ni captura de pantalla, ni mensaje, ni comentario con alguien de fuera del hogar. Y no se abre el expediente de quien no está bajo tu cuidado, acordándote de que esa lectura también queda grabada.

PREGUNTAS:
P: ¿Qué te pide la pantalla de entrada de Zéndity?
a) Solo tu PIN de cuatro dígitos
*b) Tu correo y tu PIN, hacen falta los dos
c) Tu nombre completo y tu PIN clínico
d) Tu número de empleado, tu correo y tu PIN
EXPLICACION: El primer campo dice Identificación (Email) y el segundo PIN Clínico / Familiar; el correo te lo da la administración al darte de alta.

P: ¿Cuánto dura como máximo una sesión abierta?
*a) Ocho horas: pasado ese rato se cierra sola
b) Lo que dure tu turno, hasta que lo entregues
c) Hasta que entre otra persona
d) Sin límite: queda abierta hasta que tú la cierres
EXPLICACION: Es un tope, no una promesa: si se te cierra a mitad del turno, vuelves a entrar con tu correo y tu PIN y sigues trabajando.

P: Carmen deja su sesión abierta en la tableta y va al baño. Otra compañera registra ahí el baño de Luis Ortega (112). ¿Con qué nombre queda?
a) Con el de la compañera, que es quien lo escribió
b) Con los dos, porque la tableta guarda quién la usa
*c) Con el de Carmen: el registro va a la sesión abierta
d) Sin nombre, hasta que alguien firme el reporte del turno
EXPLICACION: La tableta no vuelve a pedir el PIN para firmar; por eso prestarla con tu sesión abierta es lo mismo que prestar tu firma.

P: En el kiosco del lobby llega un hijo a las nueve de la noche. La tableta pide un PIN para autorizar la visita. ¿Quién lo teclea?
a) El hijo, con el PIN familiar que le dieron al ingresar
b) La cuidadora de turno, con el PIN del propio kiosco
c) Nadie: fuera de horario el kiosco no deja entrar a nadie
*d) Supervisión, enfermería o dirección, con su propio PIN
EXPLICACION: Es el único sitio donde el PIN se teclea suelto como firma; se valida y se descarta, y lo que queda guardado es quién autorizó.

P: ¿Cuál de estas cosas es una violación de HIPAA?
*a) Mandar por mensaje la foto de una nota clínica del piso
b) Abrir el expediente de un residente que tienes hoy
c) Firmar un medicamento con tu propio dedo en la tableta
d) Cerrar sesión en la tableta cuando terminas de documentar
EXPLICACION: El dato clínico no sale de la plataforma: ni foto, ni captura, ni mensaje, ni comentario con alguien de fuera del hogar.

---SECCION_5---
LECTURA:
# Tu día, de la entrada al cierre

**Al entrar**

1. Tu correo y tu PIN.
2. Caes en la pantalla de tu puesto. Mira las alertas y el contador de Mis Observaciones antes de subir.
3. Abre turno y comprueba que te salen tus residentes. Si la lista sale vacía, avisa antes de empezar.

**Durante el turno: nota o alerta**

Se registra en el momento, no al final. Un registro tardío ya no sirve para decidir nada.

Desde **Acciones**, en la tableta, lo primero es escoger **qué traes**. Hay seis botones: Cambio Clínico u Observación, Señalamiento de Familia, Incidente de Mantenimiento, Alerta Piel / UPP, Medicamento sin administrar y Alerta Crítica: Caída.

Y dentro del primero —**Cambio Clínico u Observación**— viene la segunda pregunta, que es la que decide quién se entera y cuándo:

| Nota de turno | Alerta clínica |
|---|---|
| Algo que hiciste o notaste | Necesita que alguien lo atienda |
| Queda en el expediente | Va al supervisor |
| Pedro Santana (103) comió poco hoy | Pedro Santana (103) lleva dos días sin comer y está confuso |

Los otros cinco botones no preguntan esto: ya saben lo que son. Una caída es **Alerta Crítica: Caída** y va por su camino; una gotera es **Incidente de Mantenimiento** y va al suyo. Escoger bien el botón —y dentro del primero, escoger bien entre nota y alerta— decide si alguien se entera ahora o dentro de ocho horas.

**Al cerrar: tu turno se cierra cuando firmas**

![Lo dice el aviso de arriba a la derecha: tu turno se cierra cuando firmes este reporte. Cerrar sesión no lo cierra, y el recuadro verde te dice adónde va lo que firmas.](/academy/capturas/care-turno-entregar.jpg)

Tocas **Entregar Turno**. El asistente arma el reporte con lo que hiciste (medicamentos, baños, comidas, vitales, incidentes), tú lo lees, lo corriges si algo está mal y lo firmas con el dedo.

**Cerrar sesión no cierra el turno.** Son dos cosas distintas. Si te vas sin firmar, quien entra no sabe qué pasó en el tuyo, y ese turno queda contado en tu pantalla de Mi Desempeño, en la medida Turnos cerrados con el relevo. No te descuenta puntos. Se ve, que es peor y es justo.

**La formación te llega sola**

![La franja amarilla no la pediste tú. Fíjate en la línea de abajo de cada curso: dice de dónde salió, si es la certificación geriátrica o un incidente de cuidado del residente.](/academy/capturas/academy-entrada.jpg)

Nadie tiene que acordarse de inscribirte. Al darte de alta, tu rol recibe una ruta de cursos, y este es el primero de todas ellas. Una observación de personal puede añadirte otro, con siete días de plazo. Mientras te falte uno, un aviso te sigue por la app y se pone rojo en los últimos tres días.

**Cuándo avisar a la administración**

- Tu PIN no funciona, o crees que alguien lo sabe.
- Ves un dato que no cuadra en un expediente. Lo avisas; no lo corriges tú.
- Tocas una opción del menú y te devuelve a tu pantalla.
- Una pantalla no carga o se queda dando vueltas.

Lo que no se hace es arreglar por cuenta propia datos que no te tocan. Cuando alguien corrige lo ajeno, el expediente deja de decir quién cambió qué.

PREGUNTAS:
P: Carmen nota que Pedro Santana (103) comió poco y está más callado que de costumbre. No hay nada urgente. ¿Qué escoge?
a) Alerta clínica, que va al supervisor
*b) Nota de turno, que queda escrita en el expediente
c) Alerta Caída, que es el botón que abre el reporte más rápido
d) Nada por escrito: lo cuenta de palabra al entregar el turno
EXPLICACION: La alerta es para lo que necesita que alguien lo atienda; la nota es para lo que hiciste o notaste y tiene que quedar escrito.

P: Carmen termina, cierra sesión en la tableta y se va a su casa. ¿Quedó cerrado su turno?
a) Sí: cerrar sesión es lo que cierra el turno
b) Sí, siempre que haya firmado todos los medicamentos
c) Lo cierra sola la supervisora cuando revisa los reportes
*d) No: el turno se cierra al firmar el reporte de relevo
EXPLICACION: El asistente arma el reporte con lo que hiciste, tú lo lees, lo corriges si hace falta y lo firmas con el dedo en la tableta.

P: A Carmen le sale un aviso rojo: le falta una certificación y quedan dos días. ¿De dónde salió ese curso?
a) Lo escogió ella del catálogo y se le olvidó terminarlo
b) Lo pidió la familia de un residente después de una queja
*c) Se lo asignó el sistema, y viene con fecha límite
d) Se lo puso Zéndity a todo el personal del país a la vez
EXPLICACION: Al darte de alta, tu rol recibe una ruta de cursos, y una observación de personal puede añadirte otro con siete días de plazo.

P: Carmen toca Cocina y Nutrición en el menú y la pantalla la devuelve a su hub. ¿Qué hace?
*a) Lo reporta a la administración: no es culpa suya
b) Lo toca otra vez hasta que cargue
c) Entra con el correo de una compañera de cocina para verlo
d) Deja de usar el menú y escribe las direcciones a mano
EXPLICACION: Un enlace visible que rebota es un fallo del sistema, no un castigo ni un error de quien lo toca; se avisa, se anota y se sigue.

P: ¿Dónde ve Carmen cuántos de sus turnos cerró con el relevo firmado?
a) En la pantalla de reportes de turno de la supervisora
b) En el hub, debajo de las tres puertas
*c) En su pantalla de Mi Desempeño, entre sus medidas
d) En un correo que le llega al final de cada semana
EXPLICACION: Aparece como Turnos cerrados con el relevo, con cuántos de cuántos; es una medida que se ve, no un puntaje que castigue.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 2: PROCESO DE ADMISION
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ADMISION_101',
    title: 'Proceso de Admision en Zendity',
    description: 'Domina el flujo completo de admision: desde el primer contacto en el CRM hasta la creacion del expediente, Plan de Vida y portal familiar.',
    durationMins: 30,
    bonusCompliance: 100,
    emoji: '📋',
    category: 'Protocolos Clinicos',
    order: 9,
    content: `---META---
TITULO: Proceso de Admision en Zendity
PROMPT_ZENDI: Evalúa si la persona sabe por qué pantalla entra de verdad un residente, qué se guarda solo y qué hay que guardar con un botón, qué pasa al pulsar COMPLETAR INGRESO OFICIAL, cuál es el único motivo por el que hoy no se puede confirmar un ingreso, y por qué los medicamentos del ingreso no llegan solos a la tableta.
TERMINOS_CLAVE: Intake Maestro, Admisión de Residentes, borrador, autoguardado, Guardar familiar, alergias, Downton, Braden, modificadores de dieta, COMPLETAR INGRESO OFICIAL, pendiente de revisión, Confirmar ingreso, cuota mensual, familiar, borrador sin autorizar, Revisar y autorizar, invitación
PREGUNTA_REFLEXION: Piensa en el último residente que entró a tu sede. ¿Qué supiste de él el primer día, cómo lo supiste, y qué te habría hecho falta saber antes de tenerlo delante?

---SECCION_1---
LECTURA:
# Por dónde entra de verdad un residente

Un residente entra a Zéndity por **una sola pantalla**: **Admisión de Residentes**, en el menú lateral, dentro de Área Clínica / Médica. Cuando se abre, el título que ves arriba es **Intake Maestro**, y debajo, en pequeño, **Cabina de Admisión Clínica Centralizada**.

Si alguien te habló de un "CRM" o de un "pipeline de prospectos": no lo busques. El CRM existe en el código pero está **dormido** desde el 26 de agosto de 2026, con **cero prospectos registrados** desde que Zéndity existe, y su enlace no aparece en el menú de nadie. Un curso viejo enseñaba a admitir por ahí. No se admite por ahí.

## Quién puede abrir esta pantalla

| Rol | ¿Entra al Intake Maestro? |
|---|---|
| Dirección, administración, supervisión | Sí. Es su pantalla |
| Enfermería | No. Zéndity la devuelve a su pantalla de inicio |
| Cuidadora | No. La devuelve a su hub de cuido |

No es un descuido: **en Vivid la admisión la hace dirección**. No existe un "departamento de admisiones". Si tú eres cuidadora o enfermera, este curso no es para que la hagas. Es para que sepas de dónde salió la información del residente nuevo que te toca hoy, qué falta todavía, y a quién preguntarle.

## Los seis bloques

![El índice lateral del Intake Maestro: los seis bloques de admisión, con Identidad Base abierto. En ese orden y con esos nombres se llena un ingreso.](/academy/capturas/intake-indice-pasos.jpg)

| Bloque | Qué se llena ahí |
|---|---|
| 1. **Identidad Base** | El nombre completo. Nada más |
| 2. **Triage Clínico** | Alergias, diagnóstico principal, historia y cirugías |
| 3. **PAI y Riesgos** | Movilidad, dieta, riesgo de caídas y riesgo de piel |
| 4. **Log Farmacológico** | Los medicamentos con su hora y sus días |
| 5. **Documentos e Identificación** | Nacimiento, habitación, cuota, seguro, ID y familiar |
| 6. **Análisis Zendi** | Subes la foto de un documento y Zendi propone los campos |

Se puede saltar de un bloque a otro tocando el índice. No hay que ir en orden.

## Casi nada lleva botón de guardar

Escribes y esperas. Arriba a la derecha, bajo **Estado del Sincronismo**, va cambiando solo: **Autoguardando...**, luego **Borrador Asegurado**, luego **Al día en la Nube**.

Y hay una cosa que conviene entender bien: **en cuanto escribes el nombre completo, el expediente ya existe**. No es un formulario en blanco que se manda al final. La ficha nace en ese momento, en borrador, y todo lo demás se le va colgando encima. Si te interrumpen a mitad —y en un hogar te interrumpen— cierras, vuelves, y lo escrito está.

## La excepción, y es la cara

Los bloques 1 al 4 se guardan solos. Los datos del residente del bloque 5 —la pantalla lo llama **paso 5**— también: nacimiento, habitación, cuota, seguro, ID.

**El familiar no.** Ese recuadro del mismo paso 5 tiene **su propio botón**: **Guardar familiar**. Mientras no lo pulses, el familiar **no está escrito en ninguna parte**, por mucho que arriba siga diciendo "Al día en la Nube". Escribir el nombre y el correo y saltar al bloque siguiente es perderlo.

No es un detalle de programación. Ese botón sin pulsar es la razón de que en Cupey **5 de los 9 ingresos** posteriores a la carga inicial entraran **sin nadie a quien avisar**. Y dos secciones más abajo verás que un ingreso sin familiar **no se puede confirmar**: es el mismo botón, cobrándose la factura más tarde y en otra pantalla.

PREGUNTAS:
P: ¿Por qué pantalla entra hoy un residente nuevo a Zéndity?
a) Por el pipeline de prospectos, en CRM y Ventas
b) Por Documentos Legales, generando primero el contrato
*c) Por Admisión de Residentes, el Intake Maestro
d) Por la tableta de cuido, al abrir el turno de mañana
EXPLICACION: El CRM lleva dormido desde el 26 de agosto de 2026, con cero prospectos registrados, y su enlace no está en el menú de nadie.

P: ¿Qué se llena en el bloque 1, Identidad Base?
a) Los diagnósticos y las alergias del residente
*b) El nombre completo
c) La cuota mensual y el plan médico
d) Los medicamentos con su hora y sus días
EXPLICACION: Es el único campo obligatorio de ese bloque, y con él basta: el expediente queda creado en borrador y los demás bloques se habilitan.

P: Estás en el paso 5 del ingreso de Rosa Medina. Acabas de escribir a su hija, no has pulsado nada, y te llaman. ¿Qué pasa?
a) No se pierde nada: el asistente guarda solo todo lo que escribes
*b) Se pierde la hija, porque ese recuadro sí tiene botón
c) Se pierde todo el paso 5 y hay que volver a empezarlo entero
d) Queda bloqueado hasta que lo desbloquee dirección
EXPLICACION: Todo lo demás se guarda solo —Autoguardando, Borrador Asegurado, Al día en la Nube—, pero el familiar hay que guardarlo con su botón. En Cupey ese botón sin pulsar dejó 5 de 9 ingresos sin nadie a quien avisar.

P: Eres cuidadora y quieres abrir el Intake Maestro para ver el ingreso de un residente. ¿Qué pasa?
a) Lo abres en modo lectura, sin poder escribir nada
b) Te pide el PIN de la supervisora para poder entrar
*c) Zéndity te devuelve a tu hub de cuido
d) Entras igual, porque el curso es obligatorio para todos
EXPLICACION: La admisión en Vivid la hace dirección. Lo que sí ves tú del ingreso llega solo a la tarjeta del residente en tu tableta.

P: ¿Qué hace el bloque 6, Análisis Zendi?
*a) Lee la foto de un documento y propone los campos
b) Genera el contrato y lo manda a firmar
c) Avisa a la familia de que el ingreso empezó
d) Calcula el riesgo de caídas del residente
EXPLICACION: Subes un ID, una tarjeta de seguro o una receta y Zendi extrae los datos para que los apliques al perfil; el archivo original no se guarda, solo el análisis.

---SECCION_2---
LECTURA:
# Alergias, dieta y los dos números que crean trabajo en el piso

## Bloque 2 — Triage Clínico Base

Tres campos, y el primero va en rojo por algo:

- **Alergias Conocidas (Crítico)**. El ejemplo que trae dentro lo dice: "Penicilina, Sulfa. Escribir NINGUNA si no aplica". Si lo dejas vacío, al intentar cerrar el ingreso salta **Advertencia: Alergias no especificadas** y no sigue.
- **Diagnóstico Principal**
- **Historia y Cirugías**

**Vacío y "no tiene" no son lo mismo.** Quien lea esa ficha dentro de seis meses no va a saber si el residente no tiene alergias o si nadie preguntó. Por eso se escribe NINGUNA.

## Bloque 3 — Plan de Vida (PAI) y Riesgos

![El bloque de PAI y Riesgos: a la izquierda movilidad y el régimen dietético con sus cuatro modificadores; a la derecha las dos escalas, Downton para caídas y Braden para úlceras.](/academy/capturas/intake-paso-3-riesgos.jpg)

Aquí casi todo se marca con el dedo:

- **Movilidad y Asistencia**: Independiente, Apoyo Menor, Silla Ruedas, Encamado.
- **Régimen Dietético**: Regular, Blanda, Majada, Puré, Licuado, Líquidos Claros, PEG (Sonda). Y debajo, los **Modificadores**: Diabética, Baja en sodio, Renal, Vegetariana.
- **Riesgo de Caídas — Escala Downton**.
- **Riesgo UPPs (Úlceras) — Escala Braden**.

La dieta completa sale de aquí. La pantalla lo dice con estas palabras: "Marca los que apliquen. Llegan solos al perfil del residente y a la pantalla de cocina, no hay que volver a ponerlos". Antes había que marcarlos dos veces, en dos pantallas, el mismo día.

## Las dos escalas van al revés

| Escala | Mide | Va de | El número malo es |
|---|---|---|---|
| **Downton** | Caídas | 0 a 6 | el **alto**. La pantalla rotula Crítico (6) |
| **Braden** | Piel y úlceras | 6 a 23 | el **bajo**. Crítico (6), Sin Riesgo (23) |

La tarjeta cambia de teal a rojo sola cuando el número cruza. Y eso no es decorado:

- **Downton por encima de 2** enciende el riesgo de caídas de ese residente. Empieza a contar en el panel de dirección y en el módulo de caídas.
- **Braden por debajo de 14** enciende el riesgo de piel. Eso sí lo ves tú en la tableta: la tarjeta del residente muestra **Alto riesgo piel** y la columna **Rotación** empieza a pedir cambios posturales, con su plazo.

El deslizador de Braden arranca en 23, que es "sin riesgo". Un encamado cuyo deslizador nadie movió entra al hogar **sin protocolo de piel**, y en la tarjeta su columna de Rotación dice **N/A**. Es el error más caro de este bloque, y no da ningún error en pantalla: simplemente nadie le rota.

PREGUNTAS:
P: En la escala Braden, ¿qué número es el malo?
a) El alto: 23 es el peor de todos
*b) El bajo
c) Da igual, lo único que cuenta es el color
d) Ninguno, Braden es solo informativo
EXPLICACION: La pantalla lo rotula de izquierda a derecha: Crítico (6) y Sin Riesgo (23). Por debajo de 14 se enciende el riesgo de piel del residente.

P: El ingreso de un residente encamado deja Braden en 23 sin tocarlo. ¿Qué pasa en tu tableta?
a) Sale una alerta roja al supervisor cada turno
b) La tarjeta pide vitales cada dos horas
*c) La columna Rotación dice N/A y nadie le rota nunca
d) El residente desaparece del censo del turno
EXPLICACION: El riesgo de piel se enciende con Braden por debajo de 14; sin él la tarjeta no pide cambios posturales y un encamado se queda sin protocolo.

P: El ingreso de un residente diabético marca dieta Blanda y el modificador Diabética. ¿Hay que volver a marcarlo en el perfil del residente?
*a) No
b) Sí, en el perfil del residente y otra vez en cocina
c) Sí, pero solo lo puede hacer enfermería
d) Sí, cada vez que cambia el menú del día
EXPLICACION: La textura y los cuatro modificadores viajan juntos desde el ingreso al perfil y a la pantalla de cocina. La propia pantalla avisa de que no hay que repetirlo.

P: Vas a cerrar el ingreso y el campo de alergias está vacío porque el residente no tiene ninguna. ¿Qué escribes ahí?
a) Nada, porque vacío ya significa que no tiene
b) El diagnóstico principal, para poder seguir
c) Un guion, para que se vea que lo miraste
*d) NINGUNA
EXPLICACION: Vacío y "no tiene" se ven igual seis meses después, y además el asistente no deja emitir el ingreso sin alergias: avisa Advertencia, Alergias no especificadas.

P: ¿Qué enciende un Downton por encima de 2?
a) Una cita automática con el médico del residente
*b) El riesgo de caídas del residente
c) La rotación postural cada dos horas
d) Un aviso a la familia por el portal familiar
EXPLICACION: Downton mide caídas y Braden mide piel; confundirlos deja al residente equivocado con el protocolo equivocado. Después, cada caída vuelve a recalcularlo.

---SECCION_3---
LECTURA:
# Los medicamentos que escribes aquí NO llegan a la tableta

Bloque 4, **Log Farmacológico**. En pantalla se titula **Inventario Farmacológico (eMAR)**.

Se añaden de uno en uno:

1. Escribes nombre y dosis en **Añadir Nuevo Medicamento** y pulsas **Añadir**.
2. Marcas las horas en **Horarios Asignados**: 05:00 AM, 06:00 AM, 08:00 AM, 12:00 PM, 02:00 PM, 05:00 PM, 08:00 PM, 10:00 PM y **PRN**, para los de razón necesaria.
3. Contestas **¿Todos los días, o solo algunos?**

## La única trampa del paso

![El caso del alendronato: el nombre con su dosis, la hora marcada, Solo ciertos días escogido, y el aviso ámbar de que hay que marcar al menos un día.](/academy/capturas/intake-medicamento-dias.jpg)

Si eliges **Solo ciertos días** y no marcas ninguna letra, sale el aviso en ámbar: **Marca al menos un día, o quedará como todos los días**.

No es un capricho. Una pauta semanal sin día **no toca nunca**, y un medicamento que no aparece jamás en ninguna tableta es peor que uno que aparece de más. Por eso Zéndity prefiere degradarlo a diario antes que dejarlo mudo. El alendronato de los viernes es el caso típico: 70 mg, 08:00 AM, Solo ciertos días, V. En la lista de borradores queda con su etiqueta ámbar, **Solo Viernes**.

## Y ahora lo importante

Lo que escribes aquí **no se convierte en una receta viva**.

| Lo que SÍ hace este bloque | Lo que NO hace |
|---|---|
| Deja escrita la lista que trajo el residente | Poner el medicamento en la tableta |
| Guarda hora, días y dosis | Crear el pack de las 8:00 |
| Mete el fármaco en el catálogo de farmacia | Avisar a nadie de que hay uno nuevo |

Al cerrar el ingreso, cada medicamento entra como **borrador inactivo**. No sale en la tableta de la cuidadora, no genera pack, nadie lo va a dar. Y eso es **a propósito**: es una barrera clínica. Alguien tiene que mirar el papel del hospital antes de que se empiece a dar.

## Dónde se levanta la barrera

![La tarjeta de Luis Ortega en Med & Zoning: arriba su receta viva y debajo el recuadro ámbar del ingreso, con el botón Revisar y autorizar.](/academy/capturas/med-borrador-sin-autorizar.jpg)

En **Med & Zoning**. En la tarjeta del residente, debajo de su receta viva, aparece un recuadro ámbar: **Del ingreso, sin autorizar**, con la frase **Se capturaron en la admisión y NO llegan a la tableta hasta que se autoricen aquí**, y un botón **Revisar y autorizar**.

El modal se llama **Autorizar la receta del ingreso** y arranca avisando: **Esto la pone en la tableta. Comprueba la hora y los días antes de firmar.** Pide tres cosas —**¿Cada cuándo?**, **Horario de Suministro** y una **Razón Obligatoria (HIPAA)**— y se cierra con **Aplicar Sello**. Queda firmado con tu nombre y tu razón, para siempre.

Ahí llegan enfermería, supervisión, dirección y administración. La cuidadora no.

**Si eres cuidadora:** un residente nuevo cuya tarjeta no pide ningún medicamento **no es una tableta rota**. Casi siempre es una receta que todavía nadie autorizó. Avisa. No des por tu cuenta lo que venga escrito en el papel del hospital.

PREGUNTAS:
P: Añades Alendronato 70 mg, marcas 08:00 AM y Solo ciertos días, pero no marcas ninguna letra. ¿Qué queda guardado?
a) Nada, el medicamento no se añade
*b) Un medicamento de todos los días
c) Un medicamento solo para el lunes
d) Un medicamento por razón necesaria, sin hora
EXPLICACION: La pantalla lo avisa antes en ámbar: una pauta semanal sin día no toca nunca, y prefiere degradarla a diaria antes que dejar el medicamento mudo.

P: Cierras el ingreso de un residente con cuatro medicamentos. ¿Cuáles ve esa noche la cuidadora en su tableta?
*a) Ninguno
b) Los cuatro, en el pack de su hora
c) Los cuatro, pero marcados como pendientes de firma
d) Solo los de la mañana; los de la noche entran mañana
EXPLICACION: Entran como borrador inactivo a propósito, porque es una barrera clínica: hasta que alguien los autorice en Med & Zoning no existen para la tableta.

P: ¿Dónde se autoriza un borrador que viene del ingreso?
a) En el asistente, pulsando otra vez COMPLETAR INGRESO OFICIAL
*b) En Med & Zoning, con Revisar y autorizar
c) En la tableta, la primera vez que se da
d) En el expediente del residente, pestaña Trabajo Social
EXPLICACION: El recuadro ámbar Del ingreso, sin autorizar está en la tarjeta del residente, justo debajo de su receta viva.

P: El modal de autorizar exige una Razón Obligatoria (HIPAA). ¿Para qué sirve?
a) Para avisar a la familia del cambio de receta
b) Para calcular el costo del medicamento en la factura
*c) Para dejar escrito quién lo autorizó, cuándo y por qué
d) Para que la farmacia sepa cuánto pedir
EXPLICACION: Poner una receta en la tableta es una decisión clínica con dueño; la razón y el nombre quedan en el registro de auditoría del medicamento.

P: Eres cuidadora. Entra un residente nuevo y su tarjeta no pide ningún medicamento. ¿Qué haces?
a) Le das lo que traiga escrito en su papel del hospital
b) Lo anotas al final del turno y sigues trabajando
c) Esperas a que aparezcan solos en el próximo pack
*d) Avisas: hay recetas del ingreso sin autorizar
EXPLICACION: Una cuidadora no puede crear ni activar una orden de medicamento; eso es de enfermería para arriba, y hasta que se autorice no hay nada que dar.

---SECCION_4---
LECTURA:
# Cerrar el ingreso: dos actos, y un solo candado

Cerrar un ingreso son dos pulsaciones separadas: primero **COMPLETAR INGRESO OFICIAL**, dentro del asistente; después **CONFIRMAR INGRESO**, en el panel de la pantalla de admisión.

Están separadas para que quepa una revisión en medio. Pero conviene saber lo que Zéndity **no** hace: **no comprueba que sean dos personas distintas**. El panel de confirmación está en la misma pantalla, lo abre el mismo rol que hizo la admisión, y en Vivid la admisión la hace dirección. Nada impide —ni avisa— que la misma persona complete, vuelva atrás y confirme acto seguido. El segundo par de ojos, si lo quieres, lo pones tú; el sistema no lo pone por ti.

## Acto 1 — COMPLETAR INGRESO OFICIAL

Abajo a la izquierda, bajo el rótulo **Validación Final**, hay un botón verde grande: **COMPLETAR INGRESO OFICIAL**. Debajo, en letra pequeña: **Bloqueará la edición inicial**.

Al pulsarlo, en un solo golpe:

- El ingreso deja de ser borrador y pasa a **pendiente de revisión**.
- La dieta con sus modificadores **se copia al perfil** del residente, y de ahí a cocina.
- Se encienden, o no, los dos riesgos, según Downton y Braden.
- Se crea el **Plan de Vida (PAI)** en borrador, con el historial clínico y la movilidad dentro.
- Los medicamentos quedan como **borradores sin autorizar**.

Sale un aviso: **Ingreso Completado. Residente en Radar Operativo**, y te lleva al directorio de residentes.

### Dos cosas que este golpe NO hace

**La movilidad no va al perfil del residente.** Va al PAI, que es otra pantalla. Al perfil solo viajan la dieta, sus cuatro modificadores y los dos riesgos. Si buscas en el perfil si alguien anda en silla de ruedas, no está ahí.

**La continencia no se pregunta en ningún bloque.** No hay casilla en los seis. El PAI de todo ingreso nace diciendo **Continente**, sea o no cierto, porque no hay nadie que lo haya decidido. Si el residente que te toca hoy no lo es, el PAI está equivocado hasta que alguien lo corrija a mano desde el PAI. No te fíes de ese campo en un residente recién admitido.

## Acto 2 — Confirmar ingreso

Al volver a **Admisión de Residentes**, lo primero de la pantalla es un panel rosa: **Ingresos pendientes de confirmación clínica**, con la línea "Estos residentes completaron el formulario de admisión y esperan tu revisión final".

![El panel rosa con los dos casos: Carmen Delgado lleva 4 días y su contador está en rojo; Pedro Santana lleva 1 día y no se puede confirmar porque le falta el familiar.](/academy/capturas/intake-revisiones-pendientes.jpg)

Cada residente trae **En revisión desde hace N días** y un botón **CONFIRMAR INGRESO**. El contador cambia de color solo: **ámbar hasta 2 días, rojo desde 3**. Y si un ingreso lleva **más de siete días** ahí parado, el vigilante de Zéndity lo levanta como anomalía de la sede. No es un repaso de la noche: pasa **cada seis horas**, cuatro veces al día.

Nadie mide 24 horas en ninguna parte. Eso lo decía un curso viejo y no existe.

Confirmar es **irreversible**, y la pantalla te lo pregunta con esas palabras antes de hacerlo. Después, el ingreso queda sellado y ya no se puede volver a emitir.

## El único candado

Hoy una confirmación falla por **una sola cosa**: **falta el familiar**.

El panel lo dice ahí mismo, en rojo: **No se puede confirmar: falta el familiar**, con dos botones, **Abrir expediente** y **No tiene familiar conocido**. Las dos salidas son válidas. Si el residente de verdad no tiene a nadie, se declara con un motivo escrito, y queda constancia de quién lo declaró y cuándo. Lo que no vale es dejarlo vacío: "no tiene familia" y "nadie preguntó" se ven igual, como con las alergias.

| Lo que SÍ bloquea una confirmación | Lo que NO la bloquea |
|---|---|
| Cero familiares sin declarar que no tiene | Que falte la cuota mensual |
| | Que falte el historial médico |
| | Que falte la foto o la habitación |
| | Que falten documentos legales en papel |

La "documentación mínima" que enseñaba el curso viejo **no bloquea nada**. Zéndity no te va a parar por un papel que falte. Te para por una sola cosa, y por ninguna más.

## La cuota: nadie te va a parar, y por eso te toca a ti

El paso 5 pide la **cuota mensual**, y hay escrito un mensaje para cuando falta: "Falta la cuota mensual. Sin ella este residente no entra en la facturación del mes."

**Ese mensaje no lo vas a ver nunca.** La comprobación existe, pero no llega a saltar: la cuota del residente nace en **0** en el momento en que se crea la ficha, así que por dentro nunca está "sin definir". El ingreso se confirma igual. El panel rosa tampoco la mira.

O sea que aquí no hay red. **Si nadie escribe la cuota, el residente entra, queda perfecto en pantalla, y sencillamente no aparece en la facturación del mes.** Es exactamente lo que pasó en agosto de 2026: cuatro ingresos se quedaron con la cuota en 0, el censo de facturación imprimió 30 de 34 residentes y nadie supo por qué faltaban cuatro. Unos $10 499 al mes sin facturar, en silencio, hasta septiembre.

Un **0 puesto a propósito** es una respuesta legítima —un residente cuyo pago no pasa por Zéndity—, pero es una decisión, no un descuido. Que el sistema no distinga los dos casos es justo el motivo por el que tienes que escribirla tú.

**Y una trampa práctica del mismo campo.** Mientras la cuota esté **en blanco**, el paso 5 **no guarda nada**: ni la fecha de nacimiento, ni la habitación, ni el seguro, ni el ID. Sale un error de guardado y se queda todo sin escribir. Si no sabes la cuota todavía, escribe 0 y corrígela después. Dejarla vacía no es "dejarla para luego": es quedarte sin el paso 5 entero.

PREGUNTAS:
P: ¿Qué hace el botón COMPLETAR INGRESO OFICIAL?
a) Confirma el ingreso y lo cierra del todo
b) Manda el expediente a la familia para que lo firme
*c) Pasa el ingreso a pendiente de revisión
d) Da de alta al residente en el censo del turno
EXPLICACION: En ese mismo golpe se copia la dieta al perfil, se encienden los riesgos, se crea el PAI en borrador y los medicamentos quedan sin autorizar.

P: Pedro Santana lleva 1 día en el panel rosa y su contador está en ámbar; el de Carmen Delgado, con 4 días, está en rojo. ¿Cuándo cambia el color?
a) A las 24 horas
*b) A partir del tercer día
c) A la semana
d) Cuando lo marca el supervisor
EXPLICACION: Ámbar hasta dos días y rojo desde tres. Lo único que pasa solo a los siete días es que el vigilante lo levanta como anomalía de la sede, en uno de sus cuatro repasos diarios.

P: Confirmas un ingreso y nadie llegó a escribir la cuota mensual de ese residente. ¿Qué pasa?
a) Zéndity no te deja confirmar hasta que alguien la escriba en el paso 5
*b) Se confirma, y ese residente no sale en la facturación del mes
c) Entra en la facturación con la cuota media de los demás residentes de la sede
d) Se queda en el panel rosa, en rojo, hasta que dirección la escriba
EXPLICACION: La cuota no para a nadie: la comprobación existe pero nunca salta, porque el campo nace en 0. En agosto de 2026 pasaron cuatro así y el censo imprimió 30 de 34.

P: El panel dice "No se puede confirmar: falta el familiar" y ese residente vino del hospital sin nadie localizable. ¿Qué haces?
a) Pones tu propio correo como contacto de la familia
b) Confirmas igual, que el familiar se añade después
*c) Pulsas No tiene familiar conocido y escribes el motivo por escrito
d) Esperas a que aparezca alguien antes de confirmar
EXPLICACION: Las dos salidas son válidas, y la declaración pide un motivo justo para que "no tiene familia" quede dicho en vez de deducido de un campo vacío.

P: Falta el historial médico de un residente. ¿Puede confirmarse su ingreso?
a) No, hasta que enfermería lo complete
b) No, el sistema lo bloquea igual que al familiar
c) Solo si la directora lo autoriza por escrito
*d) Sí
EXPLICACION: El único candado es el familiar. Que se pueda confirmar sin historial, sin cuota y sin papeles no quiere decir que esté bien dejarlos sin escribir.

---SECCION_5---
LECTURA:
# El familiar: cómo entra, y qué ve de verdad

## Nadie manda nunca un PIN por correo

El familiar se da de alta desde el expediente del residente, en la pestaña **Portal Familiar**, con el botón **Invitar familiar**. Pide nombre, email, teléfono, parentesco y nivel de acceso, y el modal avisa: **Enlace válido por 7 días**.

Lo que sale de ahí es **un enlace, no una clave**. El familiar lo abre, ve la pantalla del Portal Familiar y ahí **crea su propio PIN**: "Crea tu PIN", mínimo 4 dígitos, y "Confirma tu PIN". Mientras no lo cree, en la lista sale como **Invitación pendiente**; cuando lo crea, pasa a **Activo**.

| Lo que SÍ pasa | Lo que NO pasa |
|---|---|
| El familiar recibe un enlace y crea él su PIN | Zéndity manda un PIN por correo |
| El enlace caduca a los 7 días | La cuenta nace con un 123456 |
| Si lo olvida se pulsa **Resetear PIN** | El familiar cambia su PIN dentro del portal |

Un curso viejo decía que la cuenta nacía con "123456" y que había que decirle a la familia que lo cambiara enseguida. Ni nace así, ni existe una pantalla donde cambiarlo, ni se manda nunca un PIN por email. Si un familiar llama porque no puede entrar, lo que se hace es **reenviar la invitación**: el PIN viejo le sigue funcionando hasta que cree el nuevo.

## Una sola puerta

No hay dos aplicaciones. Empleados y familiares entran por la **misma pantalla de login**, donde el campo se llama literalmente **PIN Clínico / Familiar**. Lo que está separado es lo que se ve **después** de entrar: el familiar aterriza en su portal y no sale de ahí.

## "Acceso completo" no quiere decir acceso completo

Al invitar se elige entre **Acceso completo** y **Solo lectura**. Ese campo se guarda y se enseña en la lista, pero **no decide lo que la familia ve**. Lo decide otro ajuste del residente, que nace cerrado y que hoy no se cambia desde ninguna pantalla.

| La familia SÍ ve | La familia NO ve |
|---|---|
| El **Diario de Cuidado**: notas, momentos y fotos | Los números de sus signos vitales |
| Una frase de tranquilidad sobre sus signos | La lista de sus medicamentos |
| Si los medicamentos del día van al día o no | Nada de otros residentes ni del personal |
| Su Plan de Vida en versión familiar, citas y mensajes | El muro interno del hogar |

Un residente recién admitido tiene a su familiar con "Acceso completo" y aun así **sin un solo número clínico** en el portal. Si una familia te pide una cifra, no la busques ahí: no está. Esa conversación la tiene dirección.

## Cuando el residente ya no está

El portal se cierra solo. Si el residente pasa a fallecido o dado de alta, el familiar que intente entrar recibe: "Acceso cerrado. Para consultas sobre el expediente, comuníquese con la administración de la sede." No hay que acordarse de apagar nada.

Borrar a un familiar, en cambio, **es definitivo** y solo lo pueden hacer dirección o administración de la misma sede.

PREGUNTAS:
P: ¿Cómo obtiene su clave un familiar nuevo?
a) Se la dicta por teléfono el empleado
b) Le llega por correo el PIN 123456
*c) La crea él mismo, desde el enlace de invitación
d) La genera el sistema y la imprime dirección
EXPLICACION: Zéndity no manda nunca un PIN por email: manda un enlace que caduca a los 7 días, y el PIN se guarda cifrado cuando el familiar lo crea.

P: Una hija llama: no puede entrar al portal y no recuerda su PIN. ¿Qué se hace?
a) Se le dice el PIN por teléfono
*b) Se pulsa Resetear PIN, que le manda otro enlace
c) Se le crea una cuenta nueva
d) Se espera a que lo recuerde ella sola
EXPLICACION: El PIN está cifrado y nadie en el hogar puede leerlo; además el PIN viejo le sigue sirviendo hasta que abra el enlace y cree uno nuevo.

P: El familiar de Rosa Medina está registrado con "Acceso completo". ¿Ve la presión y el azúcar de Rosa en el portal?
*a) No
b) Sí, ese es justo el efecto de Acceso completo
c) Sí, pero con un día de retraso
d) Solo si la enfermera los publica cada día
EXPLICACION: El nivel de acceso se guarda y se enseña, pero no gobierna lo clínico: el portal da bandas y narrativa, no cifras. Los números los explica dirección.

P: ¿Por dónde entra un familiar a Zéndity?
a) Por una aplicación distinta, que se baja aparte
b) Por un enlace nuevo que le llega cada mañana
c) Por el muro del hogar, con el código de la sede
*d) Por la misma pantalla de login que tú
EXPLICACION: El campo se rotula PIN Clínico / Familiar precisamente porque la puerta es una sola; lo separado es lo que se ve después de entrar.

P: Un residente fallece. ¿Qué hay que hacer con la cuenta de su familiar?
a) Borrarla el mismo día para cerrar el acceso
b) Cambiarle el nivel a Solo lectura
*c) Nada, el portal se cierra solo
d) Mandarle un correo pidiéndole que no entre más
EXPLICACION: Al pasar el residente a fallecido o dado de alta, el portal deja de abrir y muestra un mensaje que remite a la administración de la sede.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 3: eMAR - REGISTRO ELECTRONICO DE MEDICAMENTOS
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'EMAR_101',
    title: 'eMAR: Administracion Electronica de Medicamentos',
    description: 'Domina el proceso de administracion segura de medicamentos usando el sistema eMAR de Zendity, desde el registro hasta la auditoria.',
    durationMins: 35,
    bonusCompliance: 125,
    emoji: '💊',
    category: 'Protocolos Clinicos',
    order: 10,
    content: `---META---
TITULO: eMAR: Administracion Electronica de Medicamentos
PROMPT_ZENDI: Evalua si la persona distingue lo que la tableta hace sola de lo que depende de ella: que el pack se cierra con una firma suya, que nadie avisa de una dosis que se quedo sin dar, que las alergias no se cruzan solas, y si sabe contar con un caso propio como resolvio una omision o un PRN con su motivo y su efecto.
TERMINOS_CLAVE: eMAR, pack, firma del pack, los 5 correctos, cuando se hizo, omitir, motivo de omision, rechazado, suspendido, PRN, efecto del PRN, solo ciertos dias, borrador de admision, Cardex, PDF del eMAR
PREGUNTA_REFLEXION: Cuenta la ultima vez que un residente tuyo no se tomo un medicamento. Que motivo elegiste al omitirlo, que escribiste en el texto, y a quien se lo dijiste ademas de la tableta. Si no te ha pasado todavia, cuenta el ultimo PRN que administraste y como supiste si hizo efecto.

---SECCION_1---
LECTURA:
# Lo que el eMAR hace por ti, y lo que no

El eMAR es el expediente de medicamentos de Zendity. Sustituye la hoja de papel donde se marcaba con una X lo que se daba. Vive en la tableta, dentro de la tarjeta de cada residente, en el boton teal que dice **Medicamentos**.

Vale la pena empezar por lo que NO hace, porque ahi es donde se pierden las dosis.

**No te avisa de lo que se queda sin dar.** No hay alarma de dosis atrasada. Si la dosis de las 8:00 AM de Rosa Medina 204 no se toca, dos horas despues un proceso automatico la marca como perdida y no le avisa a nadie: ni a ti, ni a enfermeria, ni a tu supervisora. Entrar a la tableta en cada ronda sigue siendo trabajo tuyo.

**No cruza alergias con medicamentos.** Las alergias del residente estan escritas en texto libre en el expediente y salen impresas en el formulario de traslado y en el resumen del residente. Pero el pack no las pinta nunca y nadie te va a detener si lo que tienes en la mano choca con una. Esa comprobacion es tuya. Y cuidado con lo contrario: un campo de alergias vacio no dice "no tiene alergias", dice que nadie lo pregunto.

Lo que si hace, y hace bien:

| Lo que el eMAR SI hace | Lo que NO hace |
|---|---|
| Junta en un pack los medicamentos de la misma hora | Recordarte que entres a mirar |
| Etiqueta Firmado lo que ya se dio, para que nadie lo repita | Avisar cuando una dosis se queda sin dar |
| Descarta una segunda firma del mismo medicamento en la misma hora del mismo dia | Comprobar alergias contra el medicamento |
| Avisa a enfermeria y supervision cuando omites algo | Avisar de lo que se administro con normalidad |
| Guarda tu firma y las dos horas: la que declaras y la del tecleo | Dejarte escribir una nota dentro del pack |

**Los 5 correctos** no te los pregunta la pantalla, pero el boton de firmar lleva escrito que los estas certificando: residente correcto, medicamento correcto, dosis correcta, via correcta y hora correcta.

**Quien puede hacer que.** No todos hacen lo mismo con el eMAR:

| Puesto | Que puede |
|---|---|
| Cuidadora | Administrar, omitir y registrar PRN. No receta ni descontinua |
| Enfermeria y de ahi para arriba | Todo lo anterior, mas recetar, descontinuar y la pantalla de Auditoria eMAR |
| Trabajo social | Leer el eMAR del residente. No escribe nada |
| Cocina y mantenimiento | No ven el eMAR |

Si eres cuidadora y buscas el boton de recetar, no esta roto: no lo tienes.

PREGUNTAS:
P: Nadie toca la dosis de las 8:00 AM de Rosa Medina. Que hace Zendity?
*a) A las dos horas la marca como perdida, en silencio
b) Manda una alerta a enfermeria y a la supervisora del turno
c) Deja el pack abierto y bloquea el resto del turno hasta resolverlo
d) Suena en la tableta hasta que alguien la atienda
EXPLICACION: Un proceso automatico la pasa a perdida dos horas despues de su hora y no avisa a nadie, y por eso entrar a la tableta en cada ronda es trabajo tuyo y no del sistema.

P: El campo de alergias de Rosa Medina esta vacio. Que significa?
a) Que no tiene alergias conocidas
b) Que sus alergias estan en el formulario de traslado
*c) Que nadie se lo ha preguntado todavia
d) Que el expediente no ha terminado de cargar
EXPLICACION: Vacio significa sin documentar, no sin alergias: de 33 residentes de Cupey 28 tenian ese campo sin llenar de verdad, asi que se confirma con enfermeria antes de medicar.

P: Eres cuidadora. El medico cambio la dosis de Luis Ortega 112 y quieres actualizarla en Zendity. Que pasa?
a) Puedes cambiarla desde el pack si escribes una razon de auditoria
b) Puedes cambiarla, pero solo durante tu propio turno
c) Puedes cambiarla desde la pantalla de Auditoria eMAR del menu lateral
*d) No tienes ese boton: recetar es de enfermeria para arriba
EXPLICACION: La cuidadora administra, omite y registra PRN; escribir o quitar una receta es de enfermeria, supervision, direccion y administracion.

P: Cual de estas cosas SI impide la tableta?
a) Que se de un medicamento al que el residente es alergico
*b) Que se firme dos veces el mismo medicamento en la misma hora
c) Que se le de el medicamento al residente equivocado de la misma habitacion
d) Que se recete un medicamento con un horario que la tableta no sabe leer
EXPLICACION: Lo ya resuelto sale etiquetado y el servidor descarta lo que ya tiene registro de hoy en esa hora; las otras tres pasan sin que el sistema diga una palabra.

P: En que dos situaciones el eMAR avisa solo a enfermeria y supervision?
*a) Cuando se omite un medicamento y cuando un PRN no hizo efecto
b) Cuando se firma un pack completo y cuando se cierra el turno
c) Cuando se administra fuera de hora y cuando llega un medicamento nuevo de farmacia
d) Cuando se abre el turno y cuando el residente sale del hogar
EXPLICACION: Toda omision manda aviso con el motivo y tu nombre, y un PRN contestado como sin efecto o como mejoro en parte hace lo mismo.

---SECCION_2---
LECTURA:
# Como llega un medicamento a tu tableta

Un medicamento no aparece en el pack porque exista. Aparece porque alguien lo dio de alta bien. Cuando falta uno, casi siempre es por una de estas dos razones.

**Razon 1: se quedo en borrador.** Lo que enfermeria escribe en el asistente de admision, en el paso que se llama Inventario Farmacologico (eMAR), entra al sistema como BORRADOR. Un borrador no llega a ninguna tableta: no sale en el pack, no sale en el Cardex, no existe para el piso. Para que un medicamento llegue al piso hay que darlo de alta en **Med & Zoning**. Si Pedro Santana 103 entro ayer y hoy su pack sale vacio, no es que el sistema falle: es que nadie los activo todavia. Eso se dice, no se asume.

![El paso de medicamentos de la admision: fijate en el rotulo "Borradores listos para insertar". Lo que se escribe aqui queda esperando; hasta que enfermeria lo active, no aparece en la tableta de nadie.](/academy/capturas/intake-paso-4-emar.jpg)

**Razon 2: el horario lleva palabras.** El campo de horario solo acepta horas separadas por coma: 08:00 AM, 08:00 PM. Nada mas. Si alguien escribe 08:00 AM (Semanal) para avisar que es semanal, la tableta no sabe leer esa linea y el medicamento **desaparece del pack para siempre**. No es una teoria: el 5 de septiembre de 2026 habia 17 medicamentos activos en Cupey sin una sola administracion por esto, y uno era Warfarin, un anticoagulante, con 107 dias sin darse.

**Las tres frecuencias que existen**, y son tres, no cuatro:

| Frecuencia | Que hace |
|---|---|
| Todos los dias | Sale en el pack de su hora, todos los dias |
| Solo ciertos dias | Sale solo los dias marcados en la fila D-L-M-X-J-V-S |
| Por razon necesaria (PRN) | No sale en ningun pack; se registra cuando se da |

No existe la orden unica. Un tratamiento de siete dias se receta igual que cualquiera y se le pone fecha de fin.

**Que se llena al recetar.** Esto lo hace enfermeria, pero te conviene saberlo para pedirlo bien: el farmaco se elige del catalogo, y de ahi salen la dosis y la via, no se teclean. Despues se llena cada cuando, que dias si son ciertos dias, las horas exactas, quien lo prescribio y una razon de auditoria que es obligatoria.

**Y una cosa que la tableta no trae: las instrucciones especiales.** Con alimentos, en ayunas, triturado. Ningun formulario de Zendity las pide hoy, asi que el pack solo pinta nombre, dosis y via. Si un medicamento tiene una condicion asi, se sabe antes de la ronda preguntando a enfermeria.

PREGUNTAS:
P: Pedro Santana 103 entro ayer. Enfermeria lleno sus medicamentos en la admision y hoy su pack sale vacio. Que paso?
a) Los medicamentos de un residente nuevo aparecen 24 horas despues
b) Falta que la familia autorice por escrito la administracion de medicamentos
c) El residente todavia no tiene color de grupo asignado
*d) Quedaron en borrador; hay que darlos de alta en Med & Zoning
EXPLICACION: Lo que se escribe en el asistente de admision entra como borrador y no llega a ninguna pantalla del piso hasta que enfermeria lo da de alta.

P: Carmen Delgado 210 toma Alendronate solo los lunes. Como se registra para que aparezca?
a) Escribiendo 08:00 AM (Semanal) en el horario, para que se entienda
*b) Marcando Solo ciertos dias y pulsando la L en la fila de dias
c) Poniendolo como PRN y dandolo cuando llegue el lunes
d) Dandolo de alta como todos los dias y omitiendolo los otros seis
EXPLICACION: El horario admite solo horas, y escribir la palabra semanal dentro de el hace que la tableta no sepa leer esa linea y el medicamento no aparezca nunca.

P: Cuantas frecuencias maneja Zendity y cuales son?
*a) Tres: todos los dias, solo ciertos dias y por razon necesaria
b) Cuatro: todos los dias, ciertos dias, PRN y orden unica
c) Dos: programado y por razon necesaria, y lo demas se ajusta con la fecha de fin
d) Tres: oral, topico e inyectable, segun la via que lleve el medicamento
EXPLICACION: Son tres y no existe la orden unica: un tratamiento temporal se receta igual que cualquiera y se le pone fecha de fin.

P: Un medicamento hay que triturarlo y darlo con compota. Donde lo ves en la tableta?
a) En la etiqueta de instrucciones especiales, debajo del nombre del medicamento
b) En la ficha del residente, en la pestana de instrucciones de administracion
*c) En ningun sitio: eso se pregunta a enfermeria antes de la ronda
d) En el aviso ambar que sale al abrir el pack de esa hora
EXPLICACION: Ningun formulario de Zendity pide instrucciones especiales hoy, asi que el pack solo pinta nombre, dosis y via.

P: Al recetar en Med & Zoning, de donde salen la dosis y la via?
a) Vienen del expediente de admision del residente
*b) Del catalogo de farmacia: se eligen al elegir el farmaco
c) Se teclean a mano en dos campos del formulario de receta
d) Las escribe la cuidadora la primera vez que administra el medicamento
EXPLICACION: El formulario no pide dosis ni via; lo que si pide es frecuencia, dias, horas, quien lo prescribio y la razon de auditoria.

---SECCION_3---
LECTURA:
# El pack: como se administra de verdad

Aqui esta el cambio mas grande respecto a lo que se enseñaba antes. **La tableta no se usa medicamento por medicamento.** Junta todos los que tocan a la misma hora dentro de tu turno y te los da juntos, en un pack.

![La tarjeta de Rosa Medina 204. Fijate en el boton teal Medicamentos y en el numero rojo: dice cuantos medicamentos tiene pautados en este turno. Arriba, MEDS PM en ambar es la misma informacion resumida.](/academy/capturas/care-turno-tarjeta.jpg)

Entras por ese boton. Arriba sale la pastilla teal con la hora, **Pack 8:00 AM**, cuantos medicamentos lleva, y el contador **Pack 1 de 3**. Los packs son secuenciales: sale el primero sin resolver y no se avanza al siguiente hasta cerrarlo.

Por cada medicamento la pantalla pinta **nombre, dosis y via**. Nada mas. Lo que ya esta resuelto hoy sale etiquetado: Firmado en verde, Omitido en rojo, Rechazado en ambar, Suspendido en gris.

![El pack abierto. Arriba, la pastilla teal con la hora y "Pack 1 de 2 · 0/2 completados". El medicamento con su dosis y via, y a su derecha OMITIR. Debajo, "¿Cuando se hizo?" con Ahora / hace 30 min / hace 1 h / hace 2 h, el recuadro de la firma, y la linea que certificas al firmar.](/academy/capturas/care-pack-meds.jpg)

**El orden importa:**

1. Primero resuelves lo que NO vas a dar, uno por uno, con el boton **Omitir**.
2. Despues declaras la hora en **Cuando se hizo**.
3. Y al final firmas **una sola vez**, con el dedo, por todo lo que si diste.

Debajo del boton de firmar hay una linea que dice: *Al firmar certifico haber comprobado Las 5 Categorias Clinicas Correctas*. Esa firma no es un tramite, es tu certificacion, y queda guardada con el registro. Sin firma el servidor no acepta el pack.

**Cuando se hizo: las dos horas.** Encima de la firma hay un bloque que por defecto dice **Ahora**. Si te sientas con la tableta mas tarde, lo cambias a la hora real en que administraste: hay botones de hace 30 min, hace 1 h y hace 2 h, y un reloj para poner cualquier hora. Cuando no es ahora, el bloque se pone ambar para que no se te pase. El sistema guarda **las dos horas**, la que declaras y la del tecleo, y en la auditoria se leen juntas: administrado 8:00, registrado 11:30.

Hasta doce horas hacia atras. Hacia adelante, nunca: una hora futura se rechaza con un error. Eso es lo que sigue prohibido de siempre, **firmar antes de dar el medicamento**. Si firmas primero y el residente lo rechaza despues, el expediente ya quedo falso.

**Lo clinico no lo pregunta la pantalla, pero sigue siendo tuyo:**

| Lo que hace la tableta | Lo que haces tu |
|---|---|
| Junta los medicamentos de la hora | Confirmar que estas con el residente correcto usando dos datos a la vez |
| Muestra nombre, dosis y via | Leer la etiqueta tres veces: al sacarlo, al prepararlo y al darlo |
| Guarda tu firma y las dos horas | Ver que se lo trague y que no lo esconda en la boca |
| Etiqueta lo que ya se resolvio | Comprobar alergias e instrucciones especiales, que la pantalla no trae |

PREGUNTAS:
P: Tienes cuatro medicamentos en el pack de las 8:00 AM y Rosa rechaza uno. Que haces?
*a) Omites ese primero con su motivo, y despues firmas los otros tres
b) Firmas el pack completo y despues avisas a enfermeria de cual no tomo
c) Cancelas el pack entero y lo vuelves a abrir con los tres que si tomo
d) Firmas los tres y dejas el cuarto sin tocar
EXPLICACION: La firma cubre unicamente lo que quedaba pendiente cuando la dibujaste, asi que primero se resuelve lo que no se da y se firma despues.

P: Son las 11:30 y te sientas a registrar el pack que diste a las 8:00. Que haces?
a) Escribes en la nota del turno que lo diste a las 8:00
b) Le pides a tu supervisora que corrija la hora despues de que firmes
c) Lo registras y lo dejas en Ahora; una diferencia de tres horas no es grande
*d) Cambias Cuando se hizo a las 8:00 antes de firmar el pack
EXPLICACION: El bloque se pone ambar cuando no es ahora, y el expediente conserva las dos horas: administrado 8:00, registrado 11:30.

P: Que pasa si intentas cerrar el pack sin dibujar la firma?
a) Se guarda como pendiente de firma y se te recuerda al cerrar el turno
b) Se guarda igual: tu usuario ya identifica quien administro
*c) No se guarda: el servidor pide la firma para aceptar el pack
d) Se guarda pero sale marcado en rojo en la auditoria
EXPLICACION: La firma es la certificacion de los 5 correctos y sin ella el pack no se acepta, asi que no queda registro de nada.

P: Abres el pack de Luis Ortega y ves un medicamento con la etiqueta verde Firmado. Que significa?
a) Que el medicamento esta activo y vigente en su receta
*b) Que alguien ya lo administro hoy en esa hora y lo firmo
c) Que el medicamento ya esta preparado en el carrito y listo para darse
d) Que el medico lo autorizo y la farmacia ya lo entrego al hogar
EXPLICACION: Firmado, Omitido, Rechazado y Suspendido son los cuatro estados de lo ya resuelto hoy en ese horario; lo que no lleva etiqueta es lo que falta.

P: Entras al 210 a dar el pack de Carmen Delgado. Como confirmas que es ella?
a) Por el numero de habitacion, que es unico en el hogar
b) Porque es la que estaba ahi cuando recibiste el turno esta manana
c) Porque la tableta ya abrio su tarjeta y trae su foto y su nombre
*d) Con dos datos a la vez: su nombre completo y la habitacion
EXPLICACION: Un identificador solo falla, porque hay camas que se cambian y nombres que se parecen; por eso se usan dos antes de sacar nada del carrito.

---SECCION_4---
LECTURA:
# Cuando no se da: omitir, rechazo y lo que llega tarde

Un turno honesto tiene omisiones. Durante meses este eMAR solo sabia decir que si: 24,534 administraciones contra TRES omisiones en Cupey. Eso no es un hogar con 99.99 por ciento de cumplimiento, es un registro que no dice la verdad.

**Registrar una omision no te resta puntos.** Se decidio a proposito: los medicamentos omitidos quedaron fuera de los negativos de tu desempeño. Omitir con su motivo es trabajo bien hecho, no una falta.

**Como se omite.** Junto al medicamento, boton **Omitir**. Se abre un panel rojo que pregunta por que se omite y pide dos cosas:

- **Un motivo de una lista de siete.** Ninguno viene marcado: el desplegable arranca en "Elija el motivo" y hay que elegir. Antes venia preseleccionado en "Residente lo rechazo", y quien no lo tocaba culpaba al residente sin querer.
- **Un texto de al menos 10 caracteres.** El servidor tambien lo exige.

**El motivo que eliges decide el expediente.** No son siete formas de decir lo mismo:

| Si eliges | Queda en el expediente como |
|---|---|
| Residente lo rechazo | Rechazado |
| Residente en procedimiento | Suspendido |
| Indicacion medica | Suspendido |
| Medicamento no disponible | Omitido |
| Fuera del hogar (hospital, cita, salida) | Omitido |
| Residente fallecio | Omitido |
| Otro | Omitido |

Por eso se pregunta. No quiso, el medico lo suspendio y no habia son tres cosas distintas, y la pregunta cuantas veces lo rechazo solo tiene respuesta si se eligio bien. En cuanto confirmas, **enfermeria y supervision reciben el aviso** con el residente, el medicamento, la hora, tu motivo y tu nombre.

**Si el residente rechaza.** Explicale con calma para que es. Si sigue diciendo que no, se respeta: el residente tiene derecho a rechazar cualquier medicamento. Omites con el motivo Residente lo rechazo y escribes lo que dijo. Y si es un medicamento critico, como insulina o un anticoagulante, ademas se lo dices a enfermeria de viva voz sin esperar a que lea la notificacion.

**Si llegas tarde.** Hay dos casos y solo uno se resuelve desde la tableta:

| Situacion | Que haces |
|---|---|
| La hora era de tu propio turno | Administras y declaras la hora real en Cuando se hizo |
| La hora cayo en un turno anterior | En tu tableta no aparece. Lo avisas a enfermeria o supervision y lo dejas escrito en la nota del turno |

Lo que no se hace nunca es buscarle otro hueco ni firmarlo dentro de un pack que no le corresponde. Y no existe campo de razon del retraso para medicamentos: esa explicacion va a la nota del turno.

**Si ves una reaccion.** Atiende al residente primero. Avisa a enfermeria de viva voz. Y deja el registro escrito donde si cabe: en la nota del turno y como **cambio de condicion** desde la tarjeta del residente, en Piel, Dolor, Animo o conducta, u Otra cosa. El eMAR no tiene casilla de reaccion adversa y dentro del pack no se puede escribir nada, asi que si no lo escribes ahi no queda escrito en ningun sitio.

PREGUNTAS:
P: Abres el panel para omitir Losartan. Que motivo viene marcado por defecto?
*a) Ninguno viene marcado: hay que elegir uno de la lista
b) Viene marcado Otro, y se afina con el texto libre
c) Viene marcado el mismo motivo que usaste la vez anterior
d) Viene marcado Residente lo rechazo, que es el motivo mas frecuente
EXPLICACION: El desplegable arranca en Elija el motivo a proposito, porque un valor por defecto que reparte culpa no es un valor por defecto, es una acusacion silenciosa.

P: Carmen Delgado salio al hospital y por eso no recibio su pack de las 8:00. Que motivo eliges?
a) Residente en procedimiento, porque una salida al hospital lo es
b) Otro, y lo explicas en el texto libre de la omision
c) Medicamento no disponible, porque no se le pudo dar
*d) Fuera del hogar, que cubre el hospital, la cita y la salida
EXPLICACION: El hospital, la cita y la salida tienen su propio motivo desde septiembre; antes se registraban como rechazo del residente, que era falso.

P: Eliges el motivo Residente lo rechazo. Como queda esa dosis en el expediente?
a) Como Omitido, igual que todas las demas dosis que no se dieron
*b) Como Rechazado, que es un estado distinto de Omitido
c) Como Suspendido hasta nueva orden del medico
d) Como Pendiente, para que el turno siguiente lo vuelva a intentar
EXPLICACION: Rechazado, Suspendido y Omitido son tres estados distintos, y solo eligiendo bien el motivo se puede contestar despues cuantas veces lo rechazo.

P: Son las 3:00 PM, turno de tarde. Te enteras de que el pack de las 8:00 AM de Rosa nunca se dio. Que haces?
a) Lo buscas en la tableta y lo firmas declarando la hora real de las 8:00 AM
b) Lo firmas dentro del pack de las 4:00 PM
*c) Avisas a enfermeria o a supervision y lo escribes en la nota del turno
d) Lo omites con el motivo Otro para que quede constancia de que no se dio
EXPLICACION: Un horario de otro turno no se dibuja en tu tableta, asi que desde el piso no hay forma de registrarlo: lo resuelve quien puede y tu dejas por escrito lo que viste.

P: Luis Ortega se pone rojo y le cuesta tragar diez minutos despues de su medicamento. Donde queda escrito?
*a) En la nota del turno y como cambio de condicion desde su tarjeta
b) En la casilla de reaccion adversa del eMAR, junto a la dosis
c) En el campo de notas del pack, que se abre al firmar
d) En el formulario de traslado, que es el unico papel que recoge reacciones
EXPLICACION: Lo primero es atenderlo y avisar de viva voz; el eMAR no tiene casilla de reaccion y dentro del pack no se escribe, asi que ahi es donde de verdad queda.

---SECCION_5---
LECTURA:
# El PRN y el papel que queda

Un PRN, por razon necesaria, no sale en ningun pack. Se da cuando hace falta, y por eso se registra aparte, desde el mismo panel de medicamentos: **Registrar dosis PRN (S.O.S.)**.

**Se registra de uno en uno.** Eliges que medicamento se dio de la lista del residente (los PRN salen con etiqueta ambar, y si lo que diste no esta marcado como PRN hay un enlace para ver todos). Despues escribes **para que** se dio, con al menos 5 caracteres: agitacion al bañarlo, dolor en la cadera, diarrea. Y firmas. Si aprendiste el boton viejo, que mandaba el turno entero, olvidalo: hoy devuelve un error que dice que el PRN se registra de uno en uno.

**La segunda pregunta es la que decide algo.** Dar el PRN es la mitad. La otra mitad es si hizo efecto, porque de ahi sale lo que pasa despues: repetir, cambiar o llamar al medico. En el mismo panel aparece el bloque ambar con la dosis, para que se dio y a que hora, y cuatro botones:

| Respuesta | Cuando se usa |
|---|---|
| Resolvio | El sintoma cedio y no hizo falta nada mas |
| Mejoro en parte | Bajo pero no cedio del todo |
| Sin efecto | Se dio y el sintoma siguio igual |
| No se pudo evaluar | Se durmio, cambio el turno, salio; no hubo forma de saberlo |

La pregunta queda abierta **doce horas**, que cubren el turno completo y el relevo, y la puede contestar quien no lo administro: si quien lo dio se fue a casa, le toca al que entra cerrar lo que vio. No se pudo evaluar esta ahi a proposito, porque sin esa salida "no lo pude ver" se registra como "resolvio", que es una mentira comoda.

Si contestas **Mejoro en parte** o **Sin efecto**, enfermeria y supervision reciben el aviso. Un PRN que no funciono es una decision clinica pendiente, no un dato de archivo. Lo que nadie contesta se acumula en la lista de trabajo de enfermeria:

![La lista de enfermeria. Fijate en la fila "PRN sin saber si hizo efecto": son las dosis que se dieron y nadie cerro. Esa fila baja cuando tu contestas los cuatro botones, y sube cuando no.](/academy/capturas/enfermeria-lista-de-trabajo.jpg)

**El papel que queda.** Cada linea del eMAR guarda quien administro, la hora declarada, la hora del tecleo, el medicamento con su dosis y su via, el estado, tu firma, y en un PRN el motivo y el efecto. Con eso se arman los tres documentos que existen de verdad:

| Documento | Donde esta | Para que sirve |
|---|---|---|
| PDF del eMAR | Boton Cardex, arriba del pack — lo abre enfermeria para arriba | El eMAR de un residente por rango de fechas, con el recuento de dosis por estado. Es lo que se le entrega a un inspector |
| Historial del residente | Expediente, pestaña eMAR | Ver todas sus dosis y su adherencia semanal |
| Cumplimiento eMAR | Pantalla corporativa de direccion | La tendencia del porcentaje administrado de la sede |

El PDF pide rango de fechas y no es por gusto: el residente con mas historial lleva 1,978 dosis, que en papel son 71 hojas. Sin rango salen los ultimos 30 dias.

**Tu parte en una auditoria** no se prepara el dia de la auditoria. Es esto: la hora real cuando no fue ahora, el motivo correcto cuando no se dio, el para que del PRN y su efecto. Un expediente que solo sabe decir que si no protege a nadie, y menos a ti.

PREGUNTAS:
P: Le das un PRN a Rosa Medina para la agitacion. Que pide la tableta ademas de la firma?
a) La autorizacion verbal de enfermeria
b) Que elijas el medicamento y adjuntes la nota del medico que lo ordeno
c) Que marques el turno completo, como se hacia en el boton viejo
*d) Que elijas el medicamento y escribas para que se dio
EXPLICACION: Un PRN se registra de uno en uno con su motivo de al menos 5 caracteres, porque sin saber para que se dio no hay forma de evaluarlo despues.

P: Administraste un PRN a las 10:00 PM y te fuiste a casa sin contestar si hizo efecto. Que pasa?
a) Se pierde la pregunta: solo la puede contestar quien administro
*b) Queda abierta doce horas y la puede cerrar quien entra al relevo
c) El sistema la contesta solo como No se pudo evaluar a las doce horas
d) Se convierte en un cambio de condicion que revisa enfermeria al dia siguiente
EXPLICACION: La ventana de doce horas cubre el turno y el relevo justamente porque quien lo dio pudo irse, y entonces el que entra cierra lo que vio.

P: Contestas Sin efecto a un PRN de dolor. Que pasa despues?
*a) Enfermeria y supervision reciben el aviso enseguida
b) Se repite la dosis a las cuatro horas
c) Se marca el medicamento como no efectivo y desaparece de su lista
d) Queda guardado en el expediente y se revisa en la proxima visita del medico
EXPLICACION: Mejoro en parte y Sin efecto son las dos respuestas que avisan, porque un PRN que no funciono es una decision clinica pendiente.

P: Un inspector pide el eMAR de Carmen Delgado del mes pasado. Que le entregas?
a) Una impresion de la pantalla del pack de cada dia del mes
b) La tendencia de Cumplimiento eMAR de la sede en ese periodo
*c) El PDF del eMAR desde el boton Cardex, con el rango del mes
d) El historial completo de la pestaña eMAR de su expediente, sin recortar
EXPLICACION: El PDF pide rango a proposito, porque el residente con mas historial lleva 1,978 dosis y eso en papel son 71 hojas que nadie pidio.

P: De estas cosas, cual NO queda guardada en una linea del eMAR?
a) La hora que declaraste y, aparte, la hora en que lo escribiste
b) El motivo de la omision y el estado que le corresponde
c) Quien administro, con su firma dibujada
*d) La razon del retraso cuando un medicamento se da tarde
EXPLICACION: No existe campo de razon del retraso para medicamentos, asi que cuando algo se da tarde la explicacion va a la nota del turno.
`
}

,

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 4: PROCESO DE CIERRE DE TURNO
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'CIERRE_TURNO_101',
    title: 'Proceso de Cierre de Turno',
    description: 'Aprende a cerrar tu turno correctamente en Zendity: pre-scan, resolucion de pendientes y firma electronica.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🔒',
    category: 'Tecnologia Zendity',
    order: 13,
    content: `---META---
TITULO: Proceso de Cierre de Turno
PROMPT_ZENDI: Evalúa si la persona sabe abrir el asistente con Entregar Turno, leer y corregir el reporte que arma Zendi en el Paso 2, marcar la casilla de lectura, firmar con el dedo, y decir qué pasa con su relevo después de firmar y qué pasa si no lo firma.
TERMINOS_CLAVE: Entregar Turno, Cierre de turno, Estado Limpio, Paso 2, Tu Reporte de Turno, Zendi AI, Reporte base, He leído y confirmo, Firma con el dedo, CONFIRMAR CIERRE DE TURNO, Turno Entregado, relevo, Reportes de Turno, Sesiones Sin Cerrar, Forzar cierre, Turnos cerrados con el relevo
PREGUNTA_REFLEXION: Piensa en el último turno que entregaste. Qué le hacía falta saber a la persona que entraba detrás de ti, y estaba escrito en el reporte que firmaste?

---SECCION_1---
LECTURA:
# Entregar Turno: qué se cierra de verdad

El botón **Entregar Turno** está arriba a la derecha, en la barra oscura de tu tableta, al lado de la campana. Se pulsa cuando te vas.

Lo que abre es un asistente que se llama **Cierre de turno**, con el subtítulo "Reporte para el próximo equipo". Arriba a la derecha, en amarillo, tiene el cartel que dice todo lo que hay que entender de esta pantalla:

**Tu turno se cierra cuando firmes este reporte.**

![La barra de arriba de tu tableta: el turno de Mañana, tu color BLUE y, a la derecha, el botón Entregar Turno.](/academy/capturas/care-turno-lista.jpg)

## Tres pasos, y el que manda es el segundo

| Paso | Como se llama en pantalla | Qué haces |
|---|---|---|
| 1 | Pendientes de tu turno | Casi siempre nada. Ahora verás por qué |
| 2 | Tu Reporte de Turno | Lees el reporte, lo corriges si hace falta y marcas la casilla |
| 3 | Firma con el dedo | Firmas y pulsas el botón verde |

## Lo que pasa si te vas sin firmar

Aquí el curso viejo asustaba con algo que no es cierto. Vamos por partes:

| Lo que SI pasa | Lo que NO pasa |
|---|---|
| El turno que entra detrás de ti entra sin tu reporte | No se pierde ni un dato de tu trabajo |
| Tu sesión se queda abierta y le sale al supervisor en **Sesiones Sin Cerrar** | Nada queda "a medias" ni "pendiente de guardar" |
| Queda contado en **Mi desempeño**, en "Turnos cerrados con el relevo" | No te bloquea la tableta ni te impide entrar mañana |

## Y los puntos, dicho entero

La tableta no se bloquea, eso es verdad. Los puntos son otra cosa, y hay que decirlo entero: **dentro del sistema sí hay un descuento.** La fórmula del score de cumplimiento resta 10 puntos por cada turno que quedó sin cerrar y otros 10 por cada turno cerrado sin relevo, mirando los últimos 14 días y con un tope, y un proceso automático lo recalcula y lo guarda cada madrugada.

Lo que pasa es que **ese número hoy no se le enseña a nadie.** Está apagado en todas las pantallas -en la tuya, en la del supervisor, en la de recursos humanos y en la pared- desde el 9 de septiembre de 2026, porque el número no cuadraba con lo que hace la gente en el piso. Donde antes salía, hoy sale una línea que dice que está en revisión hasta que tenga una sola fórmula.

Así que nadie te lo va a echar en cara. Pero el descuento se sigue calculando y guardando, y el día que vuelvan a encender ese número aparecerá con lo de atrás incluido. Se dice entero para que no te lo cuenten a medias.

**Cada cosa que registraste ya está guardada.** El baño, la comida, el medicamento, los vitales, la caída, la nota: cada una se escribió en el momento en que la registraste, con tu nombre y su hora. El cierre no guarda nada de eso. El cierre crea **el relevo**, que es otra cosa: el aviso al que entra.

Por eso la consecuencia de no firmar no es una pérdida de datos. Es que la compañera que entra a las dos de la tarde no sabe lo que pasó en tu turno.

## Y sí, se puede salir sin cerrar

No hay nada que te obligue. En la pantalla donde eliges tu color hay, arriba a la derecha, un enlace **Cerrar Sesión / Salir** que te saca de la aplicación sin pasar por el asistente. Ahí nacen casi todos los turnos que quedan abiertos. No es una trampa del sistema: es que se puede, y hay que acordarse.

PREGUNTAS:
P: Qué abre el botón Entregar Turno?
a) Un escaneo que revisa lo que te quedó pendiente
*b) El asistente Cierre de turno
c) La pantalla de Reportes de Turno de la sede
d) El chat del piso para avisarle al relevo
EXPLICACION: Pulsarlo solo abre el asistente de tres pasos; no hace ninguna revisión previa de tu trabajo.

P: Te vas a casa sin firmar el cierre. Qué pasa con lo que registraste hoy?
a) Se borra al cerrar la sesión en la tableta
b) Queda en borrador hasta que alguien lo firme
c) Se lo tiene que volver a escribir el turno que entra
*d) Se quedó guardado; lo que falta es el relevo
EXPLICACION: Cada baño, comida, medicamento y nota se escribió con tu nombre y su hora en el momento; lo único que falta sin firmar es el aviso al turno siguiente.

P: Qué dice el cartel amarillo del asistente de cierre?
*a) Tu turno se cierra cuando firmes este reporte
b) Tienes quince minutos para cerrar
c) El supervisor autorizó tu salida
d) Zendity lo guardó todo al entrar
EXPLICACION: Ese cartel está ahí para que no quede duda de cuál es el acto que cierra el turno: la firma, no el botón de salir.

P: Puedes salir de la tableta sin pasar por el asistente?
a) No, el asistente es obligatorio y no se puede saltar
b) No, la tableta queda bloqueada
*c) Sí, con el enlace Cerrar Sesión / Salir
d) Sí, pero solo con el permiso del supervisor de turno
EXPLICACION: Ese enlace vive en la pantalla de elección de color y saca de la aplicación sin cerrar el turno; de ahí salen las sesiones que quedan abiertas.

P: Tu sesión quedó abierta porque te fuiste sin cerrar. Dónde la ve el supervisor?
a) En el chat del piso, con un aviso rojo
*b) En su panel, en el bloque rojo Sesiones Sin Cerrar
c) No la ve: el sistema la cierra solo a los quince minutos
d) En el expediente de cada residente que atendiste hoy
EXPLICACION: Es una lista que el supervisor mira cuando abre su panel, con las horas que lleva abierta cada sesión.

---SECCION_2---
LECTURA:
# Paso 1: por qué siempre dice Estado Limpio

La columna de la izquierda del asistente se titula **Paso 1 - Pendientes de tu turno** y al lado tiene un contador de tareas.

En la tableta, ese contador dice **0 TAREAS** y el recuadro grande dice **Estado Limpio**, con la frase "Todas las responsabilidades directas fueron atendidas o trasladadas exitosamente".

Dice eso siempre. Le salga bien el turno o le salga mal.

![El asistente abierto: a la izquierda el Paso 1 con 0 TAREAS y el cartel Estado Limpio; a la derecha empieza el Paso 2 con los cuatro contadores.](/academy/capturas/care-turno-entregar.jpg)

## Lo que significa y lo que no

| Lo que SI significa | Lo que NO significa |
|---|---|
| Que el asistente no trae pendientes que resolver aquí | Que terminaste todo lo de tu turno |
| Que puedes pasar al Paso 2 | Que alguien revisó tu trabajo y lo aprobó |
| Nada más | Que no hay medicamentos sin dar ni baños sin hacer |

Nadie le pasa pendientes a esa columna. Está así en el código desde que existe la pantalla. **Ninguna cuidadora de Vivid ha visto nunca ahí un aviso.** Si esperabas que esa columna te avisara de lo que te faltó, no lo va a hacer: eso se mira en la tarjeta de cada residente, antes de venir aquí.

## Si alguna vez trajera algo

El asistente sabe pintar dos bloques, y **no se resuelven igual**.

**Decisiones Requeridas**, en ámbar. Debajo de cada tarea saldría la pregunta "Qué pasó con esta tarea? Elige una opción" y **tres botones y nada más**:

- **Rehusó** - el residente no aceptó
- **Durmió** - estaba dormido
- **Trasladar** - que lo haga el próximo turno

Tres botones. No hay campo para escribir una explicación, y pulsarlos **no cambia el estado de ningún medicamento**.

**Bloqueos Críticos**, en rojo. Aquí no hay pregunta ni hay botones: solo el título de la tarea, su descripción y, debajo, un cartel rojo con una sola frase, **Resuelva en Triage Central para Proceder**. Desde el asistente no se toca; hay que ir a resolverlo fuera y volver.

## Lo que ya no se enseña

El curso anterior describía un "pre-scan" automático que clasificaba todo en Blockers y Warnings, un "Override Forzado" con código del supervisor, y estados en español llamados OMITIDO, TRANSFERIDO y RECHAZADO. **Nada de eso existe en Zendity.** Si lo aprendiste así, olvídalo: lo que hay es lo que ves en esta pantalla.

Un medicamento que quedó sin dar se documenta en **Medicamentos**, en la tarjeta del residente, con su motivo, antes de entregar el turno. Ese es el sitio, y es el único.

PREGUNTAS:
P: El Paso 1 te dice Estado Limpio. Qué significa?
a) Que el supervisor ya revisó y aprobó tu turno
b) Que no te queda ningún medicamento por dar hoy
*c) Que el asistente no trae pendientes que resolver aquí
d) Que todos tus residentes tienen el baño y la comida al día
EXPLICACION: Ese cartel sale siempre, hayas terminado o no, porque nadie le pasa pendientes a esa columna.

P: Antes se enseñaba que al pulsar Entregar Turno corre un pre-scan. Qué corre de verdad?
*a) Nada: el asistente pide tu reporte a Zendi
b) Un escaneo que clasifica lo pendiente
c) Una revisión de los expedientes
d) Un aviso al supervisor
EXPLICACION: Lo primero que ocurre es una llamada que arma el relato de lo que sí hiciste, no una lista de lo que falta.

P: Si el Paso 1 trajera una tarea en Decisiones Requeridas, qué puedes hacer?
a) Escribir una justificación de al menos diez caracteres
b) Cambiar el medicamento a estado OMITIDO desde ahí mismo
c) Pedir un código temporal al supervisor para saltarla
*d) Pulsar Rehusó, Durmió o Trasladar
EXPLICACION: Son tres botones fijos, sin campo de texto, y ninguno toca el estado de un medicamento. Un Bloqueo Crítico no trae botones: manda a Triage Central.

P: Un medicamento quedó sin dar y quieres dejarlo documentado. Dónde se hace?
a) En el Paso 1 del cierre
*b) En Medicamentos, antes de entregar el turno
c) En el cuadro del reporte, escribiéndolo a mano al final
d) En la nota que le dejas al supervisor por el chat
EXPLICACION: Se toca Omitir en esa línea, se elige el motivo y se escribe el detalle; el asistente de cierre no puede cambiarlo.

P: No pudiste terminar algo y el turno se acabó. Cómo lo dejas dicho?
*a) Escribiéndolo en el cuadro del reporte, en el Paso 2
b) Con el código de Override Forzado del supervisor
c) Marcándolo como OMITIDO con justificación escrita
d) No hace falta: el asistente lo detecta y lo traslada solo
EXPLICACION: El cuadro del Paso 2 se puede corregir a mano, y es el único sitio del cierre donde tus palabras llegan al turno que entra.

---SECCION_3---
LECTURA:
# Paso 2: el reporte que firmas lo escribió Zendi

Esta es la pantalla que importa, y es la que el curso viejo no mencionaba ni una vez.

La columna de la derecha se titula **Paso 2 - Tu Reporte de Turno**. Arriba a la derecha lleva una pastilla que dice **Zendi AI** o **Reporte base**. Debajo, cuatro contadores de tu turno: **MEDS**, **BAÑOS**, **COMIDAS**, **VITALES**. Y después, el texto.

**Ese texto lo escribió un modelo de inteligencia artificial**, con la actividad que quedó registrada en tu turno. Tú lo vas a firmar con tu nombre. Por eso lo primero es leerlo entero.

![La columna derecha del asistente de cerca: el rótulo Paso 2 con la pastilla ZENDI AI, los cuatro contadores, el reporte en su cuadro de texto y, justo debajo, la casilla He leído y confirmo, aquí ya marcada.](/academy/capturas/cierre-paso-3-firma.jpg)

## La pastilla te dice quién lo escribió

| Pastilla | Qué pasó | Qué haces |
|---|---|---|
| **Zendi AI** | Lo redactó el modelo | Leerlo |
| **Reporte base** | El modelo falló y Zendity armó un resumen de números | Leerlo con más cuidado, y completar a mano lo que haga falta |

**Reporte base** es un recuento, no un relevo: dice cuántos medicamentos y cuántos baños, y no dice a quién hay que mirar. Si te sale ese, el trabajo de escribir lo importante es tuyo.

## Lo que entra en el reporte, y lo que no

| Entra solo | No entra |
|---|---|
| Los medicamentos que tú omitiste, **con el motivo que escribiste** | Lo que no registraste en ningún sitio |
| Las caídas de tus residentes durante el turno | Lo que pasa a la vez en otro grupo de color |
| Las alertas clínicas de tus residentes, las escribiera quien las escribiera | Lo que le contaste a alguien de palabra |

Ojo con la tercera línea: **puede entrar algo que escribió una compañera** sobre una residente tuya. Cuando pasa, el texto dice quién lo reportó. Igual lo firmas tú, así que léelo.

Y ojo con la primera: el motivo corto que escribiste al omitir un medicamento es exactamente lo que va a leer el turno que entra. Si quedó corto, este es el momento de explicarlo mejor.

## El texto se corrige

El reporte está dentro de un cuadro de texto, no es una imagen. **Si algo está mal, lo escribes bien.** Debajo lo dice: "Puedes corregir el texto si algo está mal."

## La casilla que abre la puerta

Abajo del cuadro hay una casilla:

**He leído y confirmo que este reporte es correcto**

Hasta que no la marcas, el recuadro de la firma se queda apagado y no te deja firmar. Es la única puerta del asistente. Y si después de marcarla tocas el texto, se desmarca sola: hay que volver a leer lo que cambió.

PREGUNTAS:
P: Quién escribe el texto del Paso 2?
a) La supervisora antes de que entres al asistente
b) El turno que entra, cuando lo recibe
c) Tú, en blanco, desde la primera línea
*d) Zendi, con la actividad de tu turno
EXPLICACION: Lo redacta un modelo de inteligencia artificial con lo que quedó registrado, y tú lo firmas con tu nombre.

P: El reporte dice algo que no es cierto. Qué haces?
a) Lo firmas igual y se lo aclaras al relevo de palabra
*b) Corriges el texto en el mismo cuadro, antes de firmar
c) Cancelas el cierre y lo vuelves a abrir para que se regenere
d) Le pides al supervisor que lo edite desde su panel
EXPLICACION: El reporte vive en un cuadro de texto editable, y la propia pantalla te dice que lo corrijas si algo está mal.

P: Qué desbloquea el recuadro de la firma?
*a) Marcar He leído y confirmo que este reporte es correcto
b) Terminar los pendientes del Paso 1
c) Que el supervisor lo apruebe
d) Esperar a que Zendi termine
EXPLICACION: Mientras esa casilla esté sin marcar, el recuadro de firma sigue apagado; es la única condición que lo abre.

P: La pastilla del Paso 2 dice Reporte base en vez de Zendi AI. Qué significa?
a) Que el reporte es el del turno anterior, no el tuyo
b) Que todavía no has marcado la casilla de lectura
*c) Que Zendi falló y salió un resumen de números
d) Que el supervisor pidió una versión corta del relevo
EXPLICACION: Ese texto de respaldo cuenta cuántos, pero no dice a quién hay que mirar; ahí te toca completarlo a ti.

P: Una compañera reportó una alerta de una residente tuya. Sale en tu reporte?
a) No: el reporte solo trae lo que escribiste tú
b) No, pero te llega un aviso aparte al cerrar
c) Sí, y aparece como si la hubieras escrito tú
*d) Sí, y dice quién la reportó
EXPLICACION: El relevo se arma por residente y no por autor, porque al que entra le importa igual quién lo haya escrito.

---SECCION_4---
LECTURA:
# Paso 3: la firma es un trazo con el dedo

Debajo del reporte está **Paso 3 - Firma con el dedo**. Es un recuadro de borde punteado con la frase **Firma aquí con el dedo o el lápiz**. Se firma encima, con el dedo.

Eso es todo. **No hay PIN. No hay huella. No hay cámara.** Lo que se guarda es el dibujo de tu trazo, junto al reporte y la hora.

![La misma columna de antes, mirando ahora la mitad de abajo: la casilla de lectura ya marcada en teal, el recuadro punteado para firmar, la frase que se certifica y el botón CONFIRMAR CIERRE DE TURNO todavía en gris.](/academy/capturas/cierre-paso-3-firma.jpg)

## Lo que esa firma es, y lo que no

| Lo que SI es | Lo que NO es |
|---|---|
| Tu trazo guardado junto al reporte que leíste | Un PIN, una huella o un segundo factor |
| Un registro de auditoría con la hora de tu salida | Una firma con validez legal certificada |
| Tu palabra de que ese texto es verdad | Una comprobación de que eras tú quien firmaba |

Esa última línea es importante y hay que decirla clara: **lo único que ata esa firma a ti es la sesión abierta en la tableta.** Y la tableta del piso es compartida. De ahí salen dos reglas de piso:

- No firmes nunca en la sesión de otra persona.
- No dejes la tuya abierta cuando sueltas la tableta.

## Lo que se certifica

Debajo de la firma hay una segunda casilla, con estas palabras exactas:

**Certifico bajo penalidad normativa que este traspaso es verídico y las rondas fueron ejecutadas.**

Y después, el botón verde: **CONFIRMAR CIERRE DE TURNO**.

Ese botón está gris hasta que están las tres cosas: la casilla de lectura marcada, el trazo dibujado y esta segunda casilla marcada. Si lo ves gris, te falta una de las tres.

## Si corriges después de firmar

Se borra la firma y hay que volver a firmar. Es a propósito: **se firma lo que se leyó**, no una versión que cambió después.

## Turno Entregado

Al confirmar sale una pantalla verde con un visto: **Turno Entregado**. Dice "Tu reporte de cierre fue guardado y firmado" y, más abajo, "Ya no necesitas hacer nada más. Tu turno está completo." Con un botón **Cerrar sesión**.

Esa pantalla existe por una razón concreta: para que no vuelvas a entrar a cerrar otra vez. Si la ves, ya está. Zendity además se protege del doble toque -si se cierra dos veces seguidas te devuelve el mismo relevo en vez de crear dos-, pero la señal de que terminaste es esa pantalla.

PREGUNTAS:
P: Con qué se firma el cierre de turno?
*a) Con el dedo, dibujando en el recuadro punteado
b) Con el PIN personal que usas para entrar
c) Con la huella, si la tableta la lee
d) Con el usuario y la contraseña del sistema
EXPLICACION: Lo que se guarda es el dibujo del trazo; en todo el flujo de cierre no se pide ningún PIN ni ninguna biometría.

P: El botón CONFIRMAR CIERRE DE TURNO está gris. Qué falta?
a) Que pase tu hora de salida
b) Que el supervisor lo habilite
*c) La casilla de lectura, la firma o la certificación
d) Que Zendi termine de contar
EXPLICACION: El botón solo se enciende con las tres a la vez, así que si está gris repasa cuál de las tres te falta.

P: Firmaste y luego corriges una línea del reporte. Qué pasa?
a) Se guarda la corrección con la firma que ya hiciste
*b) La firma se borra y hay que firmar otra vez
c) El supervisor recibe un aviso de que cambiaste el texto
d) El cuadro se bloquea porque el reporte ya está firmado
EXPLICACION: Se hizo así para que lo que quede firmado sea exactamente el texto que leíste, y no otro.

P: Sale la pantalla Turno Entregado. Qué haces?
a) Vuelves a entrar para comprobar que se guardó
b) Firmas otra vez por si el primero no llegó
c) Esperas a que el supervisor te confirme por chat
*d) Cierras sesión: ya está
EXPLICACION: Esa pantalla dice que ya no hace falta nada más, y está puesta justo para evitar el segundo cierre.

P: Qué ata esa firma a ti?
a) Un sello de tiempo con verificación de identidad
b) La huella que la tableta guarda al firmar
*c) La sesión que tienes abierta en la tableta
d) El código del supervisor que autorizó el cierre
EXPLICACION: Por eso no se firma nunca en la sesión de otra persona ni se deja la propia abierta en una tableta compartida.

---SECCION_5---
LECTURA:
# Después de tu firma, y el turno que no se cierra

## Adónde va tu reporte

1. **Al supervisor.** En su panel, en el bloque **Handovers Hoy**, tu relevo sale con la etiqueta **Cuidadora firmó - falta tu firma** y un botón verde **FIRMAR**.
2. **Al turno que entra.** La persona de tu mismo color lo recibe al empezar, en su pantalla de entrada, bajo el título **Relevo de tu turno anterior**, con tu nombre, la hora y un enlace a "Ver reporte completo".
3. **A Reportes de Turno.** Ahí queda guardado, y es donde lo leen supervisión y dirección cuando hace falta mirar atrás.

![Así le llega al supervisor: tu relevo esperando su firma, con la etiqueta de que la cuidadora ya firmó y el botón FIRMAR.](/academy/capturas/supervisor-relevos.jpg)

**Le llega al turno siguiente solo si está firmado.** Sin firma no hay relevo que entregar.

## Si el turno se queda abierto

Pasadas **12 horas**, tu sesión aparece en el panel del supervisor en el bloque rojo **Sesiones Sin Cerrar (N)**, con las horas que lleva y un botón **Forzar cierre**.

Cuando el supervisor lo pulsa:

- Se abre un cuadro que dice **Razón del cierre (opcional)**. Opcional de verdad: si lo deja vacío, se guarda "Sin razón especificada".
- Te llega un aviso a ti: "Tu turno fue cerrado por el supervisor".
- **No se genera ningún reporte.** Solo se cierra la sesión.

Ese último punto es el que hay que entender. Forzar el cierre limpia el panel, no arregla nada: el turno que entró detrás de ti ya entró sin saber lo tuyo, y eso no se recupera después.

Tampoco es que suene una alarma. El supervisor lo ve cuando abre su panel, no antes. Hay un aviso automático, pero salta a las **14 horas**, se manda cada seis horas y va a **dirección**, no al supervisor. En el peor caso pasa casi un día.

## Dónde lo ves tú

En **Mi desempeño**, la primera medida: **Turnos cerrados con el relevo**, con su número y su porcentaje, y la línea "Un turno sin cerrar deja al que entra sin saber qué pasó".

![Mi desempeño: la primera medida es Turnos cerrados con el relevo, 19 de 21, el 90% de los turnos trabajados.](/academy/capturas/mi-desempeno.jpg)

Esa medida no es una nota ni un castigo: es la cuenta de cuántas veces la persona que entró detrás de ti supo lo que pasaba.

PREGUNTAS:
P: Qué ve el supervisor cuando firmas tu relevo?
a) Un aviso en el chat
*b) Tu reporte en Handovers Hoy, esperando su firma
c) Nada: el relevo no pasa por él
d) Una copia impresa en su bandeja
EXPLICACION: Sale con la etiqueta de que la cuidadora ya firmó y un botón para que él firme sin salir de la pantalla.

P: Cómo recibe el próximo turno tu reporte?
a) Se lo lee el supervisor
b) Le llega por correo
c) Lo busca en cada expediente
*d) Le sale al entrar, en su pantalla de prólogo
EXPLICACION: Aparece bajo el título Relevo de tu turno anterior, con tu nombre, la hora y un enlace al reporte completo.

P: El supervisor te fuerza el cierre. Qué recibe el turno que entró?
a) El reporte, con una nota de que lo cerró el supervisor
b) Un resumen de números
*c) Nada: no se genera reporte
d) La lista de lo que te quedó pendiente en el turno
EXPLICACION: Forzar el cierre solo cierra la sesión; limpia el panel del supervisor pero no produce ningún relevo.

P: El cuadro Razón del cierre al forzar un turno, es obligatorio?
*a) No, la pantalla dice que es opcional
b) Sí, y sin ella el botón se queda gris
c) Sí, y hay que elegirla de una lista cerrada
d) No existe ese cuadro en el panel del supervisor
EXPLICACION: Si el supervisor lo deja vacío, en el registro queda escrito "Sin razón especificada".

P: Dónde ves tú cuántos turnos cerraste con el relevo?
a) En el panel del supervisor, si te deja mirarlo
*b) En tu pantalla de Mi desempeño, la primera medida
c) En el expediente de cada residente que atendiste
d) En la pantalla de Academy, junto a tus cursos
EXPLICACION: Es la primera medida de esa pantalla, con el número, el porcentaje y la frase que explica para qué sirve.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 5: HANDOVER DE ENFERMERIA Y RELEVO DE TURNO
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'HANDOVER_101',
    title: 'Handover de Enfermeria y Relevo de Turno',
    description: 'Domina el proceso de handover entre turnos: comunicacion efectiva, documentacion y continuidad del cuidado.',
    durationMins: 30,
    bonusCompliance: 10,
    emoji: '🤝',
    category: 'Protocolos Clinicos',
    order: 12,
    content: `---META---
TITULO: Handover de Enfermeria y Relevo de Turno
PROMPT_ZENDI: Evalúa si la persona sabe entregar su turno con el asistente de tres pasos, sabe qué lleva y qué no lleva el relevo, sabe leerlo al entrar sin esperar nada que confirmar, y sabe qué pasa de verdad si no firma.
TERMINOS_CLAVE: Entregar Turno, Cierre de turno, Paso 1 Pendientes, Estado Limpio, Tu Reporte de Turno, He leido y confirmo, Firma con el dedo, Turno Entregado, relevo, Resumen Visual del Turno, Relevo de tu turno anterior, Prologo del Dia, grupo de color, Relevos de Guardia, Handovers Hoy, Reportes de Turno, Sesiones Sin Cerrar, Forzar cierre, Turnos cerrados con el relevo
PREGUNTA_REFLEXION: Piensa en el último turno que recibiste. ¿Qué te hizo falta saber esa tarde o esa noche que no venía en el relevo, y a quién tuviste que preguntárselo?

---SECCION_1---
LECTURA:
# El relevo de la tableta tiene un solo camino, y lo firma quien sale

El relevo es el reporte con el que entregas tu turno al que entra. Desde la tableta del piso hay **una sola forma** de hacerlo: el botón **Entregar Turno**, arriba a la derecha, en la barra oscura de tu pantalla de turno.

En la tableta no hay dos modalidades. No hay handover presencial ni virtual. No hay grabación de audio ni de video. No hay una pantalla compartida para revisarlo juntas. Todo eso lo enseñaba el curso viejo y nunca se construyó.

## Lo que guarda el relevo de la tableta, y lo que no

Hablamos del relevo que firmas tú, en la tableta, al cerrar tu turno. Es el que te toca:

| Lo que SÍ queda escrito | Lo que NO queda escrito |
|---|---|
| Quién entregó el turno | Quién lo recibió |
| La hora exacta de la firma | La hora en que alguien lo leyó |
| El texto que firmaste, tal cual | Una confirmación de recepción |
| Tu firma con el dedo | Qué elementos se dieron por leídos |
| Los colores que cubriste | Un audio o un video tuyo |

Léelo otra vez, porque es lo que más se malentiende: **el relevo que tú firmas en la tableta no registra a quien lo recibe.** No hay ningún acto de recepción en la tableta. Quien entra lo LEE, y leerlo no deja rastro en ninguna parte.

Eso quiere decir dos cosas para ti:

- Si tú entregas, **nadie va a confirmarte nada** desde la tableta. No esperes un aviso de que lo recibieron, porque no existe.
- Si tú recibes, **no busques dónde aceptar**. En la tableta no hay botón. Tu trabajo con el relevo es leerlo.

## Si además llevas enfermería, supervisión o dirección

Hay una segunda pantalla de relevo, y conviene no confundirla con esta. Está fuera de la tableta, en el módulo corporativo: **Auditoría de Relevos de Guardia**, en la parte médica. Ahí un relevo se redacta nombrando a quien entra, y quien entra lo confirma con el botón **Confirmar Cierre de Turno**, que pregunta si declara haber leído las notas críticas y si asume formalmente la guardia. Ese sí anota a quien recibe y la hora en que lo aceptó.

Son dos puertas distintas y no se cruzan: el relevo de guardia se acepta ahí porque ahí nació con un nombre esperándolo. El de la tableta sale de tu firma sin nadie anotado como receptor, y lo único que le queda por delante es la firma del supervisor — nunca la aceptación de quien entra. Cuando este curso dice que nadie confirma la recepción, habla del de la tableta, que es el que firma el piso y el que enseña este curso.

## Los tres pasos que el propio asistente anuncia

Cuando abres el cierre, arriba sale un banner que dice **¿Cómo funciona el cierre?** con tres números:

1. **Lees y firmas** tu reporte aquí.
2. Le llega al **supervisor** para su firma.
3. El **próximo turno** lo recibe al entrar.

Ese es todo el recorrido. Nada más pasa, y nada menos.

![La barra oscura del turno: el turno de Mañana, el chip del grupo BLUE y, a la derecha, el botón Entregar Turno. Ese botón es el único camino del relevo desde la tableta.](/academy/capturas/care-turno-lista.jpg)

PREGUNTAS:
P: ¿Cuántas formas hay de entregar tu turno desde la tableta del piso?
a) Dos: presencial cuando coincides con quien entra, y virtual cuando no
*b) Una sola: el botón Entregar Turno
c) Tres, una por cada turno del día
d) Depende de si el supervisor está en el piso
EXPLICACION: El handover presencial y el virtual nunca se construyeron: no hay un campo, ni una rama de código, ni una etiqueta en pantalla que los distinga. Enfermería, supervisión y dirección tienen aparte su propia pantalla de relevos de guardia en el módulo corporativo, pero esa no es la de la tableta ni la sustituye.

P: El relevo que tú firmas en la tableta, ¿qué guarda sobre quien lo recibe?
a) Su nombre y la hora exacta en que confirmó la recepción
b) Su firma, junto a la de quien entrega el turno
c) La lista de los elementos que marcó como leídos
*d) Nada
EXPLICACION: El relevo de la tableta queda atado a quien entrega y a nadie más: quien entra lo lee, y esa lectura no se registra en ningún sitio. En el módulo corporativo, la pantalla de relevos de guardia sí anota a quien recibe y cuándo lo aceptó, pero es otra puerta y otros roles.

P: El banner del asistente de cierre resume tres cosas que pasan con tu reporte. ¿Cuáles son?
*a) Lo firmas, le llega al supervisor y lo recibe el próximo turno
b) Lo firma enfermería, lo revisa dirección y se archiva sin más
c) Se manda a la familia, al supervisor y al médico
d) Lo lee Zendi, lo corrige y lo publica en el expediente
EXPLICACION: Está escrito arriba del asistente, en el bloque teal de cómo funciona el cierre, con los números 1, 2 y 3.

P: ¿Dónde está el botón Entregar Turno?
a) Dentro de la tarjeta de cada residente, abajo del todo
b) En el menú de la izquierda, debajo de Acciones
*c) Arriba a la derecha, en la barra oscura del turno
d) En la pantalla de inicio, al lado de Cerrar Sesión
EXPLICACION: Va en la barra oscura de arriba, junto al chat, la campana y tu avatar. No está en la tarjeta del residente ni en el menú lateral.

P: Una compañera te pide que grabes un audio con el resumen del turno. ¿Qué haces?
a) Lo grabas desde el botón de micrófono del asistente
*b) Le dices que eso no existe: el relevo se escribe y se firma
c) Se lo dictas a Zendi
d) Grabas un mensaje de voz en el chat del piso
EXPLICACION: El único audio del sistema es de salida: Zendi te lee el briefing al entrar. Nada graba a la cuidadora en ningún punto del relevo.

---SECCION_2---
LECTURA:
# Entregar el turno: tres pasos y una firma

Pulsas **Entregar Turno** y se abre a pantalla completa **Cierre de turno — Reporte para el próximo equipo**. Arriba a la derecha, en ámbar, el aviso que resume todo: **Tu turno se cierra cuando firmes este reporte**.

## Paso 1 — Pendientes de tu turno

A la izquierda. Si la pantalla tiene avisos que darte, cada uno viene con tres botones, y solo tres:

| Botón | Lo que dice debajo |
|---|---|
| **Rehusó** | El residente no aceptó |
| **Durmió** | Estaba dormido(a) |
| **Trasladar** | Que lo haga el próximo turno |

Si no hay nada, sale un sello verde: **Estado Limpio**.

**Y aquí hay que ser honesto contigo.** Hoy, en el piso, ese Paso 1 sale en Estado Limpio prácticamente siempre, porque la pantalla no está recibiendo avisos que mostrarte.

| Estado Limpio SÍ significa | Estado Limpio NO significa |
|---|---|
| Que la pantalla no tiene nada que pedirte | Que tu turno quedó sin pendientes |
| Que puedes seguir al Paso 2 | Que alguien revisó tu trabajo |
| Que no hay nada que trasladar desde ahí | Que los medicamentos quedaron todos dados |

Lo que quedó pendiente de verdad lo sabes tú, y el sitio donde entra es el texto del Paso 2.

## Paso 2 — Tu Reporte de Turno

A la derecha. Arriba, cuatro cajitas con los números de tu turno: **MEDS**, **BAÑOS**, **COMIDAS**, **VITALES**. Debajo, el texto que armó Zendi, dentro de un cuadro que **puedes corregir**. Y al final, una casilla que hay que marcar: **He leído y confirmo que este reporte es correcto**.

Mientras esa casilla esté sin marcar, el recuadro de la firma se queda apagado. Es la única puerta de lectura que existe en todo el módulo.

## Paso 3 — Firma con el dedo

Un recuadro punteado que dice **Firma aquí con el dedo o el lápiz**. **No hay PIN en ninguna parte**: la firma es un trazo.

Debajo, la segunda casilla: **Certifico bajo penalidad normativa que este traspaso es verídico y las rondas fueron ejecutadas**. Y el botón verde: **CONFIRMAR CIERRE DE TURNO**.

Dos cosas que hay que saber antes de pulsarlo:

- **Si editas el texto después de firmar, la firma se borra.** Hay que firmar otra vez. Es a propósito: lo que queda firmado tiene que ser exactamente lo que leíste.
- **Si la tableta se ve lenta y lo pulsas dos veces, no pasa nada malo.** Hay una guarda: si ya existe un relevo tuyo de ese turno de hace menos de dos minutos, el sistema no crea otro. Te devuelve el que ya estaba y te lleva a la misma pantalla de siempre.

Al terminar sale una pantalla verde: **Turno Entregado**, con la frase **Tu reporte de cierre fue guardado y firmado**, y debajo **Cerrar sesión**.

Esa pantalla verde es **la misma con uno o con dos toques**. La tableta no te avisa de que hubo un segundo toque ni te dice que no se duplicó: sencillamente no duplica. Así que no busques un mensaje distinto para quedarte tranquila — la señal de que tu turno se entregó es **Turno Entregado**, y con verla una vez basta.

![El asistente de cierre. Izquierda, Paso 1 con el sello Estado Limpio. Derecha, Paso 2 con los cuatro contadores, el texto de Zendi y la casilla He leído y confirmo que este reporte es correcto.](/academy/capturas/care-turno-entregar.jpg)

PREGUNTAS:
P: ¿Qué desbloquea la firma en el Paso 2?
a) Que el supervisor apruebe el texto desde su panel
b) Que pasen dos minutos
*c) Marcar la casilla de que leíste y confirmas que el reporte es correcto
d) Borrar los cuatro contadores y volverlos a cargar
EXPLICACION: Es la única casilla de lectura del módulo, y sin ella el recuadro de la firma se queda apagado.

P: Tu Paso 1 sale en Estado Limpio. ¿Qué significa?
*a) Que la pantalla no tiene nada que pedirte
b) Que tu turno quedó sin ningún pendiente para el que entra
c) Que el supervisor ya revisó y aprobó tus tareas del turno
d) Que los medicamentos del turno quedaron todos administrados
EXPLICACION: Estado Limpio habla de lo que la pantalla sabe, no de lo que pasó en tu turno. Lo que quedó pendiente lo escribes tú en el texto del Paso 2.

P: Firmaste y después corriges una línea del texto del reporte. ¿Qué pasa?
a) Se guarda el texto nuevo con la firma que ya habías hecho
b) El supervisor tiene que autorizar el cambio desde su panel
c) El texto vuelve solo a la versión que escribió Zendi
*d) La firma se borra y hay que firmar otra vez
EXPLICACION: Así lo que queda firmado es exactamente el texto que leíste, y no una versión que cambió después de tu trazo.

P: ¿Qué tres botones te ofrece un aviso del Paso 1?
a) Resolver, escalar al supervisor o documentar y continuar
*b) Rehusó, Durmió y Trasladar
c) Aceptar, rechazar o mandarlo a Triage Central
d) Hecho, pendiente o lo hará enfermería en el próximo turno
EXPLICACION: Resolver, escalar y documentar era lo que enseñaba el curso viejo, y no hay ninguna pantalla que ofrezca esas tres salidas.

P: Pulsas Confirmar Cierre de Turno, la tableta se ve lenta y lo pulsas otra vez. ¿Qué pasa?
a) Se crean dos relevos y hay que pedir que borren uno
b) Sale un error rojo y tienes que empezar el asistente de nuevo
*c) Te devuelve el relevo que ya se creó, sin duplicarlo
d) El segundo toque sobrescribe el primero y se pierde tu firma
EXPLICACION: La guarda mira si hay un relevo tuyo de ese turno de hace menos de dos minutos y te contesta con éxito, no con un error. Sales a la pantalla verde de Turno Entregado, la misma que en un cierre normal: la tableta no te avisa de que hubo un segundo toque.

---SECCION_3---
LECTURA:
# Qué lleva el relevo, y qué tiene prohibido llevar

El relevo **no es un parte de todo lo que hiciste**. Es una lista de a quién mirar. Cabe en 500 caracteres y tiene dos bloques:

- **Atención** — los residentes con algo que seguir: una caída, una alerta clínica, un medicamento rehusado, un traslado, una úlcera, una tarea que quedó abierta. Uno por línea, con su nombre y qué hay que vigilar.
- **Pendiente del turno anterior** — lo que trasladaste, una línea cada cosa.

Si no hay nada que seguir, dice **Sin novedades que requieran seguimiento**.

## Lo que tiene prohibido

| Lo que SÍ lleva | Lo que NO lleva |
|---|---|
| A quién mirar y por qué | Cuántos medicamentos diste |
| Las caídas del turno | Cuántas comidas y baños registraste |
| Las alertas clínicas de tus residentes | Cuántos vitales y rotaciones hiciste |
| Los medicamentos que no se dieron, con tu motivo | Los residentes que estuvieron sin novedad |

Los recuentos están vetados a propósito. El relevo anterior llegaba a 1.274 caracteres de números, a las diez de la noche, en una tableta, al cambio de turno. Un resumen que no se lee entero vale lo mismo que no tenerlo.

**Los cuatro contadores del Paso 2 son para ti**, para que compares lo que hiciste con lo que dice el texto antes de firmarlo. Al relevo no viajan.

## Tres cosas que conviene saber del texto

**Las caídas y las alertas salen aunque las escribiera otra persona.** El criterio es el residente, no el autor, y el texto dice quién lo reportó. Antes se filtraba por autor: de 858 relevos de 90 días, 102 dijeron "sin novedades" y 39 de esos eran falsos.

**Los medicamentos que no diste salen con tu motivo, tal cual.** Entran los tres estados que decide una persona: **Omitido**, **Rechazado** y **Suspendido**. Por eso el motivo importa tanto: lo que escribiste al omitir es lo que va a leer quien entra. Si quedó corto, quien entra se queda igual de a ciegas.

**El MISSED no sale.** Ese lo pone el sistema solo cuando vence la ventana de la dosis, sin autor. No se ve en tu tableta y tampoco llega al relevo.

## Cuando Zendi falla

En vez de la pastilla teal **ZENDI AI** sale una ámbar que dice **Reporte base**. Ese texto de respaldo sí trae los números. No es culpa tuya y se firma igual, pero léelo con más cuidado: no está escrito para el que entra.

![La columna derecha entera: los cuatro contadores, el reporte editable, la casilla ya marcada, el recuadro punteado donde se firma con el dedo y la frase que se certifica. No hay PIN en ninguna parte.](/academy/capturas/cierre-paso-3-firma.jpg)

PREGUNTAS:
P: Tu relevo no menciona cuántos medicamentos diste. ¿Por qué?
a) Porque Zendi solo cuenta los que se firmaron en pack
b) Porque el recuento lo añade el supervisor cuando firma
c) Porque ese dato viaja aparte, en la ficha de cada residente
*d) Porque el relevo tiene prohibido llevar recuentos
EXPLICACION: El relevo dice a quién mirar, no cuánto se hizo. Los totales ya están en el panel y aquí solo entierran lo que importa.

P: Otra cuidadora escribió una alerta clínica de un residente tuyo durante tu turno. ¿Sale en tu relevo?
a) No, solo lo que escribiste tú
*b) Sí, y dice quién lo reportó
c) Solo si la marcaste como crítica antes de cerrar el turno
d) Solo si esa cuidadora también cierra su turno antes que tú
EXPLICACION: Al que entra le importa igual quién lo escribiera. Por eso el criterio es el residente, y el texto nombra a quien lo reportó para que tú no firmes algo que no viste.

P: Omitiste la Tamsulosina de Luis Ortega y escribiste el motivo. ¿Qué pasa con ese motivo?
*a) Lo lee tal cual quien entra al turno
b) Se queda en el expediente y no sale del módulo de medicamentos
c) Lo reescribe Zendi más corto
d) Solo lo ve enfermería cuando revisa las omisiones de la semana
EXPLICACION: Va al relevo sin tocar. Un motivo de tres palabras deja al turno siguiente sin saber si hay que repetir la dosis o no.

P: En el Paso 2 sale una pastilla ámbar que dice Reporte base, en vez de la teal de Zendi AI. ¿Qué quiere decir?
a) Que el reporte ya fue leído y firmado por el supervisor
b) Que te faltan tareas del turno por resolver antes de firmar
*c) Que Zendi falló y salió el texto de respaldo
d) Que estás cerrando un turno de noche y el formato cambia
EXPLICACION: Es el único texto donde sí aparecen los recuentos. Se firma igual, pero conviene leerlo despacio porque no está redactado para el que entra.

P: ¿Qué son los cuatro contadores Meds, Baños, Comidas y Vitales del Paso 2?
a) Las tareas que te faltan por completar
b) Lo primero que lee quien entra al turno
c) La nota con la que te evalúa el supervisor
*d) Contexto para que leas tu reporte con los números delante
EXPLICACION: Son tuyos y se quedan en esa pantalla: sirven para comparar lo que hiciste con lo que dice el texto antes de firmarlo.

---SECCION_4---
LECTURA:
# Recibir el relevo: lo que ves al entrar

## Dos puertas que se confunden

La cadena del relevo empieza en **Iniciar Turno**, la puerta teal de tu pantalla de inicio. Abajo del todo está **Cerrar Sesión**. No son lo mismo y conviene tenerlo claro: **cerrar sesión te saca de la tableta, pero no entrega el turno**.

![La pantalla de inicio de la tableta, antes de entrar al turno: las dos puertas que se confunden, Iniciar Turno arriba y Cerrar Sesión abajo. Cerrar sesión te saca de la tableta; no entrega el turno.](/academy/capturas/care-hub-puertas.jpg)

## Dónde aparece el relevo

Eliges tu color, verificas el censo, fichas y Zendi te narra el arranque. Si tocas **Omitir Audio (Lectura Rápida)** pasas a la versión escrita, y ahí salen dos bloques distintos, uno encima del otro:

| | **Relevo de tu turno anterior** (teal) | **Prólogo del Día — Zendi** (ámbar) |
|---|---|---|
| De quién es | Del color que tú cubres hoy | De toda la sede |
| Quién lo escribió | La cuidadora que salió, y lo firmó | Zendi, sin que nadie lo pida |
| Cuándo | Al cerrar su turno, hoy | Todos los días a las 6:00 AM |
| Qué hay que hacer | Leerlo | Leerlo |

El bloque teal trae el nombre de quien lo entregó, la hora y el texto. El ámbar trae una pastilla que dice **Generado a las 6:00 AM**.

## Cómo se ve esa pantalla, de arriba abajo

Es la pantalla oscura del arranque, la que sale antes de la lista de residentes. Cuando tocas Lectura Rápida, el título de arriba cambia a **Resumen Visual del Turno** y debajo se apilan, en este orden:

1. El bloque **teal** — **RELEVO DE TU TURNO ANTERIOR** en letras pequeñas arriba a la izquierda y **la hora de cierre a la derecha**. Debajo, **Entregado por** y el nombre de la cuidadora que salió. Debajo, su texto. Y al final, el enlace **Ver reporte completo**.
2. El bloque **ámbar** — **PRÓLOGO DEL DÍA — ZENDI**, con la pastilla **Generado a las 6:00 AM** a la derecha, y el texto debajo. Sin nombre de autor y sin enlace: no hay nada más que abrir.
3. Tres recuadros con números **de los residentes de tu color**: las alertas de vitales recientes, las inapetencias de las últimas 8 horas y las citas de hoy.
4. Abajo del todo, el botón grande **Adelante, Iniciar Cuidados**, que te lleva a la lista de tus residentes.

Reconoce el orden, porque la posición es la única pista: los dos textos se parecen y el color es lo que los separa. **Teal, del turno que salió. Ámbar, de toda la sede.**

## Nada que confirmar

En los dos bloques, lo único que se te pide es leer. **No hay casillas por elemento, ni un botón de recibido, ni una lista de cosas que marcar como leídas.** Eso lo enseñaba el curso viejo y no existe.

## Dos trampas de esa pantalla

**Los dos bloques salen recortados.** El relevo se corta a 300 caracteres y el prólogo a 400, con puntos suspensivos. Con el prólogo hay un detalle feo: Zendi deja las prioridades del turno para el final del texto, así que lo que se corta suele ser justo la parte accionable. **Si termina en puntos suspensivos, falta algo** — y ese algo suele ser lo que hay que hacer.

**El bloque teal busca TU color, y solo de hoy.** Si nadie que cubriera tu color cerró un turno hoy, ese bloque no se pinta. Que no salga no quiere decir que el turno anterior fuera tranquilo: quiere decir que no hay relevo de tu color.

## Ver reporte completo

El bloque teal trae un enlace **Ver reporte completo**. Esa pantalla hoy la abren supervisión y dirección; si eres cuidadora te contesta "Este relevo lo firma supervisión o dirección". La lista **Reportes de Turno** sí la puedes abrir, y ahí están los cierres con su turno, su hora y quién los cerró.

PREGUNTAS:
P: Entras a tu turno y el bloque teal del relevo anterior no aparece. ¿Qué significa?
*a) Que nadie de tu color cerró un turno hoy
b) Que el turno anterior fue tranquilo
c) Que lo tienes que pedir al supervisor para que te lo abra
d) Que todavía se está generando y aparecerá en unos minutos
EXPLICACION: El bloque busca el último relevo firmado de tu color, del día de hoy. Si no hay, no se pinta nada, y eso no dice nada sobre lo que pasó.

P: ¿Qué hay que hacer con el Prólogo del Día cuando lo lees?
a) Marcar cada elemento como leído para dejar constancia
b) Reenviarlo a enfermería si hay algo que no entiendes
*c) Leerlo
d) Confirmar la recepción antes de empezar a trabajar
EXPLICACION: Es texto de solo lectura. Ninguna acción tuya sobre ese bloque se guarda en ninguna parte.

P: ¿De quién es el Prólogo del Día?
a) De tus residentes
*b) De toda la sede
c) Del turno que acaba de salir, con lo que dejó pendiente
d) De la cuidadora que lo pidió al entrar a su turno
EXPLICACION: Lo genera un proceso automático a las 6:00 AM, una vez al día y por sede, con las últimas 24 horas. No está ligado a ningún color ni a ninguna persona.

P: El Prólogo del Día termina en puntos suspensivos. ¿Qué conviene saber?
a) Que Zendi se quedó sin datos
b) Que no hay nada más que contar
c) Que el resto se lee pulsando encima
*d) Que el bloque está recortado y lo que se corta suele ser lo accionable
EXPLICACION: Se corta a 400 caracteres, y el texto deja las prioridades del turno para el final. Lo que sobrevive en pantalla es el preámbulo.

P: Cierras sesión al terminar tu jornada, sin pasar por Entregar Turno. ¿Qué queda?
*a) El turno abierto y sin relevo
b) El turno cerrado, pero con el reporte pendiente de firma
c) El turno cerrado y un relevo automático con tus números
d) Nada: cerrar sesión y entregar el turno son la misma cosa
EXPLICACION: Son dos puertas distintas. Cerrar sesión te saca de la tableta; el turno solo se cierra cuando firmas el asistente.

---SECCION_5---
LECTURA:
# Después de tu firma: quién lo ve y qué pasa si no firmas

## Lo que ve el supervisor

En su panel hay un bloque que se llama **Handovers Hoy**. Cada relevo firmado por una cuidadora le aparece ahí con la etiqueta **Cuidadora firmó · falta tu firma**, el turno, la hora, los colores que se cubrieron, cuántos residentes y un botón verde **FIRMAR** al lado. Arriba, dos contadores: **N esperando tu firma** en ámbar y **N firmado** en verde. Y abajo, **Completados hoy**, colapsado.

Firmar el relevo es de supervisión y dirección. No es un paso que una cuidadora pueda dar ni tenga que esperar.

![Handovers Hoy en el panel del supervisor: el relevo de la noche con la etiqueta Cuidadora firmó, falta tu firma, y el botón Firmar al lado. Arriba, 1 esperando tu firma y 1 firmado.](/academy/capturas/supervisor-relevos.jpg)

## Si no firmas

No hay multa, no hay bloqueo y nadie te quita puntos. Pasan tres cosas, y son peores por silenciosas:

| Lo que SÍ pasa | Lo que NO pasa |
|---|---|
| Quien entra detrás de ti entra a ciegas | Te bloquean la tableta |
| Tu sesión se queda abierta | Se te descuenta de la nómina |
| A las 12 horas le sale al supervisor en **Sesiones Sin Cerrar** | El sistema escribe un relevo por ti |
| Queda contado en tu **Mi Desempeño** | Alguien te avisa de que faltó |

Esa sesión abierta no desaparece sola: sigue en la lista del supervisor hasta siete días, con las horas que lleva.

## Forzar cierre

Desde ahí el supervisor puede cerrar tu sesión. El botón se llama **Forzar cierre** (o **Cerrar turno** si lleva menos de doce horas) y abre un cuadro: **Confirmar cierre de turno — Esta acción no se puede deshacer**, con una razón opcional que queda registrada y te llega a ti como notificación.

Dos cosas que hay que tener claras:

- **Forzar el cierre no produce relevo.** Cierra la sesión y ya. El turno que entra detrás no recibe nada de ese turno. Es el último recurso, no un atajo para saltarse el asistente.
- **No está al alcance de una cuidadora.** El servidor contesta "Solo SUPERVISOR, DIRECTOR o ADMIN pueden forzar cierre". Es un permiso de rol: ninguna autorización verbal lo cambia.

## Dónde se ve tu constancia

En **Mi desempeño**, la primera medida de la pantalla: **Turnos cerrados con el relevo**, con cuántos de cuántos y el porcentaje. Debajo, la frase que explica por qué se mide: un turno sin cerrar deja al que entra sin saber qué pasó. No es una nota ni un castigo. Es un dato que se ve, que es distinto y es justo.

![Mi desempeño, la pantalla que abre cada empleado: arriba del todo, Turnos cerrados con el relevo, 19 de 21, con el 90% debajo.](/academy/capturas/mi-desempeno.jpg)

PREGUNTAS:
P: ¿Cómo le llega tu relevo al supervisor?
a) Por correo, con el texto completo en el cuerpo del mensaje
b) Con una campana en cuanto firmas
c) Se lo tienes que enseñar tú al entregarle el turno en el piso
*d) Le aparece en su bloque Handovers Hoy
EXPLICACION: El cierre de turno dejó de mandar campana en agosto de 2026, porque eran 1.265 avisos al mes por el camino normal. El relevo aparece en su panel con el botón Firmar al lado.

P: Terminas tu jornada y no firmas el cierre. ¿Cuál es la consecuencia real?
a) La tableta te bloquea la sesión siguiente
*b) Quien entra detrás de ti entra sin saber qué pasó en tu turno
c) Se te descuenta el turno de la nómina
d) El sistema genera un relevo automático
EXPLICACION: Además tu sesión queda abierta y le sale al supervisor en Sesiones Sin Cerrar, y ese turno se cuenta en tu Mi Desempeño.

P: El supervisor fuerza el cierre de un turno que quedó abierto. ¿Qué recibe el turno siguiente?
a) El mismo relevo, firmado por el supervisor en lugar de la cuidadora
b) Un resumen con los números del turno, sin el texto de Zendi
*c) Nada
d) Un aviso para que le pregunte a la cuidadora que se fue
EXPLICACION: Forzar cierre solo cierra la sesión: no crea relevo. Por eso es el último recurso y no una vía alterna al asistente.

P: Una cuidadora con permiso de su supervisora quiere forzar el cierre de su propio turno. ¿Puede?
*a) No
b) Sí, con la autorización del supervisor por escrito
c) Sí, pero solo si el turno lleva más de doce horas abierto
d) Sí, pidiendo a Zendi que le habilite el botón esa vez
EXPLICACION: El servidor lo rechaza por rol, no por autorización: solo SUPERVISOR, DIRECTOR o ADMIN pueden forzar un cierre.

P: ¿Dónde vuelves a encontrar un relevo que ya se firmó?
a) En la Bitácora del residente
b) En el chat del piso, donde se publica al cerrar el turno
*c) En la pantalla Reportes de Turno
d) En el expediente de cada residente, en la pestaña de turnos
EXPLICACION: Ahí están los cierres con su turno, su hora y la etiqueta de firma. El texto completo lo abren supervisión y dirección.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 6: USO DE ZENDI AI EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ZENDI_AI_101',
    title: 'Uso de Zendi AI en Zendity',
    description: 'Aprende a usar Zendi AI como herramienta de apoyo: formatos de notas, comunicaciones y sus limites eticos.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🤖',
    category: 'Tecnologia Zendity',
    order: 14,
    content: `---META---
TITULO: Uso de Zendi AI en Zendity
PROMPT_ZENDI: Evalúa si la persona sabe dónde está Zendi de verdad, que Zendi reescribe lo que ella ya escribió y ni redacta ni escucha, de dónde sale cada texto automático y con qué ventana de tiempo, y cómo se decide un hallazgo en "Lo que Zendi encontró".
TERMINOS_CLAVE: estrella, Zendi propone, Usar esta versión, Dejar lo mío, Volver a lo que yo había escrito, Escuchar con Zendi, Prólogo del Día, 6:00 AM, reporte de cierre, He leído y confirmo, Zendi Digest, 8 horas, Lo que Zendi encontró, la frase original, Ya se puede documentar, firmado con tu nombre
PREGUNTA_REFLEXION: Piensa en la última nota que escribiste con tus palabras porque no había un campo donde meterla. Qué decía, y en qué botón de Zendity debería haber entrado?

---SECCION_1---
LECTURA:
# Dónde vive Zendi, y qué no es

Zendi no es un chat. En Zendity no hay ningún sitio donde le escribas una pregunta y te conteste. El botón flotante que hubo se retiró el 06-sep-2026: en toda la historia del sistema se usó dos veces.

Y **no hay micrófono en ninguna pantalla.** A Zendi no se le habla.

| Lo que Zendi SÍ hace | Lo que NO hace |
|---|---|
| Reescribe un texto que tú ya escribiste | Escribir la nota por ti desde cero |
| Lee en alto lo que ya está escrito | Escucharte y tomar dictado |
| Arma tres textos solo: el prólogo, tu reporte de cierre y el digest | Resumirte las notas del día cuando se lo pidas |
| Lee las notas de la semana y hace preguntas | Cambiar un expediente o avisar a una familia |

**La voz de Zendi va en un solo sentido: hacia afuera.** Al abrir turno en la tableta te saluda en voz alta, el altavoz de un cuadro de nota lee lo que hay escrito ahí, y el supervisor le da al play de su tarjeta. Ninguno de esos botones oye.

Con el primero hay que ir despacio, porque es donde más gente se confunde: **lo que suena al abrir turno no es el Prólogo del Día.** Es un saludo que arma el código, no un modelo — "Buen día, Ana. Bienvenido al Grupo..." —, y sigue con una frase por cada residente **tuyo** que tenga fiebre, que haya rechazado una comida o que tenga cita hoy. O sea que ese audio sí va por tu color y sí dice nombres. El prólogo es otro texto distinto, viaja aparte y **en la tableta no se oye nunca.** Más adelante va entero.

## Las cinco cosas que se llaman Zendi

| Nombre en pantalla | Dónde está | Quién entra |
|---|---|---|
| La estrella del cuadro de nota | La tableta, y varias pantallas más | Todos |
| **Prólogo del Día — Zendi** | Al abrir turno en la tableta | Todos |
| **Paso 2 — Tu reporte de turno** | Dentro de **Entregar Turno** | Todos |
| **Lo que Zendi encontró** | El menú de la izquierda | Enfermería, supervisión y dirección |
| **Zendi Digest del Día** | El panel de dirección | La cuidadora no |

Y hay una más que lleva el nombre y no es inteligencia artificial: **Zendi te recomienda**, en Academy. Ese curso sale de tus propios registros del mes, contados por el sistema — "El mes pasado atendiste 3 caídas" —, no de un modelo. Por eso el motivo siempre se puede comprobar.

![La recomendación de Academy: el motivo sale de tus registros del mes, contados por el sistema. Lleva el nombre de Zendi, pero no lo escribe un modelo.](/academy/capturas/academy-recomendacion-zendi.jpg)

PREGUNTAS:
P: Cómo se le habla a Zendi para pedirle algo?
a) Con el botón de micrófono que hay en la tableta
b) Desde la ventana de chat de Zendi en el menú
*c) No se le habla: Zendi no oye
d) Dictando la nota y pulsando después enviar
EXPLICACION: No hay micrófono en ninguna pantalla de Zendity y el botón flotante se retiró el 06-sep-2026. La voz de Zendi va solo hacia afuera: lee, no escucha.

P: De dónde sale el curso que aparece en "Zendi te recomienda", en Academy?
a) De un modelo que lee tu expediente de empleada
*b) De tus registros del mes, contados por el sistema
c) De lo que tu supervisora escribió sobre tu trabajo
d) Del curso que más gente aprobó en la sede este mes
EXPLICACION: Es una cuenta hecha por el código, no por un modelo. Por eso el motivo dice algo comprobable, como "El mes pasado atendiste 3 caídas".

P: Cuál de estas cosas hace Zendi de verdad?
a) Avisar a la familia cuando algo cambia
b) Escribir la nota clínica por ti desde cero
c) Decidir si un residente va al hospital
*d) Reescribir un texto que tú ya escribiste
EXPLICACION: Todas las superficies de Zendi parten de algo que una persona escribió antes. Zendi no arranca de una hoja en blanco ni decide nada.

P: Quién puede abrir "Lo que Zendi encontró" desde el menú?
a) Cualquier empleado que tenga sesión abierta
*b) Enfermería, supervisión y dirección
c) Solo la cuidadora que escribió la nota
d) Solo dirección y el dueño del hogar
EXPLICACION: El menú y la pantalla usan el mismo permiso: NURSE, SUPERVISOR, DIRECTOR y ADMIN. Una cuidadora no la ve en su menú.

P: Qué hace el altavoz que ves junto a un cuadro de nota?
a) Graba tu voz y la escribe
b) Manda la nota por voz al supervisor
c) Llama a enfermería por el intercomunicador
*d) Lee en alto lo que ya está escrito ahí
EXPLICACION: Se llama "Escuchar con Zendi" y solo reproduce el texto del cuadro. Es salida de voz, nunca entrada.

---SECCION_2---
LECTURA:
# La estrella: Zendi propone, tú decides

En varios cuadros de nota hay una **estrella** abajo a la derecha. Ese es Zendi.

El orden importa, y es este:

1. **Escribes tú primero.** Con tus palabras, como te salga.
2. Pulsas la estrella.
3. Debajo se abre un recuadro verde azulado: **Zendi propone**, con otra redacción.
4. Decides: **Usar esta versión** o **Dejar lo mío**.
5. Si la usaste y no te convence, aparece **Volver a lo que yo había escrito**.

Lo tuyo no se borra hasta que tú pulses **Usar esta versión**. Y debajo del panel está la línea que resume el curso entero:

**Léela antes de aceptarla. Lo que se guarde va firmado con tu nombre.**

## Sin texto no hay estrella

Con el cuadro vacío **la estrella ni siquiera se deja pulsar.** Se ve apagada y no responde al toque hasta que hayas escrito algo. No sale ningún aviso ni ningún mensaje: no hay nada que avisar, porque a Zendi no se le llega a preguntar. **Zendi no redacta desde cero.** No puedes pedirle "escríbeme la nota de Rosa", porque no sabe quién es Rosa.

Eso último es literal. Cuando pulsas la estrella, Zendi recibe tres cosas: el tipo de cuadro, tu texto, y una etiqueta que describe el campo — por ejemplo "nota clínica operativa". **No consulta el expediente, ni los medicamentos, ni el turno.** Solo ve lo que tú escribiste.

![En el motivo de un traslado de Rosa Medina: arriba lo que escribió la cuidadora, y debajo el panel "Zendi propone" con "Usar esta versión" y "Dejar lo mío". Lo suyo sigue arriba, intacto.](/academy/capturas/zendi-propone.jpg)

## El estilo no lo eliges tú: lo trae la pantalla

Aquí es donde más gente se equivoca. **No existe ningún selector de modo.** Cada cuadro ya viene con el suyo puesto.

| Dónde está el cuadro | Lo que devuelve |
|---|---|
| La tableta: bitácora, reporte a enfermería, motivo de traslado, anomalía de noche, Acciones | Nota operativa de **3 oraciones como máximo**, sin viñetas y sin títulos |
| Observación de cocina, en el panel del supervisor | Dos oraciones sobre el **servicio**, para que el cocinero sepa qué se observó |
| Memorándum del supervisor | Un memo de recursos humanos sobre un empleado, máximo 150 palabras |
| Correo a la familia | Máximo 100 palabras, tono cálido y sin tecnicismos |
| Comunicado corporativo | Pule el tono y la ortografía del borrador |

Mira bien la primera fila: **lo que sale en la tableta es un párrafo corto, no un documento con secciones.** Si escribiste tres líneas, te devuelve tres líneas mejor dichas. No te monta un informe.

Y de todos esos cuadros, **una cuidadora solo llega al primero.** Los demás viven en pantallas de supervisión, de cocina, de recursos humanos o del expediente médico.

## En el Plan de Atención es al revés

En el PAI el botón se llama **Mejorar con Zendi** y no propone al lado: **cambia el texto en el sitio** y te deja un **Deshacer**. El trato es el mismo —tú decides— pero en otro orden: primero cambia y después lo revisas.

PREGUNTAS:
P: Escribiste tu nota y pulsaste la estrella. Qué pasa con lo que tú habías escrito?
a) Se sustituye por la versión de Zendi
b) Se guarda una copia aparte dentro del expediente
*c) Se queda ahí hasta que pulses Usar esta versión
d) Se borra para no tener dos versiones
EXPLICACION: La propuesta sale en un panel debajo y no toca el cuadro. Y si la aceptas, todavía tienes "Volver a lo que yo había escrito".

P: El cuadro de nota está vacío. Qué pasa si vas a la estrella?
*a) No se deja pulsar hasta que escribas algo
b) Te da una nota de ejemplo para ese residente
c) Te avisa con un mensaje de que el texto está vacío
d) Te escribe el resumen de lo que llevas hecho del turno
EXPLICACION: La estrella está apagada mientras el cuadro esté vacío y no acepta el toque. No esperes ningún aviso: no aparece. Y aunque apareciera, Zendi no redacta desde cero.

P: Dónde eliges el estilo con el que Zendi va a reescribir tu nota?
a) En un menú que se abre al pulsar la estrella
b) Escribiéndoselo tú dentro del propio texto
c) En tu perfil de usuario, una vez y para siempre
*d) En ningún sitio: lo trae puesto cada cuadro
EXPLICACION: No hay selector. La pantalla donde vive el cuadro ya fija el estilo, y en la tableta es siempre el de nota operativa.

P: Le pides a Zendi que mejore una nota sin escribir nada del residente. Qué sabe Zendi de él?
a) Sus medicamentos pautados y sus últimos vitales
*b) Nada: solo tu texto
c) Su Plan de Atención Individualizada completo
d) Su expediente entero, diagnósticos incluidos
EXPLICACION: Zendi recibe el tipo de cuadro, tu texto y una etiqueta que describe el campo. No hace ninguna consulta a la base de datos.

P: En el Plan de Atención, el botón "Mejorar con Zendi" se comporta distinto. En qué?
a) Manda el texto a enfermería para que lo apruebe
b) Propone tres versiones para que escojas una
*c) Cambia el texto y te deja un Deshacer
d) Traduce el plan al inglés para el seguro médico
EXPLICACION: Ahí la propuesta no sale al lado: sustituye lo que había. Por eso el botón de deshacer es la única forma de recuperar lo tuyo.

---SECCION_3---
LECTURA:
# Los tres textos que Zendi escribe solo

Hay tres textos que aparecen sin que nadie pulse una estrella. Son distintos entre sí y confundirlos cuesta caro, así que van uno por uno.

## 1. El Prólogo del Día

Lo escribe un trabajo programado **a las 6:00 de la mañana, una sola vez al día y uno por sede**. Lo ves al abrir turno en la tableta, con su sello: **Generado a las 6:00 AM**.

| Lo que SÍ es | Lo que NO es |
|---|---|
| El resumen de las **últimas 24 horas** de la sede | Un resumen de tu grupo de color |
| **El mismo texto para todo el mundo**, palabra por palabra | Un texto escrito para ti |
| Escrito a las 6:00 AM y ya | Uno nuevo al empezar cada turno |

Va otra vez porque es lo que más se cree al revés: **el prólogo no es tuyo.** Las trece cuidadoras leen exactamente el mismo texto, y en el turno de tarde y en el de noche sigue siendo el de las 6:00 de la mañana.

Sale de cinco cosas de las últimas 24 horas, ni una más:

- Incidentes
- Medicamentos omitidos, rechazados o suspendidos
- Vitales fuera de rango
- Úlceras nuevas
- Quién salió al hospital

**De lo que falta por hacer hoy no sabe nada.** Si el prólogo te habla de pendientes, eso no le llegó de ningún sitio. Lo pendiente se mira en la tarjeta del residente.

**En la tableta el prólogo no se oye: solo se lee.** El bloque "Prólogo del Día — Zendi" aparece cuando pulsas **Omitir Audio (Lectura Rápida)**, o cuando el saludo de voz termina por su cuenta. Ese botón no es una preferencia de formato entre oírlo y leerlo: es la puerta por la que sale el prólogo. Lo que sonaba antes de pulsarlo era el saludo, que es otra cosa.

Oírlo sí se puede, pero en otra pantalla: en el panel del supervisor este mismo texto se llama **Prólogo del Turno**, y ahí sí hay un botón de play que lo lee entero.

## 2. Tu reporte de cierre

Al pulsar **Entregar Turno**, el **Paso 2 — Tu reporte de turno** ya viene escrito. Ese sí es tuyo: Zendi lo arma con lo que **tú** hiciste hoy, y arriba salen tus cuatro contadores, Meds, Baños, Comidas y Vitales.

No es un recuento. Se le pide que empiece por **Atención**: a quién hay que mirar y por qué, un residente por línea, con su nombre y qué vigilar. Después, y solo si lo hay, lo que quedó **pendiente del turno anterior**. Si no hay nadie a quien mirar, lo dice en una línea y se acaba.

Y se le prohíben dos cosas que vale la pena saber, porque son las que uno esperaría encontrar: **no abre con un párrafo de resumen general, y no mete recuentos ni totales** — ni medicamentos, ni comidas, ni baños, ni vitales. Esos números ya están arriba, en los cuatro contadores, fuera del texto. Repetirlos dentro solo entierra lo que importa. Cabe en media pantalla a propósito.

Tres cosas que hay que saber de ese paso:

- **El texto se puede corregir.** El cuadro se escribe.
- No se firma sin marcar **He leído y confirmo que este reporte es correcto**.
- **Si lo editas después de firmar, la firma se borra.** Firmas lo que leíste.

## 3. El Digest: un nombre para dos cosas que no se tocan

Esto no lo ve una cuidadora, y aun así conviene entenderlo, porque es el mejor ejemplo del curso entero de un rótulo que promete una cosa y enseña otra. "Digest" nombra dos cosas distintas.

**El botón.** En el armado de relevos de dirección está **Zendi AI Auto-Completar**. Mira **las últimas 8 horas** y devuelve una nota por residente, que cae en los campos "Alertas a Vigilar" del formulario que dirección está llenando. Ahí acaba: **no guarda nada en ninguna parte.** Si se cierra ese formulario sin enviarlo, ese texto no queda.

**El recuadro.** En el panel de dirección hay otra cosa llamada **Zendi Digest del Día**, con el subtítulo **Resumen clínico del último turno**. Ese recuadro **no enseña lo que produjo el botón.** Enseña el último relevo guardado de la sede que traiga texto de Zendi — y el prólogo de las 6:00 AM se guarda igual que un relevo. Así que, casi siempre, lo que se lee bajo ese subtítulo **es el prólogo: 24 horas y toda la sede**, no ocho horas de un turno.

| | Zendi AI Auto-Completar | Zendi Digest del Día |
|---|---|---|
| Qué es | Un botón del formulario de relevos | Un recuadro del panel |
| Ventana | Las últimas 8 horas | La del texto que le toque enseñar |
| Dónde acaba | En los campos del formulario | En pantalla, tal como se guardó |
| Guarda algo? | No | No escribe: solo lee lo último |

De ahí sale el aviso que de verdad importa, y sirve para todo Zendity: **el rótulo de un recuadro no es prueba de lo que hay dentro.** Antes de usar ese resumen para decidir algo, mira **la hora** que el propio recuadro enseña al lado ("hace 9h", "hace 1d"). Si apunta a la madrugada, estás leyendo el prólogo del día, no el turno que acaba de cerrar.

Y por eso **tampoco sirve para ponerse al día tras tres días libres**, ni por un lado ni por el otro: el botón solo alcanza ocho horas, y el recuadro enseña un texto suelto, no la historia de lo que te perdiste.

PREGUNTAS:
P: Entras al turno de tarde y lees el "Prólogo del Día — Zendi". De cuándo es ese texto?
a) Del momento exacto en que abriste tu turno
b) Del cierre del turno de la mañana de hoy
*c) De las 6:00 de la mañana, como todos los días
d) De la última vez que alguien pidió uno nuevo
EXPLICACION: Se escribe una vez al día, a las 6:00 AM, y no se vuelve a generar. El sello de la pantalla lo dice.

P: Tu compañera del grupo rojo lee el prólogo, y tú el tuyo. Qué diferencia hay?
*a) Ninguna: es el mismo texto para toda la sede
b) Ella ve sus residentes y tú ves los tuyos
c) El de ella lleva los medicamentos pendientes
d) El tuyo sale primero porque fichaste antes
EXPLICACION: El prólogo se guarda como global de la sede, sin grupo de color. Las trece cuidadoras leen lo mismo palabra por palabra. Lo que sí cambia de una a otra es el saludo de voz del arranque, que es otro texto.

P: Qué es lo único de esta lista que NO sale en el prólogo?
a) Los incidentes de las últimas 24 horas
b) Los vitales que salieron fuera de rango
c) Quién salió al hospital en el día
*d) Lo que falta por hacer hoy
EXPLICACION: El prólogo se arma con cinco cosas que ya pasaron. De lo pendiente no recibe ni un dato, y eso se mira en la tarjeta del residente.

P: Firmaste el reporte de cierre y después corriges una línea del texto. Qué pasa?
a) Se guarda el cambio con la firma que ya había
b) El texto vuelve a la versión que escribió Zendi
c) Hay que pedirle autorización al supervisor
*d) Se borra la firma y hay que firmar otra vez
EXPLICACION: Es a propósito: lo que queda firmado tiene que ser exactamente lo que leíste.

P: En el panel dice "Zendi Digest del Día — Resumen clínico del último turno". Qué se lee ahí casi siempre?
a) El relevo que acaba de cerrar una cuidadora
*b) El prólogo de las 6:00 AM: 24 horas de sede
c) Lo que devolvió el botón Zendi AI Auto-Completar
d) Las últimas 8 horas de ese turno, como dice el subtítulo
EXPLICACION: El recuadro enseña el último relevo guardado con texto de Zendi, y el prólogo se guarda como uno. El botón de las 8 horas no escribe nada, así que ahí no llega. Mira la hora antes de fiarte del rótulo.

---SECCION_4---
LECTURA:
# Lo que Zendi encontró

Esta es la única pantalla de Zendi con nombre propio en el menú: **Lo que Zendi encontró**. La abren enfermería, supervisión y dirección.

**Cada lunes a las 7:45 de la mañana** Zendi lee el texto libre de los últimos siete días: las notas de turno, las notas de curación de úlceras y los cambios reportados del piso. Y señala tres cosas, ni una más.

| Etiqueta en pantalla | Qué quiere decir |
|---|---|
| **No tiene dónde guardarse** | Alguien escribió a mano algo que el sistema debería poder guardar en un campo |
| **Contradice al expediente** | Lo que dice el texto no coincide con lo que dice el expediente |
| **Debió avisar y no avisó** | La nota describe algo que tenía que haber generado un aviso, y no lo generó |

Arriba del todo, la propia pantalla lo avisa: **No son hechos: son preguntas.**

## La frase va primero

En cada tarjeta, lo primero y más grande es **la frase original**, entre comillas, tal como la escribió la persona. Debajo viene lo que Zendi cree haber notado.

Ese orden es la regla de seguridad de toda la pantalla: **lees la frase y decides, sin tener que fiarte del modelo.**

Hay una guarda más, que no se ve. **Si la frase que Zendi cita no aparece literalmente en la nota, el hallazgo no se guarda.** Inventarse una cita creíble es el fallo más común de estos modelos; aquí ese hallazgo no llega nunca a la lista.

![Una tarjeta por decidir: la etiqueta "Debió avisar y no avisó", la frase de la cuidadora entre comillas arriba del todo, lo que Zendi nota debajo, y las tres salidas.](/academy/capturas/hallazgos-tarjeta-pendiente.jpg)

## Lo que un hallazgo no hace

| Lo que SÍ es | Lo que NO es |
|---|---|
| Una pregunta esperando un sí o un no | Un hecho comprobado |
| Algo que alguien tiene que leer y decidir | Un cambio en el expediente |
| Un asunto interno del equipo | Un aviso a la familia |

Un hallazgo **no toca nada** hasta que una persona decide. Y a Zendi se le prohíbe expresamente diagnosticar: no puede decir qué le pasa al residente, solo dónde se queda corto el sistema.

PREGUNTAS:
P: Cada cuánto lee Zendi las notas que escribe el piso?
a) Cada vez que alguien guarda una nota nueva
b) Todas las noches, al cerrar el día clínico
*c) Una vez por semana, los lunes temprano
d) Cuando el supervisor se lo pide desde su panel
EXPLICACION: Es un trabajo programado de los lunes a las 7:45 de la mañana, y lee los últimos siete días de texto libre.

P: En una tarjeta de "Lo que Zendi encontró", qué se lee primero y en grande?
a) Lo que Zendi cree haber notado en la nota
*b) La frase original, tal como se escribió
c) El nombre de quien escribió la nota
d) La decisión que tomó enfermería sobre el caso
EXPLICACION: La frase va delante para que se pueda decidir leyéndola, sin fiarse de lo que el modelo diga de ella.

P: Zendi cita una frase que en la nota original no aparece así. Qué pasa con ese hallazgo?
a) Sale marcado en rojo para revisarlo aparte
b) Se guarda y alguien lo descarta
*c) No se guarda: no llega a la pantalla
d) Se manda a dirección para verificarlo
EXPLICACION: La cita se compara con el texto de verdad. Si no está, el hallazgo se descarta antes de guardarse.

P: Zendi encuentra que una nota describe una caída que nadie registró. Qué ha cambiado ya en el expediente?
a) La caída quedó registrada en el módulo de caídas
b) La residente pasó a riesgo alto de caída
*c) Nada todavía
d) Se le avisó a la familia de la residente
EXPLICACION: Un hallazgo es una pregunta esperando un sí o un no. No cambia un expediente, no mueve un estado y no avisa a nadie hasta que una persona decide.

P: Cuál de estas cosas NO puede señalar Zendi en esta pantalla?
*a) Qué enfermedad tiene el residente
b) Que el texto contradice al expediente
c) Que algo no tiene dónde guardarse
d) Que algo debió avisar y no avisó
EXPLICACION: Los tres tipos son de sistema, no clínicos. Al modelo se le prohíbe diagnosticar: dice qué le falta al sistema, no qué le pasa a la persona.

---SECCION_5---
LECTURA:
# Decidir un hallazgo, y dónde está el límite

Cada tarjeta trae **tres botones**, y el botón que escoges **es** la razón. Por eso ya no hay que escribir ninguna explicación al cerrarlo.

![Las tres salidas de una tarjeta, cada una con la línea que explica qué pasa después de pulsarla.](/academy/capturas/hallazgos-tres-salidas.jpg)

| Botón | Cuándo se usa | Qué pasa después |
|---|---|---|
| **Ya se puede documentar** | El sitio ya existe en Zendity | Se le avisa a quien escribió la nota de dónde va, con sus propias palabras |
| **Sí, para evaluar** | El hueco es real y hay que construirlo | Pasa a la lista de dirección, en el reporte de los lunes |
| **No hace falta** | Ni existe ni merece construirse | Se cierra |

Antes de que existieran los tres botones se midió una cosa: de los hallazgos de tipo "No tiene dónde guardarse", **27 de 36 pedían un campo que ya existía**. Por eso el primero es el que más se usa y va arriba y en color.

## Si dices que ya se puede documentar, tienes que decir dónde

Se abre **Dónde se documenta?** con los sitios reales: el botón de Caída, Alerta Piel / UPP, Vitales, el motivo al omitir un medicamento en el eMAR, el motivo del rechazo en el registro nutricional, el traslado a emergencias y las áreas de "Algo cambió en el residente".

Y abajo hay un cuadro para escribirlo: **o escríbelo tú, si no está en la lista**. Esa salida existe a propósito. Una lista cerrada hace que se escoja el sitio menos equivocado, y entonces el aviso miente.

**Lo dices tú porque tú sabes dónde va.** Es lo que va a leer el lunes quien escribió la nota, al lado de su propia frase.

![El panel "Dónde se documenta?" con los sitios reales de Zendity y, abajo del todo, el cuadro para escribirlo si no está en la lista.](/academy/capturas/hallazgos-donde-se-documenta.jpg)

## Confirmar una alerta que nadie escaló sí abre trabajo

Si el hallazgo es de los de **Debió avisar y no avisó** y tiene residente, además te pide **en qué área cae**. Con eso se abre un aviso en Cambios del piso para ese residente.

Y una cosa que importa: ese aviso **queda a nombre de quien escribió la nota, con la fecha de la nota**, no a nombre de quien lo confirma. El piso sí lo reportó, lo escribió con sus palabras; lo que falló fue que nadie lo escalara.

La segunda pestaña, **Confirmados — falta construirlos**, es la lista de lo que dirección tiene pendiente. Se quita con **Ya está construido — quitarlo de la lista**. Sin ese segundo paso la lista solo crece, y una lista que solo crece enseña a no mirarla.

## El límite, en una frase

**Zendi propone. La persona decide.** Es lo mismo en las cuatro superficies: la estrella te propone y tú eliges, el prólogo te cuenta y tú compruebas, el reporte de cierre lo firmas tú, y el hallazgo es una pregunta hasta que alguien contesta.

Zendi escribe bonito. Un texto que suena profesional puede estar mal por dentro, y quien responde de lo que dice el expediente eres tú.

PREGUNTAS:
P: Un hallazgo pide un campo que en Zendity ya existe. Qué botón se pulsa?
*a) Ya se puede documentar
b) Sí, para evaluar
c) No hace falta
d) Ninguno: se deja pendiente
EXPLICACION: Es el caso más frecuente: de 36 hallazgos de ese tipo, 27 pedían algo que ya existía. Ese botón avisa a quien escribió la nota de dónde va.

P: Pulsas "Ya se puede documentar". Qué te pide la pantalla antes de guardar?
a) Una explicación de por qué lo descartas
b) El nombre de quien escribió la nota
*c) En qué sitio de Zendity se documenta
d) La firma de la enfermera que está de turno
EXPLICACION: Sin el destino no hay nada que decirle a quien escribió. El aviso quedaría en "esto tiene un sitio" sin decir cuál.

P: El sitio donde va esa información no aparece en la lista de destinos. Qué haces?
a) Escoges de la lista el que más se le parezca
b) Lo cierras con "No hace falta" y sigues
*c) Lo escribes en el cuadro de abajo
d) Se lo consultas a dirección por correo
EXPLICACION: El cuadro dice "o escríbelo tú, si no está en la lista". Una lista cerrada hace que se escoja el menos equivocado, y el aviso acaba diciendo algo falso.

P: Confirmas un hallazgo de "Debió avisar y no avisó" y se abre un aviso en Cambios del piso. A nombre de quién queda?
a) De Zendi, que fue quien lo encontró
b) De quien lo está confirmando ahora
c) Del supervisor del turno de esa noche
*d) De quien escribió la nota, con su fecha
EXPLICACION: El piso sí lo reportó, con sus palabras. Lo que falló fue que nadie lo escalara, y poner a quien confirma borraría eso.

P: Aceptaste una versión que propuso Zendi en una nota clínica. Si después resulta que dice algo que no es, quién responde?
a) Zendi, que fue quien redactó ese texto
*b) Tú, que la aceptaste y la firmaste
c) El supervisor que firmó el relevo del turno
d) Nadie: la nota queda marcada como texto de IA
EXPLICACION: La propia pantalla lo avisa al proponer: lo que se guarde va firmado con tu nombre. Aceptar una propuesta es hacerla tuya.
`
}
,

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 7: PROTOCOLO DE RESPUESTA A CAIDAS
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'CAIDAS_101',
    title: 'Protocolo de Respuesta a Caidas',
    description: 'Aprende el protocolo paso a paso para responder a una caida: evaluacion, documentacion, escalado y prevencion.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '⚠️',
    category: 'Protocolos Clinicos',
    order: 11,
    content: `---META---
TITULO: Protocolo de Respuesta a Caidas
PROMPT_ZENDI: Evalua si la persona sabe que hacer en los primeros segundos junto a un residente caido, donde esta el boton Alerta Caida, que deciden las tres respuestas del Protocolo de Caida, y que sigue siendo llamada de una persona porque el sistema no la hace.
TERMINOS_CLAVE: Alerta Caída, Protocolo de Caída, consciente, sangrado avistable, nivel de dolor, No la presencié, cuándo fue, Evaluar Riesgo y Enviar Alerta Roja, Grave, Leve, Sin daño, riesgo de caída, índice de Downton, Centro de Triage, avisar a la familia, no mover
PREGUNTA_REFLEXION: Piensa en la última caída de la que te enteraste sin haberla visto. ¿Con qué hora quedó registrada, y quién llamó a la familia?

---SECCION_1---
LECTURA:
# Lo primero no es la tableta

La caída es el evento que peor termina cuando se maneja mal. Y lo primero no se hace en Zendity: se hace en el piso, con la persona.

**No la muevas.** Es la regla y no tiene matices. Una fractura de cadera o una lesión de cuello no se ven desde arriba, y levantarla puede convertir una caída en una operación. Solo se mueve si el sitio mismo es peligroso: fuego, agua con cables, algo que se le va a venir encima.

Mientras tanto:

- Quédate con ella. No la dejes sola para ir a buscar a nadie.
- Háblale con calma y por su nombre.
- Mira sin tocar: cómo quedó, si hay sangre, qué hay alrededor.
- Si no responde pero respira, no la muevas ni le hagas maniobras. Pide ayuda sin moverte de su lado.

## Quién viene

Aquí hay que decir algo que el curso viejo decía al revés. **No hay una enfermera de turno esperando en el piso.** La enfermería del hogar la hace Celia Sierra, que es directora con enfermería de segundo rol, y cubre las dos sedes. Si esperas a que llegue alguien antes de hacer nada, el residente se queda en el piso.

Tú eres quien está. Y las tres preguntas que contestas en la tableta —si reacciona, si sangra, cuánto le duele— **son la evaluación clínica que queda en el expediente.** No son un formulario previo a la de verdad.

| Lo que SÍ hace Zendity | Lo que NO hace |
|---|---|
| Avisa por dentro a supervisión, enfermería y dirección | Llamar al 911 |
| Guarda lo que contestaste, con tu nombre y la hora | Avisar a la familia |
| Abre un ticket en el Centro de Triage | Mandar a alguien al piso |

**El 911 lo marca una persona.** Si hay sospecha de fractura, golpe en la cabeza o no responde, se llama antes de moverla, y eso lo hace quien está ahí. Ningún botón de Zendity levanta ese teléfono.

## Dónde está el botón

En la tarjeta del residente, abajo del todo y separado por una línea, hay un rótulo que dice **ALGO PASÓ**. Ahí viven los tres botones que no se deshacen, y el primero es **Alerta Caída**.

![La tarjeta de Rosa Medina. Abajo, bajo el rótulo ALGO PASÓ y separado por una línea, el botón Alerta Caída junto a Trasladar ER.](/academy/capturas/care-turno-tarjeta.jpg)

Está separado a propósito: lo de arriba se toca cien veces al día, lo de abajo casi nunca y deja huella.

PREGUNTAS:
P: Encuentras a Rosa Medina en el piso de su habitación, consciente. ¿Qué haces primero?
a) La sientas en la silla para que no coja frío
*b) No la mueves y te quedas con ella
c) Corres a la tableta a registrar la caída
d) Llamas a la familia antes que a nadie
EXPLICACION: Una fractura de cadera o una lesión de cuello no se ven desde arriba, y moverla puede empeorarlas. El registro se hace después.

P: En este hogar, ¿quién contesta las tres preguntas del protocolo de caída?
a) La enfermera de turno, cuando llegue
b) La supervisora, desde su propia pantalla
c) El médico del hogar, por teléfono
*d) Tú, la que está ahí con ella en ese momento
EXPLICACION: No hay enfermera de turno esperando en el piso: enfermería la hace una sola persona para las dos sedes. Lo que tú contestas es la evaluación clínica del expediente.

P: ¿Quién llama al 911 cuando hace falta?
*a) Una persona del hogar, marcando el teléfono
b) El sistema, en cuanto la caída sale Grave
c) La familia, cuando le llega el aviso
d) Nadie: el ticket de triage ya lo cubre
EXPLICACION: Zendity avisa por dentro a supervisión, enfermería y dirección. Ninguna llamada al 911 sale del sistema.

P: ¿Cuándo se puede mover a un residente caído antes de evaluarlo?
a) Cuando el residente insiste en que lo levanten del piso
b) Cuando ya pasaron más de diez minutos
*c) Si el sitio es peligroso: fuego o cables
d) Cuando la supervisora lo autoriza por teléfono
EXPLICACION: Solo se mueve si quedarse donde está es más peligroso que moverlo. El dolor o la prisa no son excepciones.

P: En la tarjeta del residente, ¿dónde está el botón de la caída?
a) Arriba del todo, junto a Medicamentos
b) Dentro de Bitácora, en el bloque de piel
c) En el menú de la izquierda, en Caídas
*d) Abajo, bajo el rótulo ALGO PASÓ
EXPLICACION: Los tres botones de ALGO PASÓ van separados por una línea porque no se deshacen. La pantalla Caídas del menú no la ven las cuidadoras.

---SECCION_2---
LECTURA:
# Alerta Caída: tres respuestas y un botón rojo

El botón abre un modal titulado **Protocolo de Caída**, con el nombre del residente arriba. Hay un segundo camino que lleva al mismo sitio: en el hub de reportes, la tarjeta **Alerta Crítica: Caída**.

Si presenciaste la caída, contestas tres cosas y nada más:

1. **¿El residente reacciona y está consciente?** Casilla. Viene marcada que sí.
2. **¿Hay sangrado avistable?** Casilla. Viene sin marcar.
3. **Nivel de Dolor Vocalizado.** Un deslizador de 0 a 10. **Viene puesto en 5.**

![El modal Protocolo de Caída de Rosa Medina: las tres respuestas y, abajo, el botón rojo Evaluar Riesgo y Enviar Alerta Roja.](/academy/capturas/caidas-protocolo-tableta.jpg)

Se cierra con el botón rojo: **Evaluar Riesgo y Enviar Alerta Roja**.

## El deslizador de dolor es la gravedad

Esto es lo más importante del curso y no se ve en la pantalla. **El número que dejes en el dolor es la gravedad que queda en el expediente.** No hay selector de gravedad, nadie la asigna después y enfermería no la corrige.

| Dolor que pongas | Cómo sale en la pantalla de Caídas |
|---|---|
| 0 a 3 | Sin daño |
| 4 a 6 | Leve |
| 7 a 10 | Grave |

Viene en 5. Si no lo tocas, la caída sale **Leve**, hayas visto lo que hayas visto. Pon lo que el residente dice o demuestra: si no se queja, bájalo; si no deja que le toquen la pierna, súbelo.

Las otras dos respuestas no mueven la gravedad. El sangrado hace otra cosa: pone en **Alto** el riesgo de la evaluación que el sistema guarda después.

## Lo que este modal no tiene

No hay dónde escribir. Desde la tableta no se registra el sitio, ni qué estaba haciendo, ni cómo estaba el piso, ni el calzado: esos campos no existen. Lo que se guarda es consciente, sangrado y dolor.

Si hay algo que contar —se levantó sola otra vez, el bastón estaba lejos— eso va por **Preventiva**, que entra derecho a enfermería.

Y que quede claro, porque suena razonable y no existe: **nadie completa la ficha después.** No hay pantalla para abrir una caída ya registrada y añadirle el sitio o una nota. Lo que contestaste es lo que queda. El botón **Registrar** de la pantalla de Caídas no edita nada: crea una caída nueva. Usarlo para "arreglar" una de hace un rato deja dos caídas del mismo suceso, cada una con su ticket.

## Justo después de pulsar

Sale una pregunta: si quieres imprimir el **Reporte de Incidente** ahora. Es un PDF con el residente, la hora, la gravedad y lo que contestaste. Si dices que no, la caída queda registrada igual.

Y si la pantalla se ve lenta y la envías dos veces, **no se duplica**. El sistema mira los cinco minutos anteriores del mismo residente y responde: "Esta caída ya estaba registrada hace un momento. No se duplicó." Eso es un éxito, no un regaño.

PREGUNTAS:
P: ¿Qué dato decide la gravedad que queda en el expediente?
*a) El número del deslizador de dolor
b) Si el residente está consciente o no
c) Si hay sangrado avistable
d) La hora a la que ocurrió la caída
EXPLICACION: Por debajo de 4 sale Sin daño, de 4 a 6 Leve, de 7 en adelante Grave. Ni el sangrado ni la consciencia mueven ese chip.

P: Luis Ortega se cayó y dice que no le duele nada. Dejas el dolor en 2. ¿Cómo sale en la pantalla de Caídas?
a) Grave
b) Leve
*c) Sin daño
d) Sin evaluar
EXPLICACION: De 0 a 3 el expediente dice Sin daño. Sin evaluar no es una gravedad: es el contador de los residentes a los que nadie les ha hecho la hoja de riesgo.

P: Abres el Protocolo de Caída y no tocas el deslizador. ¿Con qué dolor se envía?
a) Con 0, hasta que alguien lo mueva
*b) Con 5, que es donde viene puesto
c) Con 10, para que salte la alarma
d) No se envía: el botón queda gris
EXPLICACION: El 5 cae dentro de Leve. Por eso hay que moverlo siempre, aunque sea para bajarlo.

P: ¿Cómo se cierra el modal de caída?
a) Con Guardar y Firmar
b) Con Confirmar Incidente
c) Con Enviar a Triage
*d) Con Evaluar Riesgo y Enviar Alerta Roja
EXPLICACION: Ese es el nombre literal del botón rojo, y al pulsarlo ya salió el aviso: no hay un segundo paso de confirmación.

P: Pulsas Alerta Caída, la pantalla se ve lenta y la envías otra vez. ¿Qué pasa?
*a) Te dice que ya estaba registrada, sin duplicarla
b) Se crean dos caídas y hay que borrar una
c) Sale un error rojo y se pierde la primera
d) Se duplica el ticket en el Centro de Triage
EXPLICACION: El servidor compara los cinco minutos anteriores del mismo residente. Contesta como éxito a propósito, porque un error rojo hace que la persona lo intente otra vez.

---SECCION_3---
LECTURA:
# La caída que no viste

Muchas caídas no las ve nadie. Te las cuentan: la de noche te dice por la mañana que Luis se cayó de madrugada, o el propio residente te lo dice cuando entras.

Para eso está, arriba del todo del modal, la casilla **No la presencié — me la reportaron**.

Al marcarla pasan dos cosas:

- Aparecen dos campos que solo tú puedes llenar: **¿Quién te la reportó?** y **¿Cuándo fue?**
- **Desaparecen las tres preguntas clínicas.** No te piden consciente, ni sangrado, ni dolor.

![El mismo modal con No la presencié marcado: aparecen quién te la reportó y cuándo fue, y las tres preguntas clínicas ya no están.](/academy/capturas/caidas-no-presenciada.jpg)

Desaparecen a propósito. No viste al residente en el piso, así que no hay número honesto que poner. El expediente guarda "No especificado", que es verdad, en lugar de un dolor que nadie midió.

## Lo que cuesta esa honestidad

Sin dolor que medir, el sistema pone **Leve** por defecto. Es lo único que puede hacer con lo que tiene. Pero conviene saberlo: una caída no presenciada que sale Leve **no está diciendo que fuera leve**, está diciendo que no había nada que medir.

Si te contaron que se quejaba mucho o que quedó con un golpe, eso se cuenta aparte por **Preventiva**. Ahí sí hay dónde escribirlo.

## La fecha

Debajo de "¿Cuándo fue?" la pantalla lo dice con estas palabras: la caída del turno de noche que te cuentan por la mañana no pasó por la mañana.

Si lo dejas en blanco, queda con la hora de ahora. Y entonces el residente que se cae siempre de madrugada aparece cayéndose a las siete, que es cuando alguien tuvo tiempo de teclearlo. El chip de "2 caídas en 90 días" sigue contando bien, pero la hora y el turno dejan de servir para nada.

## Si ya pasaron más de 24 horas

La caída se guarda igual, con su fecha real. Lo que cambia es el ruido: entra al Centro de Triage con **prioridad baja** en vez de crítica, y el aviso dice el día en que ocurrió.

Una caída de hace tres semanas no es una emergencia de ahora. Y una alarma que suena por algo viejo enseña a la gente a ignorar las alarmas.

La pantalla **Caídas** tiene su propio botón **Registrar** para escribir las viejas, con la pregunta **¿Cuándo ocurrió?** y un aviso ámbar cuando la fecha es de hace más de un día. Esa pantalla la ven enfermería, supervisión y dirección. Si tú eres cuidadora, tu camino es la casilla de la tableta.

PREGUNTAS:
P: Llegas por la mañana y te cuentan que Luis Ortega se cayó de madrugada. ¿Qué haces en la tableta?
a) La escribes en la bitácora y sigues
b) Esperas a que la registre la de noche
*c) Marcas No la presencié y pones cuándo fue
d) La registras con la hora de ahora mismo
EXPLICACION: Esa casilla existe justo para esto, y lo que pide es lo único que tú sabes: quién te la contó y cuándo pasó.

P: Al marcar No la presencié, ¿qué te pide la pantalla?
*a) Quién te la reportó y cuándo fue
b) El nombre del médico que la evaluó
c) Una foto del sitio donde la encontraron
d) La firma de la cuidadora del turno anterior
EXPLICACION: Son los dos datos que no puede saber nadie más que tú, y sin ellos la caída queda huérfana de hora y de origen.

P: Marcaste No la presencié. ¿Por qué desaparecen consciente, sangrado y dolor?
a) Porque las contesta enfermería más tarde
b) Porque una caída vieja ya no importa
c) Porque el sistema las saca del historial
*d) Porque no viste nada y no se inventa
EXPLICACION: El expediente guarda "No especificado", que es verdad, en vez de un número que nadie midió.

P: Una caída no presenciada sale sin nivel de dolor. ¿Con qué gravedad queda?
a) Grave, por precaución
*b) Leve, que es lo que pone por defecto
c) Sin daño, porque nadie vio nada
d) Sin gravedad, hasta que enfermería la revise
EXPLICACION: Leve ahí no significa que fuera leve, significa que no hubo dolor que medir. Si te contaron que se quejaba, dilo por Preventiva.

P: Registras una caída que ocurrió hace tres semanas. ¿Qué cambia?
a) Se rechaza: solo se aceptan las caídas de hoy
b) Se guarda con la fecha de hoy igual
*c) Entra con prioridad baja, no como emergencia
d) Se avisa igual a los tres roles como crítica
EXPLICACION: Pasadas 24 horas el aviso dice el día en que ocurrió y el ticket baja de prioridad. La caída se guarda igual, con su fecha real.

---SECCION_4---
LECTURA:
# A quién le llega, y a quién no

Pulsaste el botón rojo. Esto es lo que pasa, en orden:

1. Se guarda la caída en el expediente del residente, con tu nombre.
2. Se crea un ticket en el **Centro de Triage** con prioridad crítica.
3. Sale un aviso a tres roles: **supervisión, enfermería y dirección**.

El texto del ticket lo escribe el sistema, ya lleno, con lo que contestaste: "Caída de Rosa Medina (SEVERE): Consciente: Sí · Sangrado: No · Dolor: 8/10". **Tú no completas ningún ticket** y no vuelves a abrirlo.

![La bandeja de la supervisora en un momento cualquiera: piquiña, una rotación vencida y un almuerzo sin comer. Ninguna de las tres es una caída; es la compañía entre la que va a aterrizar tu aviso. Cada línea trae su urgencia arriba y sus salidas abajo —Despachar, Referir a Enfermería, Cerrar—, que cambian según el tipo: la de Rotación vencida ofrece La hice yo en vez de Referir. Dos dicen quién lo reportó; la de rotación no.](/academy/capturas/supervisor-inbox-operativo.jpg)

En esa bandeja, la línea de una caída **no dice quién la reportó**: ese dato no viaja hasta ahí. Tu nombre sí queda en el expediente del residente. Si alguien quiere preguntarte qué viste, tiene que ir a buscarlo ahí.

## La familia no se entera

Dicho claro, porque el curso viejo enseñaba lo contrario y es el error que más caro sale: **el flujo de caída no manda nada a la familia. En ningún nivel. Nunca.** No hay aviso automático al portal, ni correo, ni mensaje.

El runbook del hogar pide avisar al familiar primario dentro de las dos horas siguientes, y esa llamada la hace una persona. Si nadie la hace, no se hizo.

## La gravedad cambia el orden, no la lista de avisados

| Lo que mucha gente cree | Lo que hace el sistema |
|---|---|
| Una caída Grave avisa a más gente | Grave y Sin daño avisan a los mismos tres |
| Una caída leve espera al supervisor | Toda caída de hoy entra a triage como crítica |
| El sistema activa un protocolo de emergencia | El sistema abre un ticket y nada más |

Ahora bien, algo sí cambia, y conviene saberlo: **dentro de la bandeja de la supervisora la gravedad decide el sitio en la lista.**

| Gravedad | Cómo entra en la bandeja |
|---|---|
| Grave | INMINENTE: arriba del todo, borde rojo |
| Leve | ATENCION: en medio, ámbar |
| Sin daño | RUTINA: gris, al fondo |

Una Grave además invierte los botones: le pone **Referir a Enfermería** primero y Despachar de segundo. Son las mismas dos salidas, en otro orden.

Pero eso es orden de lectura, no aviso distinto. El ticket del Centro de Triage entra crítico en los tres casos y los tres roles reciben lo mismo. Lo único que baja el trato de verdad es el registro retroactivo, y eso ya lo viste en la sección anterior.

## Qué hacen con el aviso

En la bandeja de la supervisora el ticket sale con dos salidas y una puerta de atrás: **Despachar**, que manda a alguien a atenderlo, **Referir a Enfermería**, y **Cerrar**, que lo quita de la lista con un motivo. En el Centro de Triage se cierra con **Resolver Ticket** y una nota de resolución. Nada de eso lo haces tú.

## El relevo ya la trae

No tienes que acordarte de escribirla en el cierre de turno. El relevo recoge las caídas **por residente, no por autor**: si la reportó tu compañera y el residente es de tu grupo, sale igual, con el nombre y la gravedad.

Se hizo así porque 39 relevos de 858 decían "sin novedades" habiendo caída o alerta en el turno. Lo que el relevo no trae es un plan de seguimiento ni observaciones pendientes, porque eso no existe.

Tampoco trae el sitio, aunque lo parezca. Donde el relevo escribe la ubicación no vas a leer "baño" ni "pasillo": vas a leer **Reportada vía tablet**, o **No presenciada — reportada por terceros** si se marcó la casilla. Es lo mismo de la sección 2 —desde la tableta el sitio no se manda— y el relevo imprime ese campo tal cual. Si el sitio importa para el turno que entra, díselo en voz alta al entregar.

PREGUNTAS:
P: Envías la Alerta Roja. ¿A quién le llega?
a) A la familia, por su portal
*b) A supervisión, enfermería y dirección
c) Al médico de cabecera del residente
d) A todo el personal de las dos sedes
EXPLICACION: Son esos tres roles, con un enlace al Centro de Triage. Nadie más recibe nada.

P: Carmen Delgado se cayó y su hija no lo sabe. ¿Quién la avisa?
a) Zendity, en cuanto se cierra el ticket
b) El portal familiar, esa misma noche
c) Nadie: no hace falta avisar a la familia
*d) Una persona del hogar, por teléfono
EXPLICACION: El flujo de caída no toca a la familia en ningún nivel. El runbook pide esa llamada dentro de las dos horas.

P: Una caída sale Sin daño y otra sale Grave. ¿Qué cambia entre las dos?
*a) Dónde caen en la bandeja, no quién se entera
b) Que la Grave le manda un aviso al portal de la familia
c) Que la Sin daño se queda guardada sin avisar a nadie
d) Que la Grave le abre al residente un plan de seguimiento
EXPLICACION: La Grave entra INMINENTE y sube arriba en rojo; la Sin daño entra RUTINA y cae al fondo en gris. Pero el ticket de triage es crítico en las dos y los avisados son los mismos tres roles.

P: ¿Quién completa el ticket que crea la caída?
a) La cuidadora, al terminar el turno
b) Enfermería, con la hoja de Downton
*c) Nadie: lo escribe el servidor ya lleno
d) La supervisora, al firmar el relevo
EXPLICACION: El texto se compone solo con lo que contestaste y aterriza en el Centro de Triage. Quien reporta no lo abre nunca.

P: Tu compañera reportó una caída de un residente tuyo. ¿Sale en tu relevo de cierre?
a) No: el relevo solo trae lo que hiciste tú
*b) Sí: el relevo va por residente, no por autor
c) Solo si la caída salió Grave
d) Solo si la añades a mano al texto
EXPLICACION: Se cambió a por residente porque 39 relevos de 858 decían "sin novedades" habiendo caída o alerta en el turno.

---SECCION_5---
LECTURA:
# Gravedad no es riesgo

En la pantalla **Caídas** hay dos cosas que se parecen y no tienen nada que ver. Conviene separarlas de una vez.

![La pantalla Caídas. Arriba, los contadores de riesgo del residente: Sin evaluar, Alto, Moderado, Bajo. Abajo, cada caída con su chip de gravedad: Leve, Sin daño, Grave.](/academy/capturas/caidas-panel.jpg)

- **Grave / Leve / Sin daño** es el chip de cada caída. Habla del suceso, y sale del dolor que pusiste.
- **Sin evaluar / Alto / Moderado / Bajo** son los contadores de arriba. Hablan del residente: lo que le puede pasar, no lo que le pasó.

Un residente de riesgo **Alto** puede no haberse caído nunca. Y una caída **Sin daño** puede dejarlo en Alto igual.

## De dónde sale ese nivel (no siempre de Downton)

El contador no busca la hoja de Downton: enseña la **última evaluación** que tenga el residente, venga de donde venga. Y aquí está lo que casi nadie sabe:

**Cada caída que registras crea una evaluación automática**, y el nivel se lo pone el sistema con dos de tus tres respuestas.

| Lo que contestaste | Riesgo que le queda al residente |
|---|---|
| Sangrado marcado, o dolor de 7 en adelante | Alto |
| Dolor de 4 a 6 | Moderado |
| Dolor de 0 a 3, sin sangrado | Bajo |

O sea: el mismo deslizador que fija la gravedad de la caída **mueve también el contador de riesgo del residente**. Dolor 8 deja la caída en Grave y al residente en Alto sin que nadie haya llenado ninguna hoja. Y el sangrado marcado lo deja en Alto aunque la caída salga Sin daño.

Siguen siendo dos cosas distintas —una del suceso, otra del residente—, pero esto explica por qué el contador se mueve solo. Y se nota a simple vista: las automáticas no llevan puntaje. Un residente con nivel pero sin chip de puntos es uno cuya última evaluación fue una caída. Cuando ves el puntaje —"7 pts"— es que alguien llenó Downton de verdad.

## Lo que el sistema hace solo tras cada caída

Después de **todas** las caídas, no a partir de un nivel:

- Guarda esa evaluación post-caída —la del nivel automático que acabas de ver— para revisar **en 24 horas**.
- Marca al residente como riesgo de caída.

Y ya está. Conviene decir lo que **no** hace, porque el curso viejo lo prometía: no programa observaciones cada dos horas, no revisa los medicamentos, no abre una tarea para arreglar el área y no cruza las caídas por horario ni por pasillo. Ese informe de patrones no existe. Lo único que se cuenta por residente es el chip de **caídas en 90 días**.

Si tú ves el patrón —siempre de madrugada, siempre saliendo del baño— dilo tú. El sistema no lo va a encontrar por ti.

## El índice de Downton

Es la hoja del **riesgo**, y es otro acto distinto. Se abre desde la pantalla de Caídas tocando el nombre del residente.

![La hoja de Downton de Carmen Delgado: once preguntas de sí o no por grupos y, abajo, el puntaje en vivo con Desde 3 es riesgo alto y Se repite en 6 meses.](/academy/capturas/caidas-downton-hoja.jpg)

- Once preguntas de sí o no, en cinco grupos: caídas previas, medicamentos, déficits sensoriales, estado mental y deambulación.
- El puntaje se ve mientras contestas. **Desde 3 es riesgo alto.**
- Tres niveles: bajo, moderado y alto. No cuatro.
- Se repite a los seis meses, y al guardar se puede **Imprimir la hoja**.

La llenan enfermería, supervisión o dirección. Una cuidadora no ve esa pantalla, y lo que ella aporta a esa hoja es haber registrado bien las caídas.

## Cuidado con el encamado

A un residente encamado la escala le miente. Nunca va a marcar "camina inseguro", así que puntúa un punto más bajo sin estar mejor. La propia pantalla lo avisa, y la ficha lo marca con la palabra encamado.

Su riesgo no desapareció: se mudó. Un encamado no se cae caminando; se cae en el traslado, al sacarlo de la cama, al sentarlo o al salir de la ducha. Por eso lo suyo es la técnica de traslado, la baranda y la altura de la cama. Y su riesgo mayor ya no es la caída, es la piel: en Cupey, cuatro de los ocho encamados tienen úlcera.

PREGUNTAS:
P: En la pantalla de Caídas, el chip GRAVE y el contador ALTO, ¿son lo mismo?
a) Sí: los dos miden la caída
b) Sí: los dos miden al residente
c) No: GRAVE mide al residente
*d) No: GRAVE es el suceso, ALTO el residente
EXPLICACION: La gravedad sale del dolor de esa caída y habla del suceso. El nivel habla del residente y enseña su última evaluación, que tanto puede ser la hoja de Downton como la automática que deja la propia caída.

P: ¿Qué hace el sistema solo, después de cada caída?
a) Programa observaciones cada dos horas
*b) Deja una evaluación para revisar en 24 horas
c) Avisa a la farmacia de los sedantes
d) Abre una tarea a mantenimiento del área
EXPLICACION: Esa evaluación post-caída no lleva puntaje de Downton, pero sí lleva nivel: sale del sangrado y del dolor que contestaste, y pasa a ser el que enseña el contador. Ocurre en todas las caídas, no a partir de un nivel.

P: El índice de Downton, ¿qué mide?
a) La gravedad de la caída que acaba de pasar
b) El daño que quedó después del golpe
*c) El riesgo de que se caiga
d) La rapidez con que se atendió el aviso
EXPLICACION: Mira caídas previas, medicamentos, sentidos, estado mental y deambulación. Es sobre el residente, no sobre un suceso.

P: ¿Desde qué puntaje de Downton se considera riesgo alto?
*a) Desde 3
b) Desde 6
c) Desde 8
d) Desde 11
EXPLICACION: Son once preguntas de sí o no y el corte está en 3. La hoja se repite a los seis meses.

P: A un residente encamado le llenan la hoja de Downton y sale bajo. ¿Qué quiere decir?
a) Que ya no hace falta evaluarlo
b) Que está mejor que el que camina solo
c) Que la hoja se llenó mal
*d) Que la escala no le mide su riesgo
EXPLICACION: Pierde de oficio el punto de deambulación. Su riesgo está en los traslados, la baranda y la altura de la cama, y sobre todo en la piel.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 8: EL CUIDADOR EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'CUIDADOR_101',
    title: 'El Cuidador en Zendity',
    description: 'Guia completa del rol del cuidador en Zendity: tu workspace, Prologo del Turno, eMAR basico y cierre de turno.',
    durationMins: 30,
    bonusCompliance: 10,
    emoji: '💚',
    category: 'Operaciones de Piso',
    order: 4,
    content: `---META---
TITULO: El Cuidador en Zendity
PROMPT_ZENDI: Evalua si la cuidadora sabe abrir el turno en el orden real (color, censo, ficha, prologo), firmar un pack de medicamentos, elegir donde reportar cada cosa sabiendo quien la lee, y cerrar el turno firmando el relevo.
TERMINOS_CLAVE: care, grupo de color, censo de entrada, ventana de vitales, prologo, pack de medicamentos, firma con el dedo, omitir, PRN, bitacora general, preventiva, algo cambio, Acciones, hora del registro, entregar turno, relevo
PREGUNTA_REFLEXION: Piensa en tu ultimo turno. Hubo algo que notaste de un residente y que al final no escribiste en ningun sitio. Que era, y por que boton de tu tableta deberia haber entrado?

---SECCION_1---
LECTURA:
# Tu tableta: del inicio a la tarjeta del residente

Cuando entras a Zendity no caes en el piso directo. Caes en una pantalla oscura que te saluda por tu nombre y te ofrece **tres puertas**:

| Puerta | Para que |
|---|---|
| **Iniciar Turno** | El piso: residentes, medicamentos, cierre |
| **Academy** | Cursos y certificaciones, como este |
| **Mis Observaciones** | Lo que el supervisor te señalo y espera tu explicacion |

**Mis Observaciones no es decorado.** Si trae un numero en ambar, hay algo escrito sobre tu trabajo esperando que contestes. Mientras no contestes se queda en "Esperando tu explicacion". Cuando contestas pasa a "Respuesta enviada" y el supervisor decide: la aplica o la desestima. Callarse no la borra.

## El piso

Al entrar a Iniciar Turno ves la lista de tus residentes en tarjetas. Arriba del todo, una barra oscura con: el turno (Mañana, Tarde, Noche), tu color de grupo, un chip rojo **N SLA** si el supervisor te despacho tareas con reloj, el chat del piso, la campana y el boton **Entregar Turno**.

## La tarjeta: donde se lee lo que falta

Esto es lo que mas se malentiende, asi que va directo:

| Lo que SI significa | Lo que NO significa |
|---|---|
| La franja de color de arriba es **el color de tu grupo**. Azul arriba = Grupo Azul | No es una alerta. No cambia si hay algo urgente |
| El borde de la tarjeta es **gris siempre**, para todos | No existe el "borde rojo = urgente" |
| Lo pendiente se lee en la **franja de cuatro columnas**: Baño, Comidas, Rotacion, Meds PM | No se lee en el color del marco ni en la foto |

Ademas de esa franja, la tarjeta te avisa con cosas concretas:

- **Vitales de entrada · Vence en 48m** — la cuenta regresiva de la ventana de vitales. Si vence, el aviso se pone rojo.
- El **numero rojo** dentro del boton Medicamentos: cuantos tiene ese residente en este turno. Ojo, no baja segun los vas dando — es el total del turno, no lo que falta.
- **UPP · cambie aposito** en rojo: es un boton. Se toca para registrar que cambiaste el aposito.
- **COBERTURA VERDE** en ambar: ese residente no es de tu grupo, te llego por cobertura.

![La tarjeta de Rosa Medina: la franja azul de arriba es su grupo, no una alerta. Lo que falta se lee en la fila de Baño, Comidas, Rotacion y Meds PM.](/academy/capturas/care-turno-tarjeta.jpg)

## La tarjeta no se abre

No hay perfil ni pestañas. Cada boton hace una cosa y te la abre directo, agrupados por como es tu dia:

| Grupo | Botones |
|---|---|
| **Lo de siempre** | Medicamentos (y Salida a Dialisis, si le toca) |
| **Algo cambio** | Vitales, Bitacora, Preventiva, Algo cambio en el residente |
| **Algo paso** | Alerta Caida, Trasladar ER, Reportar fallecimiento |

Ese orden es a proposito: arriba lo que tocas cien veces al dia, abajo y separado por una linea lo que casi no se toca y no se puede deshacer.

## Zendi, en su sitio

Zendi no te va guiando por voz mientras trabajas. Lo que hay es **Escritura Inteligente**, un boton dentro de los cuadros de nota: escribes con tus palabras, Zendi te propone otra version y **tu decides** si la usas. Lo tuyo no se pierde y hay "volver a lo mio". La unica voz de Zendi es la del prologo, al abrir el turno.

PREGUNTAS:
P: La tarjeta de Pedro Santana 103 tiene una franja azul arriba. Que te dice esa franja?
a) Que ese residente tiene una alerta sin atender
*b) El color del grupo de turno que te toco
c) Que le quedan medicamentos por dar
d) Que enfermeria lo quiere ver hoy
EXPLICACION: Es el color de tu grupo: se pinta igual en todas tus tarjetas, tengan o no algo pendiente, y no cambia en todo el turno.

P: Donde lees lo que te falta por hacer con Rosa Medina 204?
a) En el borde exterior, que se pinta de rojo cuando urge
b) En la foto, que se le pone un marco ambar
c) En el nombre, que se subraya si hay pendientes
*d) En la franja de cuatro columnas de la tarjeta
EXPLICACION: Baño Listo o Pendiente, N de 3 comidas, Rotacion Al dia, Proxima o Atrasado, y Meds PM Listo o Pendiente: esa fila es el resumen de tu trabajo con ese residente.

P: La tarjeta de Luis Ortega 112 dice "Vitales de entrada · Vence en 48m". Que significa?
*a) Que te quedan 48 minutos para tomarle los vitales
b) Que hay que repetirle los vitales cada 48 minutos
c) Que enfermeria le tomo los vitales hace 48 minutos
d) Que sus ultimos vitales salieron altos
EXPLICACION: Es la cuenta regresiva de la ventana de vitales de entrada; cuando llega a cero el aviso se pone rojo y hay que justificar el retraso.

P: Que hace el boton de Escritura Inteligente que ves en los cuadros de nota?
a) Guarda la nota y se la manda a la familia
b) Corrige la nota y la sustituye al instante
*c) Propone otra version y tu decides si la usas
d) Dicta en voz alta los pasos del procedimiento
EXPLICACION: Zendi propone y la persona decide: tu texto se queda hasta que pulses usar esta version, y despues todavia puedes volver a lo tuyo.

P: En la pantalla de inicio, Mis Observaciones te sale con un numero en ambar. Que es?
a) Las notas que escribiste esta semana
*b) Avisos del supervisor que esperan tu respuesta
c) Los residentes que todavia no has visitado hoy
d) Los cursos de Academy que te faltan por terminar
EXPLICACION: Son observaciones o amonestaciones que esperan tu explicacion; mientras no contestes se quedan pendientes y el supervisor no puede cerrarlas.

---SECCION_2---
LECTURA:
# Abrir el turno: cuatro pasos, en este orden

El turno no empieza cuando entras a la aplicacion. Empieza cuando haces estos cuatro pasos, y van en este orden:

**1. Eliges tu color.** La pantalla te pregunta "Cual es tu color de Turno?" con cuatro botones: ROJO, AMARILLO, VERDE, AZUL. Tu color sale del horario que armo el supervisor, pero **la tableta te lo pregunta igual**: hay que pulsarlo.

En esa misma pantalla puede haber:

- La **nota del supervisor** para tu turno, en ambar.
- Un aviso ambar tipo **"1 grupo sin cubrir — toca aqui si eres sustituto o vas a cubrir"**. Si vas a cubrir, se toma ahi mismo. No hay que esperar a que nadie te lo asigne.
- Debajo de cada color, quien lo esta cubriendo hoy.

Si eres la unica en el piso, la tableta te enseña a todos los residentes sin que lo pidas.

**2. Verificas el censo.** Antes de fichar sale la lista de tu grupo, residente por residente, con cuatro marcas: Presente, Hospital, Dialisis (solo a quien le toca) y Familia. Marcas lo que hay **en el piso**, no lo que crees.

Si lo que marcas no cuadra con lo que dice el sistema, la pantalla te lo dice ahi mismo: "El sistema dice que salio por hospital". Se marca lo que ves. Esa discrepancia queda escrita, y es justo lo que sirve para arreglarla.

**3. Fichas.** Al pulsar "Confirmar Censo y Escuchar Zendi" quedas dentro del turno. En ese momento el sistema abre una **ventana de vitales de 4 horas** por cada residente tuyo y te avisa: "Tienes 4 horas para tomar vitales a tus N residentes". En turno de noche no se abren.

Un aviso: esa notificacion enlaza a una pantalla de enfermeria en la que tu no entras. **Los vitales se toman desde el boton Vitales de la tarjeta del residente.**

**4. Escuchas el prologo.** Zendi te narra el arranque del turno.

## Que dice el prologo y que no dice

| Zendi SI te anuncia | Zendi NO te anuncia |
|---|---|
| Temperatura elevada de algun residente | Los medicamentos que faltan por dar |
| Quien comio poco o nada en la ultima comida | Lo que el turno anterior dejo sin dar |
| Las citas medicas del dia | Las rotaciones atrasadas |
| Los eventos de la sede | |

**Lo que falta de medicamentos no sale en el prologo.** Lo ves abriendo Medicamentos en cada tarjeta: el numero rojo del boton dice cuantos tiene ese residente en este turno, y dentro ves cuales estan dados y cuales no.

Si tocas "Omitir Audio (Lectura Rapida)" pasas a la version escrita, con dos bloques distintos:

- **Relevo de tu turno anterior** — el reporte que firmo quien salio, con su nombre y la hora, y un enlace a "Ver reporte completo".
- **Prologo del Dia — Zendi** — el de la sede entera.

Y tres contadores: alertas de vitales, inapetencias y citas de hoy.

Si el prologo no suena o se corta, el relevo escrito sigue estando — pero el enlace a el vive en esa misma pantalla de entrada. Si ya la pasaste, lo encuentras en Reportes de Turno.

![La lista del turno abierto: arriba el chip del color, el chip rojo de tareas SLA y Entregar Turno; abajo Residentes (5) con "4 tuyos · 1 por cobertura".](/academy/capturas/care-turno-lista.jpg)

## Cuando falta alguien

Si un grupo se queda sin cuidadora, sus residentes se reparten: los reparte el sistema solo, o los reparte el supervisor. A ti te llegan a la tarjeta marcados **COBERTURA** con el color de donde vienen. Y el encabezado te lo dice en claro: "4 tuyos · 1 por cobertura".

PREGUNTAS:
P: En que orden se abre el turno?
a) Fichas, eliges color y luego verificas el censo
b) Oyes a Zendi, eliges tu color, fichas y verificas el censo
*c) Eliges color, verificas el censo, fichas y oyes a Zendi
d) Verificas el censo, oyes a Zendi, eliges tu color y fichas
EXPLICACION: El prologo suena de ultimo, despues de fichar; si lo esperas al entrar a la aplicacion no va a llegar nunca.

P: Carmen Delgado 210 salio a dialisis y el sistema la da por presente. Que marcas en el censo?
*a) La marcas en Dialisis, que es lo que hay hoy
b) La dejas en Presente y lo escribes en la bitacora
c) No fichas hasta que el supervisor lo corrija
d) La marcas Presente y avisas al supervisor
EXPLICACION: El censo se llena con lo que hay en el piso; la pantalla te avisa de la diferencia con lo que creia el sistema y esa diferencia es informacion, no un error tuyo.

P: Al fichar se te abre una ventana de vitales. De cuanto es, y para quien?
a) De 2 horas, solo para los residentes de alto riesgo
b) De 8 horas, para todos los residentes de la sede
c) De 12 horas, para los que no tuvieron vitales ayer
*d) De 4 horas, para los residentes que te tocaron hoy
EXPLICACION: Se abre una orden por cada residente asignado al fichar, menos en turno de noche, y la cuenta regresiva la ves en su tarjeta.

P: Que te anuncia Zendi en el prologo del turno?
a) Los medicamentos que no dio el otro turno
*b) Fiebre, quien comio poco y las citas del dia
c) Las ulceras que hay que curar antes del mediodia
d) El horario de la semana que viene y los relevos
EXPLICACION: Tambien te entrega el relevo del turno anterior y los eventos de la sede; de medicamentos no dice nada, eso se ve en el boton de cada tarjeta.

P: Ves el aviso ambar "1 grupo sin cubrir" y vas a cubrirlo. Que haces?
a) Esperas a que el supervisor te lo asigne
b) Pulsas tu color normal y avisas despues
*c) Tocas el aviso y tomas el grupo ahi mismo
d) Fichas dos veces, una por cada grupo que cubras
EXPLICACION: Ese aviso es el camino de la sustituta y de quien cubre: se reclama desde ahi y los residentes te llegan marcados con la etiqueta de cobertura.

---SECCION_3---
LECTURA:
# Medicamentos: se firma el pack, no la pastilla

Abres Medicamentos en la tarjeta y no ves una lista suelta. Ves **packs por hora**: "Pack 8:00 AM", y arriba a la derecha "Pack 1 de 3 · 0/3 completados". Se trabaja un pack a la vez, y cuando queda resuelto entero pasa al siguiente.

Dentro del pack, cada linea te dice **nombre, dosis y via**. La hora es el titulo del pack. No hay foto del medicamento: la comprobacion visual la haces contra el **Cardex**, el boton de arriba del modal.

## La firma

Abajo del pack hay un recuadro para firmar con el dedo y un boton teal: **"Administrar pack · 8:00 AM"**, con el rotulo "Una firma para los 3 meds pendientes".

| Como es hoy | Como NO es |
|---|---|
| Una firma manuscrita para todo el pack | Un PIN por cada medicamento |
| Al firmar certificas que comprobaste las 5 correctas | Un boton de confirmar en cada linea |
| Puedes declarar la hora real arriba, en "Hora del registro" | Una hora automatica que no puedes tocar |

Debajo del boton, la pantalla lo dice con esas palabras: al firmar certificas haber comprobado **las 5 Categorias Clinicas Correctas**. Son las de siempre: residente correcto, medicamento correcto, dosis correcta, via correcta, hora correcta.

Y la **hora real**: si diste el pack a las 8:00 pero lo estas firmando a las 9:20, pon 8:00 en "Hora del registro". Se acepta hasta 12 horas atras y nada en el futuro. El expediente guarda las dos horas, la del cuido y la del tecleo.

## Los estados que ves en tu tableta

| Etiqueta | Que quiere decir |
|---|---|
| **Firmado**, verde | Se administro y esta firmado |
| **Omitido**, rojo | No se dio, con su motivo |
| **Rechazado**, ambar | El residente no quiso |
| **Suspendido**, gris | Lo paro el medico o hay un procedimiento |
| Sin etiqueta, con boton **Omitir** | Todavia no se ha resuelto |

"Suspendido" no es una falta tuya. Y hay un estado, MISSED, que el sistema pone solo dos horas despues de la hora pautada: **existe en el expediente pero en tu tableta no se ve**, asi que no lo busques ahi.

## Cuando no se da

Se toca **Omitir** en esa linea y se abre un panel rojo: "Por que se omite Losartan?". Hay que hacer dos cosas, y hasta que no estan las dos el boton sigue gris:

1. Elegir el motivo de una lista de siete: Residente lo rechazo · Medicamento no disponible · Residente en procedimiento · Indicacion medica · Fuera del hogar · Residente fallecio · Otro.
2. Escribir el detalle, **minimo diez caracteres**.

**El motivo que elijas decide como queda en el expediente.** "Residente lo rechazo" queda como Rechazado. "Indicacion medica" y "en procedimiento" quedan como Suspendido. El resto queda como Omitido. No es lo mismo "no quiso" que "lo paro el medico", asi que elige el verdadero. Enfermeria y supervision se enteran de **toda** omision en el momento.

## PRN, el de razon necesaria

El PRN no va en ningun pack. Se registra desde "+ Registrar dosis PRN (S.O.S.)":

- **Uno solo.** Eliges que medicamento.
- **Para que.** Obligatorio. Ejemplo: agitacion al bañarlo, dolor en la cadera.
- Firma con el dedo.

Y despues Zendity te pregunta **si hizo efecto**, con cuatro respuestas: Resolvio, Mejoro en parte, Sin efecto, No se pudo evaluar. Esa pregunta es la que decide si se repite, se cambia o se llama al medico. "No se pudo evaluar" existe para que nunca tengas que inventar una respuesta.

## Lo que no te toca

Como cuidadora **no puedes crear ni editar una orden de medicamento**: ni la dosis, ni el horario, ni suspenderla. Eso es de enfermeria para arriba. Tu los das y los registras, y documentas por que no se dio cuando no se da.

PREGUNTAS:
P: Como se firman los medicamentos de las 8:00 AM de Rosa Medina 204?
a) Uno por uno, poniendo tu PIN en cada medicamento
b) Uno por uno, con una firma para cada dosis
c) Con la huella del residente y tu contraseña
*d) Con una firma con el dedo para todo el pack
EXPLICACION: El boton dice "Administrar pack" y debajo "Una firma para los N meds pendientes": esa firma cubre todos los que quedan sin resolver en ese pack.

P: Luis Ortega 112 estaba en el hospital a la hora de su Tamsulosina. Tocas Omitir. Que te pide la pantalla?
a) Nada mas: se guarda al tocar el boton
*b) Un motivo de la lista y una explicacion corta
c) Un codigo del supervisor y la firma de enfermeria
d) La hora exacta en que el residente volvio al piso
EXPLICACION: Hay siete motivos y un minimo de diez caracteres de detalle; sin las dos cosas el boton de confirmar se queda gris.

P: En tu tableta un medicamento sale Suspendido. Que quiere decir?
a) Que el residente lo escupio y hubo que repetirlo
b) Que la farmacia no lo ha traido todavia
*c) Que lo paro el medico o hay un procedimiento
d) Que pasaron dos horas de la hora pautada
EXPLICACION: Se pinta en gris y no en rojo justamente porque no es una omision tuya: lo decidio alguien con autoridad para decidirlo.

P: Le das un PRN a Carmen Delgado 210 por dolor de cadera. Que te pide Zendity despues?
*a) Que digas despues si le hizo efecto o no
b) Que repitas la dosis cuando pasen cuatro horas
c) Que avises a la familia por su portal
d) Que imprimas el Cardex y se lo firmes
EXPLICACION: Resolvio, Mejoro en parte, Sin efecto o No se pudo evaluar: sin esa respuesta nadie sabe si repetirlo, cambiarlo o llamar al medico.

P: Que puede hacer una cuidadora con las ordenes de medicamento?
a) Cambiar la dosis si el residente la tolera mal
b) Mover la hora cuando el residente esta dormido
c) Suspender el que pida la familia
*d) Administrarlos y registrar lo que paso
EXPLICACION: Crear una orden, cambiar dosis o reprogramar horarios necesita rol de enfermeria o superior; el sistema no te lo deja hacer aunque te lo pidan.

---SECCION_4---
LECTURA:
# Lo que registras, y quien lo va a leer

## Actividades Diarias y Comidas

El boton **Bitacora** de la tarjeta abre "Actividades Diarias y Comidas". Casi todo ahi es de boton, no de escribir:

| Bloque | Que se toca |
|---|---|
| Higiene Matutina | Completar Baño de 6AM-10AM (con dos minutos de espera para no duplicar) |
| Control de Continencia | Seco · Humedo · Evacuacion |
| Piel | Rotacion Izquierda / Supino / Derecha. El recuadro de arriba dice "Protocolo UPP Activo" si el residente tiene rotacion indicada, y "Vigilancia Dermatologica" si no |
| Registro Nutricional | Desayuno, Almuerzo o Cena, y luego Todo / Mitad / Poco / Nada |
| Logistica | Lavar Ropa · Aseo Habitacion |
| De noche | Control de Noche: Profundo · Despierto · Anomalia |

Si marcas que comio **Poco** o **Nada**, la pantalla te pregunta por que y **no te deja guardar sin contestar**. Hay diez motivos, y dos de ellos existen para que no tengas que inventar ninguno: "Rechazo y no dijo por que" y "Otro". Tres de esos motivos —nausea o vomito, dolor o malestar, dificultad para tragar— avisan a enfermeria.

Arriba del todo esta **Hora del registro**. Si bañaste a Pedro Santana 103 a las 7:15 y estas registrando a las 8:47, pon 7:15. Hasta 12 horas atras, nunca en el futuro.

Los **signos vitales no estan aqui**. Tienen su propio boton en la tarjeta, y ahi llenas solo lo que mediste: si solo tomaste la glucosa, registra solo la glucosa.

## Los tres sitios donde escribes con tus palabras

Esta es la decision con mas consecuencia que tomas en la tableta, porque **cada sitio lo lee gente distinta**:

| Donde | Quien lo lee |
|---|---|
| **Bitacora General** (el ultimo cuadro de Actividades) | Enfermeria, supervision, una auditoria — **y la familia, en su portal** |
| **Preventiva** (Reporte a Enfermeria) | Enfermeria y supervision. No se publica a la familia |
| **Algo cambio en el residente** | Enfermeria, que tiene que contestarte |

Leelo otra vez: **lo que escribes en la Bitacora General lo puede leer un hijo.** Escribe pensando en eso. Si es algo clinico que debe quedar dentro del equipo, no va ahi: va por **Preventiva**, que entra derecho a enfermeria.

## Algo cambio en el residente

Para lo que notas y todavia no es una emergencia. Dos pasos: eliges el area y escribes que viste, minimo 15 caracteres.

Las areas son nueve: Se mueve distinto · Come o bebe distinto · Mas confundido · Animo o conducta · Piel · Dolor · Duerme distinto · Continencia · Otra cosa.

Lo que hace util ese registro es **tu frase**, no la etiqueta. "Ya no se levanta solo del sillon. Hay que darle la mano cada vez que se para, y camina inclinado hacia la izquierda. Hace una semana cruzaba el pasillo sin ayuda." Eso se lee y se entiende. Y el circuito se cierra: enfermeria lo revisa y te contesta que se hizo.

![Asi se ve del otro lado lo que tu escribiste: enfermeria lo tiene en cola, con tu nombre debajo, y arriba el aviso de que tres residentes tienen lo mismo.](/academy/capturas/cambios-lista.jpg)

## Acciones: la puerta de lo que no es rutina

En el menu de la izquierda, **Acciones** abre Operaciones Centrales con seis tarjetas:

- Cambio Clinico u Observacion
- Señalamiento de Familia
- Incidente de Mantenimiento
- Alerta Piel / UPP
- Medicamento sin administrar (encontrado en cama, mesa o carrito)
- Alerta Critica: Caida

Dentro de **Cambio Clinico** tienes que elegir entre dos botones:

| Nota de turno | Alerta clinica |
|---|---|
| Algo que hiciste o notaste | Necesita que alguien lo atienda |
| Queda en el expediente | Escala a enfermeria y supervision |

## Como se escribe

Documenta **lo observable**, no tu conclusion. No "el residente parece triste": escribe "no participo en la actividad y permanecio en silencio durante el almuerzo". Lo que se ve es verificable y le sirve a quien tiene que decidir; una conclusion tuya, no.

Y escribe **en el momento**. Lo que se deja para el final del turno se escribe peor y a veces no se escribe.

PREGUNTAS:
P: Escribes en la Bitacora General que Pedro Santana 103 estuvo callado todo el dia. Quien puede leer eso?
a) Solo enfermeria y el supervisor que firma el relevo
b) Solo tu, que la firmas con tu nombre
*c) El equipo, y tambien la familia en su portal
d) Nadie: la bitacora se borra al cerrar el turno
EXPLICACION: La familia lee la nota de la bitacora en su portal, asi que lo clinico que debe quedar dentro del equipo va por Preventiva y no por ahi.

P: Rosa Medina 204 lleva tres dias caminando inclinada. No es emergencia. Por donde lo reportas?
a) En la Bitacora General, al final del turno
*b) Con el boton de Algo cambio en el residente
c) Con Trasladar ER para que la vea el medico del hogar
d) Con Alerta Caida, aunque no se haya caido
EXPLICACION: Ese boton existe justo para lo que cambio sin ser todavia una emergencia, y enfermeria tiene que revisarlo y contestarte que se hizo.

P: Marcas que Carmen Delgado 210 no comio nada en el almuerzo. Que pasa?
a) Se avisa a la cocina y no hay nada mas que hacer
*b) Te pide el motivo antes de dejarte guardar
c) Se abre una alerta roja al supervisor
d) Se descuenta de la comida del dia siguiente
EXPLICACION: Son diez motivos y hay uno honesto para cuando no lo dijo; tres de ellos ademas avisan a enfermeria en el momento.

P: En Acciones, dentro de Cambio Clinico, eliges entre Nota de turno y Alerta clinica. Que decides ahi?
a) Si el reporte lo escribes tu o lo escribe Zendi
b) Si la nota se imprime para el expediente en papel
c) Si el residente va o no va al hospital
*d) Si el caso escala para que alguien lo atienda
EXPLICACION: Nota de turno se queda en el expediente; Alerta clinica sube a enfermeria y supervision porque alguien tiene que hacer algo con ella.

P: Bañaste a Pedro Santana 103 a las 7:15 y lo estas registrando a las 8:47. Que haces?
a) Esperas al dia siguiente para registrarlo
*b) Pones 7:15 arriba, en Hora del registro
c) Pides al supervisor que la corrija
d) Lo escribes en la bitacora y no tocas nada mas
EXPLICACION: Acepta hasta 12 horas atras y nada en el futuro, y el expediente guarda las dos horas: la del cuido y la del tecleo.

---SECCION_5---
LECTURA:
# Lo que pasa, y como entregas el turno

## Algo paso

Los tres botones de abajo de la tarjeta son los que no se deshacen. Van separados por una linea a proposito.

**Alerta Caida.** Si la presenciaste, contestas lo que viste: si reacciona y esta consciente, si hay sangrado, el dolor de 0 a 10. Si **no** la presenciaste, marcas la casilla "No la presencie — me la reportaron" y entonces te pide dos cosas que solo tu sabes: **quien te la reporto** y **cuando fue**. La caida del turno de noche que te cuentan por la mañana no paso por la mañana, y si la registras con la hora de ahora el patron de caidas de ese residente deja de leerse.

**Trasladar ER.** Traslado al hospital. Te pregunta si fue por una caida.

**Reportar fallecimiento.** El residente deja de aparecer en el piso de inmediato y direccion recibe el aviso. **El cierre del expediente lo hace direccion, no tu.** Este boton existe para que nadie tenga que usar "Trasladar ER" para un fallecimiento, que es lo que pasaba antes.

Y cuando el residente vuelve: la tarjeta queda velada con el sello "En Hospital" o "En Dialisis" y un boton verde **"Registrar Retorno al Piso"**. Mientras esta fuera, el sistema no le pide medicamentos a nadie.

## Entregar Turno

El boton esta arriba a la derecha. Abre un asistente de **tres pasos**, y el cartel lo dice sin rodeos: tu turno se cierra cuando firmes este reporte.

**Paso 1 — Pendientes de tu turno.** Lo que quedo abierto, en dos grupos:

| Bloqueos Criticos | Decisiones Requeridas |
|---|---|
| No te dejan cerrar | Se resuelven ahi mismo con un boton |
| Hay que resolverlos en Triage Central | Ejemplo: Rehuso / Durmio / Trasladar |

Si no hay nada, sale "Estado Limpio".

**Paso 2 — Tu reporte de turno.** Zendi lo arma con lo que tu hiciste hoy y te enseña cuatro contadores: Meds, Baños, Comidas, Vitales. **Leelo completo.** Puedes corregir el texto en el cuadro si algo esta mal, y hay una casilla obligatoria: "He leido y confirmo que este reporte es correcto".

**Paso 3 — Firma con el dedo.**

Dos cosas que hay que saber de este paso:

- **Si editas el texto despues de firmar, la firma se borra** y tienes que firmar otra vez. Es a proposito: firmas lo que leiste.
- **Los medicamentos que omitiste salen solos**, con el motivo que escribiste al omitirlos. Leelos antes de firmar: si el motivo quedo corto, ahi es donde lo explicas.

![El asistente de cierre. Izquierda, Paso 1: aqui salio "Estado Limpio" porque no quedaba nada pendiente. Derecha, el reporte que armo Zendi con los cuatro contadores del turno, y debajo la casilla sin marcar: hasta que no la marques y firmes, el turno sigue abierto.](/academy/capturas/care-turno-entregar.jpg)

## Que pasa despues de tu firma

1. Firmas tu reporte.
2. Le llega al **supervisor** para su firma.
3. El **proximo turno** lo recibe al entrar.

## Y si no firmas

No hay una multa ni te bloquean nada. Lo que pasa es peor y mas silencioso:

- **La que entra detras de ti entra a ciegas.** No sabe de la fiebre de Carmen, ni de que Luis lleva dos dias sin baño.
- Queda contado en tu **Mi Desempeño**, en "Turnos cerrados con el relevo: X de Y".
- Tu sesion se queda abierta y el supervisor la ve en su panel, en **Sesiones Sin Cerrar**, con las horas que lleva.

PREGUNTAS:
P: Te cuentan por la mañana que Luis Ortega 112 se cayo de madrugada. Que haces?
*a) Marcas que no la presenciaste y pones la hora real
b) Esperas a que la registre quien estaba de noche
c) La anotas en la bitacora, no en el modulo de caidas
d) La registras con la hora de ahora, que es cuando te enteras
EXPLICACION: Con esa casilla te pide quien te la reporto y cuando fue, y sin la fecha del evento el patron de caidas de ese residente queda ilegible.

P: Que te enseña el Paso 1 del cierre de turno?
a) El horario de la semana que viene
b) La lista de residentes que te tocaron
*c) Lo que quedo pendiente en tu turno
d) Los cursos de Academy que te faltan
EXPLICACION: Viene en dos grupos: los bloqueos criticos, que no te dejan cerrar, y las decisiones que se resuelven ahi mismo con un boton.

P: Firmaste el reporte de cierre y despues corriges una linea del texto. Que pasa?
a) El reporte se manda con la firma anterior
b) El supervisor tiene que autorizar ese cambio y firmarlo
c) El texto vuelve al que escribio Zendi
*d) Se borra la firma y hay que firmar de nuevo
EXPLICACION: Es a proposito, para que lo que quede firmado sea exactamente lo que leiste y no una version que cambio despues.

P: Omitiste dos medicamentos en tu turno. Como llegan al reporte de cierre?
*a) Salen solos, con el motivo que escribiste
b) No salen: hay que escribirlos a mano en el texto
c) Los añade enfermeria cuando firma el relevo
d) Aparecen al dia siguiente dentro del expediente
EXPLICACION: Por eso el motivo importa: lo que escribas al omitir es lo que va a leer el turno que entra, tal cual.

P: Te vas a casa sin firmar el cierre. Cual es la consecuencia real?
*a) El proximo turno entra sin saber que paso
b) La tableta te bloquea la sesion de mañana
c) Se te descuenta el turno de la nomina
d) Los residentes quedan sin medicar esa noche
EXPLICACION: Ademas queda contado en tu Mi Desempeño y tu sesion abierta le sale al supervisor en Sesiones Sin Cerrar.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 9: EL SUPERVISOR EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'SUPERVISOR_101',
    title: 'El Supervisor en Zendity',
    description: 'Domina las herramientas de supervision en tiempo real: dashboard, sesiones zombi, MISSED y redistribucion de personal.',
    durationMins: 30,
    bonusCompliance: 10,
    emoji: '👁️',
    category: 'Operaciones de Piso',
    order: 5,
    content: `---META---
TITULO: El Supervisor en Zendity
PROMPT_ZENDI: Evalua si la supervisora sabe leer Mission Control, decidir sobre cada aviso del Inbox Operativo, cerrar una sesion abierta y cubrir un grupo sin cuidadora, y firmar los relevos del dia.
TERMINOS_CLAVE: Mission Control, Inbox Operativo, Inminente, Atencion, Rutina, Despachar, Referir a Enfermeria, Ya lo atendi, Sesiones Sin Cerrar, Forzar cierre, Grupos sin cuidadora en piso, Asignar Grupo, Handovers Hoy, Auditoria de Turno, Brechas detectadas, Meds del Turno
PREGUNTA_REFLEXION: Piensa en tu ultimo turno de supervision. Hubo algo que viste en el piso y que resolviste hablando, sin que quedara en Zendity. Que era, y por que boton de tu panel tendria que haber entrado?

---SECCION_1---
LECTURA:
# Mission Control: tu pantalla

En el menú de la izquierda tu pantalla se llama **Triage & Supervisión**. Al
entrar, el título de arriba dice otra cosa: **Mission Control**. Son la misma
pantalla. Si buscas "Mission Control" en el menú no lo vas a encontrar.

Arriba del todo, tres cosas:

- El recuadro **Turno Activo**: el turno en curso, su ventana de horas y la
  línea "Hora de Puerto Rico". Ese es el turno contra el que se cuenta todo lo
  demás de la pantalla.
- Los **cuatro contadores**: **En Piso**, **Baños**, **Dietas**, **Incidentes**.
  En Piso son las cuidadoras con sesión abierta ahora mismo. Incidentes se pone
  en rojo en cuanto pasa de cero.
- Tres botones: **Asignar Meta Libre (15m)**, **Acciones Rápidas** (los mismos
  cuatro reportes que tiene la tableta de la cuidadora) y **Chat Staff**.

Debajo, dos accesos: **Auditoría de Turno** y **Feedback de Cocina**.

![Mission Control al abrirlo: el turno activo con su ventana de horas, los cuatro contadores (En Piso, Baños, Dietas, Incidentes) y los dos accesos de abajo. Las tarjetas de ronda que asoman al pie son de montaje: el "7/7 · 100%" que enseñan no lo produce el panel real, como se explica más abajo.](/academy/capturas/supervisor-mission-control.jpg)

## Rondas de Cuidadores — Tiempo Real

El bloque grande de abajo. Las cuidadoras salen **agrupadas por piso**, y cada
una trae su tarjeta:

| Lo que ves | Qué significa |
|---|---|
| **Grupo VERDE** y el enlace **cambiar** | Su color de hoy. Ahí mismo se le cambia el grupo base |
| **2 RONDAS** | Rondas completas desde que abrió el turno |
| **Ronda actual: 3/7 · 43%** | Lleva tres de sus siete residentes en la vuelta en curso |
| **Última ronda completada hace 40m** | Cuándo cerró la anterior |

Una **ronda** es haber registrado al menos una atención a cada residente de su
grupo. De día cuentan baños, comidas, rotaciones y notas; de noche cuentan las
rotaciones y las notas de ronda nocturna.

## El contador se pone a cero al cerrar la ronda

Esto hay que saberlo o vas a leer la tarjeta al revés. En cuanto la cuidadora
registra al **último** residente que le faltaba, el sistema suma uno a
**RONDAS** y deja "Ronda actual" **en cero**. Nunca se queda en siete.

O sea que **el estado "7/7 · 100%" no existe en esta pantalla**, y la pastilla
verde "Ronda completa" tampoco la vas a ver: para cuando la ronda está
completa, el contador ya volvió a empezar. Si en una demo o en una captura
vieja los ves, es un montaje — el panel real no produce ese estado.

Lo que sí importa es que **"Ronda actual: 0/7" no significa que no haya
empezado**. Léelo junto a las dos líneas de al lado:

| Lo que ves junto | Qué pasó de verdad |
|---|---|
| 0/7 · **2 RONDAS** · última hace **5m** | Acaba de cerrar su segunda vuelta. Va bien |
| 0/7 · **0 RONDAS** · pastilla "Sin actividad aún" | Esta sí: lleva el turno sin registrar nada a nadie |
| 3/7 · última hace **3h** · pastilla "+3h sin ronda" | Va por la mitad y la vuelta se le está alargando |

## Para qué sirve este panel, y para qué no

El criterio con el que está armado: **aquí solo va lo que se puede bajar a cero
haciendo algo en el turno.** Lo que no se resuelve en una o dos horas no vive
en esta pantalla.

## Lo que Zendi te manda, de verdad

| Lo que SI recibes | Lo que NO existe |
|---|---|
| **Prólogo del Turno**, una vez al día, a las 6:00 AM | Un resumen automático cada 4 horas |
| El **Reporte semanal de supervisión**, los lunes a las 8:30 AM | Elegir si te llega por push o solo en pantalla |
| Avisos en la campana de la aplicación | Una pantalla de preferencias de notificación |

No hay nada que configurar. No hay notificaciones push. Si algo tiene que
llegarte, llega a la campana o al correo, y ya está decidido dónde.

**Cuidado con la hora que pone la pantalla.** La baldosa del prólogo está
rotulada **"(05:45 AM)"**, y mientras no hay reporte el cartel dice "estará
disponible a las 5:45 AM". Las dos cosas están mal: el proceso que escribe el
prólogo corre a las **6:00 AM, hora de Puerto Rico**, y así lo dice él mismo.
Las 5:45 son el resto de un proceso viejo que se eliminó y cuyo rótulo se quedó
puesto. Si abres a las 5:50 y no hay nada, no está roto — todavía no es la
hora. Vuelve pasadas las seis.

PREGUNTAS:
P: Cómo se llama tu panel en el menú de la izquierda?
a) Mission Control
*b) Triage & Supervisión
c) Panel del Director
d) Centro de Triage
EXPLICACION: En el menú se lee "Triage & Supervisión"; "Mission Control" es el título que aparece ya dentro de la pantalla. "Centro de Triage" es el título de otra pantalla distinta, la que en el menú corporativo aparece como "Triage Center".

P: Cuáles son los cuatro contadores de arriba?
a) MISSED, zombis y handovers
b) Residentes, camas y visitas
c) Baños, comidas y caídas
*d) En Piso, Baños, Dietas e Incidentes
EXPLICACION: En Piso cuenta las cuidadoras con sesión abierta ahora; Incidentes se tiñe de rojo en cuanto pasa de cero.

P: Cada cuánto te llega el resumen de Zendi?
*a) Una vez al día, por la mañana
b) Cada cuatro horas, seis veces al día
c) Cada vez que una cuidadora cierra su turno
d) Solo cuando lo pides desde el panel
EXPLICACION: Es el Prólogo del Turno, que se escribe a las 6:00 AM hora de Puerto Rico aunque la baldosa siga rotulada 5:45; aparte de ese, lo único periódico es el reporte de supervisión de los lunes.

P: Una tarjeta dice "Ronda actual: 0/7", "2 RONDAS" y "última ronda completada hace 5m". Qué pasó?
a) Que lleva el turno entero sin registrar nada a nadie
b) Que se le cayó la sesión y el panel perdió lo registrado
*c) Que acaba de cerrar su segunda vuelta y empieza la tercera
d) Que le quedan siete residentes de la vuelta que tenía a medias
EXPLICACION: El contador vuelve a cero en cuanto se registra al último residente de la vuelta, y el que sube es RONDAS; por eso el 7/7 y la pastilla "Ronda completa" no se ven nunca. El 0/7 que sí preocupa es el que viene con 0 RONDAS y "Sin actividad aún".

P: Para qué está hecho este panel?
a) Para revisar la nómina y las horas del personal
*b) Para lo que se puede resolver en el turno
c) Para guardar el historial clínico de cada residente
d) Para vigilar minuto a minuto lo que teclea cada empleada
EXPLICACION: Es operación en tiempo real: lo que no baja a cero haciendo algo en una o dos horas no se pone aquí, porque un contador que no puede bajar se deja de mirar.

---SECCION_2---
LECTURA:
# El Inbox Operativo: a qué vas primero

Es el bloque que dice **Inbox Operativo** y debajo "Tickets clínicos,
preventivos y reportes familiares en espera". Ahí cae lo que el piso reporta.

## Los tres niveles

Arriba a la derecha hay dos pastillas con el conteo: **Inminente** y
**Atención**. Cada tarjeta lleva el suyo:

| Nivel | Color | Qué es |
|---|---|---|
| **INMINENTE** | rojo | Va primero. Si es reciente, trae "hace N m" al lado |
| **ATENCION** | ámbar | Hay que atenderlo, no ahora mismo |
| **RUTINA** | gris | Puede esperar |

**No hay banda verde.** Si buscas el verde en esta pantalla, no está.

Debajo, las pestañas con su conteo: **Todos**, **Clínico**, **UPP**,
**Familia**, **Mantenimiento**. Y a la derecha, **Ver alertas anteriores**, que
amplía a 90 días **solo las alertas clínicas**: los incidentes y las caídas se
quedan en 24 horas.

## El autor: solo lo traen las alertas clínicas

Cada tarjeta te dice el residente en **Sujeto**. Lo que casi nunca te dice es
quién lo escribió.

**La línea "Reportó" solo la llevan las alertas clínicas** — las que una
cuidadora escribe desde su tableta. Esas sí salen con el nombre y el rol. Las
demás no: **las caídas, los incidentes, la rotación vencida y los avisos de
mantenimiento** llegan sin autor, y cuando no hay autor la línea ni se pinta.

Míralo en la foto. La primera tarjeta y la tercera traen "Reportó: Joaneliz
Pérez" y "Reportó: Marisol Vega". La del medio, la rotación vencida de Pedro
Santana, **no trae ninguna** — y es una de las dos Inminentes. Lo mismo pasa
con una caída: la tarjeta más urgente que te puede entrar es justo la que no
te dice a quién preguntarle.

No es que el dato no exista; es que esa tarjeta no lo enseña. Así que cuando
falte, el camino es el piso: mira en **Rondas de Cuidadores** quién lleva el
color de ese residente y pregúntale a ella. No pierdas tiempo buscando el
nombre en la tarjeta.

![El Inbox Operativo con tres avisos: dos Inminentes y uno de Atención. Las dos alertas clínicas traen la línea "Reportó" con el nombre y el rol; la rotación vencida del medio no la trae, y por eso ahí no aparece.](/academy/capturas/supervisor-inbox-operativo.jpg)

## Los botones cambian según el aviso

- **Alerta clínica**: **Despachar**, **Referir a Enfermería**, **CERRAR**.
- **Rotación vencida (UPP SLA)**: **Despachar a la cuidadora** y
  **La hice yo — registrarla**. Esta alerta **solo se apaga cuando se registra
  la rotación**. Cerrar la tarea no la apaga: si nadie giró al residente, el
  aviso vuelve. Y eso es correcto.
- **Mantenimiento**: **Enviar a Mantenimiento**, que avisa al personal de
  planta física y al director.

**Referir a Enfermería** no crea una tarea con reloj: manda un aviso por la
campana a quien ejerce enfermería en tu sede. Aquí eso importa, porque la
enfermería la hace alguien que tiene NURSE como rol secundario, no primario.

## Cerrar un aviso: hay dos salidas, y no son lo mismo

Al pulsar **CERRAR** se abre "Cerrar este aviso" con dos caminos:

| **Ya lo atendí — cerrar** | **Confirmar Descarte** |
|---|---|
| Leíste, hiciste algo y lo cierras | No era real, o no aplica |
| No te pide escribir nada | Motivo obligatorio, mínimo 10 caracteres |

Usa el primero cuando de verdad hiciste algo. Está arriba y sin requisitos a
propósito: antes la única salida decía "descartar", que suena a que el aviso no
valía nada, y por eso quedaron avisos abiertos durante meses.

## Qué pasa al despachar

**Despachar** abre "Ruteo Táctico 1-Click": la lista de quien está en piso con
su carga de tareas, y una marcada **Zendi Sugiere** — la que menos tiene. Al
tocar un nombre, la tarea sale con una hora de plazo.

Del otro lado, a la cuidadora le aparece en su tableta, en **Notas y tareas
pendientes**, con su etiqueta —**Nota** o **Tarea SLA**— y un botón para
cerrarla. Si lo que mandaste fue una rotación, su botón no dice "atendida":
dice **Ir a rotar**, y la lleva a registrarla.

![Lo que le sale a la cuidadora en su tableta cuando le despachas algo: la nota con el residente y el botón Marcar como atendida.](/academy/capturas/care-turno-notas.jpg)

PREGUNTAS:
P: Cuáles son los tres niveles de urgencia del Inbox Operativo?
a) Verde, amarillo y rojo
b) Alto, medio y bajo
*c) Inminente, Atención y Rutina
d) Crítico, urgente, normal y aplazable
EXPLICACION: Inminente en rojo, Atención en ámbar y Rutina en gris; en esta pantalla no hay banda verde.

P: Qué apaga la alerta de rotación vencida de un residente?
*a) Que quede registrada la rotación de ese residente
b) Despachar la tarea y esperar
c) Cerrarlo con el botón de descarte
d) Que pase el plazo siguiente
EXPLICACION: Se apaga con el hecho, no con el trámite: si la cuidadora cierra la tarea pero no giró a nadie, la alerta vuelve, y vuelve con razón.

P: En qué se diferencian "Ya lo atendí — cerrar" y descartar?
a) Los dos piden un motivo de al menos diez caracteres
b) Ninguno de los dos deja rastro en el expediente
c) Descartar avisa a la familia y atender no
*d) Descartar pide motivo; atender no
EXPLICACION: Descartar una alerta clínica sin haber actuado sí tiene que quedar explicado; decir que la atendiste no, porque eso es lo que pasa casi siempre.

P: A quién le llega "Referir a Enfermería"?
a) Solo a la enfermera de turno que esté en el piso
*b) A quien ejerce enfermería en tu sede
c) Al director y a la familia del residente a la vez
d) Al Centro de Triage, que lo asigna solo
EXPLICACION: En este hogar nadie tiene NURSE como rol primario, así que el aviso se busca también por rol secundario; llega por la campana y no crea tarea con reloj.

P: Qué ve la cuidadora cuando le despachas un aviso?
*a) Una nota o una tarea en su tableta, con un botón para cerrarla
b) Un correo con el texto completo y tu firma
c) Nada: el despacho queda en tu panel
d) Una llamada automática al teléfono del hogar
EXPLICACION: Le sale en "Notas y tareas pendientes" con su etiqueta, y si es una rotación el botón la lleva a registrarla en vez de dejarla marcar la tarea.

---SECCION_3---
LECTURA:
# Quién está en piso: sesiones, ausencias y grupos sin cubrir

## En Piso

La tarjeta **En Piso** lista a cada cuidadora con sesión abierta, las horas que
lleva logueada, cuántas tareas tiene pendientes y un botón ámbar **Cerrar
turno**. Ahí no se ve la hora de su último registro: **se ven las horas desde
que abrió la sesión**, que es otro dato.

## Sesiones Sin Cerrar

Cuando una sesión lleva **12 horas** abierta, sale del bloque En Piso y pasa a
un bloque rojo aparte, **Sesiones Sin Cerrar**. Cada línea trae el nombre, la
pastilla **{h}h ABIERTA** y el botón rojo **Forzar cierre**. El panel mira
hasta siete días atrás, así que los olvidos viejos siguen ahí hasta que alguien
los cierre.

**No hay ningún aviso amarillo a los 30 minutos.** Y no se mide inactividad: se
mide cuánto lleva abierta. Una cuidadora que lleva 11 horas y media sin cerrar
todavía te sale en verde en En Piso.

![El bloque rojo Sesiones Sin Cerrar con una sola línea: el nombre de la cuidadora, la pastilla que dice cuántas horas lleva la sesión abierta y el botón rojo Forzar cierre a la derecha.](/academy/capturas/supervisor-sesion-sin-cerrar.jpg)

## Forzar el cierre: lo que pide y lo que hace

Al pulsar **Forzar cierre** se abre "Confirmar cierre de turno", que avisa que
**esta acción no se puede deshacer**. Lo único que te pide es:

- **Razón del cierre (opcional)**. Si la dejas en blanco, el expediente guarda
  "Sin razón especificada".
- **Confirmar cierre**.

![El modal "Confirmar cierre de turno": arriba el aviso de que no se puede deshacer, el nombre de la cuidadora con el tiempo que lleva la sesión abierta, el campo de razón marcado como opcional y los botones Cancelar y Confirmar cierre.](/academy/capturas/supervisor-forzar-cierre.jpg)

**No hay PIN.** En Zendity el PIN es para entrar rápido y para autorizar en
recepción; no confirma ninguna acción tuya en toda la plataforma. Lo que te
autoriza a cerrar el turno de otra persona es tu rol.

| Lo que SI hace forzar el cierre | Lo que NO hace |
|---|---|
| Cierra la sesión y escribe "Cierre forzado por (tu nombre) — Razón: ..." | Crear el relevo que faltaba |
| Deja registro de auditoría a tu nombre | Dejarte escribir el relevo de otra persona |
| Le avisa a la cuidadora con la razón que pusiste | Recuperar lo que no se registró en el turno |

Ese turno queda **sin relevo**, y así va a salir en la Auditoría de Turno y en
el reporte de los lunes. Por eso la razón, aunque sea opcional, conviene
escribirla: es lo único que va a explicar el hueco.

## Personal No Presentado

Si alguien está pautado para el turno y no abrió sesión, aparece en
**Personal No Presentado** con el botón **Marcar Ausente**. Al confirmarlo
("Confirmar Ausencia") pasan dos cosas: la ausencia queda registrada y sus
residentes se reparten entre quienes sí están en piso.

Una ausencia suelta no penaliza a nadie. **Tres ausencias sin aviso en 30 días**
generan solas una observación, y la empleada tiene 72 horas para explicarla.

## Grupos sin cuidadora en piso

Este bloque rosa aparece **solo cuando un color se queda sin nadie con sesión
activa**. Si los cuatro colores tienen a alguien, no se pinta, y no hay otra
puerta: **no se puede redistribuir porque un grupo tenga más carga**. Eso no
existe.

Cuando aparece, cada color descubierto trae dos botones:

- **Redistribuir** — reparte sus residentes entre todas las cuidadoras activas.
- **Asignar a...** — abre "Asignar Grupo (color)", con el desplegable
  **Cuidadora receptora** y el botón **Confirmar Asignación**. El aviso del
  modal lo dice: todos los residentes del grupo a **UNA sola** cuidadora.

No se arrastra nada, no se mueven residentes uno a uno y no se pide PIN. Se
mueve el grupo entero, queda registro, y el cambio le aparece a la cuidadora en
su tableta marcado como cobertura.

PREGUNTAS:
P: Cuándo entra una sesión en "Sesiones Sin Cerrar"?
*a) A las 12 horas de haberse abierto la sesión
b) A los 30 minutos sin actividad
c) Cuando no contesta el chat
d) Al terminar la ventana del turno
EXPLICACION: Se cuentan las horas desde que abrió la sesión, no el tiempo sin actividad, y el panel las sigue mostrando hasta siete días atrás.

P: Qué te pide el sistema para forzar el cierre de un turno ajeno?
a) Tu PIN de supervisora y un motivo obligatorio
b) La contraseña de la cuidadora que dejó abierto
*c) Nada: el motivo es opcional y no hay PIN
d) La autorización por escrito de la directora de la sede
EXPLICACION: Lo que te autoriza es tu rol; si dejas la razón en blanco queda guardado "Sin razón especificada", y eso es lo que va a leer quien revise después.

P: Forzar el cierre crea el relevo que faltaba?
a) Sí, Zendi lo arma con lo que se registró en el turno
*b) No, ese turno se queda sin relevo y así consta
c) Sí, y lo firma la supervisora en el mismo modal
d) Sí, desde Reportes de Turno
EXPLICACION: Solo escribe una línea en la propia sesión; el hueco aparecerá luego como "Sin handover" en la Auditoría de Turno.

P: Cuándo aparece el bloque "Grupos sin cuidadora en piso"?
a) Cuando un grupo tiene más carga que los demás
b) Cuando la supervisora lo abre desde el menú lateral
c) Al principio de cada turno, siempre
*d) Cuando un color se queda sin nadie en piso
EXPLICACION: Es su único disparador; si los cuatro colores están cubiertos el bloque no se pinta y no hay otra forma de entrar a redistribuir.

P: Qué mueve el botón "Asignar a..."?
a) Los residentes que tú marques uno a uno arrastrándolos
b) Solo los residentes con medicamentos pendientes del turno
*c) Todo el grupo a una sola cuidadora
d) La mitad del grupo, y la otra mitad queda para el siguiente turno
EXPLICACION: El modal lo avisa con esas palabras; si lo que quieres es repartir entre varias, el botón es Redistribuir.

---SECCION_4---
LECTURA:
# Medicamentos, caídas y el Centro de Triage

## Meds del Turno es un porcentaje, no una lista

La baldosa **Meds del Turno** te da **un solo número**: administrados sobre
programados dentro de la ventana del turno, para residentes activos. Debajo, la
barra: verde desde 90%, ámbar entre 70 y 89, roja por debajo.

Ese ámbar es **una media del turno**, no "una dosis a punto de vencer". Nada en
Zendity calcula lo cerca que está una dosis de su hora.

| Lo que SI hay | Lo que NO hay |
|---|---|
| Un porcentaje del turno y su barra de color | Un panel con el estado de cada dosis |
| El estado real de cada dosis en el expediente | Un estado llamado LISTO, que no existe |
| Aviso inmediato de cada omisión que registra el piso | Un contador de tiempo sobre las dosis perdidas |

## MISSED: la palabra que no vas a ver

MISSED lo escribe un proceso automático sobre las dosis que quedaron
pendientes. **Esa palabra no aparece en tu panel.** Y en la **Auditoría eMAR**,
que sí está en tu menú, una dosis MISSED se pinta **en gris, con el nombre
tachado y la etiqueta "Registrado"**, sin ningún botón al lado — igual que una
que sí se dio.

Léelo despacio: esa pantalla le dice a quien mire que la dosis quedó
registrada. No la creas.

**Lo que sí es información fiable:** cuando una cuidadora no da un medicamento
y **lo omite a mano**, elige un motivo de una lista de siete y escribe una
explicación de al menos diez caracteres, y **enfermería y supervisión se
enteran en el momento**. Esa omisión, con su motivo, sale también en el relevo
que vas a firmar.

## Lo que el relevo NO te va a decir

Aquí hay que ir despacio, porque es fácil quedarse con la mitad tranquilizadora.

El relevo recoge **lo que la cuidadora escribió**: omitido, rechazado,
retenido. Las tres llevan su motivo y su nombre detrás.

**Las MISSED no las recoge.** Esas no las escribe nadie: las pone el sistema
solo cuando vence la ventana de la dosis, sin autor, y por eso quedan fuera del
relevo. La **Auditoría de Turno** las deja fuera por lo mismo, y su brecha
"medicamentos omitidos sin justificación" tampoco las cuenta.

Súmalo con lo de arriba y sale esto, que conviene decir sin rodeos:

| Dónde miras | ¿Te enseña una dosis que nadie tocó? |
|---|---|
| Inbox Operativo | No |
| Meds del Turno | Solo dentro del porcentaje, sin nombre ni residente |
| El relevo que firmas | No |
| Auditoría de Turno | No |
| Auditoría eMAR | Sí, pero tachada y rotulada "Registrado" |

**No firmes un relevo creyendo que ese hueco está cubierto.** No lo está.

Dónde sí sale, con el residente y el medicamento por su nombre: en el **Prólogo
del Turno** de la mañana siguiente, que se arma con las dosis omitidas,
rechazadas, retenidas **y MISSED** de las últimas 24 horas de la sede. Y en el
expediente del residente, dosis por dosis.

Lo que no vas a encontrar en ninguna parte es quién la dejó pasar: una MISSED
no tiene autor porque nadie la tocó. Si necesitas esa conversación, la respuesta
está en quién llevaba ese color en ese turno, no en una pantalla.

## Caídas: todas crean ticket

No hay umbral de gravedad. **Toda caída registrada crea un ticket**, sea leve o
grave. Lo único que cambia es la prioridad: **Crítica** si se reporta en el
momento, **Baja** si es un registro retroactivo de algo que pasó antes.

Si aprendes que "solo llegan las graves", vas a dejar de ir a buscar las leves,
y las leves de un mismo residente son justo el patrón que interesa.

![El módulo de Caídas: arriba el riesgo por residente con sus cuatro grupos, y abajo las caídas de los últimos 90 días con su gravedad.](/academy/capturas/caidas-panel.jpg)

## El Centro de Triage

Es otra pantalla, y le pasa lo mismo que a Mission Control pero al revés. En el
menú corporativo la entrada se lee **Triage Center**, en inglés. El título de
dentro dice **Centro de Triage**. Si buscas "Centro de Triage" en el menú no lo
vas a encontrar: **busca "Triage Center"**.

Ahí viven los tickets con su tipo, su prioridad y su estado. Sobre un ticket
puedes:

- Asignarlo a alguien con el desplegable **Asignar a...**
- **Marcar En Proceso**
- **Nota de Seguimiento**
- **Resolver Ticket**, y luego **Confirmar Cierre**

Y eso es todo. **No hay botón de escalar, ni de activar emergencia, ni de
avisar a la familia.** El escalado no es una decisión tuya: un ticket de
prioridad alta que sigue sin resolver **a los 120 minutos** se marca Escalado
solo y avisa a dirección y a supervisión.

Los **Señalamientos de Familia** se ven aquí, pero no se resuelven aquí. Tú y
las cuidadoras son el canal de entrada: reciben a la familia y lo registran.
**La decisión es de dirección.** Por eso tampoco te caen en el Inbox Operativo.

PREGUNTAS:
P: Qué te dice la baldosa "Meds del Turno"?
a) La lista de los que faltan por dar
b) El estado de cada dosis, una por una
c) Los minutos que le quedan a la próxima
*d) El porcentaje de dosis ya administradas dentro de la ventana del turno
EXPLICACION: Es administrados sobre programados en la ventana del turno; no hay desglose por estado, y LISTO ni siquiera es un estado del eMAR.

P: Una dosis venció sin que nadie la tocara. Qué pantalla del turno te lo enseña?
a) El relevo que firmas, que la trae con su motivo
b) La Auditoría de Turno, como brecha de ese residente
*c) Ninguna: hay que ir al eMAR o al prólogo
d) El Inbox Operativo, con una tarjeta Inminente
EXPLICACION: El relevo y la Auditoría de Turno solo recogen lo que la cuidadora escribió a mano —omitido, rechazado, retenido—; la MISSED la pone el sistema sin autor y las dos la dejan fuera. En la Auditoría eMAR sí sale, pero tachada y rotulada "Registrado", igual que una que sí se dio.

P: Qué decide si una caída entra al Centro de Triage?
a) La gravedad: solo entran las de alto y crítico
*b) Nada, todas entran; la gravedad solo fija la prioridad
c) Que la enfermera la confirme después de evaluar al residente
d) Que la caída haya ocurrido dentro del turno de noche
EXPLICACION: Entra siempre, sea leve o grave: crítica si se reporta al momento, baja si es un registro retroactivo. Si aprendes que solo llegan las graves, dejas de ir a buscar las leves, que son las que forman el patrón.

P: Cómo se escala un ticket en el Centro de Triage?
*a) Se escala solo, a los 120 minutos
b) Con el botón de escalar que hay en cada tarjeta
c) Activando el protocolo de emergencia desde el ticket
d) Reenviándolo por correo a la directora de la sede
EXPLICACION: Lo hace el sistema con los de prioridad alta sin resolver, y avisa a dirección y supervisión; tus botones son asignar, marcar en proceso, nota de seguimiento y resolver.

P: Quién resuelve un señalamiento de familia?
a) La supervisora, despachándolo al piso
b) La cuidadora del residente
c) Se cierra solo con el tiempo
*d) Dirección, en su pantalla de señalamientos
EXPLICACION: El piso es el canal de entrada y lo registra; mandarlo a resolver abajo ya se midió y falló, porque se le pedía a alguien algo que no está en su mano.

---SECCION_5---
LECTURA:
# Firmar los relevos y la Auditoría de Turno

## Handovers Hoy

El bloque **Handovers Hoy** lleva arriba a la derecha el conteo del día en dos
pastillas: las que están **esperando tu firma** y las ya **firmadas**. Son dos,
y hoy no van a ser más — el código tiene prevista una tercera, la de brechas,
pero no llega a pintarse nunca. De eso se habla más abajo, porque es lo que más
cuesta de esta pantalla.

Debajo de las pastillas, el grupo que importa: **Esperando tu firma**. Cada
tarjeta trae el turno, la etiqueta **Cuidadora firmó · falta tu firma**, la
hora, el nombre de quien lo escribió, sus colores, cuántos residentes cubrió y
el botón verde **FIRMAR**. Al final, plegado, **Completados hoy**.

![Handovers Hoy con sus dos pastillas de conteo —una esperando tu firma, uno firmado— y debajo el relevo de la noche con la etiqueta "Cuidadora firmó · falta tu firma" y el botón FIRMAR. Arriba no hay ninguna pastilla de brechas.](/academy/capturas/supervisor-relevos.jpg)

## Cómo se firma

**FIRMAR** abre un panel lateral sin sacarte de Mission Control:

1. **Reporte de cierre** — el texto que armó Zendi y que la cuidadora revisó y
   corrigió antes de firmarlo. Si quieres el detalle residente por residente,
   está **Abrir reporte completo en otra pestaña**.
2. **Nota del supervisor (opcional)** — para dejar dicho qué revisaste.
3. **Tu firma** — un recuadro que dice "Firma aquí con el dedo".
4. **Firmar y publicar**.

**Uno por uno, y a propósito.** No hay firma en bloque. Cada firma tuya
representa que revisaste ese reporte, y firmar diez de una vez no sería eso.
Tampoco hay PIN en ningún paso: la firma es un trazo con el dedo.

## La brecha que no te va a saltar

Dentro de ese mismo bloque hay un apartado que dice "Brechas — turnos cerrados
sin handover", y arriba tendría que haber una pastilla roja con su conteo.
**Hoy no se pinta ninguna de las dos cosas**: la consulta que las alimentaba se
quitó y no se ha vuelto a hacer, así que la lista llega siempre vacía y lo que
está vacío no se dibuja. Por eso arriba ves dos pastillas y nunca tres.

Así que **un turno que se cerró sin dejar relevo no te va a saltar a la cara**.
Dónde sí lo ves:

- En la **Auditoría de Turno**, donde ese turno sale marcado **Sin handover**.
- En el **reporte de los lunes**, en la línea "Turnos cerrados sin dejar
  relevo", con el nombre y la fecha de cada uno.

## Auditoría de Turno

Se entra por el acceso de arriba de Mission Control. Son tres pasos: buscas a
la empleada, eliges uno de sus turnos de los últimos 30 días, y se compila la
auditoría de ese turno.

Lo que sale, residente por residente: lo registrado en orden de hora, los
contadores de baños, comidas, medicamentos, vitales, rotaciones y pañales, y
arriba **Brechas detectadas**. Las brechas que calcula sola:

- Sin actividad registrada en este turno
- Baño no registrado, en la ventana de la mañana
- Ninguna comida registrada, en turno de mañana
- Medicamentos omitidos sin justificación
- Úlcera activa sin ninguna rotación registrada
- Rotaciones fuera de tiempo

Esa cuarta es la que hay que leer con cuidado: cuenta las que **la cuidadora
omitió a mano** y se dejó la explicación en blanco. Las MISSED —las que nadie
tocó— no entran, como se vio en la sección anterior. Un "cero omisiones" aquí
no quiere decir que se dieran todas.

Quien está fuera del hogar —hospital, diálisis— no genera brechas: sale con su
sello y no se le evalúa.

El botón **Imprimir** saca el documento con el pie **Certificación de
Auditoría**, con tres líneas de firma: Cuidador(a), Supervisor(a), Director(a).

## Tu evidencia de que supervisaste

No existe ningún "cierre administrativo del turno", ni pantalla, ni firma con
PIN al final de la jornada. Lo que demuestra que supervisaste son **los relevos
que firmaste** y **la auditoría que compilaste e imprimiste**. Eso es lo que
queda, y es lo que se le enseña a quien venga a mirar.

PREGUNTAS:
P: Cómo se firma un relevo de turno?
a) Escribiendo tu PIN de supervisora en el recuadro
*b) Con el dedo, uno por uno
c) Marcando todos y pulsando firmar en bloque
d) Con la firma que quedó guardada de la vez anterior
EXPLICACION: No hay firma en bloque a propósito: cada firma tuya representa que revisaste ese reporte concreto.

P: Qué pasa hoy con el apartado "Brechas — turnos cerrados sin handover"?
a) Te avisa en cuanto un turno se cierra sin relevo
b) Aparece a las dos horas de cerrado el turno
c) Solo sale en el turno de noche
*d) Hoy no se pinta nunca, ni la pastilla
EXPLICACION: La consulta que lo alimentaba se quitó y no se reimplementó: la lista llega siempre vacía, así que ni el apartado ni su conteo aparecen y ese hueco hay que ir a buscarlo a otro sitio.

P: Dónde ves que un turno se cerró sin dejar relevo?
*a) En la Auditoría de Turno, marcado como Sin handover
b) En el contador de Incidentes
c) En la campana, al momento
d) En el portal de la familia
EXPLICACION: Ahí ese turno sale marcado "Sin handover", y la misma falta aparece en el reporte de supervisión de los lunes.

P: Qué es una "brecha detectada" en la auditoría de un turno?
a) Un fallo de conexión de la tableta durante el turno
b) Una queja que dejó la familia sobre ese turno
*c) Algo que faltó registrar y el sistema cuenta solo
d) Un medicamento que la farmacia no llegó a entregar
EXPLICACION: Son seis, calculadas solas: sin actividad, sin baño, sin comida, omisiones sin justificar, úlcera sin rotar y rotaciones fuera de tiempo.

P: Cuál es tu evidencia de que supervisaste el turno?
*a) Los relevos firmados y la auditoría
b) El cierre administrativo firmado con PIN al final del turno
c) El digest final del turno, guardado por el sistema
d) Las horas que estuviste con la sesión abierta en el panel
EXPLICACION: No hay ninguna pantalla de cierre administrativo ni firma con PIN; lo que queda escrito con tu nombre son las firmas de relevo y la certificación de la auditoría.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 10: LA ENFERMERA EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ENFERMERA_101',
    title: 'La Enfermera en Zendity',
    description: 'Guia del rol de enfermeria en Zendity: autoridad clinica, medicamentos HELD, escalas de evaluacion y protocolos.',
    durationMins: 30,
    bonusCompliance: 10,
    emoji: '🩺',
    category: 'Operaciones de Piso',
    order: 6,
    content: `---META---
TITULO: La Enfermera en Zendity
PROMPT_ZENDI: Evalúa si sabe entrar por Enfermería y resolver lo que hay: cerrar un cambio del piso dentro de las 48 horas, mover el reloj correcto de una úlcera, hacer una hoja de Downton, y distinguir lo que puede parar en el eMAR de lo que no.
TERMINOS_CLAVE: Enfermería, Rotación / UPP, Caídas, Cambios del piso, Suspendido, Omitir, Indicación médica, Curación, Cambié el apósito, Verifiqué la úlcera, plan del home care, Escala Norton, Downton, Braden, Med & Zoning, declarar la úlcera
PREGUNTA_REFLEXION: Piensa en el último residente cuya piel te preocupó. ¿Por dónde te enteraste: por una pantalla, o porque alguien te lo dijo en el pasillo? ¿Qué habría pasado ese día si nadie te lo hubiera dicho?

---SECCION_1---
LECTURA:
# La puerta de enfermería, y lo que de verdad te llega

En Zendity no hay un módulo llamado "/nursing" donde esté todo junto. Esa ruta no existe: si la escribes, da 404. Lo que hay son varias pantallas sueltas, cada una con su nombre en el menú de la izquierda.

Estas son las tuyas:

| En el menú dice | Qué se hace ahí |
|---|---|
| **Enfermería** | La lista de lo que espera una decisión tuya |
| **Rotación / UPP** | Rotación cada 2 horas, úlceras y reportes de piel |
| **Caídas** | La hoja de Downton y las caídas de 90 días |
| **Cambios del piso** | Lo que el piso notó y espera respuesta |
| **Lo que Zendi encontró** | Lo que Zendi ve leyendo las notas. La pantalla avisa: "No son hechos: son preguntas" |
| **Med & Zoning** | Las recetas: autorizar, editar, descontinuar |
| **Auditoría eMAR** | Los medicamentos del día, residente por residente |
| **Catálogo Farmacia** | El catálogo del hogar, con sus alertas clínicas |
| **Reportes de Turno** | Los relevos que firmó el piso |

## Enfermería es la puerta, no el cuarto

**Enfermería** no es un tablero: es una lista de trabajo. Cada línea trae un número, una frase que dice qué pasa si nadie la mira, y un enlace a la pantalla donde se resuelve. Lo más urgente arriba, en rojo.

| La línea, tal como se lee | Te lleva a |
|---|---|
| Rotaciones vencidas | Rotación / UPP |
| Úlceras sin curación registrada | Rotación / UPP |
| Úlceras que nadie ha mirado | Rotación / UPP |
| PRN sin saber si hizo efecto | La tableta |
| Cambios del piso que pasaron el plazo | Cambios del piso |
| Relevos de turno sin aceptar | Reportes de Turno |
| Riesgo de caída sin evaluar o vencido | Caídas |
| Planes de cuido sin resolver | Life Plan (PAI) |

Y si tres o más residentes traen lo mismo, se añade una línea más, roja: "3 residentes con lo mismo en piel", y debajo lo que comparten — "todos del grupo BLUE, todos en la planta 2".

**Ahí no salen los nombres.** Para saber quiénes son hay que entrar a Cambios del piso, que es donde la banda sí los pone uno a uno. Y tampoco va siempre arriba del todo: es urgencia alta, igual que otras cuatro líneas, y dentro del rojo manda la cantidad. Unas rotaciones vencidas con más casos le quedan por encima.

**Nada se tacha a mano.** Cada número sale de una consulta contra la realidad y desaparece solo cuando el trabajo está hecho de verdad. No hay botón de "atendido", y no lo hay a propósito: una lista que se puede tachar sin hacer el trabajo es peor que no tenerla.

Con una excepción, y hay que sabérsela: la línea de los PRN se cuenta dentro de una ventana de 12 horas y se vacía sola al pasarla, haya contestado alguien o no. Está explicada en la sección 2.

Cuando no queda nada, la pantalla dice **Todo al día** y debajo "Se revisaron 8 frentes y ninguno tiene trabajo pendiente". Esa segunda frase está puesta a propósito: sin ella, "todo al día" podría significar que no se comprobó nada.

![La pantalla Enfermería: cada línea con su número, la frase que dice qué pasa si nadie la mira, y el enlace. Rojo arriba, ámbar en medio, gris abajo.](/academy/capturas/enfermeria-lista-de-trabajo.jpg)

## El relevo normal no pasa por ti

Esto se malentiende mucho, así que va directo. El relevo lo cierra quien abrió el turno **en el piso** —una cuidadora— desde el botón **Entregar Turno** de su tableta.

| Lo que SÍ pasa | Lo que NO pasa |
|---|---|
| Firma una sola persona: la que sale | No hay segunda firma de quien entra, ni tuya |
| El relevo queda cerrado en cuanto ella firma | Ese no te llega a ti para que lo aceptes |
| Tú lo lees en **Reportes de Turno** | No hay relevo de enfermera a enfermera: en el hogar hay una sola |

La propia pantalla se lo dice a la cuidadora al firmar: "Después de firmar, tu reporte se envía al supervisor. El próximo cuidador también lo verá al entrar." Son tres pasos, no dos firmas.

## La excepción: el que cerró el supervisor

Todo lo de arriba vale para el relevo normal. Hay otro que **sí espera una firma tuya**, y es justo el que sale en tu lista.

Cuando una cuidadora se va sin entregar el turno, el supervisor lo cierra por ella. Ese relevo nace **sin firmar**, y es lo que suma en la línea **Relevos de turno sin aceptar**. En Reportes de Turno se reconocen por su etiqueta ámbar: "Pendiente firma supervisor".

Firmar un relevo es de supervisión y dirección. En el hogar la enfermería la hace una **DIRECTOR**, así que esa cola es tuya: se entra por Reportes de Turno, se abre el relevo y abajo está **Firmar Reporte**. Al 06-sep-2026 había 62 esperando, el más viejo del 9 de junio — tres meses parados porque la pantalla no dejaba entrar a la única persona que podía firmarlos.

PREGUNTAS:
P: ¿Dónde está la lista de lo que espera una decisión de enfermería?
a) En el módulo /nursing, que junta todo lo clínico en una sola pantalla
*b) En el menú, en Enfermería
c) En Auditoría eMAR, en la ronda de las 8:00 AM
d) En el Cardex del residente
EXPLICACION: No existe ninguna ruta /nursing. La lista vive en Enfermería, y lo que el menú llama Rotación / UPP es otra pantalla distinta.

P: La línea "Rotaciones vencidas" trae un 2. ¿Cómo desaparece ese 2?
a) Tocando la línea, que la marca como atendida
b) Escribiendo en la nota que ya se revisó
c) Solo: la lista se pone en cero a medianoche
*d) Cuando esos dos residentes queden rotados de verdad
EXPLICACION: Cada número sale de una consulta contra la realidad, así que no hay forma de bajarlo sin hacer el trabajo.

P: El menú dice "Rotación / UPP". ¿Cómo se titula esa pantalla al entrar?
*a) Piel, úlceras y rotación
b) Dashboard clínico de enfermería
c) Protocolo de prevención de úlceras por presión
d) Auditoría eMAR
EXPLICACION: Son la misma pantalla con dos nombres, y ahí solo se hacen esas tres cosas: piel, úlceras y rotación postural.

P: ¿Cuál de estos relevos espera una firma tuya?
a) El que firmó la cuidadora al entregar su turno
b) Ninguno: firmar relevos no es de enfermería
*c) El que cerró el supervisor por una cuidadora ausente
d) Todos, antes de que los vea el supervisor
EXPLICACION: El que firma quien sale queda cerrado ahí mismo y tú solo lo lees. El de cierre forzado nace sin firmar, es el que cuenta la línea "Relevos de turno sin aceptar", y firmarlo es de supervisión y dirección — o sea, tuyo.

P: Entras a Enfermería y no hay ninguna línea. Debajo de "Todo al día" dice "Se revisaron 8 frentes". ¿Para qué está esa frase?
a) Para contar los residentes revisados hoy
*b) Para que "todo al día" no pueda significar que no se comprobó nada
c) Para decir cuántos minutos lleva abierta la pantalla
d) Para avisar de que quedan ocho cosas por abrir
EXPLICACION: Un cero sin decir cuántas cosas se miraron no distingue entre "no hay trabajo" y "no se midió nada".

---SECCION_2---
LECTURA:
# Medicamentos: qué puedes parar y qué no

La palabra HELD no aparece en ninguna pantalla de Zendity. Lo que se ve es una etiqueta gris que dice **Suspendido**, y aparece en una toma concreta, en un horario concreto.

## De dónde sale esa etiqueta

De la tableta, en **Medicamentos** dentro de la tarjeta del residente. Quien va a dar la dosis toca **Omitir**, escoge un motivo de una lista de siete y escribe el detalle, mínimo diez caracteres. **El motivo decide cómo queda la toma:**

| Motivo de la lista | Cómo queda |
|---|---|
| Residente lo rechazó | Rechazado |
| Medicamento no disponible | Omitido |
| **Residente en procedimiento** | **Suspendido** |
| **Indicación médica** | **Suspendido** |
| Fuera del hogar (hospital, cita, salida) | Omitido |
| Residente falleció | Omitido |
| Otro | Omitido |

Solo esos dos producen Suspendido. Y lo escribe quien registra la dosis, que casi siempre es una cuidadora — no hace falta que pases tú, y no hay nada que "liberar" después.

| Lo que SÍ significa Suspendido | Lo que NO significa |
|---|---|
| Esa toma no se dio y la razón no es una falta del piso | No es un estado del medicamento |
| Queda con su motivo y su texto en el expediente | No bloquea la toma siguiente: esa se firma con normalidad |
| Se pinta en gris y no en rojo | No avisa a la familia. A la familia la llamas tú |

**Leelo otra vez: marcar una toma como Suspendida no detiene el medicamento.** Si quieres que no se dé la dosis de las 12:00, hay que decirlo en el piso o quitar la receta en Med & Zoning.

## La trampa de los signos vitales

Unos signos vitales fuera de rango **no están en la lista**. Si la presión sale 82/50 y se para el antihipertensivo, quien lo registre solo encuentra "Otro" — y "Otro" queda como **Omitido**, o sea contado como falta del piso.

Si la decisión es clínica y es tuya, el motivo que corresponde es **Indicación médica**. La presión va en el detalle, que es lo que después se lee.

![El pack de las 8:00 de Rosa Medina: el botón OMITIR al lado del medicamento, todavía sin pulsar, una sola firma para todo el pack, y abajo Registrar dosis PRN. Los siete motivos viven detrás de ese botón y no salen en la foto: son los de la tabla de arriba.](/academy/capturas/care-pack-meds.jpg)

## Controlados: no hay doble verificación

Zendity no pide nada distinto para un narcótico o una benzodiacepina. La misma firma única del pack, un solo autor, sin testigo ni segunda confirmación. No existe ese campo.

Lo único que Zendity hace con un controlado es pintar el rótulo **Controlado** junto al nombre en la tableta. Ese rótulo sale de una casilla del **Catálogo Farmacia**: "Droga Controlada (Psicotrópico/Narcótico)". Medido el 05-sep-2026: de 197 medicamentos del catálogo, cero están marcados — incluidos Clonazepam y Lorazepam. El rótulo existe y no se ha visto nunca, porque nadie ha marcado la casilla.

## Cómo te enteras, y qué es tuyo

- **Toda omisión te avisa en el momento.** El aviso llega a enfermería y a supervisión y dice: residente, medicamento, hora, razón y quién lo hizo.
- **Los PRN te vuelven, y por poco rato.** Un PRN se da para algo y hay que decir si hizo efecto. Entra en tu lista como "PRN sin saber si hizo efecto" **en cuanto se registra la dosis**, y sale de ella **a las 12 horas**, haya contestado alguien o no. No esperes al corte: al pasarlo, lo que buscabas ya no está, y no hay ninguna otra pantalla que liste los viejos. Es la única línea de Enfermería que se puede vaciar sin que nadie haya hecho el trabajo.
- **Las recetas son tuyas, la administración no.** En **Med & Zoning**, lo que se capturó en el ingreso aparece en un recuadro ámbar, "Del ingreso, sin autorizar", y **no llega a la tableta** hasta que alguien pulsa **Revisar y autorizar**. El modal lo dice: "Esto la pone en la tableta. Comprueba la hora y los días antes de firmar." Cada cambio pide **Razón Obligatoria (HIPAA)** y se guarda con **Aplicar Sello**.

PREGUNTAS:
P: En la tableta, una toma sale con la etiqueta gris "Suspendido". ¿De dónde salió esa etiqueta?
a) De un cambio de estado en el eMAR
b) De una orden que escribió el médico
*c) Del motivo que eligió quien registró esa toma en la tableta
d) De un bloqueo por signos vitales fuera de rango
EXPLICACION: Suspendido es el resultado de escoger "Residente en procedimiento" o "Indicación médica" al omitir; no hay ninguna pantalla donde se cambie el estado de un medicamento.

P: La toma de las 8:00 quedó Suspendida. ¿Qué pasa con la de las 12:00?
*a) Se puede firmar con normalidad
b) Queda bloqueada para el piso
c) Se administra a media dosis mientras dure la suspensión
d) Se salta sola y sale como omitida al cerrar el turno
EXPLICACION: Suspendido describe una dosis, no el medicamento. Si de verdad hay que parar el tratamiento, se avisa en el piso y se toca la receta en Med & Zoning.

P: Decides parar un antihipertensivo porque la presión salió 82/50. ¿Qué motivo hay que escoger?
a) Otro, y explicar la presión en el detalle
b) Residente lo rechazó
c) Medicamento no disponible
*d) Indicación médica
EXPLICACION: "Signos vitales fuera de rango" no existe en la lista, y "Otro" deja la toma como Omitido, o sea como falta del piso. La presión se escribe en el detalle.

P: Le toca Lorazepam a un residente. ¿Qué pide Zendity de más por ser un controlado?
a) Doble verificación
*b) Nada distinto
c) Autorización escrita del director de la sede
d) Un conteo de inventario al cerrar cada turno
EXPLICACION: No hay doble verificación en ninguna parte del sistema: una sola firma y un solo autor. Lo único propio de un controlado es el rótulo de la tableta, y depende de una casilla del Catálogo Farmacia.

P: Una receta capturada en el ingreso sale en Med & Zoning con el recuadro ámbar "Del ingreso, sin autorizar". ¿Qué le falta?
*a) Que alguien con permiso la revise y la autorice en esa pantalla
b) Que la farmacia confirme el despacho
c) Que la familia lo consienta en su portal
d) Que pase la noche y se active sola
EXPLICACION: Mientras esté en borrador no aparece en la tableta y nadie se la va a dar. Se autoriza con Revisar y autorizar, comprobando antes la hora y los días.

---SECCION_3---
LECTURA:
# Piel, úlceras y rotación

Menú **Rotación / UPP**. Es la pantalla que más vas a abrir, pero no es la única por donde se toca una úlcera: la ficha también se declara desde **Cambios del piso** (sección 4), y el cambio de apósito lo registra la cuidadora desde su tableta.

**Aquí la cuidadora no entra.** Rotación / UPP es de enfermería, supervisión y dirección: a una CAREGIVER el servidor le contesta 403 y el menú ni le enseña el enlace. Si le dices a tu equipo que venga a esta pantalla a apuntar el apósito, las trece se topan con una puerta cerrada.

## Los seis estados de la rotación

| Chip | Qué dice |
|---|---|
| **A tiempo** | Menos de 2 horas desde el último cambio de posición |
| **En ventana** | Entre 2 horas y 2 horas y cuarto. Todavía no es falta |
| **Vencido** | Pasaron más de 2 horas y cuarto |
| **Sin registro** | Nadie le ha registrado una rotación nunca |
| **Riesgo Norton — sin orden** | La escala dice riesgo y no hay orden de rotar |
| **En hospital** | No está en el edificio. Fuera del conteo |

Los dos últimos no son faltas. **Riesgo Norton — sin orden** te pide una decisión y te da los dos botones ahí mismo: "Norton dice que hay riesgo. ¿Necesita rotación cada 2 h?" con **SÍ, ROTARLO** y **NO HACE FALTA**. Si dices que no, sigue visible pero deja de contar como vencido.

Un aviso sobre el nombre: la pastilla dice **Norton**, pero el número que la enciende es el **Braden** que se puso en el ingreso. Es el mismo dato con dos nombres. No busques una escala Norton aparte: no existe.

![Arriba, los seis contadores, uno por estado. En la lista se ven cinco: Pedro Santana en ventana, Carmen Delgado sin registro, Luis Ortega a tiempo, Elena Figueroa en Riesgo Norton sin orden con los dos botones, y Ramón Quiñones en hospital. Falta el sexto, el Vencido, que es el que pide trabajo: en la pantalla va el primero de todos, por encima de Pedro, y en esta foto quedó fuera del recorte.](/academy/capturas/enfermeria-rotacion-seis-estados.jpg)

Arriba del todo, en fucsia, está lo que el piso vio y nadie ha decidido: "N reportes de piel sin decidir — ¿es úlcera o no?", cada uno con su botón **Revisar**. Y en la cabecera tienes **Declarar úlcera**, para cuando la ves tú y nadie la reportó primero.

## La úlcera tiene dos relojes

Se toca la etiqueta de la úlcera y se abre su modal. Arriba, los dos relojes separados:

| Reloj | Qué mide | Los dos avisan a los |
|---|---|---|
| **Curada hace N días** | Cuándo se aplicó el tratamiento del plan | 7 días |
| **Vista hace N días** | Cuándo la miró alguien con criterio clínico | 7 días |

Siete días para todas, también para una estadio 4. Se preguntó expresamente si una úlcera profunda necesita menos y el hogar dijo que no.

## Tres registros distintos, y lo que mueve cada uno

| Botón | Qué es | Quién | Reloj que mueve |
|---|---|---|---|
| **Curación** | El tratamiento del plan del home care | Enfermería y dirección | Los dos |
| **Cambié el apósito** | Limpiar y tapar antes de que ella venga | La cuidadora, desde su tableta | Ninguno |
| **Verifiqué la úlcera** | Alguien con criterio la miró y dice cómo va | Enfermería y dirección | Solo "Vista" |

Esa separación es el corazón de la pantalla. Si un cambio de apósito contara como curación, el reloj se reiniciaría y nadie se enteraría de que la herida lleva semanas sin que la trate quien debe.

## El plan no lo pones tú

**El plan lo establece el home care, que es de fuera.** En Zendity solo se transcribe, y se escribe quién lo puso. Si falta, el modal lo dice con todas las letras: "Esta úlcera no tiene el plan del home care escrito", con el botón **Escribir el plan**.

Desde ese mismo modal sale **Descargar el formulario para el home care**: una hoja en papel con el residente y su úlcera ya puestos, para que la enfermera de fuera escriba el plan y la firme.

![El modal de la úlcera de Rosa Medina: sacro estadio 3, Curada hace 9d en rojo y Vista hace 9d en ámbar, el plan del home care con quién lo puso, y los motivos del cambio de apósito.](/academy/capturas/enfermeria-curacion-plan.jpg)

## Estadios y cierre

Los estadios se marcan del 1 al 4 y solo los cambian enfermería y dirección: I, piel intacta con enrojecimiento que no palidece; II, pérdida parcial de la piel; III, pérdida total del espesor; IV, con músculo, hueso o tendón a la vista.

Para cerrarla hay dos salidas: **Sanó**, cuando la herida cerró, y **Se cerró sin sanar**, que pide el motivo — falleció, salió del hogar, pasó al hospital u otra razón. Esa segunda existe para no tener que escribir en un expediente que una herida sanó cuando lo que pasó es que el residente se fue.

Y lo que el piso te manda solo: excremento sobre una úlcera estadio 3 o 4, y tres cambios de apósito en 24 horas.

PREGUNTAS:
P: La tarjeta de un residente sale con el chip "En ventana". ¿Qué quiere decir?
*a) Pasaron entre dos horas y dos horas y cuarto
b) Que la ventana de vitales de entrada sigue abierta
c) Que está en la lista pero no necesita rotación
d) Que la rotación la registró otro grupo de color
EXPLICACION: El objetivo son 120 minutos y hay quince de tolerancia; pasados los 135 el chip cambia a Vencido.

P: Una cuidadora registra "Cambié el apósito" en la úlcera de Rosa Medina desde su tableta. ¿Qué reloj se reinicia?
a) El de "Curada hace", porque se tocó la herida
b) Los dos, que van siempre juntos
*c) Ninguno
d) El de "Vista hace", porque alguien la miró
EXPLICACION: Limpiar y tapar no es la curación del plan ni es una valoración clínica. Si contara, el sistema diría que la herida se trató sin que nadie con criterio la mirara.

P: La pastilla de un residente dice "Norton". ¿De dónde sale ese riesgo?
a) De una escala Norton que se aplica cada seis meses
*b) Del Braden que se puso en el ingreso
c) De las caídas que ha tenido en los últimos noventa días
d) Del último cambio de posición que le registraron
EXPLICACION: El campo se llama Norton y se llena con el Braden del paso 3 del ingreso. No hay ninguna pantalla donde se aplique una escala Norton.

P: Una úlcera lleva "Curada hace 9d". ¿Qué hace falta para que ese reloj vuelva a cero?
a) Que alguien cambie el apósito y lo registre
b) Que se escriba el plan del home care en el modal
c) Que la verifiques y digas cómo va
*d) Que se aplique el tratamiento del plan y se registre como curación
EXPLICACION: Solo la curación mueve ese reloj. Verificarla mueve el otro, el de "Vista hace", y el cambio de apósito no mueve ninguno.

P: Un residente con una úlcera abierta falleció. ¿Cómo se cierra esa úlcera?
a) Marcándola como resuelta, que es la única salida
b) Dejándola abierta hasta que dirección cierre el expediente
*c) Con "Se cerró sin sanar" y su motivo
d) Borrando la ficha del módulo de úlceras
EXPLICACION: Dar por resuelta la úlcera de alguien que murió es escribir en el expediente que la herida sanó. Por eso hay una segunda salida con motivo obligatorio.

---SECCION_4---
LECTURA:
# Cambios del piso: lo que vieron y espera tu respuesta

Menú **Cambios del piso**. Aquí cae lo que una cuidadora notó y todavía no es una emergencia: se mueve distinto, come o bebe distinto, más confundido, ánimo o conducta, piel, dolor, duerme distinto, continencia, otra cosa.

## El plazo son 48 horas

Decidido el 10-sep-2026, sobre esto medido: 22 cambios reportados en 30 días, once revisados y once sin revisar, con una mediana de cinco días hasta mirarlos. Y de los once resueltos, diez fueron accionables. **El piso reporta bien; lo que fallaba es que la mitad no la miraba nadie.**

Pasadas las 48 horas la línea de Enfermería sube de ámbar a rojo y dice cuánto lleva esperando el más viejo. Lo más viejo va arriba, y a los tres días la tarjeta se pone en ámbar.

## Revisar: cuatro decisiones, y una respuesta que se escribe sola

| Botón | Qué dice debajo |
|---|---|
| **Actualicé el expediente** | El cambio era real y el expediente ya lo refleja |
| **Queda en observación** | Todavía no hay suficiente para cambiar nada. Se vigila |
| **Referido a médico** | Se le manda la consulta al médico por correo |
| **Revisado, sin cambio** | Se miró y no procede |

Al escoger, aparece un recuadro teal que dice "[quien lo reportó] va a recibir" y debajo la frase exacta que le va a llegar. **Esa frase la escribe el sistema**, la escojas o no; el cuadro de texto de abajo es solo para lo que haga falta añadir esta vez. El botón final es **Cerrar y avisar**.

Por qué se escribe sola: los nueve primeros reportes de piel se cerraron sin una sola respuesta escrita. No por descuido — escribir nueve veces lo mismo no lo hace nadie.

**Ojo con "Referido a médico".** En Zendity no hay médico: no existe la figura, ni hay aviso automático que le llegue. Significa que enfermería o administración le manda la consulta por correo y él contesta con instrucciones, con tratamiento, o lo deja para su próxima visita. Si tú no mandas ese correo, no lo manda nadie.

## Cuando es piel

Si el área es **Piel**, encima de las cuatro decisiones sale un botón rojo: **Esto es una úlcera — declararla**. Pide dónde está y el estadio, y declara la ficha y cierra el reporte en el mismo gesto. La ficha se abre con la fecha en que el piso lo reportó, no con la de hoy, para que los relojes no arranquen en cero.

Existe porque pasó al revés once veces en Cupey: once residentes con úlceras escritas en notas de turno y cero fichas en el módulo. Uno de ellos terminó en el hospital por una úlcera que el sistema no sabía que existía.

![La tarjeta de piel de Rosa Medina abierta: el botón rojo por encima de las cuatro decisiones normales, y abajo Cerrar y avisar.](/academy/capturas/cambios-ulcera.jpg)

## El patrón no espera el plazo

Cuando tres o más residentes distintos traen lo mismo en la misma área dentro de las 48 horas, sale una banda roja arriba del todo con sus nombres y con lo que comparten: "todos del grupo BLUE, todos en la planta 2".

Tres o más en la misma área no había pasado nunca en el histórico del hogar. Once personas con piquiña el mismo día en la misma planta no son once observaciones: es sarna, un detergente nuevo o algo de la lavandería. Cuál sea lo dices tú; que hay algo lo dice el sistema.

PREGUNTAS:
P: ¿Cuánto tiempo tiene enfermería para mirar un cambio reportado desde el piso?
a) El mismo turno en que se reportó
b) Una semana
c) Hasta el próximo relevo de la mañana
*d) 48 horas
EXPLICACION: Son dos turnos y margen, y siguen siendo un aviso temprano. Pasadas las 48 horas la línea de Enfermería se pone roja y dice cuánto lleva el más viejo.

P: Cierras un cambio con "Referido a médico". ¿Qué hace Zendity con eso?
a) Le manda la consulta al médico por correo automáticamente
*b) Nada: el correo lo mandas tú
c) Abre una cita en la agenda del médico de la sede
d) Deja la tarjeta abierta hasta que el médico conteste
EXPLICACION: No hay médico dentro del sistema ni notificación que le llegue. El botón deja constancia de la decisión y le avisa a quien lo reportó; la consulta sale de tu correo.

P: Una cuidadora reporta enrojecimiento en un talón que no se aclara. Lo miras y es una úlcera. ¿Qué botón usas?
a) Actualicé el expediente, y después abres la ficha aparte
b) Referido a médico, para que él la declare
*c) Esto es una úlcera — declararla
d) Revisado, sin cambio, y lo apuntas en la bitácora
EXPLICACION: Declarar y cerrar son el mismo gesto a propósito: cerrar con "actualicé el expediente" deja la nota resuelta y la úlcera sin existir.

P: Tres residentes traen lo mismo en piel el mismo día. ¿Qué hace la pantalla?
*a) Saca una banda roja arriba con los tres nombres y lo que comparten
b) Los ordena juntos al final de la lista
c) Espera a que pasen las 48 horas de los tres
d) Los cuenta como tres tarjetas normales
EXPLICACION: Tres líneas iguales en una lista se leen como tres cosas pequeñas. La banda dice el grupo y la planta, que es por donde se empieza a buscar.

P: Cierras un cambio y no escribes nada en el cuadro de texto. ¿Qué recibe quien lo reportó?
a) Nada, porque el cuadro estaba vacío
b) Solo la etiqueta de la decisión, sin más
c) Un aviso de que su reporte se archivó sin revisar
*d) La frase que la pantalla te enseñó antes de cerrar
EXPLICACION: La respuesta va siempre, escrita por el sistema. El cuadro es para lo que solo esta vez hace falta añadir.

---SECCION_5---
LECTURA:
# Las dos escalas, y dónde vive cada una

Hay una pantalla donde están juntas: el **paso 3 del ingreso**, con los dos deslizadores uno encima del otro — "Riesgo de Caídas · Escala Downton" arriba y "Riesgo UPPs (Úlceras) · Escala Braden" debajo. Fuera de ahí no vuelven a coincidir: cada una vive en su sitio, se usa distinto y una de las dos no se puede repetir.

Y esa pantalla compartida esconde una trampa que conviene ver antes de seguir: **el Downton del ingreso no es la hoja de Downton.** Es un deslizador que alguien mueve a ojo. La hoja de once preguntas está en Caídas y es otra cosa. Los dos escriben la misma marca de riesgo de caída del residente, y manda el último que se guardó — así que cuando los dos números no cuadren, ya sabes por qué: no estás mirando el mismo instrumento.

## Downton: en el menú Caídas

Entras a **Caídas** y lo primero es el bloque "Riesgo de caída" con cuatro contadores: **Sin evaluar**, **Alto**, **Moderado** y **Bajo**. Sin evaluar va primero y es su propia categoría: quien no ha sido evaluado no es de riesgo bajo, es alguien de quien no se sabe.

Cada nombre es un botón. Se toca y se abre la hoja: **once sí/no**, agrupados.

| Grupo | Ítems |
|---|---|
| Caídas previas | Ha tenido caídas antes |
| Medicamentos | Tranquilizantes o sedantes, diuréticos, hipotensores que no sean diuréticos, antiparkinsonianos, antidepresivos |
| Déficits sensoriales | Alteraciones visuales, alteraciones auditivas, extremidades afectadas |
| Estado mental | Confuso o desorientado |
| Deambulación | Camina inseguro, con ayuda o sin ella |

El puntaje se suma a la vista mientras contestas, y abajo la pantalla dice: **"Desde 3 es riesgo alto. Se repite en 6 meses."** Los niveles son tres: 0 es bajo, 1 o 2 es moderado, 3 o más es alto.

![La hoja de Downton de Carmen Delgado: los once sí/no por grupos y, abajo, el puntaje en vivo con "Desde 3 es riesgo alto. Se repite en 6 meses".](/academy/capturas/caidas-downton-hoja.jpg)

**Si el residente está encamado, la hoja te lo avisa arriba.** No va a marcar deambulación, así que el puntaje sale un punto más bajo sin que esté mejor. Su riesgo está en los traslados, la baranda y la altura de la cama, y esta escala no pregunta por eso: va en la nota. En Cupey los ocho encamados no se han caído nunca, y cuatro tienen úlcera. El riesgo no desapareció, se mudó.

Al guardar, la pantalla te ofrece **Imprimir la hoja** y **Seguir con el siguiente**, y deja puesta la próxima revisión a seis meses.

| Lo que SÍ pasa al guardar | Lo que NO pasa |
|---|---|
| Queda la evaluación con su puntaje y su nivel | No sale ninguna alerta a las cuidadoras |
| Se marca la próxima revisión a 6 meses | No se activa ningún protocolo dentro de Zendity |
| Sale de la lista de "sin evaluar" | No aparece checklist de barandas ni de iluminación |

Las barandas, el calzado, la luz y la ayuda en los traslados siguen siendo lo correcto y hay que hacerlas. Lo que hay que saber es que **Zendity no las pide y no avisa a nadie**: eso lo dices tú en el piso.

## Braden: solo en el ingreso

La Escala Braden existe en un único sitio de todo Zendity: el paso 3 del ingreso, **Plan de Vida (PAI) y Riesgos**. Es un deslizador, y comparte columna con el de Downton. Así quedan los dos:

| | Riesgo de Caídas | Riesgo UPPs (Úlceras) |
|---|---|---|
| Escala | Downton | Braden |
| Rango del deslizador | 0 a 6 | 6 a 23 |
| Se pinta en rojo | Por encima de 2 | **Por debajo de 14** |
| Qué enciende | La marca de riesgo de caída del residente | La pastilla "Norton" de Rotación / UPP |

**Ese 0 a 6 es del deslizador, no de la escala.** La hoja que rellenas en Caídas tiene once preguntas de un punto y se puntúa sobre once: la pantalla lo escribe así, "5 / 11". Un 5 ahí no está cerca del techo, está por la mitad — y ya es riesgo alto, porque el corte de la hoja está en 3. Quien lea el 5 contra un techo de 6 va a creer lo contrario de lo que pasa.

**El corte es 14, no 18.** Un residente con Braden 16 sale en teal, no entra en el protocolo de rotación y no enciende ninguna pastilla. Si esperas que el sistema te avise por debajo de 18, no te va a avisar.

Y no hay dónde volver a escribirlo: el Braden se escribe una vez, en el ingreso, y no existe ninguna pantalla que lo reevalúe. **La única reevaluación periódica que sí existe es la de Downton, y es cada 6 meses.**

PREGUNTAS:
P: Terminas la hoja de Downton de un residente y la pantalla escribe "4 / 11". ¿Qué nivel dice?
a) Riesgo moderado
*b) Riesgo alto
c) Riesgo bajo
d) Riesgo crítico
EXPLICACION: El corte está en 3: de ahí para arriba es alto. Con 1 o 2 sería moderado, y crítico no es un nivel de esta escala.

P: Evalúas a un residente encamado y saca 2 puntos. ¿Qué hay que tener en cuenta?
a) Que la escala no aplica a los encamados y no hace falta hacerla
b) Que su puntaje hay que subirlo un punto a mano
c) Que su riesgo es bajo de verdad, porque no camina
*d) Que nunca marcará deambulación, y su riesgo no es caminar
EXPLICACION: El puntaje sale un punto más bajo sin que esté mejor. Su riesgo está en los traslados, la baranda y la altura de la cama, y eso va escrito en la nota.

P: Guardas una evaluación de Downton con riesgo alto. ¿Qué pasa en el piso?
*a) Nada, hasta que lo avises tú
b) Las cuidadoras reciben una alerta en su tableta
c) Se abre un checklist de barandas e iluminación
d) El residente entra solo en el protocolo de rotación
EXPLICACION: Guardar la hoja crea la evaluación y marca la próxima revisión, y ahí se acaba. Las medidas de prevención son correctas, pero el sistema ni las pide ni las comunica.

P: ¿En qué pantalla de Zendity se aplica la Escala Braden?
a) En Rotación / UPP, junto a la pastilla Norton
b) En Caídas, debajo de la hoja de Downton
*c) En el paso 3 del ingreso, y en ningún otro sitio
d) En el expediente, en la pestaña de úlceras
EXPLICACION: Es un deslizador del asistente de admisión. Después del ingreso no hay ninguna pantalla que lo vuelva a escribir.

P: Un residente tiene Braden 16. ¿Qué hace Zendity con ese número?
a) Lo marca en rojo y lo mete en el protocolo de rotación
*b) Nada: el corte está en 14
c) Avisa a enfermería de que cruzó el umbral de riesgo
d) Programa una reevaluación para dentro de una semana
EXPLICACION: A 16 el deslizador sale en teal y no enciende la pastilla Norton. Si a ti te preocupa ese residente, la orden de rotación se pone a mano en Rotación / UPP.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 11: EL DIRECTOR EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'DIRECTOR_101',
    title: 'El Director en Zendity',
    description: 'Vision ejecutiva de Zendity para directores: activacion clinica, compliance, CRM y supervision remota.',
    durationMins: 35,
    bonusCompliance: 10,
    emoji: '🏛️',
    category: 'Roles y Acceso',
    order: 2,
    content: `---META---
TITULO: El Director en Zendity
PROMPT_ZENDI: Evalúa si el director sabe abrir su panel y leer sus métricas y su briefing, confirmar un ingreso con sus dos bloqueos reales, destrabar el color de ruta y los medicamentos del ingreso, y distinguir lo que Zendity le avisa, lo que le manda por correo y lo que tiene que ir a mirar.
TERMINOS_CLAVE: Dashboard Gerencial, Zendi Director Briefing, Regenerar, Resumen Ejecutivo, Cumplimiento Salud, Scorecard de Sedes, Facility Health, En este momento, Intake Maestro, Confirmar ingreso, cuota mensual, BAA, Acuerdos, color de ruta, Del ingreso sin autorizar, Revisar y autorizar, Baja Definitiva, Señalamientos de familia
PREGUNTA_REFLEXION: Piensa en la última decisión que tomaste sobre el hogar esta semana. El número en el que te apoyaste, de dónde salió: lo viste tú en una pantalla, o te lo dijo alguien?

---SECCION_1---
LECTURA:
# Tus dos pantallas: Insights y el Dashboard Gerencial

Como director entras por **Insights** —la pantalla de inicio, la del título "Zendity Insights"— y trabajas en **Dashboard Gerencial**, que en el menú lateral se llama **Dashboard Global**.

## Lo que tienes en Insights

Tres botones arriba a la derecha, y los tres son botones: no llega nada solo.

| Botón | Qué hace |
|---|---|
| **Sala de Enfermería** | Abre la bandeja de mensajes con las familias |
| **Generar Censo** | Te descarga el censo del momento |
| **Resumen Ejecutivo** | Se despliega en tres opciones y te baja un PDF |

El menú de **Resumen Ejecutivo** tiene **Día (hoy)** —desde las 6:00 AM AST—, **Última semana** y **Último mes**. Eliges uno, la aplicación lo arma en ese momento y te lo descarga. **No se envía solo, no se guarda en ninguna bandeja y nadie lo genera por ti.** Si quieres el resumen del mes para una inspección, entras y lo bajas.

## El Dashboard Gerencial

![El Dashboard Gerencial entero: arriba los botones de sede y los accesos a Chats Familiares, Chat Staff, RRHH y Triage; debajo el briefing de Zendi, la fila de KPIs y los chips de En este momento. La foto está tomada en un hogar de una sola sede: por eso la fila enseña tres tarjetas y no cuatro.](/academy/capturas/director-panel.jpg)

Arriba del todo, los **botones de sede**: "Todas" y uno por cada sede. Lo que marques cambia **todo lo que hay debajo** —el briefing, los KPIs y los chips—. Es el primer sitio donde mirar cuando un número no cuadra: puede que estés viendo la otra sede, o las dos sumadas.

Al lado, cuatro accesos: **Chats Familiares**, **Chat Staff**, **RRHH** y **Triage**.

## Las tarjetas de arriba

| Tarjeta | Lo que SÍ dice | Lo que NO dice |
|---|---|---|
| **Sedes Activas** | Cuántas sedes entran en lo que estás mirando, y las camas que suman | No aparece si solo hay una |
| **Residentes Actuales** | La matrícula: cuenta también a los que están en el hospital | No es cuántos hay físicamente en el piso hoy |
| **Incidentes Serios** | Los del periodo que lleva escrito en el propio rótulo | No es el total histórico |
| **Cumplimiento Salud** | El porcentaje global de eMAR de la sede | No es la nota de ninguna persona |

La primera tarjeta es condicional: **solo se pinta cuando el ámbito que tienes marcado tiene más de una sede.** Con "Todas" puesto, en Vivid son cuatro tarjetas; si marcas Cupey sola, son tres. No es un fallo de carga: es que con una sede el número no significaba nada y se quitó.

**Cumplimiento Salud** es medicación administrada sobre medicación pautada, de la sede entera. Debajo trae la semana actual y la anterior para que se puedan comparar.

## Y más abajo, el Scorecard de Sedes

No es la única nota de la facilidad que hay en esta pantalla. Bajando está el **Scorecard de Sedes**, una fila por sede con Ocupación, **Facility Health**, Score RRHH, Satisfacción Familiar y eMAR.

**Facility Health** es otra cosa distinta de Cumplimiento Salud: una puntuación de 0 a 100 por sede, con su grado —**EXCELENTE** desde 90, **BUENO** desde 75, **ALERTA** desde 55 y **CRITICO** por debajo—. Parte de 100 y baja por úlceras activas, caídas graves de los últimos treinta días, quejas pendientes, relevos que faltan hoy y cumplimiento de eMAR por debajo del 80 por ciento. Sube cinco si la semana va sin incidentes.

Conviene saber de dónde sale, porque es el único sitio de la pantalla donde tu sede lleva **una palabra pegada** —ALERTA, CRITICO— y una palabra viaja más lejos que un porcentaje. Si alguien de fuera se lleva un número de aquí, va a ser ese.

## En este momento

Debajo hay una fila de pastillas con un número cada una y la etiqueta **En vivo**: Cuidadores activos, Baños hoy, Comidas hoy, Triage abierto, Handovers pend., Sin actividad hoy y En hospital. Se refrescan solas cada 30 segundos.

**Cada pastilla se toca.** Se abre debajo la lista de quién está detrás del número, con nombre y hora. La propia pantalla lo dice: "Toca cualquier chip para ver el detalle".

La que más conviene mirar es **Sin actividad hoy**. Su detalle se titula "Residentes sin actividad registrada hoy": no significa que a esa persona no se le esté cuidando, significa que **no consta**. Y lo que no consta, en una inspección, no pasó.

PREGUNTAS:
P: Qué te descarga el menú Resumen Ejecutivo de Insights?
*a) Un PDF del periodo que elijas: día, semana o mes
b) El informe que el sistema arma solo el primer día de cada mes
c) Un correo con el resumen para las familias del hogar
d) La lista de residentes con habitación y dieta
EXPLICACION: Son tres periodos —Día (hoy), Última semana y Último mes— y el PDF se arma en el momento en que lo pides: nada de esto se envía solo ni queda guardado en ninguna bandeja.

P: En el Dashboard Gerencial, qué mide la tarjeta Cumplimiento Salud?
a) La nota promedio de sus cuidadoras
b) La satisfacción de las familias del hogar
*c) Medicación administrada sobre medicación pautada, en la sede entera
d) Cuántos residentes pasaron su evaluación de salud
EXPLICACION: Es un porcentaje de la sede, no de nadie en particular, y debajo trae la semana actual y la anterior para poder compararlas.

P: Tu sede sale "ALERTA 62" en la columna Facility Health del Scorecard. Qué es ese número?
a) El porcentaje de camas que tienes ocupadas ahora
b) El promedio de las notas de tus empleadas
c) La nota que Zendity le pone al plan que tú tienes contratado
*d) La salud operativa y clínica de la sede, de 0 a 100
EXPLICACION: Parte de 100 y baja por úlceras activas, caídas graves, quejas pendientes, relevos que faltan y eMAR por debajo del 80. Es distinta de Cumplimiento Salud y vive en la misma pantalla, más abajo.

P: La pastilla Sin actividad hoy marca 2 en rojo y la tocas. Qué ves?
*a) Los dos residentes de los que hoy no consta nada
b) Las dos cuidadoras que todavía no han fichado su turno
c) Las dos tareas del supervisor vencidas sin atender
d) Los dos expedientes incompletos desde su admisión
EXPLICACION: El detalle se titula "Residentes sin actividad registrada hoy" y trae nombre y hora: no es que no se les cuide, es que no consta, y eso es lo que se mira en una inspección.

P: Tienes las dos sedes y marcas "Todas". Qué cambia arriba?
a) Nada: los KPIs siempre salen de la sede de tu sesión
*b) Se suman las dos y aparece la tarjeta Sedes Activas
c) Sale un desplegable para elegir con cuál comparar
d) Se abre otra pestaña por cada sede
EXPLICACION: Son botones, uno por sede más "Todas", y todo lo que hay debajo se recalcula. La tarjeta Sedes Activas solo se pinta cuando el ámbito marcado tiene más de una.

---SECCION_2---
LECTURA:
# El briefing de Zendi: cuándo existe y qué sabe

En el Dashboard Gerencial, debajo del encabezado, está el bloque **Zendi Director Briefing**. Es lo que lee la directora por la mañana. Hay que entender dos cosas de él, y ninguna es obvia.

## Primera: se escribe cuando alguien abre la pantalla, y ahí se queda

No hay ningún reloj detrás. **El briefing del día se escribe la primera vez que alguien abre el Dashboard Gerencial.** Si nadie lo abre en todo el día, ese día no hubo briefing. Se guarda uno por sede y por día clínico.

Y eso es todo lo que hace solo. **No se refresca durante el día.** El que se escribió al abrir por la mañana es el que vas a seguir leyendo a las seis de la tarde, aunque desde entonces haya pasado el almuerzo, la cena y dos caídas. Para ponerlo al día hay que pulsar **Regenerar**, y hay que pulsarlo a mano.

| Lo que ves | Qué significa |
|---|---|
| **Generado 04:47 p. m.** debajo del título | La hora a la que se escribió lo que estás leyendo |
| **Regenerar**, arriba a la derecha | Lo reescribe con el corte de ahora mismo |
| El recuadro punteado con **Generar briefing** | No hay ninguno hoy porque algo falló al abrir. Lo creas tú |

Esa hora, en letra pequeña debajo del título, es lo primero que hay que mirar. Si dice las 8:12 y son las seis de la tarde, **estás leyendo la mañana** y nadie te va a avisar de ello.

## Segunda: un aviso del briefing es un enlace

![Un briefing real: la hora en que se generó, el resumen en una frase y tres avisos con su prioridad —CRÍTICA, ALTA, MEDIA—, cada uno con su descripción con números y, debajo, la línea de acción con la flecha.](/academy/capturas/director-briefing.jpg)

Arriba va el **resumen en una frase**. Debajo, hasta cinco avisos, cada uno con:

- Una **prioridad** de color: Crítica, Alta, Media o Baja.
- Un **título** corto.
- Una **descripción con números** concretos.
- Una **línea de acción** en teal, con una flecha delante: qué hacer hoy.

Cuando el aviso tiene flecha en la esquina, **la tarjeta entera es un enlace**. Se pulsa y te deja en la pantalla donde eso se resuelve. Es la diferencia entre leer que hay una úlcera sin curar y estar en la pantalla de piel.

## De dónde salen esos números

Zendi redacta, pero no investiga. Solo puede hablar del corte del día clínico que se le entrega: **residentes, medicamentos del día** (dados, omitidos, rechazados y el porcentaje de cumplimiento), **relevos** firmados y pendientes, **vitales** y cuántos salieron fuera de rango, **triage abierto**, **incidentes de los últimos siete días**, **baños** y la **cobertura de comidas**.

Lo que no está en ese corte no va a aparecer en el briefing por mucho que lo regeneres. Los señalamientos de familia, por ejemplo, tienen su propia pantalla y hay que ir a ellos.

## Y lo que no hace

**El briefing no llega por correo.** Vive dentro del Dashboard Gerencial y en ningún otro sitio. No hay nada esperándote cada mañana en la bandeja de entrada: si no abres el panel, no lo lees.

PREGUNTAS:
P: Cuándo se genera el Zendi Director Briefing?
a) Todas las mañanas a las seis
b) Cuando el supervisor firma el último relevo del día
*c) La primera vez que alguien abre el Dashboard Gerencial
d) Cada vez que una cuidadora cierra su turno en la tableta
EXPLICACION: No hay ningún cron detrás: si nadie abre el panel en todo el día, ese día no hay briefing. Se guarda uno por sede y por día clínico.

P: Son las seis de la tarde y el briefing dice Generado 08:12. Qué haces?
a) Esperas: se rehace solo después de la cena
b) Recargas la página
c) Le pides al supervisor que lo vuelva a lanzar
*d) Pulsas Regenerar, arriba a la derecha
EXPLICACION: El briefing no se refresca solo en todo el día. El de la mañana sigue ahí hasta que alguien pulsa Regenerar, y por eso la hora de generación es lo primero que hay que mirar.

P: Un aviso del briefing lleva una flecha en la esquina. Qué es?
a) La señal de que hay más texto escondido debajo
*b) Un enlace a la pantalla donde eso se resuelve
c) Un botón para marcarlo como atendido
d) Un aviso de que ese dato no está confirmado
EXPLICACION: La tarjeta entera es el enlace; la línea en teal dice qué hacer y el enlace te deja donde se hace.

P: De dónde salen los números que cita el briefing?
*a) Del corte del día clínico: medicamentos, relevos, vitales, triage, incidentes, baños y comidas
b) De lo que el supervisor escribió en el relevo de la mañana
c) De las notas que el piso dejó ayer en la bitácora
d) Del reporte semanal que llega los lunes
EXPLICACION: Zendi redacta pero no investiga, y lo que no está en ese corte no va a aparecer por mucho que lo regeneres: los señalamientos de familia, por ejemplo, tienen su propia pantalla.

P: Cómo te llega el briefing al correo?
a) Llega cada mañana con el corte del día anterior
b) Llega los lunes con el de dirección
*c) No llega a ningún correo: vive solo en el panel
d) Llega solo cuando trae un aviso de prioridad Crítica
EXPLICACION: El briefing existe únicamente dentro del Dashboard Gerencial. Los correos de los lunes son otra cosa distinta, y se ven en la última sección.

---SECCION_3---
LECTURA:
# Admitir a un residente

## Lo primero: el CRM está dormido

Si te contaron que las admisiones entran por un tablero de prospectos que se arrastran de columna en columna, eso existió y hoy **no está en el menú de nadie**. Se durmió el 26-ago-2026 con cero prospectos registrados desde que se creó. El código sigue ahí, pero la puerta no. **No lo busques: la admisión no pasa por ahí.**

## El camino real: Intake Maestro

En el menú lateral, **Admisión de Residentes**. Se abre el **Intake Maestro**, con seis bloques a la izquierda.

![Los seis Bloques de Admisión del Intake Maestro. El cuarto, Log Farmacológico, es el que deja los medicamentos en borrador.](/academy/capturas/intake-indice-pasos.jpg)

Los bloques se rellenan y el expediente queda **en revisión**. Entonces sube al panel rosa de arriba.

## El panel rosa: Ingresos pendientes de confirmación clínica

![Ingresos pendientes de confirmación clínica. Carmen Delgado lleva 4 días, en rojo. En Pedro Santana el sistema explica por qué no deja confirmar y ofrece las dos salidas: Abrir expediente o No tiene familiar conocido.](/academy/capturas/intake-revisiones-pendientes.jpg)

Cada línea trae el nombre, cuántos días lleva esperando —**en ámbar el primero o el segundo, en rojo a partir del tercero**— y el botón **Confirmar ingreso**.

Ese botón es tuyo. Y **tiene dos candados**, los dos puestos a propósito porque los dos ya costaron dinero o disgustos:

| Falta | Lo que sale | Por qué |
|---|---|---|
| **La cuota mensual** | "Falta la cuota mensual. Sin ella este residente no entra en la facturación del mes" | Cuatro ingresos de agosto quedaron fuera del censo de facturación sin que nadie supiera por qué |
| **El familiar** | "No se puede confirmar: falta el familiar" | Había expedientes sin nadie a quien llamar, y un campo vacío no distingue "no tiene" de "se nos olvidó" |

Si su pago no pasa por Zendity, se escribe **0** en la cuota. Es una decisión, no una salida por la puerta de atrás.

Y si de verdad no tiene familia, el propio aviso te da las dos salidas válidas: **Abrir expediente** para registrar a alguien, o **No tiene familiar conocido** para dejarlo dicho. Las dos valen. Lo que no vale es dejarlo en blanco.

Esos son los dos candados del ingreso. **No hay un tercero**, y el que la mayoría de la gente da por hecho es el siguiente.

## El acuerdo de la sede, y el candado que no está donde crees

Una sede que va a recibir residentes necesita firmado su **Acuerdo de Asociado Comercial (BAA)**. Es requisito de HIPAA: sin él, Zendity no debería estar recibiendo información de salud de nadie.

Se firma en el menú lateral, en **Acuerdos**. La pantalla lleva el texto entero y el botón **Firmar acuerdo** sigue gris hasta que pasan tres cosas: que la caja del texto llegue al final, que escribas tu **nombre completo** y que escribas tu **cargo**. Quedan registrados con la fecha.

Ahora lo que hay que saber, y que no se ve en ninguna pantalla: **el Intake Maestro no comprueba el BAA.** Registra al residente igual. El candado existe en el código, pero vive en otros dos sitios —el formulario de **preingreso**, el que se llena desde fuera, y la ruta del CRM que acabamos de ver que está dormida—. Por el camino que usas tú, el de Admisión de Residentes, **no hay nada que te frene.**

Por eso se cuenta aquí. Firmar el BAA antes del primer residente **es una decisión tuya y de nadie más**: no confíes en que el sistema te avise, porque por ese camino no lo hace. Y es de las pocas cosas de este curso donde no hay red debajo.

PREGUNTAS:
P: Dónde está hoy el tablero de prospectos del CRM?
a) En Admisión, en la primera pestaña
b) En Insights, junto al menú de Resumen Ejecutivo
*c) Dormido: no está en el menú de nadie
d) En el Dashboard Gerencial, debajo de los KPIs
EXPLICACION: Se durmió el 26-ago-2026 con cero prospectos registrados; el código sigue ahí pero la entrada desapareció, así que la admisión no pasa por él.

P: Pulsas Confirmar ingreso y no te deja: falta la cuota mensual. Por qué bloquea?
*a) Porque sin cuota el residente no entra en la facturación
b) Porque el portal familiar no se activa
c) Porque la cocina necesita saber su plan de comidas
d) Porque sin ella no aparece en el eMAR del día
EXPLICACION: Ya pasó: cuatro ingresos de agosto quedaron fuera del censo de facturación. Si su pago no pasa por Zendity, se escribe 0 a propósito.

P: El residente no tiene familia. Qué haces para poder confirmar el ingreso?
a) Registras al vecino o a quien lo trajo al hogar
b) Confirmas igual y lo añades luego
c) Pones tu propio correo como contacto de la familia
*d) Marcas la salida "No tiene familiar conocido"
EXPLICACION: Las dos salidas son válidas —registrar a alguien o declarar que no lo hay— y existen para que "no tiene familia" quede dicho y no deducido de un campo vacío.

P: La sede todavía no tiene el BAA firmado y abres Admisión de Residentes. Qué pasa?
a) La pantalla no carga hasta que alguien firme el acuerdo
*b) Te deja registrar igual: en ese camino no hay candado
c) El expediente se guarda pero no sube al panel rosa
d) Se firma solo con tu sesión al crear el primer residente
EXPLICACION: El candado por BAA existe, pero en el preingreso y en la ruta del CRM dormido, no en el Intake Maestro. Firmarlo antes del primer residente es decisión tuya, y el sistema no te lo va a recordar por ese camino.

P: Qué hace falta antes de que el botón Firmar acuerdo se active?
a) Adjuntar una copia de la licencia del hogar
*b) Bajar el texto hasta el final y escribir tu nombre completo y tu cargo
c) Que lo apruebe antes el administrador de Zendity
d) Marcar la casilla de aceptación al pie
EXPLICACION: El botón sigue gris hasta que la caja del texto llega abajo, y quedan registrados el nombre, el cargo y la fecha de quien firmó.

---SECCION_4---
LECTURA:
# Lo que solo destrabas tú

Un residente puede estar admitido, confirmado y en el censo, y aun así **no llegarle nada al piso**. Hay dos cosas que lo producen y las dos las arregla dirección.

## 1. El color de ruta

Un residente recién admitido nace **sin color**. Y la tableta de la cuidadora reparte el trabajo **por color**: si no lo tiene, no entra en el grupo de nadie. Nadie lo baña, nadie le toma vitales.

Con una excepción que conviene conocer, porque es la que hace que el problema no se vea. La tableta cuenta cuántas personas de piso —cuidadoras y enfermeras— tienen turno abierto en la sede. **Si hay una sola, o ninguna, deja de repartir por color y le enseña TODOS los residentes.** Es una protección deliberada: quien está sola tiene que poder atender a todo el mundo, y se recalcula sola en cuanto otra ficha su turno.

El efecto secundario es que el residente sin color **aparece cuando hay una sola cuidadora y desaparece cuando entran varias**. Si la noche la cubre una persona sola, ahí sale y se le registra algo; por la mañana, con tres en piso, vuelve a desaparecer del grupo de todas. Y como de noche sí quedó registro, **la pastilla Sin actividad hoy tampoco lo delata.** El hueco existe, es intermitente, y no salta por ningún sitio.

Lo que sí avisa es el monitor: cada seis horas lo comprueba y te lo deja en la campana, **"N residentes sin color de ruta asignado"**. Ese aviso es el único que lo caza. Se arregla así:

1. Menú lateral, **Directorio Global** (o el enlace del propio aviso).
2. Abres el expediente del residente.
3. Pulsas **Editar Perfil**.
4. Bajas a **Grupo de Color** y eliges: **Rojo**, **Amarillo**, **Verde** o **Azul**.

## 2. Los medicamentos del ingreso

Lo que se captura en el bloque **Log Farmacológico** del Intake **no llega a la tableta**. Nace en borrador, a propósito: nadie da un medicamento porque alguien lo escribiera en un formulario de admisión.

![La tarjeta de Luis Ortega en Med: arriba la receta viva y debajo el recuadro ámbar Del ingreso, sin autorizar, con el Baclofeno y el botón Revisar y autorizar.](/academy/capturas/med-borrador-sin-autorizar.jpg)

En **Med & Zoning**, la tarjeta del residente trae un recuadro ámbar: **Del ingreso, sin autorizar**, y debajo lo dice con todas las letras: "Se capturaron en la admisión y NO llegan a la tableta hasta que se autoricen aquí".

![El modal de autorizar: el aviso de que esto la pone en la tableta, cada cuándo, el horario de suministro, la razón obligatoria y el botón Aplicar Sello.](/academy/capturas/med-autorizar-modal.jpg)

Pulsas **Revisar y autorizar** y se abre **Autorizar la receta del ingreso**, con cuatro cosas: cada cuándo (Todos los días / Solo ciertos días / Por razón necesaria), el **Horario de Suministro**, la **Razón Obligatoria (HIPAA)** y el botón **Aplicar Sello**.

**Esa es la respuesta a la llamada más frecuente de una familia recién llegada:** "mi madre entró ayer y dicen que no le sale nada". Casi siempre son los borradores sin autorizar, o el color de ruta. Mira esos dos antes que nada.

## Los cuatro estados del residente

El Directorio Global filtra por estado, y los cuatro son reales:

| Filtro | Quién está ahí |
|---|---|
| **Activos** | Los que están en el hogar |
| **Ausentes / Hospital** | Los que salieron y van a volver, y los fallecimientos recién reportados |
| **Dados de baja** | Los egresos |
| **Fallecidos** | Los expedientes ya cerrados |

Ojo con el segundo. Cuando se reporta un fallecimiento desde la tableta, el residente **sale del trabajo del turno al instante** —ya no se le piden medicamentos ni rondas— pero el expediente **no se cierra**. Te llega el aviso a la campana y se queda en **Ausentes / Hospital** hasta que lo cierres tú.

## Quién puede reportar un fallecimiento, y quién no

Aquí hay una trampa que conviene saber antes de que ocurra. El botón **Reportar fallecimiento** se pinta en la tarjeta de cualquier residente, en la tableta, **para todo el mundo**. Pero solo lo pueden pulsar de verdad la **enfermera**, la **supervisora**, **dirección** y **administración**. Una cuidadora lo ve, lo pulsa y le sale "Rol no autorizado".

En Vivid, 13 de los 22 empleados activos son cuidadoras, y son justo quienes están delante de la tableta. **Si en ese turno no hay enfermera ni supervisora, nadie puede reportarlo desde el sistema**, y lo que queda es el teléfono. Es la misma situación que dejó a Fernando González ACTIVO en el sistema después de fallecer: quien estaba de turno no tenía botón, y usó el de traslado al hospital para no falsificar un baño.

## Lo que solo puede dirección

En el expediente, **Baja Definitiva** y **Registrar Fallecimiento** son de dirección y de nadie más. **Permiso Temporal** y **Hospitalización de Emergencia** los pueden dar también el supervisor, la enfermera y la cuidadora, porque son reversibles. Cerrar un expediente no lo es.

PREGUNTAS:
P: Un familiar llama: su madre entró ayer y en la tableta no le sale ningún medicamento. Qué miras primero?
a) Si la farmacia entregó la receta esta semana
b) Si el turno de la mañana llegó a fichar
*c) Si los medicamentos del ingreso siguen sin autorizar en Med
d) Si la cuidadora tiene bien puesto su grupo de color
EXPLICACION: Lo del Log Farmacológico nace en borrador y no llega a la tableta hasta que alguien pulsa Revisar y autorizar. Lo segundo que hay que mirar es el color de ruta del residente.

P: En el modal Autorizar la receta del ingreso, qué hace el botón Aplicar Sello?
a) Guarda el borrador para revisarlo más tarde
*b) Pone la receta en la tableta
c) Avisa a la farmacia de que ese fármaco hace falta
d) Manda el cambio a enfermería para su visto bueno
EXPLICACION: El propio modal lo avisa antes de firmar: esto la pone en la tableta. La razón que escribas queda guardada con tu nombre.

P: La campana avisa de un residente sin color de ruta. Cuándo llega a aparecer en la tableta de alguien?
*a) Solo cuando queda una sola cuidadora con turno abierto
b) Nunca, hasta que dirección le asigne un color
c) Siempre: el aviso es informativo y no cambia nada
d) Cuando la enfermera lo mete a mano en su lista
EXPLICACION: La tableta reparte por color y sin color no entra en el grupo de nadie, salvo si hay una sola cuidadora en piso: entonces se le enseñan todos. Por eso aparece de noche y desaparece de día, y como de noche queda registro, tampoco sale en Sin actividad hoy.

P: Una cuidadora sola en el turno de noche encuentra fallecido a un residente y pulsa Reportar fallecimiento. Qué pasa?
a) Se reporta y dirección lo recibe en la campana
b) Queda en borrador hasta que enfermería lo revise
c) Se abre el modal, pero le pide la firma de la familia
*d) Le sale "Rol no autorizado" y tiene que llamar
EXPLICACION: El botón se pinta para todos, pero solo lo pulsan enfermera, supervisora, dirección o administración. Conviene que el piso lo sepa de antemano: es lo que pasó con Fernando González.

P: Quién puede pulsar Baja Definitiva en el expediente de un residente?
*a) Solo dirección y administración
b) La cuidadora que lo tiene asignado ese día
c) El supervisor de turno y la enfermera de la sede
d) Cualquiera que pueda abrir ese expediente
EXPLICACION: Permiso Temporal y Hospitalización de Emergencia los puede dar más gente porque son reversibles; cerrar un expediente no lo es.

---SECCION_5---
LECTURA:
# Lo que te llega, lo que no, y HIPAA

## Zendity no te llama al teléfono

Esto hay que decirlo claro porque mucha gente cree lo contrario: **no hay notificaciones push**. La aplicación no puede avisarte al móvil con la pantalla apagada. De hecho borra los service workers en cada carga, que es justo lo que haría falta para poder avisarte.

| Lo que SÍ existe | Lo que NO existe |
|---|---|
| La **campana** dentro de Zendity, con sus avisos | Un aviso al móvil con la aplicación cerrada |
| Los **correos de los lunes** | Un correo diario o un resumen de la mañana |
| Los avisos del monitor cada seis horas | Una alerta por "cumplimiento bajo" |

Una caída, un fallecimiento reportado, una úlcera declarada, un residente sin color: todo eso te llega **a la campana**. Se ve cuando entras. Para lo que de verdad no puede esperar, el hogar sigue funcionando como siempre: **te llaman por teléfono.** Esa parte no la sustituye ninguna pantalla.

## Los tres correos de los lunes

Dirección no recibe un correo semanal: recibe **tres**, y los tres llevan a dirección en su lista de destinatarios. Por sede, y uno por sede.

| Correo | Hora | Qué trae |
|---|---|---|
| **Reporte de enfermería** | Lunes 8:30 AM | Lo clínico: úlceras sin curar, PRN sin respuesta, planes y relevos esperando firma |
| **Reporte de supervisión** | Lunes 8:30 AM | El piso y las cuidadoras: huecos en el expediente, lo que no se hizo a tiempo, cobertura |
| **Reporte de dirección** | Lunes 9:00 AM | El orden: qué de todo lo anterior decidirías esta semana |

Los tres se saltan la sede que no tenga **nada pendiente**: si la semana queda limpia, ese correo no sale. Es a propósito —un correo que llega diciendo cero deja de abrirse, y el día que traiga algo tampoco se abrirá.

El de dirección llega media hora después que los otros dos **a propósito**: los lee y dice qué haría con ellos. No repite sus listas, da **un orden**: el primer bloque se llama "Lo que decidiría esta semana", y cada línea trae el número que la justifica y de quién es. Después vienen los titulares de Enfermería, de Piso y personal, y el bloque **La sede** —residentes activos, señalamientos sin resolver, datos de la sede sin completar y acuerdos sin aceptar.

Los otros dos no son ruido ni un correo que se te coló: **son los que llevan el detalle** que el de dirección resume en una línea. Si te llega el de dirección diciendo que hay seis planes de cuido sin firmar, los nombres están en el de enfermería.

**Los nombres van en el PDF adjunto, nunca en el cuerpo.** El cuerpo dice cuántos y de qué tipo. Esa es la regla y vale para cualquier cosa que salga de Zendity hacia un correo: sin diagnósticos, sin medicamentos, sin datos clínicos que identifiquen a nadie.

## Señalamientos de familia

Lo que una familia o el propio residente le plantea al personal no se resuelve en el piso. El supervisor lo recoge y sube a **Señalamientos de familia**, que es pantalla de dirección. Cada tarjeta trae los días que lleva —**en rojo pasados los catorce**—, quién lo planteó y el texto entero.

Tres salidas, y hacen cosas distintas:

- **Lo llevo yo** — queda como "Lo lleva dirección". Sigue abierto.
- **Enviar a enfermería** — pasa a "En enfermería". Sigue abierto.
- **Cerrar** — lo da por resuelto. **Este botón está gris hasta que escribas qué se hizo** en el cuadro de arriba. No es un trámite: esa nota es lo único que queda escrito.

## Dos cosas que conviene saber antes de que te pillen

**No hay una pantalla de registro de accesos.** Zendity anota accesos a datos clínicos en algunas rutas, pero no en todas, no anota los inicios de sesión, y **no hay ningún sitio en la aplicación donde puedas consultarlo**. Si tienes que investigar quién vio qué, no lo vas a sacar tú solo desde la app. Para eso está el contacto con Zendity.

**El score del empleado está apagado.** Si abres la ficha de una empleada y donde iba su puntuación lees "En revisión — el score no se muestra hasta que tenga una sola fórmula", no está roto ni le falta data. Se apagó el 09-sep-2026 porque el número salía al revés de la realidad: las personas que más documentaban salían abajo. Se sigue calculando y guardando, pero no se le enseña a nadie, porque un número que señala a una persona tiene que ser verdad antes que útil.

PREGUNTAS:
P: Una cuidadora pulsa Alerta Caída en la tableta. Cómo te enteras?
a) Con una notificación al móvil, con la aplicación cerrada
*b) Por la campana, cuando entras a Zendity
c) Con un mensaje de texto al número de la sede
d) En el correo del lunes
EXPLICACION: Zendity no tiene notificaciones push, y lo que existe son avisos en la campana que se ven cuando entras. Lo urgente de verdad sigue siendo una llamada de teléfono.

P: Cuántos correos semanales recibe dirección los lunes?
a) Uno: el reporte de dirección, a las 9:00
b) Dos: enfermería y dirección, los dos a las 8:30
c) Uno por cada residente con algo pendiente
*d) Tres: enfermería y supervisión a las 8:30, dirección a las 9:00
EXPLICACION: Los tres llevan a dirección en su lista y los tres se saltan la sede sin nada pendiente. Los de enfermería y supervisión traen el detalle que el de dirección resume en una línea.

P: El reporte semanal trae los nombres en el PDF y no en el cuerpo del correo. Por qué?
a) Porque el cuerpo del correo tiene un límite de caracteres
b) Porque así lo pidió la familia del residente
*c) Porque un correo no lleva datos clínicos identificables
d) Porque el PDF se puede imprimir y el correo no
EXPLICACION: El cuerpo dice cuántos y de qué tipo; el adjunto dice quiénes. Vale para cualquier cosa que salga de Zendity hacia un correo.

P: En Señalamientos de familia quieres cerrar uno. Qué te exige la pantalla?
a) La firma del supervisor que lo recogió
b) Que el familiar lo confirme
*c) Escribir en el cuadro qué se hizo
d) Que hayan pasado al menos catorce días
EXPLICACION: El botón Cerrar sigue gris mientras la nota esté vacía; Lo llevo yo y Enviar a enfermería no la exigen porque no cierran nada.

P: Abres la ficha de una empleada y donde iba su puntuación dice "En revisión". Qué pasó?
*a) Se apagó a propósito: el número salía al revés
b) Todavía no tiene turnos suficientes
c) Le falta su evaluación del trimestre en RRHH
d) La pantalla se quedó a medias y hay que recargarla
EXPLICACION: Se sigue calculando y guardando, pero no se le enseña a nadie: un número que señala a una persona tiene que ser verdad antes que útil.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 12: EL ADMINISTRADOR EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'ADMIN_101',
    title: 'El Administrador en Zendity',
    description: 'Funciones administrativas en Zendity: pipeline de admisiones, calendario corporativo, comunicaciones y seguimiento operativo.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '📊',
    category: 'Roles y Acceso',
    order: 3,
    content: `---META---
TITULO: El Administrador en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende las funciones y limites del rol Admin en Zendity, incluyendo que puede hacer de forma autonoma y que requiere autorizacion del Director.
TERMINOS_CLAVE: pipeline de admisiones, Intake Maestro, calendario corporativo, ZendiAssist CORPORATE_COMMS_POLISH, seguimiento operativo, Directorio Staff, ausencia del Director, comunicaciones institucionales
PREGUNTA_REFLEXION: El Director esta fuera. Una familia llama para admitir a su familiar urgente. Que puedes hacer tu como Admin y que requiere esperar al Director?

---SECCION_1---
LECTURA:
# El Rol Admin en la Estructura de Zendity

El Administrador (Admin) es el brazo operativo del Director dentro de Zendity. Mientras el Director toma decisiones estrategicas y clinicas, el Admin se encarga de la ejecucion diaria de procesos administrativos que mantienen la facilidad funcionando.

**Posicion en la jerarquia:**

El Admin tiene acceso amplio a los modulos corporativos de Zendity pero con limites claros. Puede gestionar el pipeline de admisiones en etapas iniciales, mantener el calendario corporativo, coordinar comunicaciones institucionales y dar seguimiento operativo a tareas pendientes.

**Lo que el Admin NO puede hacer:**

- Autorizar la transicion final de un lead a ADMISSION (requiere Director)
- Modificar configuraciones clinicas o protocolos medicos
- Aprobar o rechazar evaluaciones clinicas de prospectos
- Cambiar roles o permisos de otros usuarios en el sistema

**Valor del Admin en la operacion:**

El Admin es quien asegura que los procesos administrativos no se detengan. Cuando el Director esta en reuniones, supervisando el piso o fuera de la facilidad, el Admin mantiene el flujo de trabajo avanzando dentro de sus limites de autoridad. Es el primer punto de contacto para consultas operativas y logisticas.

PREGUNTAS:
P: Cual es la relacion entre el Admin y el Director en Zendity?
a) Son roles identicos con el mismo acceso
*b) El Admin es el brazo operativo del Director, ejecutando procesos administrativos diarios
c) El Admin supervisa al Director
d) El Director reporta al Admin
EXPLICACION: El Admin ejecuta los procesos administrativos diarios mientras el Director toma decisiones estrategicas y clinicas. El Admin opera dentro de limites definidos.

P: Cual de estas acciones puede realizar el Admin de forma autonoma?
a) Autorizar la admision final de un residente
b) Cambiar roles de otros usuarios en el sistema
*c) Gestionar el pipeline de admisiones en etapas iniciales
d) Modificar protocolos clinicos
EXPLICACION: El Admin puede gestionar prospectos en etapas iniciales del pipeline (PROSPECT, CONTACTED), pero la transicion a ADMISSION requiere autorizacion del Director.

P: Que NO puede hacer el Admin en Zendity?
a) Mantener el calendario corporativo
b) Coordinar comunicaciones institucionales
*c) Autorizar la transicion final de un lead a ADMISSION
d) Dar seguimiento operativo a tareas pendientes
EXPLICACION: La transicion de un lead a ADMISSION (que activa la creacion del expediente) requiere autorizacion del Director por su impacto clinico y operativo.

P: Cuando es particularmente critico el rol del Admin?
a) Solo durante las mananas del turno diurno
*b) Cuando el Director no esta disponible
c) Unicamente durante las admisiones nuevas
d) Solo cuando hay inspecciones regulatorias
EXPLICACION: En reuniones, supervisando el piso o fuera de la facilidad. El Admin es quien sostiene el flujo administrativo esas horas, para que no se detenga y se acumule.

P: Que tipo de modulos puede acceder el Admin en Zendity?
a) Solo los modulos clinicos del piso de cuido
b) Todos los modulos sin ninguna restriccion
*c) Los modulos corporativos con limites claros definidos por su rol
d) Solo el modulo de Academy
EXPLICACION: El Admin tiene acceso a modulos corporativos (CRM, calendario, comunicaciones) pero con limites definidos que excluyen funciones clinicas y decisiones de admision final.

---SECCION_2---
LECTURA:
# Pipeline de Admisiones e Intake Maestro

El Admin juega un rol crucial en las primeras etapas del pipeline de admisiones. Usando la herramienta Intake Maestro de Zendity, puede gestionar prospectos de manera eficiente y profesional.

**Funciones del Admin en el pipeline:**

- **Crear leads nuevos**: Cuando una familia contacta la facilidad, el Admin registra los datos basicos en el CRM (nombre, telefono, email, notas iniciales).
- **Gestionar etapa PROSPECT**: Organizar los prospectos nuevos, asignar prioridad y documentar detalles del primer contacto.
- **Avanzar a CONTACTED**: Despues de la primera conversacion con la familia, el Admin actualiza el status y documenta necesidades, expectativas y preguntas de la familia.
- **Preparar para EVALUATION**: Recopilar documentacion preliminar y coordinar la agenda de evaluacion con el equipo clinico.

**Intake Maestro:**

Intake Maestro es un asistente de Zendity que guia al Admin paso a paso durante el proceso de registro de un nuevo prospecto. Sugiere campos importantes, valida informacion y alerta si faltan datos criticos. Esto reduce errores y asegura que cada lead tenga la informacion minima necesaria para avanzar en el pipeline.

El Admin debe mantener el pipeline limpio: hacer seguimiento a prospectos estancados, actualizar notas despues de cada contacto y asegurar que ningun lead quede sin atencion por mas de 48 horas.

PREGUNTAS:
P: Que es Intake Maestro en Zendity?
a) Un curso de capacitacion para nuevos empleados
b) Un modulo para administrar medicamentos
*c) Un asistente que guia el registro
d) Un reporte financiero automatizado
EXPLICACION: Guia al Admin paso a paso durante el registro de un prospecto nuevo: sugiere campos, valida datos y avisa de lo que falta antes de cerrar.

P: Hasta que etapa del pipeline puede el Admin avanzar un lead de forma autonoma?
a) Hasta ADMISSION
*b) Hasta CONTACTED, y preparar para EVALUATION
c) Solo puede crear el lead sin avanzarlo
d) Puede avanzar a cualquier etapa sin restriccion
EXPLICACION: El Admin puede crear leads, gestionar PROSPECT, avanzar a CONTACTED y preparar la documentacion para EVALUATION, pero las decisiones de evaluacion y admision requieren al Director.

P: Cada cuanto debe el Admin hacer seguimiento a prospectos sin actividad?
a) Una vez al mes
b) Solo cuando el Director lo solicite
*c) Ningun lead debe quedar sin atencion por mas de 48 horas
d) Cada 2 semanas
EXPLICACION: El Admin debe mantener el pipeline activo asegurando que ningun lead quede sin atencion por mas de 48 horas, haciendo seguimiento y actualizando notas regularmente.

P: Que debe hacer el Admin despues de cada contacto con una familia prospecto?
a) Esperar a que la familia llame de nuevo
*b) Actualizar las notas del lead en el CRM con la informacion de la conversacion
c) Eliminar el lead si no confirmo inmediatamente
d) Transferir el lead al Director sin documentar
EXPLICACION: Despues de cada contacto, el Admin actualiza notas en el CRM documentando necesidades, expectativas y preguntas de la familia para mantener el registro completo.

P: Que beneficio aporta Intake Maestro al proceso de admision?
a) Elimina la necesidad del rol de Director
b) Automatiza completamente la admision sin intervencion humana
*c) Reduce errores y asegura que cada lead tenga la informacion minima necesaria
d) Permite que los familiares se auto-registren
EXPLICACION: Intake Maestro reduce errores de registro al validar datos, sugerir campos importantes y alertar sobre informacion faltante antes de que el lead avance.

---SECCION_3---
LECTURA:
# Calendario Corporativo y Seguimiento Operativo

El Admin es responsable de mantener el calendario corporativo de la Sede y dar seguimiento a las tareas operativas pendientes. Este rol es esencial para la coordinacion diaria de la facilidad.

**Calendario corporativo:**

El calendario en Zendity centraliza todos los eventos relevantes de la Sede: reuniones de equipo, visitas de familiares programadas, inspecciones regulatorias, fechas de vencimiento de certificaciones, cumpleanos de residentes y eventos especiales.

**Funciones del Admin en el calendario:**

- Programar y modificar eventos de la Sede
- Enviar recordatorios al personal sobre reuniones y fechas importantes
- Coordinar agendas entre departamentos (clinico, administrativo, mantenimiento)
- Registrar y dar seguimiento a citas externas de residentes

**Seguimiento operativo:**

El Admin usa el dashboard corporativo para monitorear tareas pendientes: documentos por completar, renovaciones de certificaciones proximas, seguimientos de prospectos y tareas asignadas por el Director. Cada tarea tiene un responsable y una fecha limite visibles en el sistema.

La clave del seguimiento operativo es la consistencia. El Admin debe revisar las tareas pendientes diariamente, actualizar el estado de cada una y escalar al Director cuando algo requiere atencion inmediata o esta fuera de su autoridad.

PREGUNTAS:
P: Que centraliza el calendario corporativo en Zendity?
a) Solo los horarios de medicamentos de los residentes
b) Las redes sociales de la facilidad
*c) Todos los eventos relevantes de la Sede: reuniones, visitas, inspecciones y fechas clave
d) Solo los cumpleanos de los empleados
EXPLICACION: El calendario corporativo centraliza reuniones, visitas familiares, inspecciones, vencimientos de certificaciones, cumpleanos de residentes y eventos especiales de la Sede.

P: Que rol tiene el Admin en la coordinacion entre departamentos?
a) Ninguno, cada departamento se coordina solo
*b) Coordinar agendas entre departamentos clinico, administrativo y mantenimiento
c) Solo coordinar con el departamento de cocina
d) Supervisar las decisiones clinicas de enfermeria
EXPLICACION: El Admin coordina agendas entre todos los departamentos de la facilidad, asegurando que reuniones, tareas y eventos no se superpongan y fluyan correctamente.

P: Con que frecuencia debe el Admin revisar las tareas pendientes?
a) Semanalmente cada lunes
b) Solo cuando el Director lo solicita
*c) Diariamente
d) Al final de cada mes
EXPLICACION: La revision diaria de tareas pendientes es clave para el seguimiento operativo efectivo, permitiendo al Admin mantener todo al dia y escalar lo necesario.

P: Que debe hacer el Admin cuando una tarea pendiente esta fuera de su autoridad?
a) Completarla de todas formas para no retrasar el proceso
b) Eliminar la tarea del sistema
*c) Escalar al Director para que tome la decision correspondiente
d) Asignarla a otro empleado sin consultar
EXPLICACION: Cuando una tarea requiere autoridad superior, el Admin debe escalar al Director. Actuar fuera de sus limites podria comprometer procesos criticos.

P: Que informacion tiene cada tarea en el sistema de seguimiento operativo?
a) Solo el nombre de la tarea
b) El nombre y un codigo de colores
*c) Un responsable asignado y una fecha limite visibles en el sistema
d) Solo la fecha de creacion
EXPLICACION: Cada tarea operativa en Zendity tiene un responsable asignado y una fecha limite, permitiendo transparencia y rendicion de cuentas en el seguimiento.

---SECCION_4---
LECTURA:
# ZendiAssist para Comunicaciones

ZendiAssist es el asistente de inteligencia artificial de Zendity. Para el Admin, la funcion CORPORATE_COMMS_POLISH es particularmente valiosa: ayuda a redactar y pulir comunicaciones institucionales profesionales.

**Que es CORPORATE_COMMS_POLISH?**

Es una funcion de ZendiAssist que toma un borrador de comunicacion escrito por el Admin y lo transforma en un mensaje profesional, manteniendo el tono institucional apropiado. Funciona para emails a familias, comunicados internos, notificaciones de eventos y respuestas a consultas formales.

**Como usar CORPORATE_COMMS_POLISH:**

1. El Admin redacta un borrador con la informacion esencial del mensaje
2. Activa ZendiAssist y selecciona la funcion CORPORATE_COMMS_POLISH
3. El asistente genera una version pulida manteniendo el contenido original
4. El Admin revisa, ajusta si es necesario y envia

**Directorio Staff:**

El Admin tambien gestiona el Directorio Staff de la Sede, que contiene la informacion de contacto y rol de cada empleado. Este directorio es esencial para coordinar comunicaciones internas y saber a quien contactar en cada departamento. Mantener el directorio actualizado es responsabilidad directa del Admin.

Las comunicaciones institucionales representan la imagen de la facilidad. Un email mal redactado a una familia puede generar desconfianza. CORPORATE_COMMS_POLISH asegura que cada mensaje refleje profesionalismo.

PREGUNTAS:
P: Que hace la funcion CORPORATE_COMMS_POLISH de ZendiAssist?
a) Traduce mensajes a otros idiomas automaticamente
*b) Toma un borrador del Admin y lo transforma en una comunicacion profesional institucional
c) Envia emails automaticamente sin revision
d) Crea presentaciones visuales para reuniones
EXPLICACION: CORPORATE_COMMS_POLISH pulE borradores de comunicacion del Admin para producir mensajes profesionales con el tono institucional apropiado.

P: Despues de que ZendiAssist genera la version pulida, que debe hacer el Admin?
a) Enviar inmediatamente sin leer
b) Eliminarlo y escribir uno nuevo
*c) Revisar el mensaje, ajustar si es necesario y luego enviar
d) Pedir al Director que lo reescriba completamente
EXPLICACION: El Admin debe siempre revisar y ajustar la version generada antes de enviar, asegurandose de que el contenido sea preciso y apropiado.

P: Que es el Directorio Staff en Zendity?
a) Una lista de residentes y sus familiares
b) Un directorio de proveedores externos
*c) La informacion de contacto y rol de cada empleado de la Sede
d) Una base de datos de medicamentos disponibles
EXPLICACION: El Directorio Staff contiene la informacion de contacto y rol de cada empleado, esencial para coordinar comunicaciones internas y saber quien cubre cada funcion.

P: Por que son importantes las comunicaciones profesionales en una facilidad de cuido?
a) Solo por cumplir con requisitos legales
b) Porque los familiares no leen mensajes informales
*c) Porque representan la imagen de la facilidad
d) Porque Zendity cobra extra por mensajes informales
EXPLICACION: Y un mensaje mal redactado puede generar desconfianza justo donde mas cuesta recuperarla: ante familias, reguladores y la comunidad.

P: Quien es responsable de mantener actualizado el Directorio Staff?
a) Cada empleado actualiza sus propios datos
b) El equipo de enfermeria
*c) El Admin de la Sede
d) El sistema lo actualiza automaticamente
EXPLICACION: Mantener el Directorio Staff actualizado es responsabilidad directa del Admin, asegurando que la informacion de contacto y roles este siempre al dia.

---SECCION_5---
LECTURA:
# Limites del Admin y Protocolo de Ausencia del Director

Entender los limites del rol Admin es tan importante como conocer sus funciones. En situaciones donde el Director no esta disponible, el Admin debe saber exactamente que puede hacer y que debe esperar.

**Acciones autonomas del Admin (sin Director):**

- Crear y gestionar leads en etapas PROSPECT y CONTACTED
- Mantener el calendario corporativo y programar eventos
- Redactar y enviar comunicaciones usando ZendiAssist
- Actualizar el Directorio Staff
- Dar seguimiento a tareas operativas pendientes
- Recibir llamadas y documentar consultas de familias

**Acciones que REQUIEREN al Director:**

- Aprobar transicion de leads a EVALUATION o ADMISSION
- Tomar decisiones sobre capacidad y recursos clinicos
- Modificar roles o permisos de usuarios
- Autorizar gastos o compromisos financieros
- Responder a inspecciones regulatorias

**Protocolo de ausencia del Director:**

1. El Admin documenta todas las solicitudes y consultas recibidas durante la ausencia
2. Clasifica cada solicitud como urgente o no urgente
3. Para solicitudes urgentes: contacta al Director por telefono o mensaje
4. Para solicitudes no urgentes: las registra en el sistema para revision del Director al regresar
5. Nunca excede su autoridad, aunque la situacion parezca simple

La transparencia es clave. El Admin debe registrar en Zendity cada accion tomada y cada solicitud pendiente durante la ausencia del Director para mantener trazabilidad completa.

PREGUNTAS:
P: Que debe hacer el Admin cuando una familia llama para admitir urgente y el Director no esta?
a) Aprobar la admision para no perder al prospecto
b) Rechazar la solicitud hasta que regrese el Director
*c) Documentar la solicitud, clasificarla como urgente y contactar al Director
d) Transferir la llamada a enfermeria
EXPLICACION: El Admin no puede aprobar admisiones. Debe documentar la solicitud urgente y contactar al Director para que tome la decision, manteniendo a la familia informada.

P: Cual de estas acciones puede hacer el Admin de forma autonoma durante la ausencia del Director?
a) Aprobar la evaluacion de un prospecto
*b) Crear leads nuevos y enviar comunicaciones institucionales
c) Cambiar los permisos de acceso de otros empleados
d) Autorizar gastos de mantenimiento de la facilidad
EXPLICACION: El Admin puede crear leads, gestionar comunicaciones, mantener el calendario y dar seguimiento operativo sin necesidad de aprobacion del Director.

P: Como debe clasificar el Admin las solicitudes recibidas durante la ausencia del Director?
a) Por departamento unicamente
b) Por orden de llegada sin priorizar
*c) Como urgentes o no urgentes
d) Solo documentar las de familiares y descartar las demas
EXPLICACION: El Admin clasifica cada solicitud como urgente o no urgente. Las urgentes se escalan al Director inmediatamente; las no urgentes se registran para revision posterior.

P: Por que es importante que el Admin nunca exceda su autoridad?
a) Porque el sistema bloquea automaticamente acciones no autorizadas
*b) Porque actuar fuera de sus limites podria comprometer decisiones clinicas u operativas criticas
c) Porque recibiria una multa automatica del sistema
d) Porque el Director se molestaria personalmente
EXPLICACION: Exceder la autoridad del Admin podria comprometer decisiones que requieren juicio clinico o directivo, poniendo en riesgo la operacion y el cuidado de los residentes.

P: Que debe registrar el Admin en Zendity durante la ausencia del Director?
a) Solo las llamadas de familiares
b) Nada, debe esperar al Director para documentar
*c) Cada accion tomada y cada solicitud pendiente para mantener trazabilidad completa
d) Solo las emergencias clinicas
EXPLICACION: La trazabilidad completa es clave. El Admin registra cada accion y solicitud en Zendity para que el Director tenga visibilidad total al regresar.
`
}
,

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 13: TURNO NOCTURNO DEL CUIDADOR
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'TURNO_NOCTURNO_101',
    title: 'Turno Nocturno del Cuidador',
    description: 'Protocolo especial del turno nocturno: handover virtual, rondas, incidentes y toma de decisiones sin supervision presencial.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🌙',
    category: 'Operaciones de Piso',
    order: 7,
    content: `---META---
TITULO: Turno Nocturno del Cuidador
PROMPT_ZENDI: Evalúa si la cuidadora sabe trabajar en Night Rounds Mode, registrar rotación y pañal desde la tarjeta de noche, salir a la vista Normal para un medicamento o una caída sabiendo que la pantalla se le va a volver sola, y dejar el turno firmado Y confirmado antes de irse.
TERMINOS_CLAVE: Night Rounds Mode, Rondas, Normal, Rotado, Rotación Postural 2Hrs, Rotación VENCIDA, Pañal Seco, Cambio (Orina), Cambio (Evacuación), ronda de grupo, Relevo de tu turno anterior, Prólogo del Día, Alerta Caída, No la presencié, Cambio Clínico u Observación, Entregar Turno, Estado Limpio, Certifico bajo penalidad normativa, CONFIRMAR CIERRE DE TURNO, sesión sin cerrar
PREGUNTA_REFLEXION: Piensa en tu última guardia. Hubo algo que hiciste de madrugada —una rotación, un cambio, una vuelta a una habitación— que al final no quedó registrado en la tableta. ¿Qué fue, y qué te lo impidió?

---SECCION_1---
LECTURA:
# La noche no es el día con la luz apagada

Entras igual que siempre: la pantalla oscura que te saluda, **Iniciar Turno**, eliges tu color, verificas el censo, pulsas **Confirmar Censo y Escuchar Zendi** y oyes el prólogo. Hasta ahí, lo de todos los días.

Desde ahí cambian dos cosas, y las dos cambian tu trabajo.

## 1. En guardia no se abren órdenes de vitales

En el turno de mañana, al fichar se te abre una ventana de 4 horas por cada residente tuyo. **En guardia no.** El sistema no te pide ni un vital.

No es un olvido del programa. Se midió: de 922 órdenes que se abrían entre las 10 de la noche y las 6 de la mañana, **vencieron 876** — el 95%. Nadie despierta a un señor a las dos de la madrugada para tomarle la presión, y después se le contaba a la cuidadora como incumplido.

Si un residente de verdad necesita una toma de noche, **la enfermera crea esa orden a mano**. Si no hay orden, no hay vitales que tomar. La guardia rota y anota.

## 2. A las 10 la tableta se cambia sola — y se sigue cambiando sola

A las 10:00 PM la pantalla pasa sola al modo de noche, y a las 6:00 AM vuelve sola a la vista de siempre. Tú no tienes que hacer nada.

En la barra de arriba hay **un solo botón que conmuta las dos vistas**:

| Lo que ves en el botón | Dónde estás | Qué hace |
|---|---|---|
| Una luna y la palabra **Rondas** | En la vista Normal | Te lleva al modo de noche |
| Un sol y la palabra **Normal** | En el modo de noche | Te devuelve a la lista de siempre |

**Ese botón te lleva, pero no te deja quedarte.** Entre las 10 de la noche y las 6 de la mañana la tableta se revisa a sí misma **cada minuto** y vuelve a poner el modo de noche. Si pulsas **Normal** a las 3 AM y te entretienes buscando a quién abrir, en menos de un minuto **la lista se te va de debajo del dedo** y vuelve la pantalla oscura. No es un fallo de tu tableta, no es que la tocaras mal, y no se puede apagar.

Lo que sí aguanta es esto, y es lo que hay que hacer:

> **Pulsa Normal y abre enseguida la tarjeta del residente. Una vez la tarjeta está abierta, se queda abierta**, aunque el fondo vuelva al modo de noche. Desde ahí terminas tranquila lo que ibas a hacer: el medicamento, la bitácora, la caída. Si la lista se te fue antes de que la abrieras, vuelve a pulsar **Normal**, las veces que hagan falta.

(La única parte que sí se te desaparece cuando el fondo vuelve a noche es el bloque de pañal de dentro de Actividades. Y ese no lo necesitas: el pañal de la noche se registra desde la tarjeta de noche.)

![Night Rounds Mode a las 02:30 AM. Arriba a la derecha, el botón con el sol y la palabra Normal: eso quiere decir que estás en la vista de noche y ese botón te saca de ella, aunque solo por un minuto.](/academy/capturas/noche-rondas.jpg)

## Lo que ves al abrir el turno

Antes de entrar al piso, Zendi te enseña la pantalla **Zendi Reporte Clínico**. Si tocas **Omitir Audio (Lectura Rápida)** pasa a **Resumen Visual del Turno**, con dos bloques:

- **Relevo de tu turno anterior**, en teal: quién lo entregó, la hora, su texto y el enlace **Ver reporte completo**.
- **Prólogo del Día — Zendi**, en ámbar, con el sello **Generado a las 6:00 AM**. Ese es de la sede entera, no de tu grupo.

Debajo, tres contadores: alertas de vitales, inapetencias de las últimas 8 horas y citas de hoy. Y el botón **Adelante, Iniciar Cuidados**.

**Ahí no hay lista de medicamentos pendientes, ni de incidentes abiertos, ni notas del supervisor.** Y no hay ninguna pantalla llamada "Prólogo del Turno" para ti: esa tarjeta vive en el panel del supervisor, al que no entras.

## Nada te obliga a confirmar que lo leíste

El turno se abre sin que marques ninguna casilla. Hubo un intento de obligar a leer el relevo y se retiró porque la pantalla nunca llegó a construirse. Así que el relevo está ahí para que lo leas, pero **quien te lo cobra no es la tableta: es el turno de mañana**.

## Sesión zombi: lo que de verdad significa

Vas a oír esa palabra a tu supervisora. Significa **un turno que quedó abierto sin cerrar**:

| Lo que SÍ es | Lo que NO es |
|---|---|
| Una sesión que se quedó sin firmar el cierre | Un aviso porque no tocas la tableta |
| A las 12 horas sale en el panel del supervisor | Un detector de 90 minutos de inactividad |
| A las 14 horas la cuenta un proceso que corre cada 6 | Algo que solo pase de noche |

PREGUNTAS:
P: Abres tu turno a las 10:30 de la noche. ¿Qué órdenes de vitales te abre el sistema?
*a) Ninguna: en guardia no se abren
b) Una por cada residente de tu grupo
c) Una sola, para el residente de más riesgo
d) Las mismas cuatro horas que en el turno de mañana
EXPLICACION: De 922 órdenes abiertas entre las 10pm y las 6am vencieron 876; si de verdad hace falta una toma de noche, la enfermera crea la orden a mano.

P: ¿Qué es una sesión zombi en Zendity?
a) Una sesión que se abre sola a medianoche
b) Un turno en el que la tableta no detecta movimiento
*c) Un turno que quedó sin cerrar
d) Un cuidador que no toca la tableta en 90 minutos
EXPLICACION: El panel del supervisor la lista a las 12 horas de abierta y el proceso de salud la cuenta a las 14. No mide si tocaste la tableta.

P: Pulsas el botón Normal a las 3 AM y te quedas mirando la lista sin abrir nada. ¿Qué pasa al minuto?
a) Se queda así hasta las 6
*b) Vuelve sola a la vista de noche
c) Se cierra tu sesión por inactividad
d) Te pregunta si quieres seguir
EXPLICACION: Entre las 10pm y las 6am la tableta se revisa cada minuto y vuelve a imponer el modo de noche. Por eso se pulsa Normal y se abre la tarjeta enseguida: la tarjeta, una vez abierta, sí se queda.

P: Al abrir el turno, ¿qué dos bloques te enseña la pantalla de arranque?
a) Los incidentes abiertos y los medicamentos pendientes
b) Las notas del supervisor y las rondas de la noche anterior
c) El Prólogo del Turno y la lista de items MISSED
*d) Relevo de tu turno anterior y Prólogo del Día
EXPLICACION: El primero trae quién entregó, su texto y el enlace Ver reporte completo; el segundo lleva el sello Generado a las 6:00 AM y es de la sede entera.

P: ¿Qué tienes que confirmar antes de que la tableta te deje empezar el turno de noche?
a) Que leíste el Prólogo, marcando una casilla
*b) Nada: el turno de noche se abre sin confirmar ninguna lectura
c) Que aceptas el relevo con tu firma
d) Que estás sola en el piso
EXPLICACION: La pantalla de lectura obligatoria nunca se construyó y la intercepción se retiró. El relevo está ahí para que lo leas, pero nada te lo exige.

---SECCION_2---
LECTURA:
# Night Rounds Mode: la pantalla de las dos de la mañana

Arriba, un recuadro oscuro con una luna y el título **Night Rounds Mode**, la frase "Modo Ultra-Rápido: registra rondas bi-horarias y cambios de pañal en 1 solo tap" y, a la derecha, **HORA LOCAL DEL TURNO** con la hora en grande.

Debajo, una tarjeta por residente. Esa tarjeta es tu unidad de trabajo de la noche.

## Las partes de la tarjeta

- Arriba: iniciales, nombre, habitación y la etiqueta **TURNO NOCHE**.
- Una franja: **Rotado · 01:55 AM — hace 35 min**. Solo aparece si ese residente tiene alguna rotación registrada. Sale en teal, y en rojo cuando pasan las dos horas.
- Cuatro botones, y nada más.

![La tarjeta de Rosa Medina de madrugada: la franja Rotado con la hora y los minutos que han pasado, y debajo los cuatro botones. No hay ningún botón más.](/academy/capturas/noche-tarjeta.jpg)

| Botón | Qué registra |
|---|---|
| **Pañal Seco** | Una nota de ronda: control de continencia sin novedad |
| **Cambio (Orina)** | Una nota de ronda: cambio por humedad |
| **Cambio (Evacuación)** | Una nota de ronda: cambio mayor, higiene y piel protegida |
| **Rotación Postural 2Hrs** | El cambio de posición de ese residente |

Un toque, un registro. **Y tienes aviso siempre**, verde o rojo. Si no aparece nada, no se guardó.

## Si pulsas dos veces

Pasaba mucho: la pantalla se veía lenta, no salía ningún aviso y la gente seguía pulsando. Medido en agosto de 2026: **3.325 rotaciones duplicadas** de 17.958, con rachas de hasta quince seguidas del mismo residente.

Hoy el servidor mira si hay una rotación de ese residente en los dos minutos anteriores. Si la hay, te devuelve **un aviso verde**: "Esta rotación ya estaba registrada hace un momento." No es un error y no tienes que repetir nada.

## La hora con la que queda

La tarjeta de noche **no tiene el control de la hora**. Registra el momento en que pulsas. Si rotaste a la 1:00 y lo anotas a las 2:30, queda con las 2:30.

Existe un control para declarar la hora real, **¿Cuándo se hizo?**, con los atajos de 30 min, 1 h y 2 h. Acepta hasta 12 horas hacia atrás y nada en el futuro. Pero vive dentro del modal **Actividades Diarias y Comidas** de la vista Normal, y **no alcanza a todo lo que haces de noche**:

- **La rotación sí se puede fechar.** Desde la vista Normal, abres Actividades, pones ¿Cuándo se hizo? y después pulsas Izquie./Supino/Derecha. Con una condición: esos tres botones **solo salen si ese residente tiene el Protocolo UPP activo**. Para los demás, el modal te ofrece "Abrir Panel de Prevención" y ahí no hay rotación que fechar.
- **El pañal no se puede fechar.** Ni desde la tarjeta de noche ni desde la vista Normal. Los tres botones de pañal guardan siempre la hora del toque, y no hay ningún camino en la tableta para decir otra cosa.

O sea: tres de los cuatro actos de tu noche no se pueden echar hacia atrás. Si un cambio de las 12:40 lo registras a las 2:00, **dilo con tus palabras en el reporte del cierre**, que es donde sí puedes escribir.

Y un aviso sobre ese control: **se queda puesto**. Si lo dejas en "hace 1 h" y sigues registrando, lo que venga detrás arrastra esa hora. Cuando termines, vuelve a pulsar **Ahora**.

## Lo que la tarjeta de noche NO tiene

Esto sorprende a todo el mundo la primera noche:

| Lo que buscas | Dónde está de verdad |
|---|---|
| **Medicamentos** | Solo en la vista Normal: pulsa Normal y abre la tarjeta |
| **Bitácora / Actividades Diarias** | Igual: en la vista Normal |
| **Alerta Caída** | En la tarjeta del residente, en la vista Normal |
| **Vitales** | En la vista Normal, y solo si hay una orden |

Abajo a la derecha, siempre visible, una pastilla pequeña: **Ronda 1** con una barra y un porcentaje. Eso es el progreso de tu grupo, y se explica en la sección siguiente.

PREGUNTAS:
P: Vas a registrar que rotaste a Rosa Medina a las 2:00 AM. ¿Qué pulsas en su tarjeta de noche?
a) Pañal Seco, que sella la ronda completa
b) Cambio (Orina), que incluye la rotación
c) Sellar Ronda, abajo del todo
*d) Rotación Postural 2Hrs, el botón grande
EXPLICACION: Es el botón ancho del fondo de la tarjeta. Los tres de arriba son de pañal y no registran ninguna rotación.

P: Pulsas Rotación Postural 2Hrs dos veces seguidas porque la pantalla se vio lenta. ¿Qué pasa?
a) Quedan dos rotaciones en el expediente
*b) Sale un aviso verde y la rotación no se duplica
c) Sale un error rojo y hay que repetir
d) El botón se bloquea hasta la próxima ronda
EXPLICACION: El servidor busca una rotación del mismo residente en los dos minutos anteriores y te devuelve éxito con la que ya existe, no un error.

P: Son las 3 AM y a Luis Ortega le toca un medicamento. Estás en Night Rounds Mode. ¿Qué haces?
a) Pulsas Pañal Seco, que abre el pack de la hora
b) Lo registras al cerrar el turno, a las 6 de la mañana
c) Le pides a la supervisora que lo abra por ti desde su panel
*d) Pulsas Normal y abres su tarjeta enseguida
EXPLICACION: La tarjeta de noche solo tiene los cuatro botones de ronda. Y como la tableta vuelve sola al modo de noche al minuto, hay que abrir la tarjeta enseguida: una vez abierta se queda, aunque el fondo cambie.

P: En la tarjeta de Elena Figueroa lees "Rotado · 12:42 AM — hace 108 min". ¿Qué te dice?
a) Que le toca rotación dentro de 108 minutos
b) Que la ronda del grupo lleva 108 minutos abierta
*c) Cuándo fue su última rotación y cuánto lleva
d) Que la rotación se registró tarde y resta puntos
EXPLICACION: La franja solo aparece si ese residente ya tiene alguna rotación registrada, y se pone roja cuando pasan las dos horas.

P: Rotaste a Carmen Delgado a la 1:00 y lo registras a las 2:30 desde la tarjeta de noche. ¿Con qué hora queda?
*a) Con las 2:30, la del toque
b) Con la 1:00, que es la hora del cuido
c) Con la hora que elijas en ¿Cuándo se hizo?
d) Con la hora de inicio de tu turno
EXPLICACION: En la tarjeta de noche no hay control de hora. Una rotación sí se puede fechar desde Actividades, en la vista Normal, si ese residente tiene el Protocolo UPP activo; un pañal no se puede fechar por ningún camino.

---SECCION_3---
LECTURA:
# Las dos horas, y qué cuenta como ronda

Son dos relojes distintos y la gente los confunde. Van por separado.

## El reloj de las dos horas es POR RESIDENTE

No cuenta desde que empezó tu turno. Cuenta **desde la última rotación de esa persona**.

Cuando pasan dos horas y tres minutos, la tarjeta te lo dice sola: la franja **Rotado** se pone roja y el botón grande cambia de **Rotación Postural 2Hrs** a **Rotación VENCIDA — Ejecutar**.

Cada tarjeta lleva su propio reloj. Una puede estar en rojo y la de al lado tranquila.

| Lo que SÍ significa el rojo | Lo que NO significa |
|---|---|
| Que a esa persona le toca ya | Que alguien recibió una alerta por ti |
| Que la tarjeta te lo está avisando a ti | Que se te marcó una ronda perdida |
| Que en cuanto rotes vuelve a teal | Que te van a descontar por el color |

**No existe ningún "MISSED nocturno".** Nadie te marca una ronda como perdida. Esa palabra no está en el sistema.

## La ronda es otra cosa: tu grupo entero

La pastilla de abajo a la derecha cuenta **rondas de grupo**. Una ronda está completa cuando **has tocado al menos una vez a cada residente de tu color** desde que empezó el turno.

Y aquí hay una trampa que no se ve. **De noche no cuenta cualquier registro.** Solo cuentan los cuatro botones de la tarjeta de noche:

**Sí tocan al residente para la ronda:**

- **Rotación Postural 2Hrs**
- **Pañal Seco**, **Cambio (Orina)** y **Cambio (Evacuación)**, desde la tarjeta de noche

**No lo tocan, aunque los hagas:**

- Un medicamento administrado
- Una nota en la Bitácora
- Unos vitales
- Un pañal registrado desde la vista Normal — ese se guarda como pañal **de día** y la ronda de noche no lo mira

Léelo despacio, porque es contra la intuición: si a las 2 AM escribes una nota larga y cuidadosa en la Bitácora de Elena, y no le pulsas ningún botón de su tarjeta de noche, **para la ronda no has pasado por su habitación**. La pastilla no se mueve.

De noche, entonces, el pañal se registra **desde la tarjeta de noche**. Que además es un toque en vez de cuatro.

La ronda no tiene ventana de tiempo. No hay una hora límite para completarla. Cuando la cierras, la pastilla pasa a **1 ronda** y empieza la siguiente.

Al completarla sale un aviso de Zendi que dice "El supervisor fue notificado". **Eso ya no pasa.** La campana por ronda completa se quitó en agosto de 2026 porque eran 820 avisos al mes que enterraban las alertas de verdad. El supervisor lo ve en su panel, en vivo, pero no recibe ningún aviso.

## Lo que ve tu supervisora

En su pantalla hay un bloque **Rondas de Cuidadores — Tiempo Real**. De noche el subtítulo dice "Guardia Nocturna · Rotaciones + Notas".

![El panel de la supervisora: cada cuidadora con su grupo de color, cuántas rondas lleva, el porcentaje de la ronda en curso y cuándo cerró la última.](/academy/capturas/supervisor-rondas.jpg)

Lo que ella lee es **un porcentaje de cobertura**, no una lista de faltas.

## La única alarma automática de la madrugada

Cada dos horas corre un proceso que busca residentes **de riesgo** —los que tienen rotación indicada, riesgo de piel por la escala de Norton o una úlcera activa— que lleven más de dos horas sin rotación.

Cuando encuentra uno, la campana suena **en supervisión y en las cuidadoras con turno abierto** — tú incluida. Como máximo un aviso por residente y por persona al día, para que la campana siga significando algo.

**Enfermería hoy no lo recibe.** Ese proceso busca a quien tenga enfermería como rol **principal**, y aquí nadie lo tiene así: quien hace enfermería es la directora, con enfermería como rol secundario, y el aviso no la alcanza. Así que si de madrugada hace falta enfermería de verdad, **se llama por teléfono**. No des por hecho que ya se enteró por la campana.

Ojo también con esto: **no todos los residentes necesitan rotación cada dos horas.** El sistema solo vigila a quien lo tiene indicado.

PREGUNTAS:
P: El reloj de 2 horas de la rotación, ¿desde cuándo cuenta?
a) Desde que empezó tu turno
*b) Desde la última rotación de ese residente
c) Desde las 10 de la noche, cuando entra el modo
d) Desde la última ronda completa de tu grupo
EXPLICACION: Es un reloj por persona: cada tarjeta lleva el suyo, y a las dos horas y tres minutos el botón cambia a Rotación VENCIDA — Ejecutar.

P: Una tarjeta se pone roja y el botón dice "Rotación VENCIDA — Ejecutar". ¿Qué significa?
a) Que el sistema ya avisó a la supervisora de guardia
b) Que la rotación la tiene que hacer enfermería
c) Que perdiste la ronda y queda marcada como MISSED
*d) Que ese residente lleva más de dos horas sin rotar
EXPLICACION: Es un aviso de la tarjeta para ti. No existe ningún estado MISSED de ronda y nadie recibe una alerta por ese cambio de color.

P: A las 2 AM escribes una nota en la Bitácora de Elena y no le pulsas nada en su tarjeta de noche. ¿Cuenta para tu ronda?
a) Sí, cualquier registro del expediente cuenta
b) Sí, si la escribes antes de que pasen dos horas
*c) No: de noche solo cuentan los cuatro botones
d) Solo cuenta si la marcas como alerta clínica
EXPLICACION: La ronda nocturna mira las rotaciones y las notas de ronda de la tarjeta de noche. La Bitácora, los medicamentos y el pañal de la vista Normal no mueven la pastilla.

P: El aviso de Zendi al completar una ronda dice "El supervisor fue notificado". ¿Es cierto?
*a) No: lo ve en su panel, pero no recibe ningún aviso
b) Sí, le llega un mensaje al teléfono
c) Sí, y se suma a tu score de la noche
d) No, salvo que la ronda pase de las 2
EXPLICACION: La campana por ronda completa se quitó en agosto de 2026 porque eran 820 avisos al mes; el progreso sigue vivo en Rondas de Cuidadores — Tiempo Real, que ella mira cuando quiere.

P: ¿Cuál es la única alerta automática que corre de madrugada?
a) La que avisa si no tocas la tableta en 90 minutos
b) La que escala al Director si nadie contesta a tiempo
*c) La que busca residentes de riesgo sin rotar
d) La que cierra tu turno solo si se te olvida firmarlo
EXPLICACION: Corre cada dos horas y mira a quien tiene rotación indicada, riesgo de Norton o úlcera activa. Suena en la campana de supervisión y de las cuidadoras con turno abierto; enfermería hoy no la recibe, así que si hace falta, se llama.

---SECCION_4---
LECTURA:
# A las tres de la mañana: la caída

El orden es el de siempre: **primero la persona, después el registro.**

Y una cosa que hay que entender bien: en Zendity **documentar es escalar**. No hay un botón de "escalar" después. El mismo envío que guarda la caída es el que avisa.

Ahora bien, **el formulario de la tableta no te lo dice**. Arriba solo pone el nombre del residente y **PROTOCOLO DE CAÍDA**. No busques en la pantalla una frase que te confirme quién recibe el aviso, porque no está. Pero pasa igual: en el mismo instante en que pulsas el botón rojo, supervisión, enfermería y dirección quedan avisadas.

## Por dónde entras de noche

La tarjeta de noche no tiene botón de caída. **Hay un solo camino que funciona**, y conviene aprendérselo ahora y no a las tres de la mañana:

> **Pulsa Normal en la barra, abre enseguida la tarjeta del residente y usa su botón Alerta Caída.** Una vez abierta, la tarjeta se queda abierta aunque el fondo vuelva al modo de noche.

Y un aviso que te ahorra un disgusto. En **Acciones**, en el menú de la izquierda, hay un botón grande y rojo que dice **Alerta Crítica: Caída**. **Por ahí no entres.** Ese botón abre el formulario **sin residente** —fíjate arriba: donde debería ir el nombre no hay nada— y al pulsar el botón rojo la caída no se guarda, no se avisa a nadie y **la pantalla no te enseña ningún error**. Parece que se envió. No se envió.

La regla, entonces, es de un vistazo: **si arriba del formulario no ves el nombre del residente, ciérralo y entra por su tarjeta.**

## El formulario

![El protocolo de caída de Rosa Medina: arriba el nombre, la casilla de la caída que te reportaron, debajo las tres preguntas que deciden la gravedad, y el botón rojo.](/academy/capturas/caidas-protocolo-tableta.jpg)

Arriba del todo, una casilla ámbar: **No la presencié — me la reportaron**. Si la marcas aparecen dos campos que solo tú sabes: **¿Quién te la reportó?** y **¿Cuándo fue?**.

Esto importa de noche más que en ningún otro turno, porque la caída de madrugada muchas veces se cuenta a la mañana siguiente. Si se registra con la hora de ahora, **el patrón de caídas de ese residente deja de leerse**.

Si la presenciaste, contestas tres cosas:

- ¿El residente reacciona y está consciente?
- ¿Hay sangrado avistable?
- Nivel de dolor vocalizado, de 0 a 10.

Y pulsas **Evaluar Riesgo y Enviar Alerta Roja**.

## Qué pasa en ese mismo segundo

- Queda la caída en el expediente, con tu nombre como quien la reporta.
- Se crea una evaluación de riesgo de caída y el residente queda marcado como riesgo.
- Se abre un ticket de triage en prioridad **crítica**.
- Queda la entrada de auditoría.
- Se avisa a **supervisión, enfermería y dirección, a la vez**.

## Y esto es lo que NO pasa, aunque te lo hayan contado

| Lo que SÍ hay | Lo que NO hay |
|---|---|
| Un aviso en la campana de la aplicación | Llamada, mensaje de texto o aviso al teléfono |
| Los tres roles avisados en el mismo instante | Un "supervisor de guardia" con 15 minutos para contestar |
| Un ticket crítico esperando en triage | Un salto automático al Director si nadie contesta |
| Tu registro, con tu nombre y la hora | Constancia de quién respondió ni de cuándo |

Léelo otra vez: **nadie deja rastro de si alguien contestó.** Si esa caída necesita una decisión esta misma noche, **la pides por teléfono**. El registro sirve para el expediente y para la mañana; no sustituye una llamada.

## En ese formulario no se escribe nada

**No hay campo de "acciones tomadas", ni de "estado del residente después", ni ningún cuadro de texto libre.** Míralo en la foto de arriba: la casilla ámbar, las tres preguntas, el botón rojo. Se acabó.

La línea que queda en el expediente la arma el sistema solo, con tus tres respuestas: "Residente sufrió caída. Consciente: Sí · Sangrado: No · Dolor: 4/10".

Entonces, ¿dónde cuentas lo que hiciste después —que lo levantaron entre dos, que no quiso volver a la cama, que le pusiste hielo en la cadera? En **Acciones**, en el menú de la izquierda, en **Cambio Clínico u Observación**. Ahí sí eliges al residente en una lista, eliges **Nota de turno** (la caída ya avisó a todo el mundo, no hace falta una alerta encima) y escribes con tus palabras. Hazlo **después** de mandar la alerta roja, nunca antes.

Y si se envía dos veces la misma caída en cinco minutos, la segunda **devuelve éxito con la que ya existe**: no se duplica y no tienes que hacer nada.

PREGUNTAS:
P: Encuentras a Pedro Santana en el suelo a las 3:10 AM. ¿Qué haces primero?
a) Registras la caída en la tableta y después lo atiendes
b) Llamas al supervisor y esperas su instrucción
*c) Lo atiendes, y después lo registras
d) Escribes la nota en la bitácora general del turno
EXPLICACION: Primero la persona. Y al registrarla ya queda escalada: el mismo envío avisa a supervisión, enfermería y dirección.

P: Estás en Night Rounds Mode y necesitas reportar la caída de Pedro. ¿Por dónde entras?
a) Por el botón Alerta Caída de la tarjeta de noche
b) Por Acciones, en el menú de la izquierda
c) Por Entregar Turno, que abre el formulario
*d) Vuelves a Normal y abres su tarjeta
EXPLICACION: La tarjeta de noche no tiene botón de caída, y el de Acciones abre el formulario sin residente: no guarda nada y no avisa. Si arriba no ves el nombre, ciérralo.

P: Mandas la alerta de caída. ¿Quién recibe el aviso y cómo?
a) El supervisor de guardia, por notificación al teléfono
b) Enfermería primero, y el Director si nadie contesta
c) Solo la supervisora, que decide a quién más avisar
*d) Supervisión, enfermería y dirección, a la vez, dentro de la aplicación
EXPLICACION: Los tres roles reciben la misma fila de notificación en la campana. No hay aviso al teléfono ni mensaje de texto: si necesitas respuesta ya, llama.

P: El curso viejo decía que el supervisor tiene 15 minutos para contestar y que si no, se escala al Director. ¿Qué pasa de verdad?
a) Son 30 minutos, no 15, y escala a enfermería
*b) No hay ningún plazo ni ninguna cadena
c) El plazo existe solo para las caídas con sangrado
d) El plazo lo fija la supervisora al empezar la noche
EXPLICACION: Nadie deja constancia de quién respondió ni cuándo. Si la caída necesita una decisión esa misma noche, se pide por teléfono.

P: En el formulario de caída de la tableta buscas dónde escribir lo que hiciste después. ¿Dónde va?
a) En el campo Acciones tomadas, debajo del dolor
b) En Observaciones adicionales, al final del formulario
*c) En ningún sitio: ese formulario no tiene dónde escribir
d) En un paso siguiente, justo después de enviar la alerta roja
EXPLICACION: Solo tiene la casilla, las tres preguntas y el botón rojo; la línea del expediente la arma el sistema. Lo que quieras contar va por Acciones, en Cambio Clínico u Observación, que sí tiene residente y cuadro de texto.

---SECCION_5---
LECTURA:
# Entregar el turno

## A las 6:00 no se abre nada solo

No hay ninguna pantalla que aparezca a las seis. El cierre lo abres **tú**, con **Entregar Turno**, el botón de borde blanco de la barra de arriba, que está ahí toda la noche.

Se abre el asistente **Cierre de turno — reporte para el próximo equipo**, con el cartel ámbar: "Tu turno se cierra cuando firmes este reporte". Ojo con esa frase, que se queda corta: firmar es el **penúltimo** paso. Abajo lo vemos.

Y arriba, en tres números, lo que va a pasar:

1. **Lees y firmas** tu reporte aquí.
2. Le llega al **supervisor** para su firma.
3. El **próximo turno** lo recibe al entrar.

![El asistente de cierre. A la izquierda el Paso 1, que sale en Estado Limpio con 0 tareas siempre. A la derecha el reporte de Zendi con sus cuatro contadores y la casilla que hay que marcar antes de poder firmar.](/academy/capturas/care-turno-entregar.jpg)

## Paso 1 — Pendientes de tu turno

Te va a salir **Estado Limpio**, con **0 TAREAS**. Siempre. No casi siempre: todas las noches, y también de día.

No es un premio y **no es una comprobación de tu trabajo**: ese panel no está conectado a nada. Nadie le manda pendientes, así que no puede decir otra cosa. El asistente lleva por dentro tres botones —Rehusó, Durmió, Trasladar— que en la práctica no vas a ver nunca.

Dicho claro: **un Estado Limpio no significa que no dejaste nada pendiente.** Lo que de verdad quedó de tu noche está en el Paso 2, en el texto del reporte y en la lista de medicamentos omitidos. Ahí es donde hay que mirar.

## Paso 2 — Tu Reporte de Turno

Zendi arma el texto con lo que **tú** hiciste, y arriba pone cuatro contadores: **MEDS, BAÑOS, COMIDAS, VITALES**.

En una guardia, Baños y Vitales normalmente salen en cero. **Ese es el número correcto**, no una falta tuya: de noche no se baña a nadie y no se abren órdenes de vitales.

Léelo entero. Puedes corregir el texto si algo está mal — y este es el sitio donde escribir lo que la tableta no supo recoger, como un cambio que hiciste a las 12:40 y registraste a las 2:00. Y hay una casilla obligatoria: **He leído y confirmo que este reporte es correcto**. Es la única puerta que desbloquea la firma.

## Paso 3 — Firma con el dedo

Un recuadro punteado y tu trazo. Dos cosas:

- **Si editas el texto después de firmar, la firma se borra** y hay que firmar otra vez. Es a propósito: firmas lo que leíste.
- Los medicamentos que omitiste salen solos, con el motivo que escribiste. Léelos antes de firmar.

## Firmar no es cerrar

Aquí es donde se cae la gente, y es la parte más cara de todo el curso.

Firmas, sale en verde **Firma registrada**, y **todavía no ha pasado nada**. Tu turno sigue abierto.

Debajo de la firma quedan dos actos más, y los dos son obligatorios:

1. Marcar la casilla **Certifico bajo penalidad normativa que este traspaso es verídico y las rondas fueron ejecutadas.**
2. Pulsar el botón verde **CONFIRMAR CIERRE DE TURNO**.

Hasta que no pulsas ese botón, tu relevo no sale de la tableta y tu sesión sigue contando como abierta — con todo lo que viene aquí abajo, y con el agravante de que tú te fuiste creyendo que habías cerrado.

**Baja hasta el final de la pantalla. Si el botón verde todavía está gris, te falta algo.**

![Lo de abajo del cierre: primero la firma, después la casilla Certifico bajo penalidad normativa, y solo entonces el botón CONFIRMAR CIERRE DE TURNO. Mientras ese botón esté gris, el turno sigue abierto.](/academy/capturas/cierre-paso-3-firma.jpg)

## Qué genera tu cierre, y qué no

| Tu cierre SÍ genera | Tu cierre NO genera |
|---|---|
| Tu relevo firmado, con tu nombre y tu reporte | El Prólogo del Día de la sede |
| El texto que lee quien entra detrás de ti | Ningún score de cumplimiento nocturno |

El **Prólogo del Día** lo arma un proceso a las 6:00 AM, cierres o no cierres, y es de la sede entera. Y no existe un "score nocturno": hay **un solo número de cumplimiento por persona**, que sale de base 75 y se recalcula una vez al día de madrugada.

## Si te vas sin cerrar

No te bloquean nada. Pasa esto, que es peor y más callado:

- **El turno que entra no recibe tu relevo.** No se transfiere nada de forma automática, ni con prioridad ni sin ella. Entra a ciegas.
- Tu sesión se queda abierta: a las 12 horas sale en el panel del supervisor y a las 14 la cuenta el proceso de salud.
- En tu número de cumplimiento resta **10 puntos** como sesión sin cerrar — junto con el relevo incompleto, lo que más pesa de todo.
- Queda contado en **Mi Desempeño**, en "Turnos cerrados con el relevo: X de Y".

PREGUNTAS:
P: Son las 6:00 AM. ¿Qué te abre Zendity sola?
*a) Nada: el cierre lo abres tú
b) La pantalla de cierre con el resumen de la noche
c) El Prólogo del Turno para la cuidadora que entra
d) La lista de items MISSED que dejaste pendientes
EXPLICACION: No hay temporizador: el asistente se abre al pulsar Entregar Turno, el botón de la barra de arriba, y está ahí toda la noche.

P: En el Paso 2 el contador de BAÑOS te sale en cero. ¿Qué haces?
a) Marcas un baño para que no quede en cero
b) Escribes en el texto que la tableta se equivocó
*c) Nada: en guardia no se bañan residentes
d) Avisas a la supervisora antes de poder firmar
EXPLICACION: Los cuatro contadores son de lo que hiciste; un cero en Baños o en Vitales de madrugada es el número correcto.

P: Firmas, y luego ves un error en el texto y lo corriges. ¿Qué pasa con la firma?
a) Se queda: el texto y la firma van por separado
*b) Se borra y hay que firmar otra vez
c) La tiene que volver a autorizar la supervisora
d) El reporte se manda con la versión anterior
EXPLICACION: Es a propósito: lo que queda firmado tiene que ser exactamente lo que leíste.

P: Firmas el recuadro, cierras la tableta y te vas a las 6:15. ¿Qué pasa con tu relevo?
*a) No sale: tu turno no se cerró
b) Le llega al turno que entra
c) Lo firma la supervisora por ti
d) Se manda solo cuando salgas
EXPLICACION: Firmar no cierra. Falta marcar Certifico bajo penalidad normativa y pulsar CONFIRMAR CIERRE DE TURNO. Sin eso la sesión queda abierta, el turno que entra no recibe nada y restan 10 puntos.

P: ¿Qué genera de verdad tu cierre de turno?
a) El Prólogo del Día que oye el turno de mañana
*b) Tu relevo firmado, con tu nombre y tu reporte
c) Un score de cumplimiento nocturno para el supervisor
d) La lista de rondas que le faltan al turno diurno
EXPLICACION: El Prólogo del Día lo arma un proceso a las 6:00 AM, cierres o no, y es de la sede entera; lo tuyo es el relevo individual.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 14: PLANTA FISICA Y MANTENIMIENTO EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'PLANTA_FISICA_101',
    title: 'Planta Fisica y Mantenimiento en Zendity',
    description: 'Gestion de mantenimiento en Zendity: tickets de dano, mantenimiento preventivo, SLA y emergencias de infraestructura.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🔧',
    category: 'Operaciones de Piso',
    order: 8,
    content: `---META---
TITULO: Planta Fisica y Mantenimiento en Zendity
PROMPT_ZENDI: Evalúa si la persona de mantenimiento sabe leer su Cola de Trabajo, mover un aviso con Iniciar y Marcar Resuelto, entender que la tarjeta no trae ni severidad ni plazo, y nombrar lo que Zéndity no hace y hay que hacer por fuera.
TERMINOS_CLAVE: Planta Física, Cola de Trabajo, Nuevas, Trabajando, Resueltos, Iniciar, Marcar Resuelto, Actualizar, pastilla de ubicación, Pendientes, En progreso, Resueltos hoy, Incidente de Mantenimiento, sin SLA automático, Inbox Operativo, Academy
PREGUNTA_REFLEXION: Piensa en la última avería que arreglaste sin que nadie la hubiera escrito en la tableta. Quién la vio primero, cómo te enteraste tú, y qué tendría que haber pasado para que ese arreglo quedara escrito en algún sitio?

---SECCION_1---
LECTURA:
# Tu pantalla es una sola: la Cola de Trabajo

Cuando entras a Zéndity con tu usuario no hay menú, ni pestañas, ni un panel con submódulos. Caes directo en **Planta Física / Mantenimiento**, y eso es todo lo que tienes.

Tu usuario abre **dos direcciones y ninguna más**: esta pantalla y **Academy**, que es donde estás leyendo esto. Si intentas abrir cualquier otra, Zéndity te devuelve aquí sin decirte nada. No es un fallo ni un permiso que falte: está hecho así.

## Lo que hay en la barra oscura de la izquierda

- **Planta Física · MANTENIMIENTO**, con la llave inglesa naranja.
- **EN TURNO** y tu nombre debajo.
- Tres contadores: **Pendientes**, **En progreso** y **Resueltos hoy**.
- Abajo del todo, **Salir**.

Ese "EN TURNO" engaña. En mantenimiento **no se ficha turno**: no hay apertura, ni cierre, ni relevo, ni firma. La barra solo dice quién tiene la sesión abierta en esa tableta.

## Los contadores

| Lo que SÍ significa | Lo que NO significa |
|---|---|
| **Pendientes** es cuántas tarjetas hay en Nuevas | No es un plazo, ni una cuenta atrás, ni una urgencia |
| **En progreso** es lo que se empezó desde esta pantalla y no se ha cerrado | No es trabajo que alguien te asignó a ti |
| **Resueltos hoy** son hasta veinte avisos ya cerrados de tu sede | Ni son de hoy, ni son los últimos que cerraste |

Ese tercer rótulo dice "hoy" y el dato no lo es. Si alguien te pregunta cuántas averías cerraste hoy, ese número no te lo contesta.

Y hay un detalle que conviene saber para no asustarse. Esos veinte **se escogen por la fecha en que se reportó el aviso, no por la fecha en que lo cerraste**: Zéndity ordena los avisos de tu sede del más nuevo al más viejo y se queda con los primeros veinte que ya estén cerrados.

Así que si hoy cierras una bombilla que se reportó anteanoche, y por delante hay veinte cierres de avisos más nuevos, esa tarjeta **no sale en Resueltos ni suma en el contador**. Salió de Trabajando y parece que se perdió. No se perdió: ya no cabe en esa lista.

## La parte de la derecha

Arriba, **Cola de Trabajo** y un botón **Actualizar**. Debajo, tres columnas:

| Columna | Qué hay dentro |
|---|---|
| **Nuevas** | Lo que el piso reportó y nadie ha tocado. Si está vacía dice "Sin averías" |
| **Trabajando** | Lo que ya se empezó. Si está vacía dice "Nada en progreso" |
| **Resueltos** | Lo ya cerrado, con el título tachado. Hasta veinte, y no son los veinte últimos cierres |

**La pantalla no se refresca sola.** Carga cuando la abres y se queda quieta. Si el piso reporta una fuga mientras tú la miras, no aparece hasta que pulsas **Actualizar**.

Y solo ves lo de **tu sede**. Cupey ve lo de Cupey y Mayagüez lo de Mayagüez, aunque las dos usen la misma aplicación.

![La Cola de Trabajo entera: a la izquierda los tres contadores, a la derecha las columnas Nuevas, Trabajando y Resueltos. El botón Actualizar es lo único que trae avisos nuevos a esta pantalla.](/academy/capturas/mantenimiento-cola.jpg)

PREGUNTAS:
P: Llevas media hora con la pantalla abierta y quieres ver si entró algo. Qué haces?
a) Esperas, porque la pantalla se refresca sola cada minuto
*b) Pulsas Actualizar, arriba a la derecha
c) Sales con el botón Salir y vuelves a entrar
d) Llamas a la supervisora para que te lo diga
EXPLICACION: La cola carga al abrirla y no vuelve a mirar por su cuenta; Actualizar es lo único que trae lo que haya entrado desde entonces.

P: La barra de la izquierda dice EN TURNO y tu nombre. Qué significa eso?
a) Que fichaste el turno y ya corre tu horario
b) Que la supervisora te asignó este turno hoy
c) Que tienes avisos nuevos sin abrir
*d) Que esa es la sesión abierta ahora mismo
EXPLICACION: En mantenimiento no hay apertura ni cierre de turno en Zéndity; la barra solo dice quién entró con su usuario.

P: El contador Resueltos hoy dice 2. Qué estás leyendo de verdad?
*a) Avisos ya cerrados de tu sede, de cualquier día
b) Los avisos que cerraste tú en el día de hoy
c) Los que la supervisora dio por buenos hoy
d) Los que llevan más de un día sin tocarse
EXPLICACION: Se ordenan los avisos de la sede del más nuevo al más viejo y se toman veinte que ya estén cerrados; ni son de hoy, ni son tus últimos cierres.

P: Escribes en la tableta la dirección de otra pantalla de Zéndity. Qué pasa?
a) Te pide la contraseña de la supervisora
b) Entras, pero sale vacía y no puedes tocar nada
*c) Te devuelve a la Cola de Trabajo
d) Se abre con los avisos de las dos sedes juntas
EXPLICACION: Tu usuario solo abre Planta Física y Academy; cualquier otra dirección te rebota a tu cola.

P: Qué avisos ves en tu Cola de Trabajo?
a) Todos los del sistema, de las dos sedes
*b) Solo los avisos de la sede donde trabajas tú
c) Solo los que te asigne la supervisora
d) Solo los que traigan foto adjunta
EXPLICACION: La cola se arma con la sede de tu sesión; lo de la otra sede no entra aunque alguien lo pida.

---SECCION_2---
LECTURA:
# De dónde sale un aviso, y por qué tú no puedes escribirlo

Un aviso de mantenimiento **nace en la tableta del piso**, no en la tuya. La cuidadora abre **Acciones**, que le abre **Operaciones Centrales**, y ahí pulsa el cuadro gris **Incidente de Mantenimiento** ("Derrames, Luces, Limpieza").

## Quién puede levantarlo

Cuidadoras, enfermería, supervisión y dirección. **Nadie más.** Cocina, limpieza y **mantenimiento** no están en esa lista: tu usuario no abre esa pantalla y el servidor tampoco te aceptaría el envío.

Dicho claro, porque es la cosa que más sorprende de este módulo: **tú no puedes crear un aviso en Zéndity.** Si eres tú quien ve la gotera, se lo dices a quien esté en el piso y lo levanta desde su tableta.

## Lo que rellena quien reporta

| Campo | Cómo es |
|---|---|
| **Área / Zona** | Siete botones: Habitación, Baño, Sala Común, Cocina, Pasillo, Oficina, Exterior. Opcional |
| **Habitación / Número** | Texto libre. Pone "(opcional)" en la propia pantalla |
| **Tipo de incidente** | Etiquetas que se tocan: Derrame Líquido, Foco Fundido, Baño Tapado, Fallo TV/AC, Puerta Rota, Filtración Agua, Olor Fuerte, Equipo Averiado |
| **Detalle Final** | El texto. **Lo único obligatorio** |
| **Evidencia Fotográfica (Opcional)** | Una foto. Una sola, y opcional |

Al final pulsa **Generar Ticket Operativo** y ya está en tu columna Nuevas.

## Lo que ves tú en la tarjeta

- La **hora** a la que se escribió, arriba.
- La **pastilla naranja** con el sitio: "Baño · Hab. 204". Eso es el Área y el número que **escogió quien reportó**. Si escogió mal, está mal: Zéndity no lo comprueba contra nada.
- El **título y el detalle**, con sus palabras.
- La **foto**, si la puso. Muchas veces no la hay, y no significa nada: es opcional.

**Lo que NO trae la tarjeta, porque no existe:**

- **Severidad.** Ni baja, ni media, ni alta, ni crítica. El formulario manda siempre el mismo valor y el servidor lo tira a la basura.
- **Plazo.** No hay fecha límite ni reloj corriendo.
- **Autor.** El aviso no guarda quién lo escribió. Si necesitas preguntar, te guías por el sitio y la hora.

Los avisos de Nuevas salen **por hora, el más reciente arriba**. Ese es todo el orden que hay. Cuál es más urgente lo decides tú leyéndolos.

![Una tarjeta de la columna Nuevas: la hora, la pastilla naranja con el sitio que escogió quien reportó, el texto con sus palabras y el botón naranja Iniciar.](/academy/capturas/mantenimiento-aviso-nuevo.jpg)

PREGUNTAS:
P: Quién puede levantar un aviso de mantenimiento en Zéndity?
a) Cualquier empleado que tenga usuario, cocina y limpieza incluidas
b) Solo la supervisora y la directora
*c) El piso: cuidadoras, enfermería, supervisión y dirección
d) Tú mismo, desde la Cola de Trabajo
EXPLICACION: El curso viejo decía que cualquier empleado podía, y no es así: el servidor solo acepta esos cuatro roles, y el tuyo no está.

P: La tarjeta trae la pastilla naranja "Baño · Hab. 204". De dónde salió eso?
*a) Lo escogió quien reportó el aviso en su tableta
b) Lo pone Zéndity leyendo el texto del aviso
c) Lo añade la supervisora al despacharlo
d) Sale del expediente del residente de esa habitación
EXPLICACION: Son dos controles del formulario del piso, y nadie los comprueba: si la persona marcó Baño cuando era el pasillo, ahí se queda.

P: Qué es obligatorio para que el piso pueda enviar el aviso?
a) La foto de la avería y el área donde está
b) El área, el número de habitación y el tipo
c) La firma de la supervisora de turno
*d) Solo el texto de lo que pasa
EXPLICACION: El botón se desbloquea con la descripción; la foto pone "Opcional" en la pantalla y el área son botones que se pueden dejar sin tocar.

P: Te llega un aviso sin foto. Qué quiere decir?
a) Que el piso se saltó un paso obligatorio
*b) Que la foto es opcional y no la pusieron
c) Que la avería es de las leves
d) Que la foto se sube cuando lo cierres tú
EXPLICACION: La foto nunca fue obligatoria ni al abrir ni al cerrar, y un aviso sin ella no dice nada sobre lo grave que sea.

P: En qué orden te salen los avisos en la columna Nuevas?
*a) Por hora, el más reciente arriba
b) Por gravedad, lo crítico primero de todo
c) Por antigüedad, lo que lleva más tiempo esperando
d) Por planta, empezando por la segunda
EXPLICACION: No hay severidad que ordenar ni plazo que vencer: la cola va por fecha y la lectura la haces tú.

---SECCION_3---
LECTURA:
# Los dos botones: Iniciar y Marcar Resuelto

Toda tu pantalla son dos botones. No hay más.

## Iniciar, el naranja

Sale en las tarjetas de **Nuevas**. Al pulsarlo:

1. La tarjeta se va a **Trabajando** y se queda con el borde naranja.
2. El aviso queda **a tu nombre**, aunque la tarjeta no te lo enseñe.
3. Los contadores de la izquierda se mueven: uno menos en Pendientes, uno más en En progreso.

No te pregunta nada. No hay que apuntar una hora, ni escoger nada, ni avisar a nadie.

## Marcar Resuelto, el verde

Sale en las tarjetas de **Trabajando**. Al pulsarlo la tarjeta se va a **Resueltos**, con el título tachado y una línea verde: **"Resuelto en 45 min"**.

| Lo que pide para cerrar | Lo que NO pide |
|---|---|
| Un toque en el botón verde | Foto del arreglo terminado |
| Nada más | Checklist de seguridad |
| | Firma de nadie |
| | Aprobación de la supervisora |

El curso viejo enseñaba que **sin la foto de cierre el aviso no se podía cerrar**. Es lo contrario: cerrar no pide absolutamente nada. Si quieres que quede constancia de cómo quedó, la foto se la tiene que hacer alguien y guardarla fuera de Zéndity, porque aquí no hay dónde ponerla.

## Los minutos de la línea verde

"Resuelto en 45 min" **no es lo que tú tardaste trabajando**. Se cuenta desde que el piso escribió el aviso hasta que tú pulsaste el botón verde. Si una bombilla se reportó anteanoche y la cambias hoy en cinco minutos, la tarjeta dirá que tardó dos mil y pico minutos.

Es la única medida de tiempo que existe en este módulo, se calcula **después** de cerrar, y no hay ningún reloj corriendo mientras el aviso está abierto.

## No hay vuelta atrás

No hay botón para devolver un aviso de **Trabajando** a **Nuevas**, ni para reabrir uno resuelto. Tampoco lo tiene la supervisora ni la directora: esa pantalla no existe para nadie.

Si pulsas Resuelto por error, lo único que se puede hacer es **decirlo** y que el piso levante el aviso otra vez.

Y si te quedas esperando una pieza, el aviso se queda en **Trabajando** y no hay dónde escribir por qué. No existe "esperando materiales" ni ningún estado intermedio. Eso se dice hablando.

![Una tarjeta ya cerrada: título tachado, el sitio arriba y la línea verde con los minutos. Esos minutos se cuentan desde que se escribió el aviso, no desde que tú empezaste.](/academy/capturas/mantenimiento-resuelto.jpg)

PREGUNTAS:
P: Pulsas Marcar Resuelto en la silla de ruedas del comedor. Qué pasa en ese momento?
*a) Pasa a Resueltos, con el título tachado y los minutos
b) Te pide una foto del arreglo terminado
c) Te pide un checklist de seguridad firmado
d) Espera a que la supervisora lo confirme
EXPLICACION: El cierre es un toque: la tarjeta cambia de columna y se le calcula el tiempo, sin pedir nada más.

P: Una tarjeta dice "Resuelto en 45 min". Qué midió Zéndity?
a) Los minutos que estuviste trabajando en esa avería
b) Los minutos que te sobraron antes del plazo
*c) Desde que lo escribieron hasta que lo cerraste
d) Lo que tarda de media el hogar en atender un aviso
EXPLICACION: Se calcula al pulsar el botón verde, restando la hora en que el piso lo reportó: un aviso viejo cerrado hoy sale con miles de minutos.

P: Iniciaste por error un aviso que no te tocaba. Cómo lo devuelves a Nuevas?
a) Con el botón Deshacer de la tarjeta
*b) No se puede: se queda en Trabajando
c) Cerrando sesión antes de que se guarde
d) Pidiéndoselo a la supervisora, que sí tiene ese botón
EXPLICACION: No existe esa marcha atrás en ninguna pantalla, ni en la tuya ni en la de supervisión.

P: Estás parado esperando una pieza que no llegó. Dónde lo escribes en Zéndity?
a) En la columna Esperando materiales
b) En una nota dentro de la tarjeta del aviso
c) En el campo de cotización del aviso
*d) En ninguno: eso se dice hablando
EXPLICACION: Los estados son tres y no hay nota ni comentario en la tarjeta; el aviso se queda en Trabajando sin poder decir por qué.

P: Qué necesitas para cerrar un aviso?
a) Una foto del antes y otra del después
b) La firma digital de quien lo reportó
*c) Nada más que pulsar el botón verde
d) El visto bueno de la directora
EXPLICACION: Cerrar no pide evidencia ninguna, así que la prueba de que se hizo bien no la guarda el sistema.

---SECCION_4---
LECTURA:
# Quién más ve tu trabajo

El mismo aviso se escribe **en dos sitios a la vez**: tu tarjeta en la Cola de Trabajo, y un ticket para dirección en el **Centro de Triage**.

## La supervisora

Su pantalla es el **Inbox Operativo**, y ahí hay una pestaña que se llama **Mantenimiento**. Está en cero, y **no puede subir de ahí.**

No es que hoy no haya averías. Es que ese panel se arma con cuatro cosas y ninguna es la tuya: caídas, incidentes clínicos, alertas clínicas del piso y rotaciones de úlcera vencidas. Un Incidente de Mantenimiento no entra ahí por ningún lado. La pestaña se quedó de una versión anterior, y el propio código lo dice con todas las letras: mantenimiento tiene su canal propio. Ese canal propio es tu cola.

Así que quítate esta idea de la cabeza: **nadie revisa los avisos y te los reparte.** No hay despacho, ni asignación, ni quien decida qué te toca primero. Eso lo lees tú en Nuevas.

Lo que sí puede hacer la supervisora —y dirección— es **abrir tu misma Cola de Trabajo** desde su menú. No es otra pantalla: es esta, con las mismas tres columnas y los mismos dos botones. Si alguna vez ves una tarjeta que se movió sola, fue una de ellas.

Y **tu pantalla no tiene campana.** La Cola de Trabajo no enseña notificaciones en ningún sitio, y Zéndity no manda correos ni mensajes al teléfono por una avería.

**Lo único que te dice que hay trabajo es la columna Nuevas cuando pulsas Actualizar.** Ni tu teléfono va a sonar, ni te va a entrar un correo. Si te acostumbras a esperar un aviso, vas a esperar sentado.

## Dirección

Ve el mismo reporte como un ticket en el **Centro de Triage**, una pantalla que en su propio encabezado avisa: "Seguimiento de reportes clínicos, mantenimiento y familiares — **sin SLA automático**".

Y hay una cosa que conviene tener clara antes de que pase:

**Cuando pulsas Marcar Resuelto se apaga tu tarjeta, no la de dirección.** El ticket del Centro de Triage lo cierra dirección por su lado. Si la directora te dice que lo sigue viendo abierto, no es que no lo hicieras: es que son dos filas distintas y cada una se cierra donde vive.

## Quien lo reportó

No se entera. La cuidadora que escribió el aviso no tiene pantalla donde ver que ya lo arreglaste.

Así que si el arreglo cambia su trabajo —el baño de la 204 ya se puede usar, la cama de la 112 ya aguanta— **díselo tú, o díselo a la supervisora**. El sistema no lo va a hacer por ti.

![El Inbox Operativo de la supervisora: las tres tarjetas que se ven son clínicas y la pestaña Mantenimiento marca 0. Ahí se queda, siempre: por este panel no pasa ningún aviso de avería.](/academy/capturas/supervisor-inbox-operativo.jpg)

PREGUNTAS:
P: La pestaña Mantenimiento del Inbox Operativo de la supervisora está en 0. Por qué?
a) Porque hoy no se ha reportado ninguna avería
b) Porque ella ya te despachó todo lo que había
c) Porque solo cuenta lo que lleva más de un día
*d) Porque por ese panel no pasan avisos de avería
EXPLICACION: Ese panel se arma con caídas, incidentes, alertas clínicas y rotaciones vencidas; tu aviso no es ninguna de esas cosas, así que esa pestaña se queda en cero siempre.

P: Entonces, cómo te enteras de que hay trabajo nuevo?
a) Te avisa la campana de la aplicación
*b) Abriendo tu cola y pulsando Actualizar
c) Por el correo del hogar, cada mañana
d) Cuando la directora lo aprueba y te lo manda
EXPLICACION: Mirar la columna Nuevas es la única vía real; por eso conviene entrar y actualizar varias veces al día.

P: Cerraste un aviso y la directora lo sigue viendo abierto. Por qué?
a) Porque no pusiste foto al cerrarlo
b) Porque hay que esperar a que acabe el turno
*c) Porque su ticket lo cierra ella por su lado
d) Porque lo cerraste después del plazo marcado
EXPLICACION: El reporte vive en dos filas —la tuya y la del Centro de Triage— y cerrar una no cierra la otra.

P: Arreglaste el inodoro de la 204. Quién avisa a la cuidadora que lo reportó?
*a) Nadie: se lo dices tú o la supervisora de turno
b) Zéndity, en cuanto la tarjeta pasa a Resueltos
c) Le sale en la tableta al abrir su turno
d) Lo lee en el relevo de la noche
EXPLICACION: Quien reporta no tiene ninguna pantalla que le enseñe el cierre, así que el aviso de vuelta es de boca.

P: Dónde ve dirección estos avisos?
a) En la misma Cola de Trabajo que tú
b) En el panel de la familia
c) En el horario de la semana
*d) En el Centro de Triage, sin plazo automático
EXPLICACION: Es la pantalla de seguimiento de dirección, y su propio encabezado avisa de que ahí no corre ningún SLA.

---SECCION_5---
LECTURA:
# Lo que Zéndity no hace, y lo que haces tú en su lugar

Hasta hoy este curso enseñaba un módulo que no existe. Vale la pena verlo en una tabla, porque lo que aprendiste antes puede hacerte esperar cosas que no van a llegar.

| Lo que se enseñaba antes | Lo que hay de verdad |
|---|---|
| Severidad baja, media, alta y crítica | No hay severidad. El campo no existe en la tarjeta ni en la base |
| SLA de 72, 48, 24 y 4 horas | No hay ningún plazo. La pantalla de dirección lo dice: sin SLA automático |
| Escalado automático al Director al pasarse el plazo | No existe. Un aviso puede estar semanas en Trabajando y no pasa nada |
| Calendario de mantenimiento preventivo e inspecciones | No hay. Zéndity solo recoge lo que ya se rompió |
| Cotización aprobada por el Director antes de empezar | No hay cotización, ni presupuesto, ni aprobación de nada |
| Foto obligatoria al cerrar | Cerrar no pide nada |
| Estados "esperando materiales" y "esperando cotización" | Tres estados: Nuevas, Trabajando, Resueltos |
| Botón de Emergencia de Infraestructura | No existe ese botón en ninguna pantalla |
| Aviso automático a las agencias reguladoras | **Zéndity no manda nada a ninguna agencia. Nunca** |

## La última fila es la que importa

Si el personal cree que el sistema notifica solo a las agencias, **nadie las notifica**. Esa es una obligación del hogar y la cumple una persona, con un teléfono o un formulario, fuera de Zéndity. El sistema no lo hace y tampoco avisa de que no lo ha hecho.

## Una emergencia de verdad

Una fuga a las once de la noche, un apagón con el generador caído, algo que pone en riesgo a un residente.

En Zéndity **no hay botón de emergencia**. El hub del piso tiene sus cuadros —Cambio Clínico, Señalamiento de Familia, Incidente de Mantenimiento, Alerta Piel, Medicamento sin administrar, Alerta Crítica de Caída— y ninguno es de infraestructura urgente. Una fuga se reporta por el mismo cuadro gris que una bombilla fundida.

Así que el orden es este, y es de sentido común, no de software:

1. **Contener** lo que se pueda: cerrar la llave, sacar la corriente, acordonar el sitio.
2. **Llamar** a la supervisora de turno y, si toca, a dirección. Por teléfono. Zéndity no despierta a nadie.
3. Que el aviso **se escriba después**, para que quede, aunque ya esté resuelto.

Ese tercer paso parece de relleno y no lo es: lo que no se escribe no existe cuando alguien pregunta seis meses después cuántas veces se ha roto esa tubería.

## Y la familia

Zéndity no le cuenta nada a la familia sobre averías. No hay aviso, ni correo, ni nota en su portal. Si un familiar tiene que enterarse de algo, lo llama una persona.

## Tu otra pantalla

Academy es la segunda y última dirección que abre tu usuario. Aquí se ve lo que llevas aprobado y lo que el hogar te asignó. Este curso vale diez puntos de cumplimiento, y desde hoy valen por saber usar lo que hay.

![La entrada de Academy: arriba el expediente de quien entra con los cursos aprobados, y abajo en ámbar la formación que le asignó su supervisión.](/academy/capturas/academy-entrada.jpg)

PREGUNTAS:
P: Hay una fuga de agua a las once de la noche. Qué hace Zéndity por ti?
*a) Nada: no hay botón de emergencia en ninguna pantalla
b) Llama al Director y al contacto de guardia
c) Sube el aviso a severidad crítica
d) Avisa a la agencia si hay residentes cerca
EXPLICACION: Ningún cuadro del hub del piso es de emergencia; una fuga entra por el mismo sitio que una bombilla fundida.

P: Y entonces, qué haces tú a las once de la noche?
a) Lo escribes en tu cola y esperas a mañana
b) Esperas a que alguien del piso lo reporte
c) Lo dejas anotado en un papel y te vas
*d) Contienes lo que puedas y llamas por teléfono
EXPLICACION: Contener, llamar y que el aviso se escriba después; el sistema no despierta a nadie de madrugada.

P: Una avería afecta la habitación de un residente. Quién avisa a las agencias reguladoras?
a) Zéndity, en cuanto se marca el aviso
*b) Una persona: el sistema no manda nada
c) La supervisora desde su Inbox Operativo
d) Dirección, al cerrar el ticket del Centro de Triage
EXPLICACION: Es la peor cosa que enseñaba el curso viejo: si se da por hecho que el sistema notifica, no lo hace nadie.

P: Qué hay en Zéndity de mantenimiento preventivo?
a) Un calendario con inspecciones semanales y mensuales
b) Una lista de extintores y detectores por revisar
*c) Nada: solo se recoge lo que ya se rompió
d) Un aviso automático cada tres meses
EXPLICACION: No hay calendario, ni frecuencias, ni tareas que se generen solas: la cola es reactiva de principio a fin.

P: Un aviso lleva dos semanas en Trabajando. Qué hace el sistema?
a) Lo marca vencido y avisa a la supervisora
b) Lo devuelve a Nuevas para que alguien lo tome
c) Se lo escala a la directora en rojo
*d) Nada. Sigue ahí hasta que lo cierres
EXPLICACION: No hay plazo que vencer ni escalado que dispararse; lo único que mueve esa tarjeta eres tú.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 15: LIMPIEZA Y SANITIZACION EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'LIMPIEZA_101',
    title: 'Limpieza y Sanitizacion en Zendity',
    description: 'Protocolo de limpieza en Zendity: registro de areas, evidencia fotografica, solicitudes urgentes y metricas de desempeno.',
    durationMins: 20,
    bonusCompliance: 10,
    emoji: '🧹',
    category: 'Tecnologia Zendity',
    order: 15,
    content: `---META---
TITULO: Limpieza y Sanitizacion en Zendity
PROMPT_ZENDI: Evalua si el empleado comprende el flujo de trabajo de limpieza en Zendity, incluyendo registro de areas, evidencia fotografica obligatoria y metricas de cumplimiento.
TERMINOS_CLAVE: Mi Turno, area registrada, evidencia fotografica, solicitud urgente, SLA 45 minutos, metricas de desempeno, Zendi logica de evidencia, historial de limpieza, score de cumplimiento, pendientes
PREGUNTA_REFLEXION: Terminaste de limpiar el comedor pero el sistema no te deja marcar el area como completada porque falta la foto de evidencia. Que haces?

---SECCION_1---
LECTURA:
# El Modulo de Limpieza en Zendity

El modulo de Limpieza en Zendity gestiona todo el flujo de trabajo de sanitizacion del hogar de cuido. Este modulo fue disenado para garantizar que cada area del hogar se limpie con la frecuencia correcta y con evidencia verificable. El modulo se centra en la pantalla Mi Turno, donde cada empleado de limpieza ve sus areas asignadas para el dia, con horarios especificos y niveles de prioridad. Las areas se clasifican en tres categorias: areas de residentes (habitaciones y banos), areas comunes (comedor, sala, pasillos) y areas de servicio (cocina, lavanderia, almacen). Cada categoria tiene frecuencias de limpieza distintas y estandares de sanitizacion especificos. Zendity no permite que un area se marque como limpia sin evidencia fotografica. Esta regla, conocida internamente como la Zendi logica de evidencia, existe porque las agencias reguladoras exigen prueba documental de cumplimiento sanitario. El modulo tambien conecta con el historial de limpieza, permitiendo rastrear patrones, identificar areas problematicas y generar reportes para auditorias.

PREGUNTAS:
P: Cual es la pantalla principal del modulo de Limpieza para el empleado?
a) Dashboard de Limpieza
b) Control de Areas
*c) Mi Turno
d) Panel de Sanitizacion
EXPLICACION: Mi Turno es la pantalla principal donde cada empleado de limpieza ve sus areas asignadas con horarios y niveles de prioridad.

P: En que tres categorias se clasifican las areas de limpieza?
a) Criticas, normales y opcionales segun el riesgo
b) Interiores, exteriores y de emergencia
*c) Areas de residentes, comunes y de servicio
d) Publicas, privadas y restringidas al personal
EXPLICACION: Las areas se clasifican en areas de residentes (habitaciones y banos), areas comunes (comedor, sala, pasillos) y areas de servicio (cocina, lavanderia, almacen).

P: Que es la Zendi logica de evidencia?
a) Un algoritmo que detecta areas sucias automaticamente
b) Un sensor que mide niveles de limpieza
*c) La regla que impide marcar un area como limpia sin evidencia fotografica
d) Un sistema de puntos que premia la limpieza rapida
EXPLICACION: La Zendi logica de evidencia es la regla del sistema que no permite marcar un area como limpia sin subir una foto de evidencia.

P: Por que Zendity exige evidencia fotografica para cada area limpiada?
a) Para que el supervisor pueda verificar la calidad remotamente
b) Para crear contenido visual para los reportes mensuales
*c) Porque las agencias reguladoras exigen prueba documental de cumplimiento sanitario
d) Para entrenar al personal nuevo sobre estandares de limpieza
EXPLICACION: Las agencias reguladoras exigen prueba documental de cumplimiento sanitario, y la evidencia fotografica cumple ese requisito.

P: Para que sirve el historial de limpieza en Zendity?
a) Solo para generar reportes mensuales
*b) Para rastrear patrones, identificar areas problematicas y generar reportes de auditoria
c) Para calcular el salario del personal de limpieza
d) Para comparar el desempeno entre diferentes hogares
EXPLICACION: El historial permite rastrear patrones de limpieza, identificar areas problematicas recurrentes y generar los reportes necesarios para auditorias regulatorias.

---SECCION_2---
LECTURA:
# Mi Turno y Areas Asignadas

Al iniciar su jornada, el empleado de limpieza accede a Mi Turno y ve una lista ordenada por prioridad de todas las areas que debe limpiar. Cada area muestra su nombre, ubicacion, hora estimada de limpieza, nivel de prioridad y estado actual: pendiente, en progreso o completada. El empleado debe marcar cada area como en progreso al comenzar y como completada al terminar, subiendo la foto de evidencia. Las areas de residentes siempre tienen prioridad maxima, especialmente las habitaciones de residentes con condiciones de salud que requieren sanitizacion especial. Zendity asigna las areas basandose en la zona del hogar y la carga de trabajo balanceada. Si un empleado no puede completar un area dentro de su ventana de tiempo, el sistema la marca como pendiente y la reasigna o la escala al supervisor. Mi Turno tambien muestra las solicitudes urgentes que pueden surgir durante el dia, como derrames, accidentes o preparacion de habitaciones para nuevos residentes. Estas solicitudes se insertan en la lista con prioridad alta y tienen su propio SLA.

PREGUNTAS:
P: Que informacion muestra cada area en la pantalla Mi Turno?
a) Solo el nombre del area y la hora
*b) Nombre, ubicacion, hora estimada, nivel de prioridad y estado actual
c) Nombre del area, productos a usar y tiempo estimado
d) Ubicacion, responsable anterior y fecha de ultima limpieza
EXPLICACION: Cada area en Mi Turno muestra nombre, ubicacion, hora estimada de limpieza, nivel de prioridad y estado (pendiente, en progreso o completada).

P: Que areas siempre tienen prioridad maxima en el modulo de limpieza?
a) Las areas comunes por su alto trafico
b) La cocina por regulaciones de salud
*c) Las areas de residentes, especialmente habitaciones con condiciones de salud especiales
d) Las areas de servicio por su importancia operativa
EXPLICACION: Las areas de residentes siempre tienen prioridad maxima, especialmente las habitaciones de residentes con condiciones de salud que requieren sanitizacion especial.

P: Que debe hacer el empleado al comenzar la limpieza de un area?
a) Tomar la foto de evidencia antes de limpiar
*b) Marcar el area como en progreso en Zendity
c) Notificar al supervisor que va a iniciar
d) Verificar que los productos de limpieza estan disponibles
EXPLICACION: El empleado debe marcar el area como en progreso al comenzar y como completada al terminar, subiendo la evidencia fotografica.

P: Que pasa si el empleado no completa un area dentro de su ventana de tiempo?
a) Se cierra automaticamente como completada
b) Se elimina de la lista del dia
*c) Se marca como pendiente y se reasigna
d) Se pospone automaticamente para el dia siguiente
EXPLICACION: O se escala al supervisor si no hay a quien reasignarla. Lo que no pasa es que desaparezca de la lista por vencerse.

P: Como maneja Mi Turno las solicitudes urgentes que surgen durante el dia?
a) Las coloca al final de la lista del empleado
b) Las envia solo al supervisor para que las asigne
*c) Las inserta en la lista con prioridad alta y con su propio SLA
d) Las pospone hasta que el empleado termine sus areas regulares
EXPLICACION: Las solicitudes urgentes se insertan directamente en Mi Turno con prioridad alta y tienen su propio SLA para garantizar atencion rapida.

---SECCION_3---
LECTURA:
# Evidencia Fotografica y Validacion

La evidencia fotografica es el pilar del modulo de Limpieza en Zendity. Cada area completada requiere al menos una foto que muestre el estado final despues de la limpieza. Zendity aplica la Zendi logica de evidencia con reglas especificas. La foto debe ser tomada desde la app de Zendity, no se aceptan fotos de la galeria del telefono. Esto garantiza que la foto tiene timestamp y geolocalizacion verificables. La foto debe mostrar el area completa, no solo un detalle. Zendity rechaza automaticamente fotos borrosas, oscuras o que no corresponden al area asignada usando validacion basica de imagen. Si la foto es rechazada, el empleado recibe una notificacion con la razon del rechazo y debe tomar una nueva foto. El supervisor puede revisar las fotos de evidencia en tiempo real desde su dashboard. Si detecta que un area no cumple con los estandares de limpieza a pesar de tener foto, puede reabrir el area y asignarla nuevamente. El historial fotografico de cada area se archiva por 12 meses para auditorias regulatorias.

PREGUNTAS:
P: Por que Zendity no acepta fotos de la galeria del telefono como evidencia?
a) Porque las fotos de galeria tienen menor calidad
b) Porque podrian ser fotos de otro hogar de cuido
*c) Porque las fotos desde la app tienen timestamp y geolocalizacion verificables
d) Porque la galeria del telefono no es segura
EXPLICACION: Las fotos tomadas desde la app de Zendity incluyen timestamp y geolocalizacion verificables, garantizando que se tomaron en el lugar y momento correctos.

P: Que hace Zendity si la foto de evidencia es borrosa u oscura?
a) La acepta con una advertencia al supervisor
b) La mejora automaticamente con filtros
*c) La rechaza y notifica al empleado
d) La envia al supervisor para revision manual
EXPLICACION: Zendity rechaza automaticamente fotos que no cumplen los estandares de calidad y notifica al empleado para que tome una nueva foto.

P: Que puede hacer el supervisor si detecta que un area no cumple estandares a pesar de tener foto?
a) Eliminar la foto y cerrar el area
b) Enviar una amonestacion al empleado
*c) Reabrir el area y asignarla nuevamente para que se limpie correctamente
d) Aceptar la foto y agregar una nota de mejora
EXPLICACION: El supervisor puede reabrir un area y asignarla nuevamente si determina que la limpieza no cumple con los estandares, a pesar de que se haya subido una foto.

P: Cuanto tiempo se archiva el historial fotografico de cada area?
a) 3 meses
b) 6 meses
*c) 12 meses
d) Indefinidamente
EXPLICACION: El historial fotografico se archiva por 12 meses para cumplir con los requisitos de auditorias regulatorias.

P: Que debe mostrar la foto de evidencia de un area limpiada?
a) Un primer plano del piso limpio
b) Los productos de limpieza utilizados
*c) El area completa, no solo un detalle
d) Al empleado senalando el area limpiada
EXPLICACION: La foto debe mostrar el area completa para verificar que toda la zona fue limpiada, no solo una seccion o detalle.

---SECCION_4---
LECTURA:
# Solicitudes Urgentes y SLA

Las solicitudes urgentes son pedidos de limpieza no programados que surgen por eventos inesperados: un derrame en el comedor, un accidente en una habitacion, preparacion de una habitacion para un nuevo residente o una visita de inspeccion no anunciada. Cualquier empleado del hogar puede crear una solicitud urgente desde Zendity, no solo el personal de limpieza. La solicitud urgente tiene un SLA de 45 minutos, lo que significa que el personal de limpieza debe responder y completar la tarea dentro de ese tiempo. Zendity asigna la solicitud al empleado de limpieza mas cercano a la ubicacion del evento, basandose en la zona asignada. Si el empleado asignado no acepta la solicitud en 10 minutos, Zendity la reasigna al siguiente empleado disponible. Las solicitudes urgentes requieren la misma evidencia fotografica que las areas regulares. Al completar una solicitud urgente, el empleado debe documentar que causo la situacion si lo sabe, que acciones tomo y subir la foto de evidencia. El cumplimiento del SLA de solicitudes urgentes es una metrica clave en la evaluacion del equipo de limpieza.

PREGUNTAS:
P: Cual es el SLA para solicitudes urgentes de limpieza?
a) 15 minutos
b) 30 minutos
*c) 45 minutos
d) 60 minutos
EXPLICACION: Las solicitudes urgentes tienen un SLA de 45 minutos desde su creacion hasta su completacion.

P: Quien puede crear una solicitud urgente de limpieza en Zendity?
a) Solo el personal de limpieza
b) Solo el supervisor de turno
*c) Cualquier empleado del hogar
d) Solo el Director
EXPLICACION: Cualquier empleado del hogar puede crear una solicitud urgente, no solo el personal de limpieza, permitiendo reporte rapido desde cualquier area.

P: Como asigna Zendity una solicitud urgente al personal de limpieza?
a) Al empleado con menos tareas pendientes
b) Al empleado que esta en su hora de descanso
*c) Al empleado de limpieza mas cercano a la ubicacion del evento
d) Aleatoriamente entre todos los empleados disponibles
EXPLICACION: Zendity asigna la solicitud al empleado de limpieza mas cercano basandose en la zona asignada para minimizar tiempo de respuesta.

P: Que sucede si el empleado asignado no acepta la solicitud urgente en 10 minutos?
a) La solicitud se cancela automaticamente
b) Se notifica al supervisor para que la asigne manualmente
*c) Zendity la reasigna al siguiente empleado disponible
d) Se extiende el SLA por 30 minutos adicionales
EXPLICACION: Si el primer empleado no acepta en 10 minutos, Zendity reasigna automaticamente la solicitud al siguiente empleado disponible para cumplir el SLA.

P: Que debe documentar el empleado al completar una solicitud urgente?
a) Solo la foto de evidencia
b) Solo que la situacion fue resuelta
*c) Que causo la situacion, que acciones tomo y la foto de evidencia
d) El nombre de quien creo la solicitud y la hora de completacion
EXPLICACION: Al completar una solicitud urgente, se debe documentar la causa (si se conoce), las acciones tomadas y la foto de evidencia del area limpia.

---SECCION_5---
LECTURA:
# Metricas de Desempeno y Score de Cumplimiento

Zendity mide el desempeno del equipo de limpieza a traves de metricas objetivas que se consolidan en un score de cumplimiento individual y grupal. Las metricas principales son: porcentaje de areas completadas a tiempo, porcentaje de solicitudes urgentes resueltas dentro del SLA, calidad de evidencia fotografica aceptada al primer intento y numero de areas reabietas por el supervisor. El score de cumplimiento se calcula semanalmente y se presenta en un rango de 0 a 100. Un score por encima de 85 se considera excelente. Entre 70 y 84 es aceptable. Por debajo de 70 requiere un plan de mejora con el supervisor. El supervisor accede a un dashboard grupal que muestra el score de cada empleado, las tendencias semanales y las areas que consistentemente presentan problemas. Zendity tambien genera alertas automaticas cuando un empleado tiene tres o mas pendientes sin completar al final de su turno. Estas metricas no son punitivas. Su objetivo es identificar donde el equipo necesita mas recursos, mejor capacitacion o ajustes en la distribucion de areas. Un score bajo puede indicar sobrecarga de trabajo, no necesariamente bajo desempeno.

PREGUNTAS:
P: Cuales son las metricas principales que mide Zendity para el equipo de limpieza?
a) Velocidad de limpieza y consumo de productos
*b) Areas a tiempo, SLA, fotos y reaperturas
c) Numero de areas asignadas y completadas por dia
d) Satisfaccion de residentes y quejas recibidas
EXPLICACION: Las metricas principales son: areas completadas a tiempo, solicitudes urgentes dentro del SLA, calidad de evidencia fotografica y numero de areas reabiertas por supervisor.

P: Que rango de score de cumplimiento se considera excelente?
a) 90 a 100
*b) Por encima de 85
c) 80 a 100
d) Por encima de 95
EXPLICACION: Un score por encima de 85 se considera excelente en el sistema de metricas de limpieza de Zendity.

P: Que sucede cuando un empleado tiene un score de cumplimiento por debajo de 70?
a) Recibe una amonestacion formal
b) Se reduce su carga de trabajo automaticamente
*c) Se requiere un plan de mejora con el supervisor
d) Se le reasignan solo areas de baja prioridad
EXPLICACION: Un score por debajo de 70 requiere elaborar un plan de mejora con el supervisor para identificar y resolver las causas del bajo cumplimiento.

P: Cuando genera Zendity alertas automaticas sobre pendientes de limpieza?
a) Cuando un area lleva mas de 48 horas sin limpiar
b) Cuando el score semanal baja del promedio grupal
*c) Cuando un empleado tiene tres o mas pendientes sin completar al final de su turno
d) Cuando el supervisor solicita una revision
EXPLICACION: Zendity genera alertas automaticas cuando un empleado termina su turno con tres o mas areas pendientes sin completar.

P: Por que un score bajo de cumplimiento no necesariamente indica bajo desempeno?
a) Porque el sistema tiene errores de calculo frecuentes
b) Porque los supervisores ajustan los scores manualmente
*c) Porque puede indicar sobrecarga de trabajo o necesidad de mas recursos
d) Porque el score no considera la calidad de la limpieza
EXPLICACION: Un score bajo puede ser sintoma de sobrecarga de trabajo, necesidad de mas recursos o ajustes en la distribucion de areas, no solo de bajo desempeno individual.
`
},

// ════════════════════════════════════════════════════════════════════════════════
// CURSO 16: TRABAJO SOCIAL EN ZENDITY
// ════════════════════════════════════════════════════════════════════════════════
{
    id: 'TRABAJO_SOCIAL_101',
    title: 'Trabajo Social en Zendity',
    description: 'Herramientas de trabajo social en Zendity: dashboard global, beneficios, coordinacion de especialistas y alertas automaticas.',
    durationMins: 25,
    bonusCompliance: 10,
    emoji: '🫂',
    category: 'Tecnologia Zendity',
    order: 16,
    content: `---META---
TITULO: Trabajo Social en Zendity
DESCRIPCION: La pantalla Trabajo Social y lo que no hace: aqui nadie avisa de nada. Tareas, notas y beneficios en el expediente, y la Evaluacion Psicosocial Inicial, lo unico que firmas.
PROMPT_ZENDI: Evalua si la trabajadora social sabe leer la pantalla Trabajo Social sabiendo que nadie le avisa de nada, registrar tareas, notas y beneficios en el expediente, distinguir lo que Zendi propone de lo que Zendi hace, y llenar, firmar y corregir con addendum la Evaluacion Psicosocial Inicial.
TERMINOS_CLAVE: Trabajo Social, Tareas Pendientes, Completar, Beneficios por Vencer, Especialistas Vencidos, Notas Recientes, Evaluaciones de Trabajo Social, Zendi TS, Analizar, Crear Tarea, Nueva Nota, Nueva evaluacion, Continuar borrador, Aprobar firma digital, Aceptar firma, Confirmar y aprobar, Aprobadas recientes, addendum, numero de colegiada
PREGUNTA_REFLEXION: Piensa en el ultimo beneficio de un residente que se venció sin renovar a tiempo. En qué momento te enteraste, y qué pantalla habrías tenido que abrir, y cada cuánto, para enterarte antes?

---SECCION_1---
LECTURA:
# Trabajo Social: tu pantalla, y lo que esa pantalla no hace

Tu menu de la izquierda tiene **ocho enlaces**, y esa es la primera trampa del sistema: **solo tres te llevan a algun sitio**.

| Enlace que SI abre | Que abre |
|---|---|
| **Trabajo Social** | El panel de la sede: medidas, tareas, beneficios y notas |
| **Expedientes** | El **Directorio Global**, el censo de residentes |
| **Academy** | Tus cursos. Es la pantalla donde estas leyendo esto |

Los otros cinco —**Zendity Care (Tablets)**, **Triage & Supervision**, **Auditoria eMAR**, **Cocina y Nutricion** y **Mi Desempeno**— se pintan igual que los tuyos, pero tu rol no puede entrar: los pulsas y **el sistema te devuelve a Trabajo Social**, sin cartel y sin explicacion. No es un fallo tuyo ni una pantalla rota; es que ahi no te dejan.

El que mas sorprende es **Auditoria eMAR**: parece tuya, dice "las rondas de medicamentos", y tambien te rebota.

Hay una cuarta pantalla que si es tuya y que **no** esta en el menu: la **Evaluacion Psicosocial Inicial**, que se abre desde el expediente del residente. La Seccion 5 es entera sobre ella.

Y el **Intake Maestro**, que es donde se ingresa un residente nuevo, **ni siquiera aparece**: vive en el menu corporativo, que tu rol no recibe. El ingreso lo hace otra persona en otra pantalla.

## Las cuatro medidas de arriba

| Medida | Que cuenta de verdad |
|---|---|
| **Residentes Activos** | Los residentes con estado activo de tu sede |
| **Tareas Pendientes** | Las tareas de trabajo social sin completar |
| **Beneficios por Vencer** | Debajo del numero lo dice: **proximos 60 dias** |
| **Completadas (7d)** | Las tareas que se marcaron completas en la ultima semana |

## Lo que hace esta pantalla y lo que no

Esto es lo mas importante del curso entero, asi que va primero:

| Lo que SI hace | Lo que NO hace |
|---|---|
| Ensenarte lo que hay **cuando la abres** | Avisarte. No hay alertas, ni correos, ni notificaciones |
| Contar los beneficios que vencen en 60 dias | Avisarte cuando a uno le quedan 30, 15 o 7 dias |
| Cargarse una vez, al entrar | Refrescarse sola. Para ver algo nuevo, recargas |
| Marcar en rojo el borrador de evaluacion que pasa de 7 dias | Escalar nada a direccion por su cuenta |

**Nadie avisa de nada.** No hay un trabajo nocturno que revise los beneficios, no sale un correo, no se enciende la campana. Un beneficio por vencer solo existe para ti el dia que abres esta pantalla y lo miras. Por eso esta pantalla se abre **todos los dias**, no cuando te acuerdas.

Y tampoco es tiempo real. La pantalla pide los datos una sola vez, al montarse. Si la dejas abierta toda la manana, sigue ensenandote la manana.

## El bloque que miente en silencio

Abajo a la derecha hay un bloque, **Especialistas Vencidos (>90d)**, que dice siempre lo mismo: **"Todas las visitas al dia"**.

No es que esten al dia. El dato que llenaba ese bloque se retiro del sistema el 31 de mayo de 2026, y desde entonces el bloque llega **vacio siempre**, pase lo que pase. No lo mires, no lo uses, y sobre todo **no digas en una reunion que nadie tiene visitas atrasadas porque ahi sale verde**.

Es el ejemplo perfecto de un numero que no puede moverse: si no hay ningun dato del mundo que lo haga cambiar, ese numero no mide nada.

![La pantalla Trabajo Social al abrirla: arriba las cuatro medidas —31 residentes activos, 4 tareas pendientes, 2 beneficios por vencer en los proximos 60 dias y 7 completadas en 7 dias— y debajo el bloque de Evaluaciones, que en esta foto salio cargando, y la tabla de Tareas Pendientes.](/academy/capturas/social-panel.jpg)

PREGUNTAS:
P: Quien te avisa cuando a un beneficio le quedan pocos dias para vencer?
a) Zendity te manda un correo de aviso
*b) Nadie: solo se ve si abres Trabajo Social
c) El Director recibe la alerta y avisa
d) Sale una notificacion en la campana
EXPLICACION: En todo el modulo no hay alertas, ni correos, ni trabajos nocturnos: las consultas del panel solamente leen. Por eso la pantalla se abre a diario.

P: El bloque "Especialistas Vencidos (>90d)" dice "Todas las visitas al dia". Que significa eso?
a) Que los residentes vieron a su especialista en los ultimos noventa dias
b) Que falta cargar las visitas del mes dentro del sistema
c) Que el hogar no tiene especialistas contratados este ano
*d) Nada: ese bloque llega vacio siempre
EXPLICACION: El dato que lo llenaba se retiro el 31 de mayo de 2026 y el bloque devuelve una lista vacia por construccion; es una metrica que no puede moverse.

P: Abres Trabajo Social a las 8:00 y la dejas abierta. A las 11:00 una companera agrega una tarea. La ves?
*a) No, hasta que recargues la pantalla
b) Si, aparece sola en cuanto ella la guarda
c) Si, la pantalla se refresca cada cinco minutos
d) Solo si ella te la asigna a ti por nombre
EXPLICACION: La pantalla pide los datos una unica vez al abrirse; no hay refresco automatico, asi que lo nuevo entra solo al recargar.

P: Que cuenta la medida "Beneficios por Vencer"?
a) Todos los beneficios registrados del hogar, vencidos incluidos
b) Los que vencieron y siguen sin renovar
*c) Los activos que vencen en los proximos 60 dias
d) Los que la evaluacion marco como fuente de ingreso
EXPLICACION: Debajo del numero la tarjeta lo dice con esas palabras: proximos 60 dias. Un beneficio que ya vencio sale de esa cuenta.

P: Pulsas "Auditoria eMAR" en tu menu de la izquierda. Que pasa?
a) Se abre el eMAR Corporativo con las rondas del dia
*b) El sistema te devuelve a Trabajo Social
c) Sale un cartel rojo de permiso denegado
d) Te pide la clave del Director para poder entrar
EXPLICACION: Ese enlace se pinta en tu menu, pero tu rol solo puede estar en Trabajo Social, Expedientes, las evaluaciones y Academy. Fuera de ahi el sistema te devuelve al panel sin decir nada.

---SECCION_2---
LECTURA:
# Tareas Pendientes: ninguna nace sola

La tabla del panel tiene seis columnas: **Residente**, **Tarea**, **Prioridad**, **Categoria**, **Fecha Limite** y **Accion**.

- El nombre del residente **si es enlace** aqui: lo pulsas y te abre su expediente.
- Las prioridades son cuatro: **Baja**, **Normal**, **Alta**, **Urgente**.
- Las categorias son cinco: **Seguimiento**, **Documento**, **Familia**, **Cita**, **Beneficio**.
- Si la fecha limite ya paso, sale en rojo con **(vencida)** detras.

## La chispita violeta

Al lado de algunos titulos hay una chispita violeta. Significa una cosa concreta: **esa tarea salio de una sugerencia de Zendi que una persona acepto**.

Leelo otra vez, porque es la confusion mas comun: **ninguna tarea nace sola**. No hay automatismo. Hay dos caminos, y los dos los anda una persona:

1. El boton **Nueva Tarea**, en la pestana Trabajo Social del expediente.
2. El boton **Analizar** del panel **Zendi TS**, y despues **Crear Tarea** en la sugerencia que te interese. Esa es la que sale con chispita.

## El boton Completar

En la ultima columna hay un boton verde, **Completar**. Al pulsarlo, la fila **desaparece de la lista**, baja el contador de Tareas Pendientes y sube el de Completadas (7d).

**Desde la pantalla no se deshace.** No hay boton para devolverla a pendiente. Asi que se pulsa cuando el trabajo esta hecho, no cuando piensas hacerlo.

## Dos cosas que sorprenden

**Si no hay ninguna tarea, el bloque entero desaparece.** No sale vacio con un mensaje: no se pinta. Si un dia no lo ves, lo primero que hay que pensar es que no hay nada pendiente.

**La lista no filtra a quien ya no esta.** Si un residente fallecio o se fue del hogar y le quedaban tareas sin completar, esas tareas siguen saliendo en la lista como cualquier otra. El sistema no las cierra solo. Limpiarlas es trabajo tuyo, y conviene hacerlo: una tarea de alguien que ya no esta le roba sitio en la pantalla a una de alguien que si.

![La tabla de Tareas Pendientes: la chispita violeta de Luis Ortega dice que esa la sugirio Zendi, el 8 sept en rojo con (vencida) dice que la fecha ya paso, y Completar saca la fila de la lista.](/academy/capturas/social-tareas.jpg)

PREGUNTAS:
P: En la tabla, una tarea lleva una chispita violeta al lado del titulo. Que te dice?
a) Que la genero el sistema sin intervencion humana
b) Que es la tarea mas urgente de hoy
*c) Que salio de una sugerencia de Zendi que alguien acepto
d) Que hay un documento adjunto esperando firma
EXPLICACION: La chispita se pone al pulsar "Crear Tarea" dentro de una sugerencia del panel Zendi TS; la fila la escribio una persona, no un automatismo.

P: Pulsas "Completar" en la tarea de Rosa Medina. Que pasa?
*a) Sale de la lista y no hay boton para devolverla
b) Se queda tachada al final de la tabla por siete dias
c) Pasa al Director para que la revise y la cierre
d) Se archiva y se puede reabrir desde Notas Recientes
EXPLICACION: La fila desaparece del panel, baja el contador de Tareas Pendientes y sube el de Completadas (7d). Desde la pantalla eso no se deshace.

P: Como nace una tarea de trabajo social?
a) Zendity la crea sola cuando un beneficio se acerca a su fecha
b) La crea la cuidadora desde la tableta cuando ve algo raro
c) La genera el trabajo de la noche con lo que quedo pendiente
*d) La escribe una persona, en el expediente o desde Zendi TS
EXPLICACION: Toda fila de tarea nace de un boton: "Nueva Tarea" en el expediente, o "Crear Tarea" sobre una sugerencia de Zendi.

P: Abres el panel y no ves el bloque "Tareas Pendientes" por ninguna parte. Que paso?
a) Se movio abajo, debajo del bloque de Notas Recientes
*b) No hay ninguna tarea pendiente, y el bloque no se pinta
c) Se te acabo el permiso para ver tareas de otros companeros
d) Hay un error de carga y hay que avisar a soporte tecnico
EXPLICACION: El bloque solo se dibuja si hay al menos una tarea; con cero tareas desaparece entero en vez de salir vacio.

P: Un residente fallecio hace dos meses y tenia dos tareas sin completar. Que ves hoy en el panel?
*a) Sus dos tareas siguen en la lista como cualquier otra
b) Se cerraron solas cuando direccion cerro el expediente
c) Salieron de la lista pero siguen contando en el numero
d) Aparecen en gris, con la palabra "Inactivo" al lado
EXPLICACION: La consulta filtra por sede y por estado de la tarea, no por el estado del residente. Cerrar esas filas es trabajo de la persona.

---SECCION_3---
LECTURA:
# Beneficios: cinco tipos, una fecha y una caja de texto

Los beneficios se registran en el expediente del residente: pestana **Trabajo Social**, sub-pestana **Beneficios**, boton **Agregar**.

El formulario es corto, y conviene saber de memoria lo que **no** tiene:

| El formulario tiene | El formulario NO tiene |
|---|---|
| **Tipo**: Medicare, Medicaid, SNAP, Pension, Otro | Proveedor |
| **Estado**: Activo, Vencido, Pendiente, Desconocido | Numero de poliza |
| **Detalles (opcional)**, una sola caja de texto | Fecha de inicio |
| **Fecha de vencimiento** | Adjuntar documentos |

Un seguro suplementario, una farmacia, un programa de salud mental: todo eso se registra como **Otro**, y lo que lo distingue lo escribes tu dentro de **Detalles**. Si quieres guardar el numero de poliza, ahi es donde va.

## Los colores no son alertas, y no son iguales en las dos pantallas

| Donde | Rosa | Ambar |
|---|---|---|
| **Beneficios por Vencer**, en el panel de la sede | quedan 15 dias o menos | de 16 a 60 dias |
| Sub-pestana **Beneficios** del residente | ya vencio | quedan menos de 30 dias |

El corte no es el mismo en los dos sitios. En el panel de la sede el rosa empieza a los 15 dias; dentro del expediente el ambar empieza a los 30 y el rosa solo aparece cuando ya paso la fecha, con la palabra **Vencido**.

## Que pasa cuando un beneficio vence

Esto es lo contrario de lo que la gente supone:

- **No** se marca como critico.
- **No** se avisa al Director.
- **No** se crea una tarea.

Lo que pasa es que **desaparece**. El panel de la sede pide beneficios con fecha de hoy en adelante, asi que el vencido sale de la lista y sale del contador el mismo dia. Se vuelve a ver **solo** abriendo el expediente de ese residente, en la sub-pestana Beneficios, donde sale en rosa con la palabra Vencido.

Dicho claro: **el dia que baja el numero de Beneficios por Vencer puede ser buena noticia o la peor**. Antes de celebrarlo, mira si el que falta es uno que renovaste o uno que se te paso.

## Dos detalles de la pantalla

**En el bloque Beneficios por Vencer el nombre no es enlace.** Si lo pulsas no pasa nada. No es un fallo tuyo: ahi no hay enlace. Para abrir ese expediente vas por Expedientes, o por el mismo nombre en Tareas Pendientes o en Notas Recientes, donde si lo es.

**Un beneficio no se edita ni se borra desde la pantalla.** Solo se agrega. Cuando renuevas el Medicare de alguien, agregas uno nuevo con la fecha nueva; el viejo se queda ahi. Por eso conviene escribir en Detalles de que renovacion se trata, para que dentro de un ano se entienda cual es cual.

![Beneficios por Vencer con la cuenta atras en dias: Rosa Medina en rosa con 11d porque le quedan 15 dias o menos, Pedro Santana en ambar con 24d. Los nombres de este bloque no son enlaces.](/academy/capturas/social-beneficios.jpg)

PREGUNTAS:
P: Que campos guarda un beneficio?
a) Tipo, proveedor, numero de poliza y fecha de vencimiento
b) Tipo, estado y fecha de inicio
c) Tipo, agencia, telefono de contacto y fecha de renovacion
*d) Tipo, estado, detalles y fecha de vencimiento
EXPLICACION: No hay campo de proveedor, ni de poliza, ni de fecha de inicio. Lo que no cabe se escribe a mano dentro de "Detalles (opcional)".

P: Rosa Medina tiene un seguro suplementario que quieres registrar. Que tipo escoges?
a) Suplementario, una de las cinco opciones del selector
*b) Otro
c) Medicare, que es lo mas parecido que hay
d) Ninguno: eso se registra en Facturacion y Cuotas
EXPLICACION: El selector tiene exactamente cinco opciones: Medicare, Medicaid, SNAP, Pension y Otro. El detalle del seguro va escrito en Detalles.

P: Un beneficio de Pedro Santana vencio ayer y nadie lo renovo. Que pasa en el panel de la sede?
a) Se pinta en rojo con la palabra "Vencido" arriba del todo
b) Sube a la primera fila de Tareas Pendientes como Urgente
*c) Desaparece del bloque y del contador
d) Direccion recibe un aviso automatico
EXPLICACION: El panel pide beneficios con fecha de hoy en adelante, asi que el vencido sale de la lista y del numero. Solo se vuelve a ver dentro del expediente.

P: Renuevas el Medicare de Rosa por un ano mas. Que haces en la pantalla?
*a) Agregas un beneficio nuevo con la fecha nueva
b) Le cambias la fecha al beneficio existente
c) Borras el viejo y lo reescribes
d) Escribes la fecha nueva en los detalles
EXPLICACION: Desde la pantalla un beneficio no se edita ni se borra: solo se agrega. El viejo se queda, y por eso conviene anotar en Detalles de que renovacion se trata.

P: En "Beneficios por Vencer" pulsas el nombre de Rosa Medina y no pasa nada. Por que?
a) Porque el residente esta de baja y el enlace se apaga
b) Porque hay que pulsar dos veces, como en el escritorio
*c) Porque ahi el nombre no es enlace
d) Porque el beneficio todavia no lo ha aprobado direccion
EXPLICACION: En ese bloque el nombre es texto plano. En Tareas Pendientes, en Especialistas y en Notas Recientes si lleva enlace al expediente.

---SECCION_4---
LECTURA:
# El expediente: Notas, Tareas, Beneficios y Zendi TS

Se llega por **Expedientes**, se busca al residente y se abre su expediente. Arriba hay una fila de pestanas: Resumen Clinico, Medicamentos, Registro UPPs (24h), **Familiares y Accesos**, Llamadas, Servicios Externos, **Trabajo Social**, **Evaluaciones**, Riesgo de Caidas / Incidentes, Facturacion y Cuotas y Reportes Triage.

La tuya es **Trabajo Social**, y dentro tiene **tres** sub-pestanas y nada mas: **Notas**, **Tareas**, **Beneficios**.

No hay "Historial Social". No hay "Expediente". No hay "Especialistas". Si las buscas, no las vas a encontrar.

## Notas de Trabajo Social

Boton **Nueva Nota**. Eliges una de cinco categorias y escribes:

- **General**
- **Familiar**
- **Beneficios**
- **Legal**
- **Incidente**

**Quien lee tus notas.** Las diez mas recientes de toda la sede salen en el bloque **Notas Recientes** del panel, con tu nombre y la hora. Eso significa que direccion las lee desde ahi sin entrar al expediente. A la familia **no** le llega nada: el portal familiar no publica notas de trabajo social.

**Una nota no se edita.** No hay boton de editar en ninguna parte. Se borra con el bote de basura, y el bote solo aparece en **tus propias notas** (direccion tambien puede borrarlas). Si te equivocaste, lo honesto es escribir otra nota que lo corrija, no hacer desaparecer la primera.

## Zendi TS

**Zendi TS** es el titulo del **panel oscuro que esta a la derecha** de esa pestana. No es el nombre del modulo: el modulo se llama Trabajo Social, y eso es lo que dice el titulo de la pantalla.

El panel tiene un boton: **Analizar**. Al pulsarlo, Zendi mira el perfil del residente —sus notas, sus tareas, sus beneficios, sus visitas, su familia— y devuelve dos cosas: un **resumen** en un parrafo y entre **2 y 6 sugerencias**. Cada sugerencia trae su tipo (Tarea, Alerta o Info) y su prioridad. Las de tipo Tarea traen debajo un boton: **Crear Tarea**.

| Lo que SI hace Zendi TS | Lo que NO hace |
|---|---|
| Proponerte de 2 a 6 cosas cuando pulsas Analizar | Crear nada por su cuenta |
| Escribir un resumen del estado social del residente | Guardar ese resumen en ningun sitio |
| Poner la chispita violeta a lo que tu aceptes | Avisar a nadie de lo que propuso |

**Si no pulsas Crear Tarea, no queda nada.** Cierras la pestana y el resumen y las sugerencias se van. Zendi propone; la que decide eres tu, y lo que se guarda va con tu nombre.

## La pestana que se te ve vacia

**Servicios Externos** se pinta para todo el mundo, pero a ti te va a salir vacia siempre: el permiso de esa lista no incluye tu rol. **Vacia ahi no quiere decir que ese residente no haya recibido visitas de fuera.** Quiere decir que a ti no te las ensenan. Si necesitas ese dato, se lo pides a enfermeria o a direccion.

PREGUNTAS:
P: Que sub-pestanas tiene "Trabajo Social" dentro del expediente?
*a) Notas, Tareas y Beneficios
b) Datos Personales y Especialistas
c) Notas, Tareas, Beneficios, Especialistas y Expediente
d) General, Familiar, Beneficios, Legal e Incidente
EXPLICACION: Especialistas se quito cuando se retiro ese modulo, y General, Familiar, Legal e Incidente no son pestanas: son las cinco categorias de una nota.

P: Pulsas "Analizar" en Zendi TS, salen cuatro sugerencias y cierras la pestana sin tocar nada mas. Que quedo guardado?
a) Las cuatro sugerencias, en la sub-pestana de Tareas del residente
b) Un resumen en Notas Recientes firmado con el nombre de Zendi
*c) Nada
d) La sugerencia mas urgente, que se crea sola como tarea
EXPLICACION: Zendi propone y tu decides: solo queda algo si pulsas "Crear Tarea", y entonces la tarea nace con la chispita violeta y con tu nombre.

P: Abres la pestana "Servicios Externos" de un residente y sale vacia. Que esta pasando?
a) Ese residente no ha recibido ninguna visita de fuera
*b) Tu rol no puede leer esa lista, aunque veas la pestana
c) Las visitas se borran a los noventa dias de registradas
d) Falta que direccion apruebe las visitas para que se vean
EXPLICACION: La pestana se dibuja para todo el mundo, pero el permiso de la lista de visitas no incluye a la trabajadora social. Vacia ahi no significa que no haya visitas.

P: Escribes una nota de categoria Familiar sobre Luis Ortega. Quien la ve?
a) La familia de Luis, en su portal familiar, igual que la bitacora del piso
b) Solo tu, hasta que la marques para compartirla con el resto del equipo
c) Las cuidadoras, en la tableta del piso
*d) Quien entre al panel: sale en Notas Recientes
EXPLICACION: Las diez notas mas recientes de la sede salen en ese bloque con tu nombre y la hora. A la familia esa nota no le llega.

P: Que puedes hacer con una nota que escribio tu companera hace un mes?
a) Editarle el texto si te das cuenta de que se equivoco
*b) Leerla
c) Cambiarle la categoria de General a Legal sin borrarla
d) Borrarla si ya no hace falta en el expediente del residente
EXPLICACION: El bote de basura solo sale en tus propias notas, o para direccion. Y no hay boton de editar en ninguna nota, sea de quien sea.

---SECCION_5---
LECTURA:
# La Evaluacion Psicosocial Inicial: lo unico que firmas

De todo lo que haces en Zendity, esto es lo unico que es un **documento legal con tu firma y tu numero de colegiada**. Todo lo demas son notas y recordatorios.

## Donde se crea

Expediente del residente, pestana **Evaluaciones**, boton **+ Nueva evaluacion**. La pantalla crea el borrador sola y te lleva dentro.

Si ese residente ya tiene un borrador abierto, el boton **cambia** y dice **Continuar borrador del DD/MM**. Es a proposito: para que no te queden dos borradores del mismo residente. **Si te quedan dos, descarta uno.**

Tambien llegas por el panel: el bloque **Evaluaciones de Trabajo Social** lista **hasta cinco borradores abiertos**, del mas viejo al mas nuevo, con un boton **Continuar** al lado.

Debajo hay otra lista, **Aprobadas recientes**, con un boton **Ver**. Lee bien el titulo: son **las cinco ultimas aprobadas de la sede**, sin filtro de fecha. Si la ultima que se firmo fue en julio, en octubre sigue saliendo ahi. La que si cuenta el mes es la cifra de arriba, **Aprobadas este mes**: esa se pone a cero el dia 1.

## Que es el formulario

Es la **Evaluacion Psicosocial Inicial** (formulario MFR9873-ESI). **Diecisiete secciones** numeradas, una tarjeta cada una, de **I. Informacion Personal** a **XVII. Referidos**: procedencia, directrices, salud fisica y mental, comunicacion, educacion y ocupacion, estilo de vida, aspecto fisico, composicion familiar, datos economicos, dependencia fisica, alimentacion, piel, cumplimiento del tratamiento y servicios que recibe.

## Las tres clases de campo

Esto es lo que hay que aprender a distinguir de un vistazo:

| Lo que ves | Que significa | Que haces tu |
|---|---|---|
| Candado gris y la palabra **del residente** | Sale del expediente y esta congelado | Nada. Se arregla en el expediente, no aqui |
| Linea gris **Referencia: ...** | Es el dato crudo, no la respuesta | Lo lees y **decides tu** que marcar |
| Campo en blanco | Nadie lo sabe todavia | Lo escribes tu |

Un ejemplo real de la linea de referencia, en **XI. Nivel de Dependencia Fisica**: debajo del campo sale algo como "Referencia: AVD 3 · Movilidad limitada · Riesgo Downton (4)". Eso **no** es la respuesta. Pasar de un numero de AVD a una de las cuatro casillas del formulario es un juicio clinico, y el juicio es tuyo. Por eso el campo se queda en blanco a proposito.

## El bloque de Familiares, y por que hay que mirarlo antes

La seccion **IX. Composicion Familiar** es de las de candado: la tabla de familiares, el representante y el apoderado se copian de la pestana **Familiares y Accesos** del expediente.

Y se copian **el dia que creas el borrador**. Se quedan congelados ahi.

Esto tiene una consecuencia que sorprende a todo el mundo: **si falta la hija en Familiares y Accesos, la arreglas ANTES de crear la evaluacion.** Si la arreglas despues, el expediente queda bien pero la evaluacion sigue con lo viejo, y desde el formulario no se puede tocar. Comprueba los familiares primero; crear el borrador se tarda diez segundos.

## Se guarda solo

Arriba, al lado del nombre del residente, hay una linea que te va diciendo: **Sin cambios pendientes**, **Guardando...**, **Guardado hace X**, o **Error al guardar** en rojo.

Se guarda solo unos dos segundos despues de que dejas de escribir. **Si dice Error al guardar, no te deja abrir la firma**: primero se arregla el error.

## Cuando esta lista

**No hay porcentaje de completitud. No hay plazo de dias habiles.** Nada te va a decir que esta al 80 por ciento ni que llevas diez dias. La decision de cuando esta lista es tuya, a proposito.

El unico reloj del modulo es blando: el bloque del panel pone en rojo el borrador que lleva **mas de 7 dias** abierto. No bloquea nada; es un recordatorio.

## Firmar

Son **cinco** pasos, no cuatro. El que se salta todo el mundo es el cuarto:

1. Boton **Aprobar firma digital**.
2. Se abre el modal **Aprobar evaluacion**, con el nombre del residente y el aviso de que los datos van a quedar inmutables.
3. Firmas **con el dedo** en el recuadro. Si te sale torcida, **Limpiar** lo borra y vuelves a empezar.
4. Boton **Aceptar firma**, a la derecha, debajo del recuadro.
5. Ahora sale tu firma en pequeno, con **Volver a firmar** debajo por si no te convence, y abajo del todo el boton **Confirmar y aprobar**. Ese es el que aprueba.

**Hasta que no pulsas "Aceptar firma", el boton de aprobar no existe.** No esta apagado: no esta dibujado. Si firmas y te pones a buscar "Confirmar y aprobar" sin haber aceptado, no lo vas a encontrar por mucho que bajes.

Y **"Aceptar firma" sale apagado si el trazo es muy corto**. Debajo del recuadro te lo dice con esas palabras: *"Trazo muy corto — agrega un poco mas antes de aceptar"*. No es que el sistema se haya trabado: es que una raya de dos centimetros no vale como firma en un documento legal. Firma mas grande y el boton se enciende solo.

**Tu nombre y tu numero de colegiada se copian de tu perfil en ese instante.** Si tu perfil no tiene el numero, la evaluacion queda firmada sin numero y eso ya no se arregla despues. Revisa tu perfil antes de firmar la primera.

## Despues de firmar

| Se puede | No se puede |
|---|---|
| Descargar el PDF con el bloque de firma | Editar una sola letra del formulario |
| Agregar un **addendum**, con **razon obligatoria** | Descartar la evaluacion |
| Leerla desde el panel y desde el expediente | Volver a aprobarla |

El addendum vive aparte, no toca lo que firmaste, y sale al final del PDF con su razon, tu nombre y la fecha. Esa es la unica forma de corregir algo.

Y mientras es borrador hay un boton mas, **Descartar borrador**, en rojo: borra el borrador **para siempre** y te devuelve al expediente. Solo existe mientras esta en BORRADOR.

## El PDF

Se descarga en cualquier estado, pero no es el mismo papel:

- En borrador sale con una marca de agua diagonal que dice **BORRADOR** y, en vez de la firma, la frase **Documento sin firmar**. Un documento sin firmar no puede parecer firmado.
- Aprobada sale sin marca de agua, con tu firma, tu nombre, tu numero de colegiada y la fecha, y con los addendums al final.

PREGUNTAS:
P: En la seccion de Familiares, el bloque sale con candado y dice "del residente". Falta la hija. Que haces?
a) La escribes dentro de Observaciones, que si esta abierto
b) Pides a direccion que desbloquee el campo por esta vez
*c) La agregas en "Familiares y Accesos" y creas la evaluacion despues
d) La escribes a mano al firmar el documento
EXPLICACION: Los campos con candado se copian del expediente el dia que creas el borrador y ya no se mueven; arreglar el expediente despues no cambia una evaluacion ya creada.

P: La linea "Referencia: AVD 3 · Movilidad limitada" debajo de un campo, que es?
a) La respuesta que el sistema ya guardo por ti en ese campo
b) Una advertencia de que el dato del expediente esta vencido
c) El texto que va a salir impreso en el PDF de la evaluacion
*d) El dato crudo del residente, para que decidas tu
EXPLICACION: Esos campos no se auto-llenan a proposito: pasar de "AVD 3" a una casilla del formulario es un juicio clinico, y lo hace la trabajadora social.

P: Firmaste con "Confirmar y aprobar" y despues ves un error en la seccion X. Que haces?
*a) Agregas un addendum con su razon
b) Abres la evaluacion y corriges la seccion equivocada
c) Descartas la evaluacion y creas otra desde cero hoy mismo
d) Pides a direccion que reabra el documento para editarlo
EXPLICACION: Al aprobar, los datos quedan inmutables. El addendum vive aparte, lleva razon obligatoria y sale al final del PDF con tu nombre y la fecha.

P: Firmaste con el dedo y buscas "Confirmar y aprobar". No esta por ninguna parte. Que falta?
a) Que direccion revise y desbloquee el borrador primero
*b) Pulsar el boton "Aceptar firma" debajo del recuadro
c) Llenar los campos que dejaste en blanco
d) Que pasen los diez dias habiles desde el ingreso
EXPLICACION: El pie del modal, donde vive "Confirmar y aprobar", no se dibuja hasta que la firma esta aceptada. Y no hay nada mas que te lo impida: ni porcentaje de campos llenos, ni plazo de dias, ni visto bueno de direccion.

P: Firmas una evaluacion y tu perfil no tiene el numero de colegiada. Que pasa?
a) No te deja firmar hasta que lo pongas en tu perfil
b) Lo pide en el modal antes de dejarte confirmar la firma
c) Lo toma del ultimo documento que firmaste este ano
*d) Queda firmada sin numero, y eso ya no se arregla
EXPLICACION: El nombre y el numero se copian de tu perfil en el instante de aprobar y quedan congelados en la evaluacion; si estaba vacio, queda vacio para siempre.
`
}

];

// ── Execution ──────────────────────────────────────────────────────────────────
//
// USO:
//   - Seed a TODAS las sedes activas:   npx tsx src/lib/academy-seed.ts
//   - Seed a una sede específica:       SEED_HQ_ID=<uuid> npx tsx src/lib/academy-seed.ts
//
// Idempotente: usa upsert. Seguro de correr múltiples veces.
// NO borra datos. Solo crea o actualiza.
//

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Simulacion. Antes no habia: la unica forma de saber que iba a hacer era
    // dejarlo escribir.
    const DRY = process.argv.includes('--dry-run')
    if (DRY) console.log('🔍 SIMULACION — no se escribe nada\n')

    // Si se pasa SEED_HQ_ID, sembrar solo esa sede. Si no, sembrar a todas las activas.
    let hqIds: string[] = []
    if (process.env.SEED_HQ_ID) {
        hqIds = [process.env.SEED_HQ_ID]
        console.log(`Sembrando para sede específica: ${process.env.SEED_HQ_ID}`)
    } else {
        const hqs = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true }
        })
        if (hqs.length === 0) {
            console.error('❌ No hay sedes activas en la base de datos.')
            process.exit(1)
        }
        hqIds = hqs.map(h => h.id)
        console.log(`Sembrando para ${hqs.length} sede(s) activa(s):`)
        hqs.forEach(h => console.log(`  - ${h.name} (${h.id})`))
    }

    for (const HQ_ID of hqIds) {
        console.log(`\n📚 Sede: ${HQ_ID}`)
        for (const course of ACADEMY_SEED_COURSES) {
            const imageUrl = `/academy/${course.id}.jpg`
            // ID compuesto para que cada sede tenga su propio set de cursos
            // sin colisiones de ID entre sedes.
            const compositeId = `${HQ_ID}__${course.id}`
            /**
             * EL UPDATE NO PISA `isGlobal`, `isActive` NI `imageUrl`.
             *
             * Los pisaba, y el 11-sep-2026 estuvo a punto de costar caro: en
             * produccion OCHO de estos cursos estan limitados por rol
             * —CUIDADOR_101 a CAREGIVER, ENFERMERA_101 a NURSE, TRABAJO_SOCIAL
             * a SOCIAL_WORKER, y asi— y este bloque los forzaba a
             * `isGlobal: true`. Correr el seed para actualizar el CONTENIDO de
             * los cursos habria hecho visible y asignable a todo el personal la
             * formacion de cada rol, sin que nadie tocara esa decision.
             *
             * `bonusCompliance` TAMPOCO, y esa me la comi. El 11-sep, horas
             * despues de escribir este comentario, corri el seed y devolvi los
             * puntos de Cupey de 10/15/20/30 —racionalizados por RIESGO en
             * agosto— a los 75/100/125 originales, donde el curso de Caidas
             * valia doce veces menos que el de Accesos. Arregle la fuga por
             * `isGlobal` y deje abierta la de al lado, en la linea siguiente.
             *
             * Todos esos campos tienen otro dueño: `isGlobal`, `targetRole` y
             * `bonusCompliance` los pone `scripts/academy-roles-y-puntos.ts`;
             * `imageUrl` lo pone `scripts/academy-imagenes.ts`. Este seed es
             * dueño del CONTENIDO, y de nada mas.
             *
             * En `create` si van, porque un curso que nace necesita un valor.
             */
            const existente = await prisma.course.findUnique({
                where: { id: compositeId },
                select: { content: true },
            })
            if (DRY) {
                const estado = !existente ? '+ crea     '
                    : existente.content !== course.content ? '↻ actualiza'
                    : '= igual    '
                console.log(`  ${estado} ${course.title}`)
                continue
            }

            await prisma.course.upsert({
                where: { id: compositeId },
                update: {
                    title: course.title,
                    description: course.description,
                    content: course.content,
                    durationMins: course.durationMins,
                    emoji: course.emoji,
                    category: course.category || 'General',
                    order: course.order || 0,
                },
                create: {
                    id: compositeId,
                    headquartersId: HQ_ID,
                    title: course.title,
                    description: course.description,
                    content: course.content,
                    durationMins: course.durationMins,
                    bonusCompliance: course.bonusCompliance,
                    emoji: course.emoji,
                    imageUrl,
                    category: course.category || 'General',
                    order: course.order || 0,
                    isGlobal: true,
                    isActive: true,
                }
            })
            console.log(`  ✓ ${course.id} → ${course.title}`)
        }
    }
    console.log('\n✅ Seed completo')
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())

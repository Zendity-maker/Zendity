'use client';
/** Vista previa del curso REESCRITO, en el lector real. No se publica desde aqui. */
import { useEffect } from 'react';
import { Andamio, instalar } from '../andamio';
import InteractiveCourseCard from '@/components/academy/InteractiveCourseCard';

const CONTENIDO = `---META---
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
`;

instalar({
    '/api/academy/curso/': { success: true, curso: { id: 'demo', title: 'El Cuidador en Zendity', content: CONTENIDO } },
    '/api/academy': { success: true, enrollments: [] },
});

export default function Vista() {
    useEffect(() => {
        const t = setTimeout(() => {
            const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent?.trim() === 'Comenzar') as HTMLButtonElement | undefined;
            b?.click();
        }, 700);
        return () => clearTimeout(t);
    }, []);
    return (
        <Andamio ancho={1100}>
            <div className="p-8 max-w-sm">
                <InteractiveCourseCard
                    course={{ id: 'demo', title: 'El Cuidador en Zendity', description: 'Tu turno, de la entrada al cierre.', category: 'Tecnologia Zendity', durationMins: 30, bonusCompliance: 20, imageUrl: null }}
                    user={{ id: 'demo-user', hqId: 'demo-hq' }}
                />
            </div>
        </Andamio>
    );
}

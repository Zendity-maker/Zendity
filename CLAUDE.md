# CLAUDE.md — Reglas Críticas del Proyecto Zéndity

Este archivo lo lee Claude Code automáticamente. Las reglas aquí son **NO NEGOCIABLES**.

---

## 🛑 BASE DE DATOS — REGLAS DE ORO

El 20-may-2026 se perdió toda la data de producción por un `prisma db push --force-reset` accidental.
Residentes, medicamentos, horarios, historial clínico — todo. No volvió.

### Prohibido absolutamente

1. **JAMÁS** correr `prisma db push --force-reset` por ningún motivo
2. **JAMÁS** correr `prisma migrate reset` (es destructivo)
3. **JAMÁS** correr `prisma db push` directamente sin pasar por el guard `npm run db:push`
4. **JAMÁS** correr `export $(cat .env ...) && npx prisma db push` — `.env` apunta a producción

### Si Prisma sugiere `--force-reset`

Significa que hay drift en el schema. Tu respuesta correcta es:

1. **PARAR**. No correr nada destructivo.
2. Reportar al usuario lo que Prisma sugiere y por qué.
3. Pedir autorización explícita antes de continuar.
4. Considerar `prisma migrate dev --name <descripcion>` como alternativa segura.

### Cambios de schema legítimos

```bash
npm run db:push              # corre el guard de seguridad
```

El guard:
- Bloquea `--force-reset` SIEMPRE.
- Detecta prod por host explícito (`ep-wispy-queen-ae20881h`); branches Neon son OK sin flag.
- Exige `ALLOW_PROD_PUSH=YES_EXPLICIT` solo si el host es prod real.
- Hace ECHO del host TARGET antes de ejecutar — si ves un host inesperado, ABORTA con Ctrl-C.
- Aísla Prisma del `.env` del repo durante el push (lo mueve temporalmente y lo restaura al final) → la única fuente de `DATABASE_URL` es la env var del shell.
- Para probar el guard sin tocar DB: `npm run db:push -- --guard-dry-run`.

---

## 🔐 Variables de Entorno

- `.env` apunta directo a **producción** (Neon). Tratarlo como **read-only de producción**
- Cualquier comando que cargue `.env` y toque DB → impacta producción
- **`.env.local` apunta a la rama de desarrollo** y gana sobre `.env` en Next.js

### Ya hay rama de desarrollo — 27-sep-2026

Proyecto Zendity `sweet-cloud-50963332`, rama **`desarrollo`**, copia de `main`
hecha el 27-sep. Su endpoint es `ep-silent-silence-aebwfpsh`; producción es
`ep-wispy-queen-ae20881h`. Son distintos, y de ahí sale todo lo demás.

| | dónde vive | a qué habla |
|---|---|---|
| `npm run dev` | `.env.local` gana | **rama de desarrollo** |
| `npx tsx script.ts` con `@/lib/prisma` | Prisma carga `.env`, no `.env.local` | **producción** |
| `npm run db:push` / `db:migrate` | la env var del shell | lo que le pases |

Esa segunda fila es la trampa: un script de medición sigue leyendo producción, que
es lo que se quiere para medir — pero **si escribe, escribe en producción**. Para
apuntar un script a la rama hay que pasarle la URL a mano.

Comprobado el día de crearla: las dos bases traían lo mismo (49 residentes, 41
usuarios, 30.464 administraciones, 1.629 turnos, 2 sedes) y una tabla creada en
desarrollo **no aparece** en producción.

> **⚠️ 02-oct-2026: la rama está VACÍA.** Medido contra
> `ep-silent-silence-aebwfpsh`: 114 tablas, **0 sedes, 0 residentes, 0 usuarios**,
> 15 MB, y **no existe la tabla `_prisma_migrations`**. El esquema es el de
> `schema.prisma` de finales de septiembre (tiene `colorGroup2`, no tiene
> `esDiurno`). Esa huella —esquema completo, cero filas, cero historial— es la de
> un `db push` o un reset sobre la rama, no la de una copia de `main`.
>
> Consecuencias, las dos que importan:
>
> 1. `npm run dev` levanta la app contra una base sin datos. No rompe nada —ese
>    lado sigue siendo seguro— pero **probar ahí no prueba nada**: no hay sesión
>    útil, los endpoints devuelven 401 y las pantallas salen vacías.
> 2. **No correr `prisma migrate dev` contra esa rama.** Vería 114 tablas sin
>    historial de migraciones y ofrecería resetear. La salida segura es
>    `migrate resolve --applied` de las que ya refleja y luego `migrate deploy`,
>    o borrarla y recrearla desde `main`.
>
> Mientras siga así, lo que se mida se mide contra producción, en solo lectura.

Los datos son una **foto del 27-sep** y no se actualizan solos. Para refrescarla se
borra la rama y se vuelve a crear (`npx neonctl branches delete/create`).

### El guard de `npm run dev`

`scripts/dev-guard.sh` dice en alto a qué host va a hablar la app y de qué fichero
salió la `DATABASE_URL`, y **no arranca contra producción** sin `DEV_CONTRA_PROD=SI`
(vale en el shell o en un `.env`). Con la rama puesta no dice nada: una rama no casa
con el patrón de producción.

Por qué existe: antes del 27-sep, `.env.local` llevaba una `DATABASE_URL` con la
contraseña caducada —por eso `npm run dev` no conectaba— apuntando al host de
producción **sin pooler**. Arreglar esa contraseña, que es un cambio de una línea,
habría puesto el servidor de desarrollo a escribir en la base del hogar sin que nada
lo dijera. La contraseña rota estaba tapando el problema de verdad.

El patrón que distingue producción (`ep-wispy-queen-ae20881h`) vive **en un solo
sitio**, `scripts/lib/host-produccion.sh`, del que tiran los tres guards. Estaba
escrito dos veces.

Y ojo con `.gitignore`: `scripts/*` ignora todo lo nuevo de esa carpeta. Un guard
recién escrito se queda fuera del repo sin avisar. Cada uno necesita su `!línea`.

---

## ✅ Antes de Cualquier Commit

```bash
npx tsc --noEmit 2>&1 | head -10 && echo "TSC_EXIT:0"
```

Solo hacer commit si TSC_EXIT: 0 y sin errores en archivos de producción (tests e2e pueden ignorarse).

---

## 🎨 Identidad de Producto

- El nombre es **Zéndity** con acento en la É — en UI, emails, copy
- Paleta primaria: teal-600 (#0F6E56), teal-500 (#1D9E75)
- Trabajo siempre en español

---

## 🔧 Workflow de Git

- Commits descriptivos en español: `feat:`, `fix:`, `chore:`, `redesign:`, `perf:`
- Push directo a `main` salvo que el usuario pida lo contrario
- Nunca dejar trabajo en branches `claude/*` sin mergear

---

## 📋 Multi-tenant

- `hqId` **siempre** se obtiene de `session.user.headquartersId` en el servidor
- **Nunca** del body del request (vulnerabilidad)
- Toda query de datos debe filtrar por `headquartersId` del invoker

---

## 🚫 Anti-patrones Conocidos

1. **`ShiftSchedule`** es modelo viejo sin datos. Usar **`ScheduledShift`**.
2. **Hardcodear hqId** en código (ej. `b5d13d84-...`) — siempre resolver dinámicamente
3. **Datos mock en producción** — el commit `5739e8a` los eliminó. No reintroducir.
4. **Email remitente hardcoded** — usar siempre `process.env.SENDGRID_FROM_EMAIL`
5. **Plaintext PINs en email** — eliminado en commit `34ddc60`. No volver atrás.
6. **Escribir sin guarda contra doble envío** — ver abajo.
7. **Listar personas sin filtrar a quien ya no está** — ver abajo.
8. **Un examen que se aprueba sin leer** — ver abajo.
9. **Medir un campo que no pediste en el `select`** — ver abajo.
10. **Filtrar por una fecha que está nula justo en las filas que importan** — ver abajo.
11. **Escribir la lista de colores en el sitio donde se usa** — ver abajo.
12. **Un dato de la base escrito como constante** — ver abajo.

---

## 🎨 Los grupos de color: `src/lib/colores-de-grupo.ts`

*02-oct-2026, al abrir MORADO.*

La lista de colores estaba escrita **dieciocho veces**: nombres en español,
hex, clases de Tailwind, teclas del constructor, RGB del PDF del censo. Añadir
un valor al enum y olvidar uno de esos sitios **no da error**: da un punto
invisible (`undefined` como clase no pinta nada), una insignia en blanco, un
grupo que no se puede cubrir, un residente que no sale.

**Para abrir un color nuevo se rellena UNA fila** de `COLORES_DE_GRUPO` y se
añade el valor al enum `ColorGroup` por migración. Nada más.

Tres cosas que se aprendieron haciéndolo, y que se repetirán:

- **El grep por `RED|YELLOW` no encuentra todo.** `RondaCard.tsx` solo dice
  ROJO/AMARILLO; un filtro del constructor era la cadena `'12340⌫↵'` —las
  teclas, sin nombrar ningún color—. Lo que sí los encontró fue derivar el
  TIPO de la lista (`as const satisfies`): el compilador pidió el color que
  faltaba, uno por mapa.
- **Las clases de Tailwind van escritas ENTERAS y literales.** Tailwind v4
  escanea el código como texto: `bg-${color}-500` o `border-l-[${hex}]` no
  aparecen escritas en ninguna parte y no se generan. En
  `corporate/calendar` esos puntos llevaban sin pintarse desde siempre.
- **Lo que no es un color vive aparte.** `ALL`, `SUPERVISION`, `NONE` y
  `UNASSIGNED` conviven en los mismos campos y no son colores. Al sustituir un
  mapa por un spread hay que volver a añadirlos a mano o se pierden.

**La lista NO sabe qué colores tienen residentes.** Eso se le pregunta a la
base (`coloresConResidentes` / `derivePopulatedColors` en `shift-coverage.ts`).

---

## 📌 Un dato de la base escrito como constante

*02-oct-2026.* El constructor de horarios llevaba
`const COLORES_CON_RESIDENTES = ['RED', 'YELLOW', 'BLUE']`, con un comentario
que explicaba muy bien por qué GREEN no contaba: tenía cero residentes, y
exigir que esté cubierto un grupo sin nadie es pedir que alguien cuide a nadie.

El razonamiento era correcto. El problema es que era un **dato**. El
01-oct-2026 entró un residente diurno a GREEN y la lista se volvió falsa en
silencio: su grupo dejó de contar para la cobertura, así que el builder no
pedía que nadie lo cubriera **ni lo marcaba como hueco**. Nada falló.
Simplemente dejó de preguntar.

**La señal:** un comentario que justifica una constante citando un conteo
(«GREEN tiene cero residentes», «en Cupey hay tres grupos de once»). Si hay que
contar algo para saber si la constante es cierta, no es una constante.

Y al pasarlo a dato, `null` (todavía no se sabe) **no es** `[]` (ninguno). Los
dos se pintaban igual: en verde, «todo cubierto».

---

## ⚠️ Los dos que más se repiten

Estos dos aparecieron **cuatro veces cada uno** en septiembre de 2026, en sitios
que no tenían nada que ver entre sí. No son bugs sueltos: son la forma por
defecto de equivocarse en este código. Compruébalos SIEMPRE al tocar algo
nuevo.

### 1. Un POST que escribe sin guarda contra doble envío

Un doble toque, o un reintento porque la pantalla se vio lenta, y hay dos filas
donde debía haber una. Nadie se entera hasta que alguien cuenta.

| Dónde | Qué produjo |
|---|---|
| `/api/care/vitals` | 30 tomas duplicadas de 5,483 |
| `/api/care/incidents` | una caída de Pura contada dos veces |
| `/api/intake` y `/api/preingreso` | dos residentes duplicados en cuatro meses |
| `/api/corporate/crm/leads` | sin guarda todavía — el CRM está dormido |

**La forma correcta**, igual en los tres: buscar si existe una fila equivalente
en una ventana corta y **devolver ÉXITO con la que ya existe**, no un error.
Quien pulsó hizo lo correcto; un error en rojo le hace intentarlo otra vez, que
es justo lo que produce el duplicado. Ver `src/lib/residente-duplicado.ts`.

La ventana se elige por el acto, no por costumbre: 2 minutos para unos vitales,
5 para una caída, 10 para un alta. Y si el registro admite fecha retroactiva,
comparar **la fecha del evento**, no solo la de escritura — si no, dos caídas
viejas del mismo residente escritas seguidas se tragan una a otra.

### 2. Una consulta de personas que no filtra a quien ya no está

`Patient` sin `status: 'ACTIVE'`, o `User` sin `isActive` / `isDeleted`. El
resultado siempre es el mismo: el sistema le pide trabajo a alguien sobre gente
que se fue, o señala a un empleado que ya no trabaja aquí.

| Dónde | Qué mostraba |
|---|---|
| Úlceras | las de Wilfredo, fallecido hacía 84 días |
| Riesgo de caídas | residentes dados de alta y fallecidos |
| Señales de personal | Medelyn García, inactiva y borrada |
| Leaderboard del wall | Eiby Caraballo, inactiva, en el "Top 5" de la pared |
| Digest de relevo, horarios, concierge | corregidos el 09-sep-2026 |
| Ausencias sin motivo (`pantalla-direccion`) | pedía completar **4** motivos; 3 eran de Zuleyka Valcárcel y Joaneliz Rosario, borradas hacía meses. Trabajo imposible en la lista del director — *21-sep* |
| Ausencias de hoy (`estado-operativo`) | **17 de 24** eran de gente que ya no trabaja aquí — *21-sep* |

**Y en `ScheduledShift` va acompañado de un segundo filtro: `schedule.status:
'PUBLISHED'`.** Un horario en BORRADOR es un ensayo del constructor; sus
ausencias no son hechos. `shift-coverage`, `cuidadora-a-cargo` y
`uncovered-colors` ya lo filtran — si escribes una consulta nueva contra
`ScheduledShift` y no lo lleva, eres la divergencia.

**Pero no es un filtro que se ponga en todas partes.** Una búsqueda de UN
expediente por id NO debe filtrar: hay que poder abrir el de alguien que
falleció. La regla es por la forma de la consulta:

- **Lista o conteo** para trabajo pendiente, una pantalla o una métrica → filtra
- **Un registro por id**, historial o auditoría → no filtra

Al 10-sep-2026 quedan **83 consultas** unidas a `patient` por sede sin `status`
que piden revisión una por una. No se tocan en bloque.

---

## 📅 La fecha por la que filtras está nula justo donde importa

*Seis casos el 11-sep-2026, todos el mismo día y ninguno relacionado con otro.*

Dos campos de `MedicationAdministration` parecen buenos para acotar "lo de hoy"
y los dos mienten:

| campo | cuándo es null | *remedido el 21-sep-2026, 7.567 filas de 30 días* |
|---|---|---|
| `administeredAt` | **siempre que el estado NO sea `ADMINISTERED`** — `meds/bulk` lo escribe así a propósito | sigue exacto: 7.071 con valor, y los 496 sin él son justo los MISSED, PENDING y OMITTED |
| `scheduledTime` | ~~siempre~~ **ya no.** El cron lo llena desde el **15-sep-2026** | 1.981 de 7.567 (26%). Por estado: **MISSED 232/232, PENDING 262/262**, ADMINISTERED 1.487/7.071, OMITTED 0/2 |

Filtrar por cualquiera de los dos **excluye en silencio las omisiones**, que son
justo lo que se quiere contar. Y no da error: da un número tranquilizador.

**`scheduledTime` cambió de trampa, no dejó de tenerla — y la nueva es peor.**
Antes estaba vacío y cualquier consulta daba cero, que al menos se nota. Ahora
está lleno **justo en las filas de hoy**: si lo compruebas contra la base, lo ves
al 100% en lo que te importa y te fías. Pero es null en todo lo anterior al
15-sep, así que acotar por él **tira la historia entera sin decirlo**. La regla
de abajo no cambió; el motivo sí.

| dónde | qué decía |
|---|---|
| `shift-closure-report.ts` | todo relevo decía "no se omitió nada" |
| `care/supervisor/shift-audit` | la auditoría de turno, "cero omisiones" |
| `corporate/director-briefing` | cumplimiento eMAR **100% por construcción** |
| `corporate/trends` | la tendencia, igual |
| `family/dashboard` y `cron/family-digest` | la familia nunca ve el estado de los medicamentos |
| `emar/patient/[id]` y la evaluación de TS | adherencia **100% las ocho semanas** desde el 27-jul. La del 14-sep es 89% de verdad (1.795/2.027, 232 omisiones) — *arreglado 21-sep, commit `61db430c`* |

**La regla:** para acotar "lo de hoy" en una tabla de eventos, usa `createdAt`,
que siempre tiene valor. `administeredAt` y `scheduledTime` sirven para mostrar
la hora, no para filtrar el día.

**Y el denominador tampoco es libre.** Por `createdAt` a secas entran las dosis
`PENDING` y la adherencia se hunde al 3% — el error contrario y igual de falso:
una PENDING no está fallada. El denominador son las dosis **resueltas**:
`ADMINISTERED, MISSED, OMITTED, REFUSED, HELD`. Sin ninguna resuelta, el valor es
**null**, nunca un 100% de relleno dentro de un expediente clínico.

**Y el olor a detectar:** una métrica que sale redonda siempre —100%, 0%,
"ninguno"— no es una métrica buena, es una métrica que no puede moverse.
Compruébalo simulándola: ¿bajo qué dato daría otra cosa? Si no hay ninguno, está
rota. El mismo día, la cobertura de comidas del panel del director era el espejo:
una alarma que **no podía dejar de sonar** porque dividía entre las tres comidas
del día a las 8:38 de la mañana.

**Y un cero tiene dos significados que la pantalla no distingue sola.** «No hubo
nada que señalar» y «no sabemos» se pintan idénticos: 0 en verde con un ✅. La
auditoría de turno felicitaba por **69 de 793 sesiones** de las que no se pudo
resolver a quién cuidaba la persona —y en 67 de esas 69 no existe *ninguna* pauta
que cubra la hora del ponche—: «Brechas 0 ✅, Sin actividad 0 ✅, Detalle por
residente (0)», igual que un turno impecable. Si tu cálculo puede no saber la
respuesta, **devuelve por qué** (ahí, `colorSource: 'unresolved'`) y que la
pantalla lo diga. Un cero sin procedencia es una afirmación que nadie hizo.

### Tres anclas del mismo día, y NO son intercambiables

*21-sep-2026.* No todo campo de fecha se compara con el mismo cero. En este repo
hay tres, todas a propósito, y usar la que no toca **no da error**:

| ancla | qué vale | para qué campo |
|---|---|---|
| `todayStartAST()` | 10:00 UTC = 6 AM AST, el día **clínico** | timestamps reales: `createdAt`, `timeLogged`, `administeredAt` |
| `clinicalDayCalendarUTCRange()` | 00:00 UTC del día natural | **`ScheduledShift.date`**, que se persiste a medianoche UTC |
| `fechaCalendarioAST()` | medianoche natural de PR | el menú y lo que se cuenta por día de calendario |

El fallo: `estado-operativo` filtraba `ScheduledShift.date >= todayStartAST()`.
Una fecha de **00:00 UTC nunca es >= 10:00 UTC del mismo día**, así que la
consulta excluía *estructuralmente* el día en curso. Y sin cota superior no
devolvía cero —que se habría notado— sino las ausencias **futuras**: nombres
reales de gente que falta la semana que viene, bajo el rótulo «ausencias de hoy».
Medido día a día sobre 120 días: **19 líneas en total y ninguna era del día que
decía el rótulo.**

**Cómo detectarlo:** si comparas un campo `Date` contra un ancla, comprueba a qué
hora se GUARDA ese campo. Si se guarda a 00:00 UTC y tu ancla son las 10:00 UTC,
la condición es constante, no es un filtro. Un rango con `gte` **y** `lt` habría
convertido el fallo en un cero visible.

**Y hay una cuarta forma de mezclarlas, que es COMPONER.** *02-oct-2026.*
`astDateTime(fecha, hora, min)` no recibe el mismo tipo de fecha que devuelve
`fechaCalendarioAST()`, aunque las dos se llamen «la fecha de hoy»:

- `fechaCalendarioAST()` devuelve **medianoche UTC** del día de PR. Es la llave
  con la que se GUARDA.
- `astDateTime()` espera una fecha cuyo **día de pared AST** sea el que quieres:
  le resta 4 h para leerlo. Restarle 4 h a medianoche UTC cae en las 20:00 del
  día ANTERIOR.

Escrito como `astDateTime(fechaCalendarioAST(x), 7, 0)` —que es lo natural— la
jornada del residente diurno se componía el día anterior y no estaba nunca. No
daba error: daba `false` a mediodía. **A `astDateTime` se le pasa el INSTANTE**,
no la fecha normalizada.

### La frase que sustituye a una mentira tampoco puede ser una

*21-sep-2026, aprendido a media corrección.*

Al arreglar la adherencia hubo que escribir el texto que ve la trabajadora social
cuando no hay porcentaje. La primera redacción decía:

> «Las N dosis de esta semana todavía no toca darlas.»

Suena bien, explica, tranquiliza. Y es **una inferencia**, no el dato. Medido a
las 9:02 AST de ese mismo día: de las 262 dosis `PENDING`, **154 estaban pautadas
a las 8:00** y llevaban una hora sin firmar. La frase habría tranquilizado sobre
una omisión sin anotar — exactamente la mentira que el arreglo venía a quitar,
reinstalada en la frase que la sustituía. Quedó en «todavía sin resolver».

**La regla:** cuando quites un número falso, el texto que pongas en su lugar solo
puede decir lo que de verdad sabes. `sinResolver` es un conteo; **por qué** están
sin resolver, no lo sabe quien lo cuenta. Redactar la causa es tan fácil y tan
tentador como escribir el 100% de relleno, y se detecta igual: pregúntate qué
dato tendrías que mirar para que la frase fuera falsa, y míralo.

---

## 📝 Contenido de Academy — la correcta no puede ser la más larga

*Medido el 10-sep-2026.* En el **84%** de las 651 preguntas del catálogo la
respuesta correcta era la opción **más larga**. Al azar sería 25%. Alguien que
no leyera una palabra y marcara siempre la más larga **aprobaba 45 de las 130
secciones**.

Nadie lo puso ahí a propósito y no se ve leyendo las preguntas. Sale solo: al
escribir, la opción correcta se lleva dentro su propia justificación
—"...: la autonomía se mide actividad por actividad"— y las incorrectas no. La
clave crece sin que el autor lo note.

**La regla al escribir una pregunta:** la justificación va en la `EXPLICACION`,
no dentro de la opción. Ahí además enseña mejor, porque se lee DESPUÉS de
contestar, cuando la persona ya se comprometió con una respuesta. Cuando
recortar rompería la pregunta —las que enseñan a *escribir* una nota, donde la
respuesta correcta ES la descripción detallada— se engordan los distractores.

**Después de tocar contenido, medir:**

```bash
npx tsx scripts/auditar-examenes.ts
```

Debe decir **0 de 130 secciones**. Comprueba también "siempre la más corta" y
"siempre la misma letra". Y ojo con pasarse: 0% de claves largas es una
sobrecorrección —lo repartido de verdad es 25%— aunque en la práctica no abra
nada.

---

## 🆘 Si Algo Sale Mal

1. **PARAR** inmediatamente. No intentar arreglar con más comandos.
2. Reportar al usuario exactamente qué pasó.
3. Esperar instrucción antes de cualquier acción correctiva.

La regla número uno es: **prefiero romper el ritmo que romper producción.**

---

## 🔎 Auditoría Proactiva — observa, no esperes a que pregunten

Eres el experto técnico. Andrés es el dueño del producto. Cuando leas
código o veas pantallas, tu trabajo NO es solo ejecutar lo que pidió —
es señalar lo que tú ves que él no ve todavía. Lecciones aprendidas:

### Cada vez que toques una ruta de UI o API, pregúntate en silencio:

1. **¿Quién puede entrar aquí?**
   ¿El rol mínimo requerido es el adecuado? ¿Un DIRECTOR de un cliente
   puede ver/tocar datos de OTRO cliente?

2. **¿Hay filtro por `headquartersId`?**
   Las queries `findMany` sin where de hqId son **fuga multi-tenant**
   automática. Reportar siempre. (Caso: `/api/corporate/headquarters` GET
   regresaba TODAS las sedes sin filtro hasta que Andrés lo notó.)

3. **¿Hay verificación de ownership en operaciones por ID?**
   `PATCH /resource/[id]` debe verificar que el invoker tenga acceso a
   ese `[id]` específico, no solo el rol.

4. **¿Esta función es operacional o comercial?**
   - Operacional (gestionar residentes, staff, horarios) → DIRECTOR/ADMIN
   - Comercial (crear sedes, cambiar plan, gestionar licencias) → SUPER_ADMIN
   - Si están mezcladas, separarlas.

5. **¿El cron / job / endpoint público está autenticado?**
   `/api/cron/*` debe verificar `CRON_SECRET`. Endpoints `force-dynamic`
   accesibles sin sesión son sospechosos.

6. **¿Los datos sensibles están enmascarados en logs?**
   PIN, passcode, contraseñas, tokens → nunca a console.log.

7. **¿Los emails/notificaciones tienen contenido PHI?**
   El cuerpo del email NO debe contener diagnósticos, medicamentos
   específicos, ni datos clínicos identificables. Sí puede decir
   "tienes una notificación, entra a app.zendity.com".

8. **¿Este POST puede ejecutarse dos veces?**
   Si escribe una fila, ¿qué pasa con un doble toque o un reintento? Ver
   "Los dos que más se repiten" arriba. Ya costó duplicados en vitales,
   caídas y admisión.

9. **¿Estoy midiendo un campo que de verdad pedí?**
   El 11-sep-2026 afirmé que los 26 cursos no tenían portada. Miré
   `imageUrl` en un JSON que yo mismo había generado con un `select` de
   cinco campos donde `imageUrl` no estaba. Un campo que no pediste
   devuelve `null` en TODAS las filas, y eso se lee igual que "ninguno
   lo tiene". Antes de reportar un conteo de ceros, comprueba que el
   campo esté en el `select` — y contrasta contra la base, no contra una
   copia tuya recortada.

10. **¿Esta consulta lista personas?**
   Si devuelve una lista o un conteo de residentes o empleados para una
   pantalla, una alerta o una métrica, ¿filtra a quien ya no está? Cuatro
   pantallas distintas señalaban a gente fallecida o dada de baja.

11. **¿Esta lista carga TODO o pagina?**
   `findMany` sin take en producción = OOM en cuanto crezcas. Default
   sano: `take: 50` con paginación.

### Cuando veas algo desalineado:

**Reportalo como observación, aunque no te lo hayan pedido.** Ejemplo:
> "Mientras buscaba X, noté que `/api/corporate/headquarters` no filtra
> por hqId. Cualquier DIRECTOR puede ver todas las sedes del sistema.
> ¿Quieres que lo arregle ahora o lo agrego al sprint?"

No esperes. No suavices. No asumas que él ya lo sabe. **Si no lo dices tú,
nadie lo dice.**

### Casos pasados — patrones a buscar
- Force-reset en producción (incidente 20-may-2026 — pérdida total)
- Multi-tenant leak en `/corporate/headquarters` (descubierto 21-may)
- 241 handovers sin firmar (deuda silenciosa)
- 3 redirects rotos a `/auth/signin` (404 masivos)
- `complianceScore` con bandas desalineadas (default 75 vs umbral CRITICAL <80)
- Cron expone fórmula 75 pero schema decía default 50 (drift)
- Planes 'BASIC'/'PROFESSIONAL' aceptados como string pero degradaban a LITE silenciosamente
- Botón "Nueva Sede" en `/corporate/sedes` crea sede huérfana sin Director

---

## 🗂️ Decisiones de infraestructura — log

### Neon Serverless Driver / `driverAdapters` (Fase 2 de conexiones) — **DIFERIDA**
*Decidido 07-jun-2026.*

- **Estado**: NO aplicar. `src/lib/prisma.ts` se mantiene con el cliente TCP estándar
  de Prisma 5.22 + pooler de Neon (`-pooler` en `DATABASE_URL`).
- **Por qué se evaluó**: cold starts en serverless + propuesta del cliente Prisma con
  `PrismaNeon` adapter sobre WebSocket (~80-150ms ganancia en cold start).
- **Por qué se descarta hoy**:
  1. En Prisma 5.22, `driverAdapters` está marcado **preview**, NO GA. El API del
     constructor de `@prisma/adapter-neon@5.22` es basado en `Pool` (no `{ connectionString }`
     como en v6.x GA). Riesgo de comportamiento sutil en runtime sobre 285 callers,
     en código HIPAA, no se compensa.
  2. **28 de 40 `$transaction` del repo son interactivas** (`async (tx) => …`), patrón
     con limitaciones conocidas en driver adapters Prisma 5.x. Específicamente: handovers
     (`care/shift/end`, `claim-coverage`), UPP (`care/upp` ×2), cambio de condición,
     billing (`corporate/billing/*`), schedule builder (`hr/schedule/*`), kiosko externo,
     concierge, CRM. Cualquier regresión silenciosa rompe módulos clínicos en piloto.
     *(Recontado el 15-sep-2026: decía "21 de 24" y el repo había crecido. `actions/emar`
     salió de la lista porque el fichero se borró — estaba huérfano entero.)*
  3. Fase 1 (pooling Neon, conexiones 84→32) **ya resolvió el problema operacional**.
     La Fase 2 es optimización de latencia, no bloqueador.
- **Condiciones para retomar**: upgrade a **Prisma 6.16+** (donde `driverAdapters` es GA,
  el API se limpia a `new PrismaNeon({ connectionString })`, y las transacciones
  interactivas son maduras sobre adapters). Pasos: branch dedicada, smoke test específico
  de los 5 callsites clínicos críticos (shift/end ×2, claim-coverage, upp ×2),
  comparar latencias en preview, decidir merge.
- **No es bloqueador del piloto**.

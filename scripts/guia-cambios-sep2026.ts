/**
 * LAS GUÍAS DE LOS CAMBIOS DE SEPTIEMBRE 2026
 * ───────────────────────────────────────────
 * Un PDF por rol, para las reuniones de turno.
 *
 * NO ES UN LISTADO DE CAMBIOS. Un changelog está escrito desde el punto de
 * vista del software y no se recuerda. Cada punto de aquí es: qué pasaba antes,
 * qué hacer ahora, y EL CASO REAL que lo provocó — porque los casos son suyos.
 * Fernando, Carmen, la avena, el Warfarin. Nadie olvida una regla cuando la
 * regla tiene la cara de alguien.
 *
 * Y va por rol porque los cambios se parten limpio. A una cuidadora contarle el
 * reporte semanal de dirección es gastar la única media hora que va a prestar.
 *
 * Uso: npx tsx scripts/guia-cambios-sep2026.ts [carpeta-destino]
 */
import { writeFileSync } from 'fs';
import { generarGuiaPDF, type Guia } from '../src/lib/guia-pdf';
import { join } from 'path';

/* ═══════════════════ EL CONTENIDO ═══════════════════ */

const CUIDADORAS: Guia = {
    archivo: 'guia-cuidadoras',
    paraQuien: 'Para las cuidadoras',
    entradilla: 'Casi todo lo que cambió salió de algo que ustedes hicieron bien con una herramienta '
        + 'equivocada, porque la correcta no existía. Nada de esto es una corrección a nadie.',
    puntos: [
        {
            titulo: 'Cuando come poco o nada, ahora se dice por qué',
            antes: 'Solo se marcaba cuánto: todo, mitad, poco, nada. Y ahí quedaba.',
            ahora: 'Al tocar "Poco" o "Nada", la tableta pregunta por qué, y hay un campo para escribir qué SÍ aceptó. Eso le llega a la cocina.',
            donde: 'Bitácora > Registro Nutricional, después de elegir la comida.',
            caso: 'Alguien escribió a mano: "Se niega diariamente a desayunar tostadas, sándwiches o '
                + 'panqueques. Solo acepta avena." Esa frase resuelve el desayuno de esa señora, y la '
                + 'cocina nunca la leyó porque estaba en una nota de turno. Había 258 "no comió nada" sin una sola causa.',
        },
        {
            titulo: 'Si rechaza y no dice por qué, esa opción existe',
            antes: 'Había que elegir un motivo aunque no lo supieras.',
            ahora: 'La lista incluye "Rechazó y no dijo por qué" y "Estaba fuera del hogar". No hay que inventar nada.',
            caso: 'Esta es la regla de todo lo demás: cuando la lista no tiene la opción de verdad, '
                + 'la persona elige la menos equivocada y el registro miente. Preferimos un "no sé" cierto a un motivo falso.',
        },
        {
            titulo: 'Botón nuevo: "Algo cambió en el residente"',
            antes: 'Lo que notabas y no era emergencia terminaba en una nota que nadie relee.',
            ahora: 'Eliges qué cambió —camina distinto, come distinto, más confundido, ánimo, piel, dolor, sueño, continencia— y lo describes con tus palabras. Enfermería lo revisa y TE CONTESTA.',
            donde: 'En la tarjeta del residente, bloque "Algo cambió".',
            caso: 'Alguien escribió: "Presenta dificultad para caminar y lo hace inclinado. Es necesario '
                + 'trasladarlo en silla de ruedas para evitar caídas." Eso cambia el plan de cuido y el '
                + 'riesgo de caídas. Se quedó en el texto.',
        },
        {
            titulo: 'Los botones están en tres grupos',
            antes: 'Cuatro filas sin orden. "Trasladar ER" pesaba lo mismo que "Bitácora".',
            ahora: 'LO DE SIEMPRE (medicamentos, diálisis) · ALGO CAMBIÓ (vitales, bitácora, preventiva, algo cambió) · ALGO PASÓ (caída, traslado, fallecimiento), separado por una línea.',
            caso: 'Baño, comida y rotación NO se movieron. Se tocan cientos de veces al día y ya tienen memoria muscular.',
        },
        {
            titulo: 'Reportar un fallecimiento tiene su propio botón',
            antes: 'No existía. La única salida era "Trasladar ER".',
            ahora: 'El botón lo saca del piso en el momento y avisa a dirección. NO lo pone en fallecidos, no cierra el expediente y no libera el cuarto — eso lo hace administración.',
            donde: 'Bloque "Algo pasó", debajo de traslado.',
            caso: 'El 4 de septiembre falleció un residente y en el sistema siguió activo, pidiendo baño '
                + 'y comidas. Quien estaba de turno no falsificó: usó el único botón que su rol le daba. '
                + 'Hizo lo correcto con la herramienta equivocada. Ahora existe la correcta.',
        },
        {
            titulo: 'La salida a diálisis está donde va',
            antes: 'Se veía como una salida excepcional.',
            ahora: 'Está en "lo de siempre", junto a medicamentos, para quien tiene diálisis. Porque para esa persona no es un evento: es su martes.',
            caso: 'La salida a diálisis de una residente se registró como "salió con la familia". No fue un descuido: el botón estaba donde no se buscaba.',
        },
        {
            titulo: 'Omitir un medicamento ya no te cuesta puntos',
            antes: 'El desplegable venía preseleccionado en "Residente lo rechazó" — quien no lo tocaba culpaba al residente sin querer. Y omitir restaba 8 puntos.',
            ahora: 'Hay que elegir el motivo, y hay dos nuevos: "Fuera del hogar" y "Residente falleció". Registrar una omisión ya no resta nada.',
            caso: 'En 24,537 medicamentos administrados solo había TRES omisiones. Eso no es un hogar '
                + 'donde nunca se omite: es que decir la verdad salía caro. Se quitó el precio.',
        },
        {
            titulo: 'Vitales: ya no hay que llenarlo todo',
            antes: 'Presión, temperatura y pulso eran obligatorios. Para anotar solo una glucosa había que llenar los otros cuatro.',
            ahora: 'Llenas lo que mediste. Si solo tomaste la glucosa o el peso, registras solo eso. Y ahora hay campo de PESO, que antes no existía en ninguna parte.',
            caso: 'De 4,836 tomas, la glucosa aparecía en el 1% — con once residentes diabéticos y dos con insulina. La forma decidía qué se medía.',
        },
    ],
    cierre: 'Si algo de esto no funciona como dice aquí, díganlo. Cada cosa de esta lista salió de '
        + 'mirar lo que ustedes escribieron a mano, así que lo que escriban sigue siendo la mejor '
        + 'fuente que tenemos.',
};

const CLINICO: Guia = {
    archivo: 'guia-enfermeria-supervision',
    paraQuien: 'Para enfermería y supervisión',
    entradilla: 'Además de lo que verán las cuidadoras, hay siete cosas que son suyas. Cuatro son '
        + 'pantallas nuevas y tres son huecos que estaban abiertos.',
    puntos: [
        {
            titulo: 'Pantalla "Enfermería": lo que te toca hoy',
            antes: 'El trabajo estaba repartido en siete pantallas y ninguna decía si había algo pendiente. Había que entrar a las siete a comprobarlo.',
            ahora: 'Una lista de trabajo con lo que espera, de lo más urgente a lo menos, y cada línea lleva a donde se hace. Nada se tacha a mano: cada número desaparece cuando el trabajo se registra.',
            donde: 'Menú > Enfermería.',
        },
        {
            titulo: 'Las úlceras ahora se pueden curar en el sistema',
            antes: 'No existía forma de registrar una curación. La API solo permitía CREAR una úlcera, nunca añadirle una nota ni cerrarla.',
            ahora: 'En Rotación / UPP, la etiqueta de la úlcera es un botón. Registras qué aplicaste, la medida, cómo la viste, corriges el estadio, y puedes darla por resuelta. Si sube de estadio, avisa sola.',
            donde: 'Rotación / UPP > tocar la etiqueta roja de la úlcera.',
            caso: 'Cuatro úlceras registradas, las cuatro con UNA sola curación: la del día que se '
                + 'abrieron. Una sacra estadio 4 llevaba 77 días así, y dos seguían abiertas 84 días '
                + 'después de que el residente falleciera. No era descuido: no había cómo.',
        },
        {
            titulo: '"Cambios del piso": lo que reportan las cuidadoras',
            antes: 'No existía.',
            ahora: 'Cada cambio que reportan espera tu revisión, con un contador en el menú que no baja hasta que lo cierras. Al cerrarlo, a quien lo reportó le llega tu respuesta.',
            donde: 'Menú > Cambios del piso.',
            caso: 'Dos observaciones de personal llevaban 56 y 45 días paradas, y las dos SÍ habían '
                + 'disparado su notificación. Un aviso se lee una vez y se va; un contador insiste.',
        },
        {
            titulo: '"Lo que Zendi encontró": preguntas, no hechos',
            antes: 'La IA solo escribía mensajes para familias.',
            ahora: 'Cada lunes lee las notas de la semana y señala lo que no tiene dónde guardarse, lo que contradice al expediente, y lo que debió avisar. Cada tarjeta lleva la FRASE EXACTA. Lees la frase y decides: es real, o no aplica.',
            donde: 'Menú > Lo que Zendi encontró.',
            caso: 'No es un diagnóstico ni una orden. Si Zendi se equivoca, se descarta con una razón '
                + 'y ya. Lo que no puede hacer es cambiar nada por su cuenta.',
        },
        {
            titulo: 'Medicamentos: frecuencia, días y quién lo recetó',
            antes: 'El formulario no pedía la frecuencia, así que "semanal" se escribía dentro del horario: "08:00 AM (Semanal)". El sistema no sabe leer eso y descartaba el medicamento en silencio.',
            ahora: 'Se elige: todos los días / solo ciertos días / por razón necesaria. Y hay campo para el médico que lo recetó. No deja guardar un horario que el sistema no vaya a poder leer.',
            donde: 'Med & Zoning > añadir medicamento.',
            caso: 'TRECE medicamentos activos no aparecían en ningún pack y nadie los administraba nunca. '
                + 'Entre ellos un Warfarin —anticoagulante— con 107 días sin una sola administración. '
                + 'Hay que corregirlos a mano; están listados en el reporte del lunes.',
        },
        {
            titulo: 'Los PRN se registran de uno en uno',
            antes: 'El botón mandaba TODOS los medicamentos del turno y los marcaba como administrados. Se usó una vez en la historia del sistema.',
            ahora: 'Eliges el medicamento, dices para qué, y después el sistema pregunta si hizo efecto. "Sin efecto" avisa a enfermería.',
            donde: 'Medicamentos > Registrar dosis PRN.',
            caso: 'Cuatro medicamentos PRN activos con CERO administraciones registradas, contra 27 notas de turno diciendo que se administró algo.',
        },
        {
            titulo: 'El menú ya no cambia al abrir el PAI',
            antes: 'Abrir el Plan de Cuido te llevaba al menú corporativo, con 45 enlaces que no son tuyos y sin forma de volver.',
            ahora: 'El menú lo decide tu rol. Y Expedientes, Auditoría eMAR y Catálogo de Farmacia están ahora en el menú clínico, que es donde se buscan.',
        },
    ],
    cierre: 'Los lunes a las 8:30 llega un correo con todo lo pendiente y los nombres en el PDF adjunto. '
        + 'No hace falta abrir las pantallas para saber si hay algo: si hay algo, llega.',
};

const COCINA: Guia = {
    archivo: 'guia-cocina',
    paraQuien: 'Para cocina',
    entradilla: 'Un solo cambio, pero cambia lo que puedes hacer con la comida que vuelve.',
    puntos: [
        {
            titulo: '"Lo que no se comieron", con el motivo',
            antes: 'Veías las dietas y los menús, y nada de cómo le fue a lo que mandaste.',
            ahora: 'Una sección con los residentes que rechazaron comida en los últimos 14 días, agrupada, con el motivo y —lo importante— QUÉ SÍ ACEPTAN.',
            donde: 'Cocina y Nutrición, encima del censo.',
            caso: 'Una residente lleva meses rechazando el desayuno. Alguien escribió a mano que solo '
                + 'acepta avena, pero eso vivía en una nota de turno que la cocina no lee. Ahora llega aquí.',
        },
        {
            titulo: 'Lo clínico no te llega, y es a propósito',
            antes: '—',
            ahora: 'Náusea, dolor y agitación van a enfermería, no aquí. Solo te llega lo que se arregla cocinando: no le gustó el plato, sin apetito, dificultad para tragar (que cambia la textura), y los rechazos sin explicación.',
        },
    ],
    cierre: 'Si ves un patrón que la pantalla no explica, díselo a enfermería. La lista es para actuar, no para archivar.',
};

const destino = process.argv[2] || '.';
for (const g of [CUIDADORAS, CLINICO, COCINA]) {
    const buf = generarGuiaPDF(g);
    const ruta = join(destino, `${g.archivo}.pdf`);
    writeFileSync(ruta, Buffer.from(buf));
    console.log(`${g.paraQuien.padEnd(32)} ${(buf.byteLength / 1024).toFixed(0)} KB  ->  ${ruta}`);
}

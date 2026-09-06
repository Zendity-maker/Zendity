/**
 * GUÍAS DEL SEGUNDO BLOQUE DE SEPTIEMBRE 2026
 *
 *     npx tsx scripts/guia-cambios-sep2026-b.ts [carpeta]
 *
 * El domingo 6 de septiembre se trabajó un bloque entero: el módulo de úlceras,
 * el dossier del médico, los relevos y las alergias. Va en guía APARTE de la
 * del bloque anterior, y no ampliando aquella, porque la primera ya se discutió
 * — mezclarlas obliga a releer todo o a no leer nada.
 *
 * LLEVA NOMBRES REALES, por decisión de Andrés. Es lo que hace que una regla se
 * recuerde: nadie olvida los 106 días de Dwight. Es un documento con PHI: se
 * imprime para la reunión y se guarda o se destruye después. No se manda por
 * correo.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { generarGuiaPDF, type Guia } from '../src/lib/guia-pdf';

const PERIODO = 'Septiembre 2026 · bloque 2';

const CUIDADORAS: Guia = {
    archivo: 'guia-b-cuidadoras',
    paraQuien: 'Para las cuidadoras',
    periodo: PERIODO,
    entradilla:
        'Casi todo esto salió de algo que ustedes hicieron BIEN con una herramienta que no llegaba '
        + 'a ningún sitio. Reportaron lo que vieron; el sistema lo guardó en un sitio donde nadie lo '
        + 'leía. Eso se arregló, y hay un botón nuevo.',
    puntos: [
        {
            titulo: 'La alerta de piel ahora llega a enfermería — y te contestan',
            antes: 'Tocabas "Alerta Piel / UPP", escribías lo que viste, y esa nota se quedaba en el turno. No llegaba al módulo de úlceras ni a ninguna pantalla de enfermería.',
            ahora: 'Además de la nota, se abre un aviso que enfermería TIENE que revisar. Cuando lo revisen, te llega la respuesta: si es úlcera o si no lo es y por qué.',
            donde: 'El mismo botón morado de siempre, "Alerta Piel / UPP".',
            caso: 'El 23 de mayo Mariangelie escribió "Se detecta Piel Rota" de Dwight Santiago. '
                + 'El 25 Brendali escribió que Paul Carnero tenía un punto de presión. El 30 Mariangelie '
                + 'reportó llagas de Isidra Beaton. Las tres hicieron lo correcto. Las tres notas llevaban '
                + 'entre 99 y 106 días sin que nadie las viera, porque no había forma de que llegaran. '
                + 'En total eran NUEVE, y ya están todas en la pantalla de enfermería con su fecha real.',
        },
        {
            titulo: 'Botón nuevo: "cambié el apósito"',
            antes: 'Si tenías que cambiar un apósito porque estaba sucio o se ensució, no había dónde anotarlo. El expediente decía que esa úlcera llevaba semanas sin tocarse.',
            ahora: 'La etiqueta roja "UPP" de la tarjeta ahora se toca. Te pregunta POR QUÉ tuviste que cambiarlo —sucio, excremento, secreción, se despegó, sangrado, u otra cosa que escribes— y te enseña el plan del home care.',
            donde: 'En la tarjeta del residente, la etiqueta roja "UPP · cambié apósito".',
            caso: 'La úlcera de Luz M. Ríos aparecía con 77 días "sin curación". Puede que el apósito se '
                + 'haya cambiado treinta veces; el sistema no tenía dónde recogerlo. Ninguna de las dos '
                + 'cosas era verdad: ni que nadie la tocara, ni que estuviera curada.',
        },
        {
            titulo: 'No te pregunta qué le aplicaste, y es a propósito',
            antes: 'Para registrar cualquier cosa sobre una úlcera había que decir qué tratamiento se aplicó.',
            ahora: 'A ti no. Tú limpias y tapas hasta que venga la enfermera; el tratamiento lo pone el home care. Preguntarte qué aplicaste te obligaría a inventarte una respuesta.',
            caso: 'Esta es la misma regla de siempre: cuando el sistema exige un dato que la persona no '
                + 'tiene, la persona pone el menos equivocado y el registro miente. Preferimos un hueco '
                + 'cierto a un dato falso.',
        },
        {
            titulo: 'Si el apósito se ensucia mucho, enfermería se entera sola',
            antes: 'Nada.',
            ahora: 'Si registras excremento sobre una úlcera profunda, o el tercer cambio en un día, le llega aviso a enfermería automáticamente. No te bloquea nada: tú anotas y sigues.',
            caso: 'El 24 de agosto Zuleyka escribió de Luz A. Martínez: "La úlcera no mejora debido a la '
                + 'incontinencia fecal del paciente y a una limpieza inadecuada". Eso es exactamente lo que '
                + 'ahora dispara el aviso. Aquella nota estuvo trece días sin que el sistema lo supiera.',
        },
        {
            titulo: 'El plan del home care se ve donde lo necesitas',
            antes: 'El tratamiento que manda el home care estaba en la cabeza de alguien o en un papel.',
            ahora: 'Sale escrito dentro del formulario del apósito. Si todavía no está escrito, te lo dice y te pide que lo menciones en el relevo — no te deja adivinar.',
        },
    ],
    cierre:
        'Nada de esto te pide trabajo nuevo. Te pide el mismo trabajo con un botón que sí llega. '
        + 'Si tocas algo y no pasa nada, o el aviso dice algo raro, dilo — eso es un fallo nuestro, no tuyo.',
};

const ENFERMERIA: Guia = {
    archivo: 'guia-b-enfermeria',
    paraQuien: 'Para enfermería y supervisión',
    periodo: PERIODO,
    entradilla:
        'El módulo de úlceras enseñaba dos. El hogar tiene al menos trece documentadas. Esta guía es '
        + 'sobre por qué pasó eso, qué cambió, y qué hay que decidir esta semana.',
    puntos: [
        {
            titulo: 'Hay nueve reportes de piel esperando una decisión tuya',
            antes: 'El botón de piel de la tableta escribía una nota de turno y nada más. Once residentes tenían úlceras escritas en notas y cero fichas.',
            ahora: 'Los nueve de residentes activos están arriba del todo en la pantalla de enfermería, con su fecha real. Se resuelven ahí: o es úlcera y se declara, o no lo es y se cierra con tu respuesta — que le llega a quien lo reportó.',
            donde: 'Menú > Rotación / UPP. Bloque morado, arriba.',
            caso: 'José A. Troche (26-ago, Zuleyka): "Motivo: Curación d úlcera" — se fue al HOSPITAL por '
                + 'una úlcera que el sistema no sabía que existía. Luz A. Martínez (24-ago): la úlcera no '
                + 'mejora por incontinencia fecal. Rosa M. Solís (24-ago): "el pie con la úlcera ha mejorado". '
                + 'Y Dwight Santiago lleva 106 días desde "se detecta piel rota".',
        },
        {
            titulo: 'Tres cosas distintas sobre la misma herida, y dos relojes',
            antes: 'Todo se registraba igual. Un cambio de apósito reiniciaba el mismo reloj que una curación.',
            ahora: 'CURACIÓN (el tratamiento del plan) · CAMBIÉ EL APÓSITO (la cuidadora, limpia y tapa) · VERIFIQUÉ (tú la miraste). El cambio de apósito NO reinicia el reloj de la curación.',
            caso: 'Si lo reiniciara, la pantalla se callaría porque alguien cambió una gasa. Que es '
                + 'exactamente cómo una sacra estadio 4 —la de Luz M. Ríos— pasa 77 días sin que nadie '
                + 'la trate y el sistema parezca tranquilo.',
        },
        {
            titulo: 'El plan del home care ya tiene dónde vivir',
            antes: 'En la cabeza de alguien o en un papel. La cuidadora que cambia un apósito de madrugada no podía leerlo.',
            ahora: 'Se escribe desde el mismo formulario de la úlcera, con quién lo estableció. A partir de ahí la cuidadora lo ve en su tableta.',
            donde: 'Toca la etiqueta de la úlcera > "Escribir el plan".',
            caso: 'Hay un formulario en papel para que la enfermera del home care lo deje escrito cuando '
                + 'venga, y de ahí se pasa al sistema. Las cuatro úlceras registradas no tienen plan escrito.',
        },
        {
            titulo: 'Una úlcera se puede cerrar sin mentir sobre cómo acabó',
            antes: 'Solo existía "resuelta". Cerrar la úlcera de alguien que falleció obligaba a escribir que la herida sanó.',
            ahora: 'Dos formas: SANÓ, o SE CERRÓ SIN SANAR con su motivo — falleció, salió del hogar, pasó al hospital.',
            caso: 'Wilfredo Matos falleció el 16 de junio. Sus dos úlceras siguieron abiertas 85 días y '
                + 'contando en tu pantalla, porque nadie quiso escribir la mentira. Ya están cerradas, con '
                + 'la razón de verdad y con una nota que dice por qué el cierre llegó tres meses tarde.',
        },
        {
            titulo: 'Los papeles ya no dicen "sin alergias conocidas" de quien nadie preguntó',
            antes: 'La hoja de emergencia y el dossier decían "Ninguna conocida", y un "N/A" del expediente salía dentro de una caja ROJA titulada "alergias críticas".',
            ahora: 'Dice NO DOCUMENTADO — confirmar con el hogar antes de medicar. Un "N/A" cuenta como vacío, no como alergia.',
            caso: 'De los 33 residentes activos, 27 llevaban al médico una alerta roja de alergias '
                + 'críticas que decía "N/A". Uno decía "nunguna". Solo cuatro tienen alergia real '
                + 'documentada. Faltan 29 familias por preguntar.',
        },
        {
            titulo: 'Los 62 relevos sin aceptar no eran tuyos',
            antes: 'La lista de reportes de turno echaba al dashboard a quien podía firmarlos, sin decir nada. Parecía un enlace roto.',
            ahora: 'Entra quien puede firmar. Y si alguien no tiene permiso, se le dice en vez de moverlo de sitio.',
            caso: '62 relevos en PENDING, el más viejo del 9 de junio. Tres meses. No fue desidia de '
                + 'nadie: el camino de la lista a la firma no existía para las personas que pueden firmar.',
        },
        {
            titulo: 'El dossier del médico son dos páginas, no ocho',
            antes: 'Se imprimían las 57 lecturas de vitales del mes, casi todas normales, y salían ocho páginas que se hojean.',
            ahora: 'Dos páginas: alergias, alarmas, diagnósticos y medicamentos en la primera; el mes —solo lo que se salió de rango—, caídas, alertas y el análisis en la segunda. Y un botón para generar los 33 en un solo PDF.',
            donde: 'Zéndity Med > Prep. visita médica.',
        },
    ],
    cierre:
        'Dos cosas que decides tú y no el sistema. Las nueve de la lista hay que verlas con el residente '
        + 'delante — un texto de mayo no dice si hay úlcera ni en qué estadio. Y el aviso de "nadie la ha '
        + 'mirado en 7 días" es un número que puse por herencia, no un criterio clínico: para una sacra '
        + 'estadio 4 dime si son siete días o menos.',
};

const DIRECCION: Guia = {
    archivo: 'guia-b-direccion',
    paraQuien: 'Para dirección',
    periodo: PERIODO,
    entradilla:
        'Lo del domingo 6, en orden de lo que cambia una decisión. Casi todo era el mismo patrón: '
        + 'el dato existía, pero no en el campo que el sistema imprime o cuenta.',
    puntos: [
        {
            titulo: 'El teléfono del hogar estaba en tres campos y los papeles leían el vacío',
            antes: 'Los nueve documentos impresos —traslado, tarjeta de emergencia, eMAR, recibos, dossier— leían un campo que estaba vacío, mientras el número vivía en otros dos.',
            ahora: 'Escrito: 787-239-6858 en las dos sedes. La DIRECCIÓN sigue vacía y se llena en Sedes > editar.',
            caso: 'Los campos se añadieron al formulario de CREAR sede después de que Cupey y Mayagüez '
                + 'ya existieran, y hasta este mes ninguna pantalla podía editarlos. Nadie se dio cuenta '
                + 'porque un documento sin teléfono no se queja.',
        },
        {
            titulo: '"Por Definir" salía impreso como si fuera la dosis',
            antes: 'La columna DOSIS del dossier repetía "Por Definir" quince veces seguidas.',
            ahora: 'Sale una raya. La dosis sigue estando donde estaba: dentro del nombre del medicamento.',
            caso: 'De 261 medicamentos activos, 246 tienen el campo en "Por Definir" — y 230 de esos '
                + 'llevan la dosis dentro del nombre ("Atenolol 50mg"). Un médico que lee "Atenolol 50mg | '
                + 'Por Definir" entiende que el hogar no sabe cuánto le da a su paciente. Quedan 16 sin '
                + 'dosis por ningún lado, y tres están mal escritos: "Fosinopril Sodium 2omg" (con letra o '
                + 'en vez de cero), "Vitamina B-12 1,000" sin unidad, y "Levectiracetam".',
        },
        {
            titulo: 'El dossier del médico estaba abierto a cualquiera con sesión',
            antes: 'Bastaba tener sesión. Cocina, mantenimiento, un inversionista y diez cuidadoras podían sacar el expediente clínico de 30 días de cualquier residente. Y no quedaba rastro de que se generó.',
            ahora: 'Solo quien ve el eMAR, la sede se comprueba siempre, y cada generación queda registrada como exportación de PHI.',
        },
        {
            titulo: 'Zéndity Med: lo que estaba muerto se quitó',
            antes: 'Un escáner OCR que nunca pudo funcionar —el archivo se leía y se tiraba—, un botón "Anexar al e-MAR" sin código detrás, y "Validar Carrito", usado 267 veces todas el 29 de mayo y ni una en 101 días.',
            ahora: 'Fuera. El OCR que sí funciona sigue en Catálogo Farmacia. Las 267 firmas históricas se quedan en la base: se quitó la pantalla, no el registro.',
            caso: 'El carrito además firmaba de más: buscaba por color sin filtrar estado, así que el rojo '
                + 'firmaba 131 dosis con 122 en pantalla — nueve de residentes que ya no estaban.',
        },
        {
            titulo: 'El módulo de úlceras dice por fin cuánto no sabe',
            antes: 'Enseñaba dos úlceras.',
            ahora: 'Dos con ficha y nueve reportes esperando decisión de enfermería, con sus días reales.',
            caso: 'Uno de los nueve —José A. Troche— se fue al hospital por una úlcera que el sistema no '
                + 'conocía. El botón de la tableta que las cuidadoras usaban escribía una nota que no '
                + 'llegaba a ninguna pantalla.',
        },
    ],
    cierre:
        'Lo que queda pendiente no es código: 29 familias por preguntar las alergias, la dirección de las '
        + 'dos sedes, tres medicamentos mal escritos, y que Celia confirme cada cuánto hay que valorar una '
        + 'úlcera profunda.',
};

const destino = process.argv[2] ?? '.';
for (const g of [CUIDADORAS, ENFERMERIA, DIRECCION]) {
    const ruta = join(destino, `${g.archivo}.pdf`);
    writeFileSync(ruta, Buffer.from(generarGuiaPDF(g)));
    console.log(`${g.paraQuien.padEnd(32)} ${g.puntos.length} puntos  ->  ${ruta}`);
}
console.log('\nLleva nombres de residentes: es PHI. Se imprime para la reunión, no se manda por correo.');

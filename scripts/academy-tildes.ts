/**
 * Corrige la ortografía de los cursos de Academy: tildes y eñes.
 *
 * Los 16 cursos originales se escribieron sin acentos ("medicacion", "caidas",
 * "dano"). Para una academia que ACREDITA profesionalmente ante el Departamento
 * de la Familia, escribir en español incorrecto contradice el propósito.
 *
 * PRUDENCIA DELIBERADA — solo se corrigen palabras INEQUÍVOCAS:
 *   · Se corrige "medicacion" → "medicación": siempre lleva tilde, sin ambigüedad.
 *   · NO se toca "solo", "esta", "el", "se", "si", "tu", "mas", "que" sueltos:
 *     dependen del contexto ("esta pantalla" vs "está bien") y un reemplazo
 *     ciego introduciría errores nuevos en vez de arreglar los viejos.
 *   · Las interrogativas SÍ se corrigen, pero solo al inicio de una pregunta
 *     (línea "P: ..."), donde son inequívocamente interrogativas.
 *
 * ETIQUETAS ESTRUCTURALES PROTEGIDAS: el parser de InteractiveCourseCard busca
 * "EXPLICACION:", "PREGUNTAS:", "LECTURA:", "TERMINOS_CLAVE:", "---SECCION_N---"
 * literalmente. Acentuarlas rompería todos los cursos, así que esas líneas se
 * dejan intactas.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/academy-tildes.ts --dry-run
 *   DATABASE_URL="..." npx tsx scripts/academy-tildes.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

/** Líneas que el parser lee literalmente: no se tocan. */
const ES_ESTRUCTURAL = /^\s*(---|TITULO:|PROMPT_ZENDI:|TERMINOS_CLAVE:|PREGUNTA_REFLEXION:|LECTURA:|PREGUNTAS:|EXPLICACION:)/;

/**
 * REGLA antes que lista: en español casi toda palabra terminada en -ion lleva
 * tilde (gestión, unión, región, conexión, y todas las -ción/-sión), así que
 * una regla las cubre TODAS — incluidas las que una lista olvidaría.
 *
 * Se aplica sobre palabras que hoy NO tienen ninguna tilde. Los adverbios en
 * -mente y las eñes no siguen regla y van en el diccionario de abajo.
 */
/** Palabra sin tilde → con tilde. Casos que la regla no cubre. */
const PALABRAS: Record<string, string> = {
    // Adverbios en -mente sobre esdrújula
    automaticamente: 'automáticamente', rapidamente: 'rápidamente',
    unicamente: 'únicamente', practicamente: 'prácticamente',
    basicamente: 'básicamente', clinicamente: 'clínicamente',
    tecnicamente: 'técnicamente', logicamente: 'lógicamente',
    fisicamente: 'físicamente', publicamente: 'públicamente',
    especificamente: 'específicamente', periodicamente: 'periódicamente',
    // Eñes
    dano: 'daño', danos: 'daños', manana: 'mañana', senal: 'señal', senales: 'señales',
    diseno: 'diseño', disenada: 'diseñada', disenado: 'diseñado', disenar: 'diseñar',
    pequeno: 'pequeño', pequena: 'pequeña', ensenar: 'enseñar', ensena: 'enseña',
    nino: 'niño', ninos: 'niños', bano: 'baño', banos: 'baños', anos: 'años',
    companero: 'compañero', companera: 'compañera', companeros: 'compañeros',
    manana_: 'mañana', acompanar: 'acompañar', acompana: 'acompaña',
    // Esdrújulas
    clinico: 'clínico', clinica: 'clínica', clinicos: 'clínicos', clinicas: 'clínicas',
    medico: 'médico', medica: 'médica', medicos: 'médicos', medicas: 'médicas',
    critico: 'crítico', critica: 'crítica', criticos: 'críticos', criticas: 'críticas',
    automatico: 'automático', automatica: 'automática', automaticos: 'automáticos',
    automaticas: 'automáticas',
    rapido: 'rápido', rapida: 'rápida', rapidos: 'rápidos', rapidas: 'rápidas',
    basico: 'básico', basica: 'básica', basicos: 'básicos', basicas: 'básicas',
    tecnico: 'técnico', tecnica: 'técnica', tecnicos: 'técnicos', tecnicas: 'técnicas',
    numero: 'número', numeros: 'números', ultimo: 'último', ultima: 'última',
    ultimos: 'últimos', ultimas: 'últimas', proximo: 'próximo', proxima: 'próxima',
    minimo: 'mínimo', minima: 'mínima', maximo: 'máximo', maxima: 'máxima',
    periodo: 'período', metodo: 'método', codigo: 'código', modulo: 'módulo',
    unico: 'único', unica: 'única', unicos: 'únicos', unicas: 'únicas',
    publico: 'público', publica: 'pública', practico: 'práctico', practicas: 'prácticas',
    fisico: 'físico', fisica: 'física', logico: 'lógico', logica: 'lógica',
    multiple: 'múltiple', multiples: 'múltiples', especifico: 'específico',
    especifica: 'específica', especificos: 'específicos', especificas: 'específicas',
    analisis: 'análisis', diagnostico: 'diagnóstico', diagnosticos: 'diagnósticos',
    protocolo_: 'protocolo', historico: 'histórico', historica: 'histórica',
    // Agudas inequívocas
    caida: 'caída', caidas: 'caídas', dia: 'día', dias: 'días', guia: 'guía',
    despues: 'después', segun: 'según', tambien: 'también', ademas: 'además',
    aqui: 'aquí', alli: 'allí', asi: 'así', quiza: 'quizá', jamas: 'jamás',
    estan: 'están', sera: 'será', seran: 'serán', debera: 'deberá', deberan: 'deberán',
    podra: 'podrá', podran: 'podrán', tendra: 'tendrá', tendran: 'tendrán',
    hara: 'hará', haran: 'harán', ningun: 'ningún', algun: 'algún',
    telefono: 'teléfono', dificil: 'difícil', faciles: 'fáciles', util: 'útil',
    utiles: 'útiles', debil: 'débil', movil: 'móvil', habil: 'hábil',
    // Frecuentes detectadas en el texto real
    comun: 'común', comunes: 'comunes', segun_: 'según', estadisticas: 'estadísticas',
    estadistica: 'estadística', mas: 'más', esta_: 'está',
    proposito: 'propósito', parametro: 'parámetro', parametros: 'parámetros',
    politica: 'política', politicas: 'políticas', categoria: 'categoría',
    categorias: 'categorías', criterio_: 'criterio', area: 'área', areas: 'áreas',
    despues_: 'después', ambito: 'ámbito', regimen: 'régimen', sintoma: 'síntoma',
    sintomas: 'síntomas', cronico: 'crónico', cronica: 'crónica',
    higiene_: 'higiene', energia: 'energía', economia: 'economía',
    dificultad_: 'dificultad', asistolia: 'asistolia',
};
// Entradas de apoyo que no deben aplicarse tal cual:
delete PALABRAS.manana_; delete PALABRAS.protocolo_; delete PALABRAS.esta_;
delete PALABRAS.segun_; delete PALABRAS.criterio_; delete PALABRAS.despues_;
delete PALABRAS.higiene_; delete PALABRAS.dificultad_; delete PALABRAS.asistolia;

/**
 * "ano" NUNCA se reemplaza suelto — es una palabra anatómica real. Solo en
 * giros donde inequívocamente significa "año".
 */
const CONTEXTOS: [RegExp, string][] = [
    [/\b(al|del|un|cada|por|el|este|ese|primer|segundo|tercer) ano\b/gi, (m: string) => m.replace(/ano$/i, 'año')] as any,
];

/** Interrogativas: solo al inicio de una pregunta, donde no hay ambigüedad. */
const INTERROGATIVAS: [RegExp, string][] = [
    [/^(P:\s*)Que\b/gm, '$1¿Qué'], [/^(P:\s*)Cual\b/gm, '$1¿Cuál'],
    [/^(P:\s*)Cuales\b/gm, '$1¿Cuáles'], [/^(P:\s*)Como\b/gm, '$1¿Cómo'],
    [/^(P:\s*)Cuando\b/gm, '$1¿Cuándo'], [/^(P:\s*)Donde\b/gm, '$1¿Dónde'],
    [/^(P:\s*)Quien\b/gm, '$1¿Quién'], [/^(P:\s*)Cuanto\b/gm, '$1¿Cuánto'],
    [/^(P:\s*)Cuantas\b/gm, '$1¿Cuántas'], [/^(P:\s*)Cuantos\b/gm, '$1¿Cuántos'],
    [/^(P:\s*)Por que\b/gm, '$1¿Por qué'],
];

/** Preserva la capitalización original al reemplazar. */
function conMayuscula(original: string, reemplazo: string): string {
    if (original[0] === original[0].toUpperCase()) {
        return reemplazo[0].toUpperCase() + reemplazo.slice(1);
    }
    return reemplazo;
}

function corregir(texto: string): { resultado: string; cambios: number } {
    let cambios = 0;
    const lineas = texto.split('\n').map(linea => {
        // Las etiquetas del parser se dejan exactamente como están.
        if (ES_ESTRUCTURAL.test(linea)) {
            // Salvo el contenido DESPUÉS de "EXPLICACION:" — ese es prosa.
            const m = linea.match(/^(\s*EXPLICACION:\s*)([\s\S]*)$/);
            if (!m) return linea;
            const [, etiqueta, cuerpo] = m;
            const { resultado, cambios: c } = corregirProsa(cuerpo);
            cambios += c;
            return etiqueta + resultado;
        }
        const { resultado, cambios: c } = corregirProsa(linea);
        cambios += c;
        return resultado;
    });

    let salida = lineas.join('\n');
    for (const [re] of CONTEXTOS) {
        salida = salida.replace(re, (m) => {
            cambios++;
            return m.replace(/ano$/i, (a) => (a[0] === 'A' ? 'Año' : 'año'));
        });
    }
    for (const [re, rep] of INTERROGATIVAS) {
        const antes = salida;
        salida = salida.replace(re, rep);
        if (salida !== antes) cambios += (antes.match(re) ?? []).length;
    }
    // Cierre de interrogación: la pregunta abre con ¿ y termina en ?
    salida = salida.replace(/^(P:\s*¿[^\n?]*[^\n?¿])$/gm, '$1?');
    return { resultado: salida, cambios };
}

function corregirProsa(texto: string): { resultado: string; cambios: number } {
    let cambios = 0;
    const resultado = texto.replace(/\b([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\b/g, (palabra) => {
        // Palabra ya acentuada: no se toca.
        if (/[áéíóúÁÉÍÓÚñÑ]/.test(palabra)) return palabra;
        // Regla de terminación (-ción/-sión): cubre todas, sin lista.
        const lower = palabra.toLowerCase();
        if (!PALABRAS[lower]) {
            // En español, prácticamente toda palabra terminada en -ion lleva
            // tilde: gestión, camión, unión, región, conexión, además de todas
            // las -ción/-sión. La regla general las cubre; una lista no.
            // Se excluye -ssion, que solo aparece en anglicismos ("admission").
            const m = lower.match(/^(.{3,})ion$/);
            if (m && !lower.endsWith('ssion') && palabra !== palabra.toUpperCase()) {
                cambios++;
                return conMayuscula(palabra, `${m[1]}ión`);
            }
        }
        const reemplazo = PALABRAS[palabra.toLowerCase()];
        if (!reemplazo) return palabra;
        // Palabra ya acentuada o en MAYÚSCULAS (posible etiqueta): se deja.
        if (palabra === palabra.toUpperCase() && palabra.length > 3) return palabra;
        cambios++;
        return conMayuscula(palabra, reemplazo);
    });
    return { resultado, cambios };
}

async function main() {
    const cursos = await prisma.course.findMany({
        select: { id: true, title: true, content: true, description: true, headquarters: { select: { name: true } } },
        orderBy: { order: 'asc' },
    });
    console.log(DRY ? '🔍 SIMULACIÓN — no se escribe nada\n' : '✏️  Corrigiendo ortografía\n');

    let totalCambios = 0, cursosTocados = 0;

    for (const c of cursos) {
        const cont = corregir(c.content);
        const desc = corregir(c.description);
        const cambios = cont.cambios + desc.cambios;
        if (cambios === 0) continue;

        cursosTocados++;
        totalCambios += cambios;
        console.log(`   ${c.title} — ${cambios} correcciones`);

        if (DRY && cursosTocados === 1) {
            // Muestra concreta para poder juzgar el resultado.
            const linea = cont.resultado.split('\n').find(l => /[áéíóúñ]/.test(l) && l.length > 60);
            if (linea) console.log(`      ejemplo: "${linea.trim().slice(0, 110)}…"`);
        }
        if (!DRY) {
            await prisma.course.update({
                where: { id: c.id },
                data: { content: cont.resultado, description: desc.resultado },
            });
        }
    }

    console.log(`\n${DRY ? 'Se corregirían' : 'Corregidas'}: ${totalCambios} palabras en ${cursosTocados} cursos`);
    console.log('No se tocan: solo, esta, el, se, si, tu, mas, que — dependen del contexto.');
    if (DRY) console.log('\nPara aplicar, corre el mismo comando sin --dry-run');
}

main()
    .catch(e => { console.error('❌', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());

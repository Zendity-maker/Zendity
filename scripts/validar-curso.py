"""
Valida el contenido de un curso de Academy ANTES de publicarlo.

Complementa a scripts/auditar-examenes.ts, que mide lo que YA está en
producción. Este mira un archivo suelto, que es donde conviene enterarse.

Comprueba, con el parser REAL copiado de InteractiveCourseCard.tsx:38:

  - 5 secciones, 5 preguntas cada una, 4 opciones, un asterisco, EXPLICACION
  - que el parser no DESCARTE ninguna pregunta en silencio — que es como
    desaparecen sin que nadie se entere
  - que el examen no se apruebe sin leer: ni marcando siempre la opción más
    larga, ni marcando siempre la misma letra
  - que las fotos existan de verdad en public/ y lleven pie (el `alt` se pinta
    como pie visible; una foto sin pie no enseña)
  - que no haya backtick ni ${ }, que rompen el template literal del seed
  - que no haya emoji, que dentro de Academy no van

Uso:
    python3 scripts/validar-curso.py archivo.txt [otro.txt ...]
"""
import re, sys, collections, os

OPT = re.compile(r'^(\*?)([a-d])\)\s*(.*)')


def parse(raw):
    """Copia literal de parseQuestions. Si aquí se descarta, en la app también."""
    qs = []
    for b in re.split(r'(?=P:\s)', raw or ''):
        if not b.strip().startswith('P:'):
            continue
        lines = b.strip().split('\n')
        q = re.sub(r'^P:\s*', '', lines[0]).strip()
        opts = []
        k = -1
        expl = ''
        for l in lines[1:]:
            l = l.strip()
            if not l:
                continue
            if l.startswith('EXPLICACION:'):
                expl = l[12:].strip()
                continue
            m = OPT.match(l)
            if m:
                if m.group(1) == '*':
                    k = len(opts)
                opts.append(m.group(3))
        ok = bool(q) and len(opts) >= 2 and k >= 0
        qs.append({'q': q, 'opts': opts, 'k': k, 'expl': expl, 'ok': ok})
    return qs


def es_la_mas_larga(opts, k):
    L = [len(o.split()) for o in opts]
    return L[k] == max(L) and L.count(max(L)) == 1


def main(rutas):
    salida = 0
    for ruta in rutas:
        s = open(ruta, encoding='utf-8').read()
        print(f"\n=== {os.path.basename(ruta)}  ({len(s)} caracteres)")
        secs = re.findall(r'---SECCION_(\d+)---([\s\S]*?)(?=---SECCION_\d+---|$)', s)
        problemas = []
        letras = collections.Counter()
        nlarga = total = 0

        if len(secs) != 5:
            problemas.append(f'{len(secs)} secciones, no 5')

        for num, body in secs:
            pm = re.search(r'PREGUNTAS:\s*([\s\S]*?)$', body)
            qs = parse(pm.group(1) if pm else '')
            if len(qs) != 5:
                problemas.append(f's{num}: {len(qs)} preguntas')
            for q in qs:
                total += 1
                if not q['ok']:
                    problemas.append(f"s{num}: el parser DESCARTA «{q['q'][:45]}»")
                if len(q['opts']) != 4:
                    problemas.append(f"s{num}: {len(q['opts'])} opciones en «{q['q'][:40]}»")
                if not q['expl']:
                    problemas.append(f"s{num}: sin EXPLICACION en «{q['q'][:40]}»")
                if q['k'] >= 0:
                    letras['abcd'[q['k']]] += 1
                    if es_la_mas_larga(q['opts'], q['k']):
                        nlarga += 1
            umbral = -(-len(qs) * 8 // 10)
            c = collections.Counter('abcd'[q['k']] for q in qs if q['k'] >= 0)
            if c and c.most_common(1)[0][1] >= umbral:
                problemas.append(f"s{num}: se aprueba marcando siempre «{c.most_common(1)[0][0]}»")
            nl = sum(1 for q in qs if q['k'] >= 0 and es_la_mas_larga(q['opts'], q['k']))
            if nl >= umbral:
                problemas.append(f's{num}: se aprueba marcando siempre la más larga')

        for src in re.findall(r'!\[[^\]]*\]\(([^)]+)\)', s):
            if not os.path.exists('public' + src):
                problemas.append(f'imagen que no existe: {src}')
        if re.findall(r'!\[\s*\]\(', s):
            problemas.append('hay imágenes sin pie — el alt se pinta como pie visible')
        for mal in ['`', '${']:
            if mal in s:
                problemas.append(f'contiene «{mal}», rompe el template literal del seed')
        emoji = re.findall(r'[\U0001F300-\U0001FAFF\u2600-\u27BF]', s)
        if emoji:
            problemas.append(f'{len(emoji)} emoji: {"".join(sorted(set(emoji)))[:10]}')

        nimg = len(re.findall(r'!\[', s))
        pct = nlarga * 100 // max(total, 1)
        print(f"  {len(secs)} secciones · {total} preguntas · letras {dict(letras)}")
        print(f"  clave = la más larga: {nlarga}/{total} ({pct}%)  — al azar 25%")
        print(f"  imágenes: {nimg}")
        print('  ' + ('SIN PROBLEMAS' if not problemas else f'{len(problemas)} PROBLEMAS:'))
        for x in problemas:
            print('    -', x)
        if problemas:
            salida = 1
    return salida


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

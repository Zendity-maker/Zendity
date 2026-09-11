"""Valida un curso con el parser REAL de InteractiveCourseCard.tsx:38."""
import re, sys, collections, os
OPT = re.compile(r'^(\*?)([a-d])\)\s*(.*)')
def parse(raw):
    qs = []
    for b in re.split(r'(?=P:\s)', raw or ''):
        if not b.strip().startswith('P:'): continue
        lines = b.strip().split('\n')
        q = re.sub(r'^P:\s*', '', lines[0]).strip()
        opts = []; k = -1; expl = ''
        for l in lines[1:]:
            l = l.strip()
            if not l: continue
            if l.startswith('EXPLICACION:'): expl = l[12:].strip(); continue
            m = OPT.match(l)
            if m:
                if m.group(1) == '*': k = len(opts)
                opts.append(m.group(3))
        ok = bool(q) and len(opts) >= 2 and k >= 0
        qs.append({'q': q, 'opts': opts, 'k': k, 'expl': expl, 'ok': ok})
    return qs

for ruta in sys.argv[1:]:
    s = open(ruta, encoding='utf-8').read()
    print(f"\n=== {os.path.basename(ruta)}  ({len(s)} caracteres)")
    secs = re.findall(r'---SECCION_(\d+)---([\s\S]*?)(?=---SECCION_\d+---|$)', s)
    problemas = []
    letras = collections.Counter(); nlarga = 0; total = 0
    if len(secs) != 5: problemas.append(f'{len(secs)} secciones, no 5')
    for num, body in secs:
        pm = re.search(r'PREGUNTAS:\s*([\s\S]*?)$', body)
        qs = parse(pm.group(1) if pm else '')
        if len(qs) != 5: problemas.append(f's{num}: {len(qs)} preguntas')
        for q in qs:
            total += 1
            if not q['ok']: problemas.append(f"s{num}: el parser DESCARTA «{q['q'][:45]}»")
            if len(q['opts']) != 4: problemas.append(f"s{num}: {len(q['opts'])} opciones en «{q['q'][:40]}»")
            if not q['expl']: problemas.append(f"s{num}: sin EXPLICACION en «{q['q'][:40]}»")
            if q['k'] >= 0:
                letras['abcd'[q['k']]] += 1
                L = [len(o.split()) for o in q['opts']]
                if L[q['k']] == max(L) and L.count(max(L)) == 1: nlarga += 1
        um = -(-len(qs) * 8 // 10)
        c = collections.Counter('abcd'[q['k']] for q in qs if q['k'] >= 0)
        if c and c.most_common(1)[0][1] >= um: problemas.append(f"s{num}: se aprueba marcando siempre «{c.most_common(1)[0][0]}»")
        nl = sum(1 for q in qs if q['k'] >= 0 and (lambda L: L[q['k']] == max(L) and L.count(max(L)) == 1)([len(o.split()) for o in q['opts']]))
        if nl >= um: problemas.append(f"s{num}: se aprueba marcando siempre la mas larga")
    # imagenes
    for src in re.findall(r'!\[[^\]]*\]\(([^)]+)\)', s):
        if not os.path.exists('public' + src): problemas.append(f'imagen que no existe: {src}')
    sin_pie = re.findall(r'!\[\s*\]\(', s)
    if sin_pie: problemas.append(f'{len(sin_pie)} imagenes sin pie')
    for mal in ['`', '${']:
        if mal in s: problemas.append(f'contiene «{mal}», rompe el template literal')
    emoji = re.findall(r'[\U0001F300-\U0001FAFF\u2600-\u27BF]', s)
    if emoji: problemas.append(f'{len(emoji)} emoji: {"".join(sorted(set(emoji)))[:10]}')
    print(f"  {len(secs)} secciones · {total} preguntas · letras {dict(letras)}")
    print(f"  clave = la mas larga: {nlarga}/{total} ({nlarga*100//max(total,1)}%)  — al azar 25%")
    nimg = len(re.findall(r'!\[', s))
    print(f"  imagenes: {nimg}")
    print('  ' + ('SIN PROBLEMAS' if not problemas else f'{len(problemas)} PROBLEMAS:'))
    for x in problemas: print('    -', x)

"""
Escribe el inventario de capturas en formato tabla, sacandolo del propio
scripts/capturas/tomar.ts.

Se genera, no se escribe a mano: un inventario a mano se queda viejo igual que
se quedaron viejos los cursos que lo usan.

    python3 scripts/capturas/inventario.py > donde/sea.md
"""
import re, os, sys

src = open('scripts/capturas/tomar.ts', encoding='utf-8').read()
cuerpo = src.split('const TOMAS: Toma[] = [', 1)[1]
items, actual = [], None
for l in cuerpo.split('\n'):
    m = re.search(r"nombre:\s*['\"]([\w-]+)['\"]", l)
    if m:
        if actual: items.append(actual)
        actual = {'nombre': m.group(1), 'ruta': (re.search(r"ruta:\s*'([^']+)'", l) or [None, '?'])[1], 'desc': []}
        continue
    m = re.match(r"\s*//\s{3}(.*)", l)
    if m and actual: actual['desc'].append(m.group(1).strip())
    elif re.match(r"\s*// ──", l) and actual:
        items.append(actual); actual = None
if actual: items.append(actual)

print("# Inventario de capturas — public/academy/capturas/")
print()
print("Se referencian en el contenido de un curso asi:")
print()
print("    ![Pie visible de la foto](/academy/capturas/<nombre>.jpg)")
print()
print("Dos reglas: la ruta empieza en `/academy/` (sin `public`), y el texto del")
print("`alt` **se pinta como pie visible debajo de la foto** — una foto sin pie no")
print("enseña nada. Si el archivo no existe, sale un hueco y nadie se entera.")
print()
print("| archivo | pantalla real | que muestra |")
print("|---|---|---|")
vistos = set()
for it in items:
    if not os.path.exists(f"public/academy/capturas/{it['nombre']}.jpg"): continue
    vistos.add(it['nombre'])
    d = ' '.join(it['desc']).replace('|', '/') or '(sin descripcion)'
    print(f"| `{it['nombre']}.jpg` | `{it['ruta'].replace('/capturas/', '/')}` | {d} |")

en_disco = {f[:-4] for f in os.listdir('public/academy/capturas') if f.endswith('.jpg')}
sobran = sorted(en_disco - vistos)
print()
if sobran:
    print("**Sin descripcion en el script** (no usar sin mirarlas antes):", ', '.join(f'`{x}`' for x in sobran))
    print()
print(f"{len(en_disco)} capturas en disco, {len(vistos)} descritas.")

"""
Mete el contenido de un curso de Academy en src/lib/academy-seed.ts.

Por que un script y no editar a mano: cada curso son ~20 KB de texto dentro de un
template literal de TypeScript. Pegarlo a mano once veces es once ocasiones de
comerse una llave, dejar un acento grave suelto o pisar el curso de al lado — y
el fallo no aparece hasta que alguien abre el curso en la tableta.

    python3 scripts/academy-poner-contenido.py CAIDAS_101 ruta/al/nuevo.txt
    python3 scripts/academy-poner-contenido.py --todos carpeta/   (por nombre de archivo)

Comprueba antes de escribir:
  - que el curso existe en el seed
  - que el contenido nuevo NO lleva acento grave ni dolar-llave (rompen el
    template literal y se lo llevan todo por delante)
  - que la linea TITULO: del texto nuevo coincide LETRA POR LETRA con el `title`
    del seed. scripts/academy-assign busca los cursos por fragmento de titulo:
    cambiarlo rompe la asignacion automatica sin decir nada.

No toca la base de datos. Despues hay que correr el seed:

    npx tsx src/lib/academy-seed.ts --dry-run
"""
import re
import sys
import os

SEED = 'src/lib/academy-seed.ts'


def bloque_de(texto, curso_id):
    """Devuelve (inicio, fin) del contenido entre los acentos graves, o None."""
    m = re.search(r"^\s*id: '" + re.escape(curso_id) + r"',\s*$", texto, re.M)
    if not m:
        return None
    # El primer `content: \`` despues del id, y su acento grave de cierre.
    abre = texto.find('content: `', m.end())
    if abre == -1:
        return None
    inicio = abre + len('content: `')
    cierre = texto.find('\n`', inicio)
    if cierre == -1:
        return None
    return inicio, cierre + 1  # incluye el salto de linea, no el acento grave


def titulo_de(contenido):
    m = re.search(r'^TITULO:\s*(.+)$', contenido, re.M)
    return m.group(1).strip() if m else None


def titulo_del_seed(texto, curso_id):
    m = re.search(r"^\s*id: '" + re.escape(curso_id) + r"',\s*\n\s*title: '([^']*)'", texto, re.M)
    return m.group(1) if m else None


def poner(texto, curso_id, contenido):
    """Devuelve el seed con el contenido del curso sustituido. Revienta si algo no cuadra."""
    for malo, nombre in [('`', 'acento grave'), ('${', 'dolar-llave')]:
        if malo in contenido:
            raise SystemExit(f'ABORTADO: {curso_id} contiene «{malo}» ({nombre}), '
                             'que rompe el template literal del seed.')

    sitio = bloque_de(texto, curso_id)
    if not sitio:
        raise SystemExit(f'ABORTADO: no encuentro el bloque de {curso_id} en {SEED}.')

    t_nuevo, t_seed = titulo_de(contenido), titulo_del_seed(texto, curso_id)
    if t_nuevo is None:
        raise SystemExit(f'ABORTADO: {curso_id} no tiene linea TITULO:.')
    if t_seed is not None and t_nuevo != t_seed:
        raise SystemExit(
            f'ABORTADO: {curso_id} cambia el titulo.\n'
            f'  seed:  «{t_seed}»\n  nuevo: «{t_nuevo}»\n'
            'academy-assign busca los cursos por fragmento de titulo: esto romperia '
            'la asignacion automatica en silencio.')

    i, f = sitio
    if not contenido.endswith('\n'):
        contenido += '\n'
    return texto[:i] + contenido + texto[f:]


def main(args):
    if not os.path.exists(SEED):
        raise SystemExit(f'Corre esto desde la raiz del repo: no existe {SEED}')

    pares = []
    if args[:1] == ['--todos']:
        carpeta = args[1]
        for f in sorted(os.listdir(carpeta)):
            if f.endswith('.txt'):
                pares.append((f[:-4], os.path.join(carpeta, f)))
    else:
        pares.append((args[0], args[1]))

    texto = open(SEED, encoding='utf-8').read()
    for curso_id, ruta in pares:
        contenido = open(ruta, encoding='utf-8').read()
        antes = texto
        texto = poner(texto, curso_id, contenido)
        estado = 'sin cambios' if texto == antes else f'{len(contenido)} caracteres'
        print(f'  {curso_id:<22} {estado}')

    open(SEED, 'w', encoding='utf-8').write(texto)
    print(f'\n{len(pares)} curso(s) puestos en {SEED}.')
    print('Ahora: npx tsc --noEmit  y  npx tsx src/lib/academy-seed.ts --dry-run')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    main(sys.argv[1:])

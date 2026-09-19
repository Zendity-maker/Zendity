import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

/**
 * LA FOTO DEL EMPLEADO.
 *
 * Hasta el 16-sep-2026 este fichero tenía 33 líneas y dos imports —NextResponse
 * y prisma—, y escribía `user.update({ where: { id }, data: { photoUrl } })` SIN
 * SESIÓN, SIN ROL Y SIN SEDE. Era la única de las 40 rutas de /api/hr sin ni
 * siquiera un 401. Su gemela de /corporate/hr sí tenía las tres guardas, así que
 * fue un olvido, no un diseño.
 *
 * Lo que permitía: quien conociera un id de empleado —sale en la barra de
 * direcciones de /hr/staff/[id], y /api/care/staff-messages/users se los
 * entregaba a cualquier sesión— podía poner una imagen arbitraria en el avatar
 * de cualquier empleado de LAS DOS SEDES, sin cuenta, sin caducidad y sin dejar
 * autor. El avatar se pinta en el directorio, en el perfil, en la evaluación y
 * en el tablero del piso.
 *
 * Ponerle la guarda no rompió nada: los 38 usuarios de la base tienen photoUrl
 * nulo. La función se construyó y nunca se usó.
 */
const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'HR_MANAGER'];

/**
 * Qué se acepta como foto. Antes valía cualquier string: bastaba con que no
 * fuera vacío. Un `src` es una orden al navegador de ir a buscar algo, así que
 * un valor libre es un enlace arbitrario dibujado delante de todo el hogar —y
 * el CSP del proyecto admite `https:` entero y `data:`.
 */
function fotoAceptable(valor: unknown): valor is string {
    if (typeof valor !== 'string') return false;
    const v = valor.trim();
    if (!v || v.length > 2_000_000) return false;
    // Una imagen subida (data URI) o una ruta relativa del propio sitio.
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)) return true;
    if (/^\/[^/\\]/.test(v)) return true;
    return false;
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const resolvedParams = await params;
        const staffId = resolvedParams.id;

        const { photoUrl } = await req.json();

        if (!fotoAceptable(photoUrl)) {
            return NextResponse.json(
                { success: false, error: "La fotografía no tiene un formato aceptable." },
                { status: 400 },
            );
        }

        // El empleado tiene que ser de tu sede. Un 403 igual para "no existe" y
        // para "es de otra sede": si se distinguieran, esta ruta diría si un
        // uuid cualquiera es un usuario real.
        const empleado = await prisma.user.findUnique({
            where: { id: staffId },
            select: { headquartersId: true },
        });
        if (!empleado || empleado.headquartersId !== auth.headquartersId) {
            return NextResponse.json(
                { success: false, error: "Ese empleado no pertenece a tu sede." },
                { status: 403 },
            );
        }

        const updatedStaff = await prisma.user.update({
            where: { id: staffId },
            data: { photoUrl }
        });

        return NextResponse.json({
            success: true,
            photoUrl: updatedStaff.photoUrl
        });
    } catch (e: any) {
        console.error("Staff Photo Upload Error:", e);
        return NextResponse.json({ success: false, error: "Error interno subiendo la fotografía del empleado." }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formacionDe } from '@/lib/formacion';
import { datosAlta, datosBaja, estaDeBaja } from '@/lib/staff-status';
import { asignarRutaIngreso, asignarRutaCertificacion, requiereCertificacion } from '@/lib/academy-assign';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { emailLogoSrc } from '@/lib/email-logo';
import sgMail from '@sendgrid/mail';
import bcrypt from 'bcryptjs';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { logAudit } from '@/lib/audit';
import { requireRole, type SessionUser } from '@/lib/api-auth';
import { ROLES_DE_PISO, ROLES_DE_MANDO, rolesOtorgablesPor, esDireccion } from '@/lib/roles-otorgables';
import type { Role } from '@prisma/client';

// Inicializar SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

/** Quién entra a gestionar personal. El corte fino —qué rol puede OTORGAR
 *  cada uno— lo hace `rolesOtorgablesPor` más abajo. */
const PUEDEN_GESTIONAR_PERSONAL = ['DIRECTOR', 'ADMIN', 'HR_MANAGER'];

/**
 * QUÉ ROL PUEDE OTORGAR QUIÉN — la lista vive en src/lib/roles-otorgables.ts.
 *
 * Una sola copia para esta ruta, que VALIDA, y para las tres pantallas que
 * OFRECEN el desplegable. Estuvo escrita dos veces durante unas horas y ya se
 * veía el problema: un rol añadido en una y no en la otra hace que la pantalla
 * ofrezca lo que el servidor rechaza — que es el bug que se estaba arreglando.
 *
 * Por qué existe la lista, en corto: hasta el 16-sep-2026 esta ruta escribía
 * `role` tal cual venía del body, y el desplegable ofrecía DIRECTOR, ADMIN e
 * INVESTOR. Como el correo y el PIN los escoge quien da el alta, la persona de
 * RRHH podía crearse una cuenta DIRECTOR a su nombre —o editarse la suya con un
 * PATCH sobre su propio id— y entrar. HR_MANAGER es precisamente el rol que
 * existe para NO ver PHI.
 */


/**
 * Devuelve el 403 si se pide algún rol fuera de la lista blanca, o null.
 *
 * Los secundarios se validan igual que el principal a propósito: requireRole
 * mira los dos (src/lib/api-auth.ts:126-127), así que un
 * `secondaryRoles: ['DIRECTOR']` abre exactamente las mismas puertas que un
 * `role: 'DIRECTOR'`.
 */
function rolesNoOtorgables(
    auth: SessionUser,
    role: unknown,
    secondaryRoles: unknown,
): NextResponse | null {
    if (secondaryRoles !== undefined && secondaryRoles !== null && !Array.isArray(secondaryRoles)) {
        // Sin esto, mandar secondaryRoles como string se saltaba la validación
        // entera y llegaba crudo a Prisma.
        return NextResponse.json({
            success: false,
            error: 'Los roles secundarios deben venir como lista.',
        }, { status: 400 });
    }

    const otorgables = rolesOtorgablesPor(auth);
    const pedidos: unknown[] = [];
    if (role !== undefined && role !== null) pedidos.push(role);
    if (Array.isArray(secondaryRoles)) pedidos.push(...secondaryRoles);

    const rechazados = [...new Set(
        pedidos
            .filter(r => typeof r !== 'string' || !(otorgables as readonly string[]).includes(r))
            .map(r => String(r)),
    )];
    if (rechazados.length === 0) return null;

    return NextResponse.json({
        success: false,
        error: `No puedes otorgar este rol: ${rechazados.join(', ')}. Desde aquí puedes asignar ${otorgables.join(', ')}. Dirección y los accesos corporativos se crean fuera de la app.`,
    }, { status: 403 });
}

export async function GET(request: Request) {
    try {
        const auth = await requireRole(PUEDEN_GESTIONAR_PERSONAL);
        if (auth instanceof NextResponse) return auth;
        // La sesión completa la pide resolveEffectiveHqId (switcher de sede).
        const session = await getServerSession(authOptions);

        const url = new URL(request.url);
        const requestedHqId = url.searchParams.get('hqId');
        // Las bajas quedan fuera por defecto — la lista es de quien trabaja hoy.
        // Con incluirBajas=1 aparecen, que es la única forma de llegar al perfil
        // de alguien inactivo para reactivarlo.
        const incluirBajas = url.searchParams.get('incluirBajas') === '1';
        const hqId = await resolveEffectiveHqId(session!, requestedHqId);

        const staff = await prisma.user.findMany({
            // Fix junio-2026: filtrar AMBOS flags. Antes solo isActive=true →
            // empleados con isDeleted=true (Baja Definitiva) pero isActive sin
            // tocar seguían apareciendo en el Schedule Builder. Alineado con
            // el patrón estándar de corporate/headquarters, exec-report,
            // audit-report, etc. que ya filtran ambos. Ver DELETE abajo.
            where: incluirBajas
                ? { headquartersId: hqId }
                : { headquartersId: hqId, isActive: true, isDeleted: false },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                secondaryRoles: true,
                pinCode: true,   // leído solo para derivar hasPinCode — nunca sale al cliente
                complianceScore: true,
                isShiftBlocked: true,
                isDeleted: true,
                isActive: true,
                createdAt: true,
                photoUrl: true
            },
            orderBy: { name: 'asc' }
        });

        // Última evaluación por empleado (agrupado por employeeId, max createdAt)
        const staffIds = staff.map(s => s.id);
        const lastEvals = staffIds.length > 0
            ? await prisma.employeeEvaluation.groupBy({
                by: ['employeeId'],
                where: { employeeId: { in: staffIds } },
                _max: { createdAt: true },
            })
            : [];

        // Para cada last eval, obtenemos también el score del registro más reciente
        const lastEvalDetails = lastEvals.length > 0
            ? await prisma.employeeEvaluation.findMany({
                where: {
                    OR: lastEvals.map(le => ({
                        employeeId: le.employeeId,
                        createdAt: le._max.createdAt || undefined,
                    })),
                },
                select: { employeeId: true, createdAt: true, score: true },
            })
            : [];

        const lastEvalByEmployee = new Map<string, { createdAt: Date; score: number }>();
        for (const e of lastEvalDetails) {
            // Si por casualidad hay dos con el mismo createdAt exacto, nos quedamos con el primero
            if (!lastEvalByEmployee.has(e.employeeId)) {
                lastEvalByEmployee.set(e.employeeId, { createdAt: e.createdAt, score: e.score });
            }
        }

        // Formacion continua de cada uno. Va aqui y no en una pantalla aparte
        // porque este es el directorio donde la supervisora ya mira a su gente:
        // una vista que hay que ir a buscar no se mira.
        const formaciones = new Map<string, any>();
        await Promise.all(staff.map(async s => {
            formaciones.set(s.id, await formacionDe(s.id));
        }));

        const staffWithLastEval = staff.map(s => {
            const { pinCode, ...safeFields } = s;
            const le = lastEvalByEmployee.get(s.id);
            const f = formaciones.get(s.id);
            return {
                ...safeFields,
                hasPinCode: !!pinCode,   // booleano — nunca el hash
                lastEvalDate: le?.createdAt || null,
                lastEvalScore: le?.score ?? null,
                formacionPct: f?.porcentaje ?? null,
                formacionAprobados: f?.aprobados ?? null,
                formacionMeta: f?.meta ?? null,
            };
        });

        return NextResponse.json(staffWithLastEval);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireRole(PUEDEN_GESTIONAR_PERSONAL);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);

        const body = await request.json();
        const { name, email, role, secondaryRoles, pinCode } = body;
        // hqId del body (cliente multi-sede) o fallback al JWT. resolveEffectiveHqId
        // ignora el hqId pedido para todo rol que no sea DIRECTOR/ADMIN: RRHH da de
        // alta SIEMPRE en su propia sede, escriba lo que escriba en el body.
        const hqId = await resolveEffectiveHqId(session!, body.hqId || null);

        if (!name || !email || !role) {
            return NextResponse.json({ error: 'Faltan campos obligatorios: nombre, correo y rol.' }, { status: 400 });
        }

        const rechazo = rolesNoOtorgables(auth, role, secondaryRoles);
        if (rechazo) return rechazo;

        const cleanEmail = email.toLowerCase().trim();

        // GUARDA CONTRA DOBLE ENVÍO — antipatrón nº1 del proyecto (ya costó dos
        // residentes duplicados). Aquí el correo es único en User, así que el
        // segundo toque no llegaba a crear nada: lo que hacía era devolver
        // "Email is already in use" en rojo, que es justo lo que empuja a
        // intentarlo otra vez. El reintento devuelve ÉXITO con la cuenta que ya
        // existe y no reenvía el correo de bienvenida ni reasigna cursos.
        //
        // La VENTANA no es adorno: separa dos casos opuestos que el correo
        // repetido no distingue. Dentro de ella es el mismo acto —el alta ya se
        // hizo, se dice que sí—; fuera es un choque con la cuenta real de
        // alguien que entró hace meses, y ahí el alta NO se hizo y el PIN recién
        // escrito NO se guardó. Decirle "listo" a eso es prometer un acceso que
        // no existe: `/corporate/hr/staff` (page.tsx:89 mira `res.ok`) abría su
        // modal de "copia este PIN" para una cuenta que nadie tocó, y el
        // AddStaffModal se cerraba en silencio. 10 minutos, la misma ventana que
        // el proyecto da a un alta.
        const VENTANA_DOBLE_ENVIO_MS = 10 * 60 * 1000;

        const yaExiste = await prisma.user.findUnique({
            where: { email: cleanEmail },
            select: { id: true, name: true, email: true, role: true, headquartersId: true, isActive: true, isDeleted: true, createdAt: true },
        });

        if (yaExiste) {
            if (yaExiste.headquartersId !== hqId) {
                // Mismo mensaje seco para no confirmar de quién es el correo ni
                // en qué sede trabaja esa persona.
                return NextResponse.json({ error: 'Ese correo ya está en uso.' }, { status: 400 });
            }

            const reciente = Date.now() - yaExiste.createdAt.getTime() < VENTANA_DOBLE_ENVIO_MS;
            if (reciente && !estaDeBaja(yaExiste)) {
                return NextResponse.json({
                    success: true,
                    yaExistia: true,
                    user: yaExiste,
                    mensaje: `${yaExiste.name} ya quedó registrado con ese correo. No se creó una segunda cuenta.`,
                }, { status: 200 });
            }

            return NextResponse.json({
                success: false,
                error: estaDeBaja(yaExiste)
                    ? `${yaExiste.name} ya tuvo cuenta con ese correo y está de baja. No se creó otra ni se guardó el PIN: reactívala desde su perfil.`
                    : `${yaExiste.name} ya tiene cuenta con ese correo. No se creó otra ni se cambió su PIN; eso se hace desde su perfil.`,
            }, { status: 409 });
        }

        // FIX 11-jun-2026: hashear pinCode en creación también. Antes este
        // POST guardaba plaintext, mientras el PATCH (línea 258) ya hasheaba.
        // El drift causaba el bug del welcome endpoint: leía pinCode crudo y
        // metía o un hash (si el empleado había sido editado) o un plaintext
        // (si nunca lo habían tocado) en el email. Ahora ambos endpoints
        // mantienen el mismo invariante: pinCode siempre bcrypt en DB.
        const hashedPin = pinCode ? await bcrypt.hash(pinCode, 10) : null;
        const newUser = await prisma.user.create({
            data: {
                name,
                email: cleanEmail,
                role: role,
                secondaryRoles: secondaryRoles || [],
                pinCode: hashedPin,
                headquartersId: hqId
            }
        });

        // Ruta de ingreso: los cursos base de su rol quedan asignados desde el
        // primer día. Sin esto, quien entra ve 16 tarjetas sin orden ni
        // prioridad — y la pregunta "¿por dónde empiezo?" la contesta el 89%
        // no entrando nunca. Best-effort: el alta no se revierte por esto.
        const cursosAsignados = await asignarRutaIngreso({
            hqId,
            userId: newUser.id,
            role: String(role),
            assignedByUserId: auth.id,
        });

        // Certificación geriátrica: quien va a tocar a un residente la recibe
        // desde el alta. Va aparte de la ruta de ingreso porque acredita a la
        // persona ante el Departamento, no le enseña a usar el sistema.
        if (requiereCertificacion(String(role))) {
            await asignarRutaCertificacion({
                hqId,
                userId: newUser.id,
                assignedByUserId: auth.id,
            });
        }

        // ==========================================
        // FASE 66: Welcome Email automatizado al Staff
        // ==========================================
        try {
            if (SENDGRID_API_KEY && cleanEmail) {
                const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';
                
                // Fetch de detalles de la sede para inyectar al correo
                const hqData = await prisma.headquarters.findUnique({
                    where: { id: hqId },
                    select: { name: true, logoUrl: true }
                });

                const facilityName = hqData?.name || 'Zendity Care Center';
                const logoHtml = emailLogoSrc(hqId, hqData?.logoUrl) ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${emailLogoSrc(hqId, hqData?.logoUrl)}" alt="${facilityName}" style="max-height: 80px; object-fit: contain;" /></div>` : '';

                const roleNames: Record<string, string> = {
                    "NURSE": "Enfermera(o) a Cargo",
                    "CAREGIVER": "Cuidador(a) Principal",
                    "SOCIAL_WORKER": "Trabajador(a) Social",
                    "HR_MANAGER": "Recursos Humanos",
                    "KITCHEN": "Cocina y Dietas",
                    "MAINTENANCE": "Mantenimiento",
                    "DIRECTOR": "Director(a) de Sede",
                    "SUPERVISOR": "Supervisor(a) de Planta"
                };
                const friendlyRole = roleNames[role] || role;

                const msg = {
                    to: cleanEmail,
                    from: {
                        email: senderEmail,
                        name: facilityName
                    },
                    subject: 'Tus credenciales de acceso institucional',
                    html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
                        ${logoHtml}
                        <h2 style="color: #0f172a; text-align: center; font-weight: 800; font-size: 24px;">¡Bienvenido/a a la red de ${facilityName}!</h2>
                        
                        <div style="background-color: white; padding: 25px; border-radius: 12px; margin-top: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                            <p style="color: #334155; font-size: 16px; margin-top: 0;">Hola <strong>${name}</strong>,</p>
                            <p style="color: #475569; font-size: 15px;">La División de Recursos Humanos te ha registrado oficialmente en el sistema operativo institucional con el puesto de <strong>${friendlyRole}</strong>.</p>
                            
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                            
                            <h3 style="color: #0f172a; margin-bottom: 15px; font-size: 18px;">Tu Acceso Institucional:</h3>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                <li style="margin-bottom: 10px; font-size: 15px; color: #475569;">📧 <strong>Usuario (Correo):</strong> <span style="font-family: monospace; font-size: 16px;">${cleanEmail}</span></li>
                                <li style="margin-bottom: 20px; font-size: 15px; color: #475569;">🔐 <strong>PIN de Acceso:</strong> Tu administrador te lo entregará en persona antes de tu primer turno.</li>
                            </ul>
                            <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin-top: 10px;">
                                <p style="margin: 0; font-size: 13px; color: #92400e;">⚠️ Por seguridad institucional, tu PIN no se envía por correo electrónico. Solicítalo directamente a tu supervisor o Director de la sede.</p>
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin-top: 25px; color: #1F2D3A; font-size: 13px; padding-top: 15px; border-top: 1px dashed #C9D4D8;">
                            <p style="margin: 0; font-weight: 800; color: #0F6B78; text-transform: uppercase; letter-spacing: 1px;">Powered by Zendity OS</p>
                            <p style="margin: 5px 0 0 0; color: #64748b;">Healthcare Operations Platform</p>
                        </div>
                    </div>
                    `,
                };

                await sgMail.send(msg);
                console.log("[HR_COMMS] Welcome Email Sent To:", cleanEmail);
            }
        } catch (emailError: any) {
            console.error("[HR_COMMS_ERROR] Error enviando correo de bienvenida a empleado:", emailError.response?.body || emailError);
            // We intentionally swallow the error and return 201 so the employee is still successfully created.
        }

        // Audit trail — non-fatal
        const invokerId = auth.id;
        await logAudit({
            headquartersId: hqId,
            performedById: invokerId,
            action: 'USER_CREATED',
            entityName: 'User',
            entityId: newUser.id,
            resourceName: `${name} (${role})`,
            payloadChanges: { name, email: cleanEmail, role },
            request,
        });

        // El hash del PIN no sale al cliente — mismo invariante que el GET.
        const { pinCode: _hash, ...usuarioPublico } = newUser;
        return NextResponse.json({ success: true, user: usuarioPublico }, { status: 201 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await requireRole(PUEDEN_GESTIONAR_PERSONAL);
        if (auth instanceof NextResponse) return auth;

        const body = await request.json();
        const { id, role, secondaryRoles, pinCode, isShiftBlocked, isDeleted, name, email } = body;

        if (!id) {
            return NextResponse.json({ error: 'Falta el ID del empleado' }, { status: 400 });
        }

        // NADIE SE CAMBIA EL ROL A SÍ MISMO por aquí. Ni para subir —era un
        // PATCH sobre el propio id con role:'ADMIN' y ya estaba— ni para bajar.
        // El cambio de rol de quien gestiona personal lo hace otra persona.
        if (id === auth.id && (role !== undefined || secondaryRoles !== undefined)) {
            return NextResponse.json({
                success: false,
                error: 'No puedes cambiarte el rol a ti mismo. Que lo haga otra persona de Dirección.',
            }, { status: 403 });
        }

        // Bloqueo de seguridad corporativa B2B: tampoco te quedas fuera solo.
        // Misma razón por la que el DELETE no deja darse de baja a uno mismo.
        if (id === auth.id && (isShiftBlocked === true || isDeleted === true)) {
            return NextResponse.json({
                success: false,
                error: 'No te puedes bloquear ni dar de baja a ti mismo.',
            }, { status: 403 });
        }

        const rechazo = rolesNoOtorgables(auth, role, secondaryRoles);
        if (rechazo) return rechazo;

        // FILTRO DE SEDE — mismo patrón que el DELETE de abajo. Sin esto bastaba
        // el id de alguien de Mayagüez para cambiarle rol, correo, PIN o marcarlo
        // de baja desde Cupey: `user.update({ where: { id } })` no mira la sede.
        // El 403 es el mismo para "no existe" y para "es de otra sede", para no
        // confirmar uuids ajenos a quien los esté probando.
        const objetivo = await prisma.user.findUnique({
            where: { id },
            select: { id: true, headquartersId: true, role: true, secondaryRoles: true },
        });
        if (!objetivo || objetivo.headquartersId !== auth.headquartersId) {
            return NextResponse.json({
                success: false,
                error: 'Empleado no encontrado en tu sede.',
            }, { status: 403 });
        }

        // La otra puerta a la misma escalada: no hace falta cambiar un rol si
        // puedes cambiarle el correo y el PIN a quien ya lo tiene. RRHH no
        // edita cuentas de un rol que no podría otorgar (Dirección, socios);
        // Dirección sigue editando a cualquiera de su sede, como hasta hoy.
        const otorgablesPorMi = rolesOtorgablesPor(auth);
        const rolesDelObjetivo = [objetivo.role, ...(objetivo.secondaryRoles || [])];
        if (!esDireccion(auth) && rolesDelObjetivo.some(r => !(otorgablesPorMi as readonly string[]).includes(r))) {
            return NextResponse.json({
                success: false,
                error: 'Esa cuenta tiene un rol que no gestionas desde aquí. Pídeselo a Dirección.',
            }, { status: 403 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        
        if (email !== undefined) {
            const cleanEmail = email.toLowerCase().trim();
            const existing = await prisma.user.findFirst({
                where: { email: cleanEmail, id: { not: id } }
            });
            if (existing) {
                return NextResponse.json({ error: 'El correo ya está en uso por otro empleado.' }, { status: 400 });
            }
            updateData.email = cleanEmail;
        }

        if (role !== undefined) updateData.role = role;
        if (secondaryRoles !== undefined) updateData.secondaryRoles = secondaryRoles;
        if (pinCode !== undefined && pinCode !== '') {
            updateData.pinCode = await bcrypt.hash(pinCode, 10);
        }
        // La baja no es una bandera sola: el invariante del repo es
        // isDeleted === !isActive (staff-status.ts:33-38), y el login mira LAS
        // DOS. Escribiendo solo isDeleted, el botón "Restaurar" de
        // /hr/staff (page.tsx:87) dejaba a la persona con isActive:false —
        // seguía sin poder entrar y seguía contando como baja, aunque la fila
        // ya se hubiera movido de pestaña.
        if (isDeleted !== undefined) Object.assign(updateData, isDeleted ? datosBaja() : datosAlta());
        if (isShiftBlocked !== undefined) {
            updateData.isShiftBlocked = isShiftBlocked;
            if (isShiftBlocked) updateData.blockReason = "Management suspension";
            else updateData.blockReason = null;
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });

        // Audit trail — non-fatal
        const patchHqId = updatedUser.headquartersId || auth.headquartersId;
        const auditAction = isShiftBlocked === true ? 'USER_BLOCKED'
            : isDeleted === true ? 'USER_DELETED'
            : 'USER_UPDATED';
        await logAudit({
            headquartersId: patchHqId,
            performedById: auth.id,
            action: auditAction,
            entityName: 'User',
            entityId: id,
            resourceName: updatedUser.name,
            payloadChanges: updateData,
            request,
        });

        const { pinCode: _hashPin, ...usuarioActualizado } = updatedUser;
        return NextResponse.json({ success: true, user: usuarioActualizado }, { status: 200 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await requireRole(PUEDEN_GESTIONAR_PERSONAL);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Falta el ID del empleado' }, { status: 400 });
        }

        // Bloqueo de seguridad: No puede eliminarse a sí mismo
        if (id === auth.id) {
            return NextResponse.json({ error: 'No te puedes eliminar a ti mismo.' }, { status: 403 });
        }

        const userToDelete = await prisma.user.findUnique({ where: { id } });
        if (!userToDelete || userToDelete.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ error: 'Empleado no encontrado o de otra sede.' }, { status: 404 });
        }

        // Misma baja que el botón del perfil — un solo concepto, un solo
        // helper. Ver el invariante en src/lib/staff-status.ts.
        await prisma.user.update({
            where: { id },
            data: datosBaja(),
        });

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Falló la eliminación del empleado' }, { status: 500 });
    }
}

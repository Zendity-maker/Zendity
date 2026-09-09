import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'HR_MANAGER'];

export async function GET(_req: Request) {
    try {
        // ── Seguridad (tenant + rol) ──
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        /**
         * EL complianceScore SE QUEDA FUERA. Decidido el 09-sep-2026.
         *
         * Esta pantalla alertaba de todo el que tuviera el score por debajo de
         * 75. Medido contra produccion ese dia, las seis alertas que mostraba
         * eran, al lado de lo que esas personas hacen de verdad:
         *
         *   Yedaira Gonzalez ....  0   la que MAS reporta de su turno (17 notas)
         *   Neylianne Torres ...  15   de las que mas reporta del hogar (19)
         *   Joaneliz Rosario ...  43   2,959 administraciones de medicamento
         *   Mileska Aviles .... 100   cero notas en 25 turnos
         *   Jediel Rosario ....  99   el que menos reporta (6 en 76 turnos)
         *
         * Estaba invertido. Le decia a direccion que la mejor documentadora era
         * un riesgo operacional.
         *
         * Y el numero no cumple ni su propia formula: la formula documentada da
         * 46 para Yedaira y 32 para Jediel; guardados estan 0 y 99. Hay SIETE
         * sitios que escriben complianceScore con logicas distintas —el cron,
         * las evaluaciones, el audit-report, las observaciones pendientes, dos
         * endpoints corporativos y /api/admin/sedes que lo pone en 100 fijo— y
         * gana el ultimo que corrio. La formula bonita vive en un endpoint que
         * solo LEE y que ninguno de los siete usa.
         *
         * Mientras ese numero no tenga un solo dueno y una sola formula, no
         * puede sostener una alerta sobre una persona. Ver
         * [veracidad-no-puntuacion]: ante un problema de registro, hacer el
         * dato veraz — no crear una metrica que castigue la conducta.
         *
         * Lo que queda son hechos con fecha y firma: observaciones APLICADAS.
         */

        // 2. Fetch recent Incidents (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        /**
         * SOLO APPLIED. Antes tomaba todos los estados, y en los 14 incidentes
         * de los ultimos 30 dias hay 3 DISMISSED, 2 DRAFT y 2 PENDING_EXPLANATION.
         *
         * Un DISMISSED es una observacion que se descarto: la persona quedo
         * exonerada. Un DRAFT no se le ha entregado a nadie. Un
         * PENDING_EXPLANATION esta esperando la version del empleado.
         *
         * Contar esos tres como reincidencia es acusar a alguien con lo que se
         * le retiro, con lo que nunca se le dijo, y con lo que todavia no ha
         * podido contestar.
         */
        const recentIncidents = await prisma.incidentReport.findMany({
            where: {
                headquartersId: hqId,
                createdAt: { gte: thirtyDaysAgo },
                status: 'APPLIED',
                // Y de gente que sigue trabajando aqui. Sin esto, la unica
                // senal que quedaba hoy era de Medelyn Garcia, que esta
                // inactiva y borrada: senalar a quien ya se fue no le pide una
                // conversacion a nadie. Mismo fallo que tenian las ulceras
                // hasta que aparecio Wilfredo, y la pantalla de riesgo de
                // caidas hasta ayer.
                employee: { isActive: true, isDeleted: false },
            },
            include: {
                employee: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 3a. Cargar dismissals activos (< 24h) para filtrar banderas suprimidas
        const now = new Date();
        const activeDismissals = await prisma.insightDismissal.findMany({
            where: { headquartersId: hqId, expiresAt: { gt: now } },
            select: { insightType: true },
        });
        const dismissedSet = new Set(activeDismissals.map((d: { insightType: string }) => d.insightType));

        // 3. Compile "Red Flags"
        const insights: any[] = [];

        // Add Insights based on repeated incidents
        const incidentCounts: Record<string, number> = {};
        recentIncidents.forEach(inc => {
            if (inc.employee) {
                incidentCounts[inc.employee.id] = (incidentCounts[inc.employee.id] || 0) + 1;
                
                // If it's a recent suspension/termination
                if (inc.type === 'SUSPENSION' || inc.type === 'TERMINATION') {
                     insights.push({
                        id: `severe_incident_${inc.id}`,
                        type: 'HIGH',
                        category: 'DISCIPLINARY',
                        title: `Acción Severa: ${inc.type === 'SUSPENSION' ? 'Suspensión' : 'Despido'}`,
                        description: `${inc.employee.name} recibió acción disciplinaria severa recientemente por parte de RRHH.`,
                        employeeId: inc.employee.id,
                        employeeName: inc.employee.name,
                        employeeRole: inc.employee.role,
                        timestamp: inc.createdAt.toISOString()
                    });
                }
            }
        });

        // Check for repeat offenders (2+ incidents in 30 days)
        for (const [empId, count] of Object.entries(incidentCounts)) {
            if (count >= 2) {
                const emp = recentIncidents.find(i => i.employee?.id === empId)?.employee;
                if (emp) {
                    insights.push({
                        id: `repeat_offender_${empId}`,
                        type: 'CRITICAL',
                        category: 'REPEAT_OFFENDER',
                        title: 'Comportamiento Problemático Recurrente',
                        description: `${emp.name} ha acumulado ${count} reportes disciplinarios en los últimos 30 días. Requiere revisión urgente.`,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        employeeRole: emp.role,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        // Filtrar banderas suprimidas en las últimas 24h
        const visibleInsights = insights.filter(i => !dismissedSet.has(i.id));

        // Orden de severidad: CRITICAL → HIGH → MEDIUM
        const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        const sortedInsights = visibleInsights.sort(
            (a, b) => (severityOrder[a.type] ?? 99) - (severityOrder[b.type] ?? 99)
        );

        return NextResponse.json({
            success: true,
            insights: sortedInsights
        });

    } catch (error) {
        console.error("AI Insights Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

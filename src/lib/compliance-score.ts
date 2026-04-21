import { prisma } from '@/lib/prisma';

/**
 * Restringe User.complianceScore al rango [0, 100].
 *
 * Llamar INMEDIATAMENTE después de cualquier `{ increment }` / `{ decrement }`
 * sobre `User.complianceScore`. Prisma no soporta clamp nativo, y dos increments
 * simultáneos pueden hacer que el score pase de 100 o caiga bajo 0.
 *
 * Idempotente y barata: dos updateMany con filtros `lt: 0` y `gt: 100`. Si el
 * valor ya está en rango, no hace nada.
 */
export async function clampComplianceScore(userId: string): Promise<void> {
    await prisma.user.updateMany({
        where: { id: userId, complianceScore: { lt: 0 } },
        data: { complianceScore: 0 },
    });
    await prisma.user.updateMany({
        where: { id: userId, complianceScore: { gt: 100 } },
        data: { complianceScore: 100 },
    });
}

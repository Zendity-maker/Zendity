import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isCleanNote } from '@/lib/family/disclosure';

interface FeedItem {
  id: string;
  type: 'NOTE' | 'MOMENT' | 'PHOTO' | 'EXTERNAL_SERVICE';
  content: string;
  mediaUrl: string | null;
  authorName: string;
  createdAt: string;
  // Solo para items EXTERNAL_SERVICE — datos extra del proveedor para el render
  externalService?: {
    providerName: string;
    categoryName: string;
    categoryIcon: string | null;
    serviceType: string | null;
    isFacilityWide: boolean;
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== 'FAMILY') {
      return NextResponse.json(
        { success: false, error: 'No autorizado. Acceso exclusivo para familiares.' },
        { status: 401 }
      );
    }

    const familyMember = await prisma.familyMember.findUnique({
      where: { email: session.user?.email as string },
    });

    if (!familyMember || !familyMember.patientId) {
      return NextResponse.json(
        { success: false, error: 'Cuenta de familiar no vinculada a ningún residente activo.' },
        { status: 404 }
      );
    }

    const { patientId } = familyMember;
    const since = new Date();
    since.setDate(since.getDate() - 60);

    const [diaryEntries, moments, externalVisits] = await Promise.all([
      prisma.wellnessDiary.findMany({
        where: {
          patientId,
          createdAt: { gte: since },
        },
        include: {
          author: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.zendiFamilyMoment.findMany({
        where: {
          patientId,
          status: 'SENT',
          selectedOption: { not: null },
          createdAt: { gte: since },
        },
        include: {
          author: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Servicios externos PUBLISHED que afectaron a este residente.
      // Incluye:
      //   1) visitas con el residente en el pivot (patientVisits)
      //   2) visitas isFacilityWide (aplican a todos los activos del momento)
      // Filtro notifyFamilies: si el visitante marcó "no notificar familia",
      // tampoco se muestra en el feed.
      prisma.externalServiceVisit.findMany({
        where: {
          status: 'PUBLISHED',
          notifyFamilies: true,
          registeredAt: { gte: since },
          OR: [
            { patientVisits: { some: { patientId } } },
            { isFacilityWide: true },
          ],
        },
        include: {
          provider: { include: { category: true } },
        },
        orderBy: { registeredAt: 'desc' },
      }),
    ]);

    // Filtros aplicados al diary:
    //
    // 1. Alertas clínicas internas: prefijos [ALERTA / [ACCIÓN PREVENTIVA / [alerta
    //    son señales del equipo para auditoría, nunca narrativa para la familia.
    //
    // 2. DEDUPLICACIÓN con momentsFeed (regla "una entrada canónica por evento"):
    //    Al aprobar un ZendiFamilyMoment, family-moments/[id]/action escribe DOS
    //    veces — el moment (status=SENT) Y un WellnessDiary con prefijo
    //    "[Zendi Update]". Ese doble-write es intencional (el WellnessDiary es
    //    audit trail leído por dashboard y digest cron), pero en el feed canon
    //    el moment es la entrada (tiene type='MOMENT', etiqueta y formato propio).
    //    Por tanto descartamos del diary cualquier nota que empiece con
    //    "[Zendi Update]" — el moment ya representa ese evento.
    const diaryFeed: FeedItem[] = diaryEntries
      .filter((entry) => isCleanNote(entry.note))
      .filter((entry) => !/^\[Zendi Update\]/i.test(entry.note.trim()))
      .map((entry) => ({
        id: entry.id,
        type: entry.mediaUrl ? 'PHOTO' : 'NOTE',
        content: entry.note,
        mediaUrl: entry.mediaUrl ?? null,
        authorName: (entry.author as any)?.name ?? 'Equipo de cuidado',
        createdAt: entry.createdAt.toISOString(),
      }));

    const momentsFeed: FeedItem[] = moments.map((moment) => ({
      id: moment.id,
      type: 'MOMENT',
      content: moment.selectedOption as string,
      mediaUrl: moment.photoUrl ?? null,
      authorName: (moment.author as any)?.name ?? 'Equipo de cuidado',
      createdAt: moment.createdAt.toISOString(),
    }));

    const externalFeed: FeedItem[] = externalVisits.map((v) => {
      const serviceLabel = v.serviceType ? ` · ${v.serviceType}` : '';
      // Content fallback: si no hay comentario, mostrar línea descriptiva genérica.
      const content = v.comment || `Visita registrada por ${v.provider.name}${serviceLabel}.`;
      return {
        id: `ext-${v.id}`, // prefijo para evitar colisión de id con diary/moment
        type: 'EXTERNAL_SERVICE',
        content,
        mediaUrl: null,
        authorName: v.provider.name,
        createdAt: v.registeredAt.toISOString(),
        externalService: {
          providerName: v.provider.name,
          categoryName: v.provider.category.name,
          categoryIcon: v.provider.category.icon,
          serviceType: v.serviceType,
          isFacilityWide: v.isFacilityWide,
        },
      };
    });

    const feed = [...diaryFeed, ...momentsFeed, ...externalFeed]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 80);

    return NextResponse.json({ success: true, feed });
  } catch (error: any) {
    console.error('Family Feed API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error Server: ' + (error?.message || 'Desconocido') },
      { status: 500 }
    );
  }
}

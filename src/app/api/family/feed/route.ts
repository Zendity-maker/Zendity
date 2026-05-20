import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface FeedItem {
  id: string;
  type: 'NOTE' | 'MOMENT' | 'PHOTO';
  content: string;
  mediaUrl: string | null;
  authorName: string;
  createdAt: string;
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

    const [diaryEntries, moments] = await Promise.all([
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
    ]);

    const diaryFeed: FeedItem[] = diaryEntries.map((entry) => ({
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

    const feed = [...diaryFeed, ...momentsFeed]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return NextResponse.json({ success: true, feed });
  } catch (error: any) {
    console.error('Family Feed API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error Server: ' + (error?.message || 'Desconocido') },
      { status: 500 }
    );
  }
}

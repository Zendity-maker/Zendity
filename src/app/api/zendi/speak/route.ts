/**
 * VOZ DE ZENDI (texto a audio)
 * ────────────────────────────
 * Convierte una frase en audio con ElevenLabs. Lo usan el tablet de cuido, el
 * panel de supervisión, el asistente flotante y el kiosco de recepción.
 *
 * ⚠️ ESTUVO ABIERTO. Comprobado en producción el 04-sep-2026:
 *
 *     POST /api/zendi/speak  {"text":"prueba"}  →  200
 *     sin sesión · sin token · sin tope de largo · sin límite de peticiones
 *
 * ElevenLabs se paga por carácter. Cualquiera con la URL podía mandar texto en
 * bucle y vaciar la cuenta — y con la cuenta vacía se queda muda la tablet de
 * cuido, que es donde de verdad importa.
 *
 * Ahora se exige UNA de dos credenciales, porque hay dos clases de llamador:
 *   · sesión de NextAuth — personal dentro de la aplicación;
 *   · `x-device-token` — el kiosco del lobby, que no tiene sesión de nadie.
 *
 * Y un tope de largo. Las frases del producto rondan los 100 caracteres; 500
 * deja margen de sobra y convierte un abuso en algo que no vale la pena.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Frase más larga que se permite convertir. */
const MAX_CARACTERES = 500;

async function autorizado(req: Request): Promise<boolean> {
    const session = await getServerSession(authOptions);
    if (session?.user) return true;

    const token = req.headers.get('x-device-token');
    if (!token) return false;

    const device = await prisma.externalKioskDevice.findUnique({
        where: { deviceToken: token },
        select: { isActive: true, revokedAt: true },
    });
    return !!device && device.isActive && !device.revokedAt;
}

export async function POST(req: Request) {
    try {
        if (!(await autorizado(req))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { text } = await req.json();
        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'No text' }, { status: 400 });
        }
        if (text.length > MAX_CARACTERES) {
            return NextResponse.json(
                { error: `Texto demasiado largo (${text.length}). Máximo ${MAX_CARACTERES}.` },
                { status: 413 },
            );
        }

        const voiceId = 'JHRoZowzSW795l89k0En';
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'No API key' }, { status: 500 });
        }

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.85,
                        style: 0.3,
                        use_speaker_boost: true,
                    },
                }),
            },
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('ElevenLabs error:', err);
            return NextResponse.json({ error: 'ElevenLabs error' }, { status: 500 });
        }

        const audioBuffer = await response.arrayBuffer();
        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                // Las frases del kiosco se repiten en cada visita — la caché
                // ahorra caracteres facturados de verdad.
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error) {
        console.error('Speak error:', error);
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text } = await req.json();
        if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

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
                        use_speaker_boost: true
                    }
                })
            }
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
                'Cache-Control': 'public, max-age=3600'
            }
        });

    } catch (error) {
        console.error('Speak error:', error);
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}

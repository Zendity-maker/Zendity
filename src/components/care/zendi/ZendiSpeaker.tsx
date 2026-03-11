"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";

export default function ZendiSpeaker() {
    const { user } = useAuth();
    const pathname = usePathname();
    const lastAnnouncementId = useRef<string | null>(null);
    const hasInteracted = useRef(false);

    // Disable if the user is explicitly in the kitchen module or has the role
    const isKitchen = pathname?.startsWith('/kitchen') || user?.role === 'KITCHEN';

    useEffect(() => {
        // Necesitamos interacción previa del usuario en la pantalla para que el navegador permita Audio Autoplay
        const handleInteraction = () => {
            hasInteracted.current = true;
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };

        document.addEventListener('click', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);
        document.addEventListener('keydown', handleInteraction);

        return () => {
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    useEffect(() => {
        if (!user || isKitchen) return;

        const checkAnnouncements = async () => {
            try {
                const res = await fetch('/api/ai/announcements', { cache: 'no-store' });
                const data = await res.json();

                if (data.success && data.announcement) {
                    const newId = data.announcement.id;
                    const message = data.announcement.message;

                    // Si es un ID nuevo que no hemos reproducido
                    if (lastAnnouncementId.current !== newId) {
                        lastAnnouncementId.current = newId;

                        // Solo reproducir si el navegador lo permite
                        if (hasInteracted.current && 'speechSynthesis' in window) {

                            // Reproducir chicharra/campana si tenemos un archivo, sino pasamos directo a la voz.
                            // Para mayor fluidez, usamos un bip nativo corto:
                            let utterance = new SpeechSynthesisUtterance(`Aviso de Zendi. ${message}`);
                            utterance.lang = "es-MX";
                            utterance.rate = 1.05; // Un poco más ágil
                            utterance.pitch = 1.1; // Tono ligeramente más agudo simulando voz IA

                            // Intenta buscar una voz que suene mejor en español
                            const voices = window.speechSynthesis.getVoices();
                            const spanishVoice = voices.find(v => v.lang.includes('es-') && (v.name.includes('Monica') || v.name.includes('Paulina') || v.name.includes('Google') || v.name.includes('Female')));
                            if (spanishVoice) {
                                utterance.voice = spanishVoice;
                            }

                            window.speechSynthesis.speak(utterance);
                        }
                    }
                }
            } catch (err) {
                console.error("Zendi Speaker Polling Error:", err);
            }
        };

        // Poll every 8 seconds
        const intervalId = setInterval(checkAnnouncements, 8000);
        return () => clearInterval(intervalId);

    }, [user, isKitchen]);

    // Componente completamente invisible
    return null;
}

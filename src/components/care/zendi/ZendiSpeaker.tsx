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

                        // Solo reproducir si el usuario interactuó con la pestaña
                        if (hasInteracted.current) {
                            try {
                                const textContent = `Aviso de Zendi. ${message}`;
                                const voiceRes = await fetch("/api/ai/zendi-voice", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ text: textContent })
                                });

                                if (!voiceRes.ok) throw new Error("Fallo en la síntesis de OpenAI TTS");

                                const blob = await voiceRes.blob();
                                const url = URL.createObjectURL(blob);
                                const audio = new Audio(url);

                                audio.onended = () => {
                                    URL.revokeObjectURL(url); // Liberar memoria
                                };

                                await audio.play();
                            } catch (err) {
                                console.error("Fallback a SpeechAPI:", err);
                                if ('speechSynthesis' in window) {
                                    let utterance = new SpeechSynthesisUtterance(`Aviso de Zendi. ${message}`);
                                    utterance.lang = "es-MX";
                                    utterance.rate = 1.05;
                                    
                                    const voices = window.speechSynthesis.getVoices();
                                    const spanishVoice = voices.find(v => v.lang.includes('es-') && (v.name.includes('Monica') || v.name.includes('Paulina') || v.name.includes('Google') || v.name.includes('Female')));
                                    if (spanishVoice) utterance.voice = spanishVoice;

                                    window.speechSynthesis.speak(utterance);
                                }
                            }
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

"use client";

import { useRef, useState } from "react";
import { Camera, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ZendiCameraEnhancerProps {
    targetId: string;
    isStaff: boolean;
    currentPhotoUrl?: string | null;
    placeholderInitials?: string;
    onUploadSuccess?: () => void;
}

export default function ZendiCameraEnhancer({ targetId, isStaff, currentPhotoUrl, placeholderInitials, onUploadSuccess }: ZendiCameraEnhancerProps) {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsProcessing(true);

        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = async () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                alert("Error al inicializar Zendi Enhancer");
                setIsProcessing(false);
                return;
            }

            // Downscale to 500px to maintain performance and DB size
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // FASE 67: Zendi AI Frontend Enhancer Filter (Clara y Bonita)
            ctx.filter = 'contrast(1.1) brightness(1.1) saturate(1.2)';
            ctx.drawImage(img, 0, 0, width, height);
            
            // Clean up memory
            URL.revokeObjectURL(img.src);

            const enhancedBase64 = canvas.toDataURL("image/jpeg", 0.85);

            try {
                const res = await fetch("/api/gamification/photo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        targetId,
                        isStaff,
                        base64Image: enhancedBase64,
                        authorId: user.id
                    })
                });
                
                const data = await res.json();
                if (data.success) {
                    alert(`📸 ¡Fotografía mejorada con Zendi AI!\n\nHas ganado +3 Puntos Zendity Academy (Nuevo Score: ${data.newScore}).`);
                    if (onUploadSuccess) onUploadSuccess();
                } else {
                    alert("Error guardando fotografía procesada: " + data.error);
                }
            } catch (err) {
                console.error(err);
                alert("Error de conexión al cargar la fotografía.");
            } finally {
                setIsProcessing(false);
            }
        };
    };

    return (
        <div className="relative group cursor-pointer inline-block" onClick={() => !isProcessing && fileInputRef.current?.click()}>
            
            <input 
                type="file" 
                accept="image/*" 
                capture={isStaff ? "user" : "environment"} // Selfie for Staff, Environment for Patients
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
            />

            {/* Avatar Container */}
            <div className={`relative overflow-hidden ${isStaff ? 'w-10 h-10 md:w-12 md:h-12' : 'w-14 h-14'} rounded-full bg-slate-100 flex items-center justify-center font-bold border-2 transition-all ${isProcessing ? 'border-teal-400 animate-pulse' : 'border-slate-200 group-hover:border-teal-300 shadow-sm group-hover:shadow-md'}`}>
                {currentPhotoUrl ? (
                    <img src={currentPhotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <span className={`${isStaff ? 'text-lg text-slate-500' : 'text-2xl text-slate-400'}`}>
                        {placeholderInitials || "?"}
                    </span>
                )}
                
                {/* Processing Overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
                    </div>
                )}
            </div>

            {/* Camera / AI Sparkle Badge */}
            {!isProcessing && (
                <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow border border-slate-100 group-hover:scale-110 transition-transform text-teal-500">
                    <Camera className={isStaff ? 'w-3 h-3' : 'w-4 h-4'} />
                </div>
            )}
        </div>
    );
}

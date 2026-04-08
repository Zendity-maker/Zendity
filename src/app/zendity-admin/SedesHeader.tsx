"use client";

import { useState } from "react";
import { BuildingOfficeIcon } from "@heroicons/react/24/outline";
import CreateSedeModal from "@/components/admin/CreateSedeModal";

export default function SedesHeader() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <BuildingOfficeIcon className="w-8 h-8 text-blue-500" />
                    Zendity B2B Control Panel
                </h1>
                <p className="text-slate-500 mt-2">Visión global de todas las facilidades operando bajo la plataforma SaaS.</p>
            </div>
            
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center gap-2 text-sm border border-blue-500/50"
            >
                <span className="text-lg leading-none">+</span> Nueva Sede (Onboarding)
            </button>

            <CreateSedeModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
            />
        </header>
    );
}

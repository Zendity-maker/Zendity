"use client";

import { Bell, Search, User, ChevronDown } from "lucide-react";

export default function CorporateTopbar() {
    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm flex-shrink-0">
            {/* Search Bar */}
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-teal-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar pacientes, métricas, reportes o empleados..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 text-slate-700"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded-md">⌘</kbd>
                        <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded-md">K</kbd>
                    </div>
                </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-5 ml-4">
                <button className="relative p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/50">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="w-px h-6 bg-slate-200"></div>

                <div className="flex items-center space-x-3 cursor-pointer hover:bg-slate-50 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 border border-teal-300 flex items-center justify-center text-teal-700 font-bold overflow-hidden shadow-inner">
                        <User className="w-4 h-4" />
                    </div>
                    <div className="hidden md:flex flex-col items-start justify-center">
                        <p className="font-semibold text-slate-700 text-sm leading-tight">Gerencia Global</p>
                        <p className="text-[11px] text-teal-600 font-medium leading-tight">Admin Corporativo</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
                </div>
            </div>
        </header>
    );
}

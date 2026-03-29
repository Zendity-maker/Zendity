const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src/app/care/supervisor/page.tsx');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. Unificar paleta (Reducir rojos, usar border-l)
code = code.replace(/urgencyStyles = "border-rose-400 bg-rose-50 shadow-rose-100";/g, 'urgencyStyles = "border-l-8 border-l-rose-500 border-y border-r border-slate-200 bg-white shadow-sm";');
code = code.replace(/urgencyStyles = "border-amber-300 bg-amber-50 shadow-amber-50";/g, 'urgencyStyles = "border-l-8 border-l-amber-400 border-y border-r border-slate-200 bg-white shadow-sm";');
code = code.replace(/urgencyStyles = "border-slate-200 bg-slate-50";/g, 'urgencyStyles = "border-l-8 border-l-slate-300 border-y border-r border-slate-200 bg-slate-50 shadow-sm";');

// 2. Bento Layout general
code = code.replace(/className="max-w-7xl mx-auto/g, 'className="max-w-[1600px] w-full mx-auto');
code = code.replace(/rounded-2xl/g, 'rounded-[2rem]');
code = code.replace(/rounded-3xl/g, 'rounded-[2.5rem]');

// 3. Mejorar Header Hero
code = code.replace(/bg-gradient-to-r from-slate-900 to-slate-800/g, 'bg-slate-900 shadow-2xl');
code = code.replace(/bg-teal-500 rounded-full blur-\[100px\]/g, 'bg-teal-500 rounded-full blur-[80px]');

// 4. Mission Monitor (Live KPIs) -> Bento
code = code.replace(/<div className="bg-indigo-50 p-6 rounded-\[2rem\] border border-indigo-100 [^>]+>/g, '<div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex flex-col items-center text-center shadow-sm">');
code = code.replace(/<div className="bg-sky-50 p-6 rounded-\[2rem\] border border-sky-100 [^>]+>/g, '<div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex flex-col items-center text-center shadow-sm">');
code = code.replace(/<div className="bg-orange-50 p-6 rounded-\[2rem\] border border-orange-100 [^>]+>/g, '<div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex flex-col items-center text-center shadow-sm">');
code = code.replace(/<div className="bg-rose-50 p-6 rounded-\[2rem\] border border-rose-100 [^>]+>/g, '<div className="bg-rose-50 p-8 rounded-[2rem] border border-rose-200 flex flex-col items-center text-center shadow-sm">');

// 5. Radar Operativo -> Personal En Piso
code = code.replace(/bg-slate-50 border border-slate-100 p-3/g, 'bg-white hover:bg-slate-50 border border-slate-200 p-4 transition-colors');
code = code.replace(/<div className="flex justify-between items-center bg-rose-50 border border-rose-200 p-3/g, '<div className="flex justify-between items-center bg-rose-100 border-2 border-rose-300 p-4 shadow-sm');

// 6. Alertas Continuidad (Handovers)
code = code.replace(/<div key=\{i\} className="bg-white border-2 border-indigo-100 p-4/g, '<div key={i} className={`bg-amber-50 border-2 border-amber-300 p-5 ${diff > 2 ? "bg-rose-50 border-rose-400" : ""}`');
code = code.replace(/w-1 bg-indigo-500/g, 'w-2 bg-amber-500');

// 7. Reordenar el DOM para estructurarlo de izquierda a derecha en Landscape
// Dividiremos la sección inferior (Triage) y Radar en una grid.
code = code.replace(
  /{[/]\* CONSOLA HÍBRIDA DE TRIAGE OPERATIVO \(FASE SPRINT 2\) \*[/]}/g,
  '<div className="grid grid-cols-1 xl:grid-cols-12 gap-8"><div className="xl:col-span-8 flex flex-col gap-6">{/* CONSOLA HÍBRIDA DE TRIAGE OPERATIVO (FASE SPRINT 2) */}'
);

code = code.replace(
  /{[/]\* RONDAS SUPERVISOR \(ROUNDS\) FASE 41 \*[/]}/g,
  '{/* RONDAS SUPERVISOR (ROUNDS) FASE 41 */}'
);

code = code.replace(
  /<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">\s*{\/\* PANEL IZQUIERDO: RADAR OPERATIVO \*\//g,
  '</div><div className="xl:col-span-4 flex flex-col gap-6">\n{/* PANEL DERECHO: RADAR OPERATIVO */}'
);

code = code.replace(
  /\s*{\/\* PANEL DERECHO: ZENDI AI WRITER \*\//g,
  '\n{/* ZENDI AI WRITER */}'
);

code = code.replace(
  /grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6/g,
  'grid grid-cols-1 md:grid-cols-2 gap-6'
);

// Mover Handovers Faltantes arriba en el Radar (CRITICO)
// El HTML de handovers startes con: {/* 4. Alertas de Continuidad (Handovers) */}
const radarStart = code.indexOf('{/* PANEL DERECHO: RADAR OPERATIVO */}');
if (radarStart !== -1) {
    const handoversIndex = code.indexOf('{/* 4. Alertas de Continuidad (Handovers) */}');
    const handoversEnd = code.indexOf('</div>\n                </div>      </div>\n                </div>');
    if (handoversIndex !== -1 && handoversEnd !== -1) {
        const handoversBlock = code.substring(handoversIndex, handoversEnd);
        code = code.substring(0, handoversIndex) + code.substring(handoversEnd);
        
        // Insert it right after radar title
        code = code.replace('Radar de Realidad Operativa\n                    </h2>', 'Radar de Realidad Operativa\n                    </h2>\n' + handoversBlock + '\n');
    }
}

// Ensure the outer grid gets closed before the Dispatch modal.
const modalIndex = code.indexOf('{/* SPRINT 3: DISPATCH INTELLIGENT MODAL');
if (modalIndex !== -1) {
    code = code.substring(0, modalIndex) + '\n</div>\n</div>\n' + code.substring(modalIndex);
}

// 8. Typography and clarity
code = code.replace(/text-4xl font-black text-indigo-900/g, 'text-4xl font-black text-teal-800');
code = code.replace(/text-indigo-500/g, 'text-teal-600');
code = code.replace(/text-slate-600 font-medium text-sm bg-white\/60 p-4/g, 'text-slate-700 font-medium text-sm bg-slate-50 p-4 border border-slate-100');

fs.writeFileSync(targetFile, code, 'utf8');
console.log("Rewrite complete.");

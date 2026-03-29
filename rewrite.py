import re

with open("src/app/care/supervisor/page.tsx", "r") as f:
    content = f.read()

# 1. Remove blur div
content = content.replace(
    '<div className="absolute top-0 right-0 w-64 h-64 bg-teal-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>\n',
    ''
)

# 2. Replace hover:scale
content = content.replace(
    'transition-transform hover:scale-[1.02]',
    'transition-colors hover:border-slate-300'
)

# 3. Add toast state
toast_state = """    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);"""
content = re.sub(r'    const \{ user \} = useAuth\(\);\s*const \[loading, setLoading\] = useState\(true\);', toast_state, content)

# 4. Replace alerts
content = content.replace('alert("Error en despacho 1-Click: " + data.error);', 'setToast({ msg: "Error en despacho 1-Click: " + data.error, type: \'err\' });')
content = content.replace('alert(` Queja ruteada exitosamente.`);', 'setToast({ msg: "Queja ruteada exitosamente.", type: \'ok\' });')
content = content.replace('alert("Error de Triaje: " + data.error);', 'setToast({ msg: "Error de Triaje: " + data.error, type: \'err\' });')
content = content.replace('alert(" Ronda Guardada: " + roundForm.area);', 'setToast({ msg: "Ronda Guardada: " + roundForm.area, type: \'ok\' });')
content = content.replace('alert("Error guardando ronda: " + data.error);', 'setToast({ msg: "Error guardando ronda: " + data.error, type: \'err\' });')
content = content.replace('return alert("Debe escribir un comentario para la cocina.");', 'return setToast({ msg: "Debe escribir un comentario para la cocina.", type: \'err\' });')
content = content.replace('alert(" Observación enviada exitosamente a la Cocina.");', 'setToast({ msg: "Observación enviada exitosamente a la Cocina.", type: \'ok\' });')
content = content.replace('alert("Error enviando reporte a cocina: " + data.error);', 'setToast({ msg: "Error enviando reporte a cocina: " + data.error, type: \'err\' });')
content = content.replace('alert("Memo copiado al portapapeles. Listo para enviar a RRHH o imprimir.");', 'setToast({ msg: "Memo copiado al portapapeles. Listo para enviar a RRHH o imprimir.", type: \'ok\' });')

# 5. Add Toast UI before dispatch modal
toast_ui = """
            {toast && (
                <div 
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] shadow-xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${toast.type === 'ok' ? 'bg-teal-900 text-teal-100' : 'bg-rose-900 text-rose-100'}`}
                    onClick={() => setToast(null)}
                >
                    {toast.msg}
                </div>
            )}

{/* SPRINT 3: DISPATCH INTELLIGENT MODAL */}"""
content = content.replace('{/* SPRINT 3: DISPATCH INTELLIGENT MODAL */}', toast_ui)


# Find the zombis length in right column:
match_zombis = re.search(r'(\s*\{/\* Alertas Administrativas Ocultas \(Zombis\) \*/\}.*?\{zombis\.length > 0 && \(.*?\}\)\s*\})', content, re.DOTALL)
if match_zombis:
    zombies_original = match_zombis.group(1)
    content = content.replace(zombies_original, "")
else:
    print("Could not find zombies block")


zombies_new_card = """                        {/* Alertas Administrativas Ocultas (Zombis) */}
                        {zombis.length > 0 && (
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border-2 border-rose-200 relative overflow-hidden mb-6">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500 rounded-full blur-[60px] opacity-10 pointer-events-none"></div>
                                <h3 className="font-extrabold text-rose-700 text-xl mb-6 flex items-center gap-3 relative z-10">
                                    <Siren className="w-6 h-6 animate-pulse" /> Sesiones Sin Cerrar
                                </h3>
                                <div className="space-y-3 relative z-10">
                                    {zombis.map((s: CaregiverSession) => {
                                        const h = (nowTime - new Date(s.startTime).getTime()) / 3600000;
                                        return (
                                            <div key={s.id} className="bg-white border border-rose-200 p-4 rounded-[2rem] flex justify-between items-center shadow-sm">
                                                <span className="font-bold text-slate-800 text-sm">{s.caregiver?.name}</span>
                                                <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-wider">{h.toFixed(1)}h ABIERTA</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Plantilla Conectada */}"""
content = content.replace('{/* Plantilla Conectada */}', zombies_new_card)

with open("src/app/care/supervisor/page.tsx", "w") as f:
    f.write(content)

print("Edits complete.")

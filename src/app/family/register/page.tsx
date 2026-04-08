'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function FamilyRegisterPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading');
    const [familyMember, setFamilyMember] = useState<any>(null);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Limpiar cookies de sesión anteriores para evitar error 494 en móvil
        const cookiesToClear = ['next-auth.session-token', '__Secure-next-auth.session-token',
                                'next-auth.callback-url', '__Secure-next-auth.callback-url',
                                'next-auth.csrf-token', '__Secure-next-auth.csrf-token'];
        cookiesToClear.forEach(name => {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        });
    }, []);

    useEffect(() => {
        if (!token) { setStatus('invalid'); return; }
        fetch(`/api/family/verify-token?token=${token}`)
            .then(r => r.json())
            .then(d => {
                if (d.valid) { setFamilyMember(d.familyMember); setStatus('valid'); }
                else setStatus('invalid');
            })
            .catch(() => setStatus('invalid'));
    }, [token]);

    const handleSubmit = async () => {
        setError('');
        if (pin.length < 4) { setError('El PIN debe tener al menos 4 dígitos.'); return; }
        if (pin !== confirmPin) { setError('Los PINs no coinciden.'); return; }
        setSubmitting(true);
        try {
            const res = await fetch('/api/family/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, pin })
            });
            const data = await res.json();
            if (data.success) {
                setStatus('success');
                setTimeout(() => {
                    signIn('credentials', { email: familyMember.email, pinCode: pin, callbackUrl: '/family' });
                }, 2000);
            } else {
                setError(data.error || 'Error activando el acceso.');
            }
        } catch {
            setError('Error de conexión.');
        } finally {
            setSubmitting(false);
        }
    };

    if (status === 'loading') return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-white text-center">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
                <p className="text-slate-500">Verificando tu invitación...</p>
            </div>
        </div>
    );

    if (status === 'invalid') return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center border border-slate-700">
                <div className="w-16 h-16 bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-red-400 text-2xl">✕</span>
                </div>
                <h2 className="text-white font-bold text-xl mb-2">Enlace no válido</h2>
                <p className="text-slate-500 text-sm">Este enlace de invitación ha expirado o ya fue utilizado. Contacte al hogar para solicitar uno nuevo.</p>
            </div>
        </div>
    );

    if (status === 'success') return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center border border-teal-500/30">
                <div className="w-16 h-16 bg-teal-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-teal-400 text-2xl">✓</span>
                </div>
                <h2 className="text-white font-bold text-xl mb-2">¡Acceso activado!</h2>
                <p className="text-slate-500 text-sm">Redirigiendo al portal familiar...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full border border-slate-700">
                <div className="text-center mb-8">
                    <h1 className="text-teal-400 font-black text-2xl tracking-widest mb-1">ZÉNDITY</h1>
                    <p className="text-slate-500 text-sm">Portal Familiar</p>
                </div>
                <h2 className="text-white font-bold text-xl mb-2">Bienvenido, {familyMember?.name}</h2>
                <p className="text-slate-500 text-sm mb-8">
                    Crea un PIN de acceso para entrar al portal y mantenerte al tanto del cuidado de tu familiar.
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="text-slate-500 text-sm font-medium block mb-2">Crea tu PIN</label>
                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Mínimo 4 dígitos"
                            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="text-slate-500 text-sm font-medium block mb-2">Confirma tu PIN</label>
                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={confirmPin}
                            onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Repite el PIN"
                            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                    >
                        {submitting ? 'Activando...' : 'Activar mi acceso'}
                    </button>
                </div>
            </div>
        </div>
    );
}

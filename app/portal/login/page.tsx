'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Building2 } from 'lucide-react';

export default function ClientLoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState<'dni' | 'code'>('dni');
    const [dni, setDni] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Updated to use direct API call instead of NextAuth
            const response = await fetch('/api/auth/request-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al solicitar código');
            }

            // Código enviado exitosamente
            setStep('code');
            setLoading(false);

        } catch (err: any) {
            setError(err.message || 'Error al solicitar código');
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await signIn('verify-code', {
                dni,
                code,
                callbackUrl: searchParams.get('callbackUrl') || '/portal/pagos',
                redirect: false
            });

            if (result?.error) {
                setError(result.error);
                setLoading(false);
            } else if (result?.ok) {
                router.push(searchParams.get('callbackUrl') || '/portal/pagos');
            }
        } catch (err: any) {
            setError(err.message || 'Error al verificar código');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#A145F5]/10 via-slate-50 to-stone-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo / Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#A145F5] rounded-2xl mb-4 shadow-lg">
                        <Building2 size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">Terra Lima</h1>
                    <p className="text-slate-500 mt-2">Portal de Pagos - Clientes</p>
                </div>

                {/* Card de Login */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                    {step === 'dni' ? (
                        <form onSubmit={handleRequestCode} className="space-y-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2">
                                    Iniciar Sesión
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Ingresa tu DNI para recibir un código por email
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                    <AlertCircle size={18} className="text-red-600 mt-0.5" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    DNI
                                </label>
                                <input
                                    type="text"
                                    maxLength={8}
                                    pattern="[0-9]{8}"
                                    value={dni}
                                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                                    placeholder="12345678"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none text-lg font-mono"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || dni.length !== 8}
                                className="w-full bg-[#A145F5] text-white py-3 rounded-xl font-bold hover:bg-[#8D32DF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    'Enviar Código al Email'
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyCode} className="space-y-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2">
                                    Verificar Código
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Ingresa el código de 6 dígitos que enviamos a tu email
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                    <AlertCircle size={18} className="text-red-600 mt-0.5" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Código de Verificación
                                </label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    pattern="[0-9]{6}"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="123456"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none text-lg font-mono text-center tracking-widest"
                                    required
                                    disabled={loading}
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full bg-[#A145F5] text-white py-3 rounded-xl font-bold hover:bg-[#8D32DF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Verificando...
                                    </>
                                ) : (
                                    'Verificar e Ingresar'
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setStep('dni');
                                    setCode('');
                                    setError('');
                                }}
                                className="w-full text-slate-600 text-sm hover:text-slate-800 transition-colors"
                                disabled={loading}
                            >
                                ← Volver a ingresar DNI
                            </button>
                        </form>
                    )}
                </div>

                {/* Demo Info */}
                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    <p className="font-bold mb-1">⚠️ Modo Demo</p>
                    <p className="text-xs">
                        Los códigos se envían por email y también se muestran en la consola del servidor en modo desarrollo.
                    </p>
                </div>

                {/* Link to Vendor Login */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500">
                        ¿Eres vendedor o administrador?{' '}
                        <a href="/login" className="text-[#A145F5] font-bold hover:underline">
                            Ingresa aquí
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}

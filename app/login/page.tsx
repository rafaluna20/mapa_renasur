'use client';

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { Lock, User, AlertCircle, Loader2, Building2 } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await login(username, password);
            // Redirect happens in login function
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
            {/* Background Decor */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
            </div>

            <div className="w-full max-w-md z-10 p-4">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">

                    {/* Header */}
                    <div className="pt-10 pb-6 text-center">
                        <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6 transform rotate-3 hover:rotate-6 transition-transform duration-300">
                            <Building2 className="text-white" size={40} />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Bienvenido</h1>
                        <p className="text-blue-200 text-sm font-medium">UrbanaSales GIS &bull; Panel de Acceso</p>
                    </div>

                    {/* Form */}
                    <div className="p-8 pt-2">
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-sm flex items-start gap-3 backdrop-blur-sm animate-in slide-in-from-top-2">
                                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-blue-200 uppercase tracking-widest ml-1">Usuario / Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="text-blue-400 group-focus-within:text-blue-300 transition-colors" size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all duration-300"
                                        placeholder="ej. vendedor@urbana.com"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-blue-200 uppercase tracking-widest ml-1">Contraseña</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="text-blue-400 group-focus-within:text-blue-300 transition-colors" size={20} />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all duration-300"
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin text-white/80" />
                                        <span>Verificando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Ingresar al Sistema</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors"></div>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 text-center border-t border-white/10 pt-6">
                            <p className="text-xs text-blue-300/60 font-medium">
                                Powered by Odoo 18 Community & Next.js
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

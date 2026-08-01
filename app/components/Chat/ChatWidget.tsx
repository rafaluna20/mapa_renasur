'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, MapPin, Sparkles } from 'lucide-react';
import { SHADOW_FLOATING, BORDER_FLOATING } from '@/app/lib/designTokens';

interface LoteChatResultado {
    codigo: string;
    areaM2: number;
    manzana: string;
    etapa: string;
    precio: number | null;
    ubicacion: string | null;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    lotes?: LoteChatResultado[];
}

const WELCOME_MESSAGE: ChatMessage = {
    role: 'assistant',
    content: '¡Hola! 👋 Soy el asistente de Terra Lima. Cuéntame qué buscas — por ejemplo "lotes de 90m² en la manzana D" o "lotes hasta S/ 50,000" — y te muestro las opciones disponibles.\n\nAún no tengo información sobre cercanía a parques o calles, así que por ahora consulto por tamaño, precio, manzana, etapa y estado.',
};

const currency = (n: number) => `S/ ${n.toLocaleString('es-PE')}`;

interface ChatWidgetProps {
    onSelectLot: (codigo: string) => void;
}

export default function ChatWidget({ onSelectLot }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    async function sendMessage() {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setError(null);
        setLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Error al procesar el mensaje');
            }

            setMessages(prev => [...prev, { role: 'assistant', content: data.message, lotes: data.lotes || [] }]);
        } catch (err) {
            console.error('Error en chat:', err);
            setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    }

    function handleSelectLot(codigo: string) {
        onSelectLot(codigo);
        setIsOpen(false);
    }

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className={`fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[650] bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white p-4 rounded-full ${SHADOW_FLOATING} transition-all hover:scale-105 flex items-center justify-center`}
                    aria-label="Abrir asistente de chat"
                >
                    <MessageCircle size={24} />
                </button>
            )}

            {isOpen && (
                <div
                    className={`fixed inset-x-2 bottom-2 top-20 md:inset-auto md:bottom-6 md:right-6 md:w-96 md:h-[32rem] z-[1000] bg-white rounded-2xl ${SHADOW_FLOATING} ${BORDER_FLOATING} flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-200`}
                >
                    {/* Cabecera */}
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} />
                            <span className="font-bold text-sm">Asistente Terra Lima</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            aria-label="Cerrar chat"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Mensajes */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                                        msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-sm'
                                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                                    }`}
                                >
                                    {msg.content}

                                    {msg.lotes && msg.lotes.length > 0 && (
                                        <div className="mt-2.5 space-y-2">
                                            {msg.lotes.slice(0, 8).map((lote) => (
                                                <button
                                                    key={lote.codigo}
                                                    onClick={() => handleSelectLot(lote.codigo)}
                                                    className="w-full text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl p-2.5 transition-colors group"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-800 text-xs">{lote.codigo}</span>
                                                        <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <MapPin size={10} /> Ver en el mapa
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                                                        <span>{lote.areaM2}m² · Mz {lote.manzana}</span>
                                                        <span className="font-bold text-emerald-600">
                                                            {lote.precio != null ? currency(lote.precio) : 'Consultar con asesor'}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                                    <Loader2 size={16} className="animate-spin text-indigo-500" />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex justify-center">
                                <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-2.5 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                            placeholder="Ej. lotes de 90m² en la manzana D..."
                            disabled={loading}
                            maxLength={1000}
                            className="flex-1 px-3 py-2 bg-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={loading || !input.trim()}
                            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                            aria-label="Enviar mensaje"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

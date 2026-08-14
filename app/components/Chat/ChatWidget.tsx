'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, MapPin, Sparkles, MessageCircleMore } from 'lucide-react';
import { SHADOW_FLOATING, BORDER_FLOATING } from '@/app/lib/designTokens';

// Número de ventas para el enlace "Consultar con asesor" en lotes sin
// precio publicado. Si la variable de entorno no está configurada, el
// enlace no se muestra (mejor ocultar el CTA que llevar a un número roto).
const WHATSAPP_SALES_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_SALES_NUMBER;

function buildWhatsAppLink(lote: LoteChatResultado): string | null {
    if (!WHATSAPP_SALES_NUMBER) return null;
    const mensaje = `Hola, quiero información sobre el lote ${lote.codigo} (Mz ${lote.manzana}, ${lote.areaM2.toFixed(2)}m²)`;
    return `https://wa.me/${WHATSAPP_SALES_NUMBER}?text=${encodeURIComponent(mensaje)}`;
}

interface LoteChatResultado {
    codigo: string;
    areaM2: number;
    manzana: string;
    etapa: string;
    precio: number | null;
    ubicacion: string | null;
    estado?: string;
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
                    className={`fixed inset-x-2 bottom-2 top-20 md:inset-auto md:bottom-6 md:right-6 md:w-96 md:h-[32rem] z-[1000] bg-white dark:bg-slate-900 rounded-2xl ${SHADOW_FLOATING} ${BORDER_FLOATING} dark:border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-200`}
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
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-950">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                                        msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                                    }`}
                                >
                                    {msg.content}

                                    {msg.lotes && msg.lotes.length > 0 && (
                                        <div className="mt-2.5 space-y-2">
                                            {msg.lotes.slice(0, 8).map((lote) => {
                                                const waLink = lote.precio == null ? buildWhatsAppLink(lote) : null;
                                                return (
                                                <div
                                                    key={lote.codigo}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleSelectLot(lote.codigo)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectLot(lote.codigo); }}
                                                    className="w-full text-left bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl p-2.5 transition-colors group cursor-pointer"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center gap-1.5">
                                                            {lote.codigo}
                                                            {lote.estado && lote.estado !== 'disponible' && (
                                                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                                    lote.estado === 'vendido'
                                                                        ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                                                                        : 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                                                                }`}>
                                                                    {lote.estado}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <MapPin size={10} /> Ver en el mapa
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                        <span>{lote.areaM2.toFixed(2)}m² · Mz {lote.manzana}</span>
                                                        {lote.precio != null ? (
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                                {currency(lote.precio)}
                                                            </span>
                                                        ) : waLink ? (
                                                            <a
                                                                href={waLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline flex items-center gap-1"
                                                            >
                                                                <MessageCircleMore size={12} /> Consultar con asesor
                                                            </a>
                                                        ) : (
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                                Consultar con asesor
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                                    <Loader2 size={16} className="animate-spin text-indigo-500" />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex justify-center">
                                <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-1.5">{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-2.5 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                            placeholder="Ej. lotes de 90m² en la manzana D..."
                            disabled={loading}
                            maxLength={1000}
                            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
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

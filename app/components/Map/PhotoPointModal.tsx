'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { SHADOW_FLOATING, BORDER_FLOATING } from '@/app/lib/designTokens';

interface PhotoPointModalProps {
    elemento: ElementoUrbano;
    onClose: () => void;
}

export default function PhotoPointModal({ elemento, onClose }: PhotoPointModalProps) {
    const fotos = elemento.fotos || [];
    const [index, setIndex] = useState(0);

    // Reiniciar al primer foto cada vez que se abre un punto distinto —
    // sin esto, cambiar de un punto de 5 fotos a uno de 2 podría dejar el
    // índice apuntando a una foto que no existe en el nuevo punto.
    useEffect(() => setIndex(0), [elemento.codigo]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + fotos.length) % fotos.length);
            if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % fotos.length);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [fotos.length, onClose]);

    if (fotos.length === 0) return null;

    return (
        <div
            className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className={`bg-white dark:bg-slate-900 rounded-2xl ${SHADOW_FLOATING} ${BORDER_FLOATING} dark:border-slate-700 overflow-hidden max-w-2xl w-full animate-in zoom-in-95 fade-in duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabecera */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 min-w-0">
                        <Camera size={16} className="text-amber-500 shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{elemento.nombre}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                        aria-label="Cerrar galería"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Imagen */}
                <div className="relative bg-slate-100 dark:bg-slate-950 aspect-video flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={fotos[index]}
                        alt={`${elemento.nombre} — foto ${index + 1} de ${fotos.length}`}
                        className="w-full h-full object-contain"
                    />

                    {fotos.length > 1 && (
                        <>
                            <button
                                onClick={() => setIndex((i) => (i - 1 + fotos.length) % fotos.length)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                                aria-label="Foto anterior"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => setIndex((i) => (i + 1) % fotos.length)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                                aria-label="Siguiente foto"
                            >
                                <ChevronRight size={20} />
                            </button>
                            <span className="absolute bottom-2 right-2 text-[11px] font-bold text-white bg-black/50 px-2 py-0.5 rounded-full">
                                {index + 1} / {fotos.length}
                            </span>
                        </>
                    )}
                </div>

                {/* Miniaturas (solo si hay más de una foto) */}
                {fotos.length > 1 && (
                    <div className="flex gap-1.5 p-2.5 overflow-x-auto bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                        {fotos.map((foto, i) => (
                            <button
                                key={foto}
                                onClick={() => setIndex(i)}
                                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                                    i === index ? 'border-amber-500' : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={foto} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

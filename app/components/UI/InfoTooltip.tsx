/**
 * InfoTooltip Component
 * 
 * Componente de tooltip simple y accesible para mostrar información
 * adicional sobre KPIs y otros elementos del dashboard.
 * 
 * No requiere librerías externas, usa CSS puro y es totalmente accesible.
 */

'use client';

import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

interface InfoTooltipProps {
    content: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
}

export function InfoTooltip({ content, side = 'top', className = '' }: InfoTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    const sideClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800',
        left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800',
        right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800',
    };

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            <button
                type="button"
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-help focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-full"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
                aria-label="Más información"
            >
                <HelpCircle size={14} />
            </button>

            {/* Tooltip */}
            {isVisible && (
                <div
                    className={`absolute ${sideClasses[side]} z-50 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-200`}
                    role="tooltip"
                >
                    <div className="bg-slate-800 text-slate-200 px-3 py-2 rounded-lg text-xs max-w-xs shadow-xl border border-slate-700 whitespace-normal">
                        {content}
                    </div>
                    {/* Arrow */}
                    <div
                        className={`absolute w-0 h-0 border-4 ${arrowClasses[side]}`}
                        aria-hidden="true"
                    />
                </div>
            )}
        </div>
    );
}

import { useRef, useEffect, useState } from 'react';
import { X, Calendar, FileDown, Award, FileText } from 'lucide-react';

interface ReportPeriodModalProps {
    type: 'individual' | 'general';
    onClose: () => void;
    onGenerate: (startDate?: string, endDate?: string, label?: string) => Promise<void>;
    generating: boolean;
}

type PeriodOption = 'current_month' | 'last_month' | 'current_year' | 'custom';

export default function ReportPeriodModal({ type, onClose, onGenerate, generating }: ReportPeriodModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const [period, setPeriod] = useState<PeriodOption>('current_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Handle ESC key press
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const formatDate = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        let startDate = '';
        let endDate = '';
        let label = '';

        if (period === 'current_month') {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            startDate = formatDate(firstDay);
            endDate = formatDate(lastDay);
            label = `${monthNames[month]} ${year}`;
        } else if (period === 'last_month') {
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            startDate = formatDate(firstDay);
            endDate = formatDate(lastDay);
            
            const prevMonthYear = month === 0 ? year - 1 : year;
            const prevMonth = month === 0 ? 11 : month - 1;
            label = `${monthNames[prevMonth]} ${prevMonthYear}`;
        } else if (period === 'current_year') {
            startDate = `${year}-01-01`;
            endDate = `${year}-12-31`;
            label = `Año ${year}`;
        } else if (period === 'custom') {
            if (!customStart || !customEnd) {
                setValidationError('Debe especificar ambas fechas para el rango personalizado.');
                return;
            }
            if (new Date(customStart) > new Date(customEnd)) {
                setValidationError('La fecha de inicio no puede ser posterior a la fecha de fin.');
                return;
            }
            startDate = customStart;
            endDate = customEnd;
            
            const startParts = startDate.split('-');
            const endParts = endDate.split('-');
            const formattedStart = startParts.length === 3 ? `${startParts[2]}/${startParts[1]}/${startParts[0]}` : startDate;
            const formattedEnd = endParts.length === 3 ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : endDate;
            label = `${formattedStart} al ${formattedEnd}`;
        }

        await onGenerate(startDate, endDate, label);
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200 p-4">
            <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="bg-gradient-to-b from-slate-950 to-slate-900/60 p-6 relative border-b border-slate-800/80 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={generating}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl border ${
                            type === 'general' 
                                ? 'bg-purple-950/60 text-purple-400 border-purple-500/20' 
                                : 'bg-indigo-950/60 text-indigo-400 border-indigo-500/20'
                        }`}>
                            {type === 'general' ? <Award size={24} /> : <FileText size={24} />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100">
                                {type === 'general' ? 'Reporte General del Proyecto' : 'Mi Reporte Individual'}
                            </h2>
                            <p className="text-slate-400 text-xs mt-0.5">
                                Seleccione el periodo de análisis para exportar en PDF
                            </p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto min-h-0">
                    {/* Period selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Periodo de Reporte
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setPeriod('current_month')}
                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all text-left ${
                                    period === 'current_month'
                                        ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-300'
                                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                Este Mes
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriod('last_month')}
                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all text-left ${
                                    period === 'last_month'
                                        ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-300'
                                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                Mes Anterior
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriod('current_year')}
                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all text-left ${
                                    period === 'current_year'
                                        ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-300'
                                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                Año en Curso
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriod('custom')}
                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all text-left ${
                                    period === 'custom'
                                        ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-300'
                                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                Personalizado
                            </button>
                        </div>
                    </div>

                    {/* Custom Range Inputs */}
                    {period === 'custom' && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/50 border border-slate-850 rounded-xl animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-1.5">
                                <label htmlFor="custom-start" className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                    <Calendar size={12} /> Fecha Inicio
                                </label>
                                <input
                                    id="custom-start"
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    required
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors scheme-dark"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="custom-end" className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                    <Calendar size={12} /> Fecha Fin
                                </label>
                                <input
                                    id="custom-end"
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    required
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors scheme-dark"
                                />
                            </div>
                        </div>
                    )}

                    {/* Error display */}
                    {validationError && (
                        <div className="p-3 bg-red-950/50 border border-red-500/20 rounded-xl text-red-400 text-xs">
                            {validationError}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={generating}
                            className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300 font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={generating}
                            className={`flex-1 flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 ${
                                type === 'general'
                                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-lg shadow-purple-950/50'
                                    : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                            }`}
                        >
                            <FileDown size={16} />
                            {generating ? 'Generando...' : 'Generar PDF'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

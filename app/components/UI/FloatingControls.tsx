import { Search, FileText } from 'lucide-react';

interface FloatingControlsProps {
    etapaFilter: string;
    onEtapaChange: (val: string) => void;
    manzanaFilter: string;
    onManzanaChange: (val: string) => void;
    statusFilter: string;
    onStatusChange: (val: string) => void;
    onOpenSidebar: () => void;
}

export default function FloatingControls({
    etapaFilter, onEtapaChange,
    manzanaFilter, onManzanaChange,
    statusFilter, onStatusChange,
    onOpenSidebar
}: FloatingControlsProps) {
    return (
        <div className="md:hidden fixed bottom-4 left-2 right-2 z-[600] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-2">
                {/* Filters Group */}
                <div className="grid grid-cols-5 gap-1.5 items-center">
                    {/* Etapa */}
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[8px] font-bold text-blue-700 uppercase leading-none px-1 text-center">Etapa</label>
                        <select
                            value={etapaFilter}
                            onChange={(e) => onEtapaChange(e.target.value)}
                            className="w-full px-1 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[10px] font-semibold text-blue-900 outline-none appearance-none text-center"
                        >
                            <option value="all">Todas</option>
                            <option value="01">01</option>
                            <option value="02">02</option>
                            <option value="03">03</option>
                            <option value="04">04</option>
                        </select>
                    </div>

                    {/* MZ */}
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[8px] font-bold text-blue-700 uppercase leading-none px-1 text-center">MZ</label>
                        <select
                            value={manzanaFilter}
                            onChange={(e) => onManzanaChange(e.target.value)}
                            className="w-full px-1 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[10px] font-semibold text-blue-900 outline-none appearance-none text-center"
                        >
                            <option value="all">Todas</option>
                            <option value="D">D</option>
                            <option value="P">P</option>
                            <option value="Q">Q</option>
                            <option value="R">R</option>
                            <option value="S">S</option>
                            <option value="T">T</option>
                            <option value="W">W</option>
                            <option value="X">X</option>
                        </select>
                    </div>

                    {/* Search Button (Center) */}
                    <div className="flex flex-col items-center">
                        <button
                            onClick={onOpenSidebar}
                            className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 active:scale-90 transition-transform flex items-center justify-center"
                        >
                            <Search size={18} />
                        </button>
                    </div>

                    {/* Estado */}
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[8px] font-bold text-slate-600 uppercase leading-none px-1 text-center">Estado</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => onStatusChange(e.target.value)}
                            className="w-full px-1 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-semibold text-slate-900 outline-none appearance-none text-center"
                        >
                            <option value="all">Todos</option>
                            <option value="libre">Disponible</option>
                            <option value="separado">Reservado</option>
                            <option value="vendido">Vendido</option>
                        </select>
                    </div>

                    {/* Notas */}
                    <div className="flex flex-col gap-0.5 items-center justify-end">
                        <button
                            onClick={() => alert('Función de notas próximamente')}
                            className="w-full py-2 bg-slate-800 text-white rounded-lg text-[10px] font-bold active:scale-95 transition-transform flex flex-col items-center justify-center"
                        >
                            <FileText size={14} />
                            <span className="text-[7px] uppercase mt-0.5">Notas</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

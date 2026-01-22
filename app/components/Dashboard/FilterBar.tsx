import { Search, Layers, Map as MapIcon, FileDown } from 'lucide-react';

interface FilterBarProps {
    searchQuery: string;
    onSearchChange: (val: string) => void;
    statusFilter: string;
    onStatusChange: (val: string) => void;
    manzanaFilter: string;
    onManzanaChange: (val: string) => void;
    etapaFilter: string;
    onEtapaChange: (val: string) => void;
    filteredCount: number;
    onClearFilters: () => void;
}

export default function FilterBar({
    searchQuery, onSearchChange,
    statusFilter, onStatusChange,
    manzanaFilter, onManzanaChange,
    etapaFilter, onEtapaChange,
    filteredCount, onClearFilters
}: FilterBarProps) {
    return (
        <div className="p-3 border-b border-stone-200 bg-white/80 backdrop-blur-md shadow-sm space-y-3">
            {/* Header / Title - Violet Brand Alignment */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A145F5] shadow-[0_0_8px_rgba(161,69,245,0.4)]"></span>
                    <span className="opacity-80">Filtros</span>
                </h3>
                <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[9px] font-bold rounded border border-stone-200">
                    {filteredCount} Lotes
                </span>
            </div>

            {/* Search - Modern Violet Focus */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#A145F5] transition-colors" size={16} />
                <input
                    type="text"
                    placeholder="Buscar lote..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-transparent text-stone-800 text-xs font-medium placeholder:text-stone-400 rounded-xl focus:bg-white focus:border-[#A145F5]/30 focus:ring-4 focus:ring-[#A145F5]/10 transition-all outline-none shadow-sm hover:shadow-md hover:bg-white"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {/* Status Filter - Violet Chips */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider ml-1">Estado</label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar px-1">
                    {[
                        { value: 'all', label: 'Todos' },
                        { value: 'libre', label: 'Disponible' },
                        { value: 'separado', label: 'Reservado' },
                        { value: 'vendido', label: 'Vendido' },
                        { value: 'no vender', label: 'No Vender' }
                    ].map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => onStatusChange(filter.value)}
                            className={`
                                px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all active:scale-95 border
                                ${statusFilter === filter.value
                                    ? 'bg-[#A145F5] border-[#A145F5] text-white shadow-md shadow-[#A145F5]/20'
                                    : 'bg-white border-stone-200 text-stone-500 hover:border-[#A145F5]/30 hover:text-[#A145F5] hover:shadow-sm'}
                            `}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters Grid - Violet Accents */}
            <div className="grid grid-cols-2 gap-3">
                {/* Manzana Filter */}
                <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 ml-1">
                        <Layers size={10} className="text-[#A145F5]" /> Manzana
                    </label>
                    <div className="relative">
                        <select
                            value={manzanaFilter}
                            onChange={(e) => onManzanaChange(e.target.value)}
                            className="w-full pl-2.5 pr-6 py-1.5 bg-stone-50/50 border border-stone-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#A145F5] focus:ring-2 focus:ring-[#A145F5]/10 appearance-none cursor-pointer transition-all hover:bg-white hover:border-[#A145F5]/50"
                        >
                            <option value="all">Todas</option>
                            <option value="D">MZ D</option>
                            <option value="Q">MZ Q</option>
                            <option value="P">MZ P</option>
                            <option value="R">MZ R</option>
                            <option value="S">MZ S</option>
                            <option value="T">MZ T</option>
                            <option value="W">MZ W</option>
                            <option value="X">MZ X</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#A145F5]">
                            <Layers size={12} />
                        </div>
                    </div>
                </div>

                {/* Etapa Filter */}
                <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 ml-1">
                        <MapIcon size={10} className="text-[#A145F5]" /> Etapa
                    </label>
                    <div className="relative">
                        <select
                            value={etapaFilter}
                            onChange={(e) => onEtapaChange(e.target.value)}
                            className="w-full pl-2.5 pr-6 py-1.5 bg-stone-50/50 border border-stone-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#A145F5] focus:ring-2 focus:ring-[#A145F5]/10 appearance-none cursor-pointer transition-all hover:bg-white hover:border-[#A145F5]/50"
                        >
                            <option value="all">Todas</option>
                            <option value="1">Etapa 1</option>
                            <option value="2">Etapa 2</option>
                            <option value="3">Etapa 3</option>
                            <option value="4">Etapa 4</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#A145F5]">
                            <MapIcon size={12} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Clear Filters Button */}
            <div className="pt-2">
                <button
                    onClick={onClearFilters}
                    className="w-full py-2 bg-stone-50 border border-stone-200 text-stone-500 font-bold rounded-lg text-[10px] hover:bg-stone-100 hover:text-[#A145F5] transition-all"
                    title="Limpiar Filtros"
                >
                    Limpiar Filtros
                </button>
            </div>
        </div>
    )
}



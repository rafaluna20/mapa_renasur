import { Search, Layers, Map as MapIcon, DollarSign, Maximize2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

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
    searchMatchCount?: number;
    onClearFilters: () => void;
    // Filtros de rango (avanzados)
    priceMin: number | null;
    priceMax: number | null;
    onPriceMinChange: (val: number | null) => void;
    onPriceMaxChange: (val: number | null) => void;
    areaMin: number | null;
    areaMax: number | null;
    onAreaMinChange: (val: number | null) => void;
    onAreaMaxChange: (val: number | null) => void;
}

export default function FilterBar({
    searchQuery, onSearchChange,
    statusFilter, onStatusChange,
    manzanaFilter, onManzanaChange,
    etapaFilter, onEtapaChange,
    filteredCount, searchMatchCount, onClearFilters,
    priceMin, priceMax, onPriceMinChange, onPriceMaxChange,
    areaMin, areaMax, onAreaMinChange, onAreaMaxChange
}: FilterBarProps) {
    // Estado para controlar la visibilidad de búsquedas avanzadas
    const [showAdvanced, setShowAdvanced] = useState(false);
    return (
        <div className="p-3 border-b border-stone-200 bg-white/80 backdrop-blur-md shadow-sm space-y-3">
            {/* Header / Title - Violet Brand Alignment */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A145F5] shadow-[0_0_8px_rgba(161,69,245,0.4)]"></span>
                    <span className="opacity-80">Filtros</span>
                </h3>
                <div className="flex gap-1">
                    {searchQuery && searchMatchCount !== undefined && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded border border-blue-200">
                            🔍 {searchMatchCount}
                        </span>
                    )}
                    <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[9px] font-bold rounded border border-stone-200">
                        {filteredCount} Total
                    </span>
                </div>
            </div>

            {/* Search - Modern Violet Focus with Accessibility */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#A145F5] transition-colors" size={16} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, código, manzana, cliente..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-transparent text-stone-800 text-xs font-medium placeholder:text-stone-400 rounded-xl focus:bg-white focus:border-[#A145F5]/30 focus:ring-4 focus:ring-[#A145F5]/10 transition-all outline-none shadow-sm hover:shadow-md hover:bg-white"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    aria-label="Buscar lotes por nombre, código, manzana o cliente"
                    aria-describedby="search-help"
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#A145F5] transition-colors"
                        aria-label="Limpiar búsqueda"
                    >
                        ✕
                    </button>
                )}
            </div>
            <p id="search-help" className="sr-only">
                Busca lotes por nombre, código (ej: E01MZD100), manzana, cliente o número de lote
            </p>

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

            {/* Botón para mostrar/ocultar búsquedas avanzadas */}
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full py-2 px-3 bg-gradient-to-r from-[#A145F5]/10 to-violet-100/50 border border-[#A145F5]/20 text-[#A145F5] font-bold rounded-lg text-[10px] hover:from-[#A145F5]/20 hover:to-violet-100 transition-all flex items-center justify-between group"
                aria-expanded={showAdvanced}
                aria-controls="advanced-filters"
            >
                <span className="flex items-center gap-1.5">
                    🔍 Búsquedas Avanzadas
                    {(priceMin || priceMax || areaMin || areaMax) && (
                        <span className="inline-block w-2 h-2 bg-[#A145F5] rounded-full animate-pulse"></span>
                    )}
                </span>
                {showAdvanced ? (
                    <ChevronUp size={14} className="group-hover:transform group-hover:-translate-y-0.5 transition-transform" />
                ) : (
                    <ChevronDown size={14} className="group-hover:transform group-hover:translate-y-0.5 transition-transform" />
                )}
            </button>

            {/* Panel de Búsquedas Avanzadas (Colapsable) */}
            {showAdvanced && (
                <div
                    id="advanced-filters"
                    className="space-y-3 pt-2 pb-1 animate-in slide-in-from-top-2 duration-200"
                >
                    {/* Rango de Precio */}
                    <div className="space-y-1.5 p-2.5 bg-gradient-to-br from-green-50 to-emerald-50/30 rounded-lg border border-emerald-100">
                        <label className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1 ml-1">
                            <DollarSign size={10} className="text-emerald-600" /> Rango de Precio (S/)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                placeholder="Mínimo"
                                value={priceMin ?? ''}
                                onChange={(e) => onPriceMinChange(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                                aria-label="Precio mínimo"
                            />
                            <input
                                type="number"
                                placeholder="Máximo"
                                value={priceMax ?? ''}
                                onChange={(e) => onPriceMaxChange(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                                aria-label="Precio máximo"
                            />
                        </div>
                    </div>

                    {/* Rango de Área */}
                    <div className="space-y-1.5 p-2.5 bg-gradient-to-br from-blue-50 to-sky-50/30 rounded-lg border border-blue-100">
                        <label className="text-[9px] font-bold text-blue-700 uppercase tracking-widest flex items-center gap-1 ml-1">
                            <Maximize2 size={10} className="text-blue-600" /> Rango de Área (m²)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                placeholder="Mínimo"
                                value={areaMin ?? ''}
                                onChange={(e) => onAreaMinChange(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                aria-label="Área mínima"
                            />
                            <input
                                type="number"
                                placeholder="Máximo"
                                value={areaMax ?? ''}
                                onChange={(e) => onAreaMaxChange(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                aria-label="Área máxima"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Filters Button with Accessibility */}
            <div className="pt-2">
                <button
                    onClick={onClearFilters}
                    className="w-full py-2 bg-stone-50 border border-stone-200 text-stone-500 font-bold rounded-lg text-[10px] hover:bg-stone-100 hover:text-[#A145F5] transition-all active:scale-95"
                    aria-label="Limpiar todos los filtros de búsqueda"
                >
                    🗑️ Limpiar Todos los Filtros
                </button>
            </div>
        </div>
    );
}



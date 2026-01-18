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
    onExport: () => void;
    onExportPdf: () => void;
}

export default function FilterBar({
    searchQuery, onSearchChange,
    statusFilter, onStatusChange,
    manzanaFilter, onManzanaChange,
    etapaFilter, onEtapaChange,
    filteredCount, onClearFilters,
    onExport, onExportPdf
}: FilterBarProps) {
    return (
        <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 space-y-4">
            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input
                    type="text"
                    placeholder="Buscar lote..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm transition-all outline-none shadow-sm hover:shadow-md"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                    { value: 'all', label: 'Todos' },
                    { value: 'libre', label: 'Disponible' },
                    { value: 'separado', label: 'Reservado' },
                    { value: 'vendido', label: 'Vendido' }
                ].map((filter) => (
                    <button
                        key={filter.value}
                        onClick={() => onStatusChange(filter.value)}
                        className={`
                    px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                    ${statusFilter === filter.value
                                ? 'bg-slate-800 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                  `}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* Filters Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Manzana Filter */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={12} className="text-blue-600" />
                        Manzana
                    </label>
                    <select
                        value={manzanaFilter}
                        onChange={(e) => onManzanaChange(e.target.value)}
                        className="w-full px-3 py-2 bg-blue-50 border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm font-medium text-blue-900 transition-all outline-none shadow-sm hover:shadow-md hover:bg-blue-100 cursor-pointer"
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
                </div>

                {/* Etapa Filter */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <MapIcon size={12} className="text-blue-600" />
                        Etapa
                    </label>
                    <select
                        value={etapaFilter}
                        onChange={(e) => onEtapaChange(e.target.value)}
                        className="w-full px-3 py-2 bg-blue-50 border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm font-medium text-blue-900 transition-all outline-none shadow-sm hover:shadow-md hover:bg-blue-100 cursor-pointer"
                    >
                        <option value="all">Todas</option>
                        <option value="01">Etapa 01</option>
                        <option value="02">Etapa 02</option>
                        <option value="03">Etapa 03</option>
                        <option value="04">Etapa 04</option>
                    </select>
                </div>
            </div>

            {/* Export Buttons */}
            <div className="pt-2 flex gap-2">
                <button
                    onClick={onExport}
                    className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    title="Exportar SVG"
                >
                    <MapIcon size={16} />
                    <span className="hidden sm:inline">SVG</span>
                </button>
                <button
                    onClick={onExportPdf}
                    className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    title="Descargar PDF"
                >
                    <FileDown size={16} />
                    <span className="hidden sm:inline">PDF</span>
                </button>
            </div>
        </div>
    )
}



interface DashboardStats {
    available: number;
    reserved: number;
    sold: number;
}

interface ProductDashboardProps {
    stats: DashboardStats;
}

export default function ProductDashboard({ stats }: ProductDashboardProps) {
    return (
        <div className="p-3 bg-gradient-to-r from-slate-50 to-white border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-2xl font-bold text-emerald-600">{stats.available}</span>
                <span className="font-medium text-emerald-700 text-[10px] uppercase tracking-wide">Disponibles</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-2xl font-bold text-amber-600">{stats.reserved}</span>
                <span className="font-medium text-amber-700 text-[10px] uppercase tracking-wide">Reservados</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-red-50 border border-red-100">
                <span className="text-2xl font-bold text-red-600">{stats.sold}</span>
                <span className="font-medium text-red-700 text-[10px] uppercase tracking-wide">Vendidos</span>
            </div>
        </div>
    );
}

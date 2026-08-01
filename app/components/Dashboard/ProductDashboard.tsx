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
        <div className="p-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                <span className="text-[17px] font-bold text-emerald-600 dark:text-emerald-400">{stats.available}</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400 text-[10px] uppercase tracking-wide">Disponibles</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
                <span className="text-[17px] font-bold text-amber-600 dark:text-amber-400">{stats.reserved}</span>
                <span className="font-medium text-amber-700 dark:text-amber-400 text-[10px] uppercase tracking-wide">Reservados</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50">
                <span className="text-[17px] font-bold text-red-600 dark:text-red-400">{stats.sold}</span>
                <span className="font-medium text-red-700 dark:text-red-400 text-[10px] uppercase tracking-wide">Vendidos</span>
            </div>
        </div>
    );
}

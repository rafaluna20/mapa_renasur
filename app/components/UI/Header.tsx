import { Home, RefreshCw, LogOut, User } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

interface HeaderProps {
    onSync?: () => void;
}

export default function Header({ onSync }: HeaderProps) {
    const { user, salesCount, logout } = useAuth();

    return (
        <header className="bg-slate-900 text-white p-4 shadow-lg flex justify-between items-center z-20 relative">
            <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                    <Home size={24} />
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-tight">UrbanaSales GIS</h1>
                    <p className="text-xs text-slate-400">Mapa Satelital + Odoo 18</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {user && (
                    <div className="hidden md:flex items-center gap-3 bg-slate-800 py-1.5 px-3 rounded-full border border-slate-700">
                        <div className="flex items-center gap-2 border-r border-slate-600 pr-3">
                            <User size={14} className="text-blue-400" />
                            <span className="text-sm font-medium">{user.name}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-400 mr-1">Ventas:</span>
                            <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">{salesCount}</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={onSync}
                        className="flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-md transition-colors border border-slate-700"
                        title="Sincronizar"
                    >
                        <RefreshCw size={16} />
                        <span className="hidden sm:inline">Sync</span>
                    </button>

                    {user && (
                        <button
                            onClick={logout}
                            className="flex items-center gap-2 text-sm bg-red-900/30 hover:bg-red-900/50 text-red-200 px-3 py-2 rounded-md transition-colors border border-red-900/50"
                            title="Cerrar Sesión"
                        >
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

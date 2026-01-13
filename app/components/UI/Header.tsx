import { Home, RefreshCw } from 'lucide-react';

interface HeaderProps {
    onSync?: () => void;
}

export default function Header({ onSync }: HeaderProps) {
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
            <button
                onClick={onSync}
                className="flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-md transition-colors"
            >
                <RefreshCw size={16} />
                <span className="hidden sm:inline">Sincronizar</span>
            </button>
        </header>
    );
}

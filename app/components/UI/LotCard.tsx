import { Lot } from '@/app/data/lotsData';
import { LucideIcon, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface StatusConfigItem {
    color: string;
    label: string;
    bg: string;
    text: string;
    icon: LucideIcon;
}

interface LotCardProps {
    lot: Lot;
    onClick: (lot: Lot) => void;
    isSelected: boolean;
}

const STATUS_CONFIG: Record<string, StatusConfigItem> = {
    libre: { color: "#10B981", label: "Disponible", bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle },
    separado: { color: "#F59E0B", label: "Reservado", bg: "bg-amber-100", text: "text-amber-800", icon: AlertCircle },
    vendido: { color: "#EF4444", label: "Vendido", bg: "bg-red-100", text: "text-red-800", icon: XCircle },
};

export default function LotCard({ lot, onClick, isSelected }: LotCardProps) {
    const config = STATUS_CONFIG[lot.x_statu] || STATUS_CONFIG.libre;
    const Icon = config.icon;

    return (
        <div
            onClick={() => onClick(lot)}
            className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
        >
            <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-slate-800 capitalize">{lot.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${config.bg} ${config.text}`}>
                    <Icon size={12} />
                    {config.label}
                </span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
                <span>{Number(lot.x_area).toFixed(2)} m²</span>
                <span className="font-semibold text-slate-700">$ {lot.list_price.toLocaleString()}</span>
            </div>
        </div>
    );
}

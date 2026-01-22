import { Lot } from '@/app/data/lotsData';
import { LucideIcon, CheckCircle, AlertCircle, XCircle, FileText, Flame } from 'lucide-react';

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
    quoteCount?: number;
}

const STATUS_CONFIG: Record<string, StatusConfigItem> = {
    libre: { color: "#34D399", label: "Disponible", bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle },
    disponible: { color: "#34D399", label: "Disponible", bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle },

    cotizacion: { color: "#FDE047", label: "En Cotización", bg: "bg-yellow-100", text: "text-yellow-800", icon: FileText },
    'no vender': { color: "#94A3B8", label: "No Vender", bg: "bg-slate-100", text: "text-slate-800", icon: AlertCircle },

    // Reservado (Purple - Requested)
    reservado: { color: "#C084FC", label: "Reservado", bg: "bg-purple-100", text: "text-purple-800", icon: AlertCircle },
    separado: { color: "#C084FC", label: "Reservado", bg: "bg-purple-100", text: "text-purple-800", icon: AlertCircle },

    vendido: { color: "#F87171", label: "Vendido", bg: "bg-red-100", text: "text-red-800", icon: XCircle },
};

export default function LotCard({ lot, onClick, isSelected, quoteCount }: LotCardProps) {
    const config = STATUS_CONFIG[lot.x_statu?.toLowerCase()] || STATUS_CONFIG.libre;
    const Icon = config.icon;

    return (
        <div
            onClick={() => onClick(lot)}
            className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
        >
            <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-slate-800 capitalize text-[13px]">{lot.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${config.bg} ${config.text}`}>
                    <Icon size={12} />
                    {config.label}
                </span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
                <span>{Number(lot.x_area).toFixed(2)} m²</span>
                <span className="font-semibold text-slate-700">$ {lot.list_price.toLocaleString()}</span>
            </div>
            {quoteCount && quoteCount > 1 && (
                <div className="mt-2 flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full w-fit">
                    <Flame size={12} />
                    {quoteCount} Cotizaciones
                </div>
            )}
        </div>
    );
}

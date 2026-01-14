import { useRef, useEffect, useState } from 'react';
import { OdooUser } from '@/app/context/AuthContext';
import { lotsData } from '@/app/data/lotsData';
import { X, User, Trophy, Clock, CheckCircle, TrendingUp } from 'lucide-react';

interface UserProfileModalProps {
    user: OdooUser;
    onClose: () => void;
}

export default function UserProfileModal({ user, onClose }: UserProfileModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const [stats, setStats] = useState({ sold: 0, reserved: 0, totalValue: 0 });

    useEffect(() => {
        // Calculate stats from local lotsData matching the user's partner_id
        // Note: In a real app, this might come from Odoo directly.
        // We use user.partner_id as the salespersonId matcher.
        const userLots = lotsData.filter(lot => lot.salespersonId === user.partner_id);

        const sold = userLots.filter(l => l.status === 'sold').length;
        const reserved = userLots.filter(l => l.status === 'reserved').length;
        const totalValue = userLots
            .filter(l => l.status === 'sold')
            .reduce((acc, lot) => acc + lot.price, 0);

        setStats({ sold, reserved, totalValue });
    }, [user]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 m-4"
            >
                {/* Header Profile Info */}
                <div className="bg-slate-900 text-white p-6 text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/10 shadow-lg">
                        <User size={40} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{user.name}</h2>
                    <p className="text-blue-200 text-sm">{user.username}</p>
                    <div className="mt-2 inline-block bg-blue-900/50 px-3 py-1 rounded-full text-xs font-medium border border-blue-500/30">
                        Vendedor Autorizado
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="p-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Rendimiento</h3>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center">
                            <div className="bg-emerald-100 p-2 rounded-lg mb-2 text-emerald-600">
                                <Trophy size={20} />
                            </div>
                            <span className="text-3xl font-bold text-slate-800">{stats.sold}</span>
                            <span className="text-xs text-slate-500 font-medium uppercase mt-1">Lotes Vendidos</span>
                        </div>

                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex flex-col items-center justify-center">
                            <div className="bg-amber-100 p-2 rounded-lg mb-2 text-amber-600">
                                <Clock size={20} />
                            </div>
                            <span className="text-3xl font-bold text-slate-800">{stats.reserved}</span>
                            <span className="text-xs text-slate-500 font-medium uppercase mt-1">En Separación</span>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-blue-500" />
                                <span className="text-sm font-semibold text-slate-700">Volumen de Ventas</span>
                            </div>
                            <span className="text-lg font-bold text-blue-600">$ {stats.totalValue.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[70%] rounded-full"></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 text-right">Actualizado: Hoy</p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium transition-colors"
                    >
                        Cerrar Perfil
                    </button>
                </div>
            </div>
        </div>
    );
}

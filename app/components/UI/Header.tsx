import { RefreshCw, LogOut, User, MapPin, TrendingUp, Award } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { useState } from 'react';
import UserProfileModal from './UserProfileModal';
import Image from 'next/image';

interface HeaderProps {
    onSync?: () => void;
}

export default function Header({ onSync }: HeaderProps) {
    const { user, salesCount, reservedCount, logout } = useAuth();
    const [showProfile, setShowProfile] = useState(false);

    return (
        <header className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border-b border-slate-700/50 z-20">
            {/* Decorative top border */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2E7D5E] via-[#A145F5] to-[#2E7D5E]"></div>
            
            <div className="px-4 py-3 flex justify-between items-center">
                {/* Logo Section */}
                <div
                    className="flex items-center gap-3 cursor-pointer group relative"
                    onClick={() => window.location.href = '/'}
                >
                    {/* Logo Container with glow effect */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-[#2E7D5E]/20 blur-xl group-hover:bg-[#2E7D5E]/30 transition-all duration-300 rounded-full"></div>
                        <div className="relative bg-white p-1.5 rounded-xl shadow-lg group-hover:shadow-[#2E7D5E]/30 group-hover:scale-105 transition-all duration-300 border border-slate-700">
                            <Image
                                src="/terra-lima-logo.png"
                                alt="Terra Lima"
                                width={84}
                                height={28}
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>
                    
                    {/* Title and subtitle */}
                    <div className="hidden sm:block">
                        <div className="flex items-center gap-2">
                            <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#2E7D5E] bg-clip-text text-transparent group-hover:from-[#2E7D5E] group-hover:via-white group-hover:to-[#A145F5] transition-all duration-500">
                                Portal GIS
                            </h1>
                            <MapPin size={18} className="text-[#2E7D5E] group-hover:text-[#A145F5] transition-colors duration-300" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                            Sistema de Gestión Inmobiliaria
                        </p>
                    </div>
                </div>

                {/* Right Section - Stats & Actions */}
                <div className="flex items-center gap-3">
                    {/* User Stats Card (Desktop) */}
                    {user && (
                        <button
                            onClick={() => window.location.href = '/dashboard'}
                            className="hidden lg:flex items-center gap-3 bg-gradient-to-r from-slate-800/80 to-slate-800/50 hover:from-slate-700/80 hover:to-slate-700/50 backdrop-blur-sm transition-all duration-300 py-2 px-4 rounded-xl border border-slate-700/50 hover:border-[#2E7D5E]/50 shadow-lg hover:shadow-[#2E7D5E]/20 group"
                        >
                            {/* User Info */}
                            <div className="flex items-center gap-2 pr-3 border-r border-slate-600/50">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-[#A145F5]/20 blur-md rounded-full"></div>
                                    <div className="relative w-8 h-8 bg-gradient-to-br from-[#A145F5] to-[#2E7D5E] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <User size={16} className="text-white" />
                                    </div>
                                </div>
                                <span className="text-sm font-semibold text-slate-100">{user.name}</span>
                            </div>
                            
                            {/* Stats */}
                            <div className="flex items-center gap-3 text-xs">
                                {/* Cotizadas */}
                                <div className="flex items-center gap-1.5">
                                    <TrendingUp size={14} className="text-blue-400" />
                                    <span className="text-slate-400 font-medium">Cotizadas:</span>
                                    <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2 py-0.5 rounded-md font-bold shadow-sm">
                                        12
                                    </span>
                                </div>
                                
                                {/* Ventas */}
                                <div className="flex items-center gap-1.5">
                                    <Award size={14} className="text-[#2E7D5E]" />
                                    <span className="text-slate-400 font-medium">Ventas:</span>
                                    <span className="bg-gradient-to-r from-[#2E7D5E] to-emerald-600 text-white px-2 py-0.5 rounded-md font-bold shadow-sm">
                                        {salesCount}
                                    </span>
                                </div>
                            </div>
                        </button>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {/* Mobile User Button */}
                        {user && (
                            <button
                                onClick={() => window.location.href = '/dashboard'}
                                className="lg:hidden flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700 hover:from-[#A145F5]/20 hover:to-[#2E7D5E]/20 w-10 h-10 rounded-xl border border-slate-700 hover:border-[#A145F5]/50 transition-all duration-300 group"
                                title="Ver Dashboard"
                            >
                                <User size={18} className="text-slate-300 group-hover:text-[#A145F5] transition-colors" />
                            </button>
                        )}

                        {/* Sync Button */}
                        <button
                            onClick={onSync}
                            className="flex items-center gap-2 text-sm bg-gradient-to-br from-slate-800 to-slate-700 hover:from-[#2E7D5E]/30 hover:to-emerald-800/30 px-3 py-2 rounded-xl transition-all duration-300 border border-slate-700 hover:border-[#2E7D5E]/50 shadow-md hover:shadow-[#2E7D5E]/30 group"
                            title="Sincronizar con Odoo"
                        >
                            <RefreshCw size={16} className="text-slate-300 group-hover:text-[#2E7D5E] group-hover:rotate-180 transition-all duration-500" />
                            <span className="hidden sm:inline font-medium text-slate-300 group-hover:text-[#2E7D5E] transition-colors">
                                Sync
                            </span>
                        </button>

                        {/* Logout Button */}
                        {user && (
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 text-sm bg-gradient-to-br from-red-900/40 to-red-800/40 hover:from-red-800/60 hover:to-red-700/60 text-red-200 hover:text-red-100 px-3 py-2 rounded-xl transition-all duration-300 border border-red-900/50 hover:border-red-700/50 shadow-md hover:shadow-red-900/40 group"
                                title="Cerrar Sesión"
                            >
                                <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform duration-300" />
                                <span className="hidden sm:inline font-medium">Salir</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom decorative gradient line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2E7D5E]/30 to-transparent"></div>

            {/* User Profile Modal */}
            {showProfile && user && (
                <UserProfileModal user={user} onClose={() => setShowProfile(false)} />
            )}
        </header>
    );
}

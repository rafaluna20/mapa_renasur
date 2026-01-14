'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from '@/app/components/UI/Header';
import MapContainerWrapper from '@/app/components/Map/MapContainer';
import LotCard from '@/app/components/UI/LotCard';
import LotDetailModal from '@/app/components/UI/LotDetailModal';
import { lotsData, Lot } from '@/app/data/lotsData';
import { Search, Menu, Filter, Map as MapIcon, Layers, Square, Navigation, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [mapType, setMapType] = useState<'street' | 'satellite' | 'blank'>('street');
  // Local state for lots to simulate status updates
  const [lots, setLots] = useState<Lot[]>(lotsData);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);


  const stats = useMemo(() => {
    return {
      available: lots.filter(l => l.status === 'available').length,
      reserved: lots.filter(l => l.status === 'reserved').length,
      sold: lots.filter(l => l.status === 'sold').length,
    };
  }, [lots]);

  const filteredLots = useMemo(() => {
    return lots.filter(lot => {
      const matchesStatus = statusFilter === 'all' || lot.status === statusFilter;
      const matchesSearch = lot.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [lots, statusFilter, searchQuery]);

  const selectedLot = useMemo(() => lots.find(l => l.id === selectedLotId) || null, [lots, selectedLotId]);

  const handleUpdateStatus = (id: string, newStatus: 'available' | 'reserved' | 'sold') => {
    setLots(prev => prev.map(lot =>
      lot.id === id ? { ...lot, status: newStatus } : lot
    ));
  };

  const handleSync = () => {
    alert("Sincronizando con Odoo...");
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }


  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      <Header onSync={handleSync} />

      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="absolute inset-0 bg-black/30 z-[490] md:hidden backdrop-blur-[2px] animate-in fade-in"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar List */}
        <div className={`
          absolute inset-y-0 left-0 z-[500] w-80 max-w-[85vw] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-r border-slate-200 flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:z-10 md:shadow-xl
        `}>
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 bg-white space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar polígono..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'available', label: 'Disponible' },
                { value: 'reserved', label: 'Reservado' },
                { value: 'sold', label: 'Vendido' }
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
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
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filteredLots.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Filter size={32} className="mx-auto mb-2 opacity-50" />
                <p>Cargando polígonos...</p>
              </div>
            ) : (
              filteredLots.map(lot => (
                <LotCard
                  key={lot.id}
                  lot={lot}
                  onClick={() => {
                    setSelectedLotId(lot.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  isSelected={selectedLotId === lot.id}
                />
              ))
            )}
          </div>

          {/* Mini Stats Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="text-emerald-600 font-bold">{stats.available} <span className="font-normal text-slate-500">Disp.</span></div>
            <div className="text-amber-600 font-bold">{stats.reserved} <span className="font-normal text-slate-500">Res.</span></div>
            <div className="text-red-600 font-bold">{stats.sold} <span className="font-normal text-slate-500">Vend.</span></div>
          </div>
        </div>

        {/* Toggle Sidebar Button (Mobile) */}
        {!isSidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 bg-white p-2 rounded-lg shadow-lg text-slate-600 md:hidden"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Main Map Area */}
        <div className="flex-1 bg-slate-200 relative overflow-hidden flex flex-col">
          {/* Map Controls (Floating) */}
          <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
            <div className="bg-white rounded-lg shadow-md p-1 border border-slate-200 flex flex-col gap-1">
              <button
                onClick={() => setMapType('street')}
                className={`p-2 rounded hover:bg-slate-100 transition-colors ${mapType === 'street' ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
                title="Mapa Calles"
              >
                <MapIcon size={20} />
              </button>
              <button
                onClick={() => setMapType('satellite')}
                className={`p-2 rounded hover:bg-slate-100 transition-colors ${mapType === 'satellite' ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
                title="Mapa Satélite"
              >
                <Layers size={20} />
              </button>
              <button
                onClick={() => setMapType('blank')}
                className={`p-2 rounded hover:bg-slate-100 transition-colors ${mapType === 'blank' ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
                title="Fondo Blanco"
              >
                <Square size={20} />
              </button>
            </div>
            <button
              className="bg-white text-slate-700 p-2 rounded-lg shadow-md border border-slate-200 hover:bg-slate-50"
              title="Mi Ubicación"
              onClick={() => alert("GPS simulado")}
            >
              <Navigation size={20} />
            </button>
          </div>

          {/* Legend Overlay */}
          <div className="absolute bottom-6 right-4 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200 pointer-events-none">
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Leyenda</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                <span className="text-slate-700">Disponible</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-sm bg-amber-500"></div>
                <span className="text-slate-700">Reservado</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                <span className="text-slate-700">Vendido</span>
              </div>
            </div>
          </div>

          <div className="flex-1 z-0 relative h-full">
            <MapContainerWrapper
              lots={filteredLots}
              selectedLotId={selectedLotId}
              onLotSelect={(l) => setSelectedLotId(l.id)}
              mapType={mapType}
            />
          </div>

          {/* Detail Modal Overlay (Floating) */}
          <LotDetailModal
            lot={selectedLot}
            onClose={() => setSelectedLotId(null)}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>
      </div>
    </div>
  );
}

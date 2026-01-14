'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from '@/app/components/UI/Header';
import MapContainerWrapper from '@/app/components/Map/MapContainer';
import LotCard from '@/app/components/UI/LotCard';
import LotDetailModal from '@/app/components/UI/LotDetailModal';
import { lotsData, Lot } from '@/app/data/lotsData';
import { Search, Menu, Filter, Map as MapIcon, Layers, Square, Navigation, Loader2, FileText } from 'lucide-react';
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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [manzanaFilter, setManzanaFilter] = useState<string>('all');
  const [etapaFilter, setEtapaFilter] = useState<string>('all');

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
      const matchesManzana = manzanaFilter === 'all' || lot.manzana === manzanaFilter;
      const matchesEtapa = etapaFilter === 'all' || lot.etapa === etapaFilter;
      return matchesStatus && matchesSearch && matchesManzana && matchesEtapa;
    });
  }, [lots, statusFilter, searchQuery, manzanaFilter, etapaFilter]);

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
          <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 space-y-4">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Buscar lote..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm transition-all outline-none shadow-sm hover:shadow-md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
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
                  onChange={(e) => setManzanaFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm font-medium text-blue-900 transition-all outline-none shadow-sm hover:shadow-md hover:bg-blue-100 cursor-pointer"
                >
                  <option value="all">Todas</option>
                  <option value="Q">MZ Q</option>
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
                  onChange={(e) => setEtapaFilter(e.target.value)}
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

            {/* Active Filters Count */}
            {(statusFilter !== 'all' || manzanaFilter !== 'all' || etapaFilter !== 'all' || searchQuery) && (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                <span className="text-xs font-medium text-blue-700">
                  {filteredLots.length} lotes encontrados
                </span>
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setManzanaFilter('all');
                    setEtapaFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                >
                  Limpiar
                </button>
              </div>
            )}
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
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude, longitude } = position.coords;
                      setUserLocation([latitude, longitude]);
                      setSelectedLotId(null);
                      window.dispatchEvent(new CustomEvent('centerMap', {
                        detail: { lat: latitude, lng: longitude, zoom: 18 }
                      }));
                    },
                    (error) => {
                      alert('No se pudo obtener tu ubicación: ' + error.message);
                    }
                  );
                } else {
                  alert('Tu navegador no soporta geolocalización');
                }
              }}
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
              userLocation={userLocation}
            />
          </div>

          {/* Detail Modal Overlay (Floating) */}
          <LotDetailModal
            lot={selectedLot}
            onClose={() => setSelectedLotId(null)}
            onUpdateStatus={handleUpdateStatus}
          />

          {/* Mobile Quick Filters Bar */}
          <div className="md:hidden fixed bottom-4 left-2 right-2 z-[600] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-2">
              {/* Filters Group */}
              <div className="grid grid-cols-5 gap-1.5 items-center">
                {/* Etapa */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] font-bold text-blue-700 uppercase leading-none px-1 text-center">Etapa</label>
                  <select
                    value={etapaFilter}
                    onChange={(e) => setEtapaFilter(e.target.value)}
                    className="w-full px-1 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[10px] font-semibold text-blue-900 outline-none appearance-none text-center"
                  >
                    <option value="all">Todas</option>
                    <option value="01">01</option>
                    <option value="02">02</option>
                    <option value="03">03</option>
                    <option value="04">04</option>
                  </select>
                </div>

                {/* MZ */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] font-bold text-blue-700 uppercase leading-none px-1 text-center">MZ</label>
                  <select
                    value={manzanaFilter}
                    onChange={(e) => setManzanaFilter(e.target.value)}
                    className="w-full px-1 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[10px] font-semibold text-blue-900 outline-none appearance-none text-center"
                  >
                    <option value="all">Todas</option>
                    <option value="Q">Q</option>
                    <option value="R">R</option>
                    <option value="S">S</option>
                    <option value="T">T</option>
                    <option value="W">W</option>
                    <option value="X">X</option>
                  </select>
                </div>

                {/* Search Button (Center) */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 active:scale-90 transition-transform flex items-center justify-center"
                  >
                    <Search size={18} />
                  </button>
                </div>

                {/* Estado */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] font-bold text-slate-600 uppercase leading-none px-1 text-center">Estado</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-1 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-semibold text-slate-900 outline-none appearance-none text-center"
                  >
                    <option value="all">Todos</option>
                    <option value="available">Disp</option>
                    <option value="reserved">Res</option>
                    <option value="sold">Vend</option>
                  </select>
                </div>

                {/* Notas */}
                <div className="flex flex-col gap-0.5 items-center justify-end">
                  <button
                    onClick={() => alert('Función de notas próximamente')}
                    className="w-full py-2 bg-slate-800 text-white rounded-lg text-[10px] font-bold active:scale-95 transition-transform flex flex-col items-center justify-center"
                  >
                    <FileText size={14} />
                    <span className="text-[7px] uppercase mt-0.5">Notas</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

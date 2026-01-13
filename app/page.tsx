'use client';

import { useState, useMemo } from 'react';
import Header from '@/app/components/UI/Header';
import MapContainerWrapper from '@/app/components/Map/MapContainer';
import LotCard from '@/app/components/UI/LotCard';
import LotDetailModal from '@/app/components/UI/LotDetailModal';
import { lotsData, Lot } from '@/app/data/lotsData';
import { Filter } from 'lucide-react';

export default function Home() {
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const filteredLots = useMemo(() => {
    if (statusFilter === 'all') return lotsData;
    return lotsData.filter((lot) => lot.status === statusFilter);
  }, [statusFilter]);

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-50 dark:bg-black">
      <Header />

      <main className="flex flex-1 overflow-hidden relative">
        {/* Sidebar / List View */}
        <aside
          className={`
            absolute left-0 top-0 z-20 h-full w-full bg-white shadow-xl transition-transform duration-300 dark:bg-zinc-900 border-r dark:border-zinc-800
            md:relative md:w-[400px] md:translate-x-0
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Lotes Disponibles</h2>
              <div className="md:hidden">
                <button onClick={() => setIsSidebarOpen(false)} className="p-2">✕</button>
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filtrar por estado:</span>
              </div>
              <div className="flex gap-2">
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
                       px-3 py-1 text-xs rounded-full border transition-colors
                       ${statusFilter === filter.value
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900'
                        : 'bg-transparent border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
                      }
                    `}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {filteredLots.map((lot) => (
                <LotCard
                  key={lot.id}
                  lot={lot}
                  onClick={(l) => {
                    setSelectedLot(l);
                    // On mobile, close sidebar when clicking? Maybe not, usually want to see details.
                    // But if detail is modal, it's fine.
                  }}
                />
              ))}
              {filteredLots.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  No se encontraron lotes con este filtro.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Map Area */}
        <div className="flex-1 relative h-full w-full">
          <MapContainerWrapper
            lots={filteredLots}
            selectedLot={selectedLot}
            onLotSelect={setSelectedLot}
          />

          {/* Mobile Toggle Button */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 z-[400] bg-white text-black p-3 rounded-full shadow-lg md:hidden"
            >
              Logs list
            </button>
          )}
        </div>
      </main>

      <LotDetailModal
        lot={selectedLot}
        onClose={() => setSelectedLot(null)}
      />
    </div>
  );
}

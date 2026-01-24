'use client';

import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useMapHistory } from '@/app/hooks/useMapHistory';
import { useEffect } from 'react';

interface NavigationHistoryProps {
  selectedLotId: string | null;
  onNavigate: (lotId: string) => void;
}

export default function NavigationHistory({ 
  selectedLotId, 
  onNavigate 
}: NavigationHistoryProps) {
  const { visit, goBack, goForward, canGoBack, canGoForward, currentIndex, history } = useMapHistory();

  // Registrar visitas cuando cambia la selección
  useEffect(() => {
    if (selectedLotId) {
      visit(selectedLotId);
    }
  }, [selectedLotId, visit]);

  const handleBack = () => {
    const lotId = goBack();
    if (lotId) {
      onNavigate(lotId);
    }
  };

  const handleForward = () => {
    const lotId = goForward();
    if (lotId) {
      onNavigate(lotId);
    }
  };

  // No mostrar si no hay historial
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-20 left-4 z-[400] hidden md:flex items-center bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 overflow-hidden">
      <button
        onClick={handleBack}
        disabled={!canGoBack}
        className={`p-2 transition-colors ${
          canGoBack 
            ? 'hover:bg-slate-100 text-slate-700 cursor-pointer' 
            : 'text-slate-300 cursor-not-allowed'
        }`}
        title="Lote anterior"
        aria-label="Ir al lote anterior"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="px-3 border-x border-slate-200 flex items-center gap-2">
        <History size={14} className="text-slate-400" />
        <span className="text-xs font-medium text-slate-600">
          {currentIndex + 1} / {history.length}
        </span>
      </div>

      <button
        onClick={handleForward}
        disabled={!canGoForward}
        className={`p-2 transition-colors ${
          canGoForward 
            ? 'hover:bg-slate-100 text-slate-700 cursor-pointer' 
            : 'text-slate-300 cursor-not-allowed'
        }`}
        title="Lote siguiente"
        aria-label="Ir al siguiente lote"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

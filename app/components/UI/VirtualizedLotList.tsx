'use client';

import { Lot } from '@/app/data/lotsData';
import LotCard from './LotCard';
import { useState, useEffect, useRef, useMemo } from 'react';

interface VirtualizedLotListProps {
  lots: Lot[];
  selectedLotId: string | null;
  onLotSelect: (lot: Lot) => void;
  itemHeight?: number;
}

/**
 * Componente de lista virtualizada custom (sin dependencias externas)
 * Renderiza solo los items visibles en el viewport + buffer
 */
export default function VirtualizedLotList({
  lots,
  selectedLotId,
  onLotSelect,
  itemHeight = 120
}: VirtualizedLotListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Calcular altura dinámica del contenedor
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top;
        setContainerHeight(Math.max(400, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Manejar scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Calcular items visibles
  const { visibleItems, totalHeight, offsetY } = useMemo(() => {
    const totalHeight = lots.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 3); // Buffer de 3 items arriba
    const endIndex = Math.min(
      lots.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + 3 // Buffer de 3 items abajo
    );
    
    const visibleItems = lots.slice(startIndex, endIndex + 1);
    const offsetY = startIndex * itemHeight;

    return { visibleItems, totalHeight, offsetY };
  }, [lots, scrollTop, containerHeight, itemHeight]);

  // Scroll al lote seleccionado
  useEffect(() => {
    if (selectedLotId && scrollContainerRef.current) {
      const index = lots.findIndex(lot => lot.id === selectedLotId);
      if (index !== -1) {
        const targetScroll = index * itemHeight - containerHeight / 2 + itemHeight / 2;
        scrollContainerRef.current.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedLotId, lots, itemHeight, containerHeight]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overflow-x-hidden smooth-scroll"
        style={{ height: `${containerHeight}px` }}
      >
        {/* Spacer para mantener el scroll total */}
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {/* Container de items visibles */}
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0
            }}
          >
            {visibleItems.map((lot) => (
              <div
                key={`${lot.id}-${lot.default_code}`}
                style={{ height: `${itemHeight}px` }}
                className="px-2 pb-2"
              >
                <LotCard
                  lot={lot}
                  onClick={() => onLotSelect(lot)}
                  isSelected={selectedLotId === lot.id}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

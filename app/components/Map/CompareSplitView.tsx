'use client';

import { Lot } from '@/app/data/lotsData';
import { X, Check } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapContainerWrapper = dynamic(() => import('./MapContainer'), { ssr: false });

interface CompareSplitViewProps {
  lots: Lot[];
  selectedIds: string[];
  onClose: () => void;
  onRemoveLot: (id: string) => void;
}

export default function CompareSplitView({ 
  lots, 
  selectedIds, 
  onClose,
  onRemoveLot 
}: CompareSplitViewProps) {
  const selectedLots = lots.filter(l => selectedIds.includes(l.id));

  if (selectedLots.length === 0) {
    return (
      <div className="fixed inset-0 z-[600] bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Selecciona lotes para comparar</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#A145F5] text-white rounded-lg hover:bg-[#8D32DF]"
          >
            Volver al Mapa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[600] bg-white overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              Comparación de Lotes
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Comparando {selectedLots.length} lote{selectedLots.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Cerrar comparación"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="max-w-7xl mx-auto p-4">
        <div className={`grid gap-6 ${
          selectedLots.length === 1 ? 'grid-cols-1' :
          selectedLots.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {selectedLots.map((lot, index) => (
            <div
              key={lot.id}
              className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
            >
              {/* Mini Map */}
              <div className="h-64 relative bg-slate-100">
                <MapContainerWrapper
                  lots={[lot]}
                  selectedLotId={lot.id}
                  onLotSelect={() => {}}
                  mapType="satellite"
                  preferCanvas={true}
                  showMeasurements={true}
                />
                
                {/* Badge de posición */}
                <div className="absolute top-2 left-2 bg-[#A145F5] text-white px-3 py-1 rounded-full text-sm font-bold">
                  #{index + 1}
                </div>

                {/* Botón remover */}
                <button
                  onClick={() => onRemoveLot(lot.id)}
                  className="absolute top-2 right-2 p-1.5 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full shadow-md transition-colors"
                  aria-label={`Remover ${lot.name} de la comparación`}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-lg font-bold text-slate-800 mb-1">
                  {lot.name}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Código: {lot.default_code}
                </p>

                {/* Comparison Table */}
                <div className="space-y-3">
                  <CompareRow
                    label="Área"
                    value={`${lot.x_area.toFixed(2)} m²`}
                    highlight={index === 0}
                  />
                  <CompareRow
                    label="Precio"
                    value={`S/ ${lot.list_price.toLocaleString('es-PE')}`}
                    highlight={false}
                  />
                  <CompareRow
                    label="Precio/m²"
                    value={`S/ ${(lot.list_price / lot.x_area).toFixed(2)}`}
                    highlight={false}
                  />
                  <CompareRow
                    label="Manzana"
                    value={lot.x_mz || 'N/A'}
                    highlight={false}
                  />
                  <CompareRow
                    label="Lote"
                    value={lot.x_lote || 'N/A'}
                    highlight={false}
                  />
                  <CompareRow
                    label="Etapa"
                    value={lot.x_etapa || 'N/A'}
                    highlight={false}
                  />
                  <CompareRow
                    label="Estado"
                    value={
                      <StatusBadge status={lot.x_statu} />
                    }
                    highlight={false}
                  />
                  {lot.measurements && (
                    <CompareRow
                      label="Perímetro"
                      value={`${lot.measurements.perimeter.toFixed(2)} m`}
                      highlight={false}
                    />
                  )}
                </div>

                {/* Mostrar mejor valor en algunas métricas */}
                {selectedLots.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <BestValueIndicators lot={lot} allLots={selectedLots} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary Table Below */}
        {selectedLots.length > 1 && (
          <div className="mt-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              Resumen Comparativo
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300">
                    <th className="text-left py-3 px-2 font-semibold text-slate-700">Métrica</th>
                    {selectedLots.map((lot, idx) => (
                      <th key={lot.id} className="text-center py-3 px-2 font-semibold text-slate-700">
                        Lote #{idx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-2 font-medium text-slate-600">Área Total</td>
                    {selectedLots.map(lot => (
                      <td key={lot.id} className="text-center py-3 px-2">
                        {lot.x_area.toFixed(2)} m²
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200 bg-white">
                    <td className="py-3 px-2 font-medium text-slate-600">Precio Total</td>
                    {selectedLots.map(lot => (
                      <td key={lot.id} className="text-center py-3 px-2">
                        S/ {lot.list_price.toLocaleString('es-PE')}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-2 font-medium text-slate-600">Precio por m²</td>
                    {selectedLots.map(lot => (
                      <td key={lot.id} className="text-center py-3 px-2">
                        S/ {(lot.list_price / lot.x_area).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function CompareRow({ 
  label, 
  value, 
  highlight 
}: { 
  label: string; 
  value: React.ReactNode; 
  highlight: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${
      highlight ? 'bg-blue-50' : 'bg-slate-50'
    }`}>
      <span className="text-sm font-medium text-slate-600">{label}:</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'libre': 'bg-emerald-100 text-emerald-700',
    'cotizacion': 'bg-yellow-100 text-yellow-700',
    'separado': 'bg-purple-100 text-purple-700',
    'reservado': 'bg-purple-100 text-purple-700',
    'vendido': 'bg-red-100 text-red-700',
  };

  const colorClass = colors[status.toLowerCase()] || 'bg-slate-100 text-slate-700';

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
      {status.toUpperCase()}
    </span>
  );
}

function BestValueIndicators({ lot, allLots }: { lot: Lot; allLots: Lot[] }) {
  const pricePerSqm = lot.list_price / lot.x_area;
  const bestPricePerSqm = Math.min(...allLots.map(l => l.list_price / l.x_area));
  const largestArea = Math.max(...allLots.map(l => l.x_area));
  const lowestPrice = Math.min(...allLots.map(l => l.list_price));

  const indicators = [];

  if (Math.abs(pricePerSqm - bestPricePerSqm) < 0.01) {
    indicators.push({ label: 'Mejor precio/m²', color: 'text-green-600' });
  }
  if (lot.x_area === largestArea) {
    indicators.push({ label: 'Mayor área', color: 'text-blue-600' });
  }
  if (lot.list_price === lowestPrice) {
    indicators.push({ label: 'Precio más bajo', color: 'text-purple-600' });
  }

  if (indicators.length === 0) return null;

  return (
    <div className="space-y-1">
      {indicators.map((indicator, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <Check size={14} className={indicator.color} />
          <span className={`font-semibold ${indicator.color}`}>
            {indicator.label}
          </span>
        </div>
      ))}
    </div>
  );
}

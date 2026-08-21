'use client';

import dynamic from 'next/dynamic';
import { Lot } from '@/app/data/lotsData';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { Proyecto } from '@/app/services/odooService';

const LeafletMap = dynamic(
    () => import('./LeafletMap'),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-zinc-900">
                <p className="animate-pulse text-zinc-500">Cargando mapa...</p>
            </div>
        )
    }
);

interface MapContainerProps {
    lots: Lot[];
    elementosUrbanos?: ElementoUrbano[];
    proyectos?: Proyecto[];
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    mapType: 'street' | 'satellite' | 'blank' | 'dark';
    userLocation?: [number, number] | null;
    preferCanvas?: boolean;
    showMeasurements?: boolean;
    onPhotoPointClick?: (elemento: ElementoUrbano) => void;
}

export default function MapContainerWrapper(props: MapContainerProps) {
    return <LeafletMap {...props} />;
}

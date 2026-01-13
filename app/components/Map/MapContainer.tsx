'use client';

import dynamic from 'next/dynamic';
import { Lot } from '@/app/data/lotsData';

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
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    mapType: 'street' | 'satellite' | 'blank';
}

export default function MapContainerWrapper(props: MapContainerProps) {
    return <LeafletMap {...props} />;
}

import Image from 'next/image';
import { Lot } from '@/app/data/lotsData';

interface LotCardProps {
    lot: Lot;
    onClick: (lot: Lot) => void;
}

export default function LotCard({ lot, onClick }: LotCardProps) {
    const statusColor = {
        available: 'bg-green-500',
        reserved: 'bg-yellow-500',
        sold: 'bg-red-500',
    };

    const statusLabel = {
        available: 'Disponible',
        reserved: 'Reservado',
        sold: 'Vendido'
    };

    return (
        <div
            className="group relative flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm transition-all hover:shadow-md cursor-pointer dark:border-zinc-800 dark:bg-zinc-950"
            onClick={() => onClick(lot)}
        >
            <div className="aspect-video w-full overflow-hidden relative bg-zinc-100 dark:bg-zinc-900">
                {lot.image ? (
                    <Image
                        src={lot.image}
                        alt={lot.name}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                        No Image
                    </div>
                )}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold text-white capitalize ${statusColor[lot.status]}`}>
                    {statusLabel[lot.status] || lot.status}
                </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
                <h3 className="text-lg font-semibold">{lot.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{lot.description || 'Sin descripción'}</p>
                <div className="mt-auto flex items-center justify-between text-sm">
                    <span className="font-medium">{lot.area} m²</span>
                    <span className="font-bold text-primary">${lot.price.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

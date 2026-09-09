'use client';

import { X } from 'lucide-react';
import { Lot } from '@/app/data/lotsData';
import LeadForm from '@/app/components/Public/LeadForm';

// Modelado en app/components/UI/LotCard.tsx (chico, ya seguro) — a
// propósito NO reusa LotDetailModal.tsx: ese muestra x_cliente (nombre real
// del comprador), acciones de staff, y abre los modales de reserva/pago.
// Acá solo se muestra código/área/precio/estado + el formulario de interés.
interface PublicLotPanelProps {
    lot: Lot;
    onClose: () => void;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
}

const STATUS_LABEL: Record<string, string> = {
    libre: 'Disponible',
    disponible: 'Disponible',
    cotizacion: 'En cotización',
    reservado: 'Reservado',
    separado: 'Reservado',
    vendido: 'Vendido',
};

function formatPrecio(lot: Lot): string | null {
    const estado = lot.x_statu?.toLowerCase();
    // Decisión del plan: en lotes vendidos/reservados no se muestra precio,
    // solo el estado (genera prueba social real sin exponer el monto).
    if (estado === 'vendido' || estado === 'reservado' || estado === 'separado') return null;
    if (!lot.list_price || lot.list_price <= 0) return 'Consulta con un asesor';
    return `S/ ${lot.list_price.toLocaleString()}`;
}

export default function PublicLotPanel({ lot, onClose, utmSource, utmMedium, utmCampaign }: PublicLotPanelProps) {
    const estado = lot.x_statu?.toLowerCase() || 'libre';
    const estadoLabel = STATUS_LABEL[estado] || estado;
    const precio = formatPrecio(lot);
    const esComprable = estado === 'libre' || estado === 'disponible';

    return (
        <div className="venta-lot-panel">
            <div className="venta-lot-panel-head">
                <div>
                    <h3>Lote {lot.x_mz}{lot.x_lote}</h3>
                    <p className="venta-lot-meta">{lot.x_area} m² · {estadoLabel}</p>
                    {precio && <p className="venta-lot-price">{precio}</p>}
                </div>
                <button onClick={onClose} aria-label="Cerrar" className="venta-lot-close">
                    <X size={20} />
                </button>
            </div>

            {esComprable ? (
                <>
                    <h4 className="venta-lot-form-heading">¡Sepáralo hoy mismo!</h4>
                    <LeadForm
                        lotId={Number(lot.id)}
                        lotCode={lot.default_code}
                        utmSource={utmSource}
                        utmMedium={utmMedium}
                        utmCampaign={utmCampaign}
                    />
                </>
            ) : (
                <p className="venta-lot-unavailable">
                    Este lote ya no está disponible. Mira otros lotes libres en el mapa, o escríbenos por
                    WhatsApp al <a href="tel:+51977684050">+51 977 684 050</a> para ver alternativas
                    similares.
                </p>
            )}
        </div>
    );
}

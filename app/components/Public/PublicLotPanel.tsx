'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Lot } from '@/app/data/lotsData';
import LeadForm from '@/app/components/Public/LeadForm';
import {
    OFERTA,
    AVISO_LEGAL_TITULO,
    detalleLegal,
    cuotaReferencial,
    formatSoles,
    refCampana,
    urlWhatsApp,
} from '@/app/venta/ofertaComercial';
import { trackMeta } from '@/app/venta/metaPixel';

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
    // Cuota referencial = (precio - cuota inicial) / 84, sin intereses (ver ofertaComercial.ts). Solo si el lote
    // tiene precio cargado; si no, el panel sigue diciendo "Consulta con un asesor" y no inventa una cuota.
    // En celular el formulario arranca plegado (el WhatsApp es la vía principal y el panel ya se había pedido más
    // bajo); en pantallas anchas arranca abierto. El panel solo se monta en el navegador (después de elegir un
    // lote), por eso se puede leer matchMedia en el estado inicial sin desajuste de hidratación.
    const [formAbierto, setFormAbierto] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(min-width: 641px)').matches,
    );
    const cuota = esComprable && lot.list_price > 0 ? cuotaReferencial(lot.list_price) : null;

    return (
        <div className="venta-lot-panel">
            <div className="venta-lot-panel-head">
                <div>
                    {/* Pedido del cliente: código, área, estado y precio en
                        una sola línea (antes 3 elementos apilados) — un
                        <h3> con <span> inline en vez de <p> separados, para
                        que siga siendo UN solo bloque de texto que envuelve
                        junto si el ancho no alcanza, no 3 líneas fijas. */}
                    <h3 className="venta-lot-title-line">
                        Lote {lot.x_mz}{lot.x_lote}
                        <span className="venta-lot-meta-inline">
                            ({lot.x_area} m² · {estadoLabel})
                        </span>
                        {precio && <span className="venta-lot-price-inline">{precio}</span>}
                    </h3>
                </div>
                <button onClick={onClose} aria-label="Cerrar" className="venta-lot-close">
                    <X size={20} />
                </button>
            </div>

            {esComprable ? (
                <>
                    {cuota !== null && (
                        <p className="venta-lot-financing">
                            Inicial <strong>{formatSoles(OFERTA.cuotaInicial)}</strong> + {OFERTA.nroCuotas} cuotas de{' '}
                            <strong>{formatSoles(cuota)}</strong>
                            <small> · referencial, la confirma un asesor</small>
                        </p>
                    )}
                    <a
                        href={urlWhatsApp({
                            codigoLote: lot.default_code,
                            area: lot.x_area,
                            precio: lot.list_price,
                            ref: refCampana(utmCampaign, utmSource),
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="venta-lot-whatsapp"
                        onClick={() =>
                            trackMeta('Contact', {
                                content_name: 'whatsapp_lote',
                                content_ids: [lot.default_code],
                                content_type: 'product',
                            })
                        }
                    >
                        Separar este lote por WhatsApp
                    </a>
                    <details
                        className="venta-lead-details"
                        open={formAbierto}
                        onToggle={(e) => setFormAbierto((e.currentTarget as HTMLDetailsElement).open)}
                    >
                        <summary className="venta-lead-summary">O déjanos tus datos y te llamamos</summary>
                        <LeadForm
                            lotId={Number(lot.id)}
                            lotCode={lot.default_code}
                            lotPrice={lot.list_price}
                            utmSource={utmSource}
                            utmMedium={utmMedium}
                            utmCampaign={utmCampaign}
                        />
                    </details>
                    <p className="venta-legal venta-legal--panel">
                        <strong>{AVISO_LEGAL_TITULO}</strong> {detalleLegal()}
                    </p>
                </>
            ) : (
                <p className="venta-lot-unavailable">
                    Este lote ya no está disponible. Mira otros lotes libres en el mapa, o escríbenos por
                    WhatsApp al <a href="tel:+51977684050">{OFERTA.whatsappVisible}</a> para ver alternativas
                    similares.
                </p>
            )}
        </div>
    );
}

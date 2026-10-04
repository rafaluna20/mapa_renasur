'use client';

import { OFERTA, FRASE_HABILITACION, AVISO_LEGAL_TITULO, detalleLegal, formatSoles, refCampana, urlWhatsApp } from '@/app/venta/ofertaComercial';
import { trackMeta } from '@/app/venta/metaPixel';

// Dirección "clara" (lavanda/blanco + rosa + navy + morado) — pedida por el cliente: badge en píldora con
// punto de estado, titular grande con una palabra en acento, CTA doble (primario + WhatsApp), chips de
// estadísticas.
//
// Alineada con los anuncios de Facebook (2026-10-03): todo lo que prometen los anuncios (cuota inicial,
// 84 cuotas, servicios, distancia a la playa) se ve aquí con los mismos números (app/venta/ofertaComercial.ts),
// y la situación legal se dice de frente: habilitación urbana APROBADA. Antes había aquí un
// "100% Título saneado" escrito a mano; no se debe volver a poner sin documentos que lo respalden.
interface HeroSectionProps {
    lotesDisponibles: number;
    lotesVendidos: number;
    precioDesde: number | null;
    utmSource?: string;
    utmCampaign?: string;
}

export default function HeroSection({ lotesDisponibles, lotesVendidos, precioDesde, utmSource, utmCampaign }: HeroSectionProps) {
    const scrollToMap = () => {
        document.getElementById('mapa-lotes')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section className="venta-hero">
            <div className="venta-hero-inner">
                <span className="venta-stamp">
                    <span className="venta-dot venta-dot--green" />
                    Panamericana Sur Km 55 · Pucusana
                </span>

                <h1>
                    Tu terreno propio,
                    <br />
                    en <span className="accent">Pucusana</span>
                </h1>

                {precioDesde !== null && (
                    <div className="venta-price-line">
                        <small>desde</small>
                        <big>{formatSoles(precioDesde)}</big>
                    </div>
                )}

                <p className="venta-sub">
                    Cuota inicial de {formatSoles(OFERTA.cuotaInicial)} y financiamiento directo a {OFERTA.nroCuotas} cuotas, sin
                    bancos ni intermediarios. Elige tu lote en el mapa real del proyecto.
                </p>

                <div className="venta-cta-row">
                    <button onClick={scrollToMap} className="venta-cta">
                        Ver lotes disponibles →
                    </button>
                    <a
                        href={urlWhatsApp({ ref: refCampana(utmCampaign, utmSource) })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="venta-cta-whatsapp"
                        onClick={() => trackMeta('Contact', { content_name: 'whatsapp_hero' })}
                    >
                        Escríbenos por WhatsApp
                    </a>
                </div>

                <ul className="venta-chips" aria-label="Qué incluye">
                    <li className="venta-chip--destacado">{FRASE_HABILITACION}</li>
                    <li>Se entregan con {OFERTA.servicios}</li>
                    <li>A {OFERTA.distanciaPlayaKm} km de la playa</li>
                </ul>

                <div className="venta-stats">
                    <div className="venta-stat">
                        <strong>{lotesDisponibles}</strong>
                        <span>Lotes disponibles</span>
                    </div>
                    <div className="venta-stat">
                        <strong>{lotesVendidos}</strong>
                        <span>Lotes vendidos</span>
                    </div>
                    <div className="venta-stat">
                        <strong>{OFERTA.nroCuotas}</strong>
                        <span>Cuotas mensuales</span>
                    </div>
                    <div className="venta-stat">
                        <strong>{OFERTA.distanciaPlayaKm} km</strong>
                        <span>De la playa</span>
                    </div>
                </div>

                <p className="venta-legal">
                    <strong>{AVISO_LEGAL_TITULO}</strong> {detalleLegal()}
                </p>
            </div>
        </section>
    );
}

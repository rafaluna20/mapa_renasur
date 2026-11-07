'use client';

import { OFERTA_LEGADA, type OfertaProyecto, tituloAvisoLegal, detalleLegal, formatSoles, refCampana, urlWhatsApp } from '@/app/venta/ofertaComercial';
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
    /** Oferta del proyecto que se muestra (P5). Sin ella, la de siempre. */
    oferta?: OfertaProyecto;
}

export default function HeroSection({ lotesDisponibles, lotesVendidos, precioDesde, utmSource, utmCampaign, oferta = OFERTA_LEGADA }: HeroSectionProps) {
    const avisoLegal = tituloAvisoLegal(oferta);
    const financiamiento = oferta.cuotaInicial !== null && oferta.nroCuotas !== null;
    const scrollToMap = () => {
        document.getElementById('mapa-lotes')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section className="venta-hero">
            <div className="venta-hero-inner">
                <span className="venta-stamp">
                    <span className="venta-dot venta-dot--green" />
                    {[oferta.direccionReferencia, oferta.lugar].filter(Boolean).join(' · ')}
                </span>

                <h1>
                    Tu terreno propio,
                    <br />
                    en <span className="accent">{oferta.lugar || oferta.nombre}</span>
                </h1>

                {precioDesde !== null && (
                    <div className="venta-price-line">
                        <small>desde</small>
                        <big>{formatSoles(precioDesde)}</big>
                    </div>
                )}

                <p className="venta-sub">
                    {financiamiento && (
                        <>
                            Cuota inicial de {formatSoles(oferta.cuotaInicial!)} y financiamiento directo a {oferta.nroCuotas} cuotas, sin
                            bancos ni intermediarios.{' '}
                        </>
                    )}
                    Elige tu lote en el mapa real del proyecto.
                </p>

                <div className="venta-cta-row">
                    <button onClick={scrollToMap} className="venta-cta">
                        Ver lotes disponibles →
                    </button>
                    <a
                        href={urlWhatsApp({ ref: refCampana(utmCampaign, utmSource), oferta })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="venta-cta-whatsapp"
                        onClick={() => trackMeta('Contact', { content_name: 'whatsapp_hero' })}
                    >
                        Escríbenos por WhatsApp
                    </a>
                </div>

                <ul className="venta-chips" aria-label="Qué incluye">
                    {oferta.fraseHabilitacion && <li className="venta-chip--destacado">{oferta.fraseHabilitacion}</li>}
                    {oferta.servicios && <li>Se entregan con {oferta.servicios}</li>}
                    {oferta.distanciaKm !== null && oferta.referenciaNombre && (
                        <li>A {oferta.distanciaKm} km de {oferta.referenciaNombre}</li>
                    )}
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
                    {oferta.nroCuotas !== null && (
                        <div className="venta-stat">
                            <strong>{oferta.nroCuotas}</strong>
                            <span>Cuotas mensuales</span>
                        </div>
                    )}
                    {oferta.distanciaKm !== null && oferta.referenciaNombre && (
                        <div className="venta-stat">
                            <strong>{oferta.distanciaKm} km</strong>
                            <span>De {oferta.referenciaNombre}</span>
                        </div>
                    )}
                </div>

                {avisoLegal && (
                    <p className="venta-legal">
                        <strong>{avisoLegal}</strong> {detalleLegal(oferta.resolucionMunicipal)}
                    </p>
                )}
            </div>
        </section>
    );
}

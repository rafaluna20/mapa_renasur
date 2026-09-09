'use client';

// Dirección "moderna" (navy/negro + naranja) — pedida por el cliente a
// partir de una referencia visual (template de portfolio "Helen"): badge en
// píldora con punto de estado, titular grande con una palabra en acento,
// CTA doble (primario + WhatsApp), chips de estadísticas. Reemplaza la
// dirección anterior ("Mercado", afiche chicha).
interface HeroSectionProps {
    totalLotes: number;
    lotesVendidos: number;
    precioDesde: number | null;
}

// Total real de lotes del proyecto según el plano maestro — dato de negocio
// dado por el cliente (2026-09-09), NO verificable contra Odoo: hoy Odoo
// solo tiene 536 lotes activos cargados para Terra Lima (faltan por
// digitalizar/crear los demás, ver skill auditoria-areas-renasur). A
// diferencia de los otros 3 números de esta fila (todos calculados en vivo),
// este queda fijo hasta que alguien lo actualice acá a mano.
const TOTAL_LOTES_PROYECTO = 1345;

export default function HeroSection({ totalLotes, lotesVendidos, precioDesde }: HeroSectionProps) {
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
                        <big>S/ {precioDesde.toLocaleString()}</big>
                    </div>
                )}

                <p className="venta-sub">
                    Financiamiento directo a 84 cuotas, sin bancos ni intermediarios. Elige tu lote en
                    el mapa real del proyecto.
                </p>

                <div className="venta-cta-row">
                    <button onClick={scrollToMap} className="venta-cta">
                        Ver lotes disponibles →
                    </button>
                    <a
                        href="https://wa.me/51977684050"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="venta-cta-whatsapp"
                    >
                        Escríbenos por WhatsApp
                    </a>
                </div>

                <div className="venta-stats">
                    <div className="venta-stat">
                        <strong>{TOTAL_LOTES_PROYECTO.toLocaleString()}</strong>
                        <span>Total de lotes</span>
                    </div>
                    <div className="venta-stat">
                        <strong>{totalLotes}+</strong>
                        <span>Lotes mapeados</span>
                    </div>
                    <div className="venta-stat">
                        <strong>{lotesVendidos}</strong>
                        <span>Lotes vendidos</span>
                    </div>
                    <div className="venta-stat">
                        <strong>100%</strong>
                        <span>Título saneado</span>
                    </div>
                </div>
            </div>
        </section>
    );
}

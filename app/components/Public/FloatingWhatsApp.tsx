'use client';

// Ícono flotante de WhatsApp, fijo en la esquina inferior derecha. Se oculta
// (no solo se tapa) mientras hay un lote seleccionado — PublicLotPanel ya
// ocupa esa misma esquina en desktop (right/bottom:1.5rem) y todo el ancho
// inferior en móvil, así que mostrar ambos a la vez sería una colisión
// visual real, además de un segundo canal de contacto compitiendo con el
// formulario que el visitante ya está llenando. Mismo criterio que ya usa
// LotPointerHint (`active={!selectedLotId}`).
//
// A propósito NO tiene una animación de pulso infinito (el patrón genérico
// de plugins de WhatsApp) — solo una entrada suave una vez al aparecer;
// un ícono parpadeando todo el tiempo cansa a los pocos segundos.
interface FloatingWhatsAppProps {
    active: boolean;
}

const WHATSAPP_NUMBER = '51977684050';
const WHATSAPP_MESSAGE = 'Hola, quiero más información sobre los lotes de Terra Lima en Pucusana.';

export default function FloatingWhatsApp({ active }: FloatingWhatsAppProps) {
    if (!active) return null;

    return (
        <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="venta-whatsapp-float"
            aria-label="Escríbenos por WhatsApp"
        >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12.01 2C6.48 2 2 6.48 2 12.01c0 1.98.58 3.83 1.58 5.39L2 22l4.75-1.55a9.96 9.96 0 0 0 5.26 1.49h.01c5.52 0 10-4.48 10-10.01C22 6.48 17.53 2 12.01 2zm5.85 14.17c-.25.7-1.24 1.28-2.02 1.45-.54.11-1.24.2-3.6-.77-3.02-1.25-4.96-4.31-5.11-4.51-.15-.2-1.22-1.62-1.22-3.09s.75-2.19 1.02-2.49c.27-.3.58-.37.78-.37.19 0 .39 0 .56.01.18.01.42-.07.65.5.25.61.85 2.1.92 2.25.07.15.12.33.02.53-.1.2-.15.32-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.35 1.44.3.15.48.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.24.66-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.08.13.08.75-.17 1.45z" />
            </svg>
        </a>
    );
}

/**
 * Tokens de diseño compartidos.
 *
 * Centraliza valores de sombra/acento que se fueron ajustando a mano y
 * sueltos por el código en varias iteraciones de esta sesión (modal de
 * detalle de lote, leyenda del mapa, barra de controles, tarjetas de la
 * cotización) — antes cada lugar tenía su propio valor arbitrario de
 * Tailwind copiado y pegado, así que un ajuste ("más sombra") solo
 * terminaba aplicado en el lugar donde se pidió, no en los demás que
 * debían verse iguales. Importar desde acá en vez de escribir el valor
 * de nuevo.
 */

// Sombra "flotante" (2 capas: cercana + difusa) — mismo valor para
// cualquier tarjeta/panel que deba verse "elevada" sobre el mapa
// (modal de detalle, leyenda, barra de iconos, botón de ubicación).
export const SHADOW_FLOATING = 'shadow-[0_6px_16px_rgb(0,0,0,0.25),0_40px_90px_rgb(0,0,0,0.55)]';

// Borde suave que no compite con el efecto de "flotar" (a diferencia de
// un borde sólido tipo slate-200/300, que hace ver la tarjeta "recortada"
// en vez de elevada).
export const BORDER_FLOATING = 'border border-slate-100';

/**
 * Colores de acento para tarjetas de agrupación (ver página de
 * cotización): fondo blanco + barra de acento a la izquierda + título en
 * mayúsculas del mismo color — patrón de dashboards financieros en vez
 * de rellenar toda la tarjeta con un tono plano saturado.
 */
export const ACCENT_CARDS = {
    neutral: {
        border: 'border-l-slate-400',
        text: 'text-slate-500',
    },
    success: {
        border: 'border-l-emerald-500',
        text: 'text-emerald-700',
    },
    info: {
        border: 'border-l-blue-500',
        text: 'text-blue-700',
    },
} as const;

// Clase base común a las 3 tarjetas de acento (fondo blanco + borde
// sutil + barra izquierda de 4px) — combinar con ACCENT_CARDS[x].border.
export const ACCENT_CARD_BASE = 'bg-white border border-slate-200 border-l-4 rounded-xl p-4';

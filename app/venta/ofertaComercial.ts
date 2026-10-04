/**
 * Datos comerciales de /venta en UN solo lugar, para que la landing, el panel del lote, los mensajes de
 * WhatsApp y la vista previa del enlace digan siempre lo mismo que los anuncios de Facebook.
 *
 * Valores dados por la gerencia (2026-10-03). Si cambian, se cambian SOLO aquí:
 *   - cuota inicial S/ 18,000
 *   - 84 cuotas, financiamiento directo (en Odoo, los 254 contratos vigentes tienen 0% de interés anual,
 *     por eso la cuota referencial es (precio - inicial) / 84; confirmar con gerencia que aplica a ventas nuevas)
 *   - habilitación urbana APROBADA con resolución municipal (la gerencia lo confirmó el 2026-10-03; antes había
 *     informado "en proceso": tener a mano el número de resolución). Eso NO equivale a que cada lote tenga el título
 *     de propiedad saneado: no decir "título saneado" salvo que cada lote lo esté y haya documentos
 *   - los terrenos se entregan con agua, luz, desagüe, pistas y veredas
 *   - 4.5 km hasta la playa
 */
export const OFERTA = {
    cuotaInicial: 18000,
    nroCuotas: 84,
    whatsappNumero: '51977684050',
    whatsappVisible: '+51 977 684 050',
    distanciaPlayaKm: 4.5,
    servicios: 'agua, luz, desagüe, pistas y veredas',
} as const;

// Confirmado por la gerencia (2026-10-03): la habilitación urbana está APROBADA con resolución de la municipalidad.
// Si la situación cambia, se cambia SOLO aquí. Cuando se tenga el número de resolución, ponerlo en
// RESOLUCION_MUNICIPAL (p. ej. 'N° 123-2026-MDP'): la página lo mostrará junto al aviso.
export const FRASE_HABILITACION = 'Lotes con habilitación urbana aprobada';
export const RESOLUCION_MUNICIPAL: string | null = null;
export const AVISO_LEGAL_TITULO = `${FRASE_HABILITACION}.`;
export const AVISO_LEGAL_DETALLE = 'Pide los documentos a nuestro equipo antes de separar tu lote.';

/** Texto que acompaña a la frase: con el número de resolución si ya está cargado. */
export function detalleLegal(resolucion: string | null = RESOLUCION_MUNICIPAL): string {
    return resolucion ? `Resolución municipal ${resolucion}. ${AVISO_LEGAL_DETALLE}` : AVISO_LEGAL_DETALLE;
}

/** "S/ 97,920". Formato fijo (en-US) para que servidor y navegador rendericen exactamente lo mismo. */
export function formatSoles(valor: number): string {
    return `S/ ${Math.round(valor).toLocaleString('en-US')}`;
}

/**
 * Cuota mensual referencial = (precio - cuota inicial) / nro de cuotas, sin intereses.
 * null si el precio no es un número válido o no supera la cuota inicial (no hay nada que financiar).
 */
export function cuotaReferencial(
    precio: number,
    inicial: number = OFERTA.cuotaInicial,
    nroCuotas: number = OFERTA.nroCuotas,
): number | null {
    if (!Number.isFinite(precio) || !Number.isFinite(inicial) || nroCuotas <= 0) return null;
    if (precio <= inicial) return null;
    return (precio - inicial) / nroCuotas;
}

/**
 * Etiqueta de campaña apta para ir dentro de un mensaje de WhatsApp: solo [a-z0-9_-], máx. 40 caracteres.
 * Lo que venga de la URL nunca se copia tal cual (utm_campaign lo controla quien arma el enlace).
 */
export function refCampana(utmCampaign?: string | null, utmSource?: string | null): string | null {
    const crudo = (utmCampaign || utmSource || '').trim().toLowerCase();
    const limpio = crudo.replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    return limpio || null;
}

export interface MensajeWhatsAppArgs {
    codigoLote?: string | null;
    area?: number | null;
    precio?: number | null;
    ref?: string | null;
}

export function mensajeWhatsApp({ codigoLote, area, precio, ref }: MensajeWhatsAppArgs = {}): string {
    let msg: string;
    if (codigoLote) {
        const partes = [`Hola, quiero separar el lote ${codigoLote}`];
        if (area && area > 0) partes.push(` (${area} m²)`);
        if (precio && precio > 0) partes.push(`, precio ${formatSoles(precio)}`);
        partes.push(' de Terra Lima en Pucusana.');
        msg = partes.join('');
    } else {
        msg = 'Hola, quiero más información sobre los lotes de Terra Lima en Pucusana.';
    }
    return ref ? `${msg} (ref: ${ref})` : msg;
}

export function urlWhatsApp(args: MensajeWhatsAppArgs = {}): string {
    return `https://wa.me/${OFERTA.whatsappNumero}?text=${encodeURIComponent(mensajeWhatsApp(args))}`;
}

import type { Proyecto } from '@/app/services/odooService';

/**
 * Datos comerciales de /venta en UN solo lugar, para que la landing, el panel del lote, los mensajes de
 * WhatsApp y la vista previa del enlace digan siempre lo mismo que los anuncios de Facebook.
 *
 * Valores dados por la gerencia (2026-10-03). Si cambian, se cambian SOLO aquí:
 *   - cuota inicial S/ 18,500 (la gerencia la subió desde S/ 18,000 el 2026-10-14)
 *   - 84 cuotas, financiamiento directo (en Odoo, los 254 contratos vigentes tienen 0% de interés anual,
 *     por eso la cuota referencial es (precio - inicial) / 84; confirmar con gerencia que aplica a ventas nuevas)
 *   - habilitación urbana APROBADA con resolución municipal (la gerencia lo confirmó el 2026-10-03; antes había
 *     informado "en proceso": tener a mano el número de resolución). Eso NO equivale a que cada lote tenga el título
 *     de propiedad saneado: no decir "título saneado" salvo que cada lote lo esté y haya documentos
 *   - los terrenos se entregan con agua, luz, desagüe, pistas y veredas
 *   - 4.5 km hasta la playa
 */
export const OFERTA = {
    cuotaInicial: 18500,
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

// ---------------------------------------------------------------------------------------------------------------------
// P5 multiproyecto: la oferta de CADA proyecto vive en Odoo (campos de `proyecto.inmobiliario`, módulo
// proyecto_inmobiliario >= 1.10.0). Las constantes de arriba quedan como la oferta «legada»: lo que se usa mientras Odoo no
// tenga los campos nuevos (así desplegar la app antes que Odoo no cambia nada) o cuando no hay proyecto.
// Un proyecto SIN un dato simplemente no lo muestra: nunca se «toma prestado» el de Terra Lima (salvo la línea de
// WhatsApp, que es la de la empresa).
// ---------------------------------------------------------------------------------------------------------------------
export interface OfertaProyecto {
    nombre: string;
    lugar: string;
    direccionReferencia: string | null;
    cuotaInicial: number | null;
    nroCuotas: number | null;
    whatsappNumero: string;
    whatsappVisible: string;
    distanciaKm: number | null;
    referenciaNombre: string | null;
    servicios: string | null;
    fraseHabilitacion: string | null;
    resolucionMunicipal: string | null;
}

export const OFERTA_LEGADA: OfertaProyecto = {
    nombre: 'Terra Lima',
    lugar: 'Pucusana',
    direccionReferencia: 'Panamericana Sur Km 55',
    cuotaInicial: OFERTA.cuotaInicial,
    nroCuotas: OFERTA.nroCuotas,
    whatsappNumero: OFERTA.whatsappNumero,
    whatsappVisible: OFERTA.whatsappVisible,
    distanciaKm: OFERTA.distanciaPlayaKm,
    referenciaNombre: 'la playa',
    servicios: OFERTA.servicios,
    fraseHabilitacion: FRASE_HABILITACION,
    resolucionMunicipal: RESOLUCION_MUNICIPAL,
};

/** La oferta del proyecto. Sin proyecto, o con un Odoo que aún no trae los campos de oferta: la de siempre. */
export function ofertaDeProyecto(proyecto?: Proyecto | null): OfertaProyecto {
    if (!proyecto || !proyecto.oferta) return OFERTA_LEGADA;
    const o = proyecto.oferta;
    const numero = o.whatsappNumero ?? OFERTA.whatsappNumero; // línea comercial de la empresa si el proyecto no tiene la suya
    return {
        nombre: proyecto.urbanizacion || proyecto.nombre,
        lugar: proyecto.distrito,
        direccionReferencia: o.direccionReferencia,
        cuotaInicial: o.cuotaInicial,
        nroCuotas: o.nroCuotas,
        whatsappNumero: numero,
        whatsappVisible: o.whatsappVisible ?? (o.whatsappNumero ? `+${o.whatsappNumero}` : OFERTA.whatsappVisible),
        distanciaKm: o.distanciaReferenciaKm,
        referenciaNombre: o.referenciaNombre,
        servicios: o.servicios,
        fraseHabilitacion: o.fraseHabilitacion,
        resolucionMunicipal: o.resolucionMunicipal,
    };
}

/** Título del aviso legal con su punto final; null si el proyecto no tiene frase de habilitación cargada. */
export function tituloAvisoLegal(oferta: OfertaProyecto = OFERTA_LEGADA): string | null {
    return oferta.fraseHabilitacion ? `${oferta.fraseHabilitacion}.` : null;
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
    /** Oferta del proyecto (nombre, lugar y número). Sin ella, la de siempre (Terra Lima). */
    oferta?: OfertaProyecto;
}

export function mensajeWhatsApp({ codigoLote, area, precio, ref, oferta = OFERTA_LEGADA }: MensajeWhatsAppArgs = {}): string {
    const donde = `${oferta.nombre}${oferta.lugar ? ` en ${oferta.lugar}` : ''}`;
    let msg: string;
    if (codigoLote) {
        const partes = [`Hola, quiero separar el lote ${codigoLote}`];
        if (area && area > 0) partes.push(` (${area} m²)`);
        if (precio && precio > 0) partes.push(`, precio ${formatSoles(precio)}`);
        partes.push(` de ${donde}.`);
        msg = partes.join('');
    } else {
        msg = `Hola, quiero más información sobre los lotes de ${donde}.`;
    }
    return ref ? `${msg} (ref: ${ref})` : msg;
}

export function urlWhatsApp(args: MensajeWhatsAppArgs = {}): string {
    const numero = (args.oferta ?? OFERTA_LEGADA).whatsappNumero;
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsApp(args))}`;
}

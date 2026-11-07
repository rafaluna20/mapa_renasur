import type { Metadata } from 'next';
import { partesDeCodigo } from '@/app/utils/escenaLote';
import { OFERTA_LEGADA, type OfertaProyecto, tituloAvisoLegal, formatSoles } from '@/app/venta/ofertaComercial';

/**
 * Título, descripción e imagen con los que se ve el enlace de /venta cuando se pega en Telegram, WhatsApp, etc.
 * El layout raíz trae openGraph de la app interna ("Sistema GIS de gestión de lotes", sin imagen) y un
 * openGraph en una página hija REEMPLAZA al del padre entero, así que /venta lo define completo aquí.
 *
 * Con ?lote=<código válido> la vista previa muestra ESE lote (la imagen que genera /api/public/lote-imagen);
 * sin lote, o con un código que no tiene formato de lote, cae a la foto del ingreso. El código se valida con
 * partesDeCodigo: lo que no calza nunca se copia a los textos.
 */
export const SITE_URL_POR_DEFECTO = 'https://mapa-renasur.vercel.app';

// Mismos datos que los anuncios (ver ofertaComercial.ts), ahora POR PROYECTO (P5). La vista previa del enlace no debe
// prometer más que la página: la frase de habilitación sale solo si el proyecto la tiene cargada.
function textos(oferta: OfertaProyecto) {
    const donde = oferta.lugar ? `${oferta.nombre}, ${oferta.lugar}` : oferta.nombre;
    const financiamiento =
        oferta.cuotaInicial !== null && oferta.nroCuotas !== null
            ? `Cuota inicial de ${formatSoles(oferta.cuotaInicial)} y financiamiento directo en ${oferta.nroCuotas} cuotas, sin bancos.`
            : '';
    const complemento = [financiamiento, tituloAvisoLegal(oferta) ?? ''].filter(Boolean).join(' ');
    const ubicacion = [oferta.nombre, oferta.direccionReferencia, oferta.lugar].filter(Boolean).join(', ');
    return {
        donde,
        complemento,
        titulo: `${oferta.nombre} — Lotes en venta${oferta.lugar ? ` en ${oferta.lugar}` : ''}`,
        descripcion: `Lotes disponibles en ${ubicacion}.${complemento ? ` ${complemento}` : ''}`,
        ubicacion,
    };
}

/**
 * `sinImagen`: para los enlaces que manda el bot de ventas (utm_source=asistente-virtual). El bot ya envía la imagen
 * del lote como adjunto, y Telegram arma además su propia vista previa con la og:image: el cliente veía el mapa
 * DOS veces. Sin og:image la vista previa queda solo con título y descripción. Solo aplica con un lote válido.
 */
export function construirMetadataVenta(
    lote?: string | null,
    base: string = SITE_URL_POR_DEFECTO,
    opciones: { sinImagen?: boolean } = {},
    oferta: OfertaProyecto = OFERTA_LEGADA,
): Metadata {
    const t = textos(oferta);
    const origen = base.replace(/\/+$/, '');
    const codigo = String(lote ?? '').trim().toUpperCase();
    const partes = codigo ? partesDeCodigo(codigo) : null;
    const sinImagen = !!opciones.sinImagen && !!partes;

    const titulo = partes ? `Mz ${partes.manzana} · Lote ${partes.lote} — ${t.donde}` : t.titulo;
    const descripcion = partes
        ? `Mira dónde queda el lote ${partes.lote} de la manzana ${partes.manzana} en ${t.ubicacion}.${t.complemento ? ` ${t.complemento}` : ''}`
        : t.descripcion;
    const imagen = partes
        ? { url: `${origen}/api/public/lote-imagen?codigo=${encodeURIComponent(codigo)}`, width: 1000, height: 1000, alt: `Ubicación del lote ${partes.lote}, manzana ${partes.manzana}` }
        : { url: `${origen}/venta-hero-portada.jpg`, width: 640, height: 386, alt: `Ingreso a ${t.donde}` };

    return {
        metadataBase: new URL(origen),
        title: titulo,
        description: descripcion,
        openGraph: {
            type: 'website',
            siteName: oferta.nombre,
            locale: 'es_PE',
            title: titulo,
            description: descripcion,
            url: partes ? `${origen}/venta?lote=${encodeURIComponent(codigo)}` : `${origen}/venta`,
            ...(sinImagen ? {} : { images: [imagen] }),
        },
        twitter: {
            card: partes ? 'summary' : 'summary_large_image',
            title: titulo,
            description: descripcion,
            ...(sinImagen ? {} : { images: [imagen.url] }),
        },
    };
}

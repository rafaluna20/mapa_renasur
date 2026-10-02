import type { Metadata } from 'next';
import { partesDeCodigo } from '@/app/utils/escenaLote';

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

const TITULO_GENERAL = 'Terra Lima — Lotes en venta en Pucusana';
const DESCRIPCION_GENERAL = 'Lotes disponibles en Terra Lima, Panamericana Sur Km 55, Pucusana. Financiamiento directo, sin bancos.';

export function construirMetadataVenta(lote?: string | null, base: string = SITE_URL_POR_DEFECTO): Metadata {
    const origen = base.replace(/\/+$/, '');
    const codigo = String(lote ?? '').trim().toUpperCase();
    const partes = codigo ? partesDeCodigo(codigo) : null;

    const titulo = partes ? `Mz ${partes.manzana} · Lote ${partes.lote} — Terra Lima, Pucusana` : TITULO_GENERAL;
    const descripcion = partes
        ? `Mira dónde queda el lote ${partes.lote} de la manzana ${partes.manzana} en Terra Lima, Panamericana Sur Km 55, Pucusana. Financiamiento directo, sin bancos.`
        : DESCRIPCION_GENERAL;
    const imagen = partes
        ? { url: `${origen}/api/public/lote-imagen?codigo=${encodeURIComponent(codigo)}`, width: 1000, height: 1000, alt: `Ubicación del lote ${partes.lote}, manzana ${partes.manzana}` }
        : { url: `${origen}/venta-hero-portada.jpg`, width: 640, height: 386, alt: 'Ingreso a Terra Lima, Pucusana' };

    return {
        metadataBase: new URL(origen),
        title: titulo,
        description: descripcion,
        openGraph: {
            type: 'website',
            siteName: 'Terra Lima',
            locale: 'es_PE',
            title: titulo,
            description: descripcion,
            url: partes ? `${origen}/venta?lote=${encodeURIComponent(codigo)}` : `${origen}/venta`,
            images: [imagen],
        },
        twitter: {
            card: partes ? 'summary' : 'summary_large_image',
            title: titulo,
            description: descripcion,
            images: [imagen.url],
        },
    };
}

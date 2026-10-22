/**
 * Plazo de separación de lotes (módulo Odoo simple_recurring_contract v3.20+).
 *
 * Lógica pura y sin dependencias de React/Odoo, compartida entre el servidor
 * (app/lib/separaciones.ts, que arma la consulta masiva) y el cliente (tarjeta,
 * ficha, filtros y color del mapa). Solo la usa el mapa de staff: /venta
 * (público) nunca recibe estos datos.
 */

export type SeparacionEstado = 'vigente' | 'por_vencer' | 'vencida' | 'contratada';

export interface SeparacionInfo {
    orderId: number;
    orderName: string;
    vendedor: string | null;
    /** Fecha (Lima, YYYY-MM-DD) en que el vendedor registró la separación. */
    inicio: string;
    /** Fecha límite (YYYY-MM-DD) para tener contrato vigente. */
    limite: string;
    extensiones: number;
    estado: SeparacionEstado;
    /** Negativo = días de atraso. */
    diasRestantes: number;
    /** Días transcurridos desde que se separó. */
    diasSeparado: number;
    /** Más de una orden confirmada para el mismo lote (doble reserva). */
    ordenesActivas: number;
}

/** Valores del selector de estado que se resuelven con la separación, no con x_statu. */
export type FiltroSeparacion = 'sep_vigente' | 'sep_por_vencer' | 'sep_vencida' | 'sep_admin';

export const DIAS_POR_VENCER = 3;

export const FILTROS_SEPARACION: { value: FiltroSeparacion; label: string }[] = [
    { value: 'sep_vigente', label: 'Separación vigente' },
    { value: 'sep_por_vencer', label: 'Separación por vencer' },
    { value: 'sep_vencida', label: 'Separación vencida' },
    { value: 'sep_admin', label: 'Reserva administrativa' },
];

const MS_DIA = 86_400_000;

/** Fecha de hoy en Lima (YYYY-MM-DD): igual a la que usa Odoo para el vencimiento. */
export function hoyLima(ahora: Date = new Date()): string {
    return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

/** 'YYYY-MM-DD HH:MM:SS' (UTC, como lo guarda Odoo) → fecha de Lima 'YYYY-MM-DD'. */
export function fechaLimaDeOdoo(valor: string): string {
    const utc = new Date(valor.replace(' ', 'T') + 'Z');
    return Number.isNaN(utc.getTime()) ? valor.slice(0, 10) : hoyLima(utc);
}

/** Días enteros de `desde` a `hasta` (ambas YYYY-MM-DD). */
export function diasEntre(desde: string, hasta: string): number {
    const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
    const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
    return Math.round((b - a) / MS_DIA);
}

export function calcularEstado(diasRestantes: number, tieneContrato: boolean): SeparacionEstado {
    if (tieneContrato) return 'contratada';
    if (diasRestantes < 0) return 'vencida';
    if (diasRestantes <= DIAS_POR_VENCER) return 'por_vencer';
    return 'vigente';
}

export function armarSeparacion(args: {
    orderId: number;
    orderName: string;
    vendedor: string | null;
    inicio: string; // fecha Lima
    limite: string;
    extensiones: number;
    tieneContrato: boolean;
    ordenesActivas?: number;
    hoy?: string;
}): SeparacionInfo {
    const hoy = args.hoy ?? hoyLima();
    const diasRestantes = diasEntre(hoy, args.limite);
    return {
        orderId: args.orderId,
        orderName: args.orderName,
        vendedor: args.vendedor,
        inicio: args.inicio,
        limite: args.limite,
        extensiones: args.extensiones,
        estado: calcularEstado(diasRestantes, args.tieneContrato),
        diasRestantes,
        diasSeparado: Math.max(0, diasEntre(args.inicio, hoy)),
        ordenesActivas: args.ordenesActivas ?? 1,
    };
}

/** Texto corto para la tarjeta del lote. */
export function etiquetaSeparacion(s: SeparacionInfo): string {
    switch (s.estado) {
        case 'contratada':
            return 'Con contrato vigente';
        case 'vencida':
            return `Vencida hace ${Math.abs(s.diasRestantes)} ${Math.abs(s.diasRestantes) === 1 ? 'día' : 'días'}`;
        default:
            if (s.diasRestantes === 0) return 'Vence hoy';
            return `Vence en ${s.diasRestantes} ${s.diasRestantes === 1 ? 'día' : 'días'}`;
    }
}

export function etiquetaAntiguedad(dias: number): string {
    if (dias <= 0) return 'Separado hoy';
    return `Separado hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Colores del semáforo (borde del lote en el mapa y chip de la tarjeta). */
export const COLOR_SEPARACION: Record<SeparacionEstado | 'admin', string> = {
    vigente: '#7C3AED',
    por_vencer: '#F59E0B',
    vencida: '#DC2626',
    contratada: '#7C3AED',
    admin: '#475569',
};

interface LoteConSeparacion {
    separacion?: SeparacionInfo;
    reservaAdmin?: boolean;
}

export function esFiltroSeparacion(filtro: string | undefined): filtro is FiltroSeparacion {
    return !!filtro && FILTROS_SEPARACION.some((f) => f.value === filtro);
}

export function coincideFiltroSeparacion(lote: LoteConSeparacion, filtro: FiltroSeparacion): boolean {
    if (filtro === 'sep_admin') return !!lote.reservaAdmin;
    const estado = lote.separacion?.estado;
    if (filtro === 'sep_vigente') return estado === 'vigente' || estado === 'contratada';
    if (filtro === 'sep_por_vencer') return estado === 'por_vencer';
    return estado === 'vencida';
}

/** Estilo del borde del lote en el mapa, o null si no hay nada que destacar. */
export function bordeSeparacion(lote: LoteConSeparacion): { color: string; weight: number } | null {
    const estado = lote.separacion?.estado;
    if (estado === 'vencida') return { color: COLOR_SEPARACION.vencida, weight: 3 };
    if (estado === 'por_vencer') return { color: COLOR_SEPARACION.por_vencer, weight: 3 };
    return null;
}

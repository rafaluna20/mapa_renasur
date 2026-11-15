import { fetchOdoo } from '@/app/services/odooService';
import type { ScheduleLineLike } from '@/app/utils/statementModel';

/**
 * Lectura del CONTRATO que respalda un estado de cuenta (ficha mapa_estado_cuenta_por_contrato).
 *
 * Por qué existe: hasta ahora el estado de cuenta se armaba por persona (partner_id). En un lote con
 * copropietarios que pagan por turnos (simple_recurring_contract >= 3.23) la factura nace al cobro y a nombre de
 * quien paga, así que cada titular veía solo la mitad. El contrato (account.move.contract_id) es la clave común.
 *
 * Compatibilidad: los campos `billing_mode` y `co_owner_ids` y la marca `portal_emitted` existen solo desde la
 * v3.23 del módulo. Contra un Odoo anterior la lectura vuelve a los campos de siempre y el contrato se trata
 * como Automático sin copropietarios, es decir, el comportamiento histórico.
 */

export type BillingMode = 'auto' | 'manual';

export interface ContratoEstado {
    id: number;
    state: string;
    partnerId: number | null;
    billingMode: BillingMode;
    coOwnerIds: number[];
    /** Código del lote (default_code) del contrato, si se pidió por portal. */
    productCode?: string | null;
}

interface FilaContrato {
    id: number;
    state: string;
    partner_id?: [number, string] | false;
    product_id?: [number, string] | false;
    billing_mode?: string | false;
    co_owner_ids?: number[];
}

const CAMPOS_BASE = ['id', 'state', 'partner_id', 'product_id'];
const CAMPOS_V323 = [...CAMPOS_BASE, 'billing_mode', 'co_owner_ids'];

function aContrato(fila: FilaContrato, codigoPorProducto?: Map<number, string>): ContratoEstado {
    return {
        id: fila.id,
        state: fila.state,
        partnerId: fila.partner_id ? fila.partner_id[0] : null,
        billingMode: fila.billing_mode === 'manual' ? 'manual' : 'auto',
        coOwnerIds: Array.isArray(fila.co_owner_ids) ? fila.co_owner_ids : [],
        productCode: fila.product_id && codigoPorProducto ? codigoPorProducto.get(fila.product_id[0]) ?? null : null,
    };
}

/** search_read de contratos con los campos de la v3.23; si el Odoo es anterior, reintenta con los de siempre. */
async function leerContratos(dominio: unknown[], order: string): Promise<FilaContrato[]> {
    try {
        return ((await fetchOdoo('simple.contract', 'search_read', [dominio], { fields: CAMPOS_V323, order })) as FilaContrato[]) || [];
    } catch {
        return ((await fetchOdoo('simple.contract', 'search_read', [dominio], { fields: CAMPOS_BASE, order })) as FilaContrato[]) || [];
    }
}

/**
 * Contrato que respalda el estado de cuenta de un lote: el confirmado más reciente; si no hay, el cerrado más
 * reciente. Los borradores no cuentan (SUPUESTO S2 de la ficha). null si el lote no tiene contrato.
 */
export async function resolverContratoDelLote(productCode: string): Promise<ContratoEstado | null> {
    const productos = (await fetchOdoo('product.product', 'search_read', [[['default_code', '=', productCode]]], {
        fields: ['id'],
        limit: 1,
        context: { active_test: false },
    })) as { id: number }[];
    if (!productos || productos.length === 0) return null;

    const filas = await leerContratos([['product_id', '=', productos[0].id], ['state', 'in', ['confirmed', 'closed']]], 'id desc');
    const elegido = filas.find((f) => f.state === 'confirmed') ?? filas.find((f) => f.state === 'closed');
    return elegido ? aContrato(elegido) : null;
}

/** Líneas activas del cronograma de un contrato. Sin la marca de portal (Odoo < 3.23) se leen sin ella. */
export async function fetchCronograma(contractId: number): Promise<ScheduleLineLike[]> {
    const leer = async (campos: string[]) =>
        ((await fetchOdoo('simple.contract.schedule', 'search_read', [[['contract_id', '=', contractId]]], {
            fields: campos,
            order: 'sequence asc',
        })) as { sequence: number; date: string | false; amount: number; portal_emitted?: boolean }[]) || [];
    let filas;
    try {
        filas = await leer(['sequence', 'date', 'amount', 'portal_emitted']);
    } catch {
        filas = await leer(['sequence', 'date', 'amount']);
    }
    return filas.map((l) => ({ sequence: l.sequence, date: l.date, amount: l.amount, portal_emitted: l.portal_emitted === true }));
}

/**
 * Contratos en los que una persona es titular principal o copropietaria (portal del cliente). El contrato sale de
 * la sesión del servidor, nunca de un parámetro del cliente. Contra un Odoo < 3.23 (sin copropietarios) devuelve
 * solo los del titular principal.
 */
export async function contratosDelTitular(partnerId: number): Promise<ContratoEstado[]> {
    const estados = ['confirmed', 'closed'];
    let filas: FilaContrato[];
    try {
        filas = await leerContratosConCopropietarios(partnerId, estados);
    } catch {
        filas = await leerContratos([['partner_id', '=', partnerId], ['state', 'in', estados]], 'id desc');
    }
    const productIds = [...new Set(filas.map((f) => (f.product_id ? f.product_id[0] : 0)).filter(Boolean))];
    const codigos = new Map<number, string>();
    if (productIds.length > 0) {
        const productos = (await fetchOdoo('product.product', 'search_read', [[['id', 'in', productIds]]], {
            fields: ['id', 'default_code'],
            context: { active_test: false },
        })) as { id: number; default_code: string | false }[];
        for (const p of productos || []) if (p.default_code) codigos.set(p.id, p.default_code);
    }
    return filas.map((f) => aContrato(f, codigos));
}

async function leerContratosConCopropietarios(partnerId: number, estados: string[]): Promise<FilaContrato[]> {
    return ((await fetchOdoo(
        'simple.contract',
        'search_read',
        [['&', ['state', 'in', estados], '|', ['partner_id', '=', partnerId], ['co_owner_ids', 'in', [partnerId]]]],
        { fields: CAMPOS_V323, order: 'id desc' },
    )) as FilaContrato[]) || [];
}

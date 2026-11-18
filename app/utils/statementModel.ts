/**
 * Modelo ÚNICO del estado de cuenta de un lote: separa CUOTAS (capital) de CARGOS POR MORA.
 *
 * Por qué existe: la ficha del lote (staff), el portal del cliente, el PDF "Estado de Cuenta" y el
 * recordatorio de WhatsApp calculaban cada uno por su cuenta (código copiado en 3 archivos). Con la mora
 * (simple_recurring_contract v3.18) eso daba resultados erróneos: la mora se rotulaba como una segunda
 * "Cuota N° 17", la mora PAGADA bajaba el saldo deudor del lote sin haber amortizado el precio, y el
 * banner de atraso contaba recargos como cuotas. Toda esa lógica vive ahora aquí, con pruebas.
 *
 * Reglas:
 *  - Una MORA es una factura con `is_late_fee` (o, si el dato no llegó, con referencia terminada en `-MORA`).
 *  - Una mora CONDONADA (anulada) o revertida NO se muestra al cliente.
 *  - "Total pagado", % de avance y saldo deudor se calculan SOLO sobre el capital (las cuotas).
 *  - "Total a regularizar" = cuotas vencidas + mora pendiente.
 *  - La mora nunca figura como "Vencida": su plazo de pago aún no está definido por el negocio (hoy vence
 *    el día de emisión), así que solo se informa Pendiente / Pagado.
 */

export interface StatementInvoiceLike {
    id: number;
    name: string;
    ref?: string | false;
    payment_reference?: string | false;
    invoice_date: string;
    invoice_date_due?: string | false;
    amount_total: number;
    amount_residual: number;
    payment_state: string;
    /** Campos de la mora (módulo Odoo simple_recurring_contract >= 3.18). */
    is_late_fee?: boolean;
    late_fee_origin_id?: [number, string] | false;
    late_fee_days_late?: number;
    late_fee_percentage_applied?: number;
    late_fee_waived?: boolean;
    state?: string;
    /** Número de cuota guardado por el módulo en la factura (0 = inicial). Preferible a leerlo de la referencia. */
    contract_quota_number?: number;
}

/**
 * Línea del cronograma de un contrato (simple.contract.schedule). Solo se usa en contratos de facturación MANUAL:
 * ahí la factura nace al cobro y una cuota vencida que nadie cobró todavía no tiene factura.
 */
export interface ScheduleLineLike {
    sequence: number;
    date: string | false;
    amount: number;
    /** Marca «emitida en el portal» (módulo >= 3.23): la cuota ya se cobró y emitió fuera de Odoo. */
    portal_emitted?: boolean;
}

/** Cuota vencida que figura en el cronograma pero aún no tiene factura ni marca de portal. */
export interface UnbilledQuota {
    sequence: number;
    date: string;
    amount: number;
}

export type InstallmentStatus = 'paid' | 'overdue' | 'pending';

/** Texto que ve el cliente. "Vencida" (y no "Mora") para no confundir con el cargo por mora. */
export const STATUS_LABEL: Record<InstallmentStatus, string> = {
    paid: 'Pagado',
    overdue: 'Vencida',
    pending: 'Pendiente',
};

/** Tolerancia de redondeo: N cuotas iguales casi nunca suman el precio exacto (centavos). */
export const TOLERANCIA_REDONDEO_CUOTAS = 1;

const REF_INIT = /[-_]INIT(\b|$|-)/i;
const REF_CUOTA = /[-_]C(\d+)(?:\b|$|-)/i;
const REF_MORA = /-MORA(-R\d+)?$/i;

function refOf(inv: Pick<StatementInvoiceLike, 'name' | 'ref' | 'payment_reference'>): string {
    return (inv.ref || inv.payment_reference || inv.name || '') as string;
}

/** Cuota a la que corresponde la referencia (0 = inicial) o null si no se reconoce. */
export function quotaNumberOf(inv: Pick<StatementInvoiceLike, 'name' | 'ref' | 'payment_reference'>): number | null {
    const ref = refOf(inv);
    if (REF_INIT.test(ref)) return 0;
    const m = ref.match(REF_CUOTA);
    return m ? parseInt(m[1], 10) : null;
}

/** Cuota que cubre la factura: el número estructurado del contrato y, si falta, el de la referencia. */
export function billedQuotaNumberOf(inv: StatementInvoiceLike): number | null {
    if (typeof inv.contract_quota_number === 'number' && inv.contract_quota_number >= 0) return inv.contract_quota_number;
    return quotaNumberOf(inv);
}

export function isLateFeeInvoice(inv: StatementInvoiceLike): boolean {
    if (typeof inv.is_late_fee === 'boolean') return inv.is_late_fee;
    return REF_MORA.test(refOf(inv)); // respaldo si el dato no llegó de Odoo
}

/** Mora anulada (condonada) o revertida: no se muestra ni cuenta. */
export function isHiddenLateFee(inv: StatementInvoiceLike): boolean {
    if (!isLateFeeInvoice(inv)) return false;
    return inv.late_fee_waived === true || inv.state === 'cancel' || inv.payment_state === 'reversed';
}

/**
 * Factura REVERTIDA (anulada con nota de credito: payment_state = 'reversed', saldo 0). No es una cuota vencida ni una deuda,
 * y el dinero tampoco entro por ella: no se muestra ni cuenta como cuota. Si la cuota se reemitio, la que vale es la factura
 * nueva. (Para un contrato Manual SI sigue contando como "facturada" al decidir si falta factura: igual que en el modulo.)
 */
export function isReversedInvoice(inv: Pick<StatementInvoiceLike, 'payment_state'>): boolean {
    return inv.payment_state === 'reversed';
}

/** Etiqueta de una CUOTA. */
export function installmentLabel(inv: StatementInvoiceLike): string {
    const n = quotaNumberOf(inv);
    if (n === 0) return 'Cuota Inicial';
    if (n !== null) return `Cuota N° ${n}`;
    return inv.name || 'Factura';
}

/** Etiqueta de una cuota del cronograma que aún no tiene factura (misma redacción que una cuota facturada). */
export function unbilledQuotaLabel(q: Pick<UnbilledQuota, 'sequence'>): string {
    return q.sequence === 0 ? 'Cuota Inicial' : `Cuota N° ${q.sequence}`;
}

/** Etiqueta de una MORA: "Mora cuota 17". */
export function lateFeeLabel(inv: StatementInvoiceLike): string {
    const n = quotaNumberOf(inv);
    if (n === 0) return 'Mora cuota inicial';
    if (n !== null) return `Mora cuota ${n}`;
    return 'Mora';
}

/** Clave de orden: Inicial, N° 1, N° 2…; lo no reconocido al final. */
export function quotaOrderKey(inv: StatementInvoiceLike): number {
    const n = quotaNumberOf(inv);
    return n === null ? Number.MAX_SAFE_INTEGER : n;
}

export function compareByQuota(a: StatementInvoiceLike, b: StatementInvoiceLike): number {
    const d = quotaOrderKey(a) - quotaOrderKey(b);
    if (d !== 0) return d;
    return new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime();
}

function isPastDue(inv: StatementInvoiceLike, now: Date): boolean {
    return !!inv.invoice_date_due && new Date(inv.invoice_date_due) < now;
}

/** Estado de una CUOTA (la mora no usa "Vencida", ver cabecera). */
export function installmentStatus(inv: StatementInvoiceLike, now: Date): InstallmentStatus {
    if (inv.payment_state === 'paid') return 'paid';
    return isPastDue(inv, now) ? 'overdue' : 'pending';
}

export function lateFeeStatus(inv: StatementInvoiceLike): 'paid' | 'pending' {
    return inv.payment_state === 'paid' ? 'paid' : 'pending';
}

/**
 * Cuotas del cronograma ya vencidas que NO tienen factura (y no están marcadas como emitidas en el portal).
 * Una MORA no cuenta como factura de la cuota (hereda su número pero no la cubre). Sin cronograma devuelve [].
 */
export function unbilledOverdueQuotas(
    invoices: StatementInvoiceLike[],
    schedule: ScheduleLineLike[] | undefined,
    now: Date = new Date(),
): UnbilledQuota[] {
    if (!schedule || schedule.length === 0) return [];
    const billed = new Set<number>();
    for (const inv of invoices) {
        if (isLateFeeInvoice(inv)) continue;
        const n = billedQuotaNumberOf(inv);
        if (n !== null) billed.add(n);
    }
    return schedule
        .filter((l) => l.date && l.amount > 0 && !l.portal_emitted && !billed.has(l.sequence) && new Date(l.date as string) < now)
        .map((l) => ({ sequence: l.sequence, date: l.date as string, amount: l.amount }))
        .sort((a, b) => a.sequence - b.sequence);
}

/**
 * Resumen de las cuotas vencidas SIN factura de varios lotes (tarjetas del portal «Total pendiente» y «Vencidas»).
 * Devuelve cuantas son y su monto en la moneda de cada lote (nunca mezcladas). Los lotes sin cronograma
 * (contratos Automaticos) no aportan nada: ahi el motor ya emitio la factura.
 */
export function resumenSinFactura<C extends string>(
    lotes: { invoices: StatementInvoiceLike[]; scheduleLines?: ScheduleLineLike[]; currency: C }[],
    now: Date = new Date(),
): { count: number; amounts: { currency: C; amount: number }[] } {
    let count = 0;
    const amounts: { currency: C; amount: number }[] = [];
    for (const lote of lotes) {
        const sinFactura = unbilledOverdueQuotas(lote.invoices, lote.scheduleLines, now);
        if (sinFactura.length === 0) continue;
        count += sinFactura.length;
        amounts.push({ currency: lote.currency, amount: sinFactura.reduce((s, q) => s + q.amount, 0) });
    }
    return { count, amounts };
}

export interface StatementModel<T extends StatementInvoiceLike> {
    /** Cuotas (capital), ordenadas por número de cuota. */
    installments: T[];
    /** Cargos por mora visibles (sin condonadas), por cuota de origen. */
    lateFees: T[];
    /** Capital pagado (solo cuotas). */
    capitalPaid: number;
    /** Mora pagada (informativo, NO amortiza el precio). */
    lateFeePaid: number;
    /** Precio − capital pagado, con tolerancia de redondeo. */
    pendingBalance: number;
    financialProgress: number;
    overdueInstallments: T[];
    overdueInstallmentsAmount: number;
    lateFeesPending: T[];
    lateFeesPendingAmount: number;
    /** Cuotas vencidas del cronograma sin factura (contratos Manuales). Vacío si no se pasó cronograma. */
    unbilledOverdue: UnbilledQuota[];
    unbilledOverdueAmount: number;
    /** Cuántas cuotas están vencidas, con factura o sin ella (lo que dice el aviso de atraso). */
    overdueQuotaCount: number;
    /** Monto de esas cuotas vencidas: saldo de las facturadas + monto de las que aún no tienen factura. */
    overdueQuotaAmount: number;
    /** Cuotas vencidas (facturadas o no) + mora pendiente. */
    totalToRegularize: number;
    hasOverdueInstallments: boolean;
    hasLateFees: boolean;
    /** Hay algo exigible: cuotas vencidas o mora pendiente. */
    hasDebt: boolean;
}

export function buildStatementModel<T extends StatementInvoiceLike>(
    invoices: T[],
    listPrice: number,
    now: Date = new Date(),
    schedule?: ScheduleLineLike[],
): StatementModel<T> {
    const visible = invoices.filter((inv) => !isHiddenLateFee(inv) && !isReversedInvoice(inv));
    const installments = visible.filter((inv) => !isLateFeeInvoice(inv)).sort(compareByQuota);
    const lateFees = visible.filter((inv) => isLateFeeInvoice(inv)).sort(compareByQuota);

    const sum = (list: T[], pick: (i: T) => number) => list.reduce((s, i) => s + (pick(i) || 0), 0);
    const capitalPaid = sum(installments.filter((i) => i.payment_state === 'paid'), (i) => i.amount_total);
    const lateFeePaid = sum(lateFees.filter((i) => i.payment_state === 'paid'), (i) => i.amount_total);

    const pendingRaw = Math.max(0, listPrice - capitalPaid);
    const pendingBalance = pendingRaw <= TOLERANCIA_REDONDEO_CUOTAS ? 0 : pendingRaw;
    const financialProgress = listPrice > 0 ? Math.min(100, Math.round((capitalPaid / listPrice) * 100)) : 0;

    const overdueInstallments = installments.filter((i) => i.payment_state !== 'paid' && isPastDue(i, now));
    const overdueInstallmentsAmount = sum(overdueInstallments, (i) => i.amount_residual);
    const lateFeesPending = lateFees.filter((i) => i.payment_state !== 'paid');
    const lateFeesPendingAmount = sum(lateFeesPending, (i) => i.amount_residual);

    const unbilledOverdue = unbilledOverdueQuotas(invoices, schedule, now);
    const unbilledOverdueAmount = unbilledOverdue.reduce((s, q) => s + q.amount, 0);

    return {
        installments,
        lateFees,
        capitalPaid,
        lateFeePaid,
        pendingBalance,
        financialProgress,
        overdueInstallments,
        overdueInstallmentsAmount,
        lateFeesPending,
        lateFeesPendingAmount,
        unbilledOverdue,
        unbilledOverdueAmount,
        overdueQuotaCount: overdueInstallments.length + unbilledOverdue.length,
        overdueQuotaAmount: overdueInstallmentsAmount + unbilledOverdueAmount,
        totalToRegularize: overdueInstallmentsAmount + unbilledOverdueAmount + lateFeesPendingAmount,
        hasOverdueInstallments: overdueInstallments.length > 0 || unbilledOverdue.length > 0,
        hasLateFees: lateFees.length > 0,
        hasDebt: overdueInstallments.length > 0 || unbilledOverdue.length > 0 || lateFeesPending.length > 0,
    };
}

/** % de mora común a todas las moras visibles (para la nota al pie), o null si varía / no se conoce. */
export function commonLateFeePercentage(lateFees: StatementInvoiceLike[]): number | null {
    const pcts = [...new Set(lateFees.map((f) => f.late_fee_percentage_applied).filter((p): p is number => typeof p === 'number' && p > 0))];
    return pcts.length === 1 ? pcts[0] : null;
}

/** Nota explicativa del recargo (misma redacción en el PDF, el portal y la ficha del staff). */
export function lateFeeNote(lateFees: StatementInvoiceLike[]): string {
    const pct = commonLateFeePercentage(lateFees);
    return pct
        ? `Recargo por mora: ${pct}% sobre el saldo de cada cuota vencida, aplicado una sola vez por cuota, según las condiciones de su contrato.`
        : 'Recargo por mora: el porcentaje aplicado se indica en cada fila; se aplica una sola vez por cuota, según las condiciones de su contrato.';
}

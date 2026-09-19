import type { CurrencyCode } from '@/app/utils/money';

/**
 * Cuentas para recibir transferencias de clientes, POR MONEDA.
 *
 * Una cuota en dólares NUNCA debe mostrar la cuenta en soles (el cliente transferiría a la cuenta
 * equivocada). Por eso cada moneda tiene su entrada; si una moneda no tiene cuenta configurada
 * (`null`), la pantalla no muestra ninguna cuenta e indica pedirla al asesor, en vez de mostrar
 * la de otra moneda.
 *
 * Soles: la cuenta es la del diario "BCP Renasur Soles" de Odoo (194-9942163-0-87), confirmada como
 * correcta por el negocio (2026-09-19). La que estaba escrita antes en este archivo
 * (194-2468127-0-52, con su CCI) era incorrecta. El CCI de la cuenta correcta NO está en Odoo y no
 * se inventa: `cci: null` = no se muestra hasta que el negocio lo entregue.
 *
 * PENDIENTE DE CONFIRMAR con el negocio (USD): en Odoo, el diario "BCP Renasur Dolares" tiene la
 * cuenta 194-9944232-1-96, pero el CCI no está registrado y no se publica ningún dato bancario
 * al cliente sin confirmación explícita. Completar `USD` cuando se confirme.
 */
export interface BankAccountInfo {
    bank: string;
    account: string;
    /** CCI (interbancario) de ESTA cuenta; `null` = aún no confirmado: no se muestra. */
    cci: string | null;
    holder: string;
}

export const BANK_ACCOUNTS: Record<CurrencyCode, BankAccountInfo | null> = {
    PEN: {
        bank: 'BCP - Banco de Crédito del Perú',
        account: '194-9942163-0-87',
        cci: null,
        holder: 'RENACIMIENTO DEL SUR S.A.C.',
    },
    USD: null,
};

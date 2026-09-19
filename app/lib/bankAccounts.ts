import type { CurrencyCode } from '@/app/utils/money';

/**
 * Cuentas para recibir transferencias de clientes, POR MONEDA.
 *
 * Una cuota en dólares NUNCA debe mostrar la cuenta en soles (el cliente transferiría a la cuenta
 * equivocada). Por eso cada moneda tiene su entrada; si una moneda no tiene cuenta configurada
 * (`null`), la pantalla no muestra ninguna cuenta e indica pedirla al asesor, en vez de mostrar
 * la de otra moneda.
 *
 * PENDIENTE DE CONFIRMAR con el negocio (USD): en Odoo, el diario "BCP Renasur Dolares" tiene la
 * cuenta 194-9944232-1-96, pero el CCI no está registrado y no se publica ningún dato bancario
 * al cliente sin confirmación explícita. Completar `USD` cuando se confirme.
 *
 * Además, revisar la de soles: el diario "BCP Renasur Soles" de Odoo tiene 194-9942163-0-87,
 * distinta de la cuenta escrita aquí (194-2468127-0-52).
 */
export interface BankAccountInfo {
    bank: string;
    account: string;
    cci: string;
    holder: string;
}

export const BANK_ACCOUNTS: Record<CurrencyCode, BankAccountInfo | null> = {
    PEN: {
        bank: 'BCP - Banco de Crédito del Perú',
        account: '194-2468127-0-52',
        cci: '00219400246812705239',
        holder: 'RENACIMIENTO DEL SUR S.A.C.',
    },
    USD: null,
};

import { describe, it, expect } from 'vitest';
import { BANK_ACCOUNTS } from './bankAccounts';

describe('BANK_ACCOUNTS', () => {
    it('soles usa la cuenta del diario "BCP Renasur Soles" de Odoo (la anterior era incorrecta)', () => {
        expect(BANK_ACCOUNTS.PEN?.account).toBe('194-9942163-0-87');
        expect(BANK_ACCOUNTS.PEN?.account).not.toBe('194-2468127-0-52');
    });

    it('nunca se muestra el CCI de otra cuenta: sin CCI confirmado queda en null', () => {
        expect(BANK_ACCOUNTS.PEN?.cci).toBeNull();
        expect(BANK_ACCOUNTS.PEN?.cci).not.toBe('00219400246812705239');
    });

    it('dólares no tiene cuenta configurada: una cuota en USD jamás debe mostrar la cuenta en soles', () => {
        expect(BANK_ACCOUNTS.USD).toBeNull();
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
    avisoPorCuota,
    crearLimitador,
    etiquetaAviso,
    mensajeDeOdoo,
    validarArchivoComprobante,
    validarDatosAviso,
    type AvisoPago,
} from './avisoPago';

const aviso = (over: Partial<AvisoPago> = {}): AvisoPago => ({
    id: 1, quota_number: 3, amount: 1000, expected_amount: 1000, state: 'pending', reject_reason: false,
    create_date: '2026-11-10 10:00:00', ...over,
});

describe('validarArchivoComprobante', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const pdf = Buffer.from('%PDF-1.4 ...');
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

    it('acepta PNG, JPG y PDF reales', () => {
        expect(validarArchivoComprobante(png).valido).toBe(true);
        expect(validarArchivoComprobante(jpg).valido).toBe(true);
        expect(validarArchivoComprobante(pdf).valido).toBe(true);
    });
    it('rechaza un archivo cuya firma no coincide (ej. un ejecutable renombrado)', () => {
        const r = validarArchivoComprobante(Buffer.from('MZ\x90\x00 programa'));
        expect(r.valido).toBe(false);
        expect(r.error).toMatch(/JPG, PNG o PDF/);
    });
    it('rechaza un archivo de mas de 5 MB', () => {
        const grande = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024 + 1)]);
        const r = validarArchivoComprobante(grande);
        expect(r.valido).toBe(false);
        expect(r.error).toMatch(/5MB/);
    });
    it('rechaza un archivo vacio', () => {
        expect(validarArchivoComprobante(Buffer.alloc(0)).valido).toBe(false);
    });
});

describe('validarDatosAviso', () => {
    const base = { contract_id: '63', quota_number: '3', amount: '1000.50', bank_name: ' BCP ', operation_number: '12345', transfer_date: '2026-11-10', note: '' };
    const hoy = new Date('2026-11-15T12:00:00');

    it('normaliza y acepta datos correctos', () => {
        const r = validarDatosAviso(base, hoy);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.datos).toMatchObject({ contractId: 63, quotaNumber: 3, amount: 1000.5, bankName: 'BCP', operationNumber: '12345', transferDate: '2026-11-10' });
        }
    });
    it('rechaza contrato o cuota que no son enteros validos', () => {
        expect(validarDatosAviso({ ...base, contract_id: 'abc' }, hoy).ok).toBe(false);
        expect(validarDatosAviso({ ...base, contract_id: '0' }, hoy).ok).toBe(false);
        expect(validarDatosAviso({ ...base, quota_number: '-1' }, hoy).ok).toBe(false);
        expect(validarDatosAviso({ ...base, quota_number: '2.5' }, hoy).ok).toBe(false);
    });
    it('rechaza monto cero, negativo, no numerico o con mas de 2 decimales', () => {
        for (const amount of ['0', '-5', 'x', '', '10.555', 'Infinity']) {
            expect(validarDatosAviso({ ...base, amount }, hoy).ok, amount).toBe(false);
        }
    });
    it('rechaza una fecha de transferencia futura o con formato invalido o de hace mas de un ano', () => {
        expect(validarDatosAviso({ ...base, transfer_date: '2026-12-01' }, hoy).ok).toBe(false);
        expect(validarDatosAviso({ ...base, transfer_date: '15/11/2026' }, hoy).ok).toBe(false);
        expect(validarDatosAviso({ ...base, transfer_date: '2025-01-01' }, hoy).ok).toBe(false);
    });
    it('acepta la fecha de hoy y la omision de banco y nota', () => {
        expect(validarDatosAviso({ ...base, transfer_date: '2026-11-15', bank_name: '', note: '' }, hoy).ok).toBe(true);
    });
    it('exige numero de operacion y limita el largo de los textos', () => {
        expect(validarDatosAviso({ ...base, operation_number: '' }, hoy).ok).toBe(false);
        expect(validarDatosAviso({ ...base, operation_number: 'x'.repeat(101) }, hoy).ok).toBe(false);
        expect(validarDatosAviso({ ...base, note: 'x'.repeat(501) }, hoy).ok).toBe(false);
    });
});

describe('mensajeDeOdoo', () => {
    it('extrae el texto del UserError de Odoo', () => {
        const e = new Error('Odoo Error: Odoo Server Error - Ya hay un aviso de pago abierto para la cuota 3 de este contrato.');
        expect(mensajeDeOdoo(e)).toBe('Ya hay un aviso de pago abierto para la cuota 3 de este contrato.');
    });
    it('devuelve el mensaje tal cual si no tiene el formato de Odoo', () => {
        expect(mensajeDeOdoo(new Error('boom'))).toBe('boom');
        expect(mensajeDeOdoo('texto')).toBe('texto');
    });
});

describe('avisoPorCuota y etiquetaAviso', () => {
    it('devuelve el aviso abierto de la cuota; si no hay, el ultimo rechazado', () => {
        const lista = [
            aviso({ id: 1, state: 'rejected', reject_reason: 'Ilegible' }),
            aviso({ id: 2, state: 'pending' }),
        ];
        expect(avisoPorCuota(lista, 3)?.id).toBe(2);
        expect(avisoPorCuota([lista[0]], 3)?.id).toBe(1);
        expect(avisoPorCuota(lista, 4)).toBeNull();
        expect(avisoPorCuota(undefined, 3)).toBeNull();
    });
    it('entre varios rechazados toma el mas reciente', () => {
        const lista = [
            aviso({ id: 1, state: 'rejected', create_date: '2026-11-01 10:00:00' }),
            aviso({ id: 7, state: 'rejected', create_date: '2026-11-09 10:00:00' }),
        ];
        expect(avisoPorCuota(lista, 3)?.id).toBe(7);
    });
    it('un aviso facturado no cuenta (la cuota ya tiene factura)', () => {
        expect(avisoPorCuota([aviso({ state: 'invoiced' })], 3)).toBeNull();
    });
    it('etiqueta cada estado sin exponer datos internos', () => {
        expect(etiquetaAviso(aviso({ state: 'pending' }))).toMatchObject({ texto: 'En revisión', permiteReinformar: false });
        expect(etiquetaAviso(aviso({ state: 'observed' }))).toMatchObject({ texto: 'En revisión', permiteReinformar: false });
        const rech = etiquetaAviso(aviso({ state: 'rejected', reject_reason: 'No aparece en el banco' }));
        expect(rech.permiteReinformar).toBe(true);
        expect(rech.detalle).toContain('No aparece en el banco');
    });
    it('un aviso en observacion se muestra al cliente igual que uno por verificar (sin revelar la diferencia interna)', () => {
        expect(etiquetaAviso(aviso({ state: 'observed' })).texto).toBe(etiquetaAviso(aviso({ state: 'pending' })).texto);
    });
});

describe('crearLimitador', () => {
    let t = 0;
    beforeEach(() => { t = 1_000_000; });
    it('permite hasta N intentos por ventana y luego bloquea con minutos de espera', () => {
        const lim = crearLimitador({ maxIntentos: 3, ventanaMs: 60 * 60 * 1000, ahora: () => t });
        expect(lim('a').permitido).toBe(true);
        expect(lim('a').permitido).toBe(true);
        expect(lim('a').permitido).toBe(true);
        const bloqueado = lim('a');
        expect(bloqueado.permitido).toBe(false);
        expect(bloqueado.minutos).toBeGreaterThan(0);
    });
    it('cuenta por separado a cada persona y se reinicia al vencer la ventana', () => {
        const lim = crearLimitador({ maxIntentos: 1, ventanaMs: 1000, ahora: () => t });
        expect(lim('a').permitido).toBe(true);
        expect(lim('a').permitido).toBe(false);
        expect(lim('b').permitido).toBe(true);
        t += 1001;
        expect(lim('a').permitido).toBe(true);
    });
});

import { describe, it, expect, vi } from 'vitest';

let salida: string[] = [];
vi.mock('jspdf', async (original) => {
    const mod = (await original()) as { jsPDF: new (...a: unknown[]) => { output: (t: string) => ArrayBuffer } };
    class Capturador extends mod.jsPDF {
        constructor(...args: unknown[]) {
            super(...args);
            (this as unknown as { save: () => void }).save = () => {
                salida.push(Buffer.from(this.output('arraybuffer') as ArrayBuffer).toString('latin1'));
            };
        }
    }
    return { ...mod, jsPDF: Capturador, default: Capturador };
});

import { generateClientStatementReport } from './reportService';

const base = {
    clientName: 'ESCALANTE LOYOLA, RODRIGO', clientDni: '72119586', clientEmail: null, clientPhone: null,
};
const lote = { label: 'Etapa 1 Mz T Lote 58', mz: 'T', etapa: '1', numeroLote: '58', area: 120, listPrice: 61000, invoices: [], scheduleLines: [] };

// El PDF se genera de verdad (jsPDF) y se lee su contenido: la caja COPROPIETARIOS solo existe si el contrato los tiene.
describe('PDF estado de cuenta: copropietarios', () => {
    it('con copropietarios imprime la caja con sus datos', async () => {
        salida = [];
        await generateClientStatementReport({ ...base, lots: [{ ...lote, copropietarios: [
            { id: 1, name: 'PALACIOS ISABEL', dni: '73021414', phone: '999111222' },
            { id: 2, name: 'LUIS RAMOS', dni: null, phone: null },
        ] }] });
        const pdf = salida[0];
        expect(pdf).toContain('COPROPIETARIOS');
        expect(pdf).toContain('PALACIOS ISABEL');
        expect(pdf).toContain('73021414');
    });
    it('sin copropietarios no imprime nada de eso', async () => {
        salida = [];
        await generateClientStatementReport({ ...base, lots: [{ ...lote }] });
        expect(salida[0]).not.toContain('COPROPIETARIOS');
        salida = [];
        await generateClientStatementReport({ ...base, lots: [{ ...lote, copropietarios: [] }] });
        expect(salida[0]).not.toContain('COPROPIETARIOS');
    });
});

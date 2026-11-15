import { describe, it, expect } from 'vitest';
import { aCopropietarios, itemsCopropietarios } from './copropietarios';

describe('aCopropietarios', () => {
    it('convierte los campos vacíos de Odoo (false) en null y prefiere el teléfono fijo sobre el celular', () => {
        expect(aCopropietarios([
            { id: 20, name: 'ANA PEREZ', vat: '43160220', phone: false, mobile: '999111222' },
            { id: 21, name: 'LUIS RAMOS', vat: false, phone: '014445566', mobile: '999000111' },
        ])).toEqual([
            { id: 20, name: 'ANA PEREZ', dni: '43160220', phone: '999111222' },
            { id: 21, name: 'LUIS RAMOS', dni: null, phone: '014445566' },
        ]);
    });

    it('un nombre vacío no deja la fila en blanco, y se ordena por id para que el orden sea estable', () => {
        const r = aCopropietarios([{ id: 9, name: false }, { id: 3, name: ' Zoe ' }]);
        expect(r.map((c) => [c.id, c.name])).toEqual([[3, 'Zoe'], [9, 'Sin nombre']]);
    });

    it('sin copropietarios (o datos ausentes) devuelve lista vacía', () => {
        expect(aCopropietarios([])).toEqual([]);
        expect(aCopropietarios(undefined)).toEqual([]);
        expect(aCopropietarios(null)).toEqual([]);
    });
});

describe('itemsCopropietarios', () => {
    it('sin copropietarios no genera casillas: no se imprime nada', () => {
        expect(itemsCopropietarios([])).toEqual([]);
        expect(itemsCopropietarios(undefined)).toEqual([]);
    });

    it('genera Nombre, DNI y Teléfono por persona, con «No registrado» cuando falta un dato', () => {
        expect(itemsCopropietarios([
            { id: 1, name: 'ANA PEREZ', dni: '43160220', phone: '999111222' },
            { id: 2, name: 'LUIS RAMOS', dni: null, phone: null },
        ])).toEqual([
            { label: 'Nombre', value: 'ANA PEREZ' },
            { label: 'DNI', value: '43160220' },
            { label: 'Teléfono', value: '999111222' },
            { label: 'Nombre', value: 'LUIS RAMOS' },
            { label: 'DNI', value: 'No registrado' },
            { label: 'Teléfono', value: 'No registrado' },
        ]);
    });
});

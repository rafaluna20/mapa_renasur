/**
 * Copropietarios de un contrato, tal como se muestran en el estado de cuenta (pantalla de pagos y PDF).
 * Lógica pura: sin red ni Odoo. Si el contrato no tiene copropietarios, la lista queda vacía y NO se imprime nada.
 */

export interface Copropietario {
    id: number;
    name: string;
    /** DNI/RUC (res.partner.vat), tal cual viene de Odoo. */
    dni: string | null;
    phone: string | null;
}

/** Fila de res.partner como la devuelve Odoo: los campos vacíos llegan como `false`. */
export interface FilaCopropietarioOdoo {
    id: number;
    name?: string | false;
    vat?: string | false;
    phone?: string | false;
    mobile?: string | false;
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function aCopropietarios(filas: FilaCopropietarioOdoo[] | null | undefined): Copropietario[] {
    return (filas ?? [])
        .filter((f) => f && typeof f.id === 'number')
        .map((f) => ({
            id: f.id,
            name: texto(f.name) ?? 'Sin nombre',
            dni: texto(f.vat),
            phone: texto(f.phone) ?? texto(f.mobile),
        }))
        .sort((a, b) => a.id - b.id);
}

/** Casillas de la caja «COPROPIETARIOS» del PDF: Nombre, DNI y Teléfono de cada uno (3 columnas = una fila por persona). */
export function itemsCopropietarios(lista: Copropietario[] | null | undefined): { label: string; value: string }[] {
    return (lista ?? []).flatMap((c) => [
        { label: 'Nombre', value: c.name },
        { label: 'DNI', value: c.dni ?? 'No registrado' },
        { label: 'Teléfono', value: c.phone ?? 'No registrado' },
    ]);
}

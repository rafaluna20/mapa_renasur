/**
 * Documentos de identidad de clientes (DNI / RUC) — lógica pura, sin red, usable en servidor y en pantalla.
 *
 * Sirve para no duplicar clientes en Odoo: el documento es la única llave confiable (los nombres varían en
 * mayúsculas y orden: «ZAMBRANO CAMA PERCY» / «PERCY ZAMBRANO CAMA»).
 *
 * Una persona natural puede aparecer con su DNI (8 dígitos) o con su RUC 10 (= «10» + DNI + dígito verificador):
 * son la MISMA persona, aunque el texto del documento sea distinto.
 */

const FACTORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export const soloDigitos = (valor: unknown): string => String(valor ?? '').replace(/\D/g, '');

/** Dígito verificador SUNAT (módulo 11) de los 10 primeros dígitos de un RUC: resultado 10 → 0, 11 → 1. */
export function digitoVerificadorRuc(base10: string): number {
    const total = FACTORES.reduce((suma, factor, i) => suma + Number(base10[i]) * factor, 0);
    const digito = 11 - (total % 11);
    return digito === 10 ? 0 : digito === 11 ? 1 : digito;
}

/** RUC que le corresponde a un DNI de persona natural. Ej.: 43160220 → 10431602208. */
export function rucDePersonaNatural(dni: string): string {
    const base = '10' + dni;
    return base + digitoVerificadorRuc(base);
}

/** DNI contenido en un RUC 10 válido, o null si no es un RUC de persona natural. */
export function dniDeRucPersonaNatural(ruc: string): string | null {
    if (!/^10\d{9}$/.test(ruc)) return null;
    const dni = ruc.slice(2, 10);
    return rucDePersonaNatural(dni) === ruc ? dni : null;
}

/**
 * Todos los documentos que identifican a la misma persona: el propio y, si es persona natural, su par DNI↔RUC 10.
 * El primero siempre es el documento recibido.
 */
export function documentosEquivalentes(doc: string): string[] {
    const limpio = soloDigitos(doc);
    const equivalentes = [limpio];
    if (/^\d{8}$/.test(limpio)) equivalentes.push(rucDePersonaNatural(limpio));
    else {
        const dni = dniDeRucPersonaNatural(limpio);
        if (dni) equivalentes.push(dni);
    }
    return equivalentes;
}

/**
 * Documentos guardados en el campo `vat` de Odoo. Algunos clientes tienen dos titulares en el mismo campo
 * («08285418 / 08722210»), así que se devuelven todos los grupos de 8 o más dígitos.
 */
export function documentosDeVat(vat: unknown): string[] {
    return String(vat ?? '').match(/\d{8,}/g) ?? [];
}

export type TipoCoincidencia = 'exacta' | 'equivalente' | null;

/** Cómo se relaciona el `vat` de un contacto existente con el documento que se quiere registrar. */
export function clasificarCoincidencia(vatExistente: unknown, doc: string): TipoCoincidencia {
    const limpio = soloDigitos(doc);
    const guardados = documentosDeVat(vatExistente);
    if (guardados.includes(limpio)) return 'exacta';
    const otros = documentosEquivalentes(limpio).slice(1);
    return guardados.some((g) => otros.includes(g)) ? 'equivalente' : null;
}

export const esDocumentoValido = (doc: string): boolean => /^(?:\d{8}|\d{11})$/.test(doc);

/** Operadores AND en notación polaca para unir `terminos` (cada uno ya es una expresión completa). */
const unirConAnd = (terminos: unknown[][]): unknown[] => [...Array(Math.max(terminos.length - 1, 0)).fill('&'), ...terminos];
const unirConOr = (terminos: unknown[][]): unknown[] => [...Array(Math.max(terminos.length - 1, 0)).fill('|'), ...terminos];

/**
 * Dominio de búsqueda de clientes a partir de lo que escribe el vendedor.
 * - Solo números: busca por documento y, si es DNI/RUC 10, también por el par de la misma persona.
 * - Texto: cada palabra del nombre debe aparecer (en cualquier orden: «Percy Zambrano» encuentra «ZAMBRANO CAMA PERCY»);
 *   también busca por correo o por el texto completo en el documento.
 */
export function dominioBusquedaClientes(consulta: string): unknown[] {
    const texto = consulta.trim();
    const activo = ['active', '=', true];
    if (!texto) return [activo];

    if (/^[\d\s\-/]+$/.test(texto)) {
        const digitos = soloDigitos(texto);
        const documentos = documentosEquivalentes(digitos);
        return [activo, ...unirConOr(documentos.map((d) => ['vat', 'ilike', d]))];
    }

    const palabras = texto.split(/\s+/).filter(Boolean);
    const porNombre = unirConAnd(palabras.map((p) => ['name', 'ilike', p]));
    return [activo, '|', '|', ...porNombre, ['email', 'ilike', texto], ['vat', 'ilike', texto]];
}

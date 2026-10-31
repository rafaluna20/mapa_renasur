/**
 * Búsqueda de clientes ya registrados en Odoo por documento (DNI/RUC) — solo servidor.
 *
 * La regla de negocio: un cliente no se registra dos veces. Un mismo documento (o el par DNI↔RUC 10 de la misma
 * persona natural) no debe tener dos fichas. Aquí se detecta; las rutas deciden qué hacer.
 */
import { fetchOdoo } from '@/app/services/odooService';
import { clasificarCoincidencia, documentosEquivalentes, soloDigitos } from '@/app/lib/documentoCliente';

export interface ClienteExistente {
    id: number;
    name: string;
    email?: string | false;
    phone?: string | false;
    mobile?: string | false;
    vat?: string | false;
    street?: string | false;
}

export interface CoincidenciasDocumento {
    /** Contactos con ESE mismo documento (el más antiguo primero). */
    exactos: ClienteExistente[];
    /** Contactos de la misma persona con el otro documento (DNI↔RUC 10). */
    equivalentes: ClienteExistente[];
}

/** Dominio de Odoo en notación polaca: (t1 OR t2 OR ...). */
function unirConOr(terminos: unknown[][]): unknown[] {
    return [...Array(Math.max(terminos.length - 1, 0)).fill('|'), ...terminos];
}

export async function buscarClientesPorDocumento(
    documento: string,
    opciones: { excluirId?: number } = {}
): Promise<CoincidenciasDocumento> {
    const doc = soloDigitos(documento);
    if (!doc) return { exactos: [], equivalentes: [] };

    const terminos = documentosEquivalentes(doc).map((d) => ['vat', 'ilike', d]);
    const dominio: unknown[] = [['active', '=', true], ...unirConOr(terminos)];
    if (opciones.excluirId) dominio.push(['id', '!=', opciones.excluirId]);

    // ilike trae también coincidencias parciales (y campos con dos titulares): se afina en código con la regla exacta.
    const candidatos = (await fetchOdoo('res.partner', 'search_read', [dominio], {
        fields: ['id', 'name', 'email', 'phone', 'mobile', 'vat', 'street'],
        limit: 30,
        order: 'id asc',
    })) as ClienteExistente[];

    const resultado: CoincidenciasDocumento = { exactos: [], equivalentes: [] };
    for (const c of candidatos ?? []) {
        const tipo = clasificarCoincidencia(c.vat, doc);
        if (tipo === 'exacta') resultado.exactos.push(c);
        else if (tipo === 'equivalente') resultado.equivalentes.push(c);
    }
    return resultado;
}

// Doble clic, reintento o dos pestañas: las peticiones por el mismo documento se atienden una tras otra, de modo que
// la segunda ya encuentra el cliente que creó la primera. Protege dentro de un mismo proceso del servidor; el seguro
// definitivo entre procesos es la restricción de unicidad del módulo partner_ruc_autocomplete en Odoo.
const colas = new Map<string, Promise<unknown>>();

export function enSerieParaDocumento<T>(documento: string, tarea: () => Promise<T>): Promise<T> {
    const clave = soloDigitos(documento);
    const anterior = colas.get(clave) ?? Promise.resolve();
    const actual = anterior.then(tarea, tarea);
    const cola = actual.catch(() => undefined);
    colas.set(clave, cola);
    void cola.then(() => {
        if (colas.get(clave) === cola) colas.delete(clave);
    });
    return actual;
}

/** Texto con el que el módulo de Odoo rechaza un documento repetido (ver partner_ruc_autocomplete). */
export const MENSAJE_ODOO_DOCUMENTO_REPETIDO = 'Ya existe un contacto con el documento';

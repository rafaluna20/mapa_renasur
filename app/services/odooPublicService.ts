// --- Servicio Odoo para la landing pública de anuncios (app/venta) ---
//
// A propósito NO reusa fetchOdoo() de odooService.ts (la cuenta admin con
// "privilegios amplios" que usa el resto de la app) — usa su propia
// credencial mínima (ODOO_PUBLIC_USER_ID/ODOO_PUBLIC_PASSWORD), creada aparte
// en Odoo, con acceso solo a: lectura de product.template/proyecto.inmobiliario,
// lectura+creación de crm.lead/utm.source/utm.medium/utm.campaign. Nada de
// res.partner, sale.order, account.move, y sin escritura sobre product.template.
//
// fetchOdooPublic() lanza error si faltan esas credenciales — nunca cae de
// vuelta a la cuenta admin por accidente.
import { callOdooJsonRpc } from '@/app/services/odooRpc';
import { OdooProduct, Proyecto, fetchElementosUrbanosVia } from '@/app/services/odooService';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';

function getPublicCredentials() {
    const url = process.env.ODOO_URL;
    const db = process.env.ODOO_DB;
    const uidRaw = process.env.ODOO_PUBLIC_USER_ID;
    const password = process.env.ODOO_PUBLIC_PASSWORD;

    if (!url || !db || !uidRaw || !password) {
        throw new Error(
            '[odooPublicService] Faltan variables de entorno de la credencial pública ' +
            '(ODOO_URL/ODOO_DB/ODOO_PUBLIC_USER_ID/ODOO_PUBLIC_PASSWORD). ' +
            'No se usa la cuenta admin como respaldo a propósito.'
        );
    }

    return { url, db, uid: parseInt(uidRaw, 10), password };
}

export async function fetchOdooPublic(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {}
) {
    return callOdooJsonRpc(getPublicCredentials(), model, method, args, kwargs);
}

// Campos de product.template expuestos públicamente. Deliberadamente
// EXCLUIDO: x_cliente (nombre real del comprador en lotes vendidos/reservados)
// — así es estructuralmente imposible que ese dato llegue al navegador, no es
// un filtro que se pueda olvidar en el futuro: el campo nunca se pide.
// qty_available sí se incluye (no es sensible, y mergeLotsData/OdooProduct lo
// esperan) para poder reusar tal cual la misma lógica de fusión que ya usa
// HomeClient, sin reimplementarla para la vista pública.
const PUBLIC_PRODUCT_FIELDS = [
    'id', 'name', 'default_code', 'list_price', 'qty_available',
    'x_statu', 'x_area', 'x_mz', 'x_etapa', 'x_lote',
    'x_geometry_utm', 'x_geometry_arcos', 'x_proyecto_id',
];

export async function getPublicLots(): Promise<OdooProduct[]> {
    return fetchOdooPublic(
        'product.template',
        'search_read',
        [[['active', '=', true], ['default_code', '!=', false]]],
        {
            fields: PUBLIC_PRODUCT_FIELDS,
            limit: 1000,
            context: { lang: 'es_PE' },
        }
    );
}

interface OdooProyectoInmobiliarioPublic {
    id: number;
    codigo: string;
    name: string;
    departamento: string;
    provincia: string;
    distrito: string;
    urbanizacion: string;
    zona_utm: string;
    centro_este: number | false;
    centro_norte: number | false;
    secuencia: number;
}

// Mismos campos que fetchProyectos() (odooService.ts) — necesarios porque
// LeafletMap resuelve la zona UTM de cada lote a partir de x_proyecto_id +
// esta lista; sin esto, todo cae al default de zona 18S.
export async function getPublicProyectos(): Promise<Proyecto[]> {
    try {
        const registros: OdooProyectoInmobiliarioPublic[] = await fetchOdooPublic(
            'proyecto.inmobiliario',
            'search_read',
            [[['active', '=', true]]],
            {
                fields: ['id', 'codigo', 'name', 'departamento', 'provincia', 'distrito', 'urbanizacion', 'zona_utm', 'centro_este', 'centro_norte', 'secuencia'],
            }
        );
        return registros.map((r) => ({
            id: r.id,
            codigo: r.codigo,
            nombre: r.name,
            departamento: r.departamento,
            provincia: r.provincia,
            distrito: r.distrito,
            urbanizacion: r.urbanizacion,
            zonaUTM: r.zona_utm,
            orden: r.secuencia,
            ...(r.centro_este ? { centroEste: r.centro_este } : {}),
            ...(r.centro_norte ? { centroNorte: r.centro_norte } : {}),
        }));
    } catch (error) {
        console.warn('[odooPublicService] No se pudieron obtener proyectos:', error);
        return [];
    }
}

// Calles/áreas verdes/etc. — mismo modelo 'elemento.urbano' y misma lógica
// de parseo que usa el mapa de staff (fetchElementosUrbanos en
// odooService.ts), reusada vía fetchElementosUrbanosVia para no duplicar el
// paginado/join con capas. Confirmado en vivo contra Odoo (2026-09-09) que
// la credencial pública (usuario_publico, uid 30) ya puede leer
// elemento.urbano/elemento.urbano.capa sin necesidad de tocar permisos —
// hereda el grupo "Internal User", que en este Odoo tiene también
// write/create/unlink sobre estos dos modelos (sobre-permiso preexistente,
// no introducido acá; ver nota en el mensaje al usuario). Cada elemento ya
// trae su propio mostrarEnMapa/mostrarEtiqueta desde Odoo — el mismo
// interruptor que usa staff para decidir qué se dibuja aplica tal cual acá,
// no hay una lista aparte de exclusiones para la vista pública.
export async function getPublicElementosUrbanos(): Promise<ElementoUrbano[]> {
    return fetchElementosUrbanosVia(fetchOdooPublic);
}

// --- Resolución de UTM (source/medium/campaign) por nombre ---
// No hay cookie automática de tracking como en Odoo Website: el valor viaja
// en la URL del anuncio, el cliente lo manda en el POST, y acá se busca o
// crea el registro correspondiente en Odoo por nombre.
//
// Validación estricta antes de tocar Odoo: sin esto, cualquiera podría
// mandar un utm_source arbitrario y spamear la tabla utm.source para
// siempre (son registros que no se borran solos). Un valor que no matchea
// se descarta del campo relacional (queda solo como texto en 'description'),
// nunca se crea un registro con él.
const UTM_NAME_PATTERN = /^[a-z0-9._-]{1,50}$/;

type UtmModel = 'utm.source' | 'utm.medium' | 'utm.campaign';

// Memoiza ids ya resueltos en este proceso — un lead cuesta como máximo 1
// búsqueda/creación por campo UTM nuevo, no 1 por request.
const utmIdCache = new Map<string, number>();

async function resolveUtmId(model: UtmModel, rawName: string | undefined | null): Promise<number | null> {
    if (!rawName) return null;
    const normalized = rawName.trim().toLowerCase();
    if (!UTM_NAME_PATTERN.test(normalized)) {
        console.warn(`[odooPublicService] Valor UTM rechazado para ${model} (formato inválido):`, rawName);
        return null;
    }

    const cacheKey = `${model}:${normalized}`;
    const cached = utmIdCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const existing = await fetchOdooPublic(model, 'search_read', [[['name', '=', normalized]]], { fields: ['id'], limit: 1 });
    if (existing.length > 0) {
        utmIdCache.set(cacheKey, existing[0].id);
        return existing[0].id;
    }

    try {
        const newId = await fetchOdooPublic(model, 'create', [{ name: normalized }]);
        utmIdCache.set(cacheKey, newId);
        return newId;
    } catch (error) {
        // Carrera posible: otro lead concurrente creó el mismo valor entre
        // el search y el create de arriba. Reintentar la búsqueda antes de
        // rendirse — es mejor que el lead quede sin ese campo relacional a
        // que falle la creación completa del lead.
        console.warn(`[odooPublicService] Falló crear ${model}="${normalized}", reintentando búsqueda:`, error);
        const retry = await fetchOdooPublic(model, 'search_read', [[['name', '=', normalized]]], { fields: ['id'], limit: 1 });
        if (retry.length > 0) {
            utmIdCache.set(cacheKey, retry[0].id);
            return retry[0].id;
        }
        return null;
    }
}

export interface CrearLeadPublicoInput {
    nombre: string;
    telefono: string;
    email?: string;
    lotId: number;
    lotCode: string;
    lotArea?: number;
    lotPrice?: number;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    referrer?: string;
    pageUrl?: string;
}

const DEFAULT_PUBLIC_CRM_TEAM_ID = 5; // RENASUR, verificado en vivo contra Odoo.

export async function crearLeadPublico(input: CrearLeadPublicoInput): Promise<number> {
    const [sourceId, mediumId, campaignId] = await Promise.all([
        resolveUtmId('utm.source', input.utmSource),
        resolveUtmId('utm.medium', input.utmMedium),
        resolveUtmId('utm.campaign', input.utmCampaign),
    ]);

    const teamId = parseInt(process.env.ODOO_PUBLIC_CRM_TEAM_ID || '', 10) || DEFAULT_PUBLIC_CRM_TEAM_ID;

    const descripcionPartes = [
        `Lote: ${input.lotCode}`,
        input.lotArea ? `Área: ${input.lotArea} m²` : null,
        input.lotPrice ? `Precio: S/ ${input.lotPrice.toLocaleString()}` : null,
        `UTM crudo: source=${input.utmSource || '-'} medium=${input.utmMedium || '-'} campaign=${input.utmCampaign || '-'}`,
        input.pageUrl ? `Página: ${input.pageUrl}` : null,
        input.referrer ? `Referrer: ${input.referrer}` : null,
    ].filter(Boolean);

    const vals: Record<string, unknown> = {
        name: `Interés lote ${input.lotCode} — ${input.nombre}`,
        contact_name: input.nombre,
        phone: input.telefono,
        team_id: teamId,
        type: 'opportunity',
        description: descripcionPartes.join('\n'),
    };
    if (input.email) vals.email_from = input.email;
    if (sourceId) vals.source_id = sourceId;
    if (mediumId) vals.medium_id = mediumId;
    if (campaignId) vals.campaign_id = campaignId;

    return fetchOdooPublic('crm.lead', 'create', [vals]);
}

// Revalida que el lote exista y esté activo antes de crear el lead — nunca
// se confía en el lotId que manda el navegador tal cual.
export async function lotExisteYActivo(lotId: number): Promise<{ id: number; default_code: string | false; x_area?: number; list_price?: number } | null> {
    const rows = await fetchOdooPublic(
        'product.template',
        'search_read',
        [[['id', '=', lotId], ['active', '=', true]]],
        { fields: ['id', 'default_code', 'x_area', 'list_price'], limit: 1 }
    );
    return rows[0] || null;
}

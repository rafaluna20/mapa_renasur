import { apiFetch } from '@/app/lib/apiFetch';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { ArcoMetadata } from '@/app/utils/arcoUtils';

// --- Type Definitions ---
export interface OdooUser {
    uid: number;
    name: string;
    username: string;
    session_id: string;
    partner_id: number;
    company_id: number;
    is_system: boolean;
}

export interface OdooProduct {
    id: number;
    name: string;
    default_code: string | false;
    list_price: number;
    qty_available: number;
    x_statu?: string;
    x_area?: number;
    x_mz?: string;
    x_etapa?: string;
    x_lote?: string;
    x_cliente?: string | false;
    x_geometry_utm?: [number, number][] | false;
    // Identifica a qué proyecto/urbanización pertenece el lote (ej. "terra-lima").
    // Campo custom en Odoo — hay que crearlo y poblarlo ahí, no es nativo de
    // product.template. Necesario para resolver la ubicación administrativa
    // correcta por lote cuando hay más de un proyecto.
    x_proyecto?: string | false;
    // Calle/referencia donde da el frente del lote (ej. "CALLE 13",
    // "FRENTE A CALLE 9"). Texto libre cargado por el equipo comercial —
    // 76% de cobertura, con ruido real (espacios, valores placeholder).
    x_ubicacion?: string | false;
    // Metadata de lados curvos (ver product_lot_geometry): [{ indiceVertice,
    // radio, longitudArco, sentido }, ...]. false/[] si el lote no tiene
    // ningún lado curvo (la inmensa mayoría).
    x_geometry_arcos?: ArcoMetadata[] | false;
    // Many2one real a proyecto.inmobiliario (módulo proyecto_inmobiliario).
    // Reemplaza a x_proyecto (texto libre, arriba) — viaja como tupla
    // [id, display_name] por JSON-RPC clásico. x_proyecto se mantiene sin
    // tocar mientras dure la migración de datos.
    x_proyecto_id?: [number, string] | false;
}

// --- Server-Side Fetch Utility ---
// NOTA: Esta función DEBE usarse solo en Server Components o API Routes.
// No la uses directamente en Client Components porque process.env no estará disponible.
export async function fetchOdoo(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {}
) {
    const url = process.env.ODOO_URL;
    if (!url) {
        // Fallback for debugging if run on client by mistake, though it will fail cors likely
        console.error("Missing ODOO_URL. Ensure this is called server-side.");
    }

    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "object",
            method: "execute_kw",
            args: [
                process.env.ODOO_DB,
                parseInt(process.env.ODOO_USER_ID || "0"),
                process.env.ODOO_PASSWORD,
                model,
                method,
                args,
                kwargs
            ]
        },
        id: 2
    };

    try {
        const res = await fetch(url!, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            cache: "no-store",
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Odoo HTTP Error ${res.status}: ${text}`);
        }

        const data = await res.json();

        if (data.error) {
            console.error("Odoo JSON-RPC Error:", JSON.stringify(data.error, null, 2));
            throw new Error(`Odoo Error: ${data.error.message} - ${data.error.data?.message || ''}`);
        }





        return data.result;
    } catch (error) {
        console.error("Fetch Odoo Error:", error);
        throw error;
    }
}

// Registro crudo del modelo Odoo 'elemento.urbano' (módulo elemento_urbano_geometry).
// capa_id viene como tupla [id, display_name] (Many2one vía JSON-RPC clásico,
// no soporta traversal por punto en 'fields' de search_read).
interface OdooElementoUrbano {
    id: number;
    name: string;
    codigo: string | false;
    capa_id: [number, string] | false;
    x_geometry_utm: [number, number][] | false;
    x_geometry_arcos: ArcoMetadata[] | false;
    x_geometry_circulo: { centro: [number, number]; radio: number } | false;
    // IDs de ir.attachment (Many2many) — solo poblado en elementos de la
    // capa "foto". Se resuelven a URLs de /api/odoo/photo/[id] más abajo,
    // nunca se exponen los IDs crudos de Odoo al cliente.
    x_fotos: number[];
    // Many2one a proyecto.inmobiliario — determina la zona UTM real del
    // elemento (ver LeafletMap.tsx). Ausente en elementos aún sin migrar.
    proyecto_id: [number, string] | false;
}

// Registro crudo del modelo Odoo 'elemento.urbano.capa' — capas estilo
// AutoCAD (nombre, código de wire-format, color, si muestra etiqueta, si es
// área o línea), editables desde Odoo sin tocar código en mapa_renasur/plan_pro.
interface OdooElementoUrbanoCapa {
    id: number;
    codigo: string;
    color_borde: string;
    color_relleno: string;
    mostrar_etiqueta: boolean;
    mostrar_en_mapa: boolean;
    es_area: boolean;
    sin_relleno: boolean;
    sin_borde: boolean;
}

/**
 * Trae calles/áreas verdes/etc. desde el modelo Odoo 'elemento.urbano' —
 * intencionalmente NO es product.template, así que nunca puede colarse en
 * mergeLotsData, stats de ventas, ni la página de cotización. Server-side
 * solamente (usa fetchOdoo, que requiere las env vars de servidor).
 * Si el módulo aún no está instalado o la consulta falla, devuelve []
 * silenciosamente (no debe tumbar el mapa ni la generación de planos).
 */
export async function fetchElementosUrbanos(): Promise<ElementoUrbano[]> {
    try {
        // Un elemento es válido con UN polígono (x_geometry_utm) O un
        // círculo completo (x_geometry_circulo) — no hace falta el
        // primero si tiene el segundo.
        // IMPORTANTE: "args" acá debe ser [domain] (un solo elemento que
        // ES la lista de condiciones) — el mismo patrón que la consulta
        // de capas más abajo. Sin este nivel extra de arreglo, Odoo
        // recibe el domain partido en args sueltos (fields/offset/limit
        // con basura), lanza un error server-side, y esta función lo
        // atrapa silenciosamente devolviendo [] — exactamente el bug
        // que dejó de dibujar TODOS los elementos urbanos (no solo los
        // círculos) desde que se agregó el operador '|' acá.
        const domain = [['active', '=', true], '|', ['x_geometry_utm', '!=', false], ['x_geometry_circulo', '!=', false]];
        const PAGE_SIZE = 500;
        const registros: OdooElementoUrbano[] = [];
        // Paginado, no un límite fijo: con un solo import grande (ej. una
        // capa con 1000+ elementos, como pasó al importar "Jardín") un
        // límite fijo corta la consulta a mitad de camino y descarta capas
        // enteras que quedaron después del corte (ej. "Veredas" desapareció
        // del mapa así, sin que sus datos en Odoo tuvieran nada malo).
        for (let offset = 0; ; offset += PAGE_SIZE) {
            const pagina: OdooElementoUrbano[] = await fetchOdoo(
                'elemento.urbano',
                'search_read',
                [domain],
                {
                    fields: ['id', 'name', 'codigo', 'capa_id', 'x_geometry_utm', 'x_geometry_arcos', 'x_geometry_circulo', 'x_fotos', 'proyecto_id'],
                    limit: PAGE_SIZE,
                    offset,
                }
            );
            registros.push(...pagina);
            if (pagina.length < PAGE_SIZE) break;
        }

        const validos = registros.filter((r) => {
            const tieneCirculo = !!(r.x_geometry_circulo && r.x_geometry_circulo.radio);
            const tienePoligono = Array.isArray(r.x_geometry_utm) && r.x_geometry_utm.length >= 3;
            return (tieneCirculo || tienePoligono) && r.capa_id;
        });
        if (validos.length === 0) return [];

        // Segunda consulta (join manual): capa_id solo trae [id, nombre] por
        // JSON-RPC, así que el color/mostrar_etiqueta/es_area de cada capa
        // se resuelve en un solo search_read adicional por los ids usados.
        const capaIds = [...new Set(validos.map((r) => (r.capa_id as [number, string])[0]))];
        const capas: OdooElementoUrbanoCapa[] = await fetchOdoo(
            'elemento.urbano.capa',
            'search_read',
            [[['id', 'in', capaIds]]],
            { fields: ['id', 'codigo', 'color_borde', 'color_relleno', 'mostrar_etiqueta', 'mostrar_en_mapa', 'es_area', 'sin_relleno', 'sin_borde'] }
        );
        const capaPorId = new Map(capas.map((c) => [c.id, c]));

        return validos
            .map((r) => {
                const capa = capaPorId.get((r.capa_id as [number, string])[0]);
                if (!capa) return null;
                return {
                    codigo: r.codigo || `elemento-urbano-${r.id}`,
                    nombre: r.name,
                    tipo: capa.codigo,
                    colorBorde: capa.color_borde,
                    colorRelleno: capa.color_relleno,
                    mostrarEtiqueta: capa.mostrar_etiqueta,
                    mostrarEnMapa: capa.mostrar_en_mapa,
                    esArea: capa.es_area,
                    sinRelleno: !!capa.sin_relleno,
                    sinBorde: !!capa.sin_borde,
                    ...(r.proyecto_id ? { proyectoId: r.proyecto_id[0] } : {}),
                    points: (r.x_geometry_utm || []) as [number, number][],
                    ...(r.x_geometry_arcos ? { arcos: r.x_geometry_arcos } : {}),
                    ...(r.x_geometry_circulo ? { circulo: r.x_geometry_circulo } : {}),
                    ...(Array.isArray(r.x_fotos) && r.x_fotos.length > 0
                        ? { fotos: r.x_fotos.map((attachmentId) => `/api/odoo/photo/${attachmentId}`) }
                        : {}),
                };
            })
            .filter((e): e is ElementoUrbano => e !== null);
    } catch (error) {
        console.warn('No se pudieron obtener elementos urbanos desde Odoo (¿módulo elemento_urbano_geometry instalado?):', error);
        return [];
    }
}

// Registro crudo del modelo Odoo 'proyecto.inmobiliario' (módulo
// proyecto_inmobiliario) — fuente única de proyectos, reemplaza al
// diccionario UBICACION_POR_PROYECTO que antes vivía hardcodeado en
// mapa_renasur. Crear un proyecto nuevo es un registro en Odoo, no un
// deploy de código.
export interface Proyecto {
    id: number;
    codigo: string;
    nombre: string;
    departamento: string;
    provincia: string;
    distrito: string;
    urbanizacion: string;
    /** '17' | '18' | '19' — Selection en Odoo, viaja como string. */
    zonaUTM: string;
    centroEste?: number;
    centroNorte?: number;
    /** Campo Odoo 'secuencia' ("Orden") — define cuál proyecto es el
     *  default cuando el filtro del mapa está en "Todos los proyectos". */
    orden: number;
}

interface OdooProyectoInmobiliario {
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

/**
 * Trae todos los proyectos inmobiliarios activos desde Odoo. Si el módulo
 * proyecto_inmobiliario todavía no está instalado (o la consulta falla por
 * cualquier motivo), devuelve [] silenciosamente — mismo criterio que
 * fetchElementosUrbanos, para no tumbar el mapa ni la generación de planos
 * mientras se completa el rollout de este módulo.
 */
export async function fetchProyectos(): Promise<Proyecto[]> {
    try {
        const registros: OdooProyectoInmobiliario[] = await fetchOdoo(
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
        console.warn('No se pudieron obtener proyectos desde Odoo (¿módulo proyecto_inmobiliario instalado?):', error);
        return [];
    }
}

// --- Chatbot IA: búsqueda de lotes (solo lectura) ---

export interface LoteChatFiltros {
    areaMin?: number;
    areaMax?: number;
    manzana?: string;
    etapa?: string;
    precioMax?: number;
    estado?: 'disponible' | 'reservado' | 'vendido';
    // Número de lote (ej. "92" o "092") para búsquedas puntuales tipo
    // "manzana D lote 92". Se compara contra x_lote sin ceros a la
    // izquierda — NO se reconstruye el código completo (E01MZD092P):
    // eso obligaría a adivinar la etapa y el sufijo de partición (P vs
    // 1/2), que no son deducibles solo de "lote 92".
    numeroLote?: string;
    // Código de lote completo o parcial (ej. "E01MZD092P"), para cuando
    // el usuario pega el código directamente. Búsqueda por substring.
    codigo?: string;
}

export interface LoteChatResultado {
    codigo: string;
    areaM2: number;
    manzana: string;
    etapa: string;
    // null = sin precio publicado en Odoo (list_price=0). El chatbot debe
    // mostrar "Consultar con asesor", nunca "S/ 0" — inventar un precio de
    // 0 sería tan grave como inventar cualquier otro dato.
    precio: number | null;
    ubicacion: string | null;
    estado: string;
}

interface OdooLoteChatRaw {
    id: number;
    default_code: string | false;
    x_area: number | false;
    x_mz: string | false;
    x_etapa: string | false;
    x_lote: string | false;
    x_statu: string | false;
    list_price: number;
    x_ubicacion: string | false;
}

/**
 * Búsqueda de lotes para el chatbot — SOLO LECTURA, sin excepciones.
 * Nunca debe usarse para escribir en Odoo. Filtra por defecto a
 * estado='disponible' (a menos que se pida explícitamente otro estado):
 * un chatbot público que sugiere lotes ya vendidos como si estuvieran
 * libres es un problema comercial real, no un detalle.
 *
 * EXCEPCIÓN al filtro de disponibilidad: cuando la búsqueda es puntual
 * (numeroLote o codigo — "quiero el lote 92", "busco E01MZD092P"), NO se
 * filtra por estado a menos que se pida explícitamente. Alguien
 * preguntando por un lote específico puede estar consultando el suyo
 * propio, ya vendido o reservado — ocultarlo sería peor que mostrarlo
 * con su estado real.
 *
 * IMPORTANTE (ver auditoría de datos previa a este código): la proximidad
 * a parques/calles NO está soportada — el módulo elemento.urbano no tiene
 * datos reales cargados en producción todavía (0 parques activos). No se
 * agrega un filtro de proximidad aquí a propósito.
 */
export async function buscarLotesParaChat(filtros: LoteChatFiltros): Promise<LoteChatResultado[]> {
    const domain: unknown[] = [
        ['default_code', '!=', false],
        ['active', '=', true],
    ];

    const esBusquedaPuntual = !!(filtros.numeroLote || filtros.codigo);
    if (filtros.estado) {
        domain.push(['x_statu', '=', filtros.estado]);
    } else if (!esBusquedaPuntual) {
        domain.push(['x_statu', '=', 'disponible']);
    }

    if (filtros.areaMin != null) domain.push(['x_area', '>=', filtros.areaMin]);
    if (filtros.areaMax != null) domain.push(['x_area', '<=', filtros.areaMax]);
    if (filtros.manzana) domain.push(['x_mz', '=ilike', filtros.manzana]);
    if (filtros.etapa) domain.push(['x_etapa', 'ilike', filtros.etapa]);
    // Un lote con list_price=0 significa "sin precio publicado", no "gratis"
    // — nunca debe aparecer como si costara menos que el máximo pedido.
    if (filtros.precioMax != null) {
        domain.push(['list_price', '<=', filtros.precioMax]);
        domain.push(['list_price', '>', 0]);
    }
    // x_lote se guarda sin ceros a la izquierda (ej. "92", no "092") — se
    // normaliza la entrada del usuario para no fallar por "092" vs "92".
    // NO se reconstruye el código completo (evita tener que adivinar
    // etapa/sufijo de partición).
    if (filtros.numeroLote) {
        const numeroNormalizado = filtros.numeroLote.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        if (numeroNormalizado) domain.push(['x_lote', '=', numeroNormalizado]);
    }
    if (filtros.codigo) {
        domain.push(['default_code', 'ilike', filtros.codigo.trim()]);
    }

    const registros: OdooLoteChatRaw[] = await fetchOdoo(
        'product.product',
        'search_read',
        [domain],
        {
            fields: ['id', 'default_code', 'x_area', 'x_mz', 'x_etapa', 'x_lote', 'x_statu', 'list_price', 'x_ubicacion'],
            // Código de lote real = 10 caracteres exactos (ej. E01MZD148P) —
            // mismo criterio usado en los endpoints de stats para excluir
            // "otros productos" (materiales, servicios, etc.).
            limit: 200,
            order: 'list_price asc',
        }
    );

    return registros
        .filter((r) => r.default_code && typeof r.default_code === 'string' && r.default_code.trim().length === 10)
        .slice(0, 20)
        .map((r) => ({
            codigo: r.default_code as string,
            areaM2: r.x_area || 0,
            manzana: r.x_mz || 'S/M',
            etapa: r.x_etapa || 'S/E',
            precio: r.list_price > 0 ? r.list_price : null,
            ubicacion: r.x_ubicacion || null,
            estado: r.x_statu || 'desconocido',
        }));
}

// --- Client-Side Auth Service ---
export const odooService = {
    async login(login: string, pass: string): Promise<OdooUser> {
        // We will hit our own API route which will handle the proxying
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password: pass }),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Authentication Failed');
        }

        // Return the user data structure
        return result.user;
    },

    // Generic search_read for querying Odoo models
    async searchRead<T = Record<string, unknown>>(
        model: string,
        domain: (string | [string, string, unknown])[],
        fields: string[] = []
    ): Promise<T[]> {
        const response = await apiFetch('/api/odoo/search-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, domain, fields })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Search failed');
        }

        const data = await response.json();
        return data.records || [];
    },

    // Generic read for fetching specific records
    async read<T = Record<string, unknown>>(
        model: string,
        id: number | number[],
        fields: string[] = []
    ): Promise<T | T[]> {
        const ids = Array.isArray(id) ? id : [id];

        const response = await apiFetch('/api/odoo/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, ids, fields })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Read failed');
        }

        const data = await response.json();
        const records = data.records || [];
        return Array.isArray(id) ? records : records[0];
    },

    // Generic call for executing Odoo model methods
    async call(
        model: string,
        method: string,
        args: unknown[] = [],
        kwargs: Record<string, unknown> = {}
    ): Promise<unknown> {
        const response = await apiFetch('/api/odoo/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, method, args, kwargs })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Call failed');
        }

        const data = await response.json();
        return data.result;
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getSalesCount(_partnerId: number): Promise<number> {
        // Placeholder for future implementation
        return 0;
    },

    async getSalesStats(userId: number): Promise<{ sold: number, reserved: number, draft: number, totalValue: number }> {
        const response = await apiFetch(`/api/odoo/stats?userId=${userId}`);
        const result = await response.json();

        if (!result.success) {
            console.error("Failed to fetch stats:", result.error);
            return { sold: 0, reserved: 0, draft: 0, totalValue: 0 };
        }

        return result.stats;
    },

    async updateLotStatus(productId: string | number, status: string, clientName?: string): Promise<boolean> {
        try {
            const response = await apiFetch('/api/odoo/update_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, newStatus: status, clientName }),
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || "Error desconocido en API");
            }
            return true;
        } catch (error) {
            console.error("Error updating status:", error);
            throw error;
        }
    },

    async getDetailedSalesStats(userId: number, startDate?: string, endDate?: string): Promise<{
        kpis: { totalSales: number; monthlyGoal: number; commission: number; commissionRate: number; pendingLeads: number; conversionRate: number; pipelineValue: number };
        // Comparación real contra el período anterior de igual duración —
        // calculada server-side (ver app/api/odoo/stats/detailed/route.ts),
        // ya no un +15%/+12%/+8% fijo armado en el cliente.
        comparison: {
            totalSales: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
            commission: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
            salesCount: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
        };
        salesTrend: { name: string; ventas: number }[];
        recentActivity: { id: number; action: string; lot: string; date: string }[];
        competedLots: { lot: string; stage: string; quotes: { client: string; advisor: string; hours: number }[] }[];
        assignedLots: { lot: string; stage: string; client: string; status: string; price: number }[];
    }> {
        let url = `/api/odoo/stats/detailed?userId=${userId}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        const response = await apiFetch(url);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Failed to fetch detailed stats");
        }

        return result.stats;
    },

    async getGeneralProjectStats(userId: number, isSystem: boolean, startDate?: string, endDate?: string): Promise<{
        kpis: {
            totalSales: number;
            projectValue: number;
            commission: number;
            occupationRate: number;
            totalLots: number;
            soldLots: number;
            reservedLots: number;
            availableLots: number;
        };
        salesTrend: { name: string; ventas: number }[];
        advisorRanking: { name: string; lotsCount: number; amountTotal: number; commission: number }[];
        recentActivity: { id: number; action: string; lot: string; advisor: string; date: string }[];
    }> {
        let url = '/api/odoo/stats/general';
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await apiFetch(url, {
            headers: {
                'X-User-Id': String(userId),
                'X-Is-System': String(isSystem)
            }
        });
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Failed to fetch general stats");
        }

        return result.stats;
    },

    // --- LEVEL 2: Real Exchange Architecture (Sales & Partners) ---

    // 1. Search for clients (res.partner) for the dropdown
    async searchPartners(query: string): Promise<Record<string, unknown>[]> {
        if (!query) return [];
        try {
            const response = await apiFetch('/api/odoo/search_partners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            return result.results;
        } catch (error) {
            console.error("Error searching partners:", error);
            return [];
        }
    },

    // 1b. Create a new client/partner in Odoo
    async createPartner(data: { name: string; vat: string; phone?: string; email?: string }): Promise<{ id: number; name: string }> {
        try {
            const response = await apiFetch('/api/odoo/create_partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            // El route devuelve el campo como 'id' (ver create_partner/route.ts
            // línea 37: `{ success: true, id: newPartnerId, name }`) — leer
            // 'result.partnerId' acá devolvía siempre undefined, así que todo
            // cliente nuevo creado desde la cotización quedaba con id
            // indefinido (rompía cualquier uso posterior de selectedClient.id).
            return { id: result.id, name: data.name };
        } catch (error) {
            console.error("Error creating partner:", error);
            throw error;
        }
    },

    // 1c. Actualizar los datos de contacto de un cliente ya existente —
    // antes de esto no había forma de corregir un DNI/teléfono/correo mal
    // cargado sin ir directo al CRM de Odoo.
    async updatePartner(data: { id: number; name: string; vat: string; phone?: string; email?: string }): Promise<{ id: number; name: string }> {
        try {
            const response = await apiFetch('/api/odoo/update_partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            return { id: data.id, name: data.name };
        } catch (error) {
            console.error("Error updating partner:", error);
            throw error;
        }
    },

    async createSaleOrder(
        partnerId: number,
        defaultCode: string,
        price: number,
        notes?: string,
        userId?: number,
        quoteDetails?: {
            installments?: number;
            downPayment?: number;
            discount?: number;
            firstInstallmentDate?: string;
        }
    ): Promise<number> {
        try {
            const response = await apiFetch('/api/odoo/create_sale_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId, defaultCode, price, notes, userId, quoteDetails }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            console.log(`✅ Sale Order Created: ${result.orderId}`);
            return result.orderId;
        } catch (error) {
            console.error("Error creating sale order:", error);
            throw error;
        }
    },

    // 3. Attach Evidence to the Order
    async addAttachmentToOrder(orderId: number, file: File): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('orderId', orderId.toString());
            formData.append('file', file);

            const response = await apiFetch('/api/odoo/add_attachment', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            console.log(`✅ Attachment uploaded: ${file.name}`);
            return true;
        } catch (error) {
            console.error("Error uploading attachment:", error);
            throw error;
        }
    },

    // Get active quotes (draft sales orders) for a specific lot
    async getActiveQuotesByLot(defaultCode: string, userId?: number): Promise<{ count: number; quotes: Record<string, unknown>[] }> {
        try {
            const response = await apiFetch('/api/odoo/get_active_quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultCode, userId })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            return {
                count: result.quotes?.length || 0,
                quotes: result.quotes || []
            };
        } catch (error) {
            console.error("Error fetching active quotes:", error);
            return { count: 0, quotes: [] };
        }
    },

    // Refactored Reserve Method to use the new flow
    // This is the "Orchestrator" function called by the UI
    async processReservationLevel2(lotDefaultCode: string, partnerId: number, price: number, files: File[], notes: string, separationAmount?: number) {
        try {
            // Step A: Create the Order in Odoo (Draft state)
            const orderId = await this.createSaleOrder(partnerId, lotDefaultCode, price, notes);
            console.log("✅ Sale Order Created:", orderId);

            // Step B: Upload Payment Evidence for each file
            for (const f of files) {
                await this.addAttachmentToOrder(orderId, f);
            }
            console.log("✅ All payment proofs attached to order");

            // Step C: Confirm Order (Draft -> Sale)
            const confirmRes = await apiFetch('/api/odoo/confirm_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, separationAmount })
            });
            const confirmResult = await confirmRes.json();
            if (!confirmResult.success) {
                // If confirmation fails (e.g. Odoo automation error), we still have the draft order
                // We throw so the UI shows the error
                throw new Error(confirmResult.error || 'Failed to confirm order');
            }
            console.log("✅ Order confirmed (State: Sale)");

            // Step D: Create Recurring Contract (BACKUP/MANUAL MODE)
            // We call this explicitly from Next.js to ensure it happens
            // even if the Odoo Automated Action was disabled or failed silently.
            try {
                const contract = await this.createRecurringContract(orderId);
                console.log("✅ Contract created successfully by Orchestrator:", contract.contractId);
            } catch (contractError) {
                console.warn("⚠️ Contract creation warning (might be duplicate or Odoo Auto-Action ran first):", contractError);
                // We don't fail the whole process if just the contract step glitches, 
                // because the sale is already confirmed and money is safe.
            }

            // Step E: Update Lot Status to 'reservado'
            // We can try to look up the product ID if we don't have it, or rely on Odoo
            console.log("ℹ️ Pending: Lot status update to 'reservado' (should be handled by Odoo or separate call)");

            return { success: true, orderId };
        } catch (error) {
            console.error("❌ Level 2 Reservation Failed:", error);
            throw error;
        }
    },

    // Confirm a local quote and create it in Odoo
    async confirmLocalQuote(
        lotDefaultCode: string,
        clientData: { id?: number; name: string; vat?: string; phone?: string; email?: string },
        price: number,
        notes: string,
        quoteDetails: {
            installments: number;
            downPayment: number;
            discount: number;
            firstInstallmentDate: string;
        },
        pdfFile?: File, // Archivo de cotización PDF opcional
        userId?: number // ID del usuario logueado para asignar como vendedor
    ): Promise<{ orderId: number; partnerId: number }> {
        try {
            // Step 1: Create or find partner (skip if we already have an ID)
            let partnerId = clientData.id;

            if (!partnerId) {
                if (!clientData.vat) {
                    throw new Error('VAT/DNI is required to confirm quote for new clients');
                }
                const partner = await this.createPartner({
                    name: clientData.name,
                    vat: clientData.vat,
                    phone: clientData.phone,
                    email: clientData.email
                });
                partnerId = partner.id;
                console.log("✅ Partner Created:", partnerId);
            } else {
                console.log("✅ Using Existing Partner:", partnerId);
            }

            // Step 2: Create sale order in draft state with extended details
            const orderId = await this.createSaleOrder(
                partnerId,
                lotDefaultCode,
                price,
                notes,
                userId,
                quoteDetails
            );
            console.log("✅ Sale Order Created:", orderId);

            // Step 3: Update lot status to 'cotizacion'
            // Note: We need to search for the product by default_code first
            const products = await apiFetch('/api/odoo/search_product_by_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultCode: lotDefaultCode })
            }).then(r => r.json());

            if (products.success && products.productId) {
                // Pass the client name to be saved in x_cliente
                await this.updateLotStatus(products.productId, 'cotizacion', clientData.name);
                console.log("✅ Lot status updated to 'cotizacion' with client: " + clientData.name);
            }

            // Step 4: Attach PDF Quote if provided (and valid)
            if (pdfFile && pdfFile instanceof File) {
                await this.addAttachmentToOrder(orderId, pdfFile);
                console.log("✅ Quote PDF attached to order");
            } else if (pdfFile) {
                console.warn("⚠️ PDF passed is not a File object, skipping attachment:", pdfFile);
            }

            return { orderId, partnerId };
        } catch (error) {
            console.error("❌ Quote Confirmation Failed:", error);
            throw error;
        }
    },

    // Reserve a lot that already has a confirmed quote (draft order)
    async reserveQuotedLot(orderId: number, file: File | File[], notes: string, userId?: number, separationAmount?: number) {
        try {
            // 1. Fetch the existing draft order details using the new API feature
            const searchRes = await apiFetch('/api/odoo/find_draft_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, userId })
            }).then(r => r.json());

            if (!searchRes.success || !searchRes.order) {
                throw new Error("No se pudo encontrar los detalles de la cotización en Odoo.");
            }

            const { productId, productTmplId, partnerName } = searchRes.order;
            console.log(`✅ Found existing draft order: ${orderId} for product ${productId}, Client: ${partnerName}`);

            // 2. Upload Payment Evidence
            const filesArray = Array.isArray(file) ? file : [file];
            for (const f of filesArray) {
                await this.addAttachmentToOrder(orderId, f);
            }
            console.log("✅ All payment proofs attached to existing order");

            // 3. CONFIRM ORDER (Draft -> Sale) - FIRST RESERVE WINS!
            const confirmRes = await apiFetch('/api/odoo/confirm_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, separationAmount })
            });
            const confirmResult = await confirmRes.json();
            if (!confirmResult.success) {
                throw new Error(confirmResult.error || 'Failed to confirm order');
            }
            console.log("🏆 Order confirmed! This reservation WINS the lot.");

            // 3.5 ORCHESTRATION (Plan B): Create Recurring Contract Manually
            try {
                const contract = await this.createRecurringContract(orderId);
                console.log("✅ Contract created successfully via Plan B:", contract.contractId);
            } catch (contractError) {
                console.warn("⚠️ Contract creation warning (User should check Odoo):", contractError);
                // Non-blocking: The sale is already confirmed, so we proceed.
            }

            // 4. Update Lot Status to 'reservado' AND Force Client Name Update
            // Use Template ID if available (because update_status uses product.template), else fallback to Variant ID
            if (productTmplId) {
                // FORCE WRITE the client name from the winning order to ensure data consistency
                await this.updateLotStatus(productTmplId, 'reservado', partnerName);
                console.log(`✅ Lot status updated to 'reservado' with Client '${partnerName}' (Template: ${productTmplId})`);
            } else if (productId) {
                await this.updateLotStatus(productId, 'reservado', partnerName);
                console.log(`✅ Lot status updated to 'reservado' with Client '${partnerName}' (Variant: ${productId})`);
            }

            return { success: true, orderId };
        } catch (error) {
            console.error("❌ Reserve Quoted Lot Failed:", error);
            throw error;
        }
    },



    // Get the owner of a reserved lot (Salesperson who confirmed the order)
    // Process a refund: creates credit note if invoice exists, otherwise cancels the order
    async processRefund(orderId: number, refundAmount: number, reason: string): Promise<{ success: boolean; action?: string; newLotStatus?: string; error?: string }> {
        try {
            const response = await apiFetch('/api/odoo/process_refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, refundAmount, reason })
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error("Error processing refund:", error);
            return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
        }
    },

    // Get the owner of a reserved lot (Salesperson who confirmed the order)
    async getReservationOwner(defaultCode: string): Promise<{ ownerId: number; ownerName: string; partnerId: number; clientName: string; clientPhone: string | null; clientEmail: string | null; clientDni: string | null; totalInstallments: number; orderId: number; separationAmount?: number | null } | null> {
        try {
            const response = await apiFetch('/api/odoo/get_reservation_owner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultCode })
            });
            const result = await response.json();
            if (!result.success || !result.ownerId) return null;
            return {
                ownerId: result.ownerId,
                ownerName: result.ownerName,
                partnerId: result.partnerId,
                clientName: result.clientName,
                clientPhone: result.clientPhone || null,
                clientEmail: result.clientEmail || null,
                clientDni: result.clientDni || null,
                totalInstallments: result.totalInstallments || 72,
                orderId: result.orderId,
                separationAmount: result.separationAmount
            };
        } catch (error) {
            console.error("Error fetching reservation owner:", error);
            return null;
        }
    },

    // Get invoices for a specific client (partner_id) and optionally filter by product (lot)
    async getClientInvoices(partnerId: number, productCode?: string): Promise<Record<string, unknown>[]> {
        try {
            const response = await apiFetch('/api/odoo/get_client_invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partnerId,
                    productCode // 🆕 Pasar código del producto para filtrar
                })
            });
            const result = await response.json();
            if (!result.success) return [];
            return result.invoices || [];
        } catch (error) {
            console.error("Error fetching client invoices:", error);
            return [];
        }
    },

    // --- MOCK: Reservation Logic with Evidence (Legacy/Simple) ---
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async reserveLotWithEvidence(productId: number, userId: number, file: File, notes: string): Promise<unknown> {
        // Deprecated in favor of processReservationLevel2 for the new flow,
        // but kept for backward compatibility if needed.
        return this.updateLotStatus(productId, 'separado');
    },

    // --- MOCK: Locking System ---
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async checkLotLock(productId: number): Promise<{ isLocked: boolean; lockedBy?: string }> {
        // Simulation: Lots ending in '5' are locked by another user
        // In production, this would call a real endpoint checking an ephemeral lock (Redis/Odoo)
        return { isLocked: false }; // The UI does the mock logic for now based on name
    },

    // --- MOCK: Management Dashboard ---
    async getPendingReservations(): Promise<Record<string, unknown>[]> {
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 800));

        return [
            {
                id: 101,
                lotName: "A-05",
                advisor: "Carlos V.",
                customer: "Juan Pérez",
                date: "Hace 10 min",
                amount: 156000,
                evidenceUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=300&h=400", // Sample receipt
                status: "pending_approval"
            },
            {
                id: 102,
                lotName: "C-12",
                advisor: "Ana M.",
                customer: "Maria Rodriguez",
                date: "Hace 2 horas",
                amount: 142000,
                evidenceUrl: "https://images.unsplash.com/photo-1628102491629-778571d893a3?auto=format&fit=crop&q=80&w=300&h=400", // Sample receipt
                status: "pending_approval"
            }
        ];
    },

    async approveReservation(reservationId: number): Promise<boolean> {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[MOCK] Review approved for reservation ${reservationId}`);
        return true;
    },

    async rejectReservation(reservationId: number, reason: string): Promise<boolean> {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[MOCK] Review rejected for reservation ${reservationId}. Reason: ${reason}`);
        // In real app, this would free the lot (updateLotStatus -> libre)
        return true;
    },

    // Create recurring contract from sale order
    async createRecurringContract(saleOrderId: number): Promise<{ contractId: number; details: unknown }> {
        try {
            const response = await apiFetch('/api/odoo/create_contract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleOrderId })
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to create contract');
            }

            console.log(`✅ Recurring Contract Created: ${result.contractId}`);
            return {
                contractId: result.contractId,
                details: result.details
            };
        } catch (error) {
            console.error("Error creating recurring contract:", error);
            throw error;
        }
    },

    // --- LEVEL 3: Payment Registration (In Payment Status) ---
    // Pasa por el endpoint asegurado del módulo Odoo (/api/simple_contract/pay_invoice:
    // API key propia, rate limit, y chequeo de que la factura pertenece a un
    // contrato/compañía accesible) en vez de crear account.payment.register
    // directo con la cuenta admin compartida. El endpoint ya resuelve el
    // diario y el payment_method_line_id por su cuenta si no se especifican.
    async createPayment(
        invoiceId: number,
        amount: number,
        paymentDate: string,
        paymentRef: string,
        journalId?: number,
        partnerId?: number
    ): Promise<unknown> {
        const response = await apiFetch('/api/odoo/pay-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoiceId,
                amount,
                paymentDate,
                ref: paymentRef,
                journalId,
                partnerId,
            }),
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || result.message || 'Error al registrar el pago');
        }
        return result;
    }
};

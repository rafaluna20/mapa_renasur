import type { Proyecto } from '@/app/services/odooService';

// Lectura de proyectos desde Odoo (`proyecto.inmobiliario`), compartida por el mapa de staff (fetchProyectos) y la landing
// pública (getPublicProyectos). Antes cada una repetía la consulta y el mapeo.
//
// Desde P5 el proyecto trae además su OFERTA COMERCIAL (cuota inicial, WhatsApp, servicios…), que antes estaba escrita en
// el código. Esos campos solo existen si `proyecto_inmobiliario` >= 1.10.0 está desplegado en Odoo: pedirlos a un Odoo
// más viejo lanza un error y la función antigua devolvía [] (el mapa se quedaba SIN proyectos). Por eso aquí se intenta
// primero con todos los campos y, si falla, con los de siempre: desplegar la app antes que Odoo no rompe nada.

type Rpc = (model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown>;

export const CAMPOS_BASE = [
  'id', 'codigo', 'name', 'departamento', 'provincia', 'distrito', 'urbanizacion',
  'zona_utm', 'centro_este', 'centro_norte', 'secuencia',
];

export const CAMPOS_OFERTA = [
  'tipo', 'publicar_web', 'cuota_inicial', 'nro_cuotas', 'whatsapp_numero', 'whatsapp_visible',
  'distancia_referencia_km', 'referencia_nombre', 'direccion_referencia', 'servicios', 'frase_habilitacion',
  'resolucion_municipal', 'etiqueta_agrupador', 'etiqueta_numero', 'color_primario', 'es_principal', 'logo_url',
];

export interface ProyectoCrudo {
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
  // Solo con proyecto_inmobiliario >= 1.10.0. Odoo devuelve `false` en un campo vacío.
  tipo?: string | false;
  publicar_web?: boolean;
  es_principal?: boolean;
  cuota_inicial?: number | false;
  nro_cuotas?: number | false;
  whatsapp_numero?: string | false;
  whatsapp_visible?: string | false;
  distancia_referencia_km?: number | false;
  referencia_nombre?: string | false;
  direccion_referencia?: string | false;
  servicios?: string | false;
  frase_habilitacion?: string | false;
  resolucion_municipal?: string | false;
  etiqueta_agrupador?: string | false;
  etiqueta_numero?: string | false;
  color_primario?: string | false;
  logo_url?: string | false;
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export function mapearProyecto(r: ProyectoCrudo): Proyecto {
  // La oferta existe solo si Odoo devolvió los campos nuevos (aunque estén vacíos): distingue «Odoo viejo» de «sin cargar».
  const tieneCamposNuevos = 'cuota_inicial' in r;
  return {
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
    ...(tieneCamposNuevos
      ? {
          tipo: texto(r.tipo) ?? 'lotizacion',
          publicarWeb: r.publicar_web === true,
          esPrincipal: r.es_principal === true,
          etiquetaAgrupador: texto(r.etiqueta_agrupador) ?? 'Manzana',
          etiquetaNumero: texto(r.etiqueta_numero) ?? 'Lote',
          colorPrimario: texto(r.color_primario),
          logoUrl: texto(r.logo_url),
          oferta: {
            cuotaInicial: numero(r.cuota_inicial),
            nroCuotas: numero(r.nro_cuotas),
            whatsappNumero: texto(r.whatsapp_numero),
            whatsappVisible: texto(r.whatsapp_visible),
            distanciaReferenciaKm: numero(r.distancia_referencia_km),
            referenciaNombre: texto(r.referencia_nombre),
            direccionReferencia: texto(r.direccion_referencia),
            servicios: texto(r.servicios),
            fraseHabilitacion: texto(r.frase_habilitacion),
            resolucionMunicipal: texto(r.resolucion_municipal),
          },
        }
      : {}),
  };
}

/** Proyectos ACTIVOS. Nunca lanza: ante un fallo total devuelve [] (mismo criterio de siempre, para no tumbar el mapa). */
export async function leerProyectosVia(rpc: Rpc, etiqueta = 'proyectos'): Promise<Proyecto[]> {
  const consultar = (fields: string[]) =>
    rpc('proyecto.inmobiliario', 'search_read', [[['active', '=', true]]], { fields }) as Promise<ProyectoCrudo[]>;
  try {
    return (await consultar([...CAMPOS_BASE, ...CAMPOS_OFERTA])).map(mapearProyecto);
  } catch (error) {
    console.warn(
      `[${etiqueta}] No se pudieron leer los campos de oferta (¿proyecto_inmobiliario >= 1.10.0 desplegado?); se usan los campos básicos:`,
      error instanceof Error ? error.message : error,
    );
  }
  try {
    return (await consultar(CAMPOS_BASE)).map(mapearProyecto);
  } catch (error) {
    console.warn(`[${etiqueta}] No se pudieron obtener proyectos desde Odoo (¿módulo proyecto_inmobiliario instalado?):`, error);
    return [];
  }
}

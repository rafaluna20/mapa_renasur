'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { MARCAS_LEGADAS, marcaPorId, type Marca, type MarcasDisponibles } from '@/app/lib/marca';

// Reparte la marca (nombre y logo del proyecto) a los componentes. El layout (servidor) la lee de Odoo y la pone aquí;
// una pantalla con un proyecto elegido (el mapa) puede fijar el «actual» con <MarcaActual proyectoId={…}>.
// Sin proveedor (o con un Odoo sin los campos de P5) todo queda con la marca de siempre.

interface Valor {
  marcas: MarcasDisponibles;
  actualId: number | null;
}

const MarcaCtx = createContext<Valor>({ marcas: MARCAS_LEGADAS, actualId: null });

export function MarcaProvider({ marcas, children }: { marcas: MarcasDisponibles; children: ReactNode }) {
  return <MarcaCtx.Provider value={{ marcas, actualId: null }}>{children}</MarcaCtx.Provider>;
}

/** Fija el proyecto «actual» para todo lo que cuelga de aquí (p. ej. el proyecto elegido en el mapa). null = el principal. */
export function MarcaActual({ proyectoId, children }: { proyectoId: number | null; children: ReactNode }) {
  const { marcas } = useContext(MarcaCtx);
  return <MarcaCtx.Provider value={{ marcas, actualId: proyectoId }}>{children}</MarcaCtx.Provider>;
}

export function useMarcas(): MarcasDisponibles {
  return useContext(MarcaCtx).marcas;
}

/** La marca de un proyecto concreto (por id) o, sin id, la del proyecto actual; si no hay, la principal. */
export function useMarca(proyectoId?: number | null): Marca {
  const { marcas, actualId } = useContext(MarcaCtx);
  return marcaPorId(marcas, proyectoId ?? actualId);
}

import { NextResponse } from 'next/server';

/**
 * RETIRADA (P3 multiproyecto, 2026-11-06).
 *
 * Leía cualquier registro de los modelos permitidos sin comprobar su proyecto.
 *
 * Ningún código de la app ni los flujos de n8n del repositorio la usaban. Se retira en vez de acotarla por proyecto:
 * una ruta genérica que reenvía el modelo y el método tal cual no se puede proteger por proyecto con garantías.
 * Si algún día hace falta algo equivalente, crear una ruta específica con su guardia (ver app/lib/accesoProyectos.ts)
 * y registrarla en app/lib/rutasAcceso.ts.
 *
 * Reversa: restaurar este archivo desde el commit anterior de git.
 */
const RESPUESTA = () =>
  NextResponse.json(
    { success: false, error: 'Esta ruta fue retirada.' },
    { status: 410 },
  );

export const POST = RESPUESTA;

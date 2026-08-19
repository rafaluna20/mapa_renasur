import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/app/lib/staffAuth';

/**
 * Estadísticas de descargas del documento "resumen" (por usuario y total),
 * más el total de expedientes completos generados. Solo administradores —
 * mismo criterio que el resto de funciones de "Plano y Memoria" que todavía
 * no están abiertas a todo el staff.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffSession(request);
  if (auth.response) return auth.response;

  if (!auth.session.isSystem) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Solo administradores pueden ver estas estadísticas.' } },
      { status: 403 }
    );
  }

  const PLANOS_API_URL = process.env.PLANOS_API_URL;
  const PLANOS_API_KEY = process.env.PLANOS_API_KEY;

  if (!PLANOS_API_URL || !PLANOS_API_KEY) {
    console.error('Faltan PLANOS_API_URL / PLANOS_API_KEY en el entorno del servidor');
    return NextResponse.json(
      { success: false, error: { code: 'CONFIG_ERROR', message: 'Integración de planos no configurada' } },
      { status: 500 }
    );
  }

  try {
    const statsResponse = await fetch(`${PLANOS_API_URL}/api/v1/planos/descargas-stats`, {
      headers: { 'x-api-key': PLANOS_API_KEY },
    });
    const statsData = await statsResponse.json();

    if (!statsResponse.ok) {
      return NextResponse.json(
        { success: false, error: statsData.error || { code: 'PLANOS_API_ERROR', message: 'Error obteniendo estadísticas' } },
        { status: statsResponse.status }
      );
    }

    return NextResponse.json(statsData);
  } catch (error) {
    console.error('Error en /api/planos/descargas-stats:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Error desconocido' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { construirPayloadPlano } from '@/app/lib/planoPayloadBuilder';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    // Temporal: mientras se termina de afinar el generador de planos, solo
    // administradores pueden disparar el expediente COMPLETO. El resto del
    // staff tiene /api/planos/generar-resumen (solo linderos + copia del
    // plano), disponible para cualquier sesión de staff.
    if (!auth.session.isSystem) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'La generación del expediente completo está disponible solo para administradores por ahora.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { defaultCode } = body as { defaultCode?: string };

    if (!defaultCode) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_CODE', message: 'Falta defaultCode del lote' } },
        { status: 400 }
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

    const payloadResult = await construirPayloadPlano(defaultCode);
    if (!payloadResult.ok) return payloadResult.response;

    // Llamar a plan_pro
    const planosResponse = await fetch(`${PLANOS_API_URL}/api/v1/planos/generar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PLANOS_API_KEY,
      },
      body: JSON.stringify(payloadResult.payload),
    });

    const planosData = await planosResponse.json();

    if (!planosResponse.ok) {
      console.error('Error de plan_pro:', planosData);
      return NextResponse.json(
        { success: false, error: planosData.error || { code: 'PLANOS_API_ERROR', message: 'Error generando el plano' } },
        { status: planosResponse.status }
      );
    }

    return NextResponse.json({ success: true, data: planosData.data });
  } catch (error) {
    console.error('Error en /api/planos/generar:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Error desconocido' } },
      { status: 500 }
    );
  }
}

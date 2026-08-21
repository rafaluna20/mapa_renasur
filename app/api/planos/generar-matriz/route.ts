import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { construirPayloadPlanoMatriz } from '@/app/lib/planoPayloadBuilder';

/**
 * Plano Perimétrico de una MATRIZ (elemento.urbano, capa "matriz") — el
 * predio original antes de subdividirse en lotes. Síncrono, sin BullMQ,
 * pero a diferencia de /generar-resumen, solo administradores (a pedido
 * del usuario) — mismo gate que el expediente completo en /generar.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    if (!auth.session.isSystem) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'El plano de la matriz está disponible solo para administradores.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { codigo } = body as { codigo?: string };

    if (!codigo) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_CODE', message: 'Falta el código de la matriz' } },
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

    const payloadResult = await construirPayloadPlanoMatriz(codigo);
    if (!payloadResult.ok) return payloadResult.response;

    const payloadConStaff = {
      ...payloadResult.payload,
      staff: { uid: auth.session.odooUid, nombre: auth.session.name },
    };

    const planosResponse = await fetch(`${PLANOS_API_URL}/api/v1/planos/generar-matriz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PLANOS_API_KEY,
      },
      body: JSON.stringify(payloadConStaff),
    });

    if (!planosResponse.ok) {
      const errorData = await planosResponse.json().catch(() => null);
      console.error('Error de plan_pro (matriz):', errorData);
      return NextResponse.json(
        { success: false, error: errorData?.error || { code: 'PLANOS_API_ERROR', message: 'Error generando el plano de la matriz' } },
        { status: planosResponse.status }
      );
    }

    const pdfBuffer = await planosResponse.arrayBuffer();
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': planosResponse.headers.get('content-disposition') || `attachment; filename="matriz_${codigo}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error en /api/planos/generar-matriz:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Error desconocido' } },
      { status: 500 }
    );
  }
}

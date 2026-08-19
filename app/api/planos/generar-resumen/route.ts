import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { construirPayloadPlano } from '@/app/lib/planoPayloadBuilder';

/**
 * Documento "resumen" (solo sección III de linderos + copia del plano
 * perimétrico): disponible para cualquier staff con sesión, no solo
 * administradores — a diferencia de /api/planos/generar (expediente
 * completo, ver el gate isSystem ahí).
 *
 * A diferencia de /generar, esto es síncrono: plan_pro genera el PDF al
 * vuelo (sin llamadas externas, dibujo vectorial puro) y lo devuelve
 * directo en la respuesta — no hay Plano ni jobId que consultar, así que
 * acá no hay polling, solo se transmite el PDF tal cual llega.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

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

    // Identidad de quién pide el resumen — solo para auditoría en plan_pro
    // (ver PlanoDescarga), plan_pro no la usa para nada del dibujo. El
    // `config` que decide "solo linderos + copia" lo fuerza plan_pro del
    // otro lado, no hace falta (ni sirve) mandarlo desde acá.
    const payloadConStaff = {
      ...payloadResult.payload,
      staff: { uid: auth.session.odooUid, nombre: auth.session.name },
    };

    const planosResponse = await fetch(`${PLANOS_API_URL}/api/v1/planos/generar-resumen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PLANOS_API_KEY,
      },
      body: JSON.stringify(payloadConStaff),
    });

    if (!planosResponse.ok) {
      const errorData = await planosResponse.json().catch(() => null);
      console.error('Error de plan_pro (resumen):', errorData);
      return NextResponse.json(
        { success: false, error: errorData?.error || { code: 'PLANOS_API_ERROR', message: 'Error generando el resumen' } },
        { status: planosResponse.status }
      );
    }

    const pdfBuffer = await planosResponse.arrayBuffer();
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': planosResponse.headers.get('content-disposition') || `attachment; filename="resumen_${defaultCode}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error en /api/planos/generar-resumen:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Error desconocido' } },
      { status: 500 }
    );
  }
}

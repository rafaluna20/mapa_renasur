import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const PLANOS_API_URL = process.env.PLANOS_API_URL;
    const PLANOS_API_KEY = process.env.PLANOS_API_KEY;

    if (!PLANOS_API_URL || !PLANOS_API_KEY) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'Integración de planos no configurada' } },
        { status: 500 }
      );
    }

    const response = await fetch(`${PLANOS_API_URL}/api/v1/planos/${id}`, {
      headers: { 'x-api-key': PLANOS_API_KEY },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error || { code: 'PLANOS_API_ERROR', message: 'Error consultando el plano' } },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Error en /api/planos/estado/[id]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Error desconocido' } },
      { status: 500 }
    );
  }
}

import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';
import { getPublicLots, getPublicElementosUrbanos } from '@/app/services/odooPublicService';
import { construirEscena, partesDeCodigo, type Punto } from '@/app/utils/escenaLote';
import { clasificarFrenteParque, crearContextoFrenteParque } from '@/app/utils/frenteParque';

// Imagen PNG "lote en su entorno" para el bot de ventas (Telegram vía Chatwoot):
// el lote resaltado, los lotes vecinos, las calles y el parque de alrededor.
// Público y sin login A PROPÓSITO, igual que /venta: solo usa los datos que esa
// página ya publica (getPublicLots + getPublicElementosUrbanos, credencial
// mínima de solo lectura). NO muestra precio ni estado de venta.
export const runtime = 'nodejs';

const LADO = 1000;
const CACHE_DATOS_MS = 10 * 60 * 1000;
let cache: { lotes: Awaited<ReturnType<typeof getPublicLots>>; elementos: Awaited<ReturnType<typeof getPublicElementosUrbanos>>; expira: number } | null = null;

async function datos() {
    if (cache && cache.expira > Date.now()) return cache;
    const [lotes, elementos] = await Promise.all([getPublicLots(), getPublicElementosUrbanos()]);
    cache = { lotes, elementos, expira: Date.now() + CACHE_DATOS_MS };
    return cache;
}

const poly = (pts: Punto[]) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
const COLOR_LOTE = '#e8590c';
// Paleta propia por tipo: los colores de Odoo son para el plano interno (el parque sale rojo) y aquí confunden al cliente.
const ESTILO_TIPO: Record<string, { relleno: string; borde: string; orden: number }> = {
    aporte_recreacion: { relleno: '#86efac', borde: '#22c55e', orden: 2 },
    calle: { relleno: '#d1d5db', borde: '#9ca3af', orden: 1 },
};
const ESTILO_OTRO = { relleno: '#e5e7eb', borde: '#cbd5e1', orden: 0 };
const estilo = (tipo: string) => ESTILO_TIPO[tipo] ?? ESTILO_OTRO;

export async function GET(req: NextRequest) {
    const codigo = (req.nextUrl.searchParams.get('codigo') || '').trim().toUpperCase();
    const partes = partesDeCodigo(codigo);
    if (!partes) return NextResponse.json({ error: 'Código de lote inválido' }, { status: 400 });

    let d: Awaited<ReturnType<typeof datos>>;
    try {
        d = await datos();
    } catch (e) {
        console.error('[lote-imagen] Odoo no respondió:', e);
        return NextResponse.json({ error: 'Datos no disponibles' }, { status: 503 });
    }

    const conGeom = (l: (typeof d.lotes)[number]) => Array.isArray(l.x_geometry_utm) && l.x_geometry_utm.length >= 3;
    const lote = d.lotes.find((l) => l.default_code === codigo);
    if (!lote || !conGeom(lote)) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });

    const puntosLote = lote.x_geometry_utm as Punto[];
    const vecinos = d.lotes
        .filter((l) => l.default_code !== codigo && conGeom(l))
        .map((l) => ({ puntos: l.x_geometry_utm as Punto[], etiqueta: partesDeCodigo(String(l.default_code))?.lote ?? '' }));
    const elementos = d.elementos
        .filter((e) => e.mostrarEnMapa !== false && Array.isArray(e.points) && e.points.length >= 3)
        .map((e) => ({ puntos: e.points as Punto[], tipo: e.tipo, nombre: e.nombre, colorBorde: e.colorBorde, colorRelleno: e.colorRelleno }))
        .sort((a, b) => estilo(a.tipo).orden - estilo(b.tipo).orden);

    const escena = construirEscena({ lote: puntosLote, vecinos, elementos, lado: LADO });
    if (!escena) return NextResponse.json({ error: 'Geometría inválida' }, { status: 404 });

    const ctx = crearContextoFrenteParque(
        elementos.filter((e) => e.tipo === 'calle').map((e) => e.puntos),
        elementos.filter((e) => e.tipo === 'aporte_recreacion').map((e) => e.puntos)
    );
    const parque = clasificarFrenteParque(puntosLote, ctx).tipo;
    const hayParque = escena.elementos.some((e) => e.tipo === 'aporte_recreacion');
    const hayCalle = escena.elementos.some((e) => e.tipo === 'calle');
    const area = typeof lote.x_area === 'number' && lote.x_area > 0 ? lote.x_area : null;

    const dentro = (c: Punto) => c[0] > 40 && c[0] < LADO - 40 && c[1] > 40 && c[1] < LADO - 40;
    const etiquetasVecinos = escena.vecinos.filter((v) => v.etiqueta && v.ancho > 34 && v.alto > 22 && dentro(v.centro));
    const etiquetasParque = escena.elementos.filter((e) => e.tipo === 'aporte_recreacion' && e.ancho > 110 && dentro(e.centro));
    const etiquetasCalle = escena.elementos.filter((e) => e.tipo === 'calle' && e.nombre && e.ancho > 130 && e.alto > 20 && dentro(e.centro)).slice(0, 3);
    const caja = (x: number, y: number, ancho: number) => ({ position: 'absolute' as const, left: Math.max(4, Math.min(LADO - ancho - 4, x - ancho / 2)), top: y - 12, width: ancho, display: 'flex', justifyContent: 'center' as const });

    const img = new ImageResponse(
        (
            <div style={{ width: LADO, height: LADO, display: 'flex', position: 'relative', background: '#eef1f4' }}>
                <svg width={LADO} height={LADO} viewBox={`0 0 ${LADO} ${LADO}`} style={{ position: 'absolute', left: 0, top: 0 }}>
                    {escena.elementos.map((e, i) => (
                        <polygon key={'e' + i} points={poly(e.puntos)} fill={estilo(e.tipo).relleno} stroke={estilo(e.tipo).borde} strokeWidth={1.5} />
                    ))}
                    {escena.vecinos.map((v, i) => (
                        <polygon key={'v' + i} points={poly(v.puntos)} fill="#ffffff" stroke="#8b95a1" strokeWidth={1.5} />
                    ))}
                    <polygon points={poly(escena.lote.puntos)} fill={COLOR_LOTE} fillOpacity={0.9} stroke="#7a2e05" strokeWidth={4} />
                </svg>

                {etiquetasParque.map((e, i) => (
                    <div key={'tp' + i} style={{ ...caja(e.centro[0], e.centro[1], 200), fontSize: 24, color: '#14532d' }}>PARQUE</div>
                ))}
                {etiquetasCalle.map((e, i) => (
                    <div key={'tc' + i} style={{ ...caja(e.centro[0], e.centro[1], 240), fontSize: 20, color: '#4b5563' }}>{e.nombre.slice(0, 22)}</div>
                ))}
                {etiquetasVecinos.map((v, i) => (
                    <div key={'tv' + i} style={{ ...caja(v.centro[0], v.centro[1], 70), fontSize: 20, color: '#4b5563' }}>{v.etiqueta}</div>
                ))}
                <div style={{ ...caja(escena.lote.centro[0], escena.lote.centro[1], 140), top: escena.lote.centro[1] - 16, fontSize: 32, color: '#ffffff' }}>{partes.lote}</div>

                <div style={{ position: 'absolute', left: 24, top: 24, display: 'flex', flexDirection: 'column', background: '#ffffff', border: '2px solid #d0d5db', borderRadius: 16, padding: '14px 22px' }}>
                    <div style={{ display: 'flex', fontSize: 40, color: '#111827' }}>{`Mz ${partes.manzana} · Lote ${partes.lote}`}</div>
                    <div style={{ display: 'flex', fontSize: 28, color: '#374151' }}>
                        {area ? `${area.toLocaleString('en-US', { maximumFractionDigits: 2 })} m²` : 'Terra Lima'}
                    </div>
                    {parque && (
                        <div style={{ display: 'flex', marginTop: 8, fontSize: 24, color: '#14532d', background: '#dcfce7', borderRadius: 10, padding: '4px 12px' }}>
                            {parque === 'colindante' ? 'Colinda con el parque' : 'Frente al parque'}
                        </div>
                    )}
                </div>

                <div style={{ position: 'absolute', left: 24, bottom: 24, display: 'flex', alignItems: 'center', background: '#ffffff', border: '2px solid #d0d5db', borderRadius: 14, padding: '10px 18px', fontSize: 22, color: '#374151' }}>
                    <div style={{ display: 'flex', width: 22, height: 22, background: COLOR_LOTE, borderRadius: 4, marginRight: 8 }} />
                    <div style={{ display: 'flex', marginRight: 20 }}>Tu lote</div>
                    {hayParque && <div style={{ display: 'flex', width: 22, height: 22, background: '#86efac', borderRadius: 4, marginRight: 8 }} />}
                    {hayParque && <div style={{ display: 'flex', marginRight: 20 }}>Parque</div>}
                    {hayCalle && <div style={{ display: 'flex', width: 22, height: 22, background: '#d1d5db', borderRadius: 4, marginRight: 8 }} />}
                    {hayCalle && <div style={{ display: 'flex' }}>Calle</div>}
                </div>
                <div style={{ position: 'absolute', right: 24, bottom: 24, display: 'flex', fontSize: 20, color: '#6b7280', background: '#ffffffcc', borderRadius: 10, padding: '6px 12px' }}>
                    Terra Lima · ubicación referencial
                </div>
            </div>
        ),
        { width: LADO, height: LADO, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' } }
    );
    return img;
}

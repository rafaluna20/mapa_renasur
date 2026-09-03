import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fetchOdoo } from '@/app/services/odooService';

interface ExtendedUser {
    odooPartnerId?: number;
}

interface OdooInvoice {
    id: number;
    name: string;
    ref?: string | false;
    payment_reference?: string | false;
    invoice_date: string;
    invoice_date_due: string;
    payment_state: string;
    amount_total: number;
    amount_residual: number;
}

interface OdooProductTemplate {
    default_code: string;
    list_price: number;
    x_mz?: string | false;
    x_etapa?: string | false;
    x_lote?: string | false;
}

/**
 * Extrae el código de lote Terra Lima (ej. "E01MZR016P") embebido en un
 * texto de referencia libre. Formato real confirmado contra Odoo (campo
 * `ref` de account.move): "CONTRATOMANUAL-E01MZR016P-C008" — sin el sufijo
 * de fecha de 8 dígitos que sí exige paymentService.parsePaymentReference
 * (esa función lee `payment_reference`, que en la práctica suele traer el
 * número de factura, no el código de lote — son campos distintos con datos
 * distintos en este Odoo). Se exige el "-C<num>" o "-INIT" final para no
 * confundir cualquier texto parecido con una referencia real de cuota — el
 * "-INIT" es necesario: la cuota inicial de cada lote usa ese sufijo en vez
 * de "-C<num>", y sin esta alternativa esas facturas caían todas en "Otros
 * pagos" en lugar de su lote real (confirmado con datos reales: 2 de 34
 * facturas de un cliente de prueba, una por cada uno de sus 2 lotes).
 */
function extraerCodigoLote(texto: string): string | null {
    const m = texto.match(/(E\d+MZ[A-Z]+\d+[A-Z]?)-(?:C\d+|INIT)/i);
    return m ? m[1].toUpperCase() : null;
}

/**
 * GET /api/invoices/statement
 * Estado de cuenta completo del cliente logueado (pagadas + pendientes),
 * agrupado por lote — a diferencia de /api/invoices/pending (solo
 * pendientes, sin agrupar). El partnerId SIEMPRE sale de la sesión del
 * servidor (NextAuth), nunca de un parámetro del cliente: es data
 * financiera y un cliente no debe poder pedir la de otro cambiando un
 * query param.
 */
export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    const partnerId = (session.user as unknown as ExtendedUser).odooPartnerId;
    if (!partnerId) {
        return Response.json({ success: false, error: 'Tu cuenta no tiene un cliente de Odoo asociado.' }, { status: 400 });
    }

    try {
        const invoices = await fetchOdoo('account.move', 'search_read', [[
            ['partner_id', '=', partnerId],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted'],
        ]], {
            fields: ['id', 'name', 'ref', 'payment_reference', 'invoice_date', 'invoice_date_due', 'payment_state', 'amount_total', 'amount_residual'],
            limit: 500,
            order: 'invoice_date asc',
        }) as OdooInvoice[];

        // Agrupar por código de lote parseado de ref/payment_reference/name
        const grupos = new Map<string, OdooInvoice[]>();
        for (const inv of invoices) {
            const texto = inv.ref || inv.payment_reference || inv.name || '';
            const codigo = extraerCodigoLote(texto) || 'SIN_LOTE';
            if (!grupos.has(codigo)) grupos.set(codigo, []);
            grupos.get(codigo)!.push(inv);
        }

        // Traer precio de lista + datos de manzana/etapa/lote para cada
        // código detectado (batch, un solo viaje a Odoo).
        const codigos = [...grupos.keys()].filter((c) => c !== 'SIN_LOTE');
        const productosPorCodigo = new Map<string, OdooProductTemplate>();
        if (codigos.length > 0) {
            const productos = await fetchOdoo('product.template', 'search_read', [[
                ['default_code', 'in', codigos],
            ]], {
                fields: ['default_code', 'list_price', 'x_mz', 'x_etapa', 'x_lote'],
            }) as OdooProductTemplate[];
            for (const p of productos) {
                productosPorCodigo.set(p.default_code, p);
            }
        }

        const lots = [...grupos.entries()].map(([codigo, invs]) => {
            const producto = productosPorCodigo.get(codigo);
            const label = codigo === 'SIN_LOTE'
                ? 'Otros pagos'
                : producto
                    ? `Etapa ${producto.x_etapa || '?'} Mz ${producto.x_mz || '?'} Lote ${producto.x_lote || '?'}`
                    : codigo;

            return {
                code: codigo,
                label,
                mz: producto?.x_mz || null,
                etapa: producto?.x_etapa || null,
                numeroLote: producto?.x_lote || null,
                listPrice: producto?.list_price || 0,
                invoices: invs,
            };
        });

        return Response.json({ success: true, lots });
    } catch (error: unknown) {
        console.error('[STATEMENT] Error fetching account statement:', error);
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Error al obtener el estado de cuenta',
        }, { status: 500 });
    }
}

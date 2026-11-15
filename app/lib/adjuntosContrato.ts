/**
 * Copia los documentos de la reserva (cotización y comprobantes de pago, adjuntos a la orden de venta) al contrato de
 * financiamiento, para que quien trabaja el contrato los tenga a la mano sin ir a buscarlos a la orden.
 *
 * - Se COPIAN, no se mueven: la orden conserva su evidencia. Odoo guarda el archivo una sola vez en disco cuando el
 *   contenido es idéntico, así que copiar no duplica espacio.
 * - Es repetible: un archivo que ya está en el contrato (mismo contenido y nombre) no se vuelve a copiar.
 * - Nunca lanza: crear el contrato es lo importante; si algo de esto falla, se informa y el contrato queda igual.
 */
import { fetchOdoo } from '@/app/services/odooService';

interface AdjuntoOdoo {
    id: number;
    name: string;
    checksum?: string | false;
}

export interface ResultadoCopiaAdjuntos {
    copiados: string[];
    yaEstaban: number;
    errores: string[];
}

export async function copiarAdjuntosAlContrato(orderId: number, contractId: number): Promise<ResultadoCopiaAdjuntos> {
    const resultado: ResultadoCopiaAdjuntos = { copiados: [], yaEstaban: 0, errores: [] };
    try {
        const campos = { fields: ['id', 'name', 'checksum'], order: 'id asc', limit: 100 };
        const [deLaOrden, delContrato] = (await Promise.all([
            fetchOdoo('ir.attachment', 'search_read', [[['res_model', '=', 'sale.order'], ['res_id', '=', orderId]]], campos),
            fetchOdoo('ir.attachment', 'search_read', [[['res_model', '=', 'simple.contract'], ['res_id', '=', contractId]]], campos),
        ])) as [AdjuntoOdoo[], AdjuntoOdoo[]];

        const yaTiene = (a: AdjuntoOdoo) =>
            (delContrato ?? []).some((c) => c.name === a.name && (!a.checksum || !c.checksum || c.checksum === a.checksum));

        for (const adjunto of deLaOrden ?? []) {
            if (yaTiene(adjunto)) {
                resultado.yaEstaban += 1;
                continue;
            }
            try {
                await fetchOdoo('ir.attachment', 'copy', [[adjunto.id], { res_model: 'simple.contract', res_id: contractId }]);
                resultado.copiados.push(adjunto.name);
            } catch (error) {
                resultado.errores.push(`${adjunto.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    } catch (error) {
        resultado.errores.push(error instanceof Error ? error.message : String(error));
    }
    return resultado;
}

const escaparHtml = (texto: string) =>
    texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Aviso en el chatter del contrato con los documentos que llegaron desde la reserva (el nombre del archivo lo pone una persona: se escapa). */
export async function avisarDocumentosEnContrato(orderId: number, contractId: number, copiados: string[]): Promise<void> {
    if (copiados.length === 0) return;
    try {
        const lista = copiados.map((n) => `<li>${escaparHtml(n)}</li>`).join('');
        await fetchOdoo('mail.message', 'create', [{
            model: 'simple.contract',
            res_id: contractId,
            body: `📎 Documentos de la reserva (orden #${orderId}) agregados a este contrato:<ul>${lista}</ul>`,
            message_type: 'notification',
        }]);
    } catch (error) {
        console.warn('⚠️ No se pudo dejar el aviso de documentos en el contrato:', error);
    }
}

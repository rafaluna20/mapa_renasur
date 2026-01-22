/**
 * Servicio Niubiz para procesamiento de pagos con tarjeta
 * Documentación: https://github.com/Niubiz/
 */

const NIUBIZ_BASE_URL = process.env.NIUBIZ_ENV === 'production'
    ? 'https://apiprod.vnforapps.com'
    : 'https://apisandbox.vnforapps.com';

export interface NiubizSessionResponse {
    sessionKey: string;
    expirationTime: number;
}

export interface NiubizAuthorizationResponse {
    order: {
        transactionId: string;
        purchaseNumber: string;
        amount: string;
        currency: string;
    };
    dataMap: {
        ACTION_CODE: string;
        ACTION_DESCRIPTION: string;
        CARD: string;
        BRAND: string;
        TRACE_NUMBER: string;
    };
}

export const niubizService = {
    /**
     * Crear session token para iniciar pago
     */
    async createSessionToken(
        amount: number,
        orderId: string
    ): Promise<string> {
        const merchantId = process.env.NIUBIZ_MERCHANT_ID!;
        const accessKey = process.env.NIUBIZ_ACCESS_KEY!;

        // Autenticación Basic
        const auth = Buffer.from(`${merchantId}:${accessKey}`).toString('base64');

        const response = await fetch(
            `${NIUBIZ_BASE_URL}/api.security/v1/security`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    channel: 'web',
                    amount: (amount * 100).toFixed(0), // Convertir a centavos
                    antifraud: {
                        clientIp: '0.0.0.0', // TODO: Obtener IP real del cliente
                        merchantDefineData: {
                            MDD4: orderId, // Referencia de pago
                            MDD21: '0', // Cliente new
                            MDD32: orderId.substring(0, 20) // ID transacción
                        }
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Niubiz session error: ${error}`);
        }

        const data: NiubizSessionResponse = await response.json();
        return data.sessionKey;
    },

    /**
     * Autorizar transacción después de que el cliente ingresó sus datos
     */
    async authorizeTransaction(
        transactionToken: string,
        amount: number,
        orderId: string
    ): Promise<NiubizAuthorizationResponse> {
        const merchantId = process.env.NIUBIZ_MERCHANT_ID!;
        const accessKey = process.env.NIUBIZ_ACCESS_KEY!;
        const auth = Buffer.from(`${merchantId}:${accessKey}`).toString('base64');

        const response = await fetch(
            `${NIUBIZ_BASE_URL}/api.authorization/v3/authorization/ecommerce/${merchantId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    channel: 'web',
                    captureType: 'manual', // Captura manual para validación
                    countable: true,
                    order: {
                        tokenId: transactionToken,
                        purchaseNumber: orderId,
                        amount: (amount * 100).toFixed(0),
                        currency: 'PEN'
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Niubiz authorization error: ${error}`);
        }

        return await response.json();
    },

    /**
     * Verificar estado de una transacción
     */
    async getTransactionStatus(
        transactionId: string
    ): Promise<NiubizAuthorizationResponse> {
        const merchantId = process.env.NIUBIZ_MERCHANT_ID!;
        const accessKey = process.env.NIUBIZ_ACCESS_KEY!;
        const auth = Buffer.from(`${merchantId}:${accessKey}`).toString('base64');

        const response = await fetch(
            `${NIUBIZ_BASE_URL}/api.authorization/v3/authorization/ecommerce/${merchantId}/${transactionId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('Error al consultar estado de transacción');
        }

        return await response.json();
    }
};

/**
 * Servicio de cálculos financieros para el sistema de cotización.
 * Maneja descuentos, fechas y prorrateo de cuotas.
 * IMPORTANTE: Todos los cálculos se realizan con 4 decimales de precisión.
 */

export interface Installment {
    number: number;
    date: Date;
    amount: number;
    balance: number;
}

export interface QuoteCalculations {
    originalPrice: number;
    discountAmount: number;
    discountedPrice: number;
    initialPayment: number;
    remainingBalance: number;
    monthlyInstallment: number;
    installments: Installment[];
}

export const financeService = {
    /**
     * Redondea un número a 6 decimales para porcentajes de descuento.
     * Alta precisión para el valor crítico de entrada.
     */
    roundTo6Decimals: (value: number): number => {
        return Math.round(value * 1000000) / 1000000;
    },

    /**
     * Redondea un número a 4 decimales para valores monetarios.
     * Suficiente para soles (0.0001 = centésima de céntimo).
     */
    roundTo4Decimals: (value: number): number => {
        return Math.round(value * 10000) / 10000;
    },

    /**
     * Redondea un número a 2 decimales para visualización.
     * Estándar monetario (céntimos).
     */
    roundTo2Decimals: (value: number): number => {
        return Math.round(value * 100) / 100;
    },

    /**
     * Calcula el desglose de una cotización.
     * NOTA: Porcentaje usa 6 decimales, montos usan 4 decimales.
     *
     * @param price Precio base del lote.
     * @param discountPercent Porcentaje de descuento (0-100) con 6 decimales.
     * @param initialPayment Monto de la cuota inicial.
     * @param numInstallments Cantidad de cuotas (por defecto 72).
     * @param startDate Fecha programada para la primera cuota (inicial).
     */
    calculateQuote: (
        price: number,
        discountPercent: number,
        initialPayment: number,
        numInstallments: number = 72,
        startDate: Date = new Date()
    ): QuoteCalculations => {
        // Porcentaje con 6 decimales (valor crítico de entrada)
        const percent = financeService.roundTo6Decimals(discountPercent);
        
        // Monto descuento con 4 decimales (suficiente para soles)
        const discountAmount = financeService.roundTo4Decimals(price * (percent / 100));
        
        // Precio final con 4 decimales
        const discountedPrice = financeService.roundTo4Decimals(price - discountAmount);
        
        // Saldo restante con 4 decimales
        const remainingBalance = financeService.roundTo4Decimals(discountedPrice - initialPayment);
        
        // Cuota mensual con 4 decimales
        const monthlyInstallment = numInstallments > 0
            ? financeService.roundTo4Decimals(remainingBalance / numInstallments)
            : 0;

        const installments: Installment[] = [];
        let currentBalance = remainingBalance;

        for (let i = 1; i <= numInstallments; i++) {
            // Calcular fecha (un mes después de la anterior)
            const installmentDate = new Date(startDate);
            installmentDate.setMonth(startDate.getMonth() + i);

            const balanceAfterPayment = financeService.roundTo4Decimals(currentBalance - monthlyInstallment);
            
            installments.push({
                number: i,
                date: installmentDate,
                amount: monthlyInstallment,
                balance: Math.max(0, balanceAfterPayment)
            });

            currentBalance = balanceAfterPayment;
        }

        return {
            originalPrice: price,
            discountAmount, // 4 decimales
            discountedPrice, // 4 decimales
            initialPayment,
            remainingBalance, // 4 decimales
            monthlyInstallment, // 4 decimales
            installments
        };
    },

    /**
     * Formatea una fecha para visualización en español.
     */
    formatDate: (date: Date): string => {
        return new Intl.DateTimeFormat('es-PE', {
            year: 'numeric',
            month: 'long',
            day: '2-digit'
        }).format(date);
    },

    /**
     * Formatea montos a moneda local (Soles).
     * IMPORTANTE: Muestra solo 2 decimales aunque internamente se trabaje con 4.
     */
    formatCurrency: (amount: number): string => {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
};

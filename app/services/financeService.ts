/**
 * Servicio de cálculos financieros para el sistema de cotización.
 * Maneja descuentos, fechas y prorrateo de cuotas.
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
     * Calcula el desglose de una cotización.
     * 
     * @param price Precio base del lote.
     * @param discountPercent Porcentaje de descuento (0-100).
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
        const discountAmount = price * (discountPercent / 100);
        const discountedPrice = price - discountAmount;
        const remainingBalance = discountedPrice - initialPayment;
        const monthlyInstallment = numInstallments > 0 ? remainingBalance / numInstallments : 0;

        const installments: Installment[] = [];
        let currentBalance = remainingBalance;

        for (let i = 1; i <= numInstallments; i++) {
            // Calcular fecha (un mes después de la anterior)
            const installmentDate = new Date(startDate);
            installmentDate.setMonth(startDate.getMonth() + i);

            installments.push({
                number: i,
                date: installmentDate,
                amount: monthlyInstallment,
                balance: Math.max(0, currentBalance - monthlyInstallment)
            });

            currentBalance -= monthlyInstallment;
        }

        return {
            originalPrice: price,
            discountAmount,
            discountedPrice,
            initialPayment,
            remainingBalance,
            monthlyInstallment,
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
     */
    formatCurrency: (amount: number): string => {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 2
        }).format(amount);
    }
};

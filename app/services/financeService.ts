/**
 * Servicio de cálculos financieros para el sistema de cotización.
 * Maneja descuentos, fechas y prorrateo de cuotas.
 * IMPORTANTE: Todos los cálculos se realizan con 4 decimales de precisión.
 *
 * ACTUALIZADO: 2026-02-24
 * - Cuota 0 (inicial) con fecha manual
 * - Cuota 1 (primera) con fecha manual
 * - Todas las cuotas mensuales caen en el último día del mes
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
    initialPaymentDate?: Date; // 🆕 Fecha de la cuota inicial
    remainingBalance: number;
    monthlyInstallment: number;
    firstInstallmentDate?: Date; // 🆕 Fecha de la primera cuota mensual
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
     * 🆕 Obtiene el último día del mes para una fecha dada
     * Ejemplos:
     * - Enero → 31
     * - Febrero (no bisiesto) → 28
     * - Febrero (bisiesto) → 29
     * - Abril → 30
     */
    getLastDayOfMonth: (date: Date): Date => {
        // Crear nueva fecha para no mutar la original
        const result = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        // Mantener la hora en 0:00:00
        result.setHours(0, 0, 0, 0);
        return result;
    },

    /**
     * 🆕 Calcula la fecha de la siguiente cuota (último día del mes siguiente)
     *
     * @param fromDate Fecha de referencia
     * @param monthsToAdd Meses a agregar (default: 1)
     * @returns Fecha del último día del mes correspondiente
     */
    getNextInstallmentDate: (fromDate: Date, monthsToAdd: number = 1): Date => {
        const nextMonth = new Date(fromDate);
        nextMonth.setMonth(nextMonth.getMonth() + monthsToAdd);
        return financeService.getLastDayOfMonth(nextMonth);
    },

    /**
     * Calcula el desglose de una cotización.
     * NOTA: Porcentaje usa 6 decimales, montos usan 4 decimales.
     *
     * 🆕 ACTUALIZADO: Soporta fechas manuales y último día del mes
     *
     * @param price Precio base del lote.
     * @param discountPercent Porcentaje de descuento (0-100) con 6 decimales.
     * @param initialPayment Monto de la cuota inicial.
     * @param numInstallments Cantidad de cuotas mensuales (por defecto 72).
     * @param initialPaymentDate Fecha manual para la cuota inicial (cuota 0).
     * @param firstInstallmentDate Fecha manual para la primera cuota mensual (cuota 1).
     */
    calculateQuote: (
        price: number,
        discountPercent: number,
        initialPayment: number,
        numInstallments: number = 72,
        initialPaymentDate?: Date,
        firstInstallmentDate?: Date
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

        // 🆕 Usar fecha manual o calcular primera cuota (último día del mes siguiente)
        const firstDate = firstInstallmentDate || financeService.getNextInstallmentDate(
            initialPaymentDate || new Date(),
            1
        );

        for (let i = 1; i <= numInstallments; i++) {
            // 🆕 Calcular fecha: último día del mes correspondiente
            let installmentDate: Date;
            
            if (i === 1) {
                // Primera cuota: usar fecha manual o calculada
                installmentDate = firstDate;
            } else {
                // Cuotas siguientes: último día de cada mes subsecuente
                installmentDate = financeService.getNextInstallmentDate(firstDate, i - 1);
            }

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
            initialPaymentDate, // 🆕 Fecha de cuota inicial
            remainingBalance, // 4 decimales
            monthlyInstallment, // 4 decimales
            firstInstallmentDate: firstDate, // 🆕 Fecha de primera cuota
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

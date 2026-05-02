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
    scheduleType?: 'end_of_month' | 'fixed_day';
    installments: Installment[];
}

export const financeService = {
    /**
     * 🆕 Parsea un string de fecha en formato YYYY-MM-DD como fecha LOCAL (no UTC)
     * Esto evita problemas de zona horaria donde "2025-12-23" se interpreta
     * como UTC medianoche y se muestra como día anterior en zonas UTC-
     *
     * @param dateString Fecha en formato "YYYY-MM-DD"
     * @returns Objeto Date en zona horaria local
     */
    parseLocalDate: (dateString: string): Date => {
        const [year, month, day] = dateString.split('-').map(Number);
        // Crear fecha en zona horaria local (month - 1 porque JS usa 0-11)
        const date = new Date(year, month - 1, day);
        date.setHours(0, 0, 0, 0);
        return date;
    },

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
    getLastDayOfMonth: (year: number, month: number): Date => {
        // Crear fecha del último día del mes especificado
        // month + 1 porque new Date(year, month + 1, 0) da el último día del mes 'month'
        const result = new Date(year, month + 1, 0);
        // Mantener la hora en 0:00:00
        result.setHours(0, 0, 0, 0);
        return result;
    },

    /**
     * 🆕 Calcula la fecha de la siguiente cuota (último día del mes siguiente)
     *
     * IMPORTANTE: Extrae año y mes de la fecha actual, suma meses, y calcula
     * el último día del nuevo mes. Esto evita problemas con días 29-31 que no
     * existen en todos los meses.
     *
     * @param fromDate Fecha de referencia
     * @returns Fecha del último día del mes siguiente
     */
    getNextInstallmentDate: (fromDate: Date): Date => {
        // Extraer año y mes actual
        const currentYear = fromDate.getFullYear();
        const currentMonth = fromDate.getMonth();
        
        // Calcular el siguiente mes y año (manejar diciembre → enero del siguiente año)
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
        }
        
        // Retornar el último día del mes siguiente
        return financeService.getLastDayOfMonth(nextYear, nextMonth);
    },

    /**
     * 🆕 Calcula la fecha de la siguiente cuota manteniendo el mismo día del mes.
     * Si el siguiente mes no tiene ese día (ej. 31 en Febrero), se ajusta al último día del mes.
     */
    getNextFixedDayInstallment: (previousDate: Date, targetDay: number): Date => {
        const year = previousDate.getFullYear();
        const month = previousDate.getMonth();
        
        let nextMonth = month + 1;
        let nextYear = year;
        
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
        }
        
        // Obtener cuántos días tiene el siguiente mes
        const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        
        // Usar el targetDay o el último día del mes si targetDay es mayor
        const actualDay = Math.min(targetDay, lastDayOfNextMonth);
        
        const date = new Date(nextYear, nextMonth, actualDay);
        date.setHours(0, 0, 0, 0);
        return date;
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
     * @param scheduleType Tipo de cronograma: 'end_of_month' o 'fixed_day'.
     */
    calculateQuote: (
        price: number,
        discountPercent: number,
        initialPayment: number,
        numInstallments: number = 72,
        initialPaymentDate?: Date,
        firstInstallmentDate?: Date,
        scheduleType: 'end_of_month' | 'fixed_day' = 'end_of_month'
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
            initialPaymentDate || new Date()
        );

        // Variable para rastrear la fecha de la cuota anterior
        let previousDate = firstDate;
        // Guardar el día objetivo si es fixed_day
        const targetDay = firstDate.getDate();

        for (let i = 1; i <= numInstallments; i++) {
            // 🆕 Calcular fecha
            let installmentDate: Date;
            
            if (i === 1) {
                // Primera cuota: usar fecha manual o calculada
                installmentDate = firstDate;
            } else {
                if (scheduleType === 'fixed_day') {
                    installmentDate = financeService.getNextFixedDayInstallment(previousDate, targetDay);
                } else {
                    installmentDate = financeService.getNextInstallmentDate(previousDate);
                }
            }

            const balanceAfterPayment = financeService.roundTo4Decimals(currentBalance - monthlyInstallment);
            
            installments.push({
                number: i,
                date: installmentDate,
                amount: monthlyInstallment,
                balance: Math.max(0, balanceAfterPayment)
            });

            currentBalance = balanceAfterPayment;
            previousDate = installmentDate; // Actualizar fecha anterior
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
            scheduleType,
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

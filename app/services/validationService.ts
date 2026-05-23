/**
 * Validation Service - Sistema de Validaciones de Negocio
 * 
 * Implementa reglas de validación por roles para el sistema de cotización.
 * Previene errores financieros y asegura cumplimiento de políticas empresariales.
 * 
 * @author Sistema de Cotización TERRA LIMA
 * @version 1.0.0
 */



// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

/**
 * Reglas de cotización aplicables por rol
 */
export interface QuotationRules {
    maxDiscountPercent: number;      // % máximo de descuento sin aprobación
    minInitialPaymentPercent: number; // % mínimo de cuota inicial
    maxInstallments: number;          // Plazo máximo permitido (meses)
    requiresApproval: boolean;        // Si requiere aprobación para descuentos altos
    canOverride: boolean;            // Puede sobreescribir reglas con justificación
}

/**
 * Resultado de validación
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

/**
 * Error de validación
 */
export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
    code?: string; // Código de error para i18n
}

/**
 * Warning de validación (no bloquea pero advierte)
 */
export interface ValidationWarning extends ValidationError {
    canProceed: boolean; // Si puede continuar a pesar del warning
}

// ============================================================================
// CONFIGURACIÓN DE REGLAS POR ROL
// ============================================================================

/**
 * Matriz de reglas por rol de usuario
 * Los roles más altos tienen más permisos
 */
const RULES_BY_ROLE: Record<string, QuotationRules> = {
    // Vendedor básico - Reglas más restrictivas
    'vendedor': {
        maxDiscountPercent: 5,
        minInitialPaymentPercent: 20,
        maxInstallments: 72,
        requiresApproval: true,
        canOverride: false
    },

    // Supervisor - Permisos intermedios
    'supervisor': {
        maxDiscountPercent: 15,
        minInitialPaymentPercent: 10,
        maxInstallments: 120,
        requiresApproval: true,
        canOverride: true
    },

    // Gerente - Permisos amplios
    'gerente': {
        maxDiscountPercent: 25,
        minInitialPaymentPercent: 0,
        maxInstallments: 180,
        requiresApproval: false,
        canOverride: true
    },

    // Administrador - Sin restricciones
    'admin': {
        maxDiscountPercent: 100,
        minInitialPaymentPercent: 0,
        maxInstallments: 360,
        requiresApproval: false,
        canOverride: true
    }
};

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export const validationService = {
    /**
     * Obtiene las reglas aplicables al rol especificado
     * Si el rol no existe, usa las reglas de 'vendedor' (más restrictivas)
     */
    getRulesForUser(userRole: string): QuotationRules {
        const normalizedRole = (userRole || 'vendedor').toLowerCase().trim();
        return RULES_BY_ROLE[normalizedRole] || RULES_BY_ROLE['vendedor'];
    },

    /**
     * Valida una cotización completa contra las reglas de negocio
     * 
     * @param price - Precio base del lote
     * @param discountPercent - Porcentaje de descuento (0-100)
     * @param discountAmount - Monto del descuento en moneda
     * @param initialPayment - Cuota inicial
     * @param installments - Número de cuotas
     * @param userRole - Rol del usuario que crea la cotización
     * @returns ValidationResult con errores y warnings
     */
    validateQuotation(
        price: number,
        discountPercent: number,
        discountAmount: number,
        initialPayment: number,
        installments: number,
        userRole: string
    ): ValidationResult {
        const rules = this.getRulesForUser(userRole);
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // ====================================================================
        // 1. VALIDACIÓN DE DESCUENTO
        // ====================================================================
        if (discountPercent > rules.maxDiscountPercent) {
            if (rules.canOverride) {
                // Usuario puede sobreescribir, pero mostrar warning
                warnings.push({
                    field: 'discount',
                    message: `⚠️ El descuento (${discountPercent.toFixed(2)}%) excede el límite recomendado (${rules.maxDiscountPercent}%). Se requiere justificación escrita.`,
                    severity: 'warning',
                    canProceed: true,
                    code: 'DISCOUNT_EXCEEDS_LIMIT'
                });
            } else {
                // Usuario no puede sobreescribir - ERROR bloqueante
                errors.push({
                    field: 'discount',
                    message: `🚫 El descuento no puede exceder ${rules.maxDiscountPercent}%. Tu rol (${userRole}) permite máximo ${rules.maxDiscountPercent}%. Contacta a un supervisor para descuentos mayores.`,
                    severity: 'error',
                    code: 'DISCOUNT_NOT_ALLOWED'
                });
            }
        }

        // Validar que el descuento no sea negativo
        if (discountPercent < 0 || discountAmount < 0) {
            errors.push({
                field: 'discount',
                message: '🚫 El descuento no puede ser negativo.',
                severity: 'error',
                code: 'DISCOUNT_NEGATIVE'
            });
        }

        // ====================================================================
        // 2. VALIDACIÓN DE CUOTA INICIAL
        // ====================================================================
        const initialPaymentPercent = price > 0 ? (initialPayment / price) * 100 : 0;
        
        if (initialPaymentPercent < rules.minInitialPaymentPercent) {
            const minAmount = (price * rules.minInitialPaymentPercent) / 100;
            errors.push({
                field: 'initialPayment',
                message: `🚫 La cuota inicial debe ser al menos ${rules.minInitialPaymentPercent}% del precio (${this.formatCurrency(minAmount)}). Actual: ${initialPaymentPercent.toFixed(1)}%`,
                severity: 'error',
                code: 'INITIAL_PAYMENT_TOO_LOW'
            });
        }

        // Validar que la cuota inicial no sea negativa
        if (initialPayment < 0) {
            errors.push({
                field: 'initialPayment',
                message: '🚫 La cuota inicial no puede ser negativa.',
                severity: 'error',
                code: 'INITIAL_PAYMENT_NEGATIVE'
            });
        }

        // ====================================================================
        // 3. VALIDACIÓN DE PLAZO (INSTALLMENTS)
        // ====================================================================
        if (installments > rules.maxInstallments) {
            errors.push({
                field: 'installments',
                message: `🚫 El plazo máximo permitido es ${rules.maxInstallments} meses para tu rol (${userRole}). Actual: ${installments} meses.`,
                severity: 'error',
                code: 'INSTALLMENTS_EXCEED_MAX'
            });
        }

        if (installments < 1) {
            errors.push({
                field: 'installments',
                message: '🚫 El plazo debe ser al menos 1 mes.',
                severity: 'error',
                code: 'INSTALLMENTS_TOO_LOW'
            });
        }

        // ====================================================================
        // 4. VALIDACIÓN DE COHERENCIA FINANCIERA
        // ====================================================================
        const finalPrice = price - discountAmount;

        // La cuota inicial no puede ser mayor al precio final
        if (initialPayment > finalPrice) {
            errors.push({
                field: 'initialPayment',
                message: `🚫 La cuota inicial (${this.formatCurrency(initialPayment)}) no puede ser mayor al precio final después del descuento (${this.formatCurrency(finalPrice)})`,
                severity: 'error',
                code: 'INITIAL_EXCEEDS_FINAL_PRICE'
            });
        }

        // Descuento + inicial no pueden exceder el precio original
        if ((discountAmount + initialPayment) > price) {
            errors.push({
                field: 'general',
                message: `🚫 La suma de descuento (${this.formatCurrency(discountAmount)}) y cuota inicial (${this.formatCurrency(initialPayment)}) excede el precio del lote (${this.formatCurrency(price)})`,
                severity: 'error',
                code: 'SUM_EXCEEDS_PRICE'
            });
        }

        // Validar que el precio sea positivo
        if (price <= 0) {
            errors.push({
                field: 'price',
                message: '🚫 El precio del lote debe ser mayor a cero.',
                severity: 'error',
                code: 'INVALID_PRICE'
            });
        }

        // ====================================================================
        // 5. WARNINGS ADICIONALES (RIESGOS DE NEGOCIO)
        // ====================================================================

        // Warning: Descuento alto con cuota inicial baja = Alto riesgo
        if (discountPercent > 10 && initialPaymentPercent < 15) {
            warnings.push({
                field: 'risk',
                message: '⚠️ ALTO RIESGO: Descuento alto combinado con cuota inicial baja. Riesgo de cobranza incrementado. Considera aumentar la cuota inicial.',
                severity: 'warning',
                canProceed: true,
                code: 'HIGH_RISK_COMBINATION'
            });
        }

        // Warning: Plazo muy largo
        if (installments > 60) {
            warnings.push({
                field: 'installments',
                message: `📅 PLAZO LARGO: Plazo mayor a 5 años (${installments} meses). Considerar riesgos a largo plazo y tasa de interés futura.`,
                severity: 'warning',
                canProceed: true,
                code: 'LONG_TERM_WARNING'
            });
        }

        // Warning: Cuota inicial muy baja (menos del 10%)
        if (initialPaymentPercent > 0 && initialPaymentPercent < 10) {
            warnings.push({
                field: 'initialPayment',
                message: `💰 INICIAL BAJA: La cuota inicial es menor al 10% (${initialPaymentPercent.toFixed(1)}%). Esto podría aumentar el riesgo de impago.`,
                severity: 'warning',
                canProceed: true,
                code: 'LOW_INITIAL_WARNING'
            });
        }

        // Warning: Descuento significativo sin justificación obvia
        if (discountPercent > 15) {
            warnings.push({
                field: 'discount',
                message: `🎯 DESCUENTO ALTO: Descuento de ${discountPercent.toFixed(2)}% aplicado. Asegúrate de documentar la justificación comercial.`,
                severity: 'warning',
                canProceed: true,
                code: 'HIGH_DISCOUNT_WARNING'
            });
        }

        // ====================================================================
        // RETORNO DEL RESULTADO
        // ====================================================================
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    },

    /**
     * Valida la disponibilidad y estado del lote antes de cotizar
     * Consulta el estado actual en Odoo para verificar
     * 
     * @param lotId - ID del lote a validar
     * @returns ValidationResult con estado del lote
     */
    async validateLotAvailability(lotId: string): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        
        try {
            // Verificar estado actual del lote en Odoo
            const response = await fetch(`/api/odoo/product/${lotId}`);
            const data = await response.json();
            
            if (!data.success) {
                errors.push({
                    field: 'lot',
                    message: '🚫 No se pudo verificar el estado del lote en Odoo. Verifica tu conexión e intenta nuevamente.',
                    severity: 'error',
                    code: 'LOT_FETCH_ERROR'
                });
                return { isValid: false, errors, warnings };
            }

            const lot = data.product;
            const status = (lot.x_statu || '').toLowerCase();

            // ====================================================================
            // VALIDAR ESTADO DEL LOTE
            // ====================================================================

            // ERROR: Lote vendido (no se puede cotizar)
            if (status === 'vendido') {
                errors.push({
                    field: 'lot',
                    message: '🚫 Este lote ya fue VENDIDO. No es posible crear una cotización.',
                    severity: 'error',
                    code: 'LOT_SOLD'
                });
            }

            // WARNING: Lote en proceso (separado o en cotización)
            if (status === 'separado') {
                warnings.push({
                    field: 'lot',
                    message: `⚠️ Este lote está SEPARADO${lot.x_cliente ? ` para ${lot.x_cliente}` : ''}. Verifica con el equipo antes de cotizar.`,
                    severity: 'warning',
                    canProceed: true,
                    code: 'LOT_RESERVED'
                });
            }

            if (status === 'cotizacion' || status === 'cotización') {
                warnings.push({
                    field: 'lot',
                    message: '⚠️ Ya existe una cotización activa para este lote. Considera revisar la cotización existente antes de crear una nueva.',
                    severity: 'warning',
                    canProceed: true,
                    code: 'LOT_QUOTED'
                });
            }

            // Validar que el lote tenga precio
            if (!lot.list_price || lot.list_price <= 0) {
                errors.push({
                    field: 'lot',
                    message: '🚫 El lote no tiene un precio válido configurado en el sistema.',
                    severity: 'error',
                    code: 'LOT_NO_PRICE'
                });
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };

        } catch (error) {
            console.error('Error al validar disponibilidad del lote:', error);
            errors.push({
                field: 'system',
                message: '🚫 Error al validar disponibilidad del lote. Por favor intenta nuevamente.',
                severity: 'error',
                code: 'SYSTEM_ERROR'
            });
            return { isValid: false, errors, warnings };
        }
    },

    /**
     * Verifica si el usuario tiene permisos para crear cotizaciones
     * 
     * @param userId - ID del usuario
     * @param userRole - Rol del usuario
     * @returns true si tiene permisos
     */
    async validateUserPermissions(userId: string, userRole: string): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        
        // Por ahora, todos los usuarios autenticados pueden cotizar
        // Esta función puede extenderse para validar permisos específicos
        
        if (!userId || !userRole) {
            errors.push({
                field: 'user',
                message: '🚫 No se pudo verificar tus permisos. Por favor inicia sesión nuevamente.',
                severity: 'error',
                code: 'USER_NOT_AUTHENTICATED'
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    },

    /**
     * Formatea un número como moneda en Soles (PEN)
     */
    formatCurrency(amount: number): string {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    },

    /**
     * Calcula el nivel de riesgo de una cotización (0-100)
     * Mayor número = Mayor riesgo
     */
    calculateRiskScore(
        price: number,
        discountPercent: number,
        initialPaymentPercent: number,
        installments: number
    ): number {
        let risk = 0;

        // Factor 1: Descuento (max 30 puntos)
        if (discountPercent > 20) risk += 30;
        else if (discountPercent > 15) risk += 20;
        else if (discountPercent > 10) risk += 10;

        // Factor 2: Cuota inicial (max 30 puntos)
        if (initialPaymentPercent < 10) risk += 30;
        else if (initialPaymentPercent < 15) risk += 20;
        else if (initialPaymentPercent < 20) risk += 10;

        // Factor 3: Plazo (max 20 puntos)
        if (installments > 120) risk += 20;
        else if (installments > 72) risk += 10;
        else if (installments > 48) risk += 5;

        // Factor 4: Combinación riesgosa (max 20 puntos)
        if (discountPercent > 10 && initialPaymentPercent < 15) risk += 20;

        return Math.min(risk, 100);
    },

    /**
     * Obtiene el nivel de riesgo en texto
     */
    getRiskLevel(riskScore: number): 'bajo' | 'medio' | 'alto' | 'muy-alto' {
        if (riskScore >= 70) return 'muy-alto';
        if (riskScore >= 50) return 'alto';
        if (riskScore >= 30) return 'medio';
        return 'bajo';
    }
};

// ============================================================================
// HOOK PARA USAR EN COMPONENTES REACT
// ============================================================================

/**
 * Hook personalizado para validación de cotizaciones
 * Proporciona acceso a las reglas y funciones de validación
 * 
 * @param userRole - Rol del usuario actual
 * @returns Objeto con reglas y funciones de validación
 */
export function useQuoteValidation(userRole: string = 'vendedor') {
    const rules = validationService.getRulesForUser(userRole);

    const validate = (
        price: number,
        discountPercent: number,
        discountAmount: number,
        initialPayment: number,
        installments: number
    ) => {
        return validationService.validateQuotation(
            price,
            discountPercent,
            discountAmount,
            initialPayment,
            installments,
            userRole
        );
    };

    const calculateRisk = (
        price: number,
        discountPercent: number,
        initialPaymentPercent: number,
        installments: number
    ) => {
        const score = validationService.calculateRiskScore(
            price,
            discountPercent,
            initialPaymentPercent,
            installments
        );
        return {
            score,
            level: validationService.getRiskLevel(score)
        };
    };

    return {
        rules,
        validate,
        validateLotAvailability: validationService.validateLotAvailability,
        validateUserPermissions: validationService.validateUserPermissions,
        calculateRisk,
        formatCurrency: validationService.formatCurrency
    };
}

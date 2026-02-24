/**
 * ValidationAlert Component
 * 
 * Componente para mostrar errores y warnings de validación en tiempo real.
 * Proporciona feedback visual claro al usuario sobre problemas en la cotización.
 * 
 * @author Sistema de Cotización TERRA LIMA
 * @version 1.0.0
 */

import { AlertTriangle, XCircle, CheckCircle, Info, X, Shield } from 'lucide-react';
import { ValidationError, ValidationWarning, QuotationRules } from '@/app/services/validationService';

// ============================================================================
// INTERFACES
// ============================================================================

interface ValidationAlertProps {
    errors?: ValidationError[];
    warnings?: ValidationWarning[];
    onDismiss?: () => void;
    className?: string;
}

interface RulesDisplayProps {
    rules: QuotationRules;
    userRole: string;
    className?: string;
}

interface RiskIndicatorProps {
    riskScore: number;
    riskLevel: 'bajo' | 'medio' | 'alto' | 'muy-alto';
    className?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL: ValidationAlert
// ============================================================================

/**
 * Muestra errores y warnings de validación
 */
export function ValidationAlert({ 
    errors = [], 
    warnings = [], 
    onDismiss,
    className = '' 
}: ValidationAlertProps) {
    // Si no hay nada que mostrar, no renderizar
    if (errors.length === 0 && warnings.length === 0) return null;

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Errores Críticos */}
            {errors.map((error, index) => (
                <div
                    key={`error-${index}-${error.code}`}
                    className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 shadow-sm"
                    role="alert"
                >
                    <XCircle className="text-red-500 shrink-0 mt-0.5" size={22} />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-red-900 text-sm mb-1">
                            Error en: {formatFieldName(error.field)}
                        </p>
                        <p className="text-red-700 text-xs leading-relaxed">
                            {error.message}
                        </p>
                        {error.code && (
                            <p className="text-red-500 text-[10px] mt-2 font-mono opacity-70">
                                Código: {error.code}
                            </p>
                        )}
                    </div>
                </div>
            ))}

            {/* Warnings (Advertencias) */}
            {warnings.map((warning, index) => (
                <div
                    key={`warning-${index}-${warning.code}`}
                    className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 shadow-sm"
                    role="alert"
                >
                    <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={22} />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-yellow-900 text-sm mb-1">
                            Advertencia: {formatFieldName(warning.field)}
                        </p>
                        <p className="text-yellow-800 text-xs leading-relaxed">
                            {warning.message}
                        </p>
                        {warning.canProceed && (
                            <p className="text-yellow-700 text-xs mt-2 flex items-center gap-1 italic">
                                <Info size={12} />
                                Puedes continuar bajo tu responsabilidad
                            </p>
                        )}
                        {warning.code && (
                            <p className="text-yellow-600 text-[10px] mt-2 font-mono opacity-70">
                                Código: {warning.code}
                            </p>
                        )}
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-yellow-600 hover:text-yellow-800 transition-colors p-1 rounded hover:bg-yellow-100"
                            aria-label="Cerrar advertencia"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// COMPONENTE: RulesDisplay
// ============================================================================

/**
 * Muestra las reglas aplicables al rol del usuario actual
 */
export function RulesDisplay({ 
    rules, 
    userRole,
    className = '' 
}: RulesDisplayProps) {
    // Determinar el color según el rol
    const roleColor = getRoleColor(userRole);

    return (
        <div className={`bg-gradient-to-br from-${roleColor}-50 to-${roleColor}-100 border border-${roleColor}-200 rounded-xl p-4 shadow-sm ${className}`}>
            <div className="flex items-center gap-2 mb-4">
                <Shield className={`text-${roleColor}-600`} size={20} />
                <div className="flex-1">
                    <h4 className={`font-bold text-${roleColor}-900 text-sm`}>
                        Límites de cotización
                    </h4>
                    <p className={`text-${roleColor}-700 text-xs`}>
                        Rol: <span className="font-semibold capitalize">{userRole}</span>
                    </p>
                </div>
                <div className={`px-2 py-1 bg-${roleColor}-200 rounded-full`}>
                    <p className={`text-${roleColor}-800 text-[10px] font-bold uppercase tracking-wide`}>
                        {getRoleLabel(userRole)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {/* Descuento Máximo */}
                <RuleCard
                    icon="💸"
                    label="Descuento Máx."
                    value={`${rules.maxDiscountPercent}%`}
                    color={roleColor}
                    tooltip="Porcentaje máximo de descuento que puedes aplicar sin aprobación"
                />

                {/* Inicial Mínima */}
                <RuleCard
                    icon="💰"
                    label="Inicial Mín."
                    value={`${rules.minInitialPaymentPercent}%`}
                    color={roleColor}
                    tooltip="Porcentaje mínimo de cuota inicial requerido"
                />

                {/* Plazo Máximo */}
                <RuleCard
                    icon="📅"
                    label="Plazo Máx."
                    value={`${rules.maxInstallments}m`}
                    color={roleColor}
                    tooltip="Número máximo de meses de financiamiento"
                />
            </div>

            {/* Información adicional */}
            <div className={`mt-3 pt-3 border-t border-${roleColor}-200`}>
                <div className="flex items-start gap-2">
                    <Info className={`text-${roleColor}-600 shrink-0`} size={14} />
                    <p className={`text-${roleColor}-700 text-xs leading-relaxed`}>
                        {rules.canOverride ? (
                            <>
                                <span className="font-semibold">Puedes sobreescribir</span> estos límites con justificación escrita.
                            </>
                        ) : (
                            <>
                                <span className="font-semibold">No puedes exceder</span> estos límites. Contacta a un supervisor.
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// COMPONENTE: RuleCard (Tarjeta individual de regla)
// ============================================================================

function RuleCard({ 
    icon, 
    label, 
    value, 
    color,
    tooltip 
}: { 
    icon: string; 
    label: string; 
    value: string; 
    color: string;
    tooltip?: string;
}) {
    return (
        <div 
            className="bg-white rounded-lg p-3 border border-slate-200 hover:shadow-md transition-shadow"
            title={tooltip}
        >
            <p className="text-slate-500 text-[10px] font-medium mb-1 uppercase tracking-wide flex items-center gap-1">
                <span>{icon}</span>
                <span>{label}</span>
            </p>
            <p className={`text-${color}-900 font-bold text-xl`}>
                {value}
            </p>
        </div>
    );
}

// ============================================================================
// COMPONENTE: RiskIndicator
// ============================================================================

/**
 * Indicador visual del nivel de riesgo de la cotización
 */
export function RiskIndicator({ 
    riskScore, 
    riskLevel,
    className = '' 
}: RiskIndicatorProps) {
    const config = getRiskConfig(riskLevel);

    return (
        <div className={`bg-gradient-to-br ${config.bgGradient} border ${config.borderColor} rounded-xl p-4 shadow-sm ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 ${config.iconBg} rounded-full flex items-center justify-center`}>
                        <span className="text-2xl">{config.icon}</span>
                    </div>
                    <div>
                        <p className="text-xs text-slate-600 font-medium">Nivel de Riesgo</p>
                        <p className={`text-sm font-bold ${config.textColor} capitalize`}>
                            {riskLevel.replace('-', ' ')}
                        </p>
                    </div>
                </div>
                <div className={`px-3 py-1 ${config.badgeBg} rounded-full`}>
                    <p className={`text-sm font-bold ${config.badgeText}`}>
                        {riskScore}
                    </p>
                </div>
            </div>

            {/* Barra de progreso */}
            <div className="relative">
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${config.barColor} transition-all duration-500 ease-out`}
                        style={{ width: `${riskScore}%` }}
                    />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 text-right font-medium">
                    {riskScore}/100
                </p>
            </div>

            {/* Mensaje */}
            <p className={`text-xs ${config.messageColor} mt-3 leading-relaxed`}>
                {config.message}
            </p>
        </div>
    );
}

// ============================================================================
// COMPONENTE: ValidationSummary
// ============================================================================

/**
 * Resumen compacto del estado de validación
 */
export function ValidationSummary({
    isValid,
    errorCount,
    warningCount,
    className = ''
}: {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    className?: string;
}) {
    if (isValid && warningCount === 0) {
        return (
            <div className={`bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 ${className}`}>
                <CheckCircle className="text-green-600" size={18} />
                <p className="text-green-800 text-sm font-medium">
                    ✓ Cotización válida, lista para guardar
                </p>
            </div>
        );
    }

    return (
        <div className={`bg-slate-50 border border-slate-200 rounded-lg p-3 ${className}`}>
            <div className="flex items-center gap-4 text-sm">
                {errorCount > 0 && (
                    <div className="flex items-center gap-1.5">
                        <XCircle className="text-red-500" size={16} />
                        <span className="text-red-700 font-medium">
                            {errorCount} error{errorCount !== 1 ? 'es' : ''}
                        </span>
                    </div>
                )}
                {warningCount > 0 && (
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle className="text-yellow-500" size={16} />
                        <span className="text-yellow-700 font-medium">
                            {warningCount} advertencia{warningCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Formatea el nombre del campo para mostrar en español
 */
function formatFieldName(field: string): string {
    const fieldNames: Record<string, string> = {
        'discount': 'Descuento',
        'initialPayment': 'Cuota Inicial',
        'installments': 'Plazo',
        'price': 'Precio',
        'lot': 'Lote',
        'user': 'Usuario',
        'system': 'Sistema',
        'general': 'Validación General',
        'risk': 'Análisis de Riesgo'
    };
    return fieldNames[field] || field;
}

/**
 * Obtiene el color según el rol
 */
function getRoleColor(role: string): string {
    const normalized = role.toLowerCase();
    switch (normalized) {
        case 'admin':
            return 'purple';
        case 'gerente':
            return 'blue';
        case 'supervisor':
            return 'indigo';
        case 'vendedor':
        default:
            return 'slate';
    }
}

/**
 * Obtiene la etiqueta del rol
 */
function getRoleLabel(role: string): string {
    const normalized = role.toLowerCase();
    switch (normalized) {
        case 'admin':
            return 'Sin límites';
        case 'gerente':
            return 'Amplio';
        case 'supervisor':
            return 'Medio';
        case 'vendedor':
        default:
            return 'Básico';
    }
}

/**
 * Obtiene la configuración visual según el nivel de riesgo
 */
function getRiskConfig(level: 'bajo' | 'medio' | 'alto' | 'muy-alto') {
    switch (level) {
        case 'muy-alto':
            return {
                icon: '🔴',
                bgGradient: 'from-red-50 to-red-100',
                borderColor: 'border-red-300',
                textColor: 'text-red-900',
                barColor: 'bg-red-600',
                messageColor: 'text-red-800',
                iconBg: 'bg-red-200',
                badgeBg: 'bg-red-200',
                badgeText: 'text-red-900',
                message: '⚠️ RIESGO MUY ALTO: Esta cotización requiere aprobación especial y revisión exhaustiva de garantías.'
            };
        case 'alto':
            return {
                icon: '🟠',
                bgGradient: 'from-orange-50 to-orange-100',
                borderColor: 'border-orange-300',
                textColor: 'text-orange-900',
                barColor: 'bg-orange-500',
                messageColor: 'text-orange-800',
                iconBg: 'bg-orange-200',
                badgeBg: 'bg-orange-200',
                badgeText: 'text-orange-900',
                message: '⚠️ Riesgo alto: Considera solicitar garantías adicionales o aumentar la cuota inicial.'
            };
        case 'medio':
            return {
                icon: '🟡',
                bgGradient: 'from-yellow-50 to-yellow-100',
                borderColor: 'border-yellow-300',
                textColor: 'text-yellow-900',
                barColor: 'bg-yellow-500',
                messageColor: 'text-yellow-800',
                iconBg: 'bg-yellow-200',
                badgeBg: 'bg-yellow-200',
                badgeText: 'text-yellow-900',
                message: 'ℹ️ Riesgo moderado: Verifica la capacidad de pago del cliente antes de confirmar.'
            };
        case 'bajo':
        default:
            return {
                icon: '🟢',
                bgGradient: 'from-green-50 to-green-100',
                borderColor: 'border-green-300',
                textColor: 'text-green-900',
                barColor: 'bg-green-500',
                messageColor: 'text-green-800',
                iconBg: 'bg-green-200',
                badgeBg: 'bg-green-200',
                badgeText: 'text-green-900',
                message: '✓ Riesgo bajo: Cotización dentro de parámetros normales de operación.'
            };
    }
}

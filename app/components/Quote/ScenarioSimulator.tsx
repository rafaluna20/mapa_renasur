/**
 * ScenarioSimulator Component
 * 
 * Simulador de escenarios financieros para cotizaciones.
 * Permite al usuario comparar 3 escenarios diferentes de plazo:
 * - Corto plazo (-40% del plazo base)
 * - Plazo actual (el configurado)
 * - Largo plazo (+50% del plazo base)
 * 
 * @author Sistema de Cotización TERRA LIMA
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { financeService, QuoteCalculations } from '@/app/services/financeService';
import { TrendingDown, TrendingUp, Minus, DollarSign, Calendar, Target } from 'lucide-react';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

interface ScenarioSimulatorProps {
    basePrice: number;
    discountPercent: number;
    initialPayment: number;
    baseInstallments: number;
    startDate: Date;
    className?: string;
}

interface ScenarioCardProps {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    scenario: QuoteCalculations;
    installments: number;
    color: 'green' | 'blue' | 'orange';
    badge: string;
    isActive?: boolean;
    savings?: number;
    onSelect?: () => void;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function ScenarioSimulator({
    basePrice,
    discountPercent,
    initialPayment,
    baseInstallments,
    startDate,
    className = ''
}: ScenarioSimulatorProps) {
    
    // ========================================================================
    // CÁLCULO DE ESCENARIOS
    // ========================================================================
    
    const scenarios = useMemo(() => {
        // Escenario 1: CORTO PLAZO (60% del plazo base, mínimo 12 meses)
        const shortInstallments = Math.max(12, Math.floor(baseInstallments * 0.6));
        const optimistic = financeService.calculateQuote(
            basePrice,
            discountPercent,
            initialPayment,
            shortInstallments,
            startDate
        );

        // Escenario 2: PLAZO ACTUAL (el seleccionado por el usuario)
        const realistic = financeService.calculateQuote(
            basePrice,
            discountPercent,
            initialPayment,
            baseInstallments,
            startDate
        );

        // Escenario 3: LARGO PLAZO (150% del plazo base, máximo 180 meses)
        const longInstallments = Math.min(180, Math.floor(baseInstallments * 1.5));
        const extended = financeService.calculateQuote(
            basePrice,
            discountPercent,
            initialPayment,
            longInstallments,
            startDate
        );

        return { 
            optimistic, 
            realistic, 
            extended,
            shortInstallments,
            longInstallments
        };
    }, [basePrice, discountPercent, initialPayment, baseInstallments, startDate]);



    // ========================================================================
    // RENDERIZADO
    // ========================================================================
    
    return (
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Target size={20} className="text-indigo-600" />
                        Simulador de Escenarios
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Compara diferentes opciones de plazo para esta cotización
                    </p>
                </div>
                <div className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                        3 Opciones
                    </p>
                </div>
            </div>
            
            {/* Grid de Escenarios */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Escenario 1: CORTO PLAZO */}
                <ScenarioCard
                    title="Plazo Corto"
                    subtitle="Paga más rápido"
                    icon={<TrendingDown className="text-green-600" size={22} />}
                    scenario={scenarios.optimistic}
                    installments={scenarios.shortInstallments}
                    color="green"
                    badge="Ahorro"
                />

                {/* Escenario 2: PLAZO ACTUAL (SELECCIONADO) */}
                <ScenarioCard
                    title="Plazo Actual"
                    subtitle="Tu selección"
                    icon={<Minus className="text-blue-600" size={22} />}
                    scenario={scenarios.realistic}
                    installments={baseInstallments}
                    color="blue"
                    badge="Seleccionado"
                    isActive
                />

                {/* Escenario 3: LARGO PLAZO */}
                <ScenarioCard
                    title="Plazo Largo"
                    subtitle="Cuotas más bajas"
                    icon={<TrendingUp className="text-orange-600" size={22} />}
                    scenario={scenarios.extended}
                    installments={scenarios.longInstallments}
                    color="orange"
                    badge="Flexible"
                />
            </div>

            {/* Nota informativa */}
            <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-start gap-2">
                    <div className="w-5 h-5 bg-blue-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-blue-600 text-xs">💡</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        <span className="font-semibold">Nota:</span> Estos escenarios son referenciales 
                        y no incluyen intereses. El cliente puede personalizar cualquier plazo entre 
                        12 y 180 meses según sus necesidades.
                    </p>
                </div>
            </div>

            {/* Comparativa rápida */}
            <div className="mt-4 bg-slate-50 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">
                    Comparativa de Cuotas
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Corto</p>
                        <p className="text-sm font-bold text-green-700">
                            {financeService.formatCurrency(scenarios.optimistic.monthlyInstallment)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            {scenarios.shortInstallments}m
                        </p>
                    </div>
                    <div className="border-x border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Actual</p>
                        <p className="text-sm font-bold text-blue-700">
                            {financeService.formatCurrency(scenarios.realistic.monthlyInstallment)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            {baseInstallments}m
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Largo</p>
                        <p className="text-sm font-bold text-orange-700">
                            {financeService.formatCurrency(scenarios.extended.monthlyInstallment)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            {scenarios.longInstallments}m
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// COMPONENTE: ScenarioCard
// ============================================================================

function ScenarioCard({ 
    title, 
    subtitle,
    icon, 
    scenario, 
    installments, 
    color, 
    badge, 
    isActive = false,
    savings,
    onSelect
}: ScenarioCardProps) {
    
    // Configuración de colores por escenario
    const colorClasses = {
        green: {
            border: 'border-green-200',
            bg: 'bg-green-50',
            badgeBg: 'bg-green-100',
            badgeText: 'text-green-700',
            textPrimary: 'text-green-900',
            textSecondary: 'text-green-600',
            hover: 'hover:border-green-300 hover:shadow-md'
        },
        blue: {
            border: 'border-blue-300',
            bg: 'bg-blue-50',
            badgeBg: 'bg-blue-100',
            badgeText: 'text-blue-700',
            textPrimary: 'text-blue-900',
            textSecondary: 'text-blue-600',
            hover: 'hover:border-blue-400 hover:shadow-lg'
        },
        orange: {
            border: 'border-orange-200',
            bg: 'bg-orange-50',
            badgeBg: 'bg-orange-100',
            badgeText: 'text-orange-700',
            textPrimary: 'text-orange-900',
            textSecondary: 'text-orange-600',
            hover: 'hover:border-orange-300 hover:shadow-md'
        }
    };

    const colors = colorClasses[color];

    return (
        <div 
            className={`
                rounded-xl border-2 p-4 transition-all cursor-default
                ${colors.border} ${colors.bg} ${colors.hover}
                ${isActive ? 'ring-2 ring-offset-2 ring-blue-500 scale-105' : ''}
            `}
            onClick={onSelect}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 ${colors.badgeBg} rounded-full flex items-center justify-center`}>
                        {icon}
                    </div>
                    <div>
                        <h4 className={`font-bold text-sm ${colors.textPrimary}`}>
                            {title}
                        </h4>
                        <p className={`text-[10px] ${colors.textSecondary}`}>
                            {subtitle}
                        </p>
                    </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${colors.badgeBg} ${colors.badgeText}`}>
                    {badge}
                </span>
            </div>

            {/* Cuota Mensual (Destacado) */}
            <div className="mb-4">
                <p className="text-[10px] text-slate-500 mb-1 font-medium uppercase tracking-wider">
                    Cuota Mensual
                </p>
                <p className={`text-2xl font-bold ${colors.textPrimary} font-mono`}>
                    {financeService.formatCurrency(scenario.monthlyInstallment)}
                </p>
            </div>

            {/* Detalles */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
                {/* Plazo */}
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 flex items-center gap-1">
                        <Calendar size={12} />
                        Plazo:
                    </span>
                    <span className={`font-bold ${colors.textPrimary}`}>
                        {installments} meses
                    </span>
                </div>

                {/* Monto a financiar */}
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 flex items-center gap-1">
                        <DollarSign size={12} />
                        A financiar:
                    </span>
                    <span className="font-semibold text-slate-700">
                        {financeService.formatCurrency(scenario.remainingBalance)}
                    </span>
                </div>

                {/* Última cuota */}
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Última cuota:</span>
                    <span className="font-medium text-slate-700">
                        {financeService.formatDate(
                            scenario.installments[scenario.installments.length - 1]?.date || new Date()
                        ).split(' de ')[0]} {/* Solo mes y año */}
                    </span>
                </div>
            </div>

            {/* Indicador de ahorro (si aplica) */}
            {savings && savings > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                        <span>💰</span>
                        <span>Ahorras {financeService.formatCurrency(savings)}</span>
                    </p>
                </div>
            )}

            {/* Indicador de activo */}
            {isActive && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-[10px] text-blue-700 font-bold flex items-center justify-center gap-1">
                        <span>✓</span>
                        <span>OPCIÓN ACTUAL</span>
                    </p>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// COMPONENTE AUXILIAR: ComparisonTable
// ============================================================================

/**
 * Tabla comparativa detallada (opcional, se puede agregar)
 */
export function ScenarioComparisonTable({
    scenarios,
    baseInstallments
}: {
    scenarios: {
        optimistic: QuoteCalculations;
        realistic: QuoteCalculations;
        extended: QuoteCalculations;
        shortInstallments: number;
        longInstallments: number;
    };
    baseInstallments: number;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="text-left p-3 font-bold text-slate-700 border-b">Concepto</th>
                        <th className="text-right p-3 font-bold text-green-700 border-b">Corto</th>
                        <th className="text-right p-3 font-bold text-blue-700 border-b">Actual</th>
                        <th className="text-right p-3 font-bold text-orange-700 border-b">Largo</th>
                    </tr>
                </thead>
                <tbody className="text-slate-700">
                    <tr className="border-b border-slate-100">
                        <td className="p-3">Cuota mensual</td>
                        <td className="p-3 text-right font-mono">
                            {financeService.formatCurrency(scenarios.optimistic.monthlyInstallment)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                            {financeService.formatCurrency(scenarios.realistic.monthlyInstallment)}
                        </td>
                        <td className="p-3 text-right font-mono">
                            {financeService.formatCurrency(scenarios.extended.monthlyInstallment)}
                        </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                        <td className="p-3">Número de cuotas</td>
                        <td className="p-3 text-right">{scenarios.shortInstallments}</td>
                        <td className="p-3 text-right font-bold">{baseInstallments}</td>
                        <td className="p-3 text-right">{scenarios.longInstallments}</td>
                    </tr>
                    <tr className="bg-slate-50">
                        <td className="p-3 font-bold">Total a pagar</td>
                        <td className="p-3 text-right font-mono font-bold">
                            {financeService.formatCurrency(
                                scenarios.optimistic.initialPayment + 
                                (scenarios.optimistic.monthlyInstallment * scenarios.shortInstallments)
                            )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                            {financeService.formatCurrency(
                                scenarios.realistic.initialPayment + 
                                (scenarios.realistic.monthlyInstallment * baseInstallments)
                            )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                            {financeService.formatCurrency(
                                scenarios.extended.initialPayment + 
                                (scenarios.extended.monthlyInstallment * scenarios.longInstallments)
                            )}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default ScenarioSimulator;

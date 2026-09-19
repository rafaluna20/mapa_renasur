'use client';

import { Building2, Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/app/utils/clipboard';
import { formatMoney, currencyName, type CurrencyCode } from '@/app/utils/money';
import { BANK_ACCOUNTS } from '@/app/lib/bankAccounts';

interface BankDetailsCardProps {
    paymentReference: string;
    amount: number;
    /** Moneda de la cuota; determina la cuenta a mostrar y el monto. Por defecto soles. */
    currency?: CurrencyCode;
}

export default function BankDetailsCard({ paymentReference, amount, currency = 'PEN' }: BankDetailsCardProps) {
    // Cuenta de ESTA moneda: nunca se muestra la de soles para una cuota en dólares.
    const account = BANK_ACCOUNTS[currency];
    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Building2 size={20} className="text-white" />
                </div>
                <div>
                    <h4 className="font-bold text-blue-900">Datos para Transferencia</h4>
                    <p className="text-xs text-blue-700">Renacimiento del Sur S.A.C.</p>
                </div>
            </div>

            <div className="space-y-3">
                {account ? (
                    <>
                        <DetailRow
                            label="🏦 Banco"
                            value={account.bank}
                        />

                        <DetailRow
                            label={`💳 N° de cuenta (${currencyName(currency)})`}
                            value={account.account}
                            copyable
                        />

                        {account.cci && (
                            <DetailRow
                                label="🔢 CCI (Interbancario)"
                                value={account.cci}
                                copyable
                            />
                        )}

                        <DetailRow
                            label="👤 Titular"
                            value={account.holder}
                        />
                    </>
                ) : (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3" role="note">
                        <p className="text-sm font-bold text-amber-900">
                            Esta cuota es en {currencyName(currency)}
                        </p>
                        <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                            Solicita a tu asesor los datos de la cuenta en {currencyName(currency)} antes de
                            transferir. No transfieras a una cuenta en otra moneda.
                        </p>
                    </div>
                )}
                
                <div className="border-t border-blue-200 pt-3 mt-3">
                    <DetailRow 
                        label="💰 Monto a Transferir" 
                        value={formatMoney(amount, currency)}
                        highlight
                    />
                    
                    <DetailRow 
                        label="📝 Concepto/Referencia" 
                        value={paymentReference}
                        copyable
                        highlight
                    />
                </div>
            </div>

            <div className="bg-blue-100 rounded-lg p-3 mt-4">
                <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>Importante:</strong> Al realizar la transferencia, incluye la referencia{' '}
                    <code className="bg-blue-200 px-1 py-0.5 rounded font-mono text-[10px]">
                        {paymentReference}
                    </code>
                    {' '}en el concepto para agilizar la validación de tu pago.
                </p>
            </div>
        </div>
    );
}

function DetailRow({ 
    label, 
    value, 
    copyable = false, 
    highlight = false 
}: { 
    label: string; 
    value: string; 
    copyable?: boolean; 
    highlight?: boolean;
}) {
    const { copied, copy } = useCopyToClipboard();

    return (
        <div className={`flex items-center justify-between gap-2 p-2 rounded-lg ${
            highlight ? 'bg-amber-50 border border-amber-200' : ''
        }`}>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 mb-0.5">{label}</p>
                <p className={`font-mono text-sm font-bold break-all ${
                    highlight ? 'text-amber-900' : 'text-slate-800'
                }`}>
                    {value}
                </p>
            </div>
            
            {copyable && (
                <button
                    onClick={() => copy(value)}
                    className="flex-shrink-0 p-2 hover:bg-blue-100 rounded-lg transition-colors group"
                    title={copied ? 'Copiado!' : 'Copiar'}
                    aria-label={`Copiar ${label}`}
                >
                    {copied ? (
                        <Check size={16} className="text-emerald-600" />
                    ) : (
                        <Copy size={16} className="text-blue-600 group-hover:text-blue-700" />
                    )}
                </button>
            )}
        </div>
    );
}

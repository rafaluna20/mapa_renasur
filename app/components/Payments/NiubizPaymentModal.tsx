'use client';

import { useState } from 'react';
import { X, CreditCard, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface NiubizPaymentModalProps {
    invoiceId: number;
    amount: number;
    paymentReference: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function NiubizPaymentModal({
    invoiceId,
    amount,
    paymentReference,
    onClose,
    onSuccess
}: NiubizPaymentModalProps) {
    const [loading, setLoading] = useState(false);
    const [sessionKey, setSessionKey] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'init' | 'payment' | 'processing' | 'success' | 'error'>('init');

    const initializePayment = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/payments/niubiz/create-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: invoiceId })
            });

            const data = await response.json();

            if (data.success) {
                setSessionKey(data.sessionKey);
                setStep('payment');

                // Cargar script de Niubiz
                loadNiubizScript(data.sessionKey, data.merchantId);
            } else {
                setError(data.error || 'Error al inicializar pago');
                setStep('error');
            }
        } catch (err: any) {
            setError(err.message || 'Error de conexión');
            setStep('error');
        } finally {
            setLoading(false);
        }
    };

    const loadNiubizScript = (sessionKey: string, merchantId: string) => {
        // En producción, usar el script real de Niubiz
        // Por ahora, simulamos el proceso
        console.log('[Niubiz Demo] SessionKey:', sessionKey);
        console.log('[Niubiz Demo] MerchantID:', merchantId);

        // TODO: Implementar script real
        // const script = document.createElement('script');
        // script.src = 'https://static-content-qas.vnforapps.com/v2/js/checkout.js?qa=true'; // Sandbox URL
        // script.async = true;
        // document.body.appendChild(script);
    };

    const handleAuthorize = async () => {
        setStep('processing');

        // DEMO: Simular autorización exitosa
        setTimeout(() => {
            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        }, 1500);

        // TODO: Implementación real
        /*
        try {
          const response = await fetch('/api/payments/niubiz/authorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactionToken: 'TRANSACTION_TOKEN_FROM_NIUBIZ',
              amount,
              paymentReference,
              invoiceId
            })
          });
    
          const data = await response.json();
    
          if (data.success) {
            setStep('success');
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 2000);
          } else {
            setError(data.error || 'Pago rechazado');
            setStep('error');
          }
        } catch (err: any) {
          setError(err.message || 'Error al procesar pago');
          setStep('error');
        }
        */
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#A145F5] rounded-lg flex items-center justify-center">
                            <CreditCard size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Pago con Tarjeta</h3>
                            <p className="text-sm text-slate-500">Procesado por Niubiz</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        disabled={step === 'processing'}
                    >
                        <X size={20} className="text-slate-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Payment Info */}
                    <div className="bg-slate-50 rounded-xl p-4 mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-slate-600">Referencia:</span>
                            <span className="font-mono text-sm font-bold text-slate-800">{paymentReference}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Monto a pagar:</span>
                            <span className="text-2xl font-bold text-[#A145F5]">S/ {amount.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Steps */}
                    {step === 'init' && (
                        <div className="text-center py-8">
                            <p className="text-slate-600 mb-6">
                                Haz clic en el botón para iniciar el proceso de pago seguro
                            </p>
                            <button
                                onClick={initializePayment}
                                disabled={loading}
                                className="w-full bg-[#A145F5] text-white py-4 rounded-xl font-bold hover:bg-[#8D32DF] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Iniciando...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={20} />
                                        Iniciar Pago
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {step === 'payment' && (
                        <div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-amber-800 font-medium">
                                    ⚠️ <strong>Modo Demo:</strong> El formulario de Niubiz se integrará aquí.
                                    Por ahora, simula la autorización.
                                </p>
                            </div>

                            {/* Aquí iría el iframe/formulario de Niubiz */}
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center mb-6">
                                <CreditCard size={48} className="mx-auto text-slate-400 mb-4" />
                                <p className="text-slate-600 mb-2">Formulario de pago Niubiz</p>
                                <p className="text-sm text-slate-400">
                                    Integración iframe pendiente
                                </p>
                            </div>

                            <button
                                onClick={handleAuthorize}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                            >
                                Simular Pago Exitoso (Demo)
                            </button>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center py-12">
                            <Loader2 size={64} className="mx-auto animate-spin text-[#A145F5] mb-4" />
                            <h4 className="text-lg font-bold text-slate-800 mb-2">Procesando pago...</h4>
                            <p className="text-slate-500">No cierres esta ventana</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 size={40} className="text-emerald-600" />
                            </div>
                            <h4 className="text-2xl font-bold text-emerald-600 mb-2">¡Pago Exitoso!</h4>
                            <p className="text-slate-600">Tu cuota ha sido pagada correctamente</p>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle size={40} className="text-red-600" />
                            </div>
                            <h4 className="text-xl font-bold text-red-600 mb-2">Error en el Pago</h4>
                            <p className="text-slate-600 mb-6">{error}</p>
                            <button
                                onClick={() => setStep('init')}
                                className="px-6 py-3 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

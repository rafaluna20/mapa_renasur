'use client';

import { useState } from 'react';

interface LeadFormProps {
    lotId: number;
    lotCode: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
}

type EstadoEnvio = 'idle' | 'enviando' | 'ok' | 'error';

export default function LeadForm({ lotId, lotCode, utmSource, utmMedium, utmCampaign }: LeadFormProps) {
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [website, setWebsite] = useState(''); // honeypot — un visitante real nunca llena esto
    const [estado, setEstado] = useState<EstadoEnvio>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEstado('enviando');
        setError(null);

        try {
            const res = await fetch('/api/public/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre,
                    telefono,
                    email: email || undefined,
                    lotId,
                    utmSource,
                    utmMedium,
                    utmCampaign,
                    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
                    pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
                    website,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'No se pudo enviar tu solicitud.');
                setEstado('error');
                return;
            }
            setEstado('ok');
        } catch {
            setError('No se pudo enviar tu solicitud. Revisa tu conexión e intenta de nuevo.');
            setEstado('error');
        }
    };

    if (estado === 'ok') {
        return (
            <p className="venta-lead-success">
                ¡Listo! Un asesor te va a contactar pronto por el lote {lotCode}.
            </p>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="venta-lead-form">
            <label className="sr-only" htmlFor="venta-lead-nombre">Nombre</label>
            <input
                id="venta-lead-nombre"
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="venta-field"
                placeholder="Tu nombre"
            />

            <label className="sr-only" htmlFor="venta-lead-telefono">Teléfono / WhatsApp</label>
            <input
                id="venta-lead-telefono"
                type="tel"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="venta-field"
                placeholder="Tu WhatsApp"
            />

            <label className="sr-only" htmlFor="venta-lead-email">Email (opcional)</label>
            <input
                id="venta-lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="venta-field"
                placeholder="Tu correo (opcional)"
            />

            {/* Campo trampa (honeypot): oculto para una persona real, un bot
                de formularios lo llena. Nunca mostrar este campo visualmente. */}
            <div className="hidden" aria-hidden="true">
                <label>No llenar este campo</label>
                <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                />
            </div>

            {error && <p className="venta-lead-error">{error}</p>}

            <button type="submit" disabled={estado === 'enviando'} className="venta-submit">
                {estado === 'enviando' ? 'Enviando…' : 'QUIERO QUE ME LLAMEN'}
            </button>
        </form>
    );
}

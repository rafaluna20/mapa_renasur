'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker
                    .register('/sw.js')
                    .then((registration) => {
                        console.log('[SW] Registrado correctamente:', registration.scope);
                    })
                    .catch((err) => {
                        console.warn('[SW] Error al registrar:', err);
                    });
            });
        }
    }, []);

    return null;
}

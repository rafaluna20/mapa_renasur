import { useEffect, useState } from 'react';
import { useDebounce } from './useDebounce';

export interface DniRucLookupResult {
    docType: 'dni' | 'ruc';
    name: string;
}

/**
 * Consulta RENIEC (DNI, 8 dígitos) / SUNAT (RUC, 11 dígitos) vía /api/dni-lookup
 * apenas `doc` tiene una longitud válida, para autocompletar el nombre al crear
 * un cliente nuevo. `enabled` permite desactivar la consulta (p. ej. mientras
 * el formulario de "nuevo cliente" está oculto).
 */
export function useDniRucLookup(doc: string, enabled: boolean = true) {
    const [result, setResult] = useState<DniRucLookupResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cleanDoc = doc.replace(/\D/g, '');
    const debouncedDoc = useDebounce(cleanDoc, 500);

    useEffect(() => {
        const isValidLength = debouncedDoc.length === 8 || debouncedDoc.length === 11;

        if (!enabled || !isValidLength) {
            setResult(null);
            setError(null);
            return;
        }

        let cancelled = false;

        (async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/dni-lookup?doc=${debouncedDoc}`);
                const data = await res.json();
                if (cancelled) return;

                if (!res.ok || !data.success) {
                    setError(data.error || 'No se pudo consultar el documento');
                    setResult(null);
                    return;
                }
                setResult({ docType: data.docType, name: data.name });
            } catch {
                if (!cancelled) {
                    setError('Error de conexión al consultar el documento');
                    setResult(null);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [debouncedDoc, enabled]);

    return { result, isLoading, error };
}

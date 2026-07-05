import { useCallback, useState } from 'react';

export interface DniRucLookupResult {
    docType: 'dni' | 'ruc';
    name: string;
}

/**
 * Consulta RENIEC (DNI, 8 dígitos) / SUNAT (RUC, 11 dígitos) vía /api/dni-lookup.
 * Se dispara explícitamente (Enter o botón "Buscar"), no en cada tecla: así el
 * resultado mostrado siempre corresponde al documento que el usuario acaba de
 * confirmar, sin quedar un nombre de una búsqueda anterior pisado en el campo.
 */
export function useDniRucLookup() {
    const [result, setResult] = useState<DniRucLookupResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const lookup = useCallback(async (doc: string): Promise<DniRucLookupResult | null> => {
        const clean = doc.replace(/\D/g, '');
        const isValidLength = clean.length === 8 || clean.length === 11;

        setResult(null);
        setError(null);

        if (!isValidLength) {
            setError('Ingresa un DNI (8 dígitos) o RUC (11 dígitos) válido');
            return null;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`/api/dni-lookup?doc=${clean}`);
            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || 'No se pudo consultar el documento');
                return null;
            }

            const found: DniRucLookupResult = { docType: data.docType, name: data.name };
            setResult(found);
            return found;
        } catch {
            setError('Error de conexión al consultar el documento');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    return { lookup, result, isLoading, error, reset };
}

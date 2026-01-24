/**
 * Utilidades para copiar texto al clipboard con feedback visual
 */

export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // Usar la API moderna del clipboard
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback para navegadores antiguos o contextos no seguros
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            textArea.remove();
            
            return successful;
        }
    } catch (err) {
        console.error('Error copiando al clipboard:', err);
        return false;
    }
}

/**
 * Hook para manejar la funcionalidad de copiar con estado
 */
import { useState } from 'react';

export function useCopyToClipboard(resetDelay: number = 2000) {
    const [copied, setCopied] = useState(false);

    const copy = async (text: string): Promise<boolean> => {
        const success = await copyToClipboard(text);
        
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), resetDelay);
        }
        
        return success;
    };

    return { copied, copy };
}

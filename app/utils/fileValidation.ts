/**
 * Utilidades para validación segura de archivos
 * Valida magic bytes (firma del archivo) en lugar de solo el MIME type
 */

/**
 * Magic bytes (firmas) de tipos de archivos permitidos
 */
const FILE_SIGNATURES = {
    'image/jpeg': [
        [0xFF, 0xD8, 0xFF] // JPEG
    ],
    'image/png': [
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] // PNG
    ],
    'application/pdf': [
        [0x25, 0x50, 0x44, 0x46] // PDF (%PDF)
    ]
};

/**
 * Lee los primeros bytes de un archivo
 */
async function readFileHeader(file: File, bytesToRead: number): Promise<number[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const arr = new Uint8Array(e.target?.result as ArrayBuffer);
            resolve(Array.from(arr));
        };
        
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        
        reader.readAsArrayBuffer(file.slice(0, bytesToRead));
    });
}

/**
 * Verifica si los bytes coinciden con alguna firma conocida
 */
function matchesSignature(bytes: number[], signatures: number[][]): boolean {
    return signatures.some(signature => {
        return signature.every((byte, index) => bytes[index] === byte);
    });
}

/**
 * Valida el tipo real del archivo usando magic bytes
 */
export async function validateFileType(file: File): Promise<{
    isValid: boolean;
    detectedType?: string;
    error?: string;
}> {
    try {
        // Validar tamaño (5MB máximo)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: 'El archivo no debe exceder 5MB'
            };
        }

        // Leer los primeros bytes del archivo
        const bytes = await readFileHeader(file, 12);

        // Verificar contra las firmas conocidas
        for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
            if (matchesSignature(bytes, signatures)) {
                return {
                    isValid: true,
                    detectedType: mimeType
                };
            }
        }

        return {
            isValid: false,
            error: 'Tipo de archivo no permitido. Solo se aceptan JPG, PNG o PDF'
        };
    } catch (error) {
        return {
            isValid: false,
            error: 'Error al validar el archivo'
        };
    }
}

/**
 * Sanitiza el nombre de archivo para evitar inyecciones
 */
export function sanitizeFileName(fileName: string): string {
    // Remover caracteres especiales excepto letras, números, puntos, guiones y guiones bajos
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Obtiene una extensión segura basada en el tipo MIME
 */
export function getExtensionFromMime(mimeType: string): string {
    const extensions: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'application/pdf': '.pdf'
    };
    return extensions[mimeType] || '.bin';
}

/**
 * Servicio Twilio para autenticación SMS
 * NOTA: Configuración demo - actualizar con credenciales reales
 */

interface VerificationCode {
    dni: string;
    code: string;
    phone: string;
    expires_at: Date;
    used: boolean;
}

// Almacenamiento temporal en memoria para demo
// TODO: Migrar a PostgreSQL en producción
const verificationCodes = new Map<string, VerificationCode>();

export const twilioService = {
    /**
     * Enviar código de verificación por SMS
     * DEMO: Solo registra en consola, no envía SMS real
     */
    async sendVerificationCode(phone: string, dni: string): Promise<string> {
        // Generar código de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // DEMO: Log en lugar de enviar SMS
        console.log(`[TWILIO DEMO] SMS to ${phone}: Tu código Terra Lima es ${code}`);

        // Guardar código (expira en 5 minutos)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        verificationCodes.set(dni, {
            dni,
            code,
            phone,
            expires_at: expiresAt,
            used: false
        });

        // Auto-limpiar después de 10 minutos
        setTimeout(() => {
            verificationCodes.delete(dni);
        }, 10 * 60 * 1000);

        return code;
    },

    /**
     * Verificar código ingresado
     */
    async verifyCode(dni: string, code: string): Promise<boolean> {
        const stored = verificationCodes.get(dni);

        if (!stored) {
            console.log(`[TWILIO DEMO] No code found for DNI: ${dni}`);
            return false;
        }

        // Verificar si ya fue usado
        if (stored.used) {
            console.log(`[TWILIO DEMO] Code already used for DNI: ${dni}`);
            return false;
        }

        // Verificar si expiró
        if (new Date() > stored.expires_at) {
            console.log(`[TWILIO DEMO] Code expired for DNI: ${dni}`);
            return false;
        }

        // Verificar código
        if (stored.code !== code) {
            console.log(`[TWILIO DEMO] Invalid code for DNI: ${dni}`);
            return false;
        }

        // Marcar como usado
        stored.used = true;
        console.log(`[TWILIO DEMO] Code verified successfully for DNI: ${dni}`);

        return true;
    },

    /**
     * DEMO: Obtener código para testing
     * ELIMINAR EN PRODUCCIÓN
     */
    getCodeForTesting(dni: string): string | undefined {
        const stored = verificationCodes.get(dni);
        return stored?.code;
    }
};

/**
 * TODO: Implementación con PostgreSQL
 * 
 * CREATE TABLE verification_codes (
 *   id SERIAL PRIMARY KEY,
 *   dni VARCHAR(8) NOT NULL,
 *   code VARCHAR(6) NOT NULL,
 *   phone VARCHAR(15) NOT NULL,
 *   created_at TIMESTAMP DEFAULT NOW(),
 *   expires_at TIMESTAMP NOT NULL,
 *   used BOOLEAN DEFAULT FALSE,
 *   UNIQUE(dni, code)
 * );
 */

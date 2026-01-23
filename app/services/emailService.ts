import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface VerificationCode {
    code: string;
    expiresAt: number;
}

// In-memory storage for verification codes (consider Redis for production)
const codes = new Map<string, VerificationCode>();

export const emailService = {
    /**
     * Send a 6-digit verification code to the user's email
     * @param email - Partner's email address
     * @param dni - Partner's DNI (used as identifier)
     * @returns The generated code (for development logging)
     */
    async sendVerificationCode(email: string, dni: string): Promise<string> {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store code in memory
        codes.set(dni, { code, expiresAt });

        try {
            // Send email with Resend
            await resend.emails.send({
                from: process.env.EMAIL_FROM || 'Terra Lima <onboarding@resend.dev>',
                to: email,
                subject: 'Tu código de verificación - Terra Lima',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #A145F5 0%, #8D32DF 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .code-box { background: white; border: 2px solid #A145F5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                            .code { font-size: 32px; font-weight: bold; color: #A145F5; letter-spacing: 8px; }
                            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 style="margin: 0;">🏠 Terra Lima</h1>
                                <p style="margin: 10px 0 0 0;">Portal de Pagos</p>
                            </div>
                            <div class="content">
                                <h2 style="color: #333; margin-top: 0;">Código de Verificación</h2>
                                <p>Hemos recibido una solicitud para acceder a tu portal de pagos.</p>
                                <p>Ingresa el siguiente código para continuar:</p>
                                
                                <div class="code-box">
                                    <div class="code">${code}</div>
                                </div>
                                
                                <p><strong>⏱️ Este código expira en 10 minutos.</strong></p>
                                <p style="font-size: 14px; color: #666;">Si no solicitaste este código, puedes ignorar este mensaje.</p>
                            </div>
                            <div class="footer">
                                <p>© 2026 Terra Lima - Portal de Clientes</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
            });

            console.log(`[EMAIL] Verification code sent to ${email}`);
            return code;
        } catch (error) {
            console.error('[EMAIL] Error sending verification code:', error);
            throw new Error('Error al enviar el código por email');
        }
    },

    /**
     * Verify a code entered by the user
     * @param dni - Partner's DNI
     * @param inputCode - Code entered by user
     * @returns true if valid, false otherwise
     */
    async verifyCode(dni: string, inputCode: string): Promise<boolean> {
        const stored = codes.get(dni);

        if (!stored) {
            console.log(`[EMAIL] No code found for DNI: ${dni}`);
            return false;
        }

        if (Date.now() > stored.expiresAt) {
            console.log(`[EMAIL] Code expired for DNI: ${dni}`);
            codes.delete(dni);
            return false;
        }

        if (stored.code !== inputCode) {
            console.log(`[EMAIL] Invalid code for DNI: ${dni}`);
            return false;
        }

        // Code is valid, delete it to prevent reuse
        codes.delete(dni);
        console.log(`[EMAIL] Code verified successfully for DNI: ${dni}`);
        return true;
    },

    /**
     * Enviar correo de confirmación de pago validado
     */
    async sendPaymentValidationEmail({
        email,
        userName,
        amount,
        invoiceName,
        paymentReference,
        nextDueDate
    }: {
        email: string;
        userName: string;
        amount: number;
        invoiceName: string;
        paymentReference: string;
        nextDueDate?: string;
    }) {
        try {
            await resend.emails.send({
                from: process.env.EMAIL_FROM || 'Terra Lima <onboarding@resend.dev>',
                to: email,
                subject: '✅ Tu pago ha sido validado exitosamente - Terra Lima',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                        <h2 style="color: #059669; margin-top: 0;">¡Hola ${userName}!</h2>
                        <p style="font-size: 16px; color: #475569;">
                            Te informamos que tu comprobante de pago ha sido validado exitosamente por nuestro equipo.
                        </p>
                        
                        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0;">
                            <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; color: #64748b;">Detalles del Pago</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b;">Monto Validado:</td>
                                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a;">S/ ${amount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b;">Referencia:</td>
                                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a;">${paymentReference}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b;">Documento:</td>
                                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a;">${invoiceName}</td>
                                </tr>
                                ${nextDueDate ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b;">Próximo Vencimiento:</td>
                                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #059669;">${nextDueDate}</td>
                                </tr>
                                ` : ''}
                            </table>
                        </div>

                        <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
                            Ya puedes ver el estado actualizado de tus cuotas en el portal del cliente.
                        </p>

                        <div style="text-align: center;">
                            <a href="${process.env.NEXTAUTH_URL}/portal/pagos" 
                               style="display: inline-block; background-color: #A145F5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                               Ir al Portal de Pagos
                            </a>
                        </div>

                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
                        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                            Este es un correo automático, por favor no respondas a este mensaje.<br/>
                            © ${new Date().getFullYear()} Terra Lima
                        </p>
                    </div>
                `,
            });
            console.log(`[EMAIL] Payment validation email sent to ${email}`);
        } catch (error) {
            console.error('[EMAIL] Error sending payment validation email:', error);
            // Non-blocking error
        }
    }
};

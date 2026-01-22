import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { odooService } from '@/app/services/odooService';
import { twilioService } from '@/app/services/twilioService';

export const authOptions: NextAuthOptions = {
    providers: [
        // Paso 1: Solicitar código SMS
        CredentialsProvider({
            id: 'request-code',
            name: 'Solicitar Código',
            credentials: {
                dni: { label: "DNI", type: "text", placeholder: "12345678" }
            },
            async authorize(credentials) {
                if (!credentials?.dni) {
                    throw new Error('DNI requerido');
                }

                // Validar formato DNI (8 dígitos)
                if (!/^\d{8}$/.test(credentials.dni)) {
                    throw new Error('DNI debe tener 8 dígitos');
                }

                // Buscar partner en Odoo por DNI (campo vat)
                const partners = await odooService.searchRead('res.partner', [
                    ['vat', '=', credentials.dni]
                ], ['id', 'name', 'phone', 'email']);

                if (partners.length === 0) {
                    throw new Error('DNI no registrado en el sistema');
                }

                const partner = partners[0];

                if (!partner.phone) {
                    throw new Error('No hay teléfono registrado para este DNI');
                }

                // Enviar código SMS
                const code = await twilioService.sendVerificationCode(
                    partner.phone,
                    credentials.dni
                );

                // DEMO: Retornar código en el error para testing
                console.log(`[AUTH] Código generado para ${credentials.dni}: ${code}`);

                // No autenticar aún, cliente debe verificar código
                return null;
            }
        }),

        // Paso 2: Verificar código y autenticar
        CredentialsProvider({
            id: 'verify-code',
            name: 'Verificar Código',
            credentials: {
                dni: { label: "DNI", type: "text" },
                code: { label: "Código SMS", type: "text", placeholder: "123456" }
            },
            async authorize(credentials) {
                if (!credentials?.dni || !credentials?.code) {
                    throw new Error('DNI y código requeridos');
                }

                // Verificar código
                const isValid = await twilioService.verifyCode(
                    credentials.dni,
                    credentials.code
                );

                if (!isValid) {
                    throw new Error('Código inválido o expirado');
                }

                // Obtener datos completos del partner
                const partners = await odooService.searchRead('res.partner', [
                    ['vat', '=', credentials.dni]
                ], ['id', 'name', 'email', 'phone', 'vat']);

                if (partners.length === 0) {
                    throw new Error('Partner no encontrado');
                }

                const partner = partners[0];

                return {
                    id: partner.id.toString(),
                    name: partner.name,
                    email: partner.email || `${credentials.dni}@demo.com`,
                    odooPartnerId: partner.id,
                    dni: partner.vat
                };
            }
        })
    ],

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.odooPartnerId = (user as any).odooPartnerId;
                token.dni = (user as any).dni;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).odooPartnerId = token.odooPartnerId;
                (session.user as any).dni = token.dni;
            }
            return session;
        }
    },

    pages: {
        signIn: '/login',
        error: '/login'
    },

    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60 // 30 días
    },

    secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

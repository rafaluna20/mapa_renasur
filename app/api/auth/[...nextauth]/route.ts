import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { fetchOdoo } from '@/app/services/odooService';
import { emailService } from '@/app/services/emailService';

interface ExtendedUser {
    odooPartnerId?: number;
    dni?: string;
}

export const authOptions: NextAuthOptions = {
    providers: [
        // Paso único de NextAuth: Verificar código y autenticar sesión
        CredentialsProvider({
            id: 'verify-code', // Mantenemos el ID para no romper clientes
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
                const isValid = await emailService.verifyCode(
                    credentials.dni,
                    credentials.code
                );

                if (!isValid) {
                    throw new Error('Código inválido o expirado');
                }

                // Obtener datos completos del partner de Odoo
                const partners = await fetchOdoo('res.partner', 'search_read', [
                    [['vat', '=', credentials.dni]]
                ], {
                    fields: ['id', 'name', 'email', 'phone', 'vat']
                });

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
                token.odooPartnerId = (user as unknown as ExtendedUser).odooPartnerId;
                token.dni = (user as unknown as ExtendedUser).dni;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as unknown as ExtendedUser).odooPartnerId = token.odooPartnerId as number;
                (session.user as unknown as ExtendedUser).dni = token.dni as string;
            }
            return session;
        }
    },

    pages: {
        signIn: '/portal/login',
        error: '/portal/login'
    },

    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60 // 30 días
    },

    secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

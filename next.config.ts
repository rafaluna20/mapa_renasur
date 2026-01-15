import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Mantenemos tu configuración actual de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // 2. Agregamos las cabeceras de seguridad para permitir el iframe en Odoo
  async headers() {
    return [
      {
        // Aplica estas reglas a TODAS las rutas de tu app
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // Opcional: útil si haces fetch desde el cliente JS
          },
          {
            // ESTA ES LA CLAVE: frame-ancestors
            // Define quién tiene permiso de meter tu web en un iframe.
            // 'self': tu propia web.
            // http://localhost:8069: para cuando pruebas Odoo en tu PC.
            // https://tu-instancia-odoo.com: CAMBIA ESTO por la URL real de tu Odoo.
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:8069 http://localhost:8070 https://tu-dominio-odoo.com;",
          },
          {
             // Header legacy para navegadores antiguos/compatibilidad
             key: "X-Frame-Options",
             value: "ALLOWALL",
          }
        ],
      },
    ];
  },
};

export default nextConfig;

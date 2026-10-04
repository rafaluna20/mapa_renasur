import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      // /api/public/lead (formulario de contactos de /venta) se llama SOLO desde la propia página (mismo
      // origen), así que NO lleva "Access-Control-Allow-Origin: *": sin esa cabecera, un sitio ajeno no puede
      // enviar contactos desde el navegador de otra persona. Las demás rutas conservan exactamente las
      // cabeceras de siempre (el mapa de staff se muestra incrustado en Odoo y puede depender del "*").
      {
        source: "/api/public/lead",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:8069 https://bot-odoo.2fsywk.easypanel.host;",
          },
          {
             key: "X-Frame-Options",
             value: "ALLOWALL",
          }
        ],
      },
      {
        source: "/((?!api/public/lead$).*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:8069 https://bot-odoo.2fsywk.easypanel.host;",
          },
          {
             key: "X-Frame-Options",
             value: "ALLOWALL",
          }
        ],
      },
    ];
  },
};

export default nextConfig;
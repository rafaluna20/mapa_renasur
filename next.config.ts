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
      {
        source: "/:path*",
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
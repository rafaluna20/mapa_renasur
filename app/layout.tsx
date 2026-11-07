import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { MarcaProvider } from "@/app/context/MarcaContext";
import { obtenerMarcas } from "@/app/lib/marcaServidor";
import ServiceWorkerRegistration from "@/app/components/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// La marca es el nombre del proyecto (decisión del usuario, 2026-11-06): el título sale del proyecto PRINCIPAL de Odoo
// (app/lib/marca.ts). Si Odoo no responde, el de siempre. El manifest de la PWA sigue estático (ver LEEME de P5).
export async function generateMetadata(): Promise<Metadata> {
  const { principal } = await obtenerMarcas();
  return {
    title: principal.nombre,
    description: `Sistema GIS de gestión de lotes del proyecto ${principal.nombre}`,
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Renasur",
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: {
      type: "website",
      title: principal.nombre,
      description: "Sistema GIS de gestión de lotes",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const marcas = await obtenerMarcas();
  return (
    <html lang="es">
      <head>
        {/* PWA Essential Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Renasur" />
        <meta name="application-name" content="Renasur" />
        <meta name="msapplication-TileColor" content="#1e293b" />
        <meta name="theme-color" content="#1e293b" />

        {/* Apple Touch Icons (iOS) */}
        <link rel="apple-touch-icon" sizes="72x72" href="/icons/icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="96x96" href="/icons/icon-96x96.png" />
        <link rel="apple-touch-icon" sizes="128x128" href="/icons/icon-128x128.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="384x384" href="/icons/icon-384x384.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="shortcut icon" href="/icons/icon-192x192.png" />

        {/* Aplica el tema oscuro ANTES del primer paint (evita el parpadeo
            claro->oscuro al cargar). Solo respeta una elección explícita
            guardada en localStorage — nunca sigue prefers-color-scheme del
            sistema operativo automáticamente, a propósito: eso fue lo que
            causó el bug del texto invisible en el chat (un componente
            heredaba el color oscuro del sistema sin que nadie lo hubiera
            revisado para ese caso). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <MarcaProvider marcas={marcas}>
            <ServiceWorkerRegistration />
            {children}
          </MarcaProvider>
        </Providers>
      </body>
    </html>
  );
}

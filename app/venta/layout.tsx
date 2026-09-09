import type { Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './venta.css';

// Tipografía propia de /venta (dirección "moderna" aprobada por el cliente
// a partir de una referencia visual — template de portfolio "Helen":
// navy/negro + naranja, grotesca bold) — deliberadamente distinta del resto
// de la app (Geist), así que se carga acá y no en el layout raíz.
const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-venta',
});

// El layout raíz (app/layout.tsx, compartido con el mapa de staff) deshabilita
// el pinch-zoom (maximumScale:1, userScalable:false) — tiene sentido para una
// PWA interna tipo app, pero es un anti-patrón de accesibilidad (WCAG 1.4.4)
// en una landing pública de ventas. Sin este export, /venta heredaría esa
// restricción sin que nadie la haya decidido a propósito para este caso de
// uso — acá se sobreescribe solo para las rutas bajo /venta.
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

export default function VentaLayout({ children }: { children: React.ReactNode }) {
    return <div className={plusJakartaSans.variable}>{children}</div>;
}

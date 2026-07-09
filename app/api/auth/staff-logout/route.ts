import { NextResponse } from 'next/server';
import { STAFF_COOKIE_NAME, getStaffCookieOptions } from '@/app/lib/staffAuth';

export async function POST() {
    const res = NextResponse.json({ success: true });
    // Mismas opciones que al crearla (getStaffCookieOptions) — antes estaban
    // duplicadas a mano acá y quedaron desalineadas (sameSite) al arreglar
    // el login dentro del iframe de Odoo.
    res.cookies.set(STAFF_COOKIE_NAME, '', { ...getStaffCookieOptions(), maxAge: 0 });
    return res;
}

import { NextResponse } from 'next/server';
import { STAFF_COOKIE_NAME } from '@/app/lib/staffAuth';

export async function POST() {
    const res = NextResponse.json({ success: true });
    res.cookies.set(STAFF_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    return res;
}

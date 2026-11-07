import { beforeEach, describe, expect, it, vi } from 'vitest';

// La marca de los correos es el nombre del proyecto (decisión 2026-11-06). El nombre viene de Odoo: se escapa en el HTML.

const mocks = vi.hoisted(() => ({
  enviar: vi.fn(),
  marcas: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.enviar };
  },
}));
vi.mock('@/app/lib/marcaServidor', () => ({ obtenerMarcas: mocks.marcas }));

import { MARCA_LEGADA } from '@/app/lib/marca';
import { emailService, escaparHtml } from './emailService';

const marca = (nombre: string) => ({ nombre, slug: nombre.replace(/\W/g, ''), logoUrl: null });

describe('correos con la marca del proyecto', () => {
  beforeEach(() => {
    mocks.enviar.mockReset().mockResolvedValue({ error: null });
    mocks.marcas.mockReset().mockResolvedValue({ principal: marca('Parque Industrial Sur'), porId: {} });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('el código de verificación lleva el nombre del proyecto principal en asunto, remitente y cuerpo', async () => {
    delete process.env.EMAIL_FROM;
    await emailService.sendVerificationCode('cliente@ejemplo.com', '12345678');
    const arg = mocks.enviar.mock.calls[0][0];
    expect(arg.subject).toBe('Tu código de verificación - Parque Industrial Sur');
    expect(arg.from).toContain('Parque Industrial Sur');
    expect(arg.html).toContain('🏠 Parque Industrial Sur');
    expect(JSON.stringify(arg)).not.toContain('Terra Lima');
  });

  it('con una marca explícita usa esa (la del proyecto del cliente) y no consulta a Odoo', async () => {
    await emailService.sendVerificationCode('c@e.com', '1', marca('Otro Proyecto'));
    expect(mocks.enviar.mock.calls[0][0].subject).toContain('Otro Proyecto');
    expect(mocks.marcas).not.toHaveBeenCalled();
  });

  it('el correo de pago validado también usa la marca', async () => {
    await emailService.sendPaymentValidationEmail({
      email: 'c@e.com', userName: 'Ana', amount: 1000, invoiceName: 'F001-1', paymentReference: 'R1', marca: marca('Parque Industrial Sur'),
    });
    const arg = mocks.enviar.mock.calls[0][0];
    expect(arg.subject).toBe('✅ Tu pago ha sido validado exitosamente - Parque Industrial Sur');
    expect(arg.html).toContain('Parque Industrial Sur');
  });

  it('un nombre de proyecto con HTML NO se inyecta en el correo (viene de Odoo)', async () => {
    await emailService.sendVerificationCode('c@e.com', '1', marca('<script>alert(1)</script> & "Cía"'));
    const html = mocks.enviar.mock.calls[0][0].html as string;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('el remitente no puede romperse con < > o comillas del nombre', async () => {
    delete process.env.EMAIL_FROM;
    await emailService.sendVerificationCode('c@e.com', '1', marca('Mal <x@y.com> "nombre"'));
    expect(mocks.enviar.mock.calls[0][0].from).toBe('Mal x@y.com nombre <onboarding@resend.dev>');
  });

  it('si Odoo falla, el correo sale igual con la marca de siempre', async () => {
    mocks.marcas.mockRejectedValue(new Error('Odoo caído'));
    await emailService.sendVerificationCode('c@e.com', '1');
    expect(mocks.enviar.mock.calls[0][0].subject).toContain(MARCA_LEGADA.nombre);
  });

  it('escaparHtml', () => {
    expect(escaparHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

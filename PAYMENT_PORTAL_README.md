# Portal de Pagos Terra Lima - Guía de Configuración

Sistema completo de gestión de pagos para lotes inmobiliarios con Odoo, Niubiz y autenticación SMS.

---

## 🚀 Inicio Rápido

### 1. Variables de Entorno Mínimas

Copia `.env.example` a `.env.local` y configura los valores mínimos:

```env
# Odoo (REQUERIDO)
ODOO_URL=https://tu-odoo.com
ODOO_DB=nombre_base_datos
ODOO_USER_ID=2
ODOO_PASSWORD=tu_password

# NextAuth (REQUERIDO)
NEXTAUTH_SECRET=genera_un_secret_aleatorio_aqui
NEXTAUTH_URL=http://localhost:3000

# Niubiz (OPCIONAL para pruebas)
NIUBIZ_ENV=sandbox
NIUBIZ_MERCHANT_ID=demo_merchant
NIUBIZ_ACCESS_KEY=demo_key

# Vercel Blob (OPCIONAL para pruebas)
BLOB_READ_WRITE_TOKEN=demo_token
```

### 2. Instalar Dependencias

Si aún no las tienes:
```bash
npm install next-auth @vercel/blob
```

### 3. Acceder al Portal

**Portal de Pagos:**
```
http://localhost:3000/portal/pagos
```

**Historial:**
```
http://localhost:3000/portal/historial
```

---

## 🔐 Autenticación (Modo Demo)

### Crear Partner de Prueba en Odoo

Ejecuta en la consola de Odoo:

```python
# Crear partner de prueba
partner = env['res.partner'].create({
    'name': 'Cliente Demo',
    'vat': '12345678',  # DNI de 8 dígitos
    'phone': '+51999999999',
    'email': 'demo@test.com'
})
```

### Proceso de Login

1. **Ir a:** `http://localhost:3000/login`
2. **Ingresar DNI:** `12345678`
3. **Ver código en consola del servidor:**
   - Busca en la terminal donde corre `npm run dev`
   - Verás: `[TWILIO DEMO] SMS to +51999999999: Tu código Terra Lima es 123456`
4. **Ingresar código:** `123456`
5. **¡Listo!** Serás redirigido al portal

---

## 🧪 Testing de Funcionalidades

### Consultar Cuotas Pendientes

Para que aparezcan facturas en el portal:

```python
# En Odoo, crear una factura de prueba
invoice = env['account.move'].create({
    'partner_id': partner.id,  # Partner creado arriba
    'move_type': 'out_invoice',
    'payment_reference': 'E01MZAQ101P-C001-20260228',
    'invoice_date_due': '2026-02-28',
    'invoice_line_ids': [(0, 0, {
        'name': 'Cuota 1 - Lote E01MZAQ101P',
        'quantity': 1,
        'price_unit': 500.00
    })]
})

# Publicar factura
invoice.action_post()
```

### Probar Modal de Pago Niubiz

1. En el portal, da clic en **"Pagar con Tarjeta"**
2. Modal se abre con información de la factura
3. Clic en **"Iniciar Pago"** (crea sesión con Niubiz)
4. En demo mode, verás un placeholder del formulario
5. Clic en **"Simular Pago Exitoso"** para completar

### Probar Upload de Comprobante

1. En el portal, da clic en **"Subir Comprobante"**
2. Completa el formulario:
   - **Banco:** BCP, Interbank, etc.
   - **Fecha:** Fecha de la transferencia
   - **Nro. Operación:** Cualquier número
   - **Monto:** El monto de la factura
3. Selecciona un archivo (imagen o PDF, máx 5MB)
4. Clic en **"Enviar Comprobante"**
5. Se crea automáticamente una **tarea en Odoo** para validación

---

## 📊 Verificar en Odoo

### Ver Tareas de Validación Creadas

```python
# Buscar tareas creadas por el portal
tasks = env['project.task'].search([
    ('name', 'ilike', 'Validar Pago')
], order='create_date desc')

for task in tasks:
    print(f"Tarea: {task.name}")
    print(f"Cliente: {task.partner_id.name}")
    print(f"Descripción: {task.description}")
    print("---")
```

### Ver Attachments Subidos

```python
# Buscar archivos adjuntos
attachments = env['ir.attachment'].search([
    ('res_model', '=', 'account.move')
], order='create_date desc', limit=5)

for att in attachments:
    print(f"Archivo: {att.name}")
    print(f"Factura: {att.res_id}")
    print("---")
```

---

## ⚙️ Configuración Avanzada

### Para Producción con Niubiz Real

1. **Obtener credenciales:**
   - Registro en [Niubiz](https://www.niubiz.com.pe/)
   - Solicitar Merchant ID y Access Key

2. **Actualizar .env:**
```env
NIUBIZ_ENV=production
NIUBIZ_MERCHANT_ID=tu_merchant_id_real
NIUBIZ_ACCESS_KEY=tu_access_key_real
```

3. **Configurar IDs en Odoo:**
```env
ODOO_NIUBIZ_JOURNAL_ID=5  # ID del diario bancario para Niubiz
ODOO_CARD_PAYMENT_METHOD_ID=3  # ID del método de pago con tarjeta
ODOO_COBRANZAS_PROJECT_ID=2  # ID del proyecto de cobranzas
```

### Para SMS Real con Twilio

1. **Crear cuenta en [Twilio](https://www.twilio.com/)**
2. **Obtener credenciales:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_PHONE_NUMBER=+51999999999
```

3. **Migrar de demo a PostgreSQL:**
   - La versión demo usa almacenamiento en memoria
   - Para producción, implementar tabla en PostgreSQL

---

## 🐛 Troubleshooting

### Error: "DNI no registrado"
- Verifica que el partner en Odoo tenga el campo `vat` lleno
- El DNI debe tener exactamente 8 dígitos

### Error: "No hay teléfono registrado"
- Asegúrate de que el partner tenga el campo `phone` lleno
- Formato: `+51999999999`

### No aparecen facturas en el portal
- Verifica que la factura esté en estado `posted`
- El `payment_state` debe ser diferente de `paid`
- El `partner_id` debe coincidir con el usuario autenticado

### Código SMS no aparece en consola
- Verifica que el servidor esté corriendo (`npm run dev`)
- Busca en toda la salida de la terminal
- El log dice: `[TWILIO DEMO] SMS to...`

---

## 📁 Estructura de Archivos

```
app/
├── services/
│   ├── paymentService.ts      # Consultas a Odoo
│   ├── twilioService.ts       # SMS (demo)
│   └── niubizService.ts       # Pasarela de pago
├── api/
│   ├── auth/[...nextauth]/    # Autenticación
│   ├── invoices/              # Consulta facturas
│   ├── payments/niubiz/       # Integración Niubiz
│   └── vouchers/upload/       # Upload comprobantes
├── portal/
│   ├── pagos/                 # Dashboard principal
│   └── historial/             # Historial de pagos
└── components/Payments/
    ├── NiubizPaymentModal.tsx
    └── VoucherUploadModal.tsx
```

---

## 🎯 Próximos Pasos

1. **Probar flujo completo** con partner de prueba
2. **Configurar credenciales reales** de Niubiz
3. **Implementar script de conciliación** bancaria
4. **Configurar n8n** para notificaciones WhatsApp/Telegram

---

## 📞 Soporte

Para dudas o problemas:
1. Revisar logs del servidor (`npm run dev`)
2. Verificar configuración en `.env.local`
3. Revisar consola de Odoo para errores

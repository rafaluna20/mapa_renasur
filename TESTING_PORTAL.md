# Testing Payment Portal - Quick Guide

## 🔍 **Verificar Partner en Odoo**

Antes de hacer login, verifica que el partner exista:

```python
# En consola de Odoo
partner = env['res.partner'].search([('vat', '=', '87654321')])
if partner:
    print(f"✅ Partner encontrado: {partner.name}")
    print(f"   DNI: {partner.vat}")
    print(f"   Teléfono: {partner.phone}")
    print(f"   Email: {partner.email}")
else:
    print("❌ Partner NO encontrado - Crear con:")
    print("""
    partner = env['res.partner'].create({
        'name': 'Cliente Demo Portal',
        'vat': '87654321',
        'phone': '+51987654321',
        'email': 'demo@test.com'
    })
    """)
```

## 📋 **Pasos para Login**

### **1. Verificar Variables de Entorno**

Asegúrate de tener en `.env.local`:

```env
# Odoo (CRÍTICO)
ODOO_URL=https://tu-odoo.com
ODOO_DB=tu_base_datos
ODOO_USERNAME=admin
ODOO_PASSWORD=tu_password

# NextAuth (CRÍTICO)
    NEXTAUTH_SECRET=cualquier_string_aleatorio_largo
    NEXTAUTH_URL=http://localhost:3000
```

### **2. Reiniciar Servidor**

```bash
# Detener el servidor actual (Ctrl+C)
# Reiniciar
npm run dev
```

### **3. Proceso de Login**

1. **Ir a:** `http://localhost:3000/portal/login`
2. **Ingresar DNI:** `87654321`
3. **Click:** "Enviar Código SMS"
4. **Ver logs del servidor** en la terminal:
   - Buscar: `[TWILIO DEMO] SMS to...`
   - Copiar el código de 6 dígitos
5. **Ingresar código** en la página
6. **Success!** → Redirige a `/portal/pagos`

## 🐛 **Troubleshooting**

### Error: "CredentialsSignin"

**Causa:** No se puede autenticar con Odoo

**Solución:**
1. Verificar que el partner exista con el DNI exacto
2. Revisar variables de entorno `ODOO_*`
3. Verificar logs del servidor para ver el error específico

### Error: "DNI no registrado"

**Solución:**
```python
# Crear partner en Odoo
env['res.partner'].create({
    'name': 'Cliente Demo',
    'vat': '87654321',
    'phone': '+51987654321',
    'email': 'demo@test.com'
})
```

### No aparece código en consola

**Solución:**
1. Asegúrate que el servidor esté corriendo
2. Revisa TODA la salida de `npm run dev`
3. El código aparece como: `[TWILIO DEMO] SMS to +51987654321: Tu código Terra Lima es 123456`

### Error 401 o 500

**Solución:**
1. Verificar credenciales de Odoo en `.env.local`
2. Probar conexión a Odoo manualmente
3. Verificar que el usuario tenga permisos

## 🎯 **Testing Rápido**

```bash
# 1. Ver variables de entorno
cat .env.local | grep ODOO

# 2. Reiniciar servidor
npm run dev

# 3. Verificar en browser
# http://localhost:3000/portal/login
```

## 📞 **Contacta si:**

- No aparece el formulario de login
- Errores persisten después de verificar partner
- Código SMS no aparece en logs
- Cualquier otro error no documentado aquí

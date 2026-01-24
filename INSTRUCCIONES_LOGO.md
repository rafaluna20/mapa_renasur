# 📸 Instrucciones para Guardar el Logo TERRA LIMA

## 🎯 Acción Requerida

Debes guardar la imagen del logo de TERRA LIMA que proporcionaste en la ubicación correcta del proyecto.

---

## 📁 Ubicación del Logo

**Ruta:** `public/terra-lima-logo.png`

El logo debe guardarse en la carpeta `public` con el nombre exacto: `terra-lima-logo.png`

---

## 🔧 Pasos para Guardar el Logo

### Opción 1: Guardar Directamente (Recomendado)
1. Descarga o guarda la imagen del logo TERRA LIMA
2. Renómbrala a: `terra-lima-logo.png`
3. Colócala en la carpeta: `c:/Users/henry/OneDrive/Escritorio/terra lima documentos/anti_app/mapa_renasur/public/`
4. Reemplaza el archivo placeholder que está actualmente ahí

### Opción 2: Desde el Proyecto
```bash
# Si tienes el logo en otra ubicación, cópialo:
copy "ruta/al/logo.png" "public/terra-lima-logo.png"
```

---

## ✅ Verificación

Una vez guardado el logo, verifica que:
- ✅ El archivo existe en: `public/terra-lima-logo.png`
- ✅ Es una imagen PNG válida
- ✅ Tiene dimensiones razonables (recomendado: 1200x600 px o similar)
- ✅ Fondo transparente o blanco

---

## 🧪 Prueba del Logo en el PDF

Después de guardar el logo:

1. Abre: `http://localhost:3000/quote/7573`
2. Haz clic en "Guardar Cotización"
3. El PDF descargado debe mostrar el logo TERRA LIMA en la esquina superior izquierda

---

## 🔍 Características del Logo en el PDF

- **Posición:** Esquina superior izquierda
- **Dimensiones en PDF:** 45mm x 18mm
- **Formato:** PNG con transparencia
- **Alineación:** Junto al texto "RENACIMIENTO DEL SUR SAC"

---

## ⚠️ Solución de Problemas

### Si el logo no aparece:
1. Verifica que el archivo se llama exactamente: `terra-lima-logo.png` (minúsculas, sin espacios)
2. Confirma que está en la carpeta `public/`
3. Recarga la página del navegador (Ctrl+F5)
4. Intenta generar el PDF nuevamente

### Si aparece texto en lugar del logo:
- El sistema usa un fallback de texto "TERRA LIMA" si no puede cargar la imagen
- Esto es normal si el archivo no existe o tiene un nombre incorrecto

---

## 📝 Nota Técnica

El logo se carga dinámicamente desde `/terra-lima-logo.png` (ruta pública de Next.js) y se convierte a base64 automáticamente antes de incluirlo en el PDF.

**Código relevante:** [`app/utils/quotePdfExporter.ts`](app/utils/quotePdfExporter.ts) línea 28-38

---

## 🎨 Recomendaciones de la Imagen

Para mejores resultados:
- **Formato:** PNG con transparencia
- **Dimensiones:** Mínimo 600x240 px
- **Proporción:** Aproximadamente 2.5:1 (ancho:alto)
- **Colores:** Verde corporativo (#2A8560)
- **Calidad:** Alta resolución para impresión

---

## ✅ Estado Actual

- ✅ Código actualizado para cargar logo dinámicamente
- ✅ Textos del PDF actualizados
- ⏳ **PENDIENTE:** Guardar imagen del logo en `public/terra-lima-logo.png`

Una vez guardado el logo, el sistema estará 100% completo.

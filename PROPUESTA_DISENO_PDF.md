# 🎨 Propuesta de Diseño Profesional - PDF TERRA LIMA

## 📊 Análisis del Logo TERRA LIMA

El logo presenta:
- **Verde corporativo principal** - Fuerte, confiable, relacionado con tierra/naturaleza
- **Diseño geométrico limpio** - Profesional y moderno
- **Ícono de casa** - Representa habilitación urbana y hogar
- **Tipografía bold** - Transmite solidez y seguridad

---

## 🎨 Paleta de Colores Propuesta

### Colores Principales

#### Verde TERRA LIMA (Corporativo)
```
Principal:     #2A8560  RGB(42, 133, 96)   - Logo, títulos principales
Oscuro:        #1F6347  RGB(31, 99, 71)    - Encabezados, énfasis
Claro:         #3FA575  RGB(63, 165, 117)  - Acentos positivos
Muy Claro:     #E8F5F0  RGB(232, 245, 240) - Fondos suaves
```

#### Grises Corporativos
```
Carbón:        #2C3E50  RGB(44, 62, 80)    - Texto principal
Gris Oscuro:   #4A5568  RGB(74, 85, 104)   - Texto secundario
Gris Medio:    #718096  RGB(113, 128, 150) - Texto terciario
Gris Claro:    #E2E8F0  RGB(226, 232, 240) - Bordes, líneas
Gris Muy Claro:#F7FAFC  RGB(247, 250, 252) - Fondos alternos
```

#### Acentos Complementarios
```
Dorado Tierra: #D4AF37  RGB(212, 175, 55)  - Valores importantes
Azul Confianza:#1E40AF  RGB(30, 64, 175)   - Información, links
Rojo Alerta:   #DC2626  RGB(220, 38, 38)   - Descuentos, alertas
```

---

## 📐 Diseño del PDF - Estructura

### Página 1: Portada y Resumen

```
┌────────────────────────────────────────────────────────┐
│ ┌────┐                                    ┌─────────┐  │
│ │LOGO│  RENACIMIENTO DEL SUR SAC          │#2A8560 │  │
│ │TL  │  RUC: XXXX | Tel: XXXX            │ BANDA  │  │
│ └────┘                                    │LATERAL │  │
├────────────────────────────────────────────┴─────────┤
│                                                       │
│          [#2A8560] COTIZACIÓN DEL LOTE               │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ DETALLES DEL PROYECTO  [#E8F5F0 fondo]         │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ Proyecto:  HABILITACIÓN TERRA-LIMA              │  │
│ │ Lote:      etapa 1 mz D lote 129                │  │
│ │ Área:      160 m²                               │  │
│ │ Cliente:   [Nombre del cliente]                 │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ RESUMEN FINANCIERO  [#2C3E50 texto]            │  │
│ ├─────────────────────────────────────────────────┤  │
│ │                                                 │  │
│ │  Precio de Lista        S/ 120,000.00          │  │
│ │  Descuento (15.12%)    -S/  18,148.15  [#DC26] │  │
│ │  ────────────────────────────────────────────   │  │
│ │  PRECIO FINAL          S/ 101,851.85   [#D4AF] │  │
│ │                                                 │  │
│ │  Pago Inicial          S/  20,000.00           │  │
│ │  SALDO A FINANCIAR     S/  81,851.85   [#2A85] │  │
│ │                                                 │  │
│ │  Cuota Mensual         S/   1,136.83   [#3FA5] │  │
│ │  Plazo                 72 meses                │  │
│ │                                                 │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ [#1E40AF] Ver cronograma completo en página 2 →     │
└───────────────────────────────────────────────────────┘
```

### Página 2+: Cronograma de Pagos

```
┌────────────────────────────────────────────────────────┐
│ CRONOGRAMA DE PAGOS - 72 CUOTAS                       │
│ [#2A8560 barra superior]                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│ ┌────┬─────────────────┬──────────────┬──────────────┐│
│ │ N° │ Fecha Venc.     │ Cuota        │ Saldo        ││
│ ├────┼─────────────────┼──────────────┼──────────────┤│
│ │ 0  │ PAGO INICIAL    │ S/ 20,000.00 │ S/ 81,851.85 ││
│ │    │ [#E8F5F0 fondo] │ [#2A8560]    │              ││
│ ├────┼─────────────────┼──────────────┼──────────────┤│
│ │ 1  │ 24/02/2026      │ S/  1,136.83 │ S/ 80,715.02 ││
│ │ 2  │ 24/03/2026      │ S/  1,136.83 │ S/ 79,578.19 ││
│ │... │ [#F7FAFC alterno]│             │              ││
│ │ 72 │ 24/01/2032      │ S/  1,136.83 │ S/      0.00 ││
│ │    │                 │              │ [#2A8560]    ││
│ └────┴─────────────────┴──────────────┴──────────────┘│
│                                                        │
│ [PIE DE PÁGINA]                                       │
│ Documento informativo sin validez legal              │
│ [#718096 texto]                          Página 2/3   │
└────────────────────────────────────────────────────────┘
```

---

## 🎯 Elementos de Diseño

### 1. Encabezado Corporativo
```css
- Logo: 50mm x 20mm (esquina superior izquierda)
- Banda lateral verde: 10mm ancho (#2A8560)
- Empresa: #2C3E50, Bold, 11pt
- Información contacto: #718096, Regular, 9pt
```

### 2. Títulos y Secciones
```css
- Título principal: #2A8560, Bold, 18pt
- Subtítulos: #1F6347, Bold, 14pt
- Títulos de tabla: #2C3E50, Bold, 10pt
- Texto descriptivo: #4A5568, Regular, 9pt
```

### 3. Tablas Financieras
```css
- Fondo header: #2A8560
- Texto header: #FFFFFF, Bold, 10pt
- Filas alternas: #F7FAFC / #FFFFFF
- Bordes: #E2E8F0, 0.5pt
- Totales: Fondo #E8F5F0, texto #1F6347, Bold
```

### 4. Valores Numéricos
```css
- Precio lista: #2C3E50, Regular
- Descuentos: #DC2626, Bold (negativo)
- Precio final: #D4AF37, Bold, 12pt (destacado)
- Saldo a financiar: #2A8560, Bold, 12pt
- Cuota mensual: #3FA575, Bold, 14pt (muy destacado)
```

### 5. Elementos Visuales
```css
- Líneas divisorias: #E2E8F0, 1pt
- Cajas de información: Borde #2A8560 2pt, fondo #E8F5F0
- Íconos: #2A8560
- Callouts: Borde izquierdo #D4AF37 4pt
```

---

## 📊 Mockup Visual Completo

### Diseño de Encabezado Premium

```
╔════════════════════════════════════════════════════════╗
║ ┌────────┐                              ║ #2A8560 ║║ ║
║ │ TERRA  │  RENACIMIENTO DEL SUR SAC    ║         ║║ ║
║ │  LIMA  │  RUC: 20XXXXXXXXX            ║         ║║ ║
║ │ [LOGO] │  Tel: (01) 123-4567          ║ BANDA  ║║ ║
║ └────────┘  email@terralima.pe          ║ LATERAL║║ ║
║                                          ║         ║║ ║
║ ════════════════════════════════════════╩═════════╩╝ ║
║  Fecha: 24 de Enero de 2026                          ║
║  Código: TL-2026-0001                     [#718096]  ║
╠══════════════════════════════════════════════════════╣
║                                                       ║
║    ███████████████████████████████████████████        ║
║    ███ COTIZACIÓN DEL LOTE            ███   [#2A85]  ║
║    ███████████████████████████████████████████        ║
║                                                       ║
╠══════════════════════════════════════════════════════╣
║                                                       ║
║  ┌──────────────────────────────────────────────┐   ║
║  │ 📋 INFORMACIÓN DEL PROYECTO                  │   ║
║  │ [Fondo #E8F5F0]                              │   ║
║  ├──────────────────────────────────────────────┤   ║
║  │ Proyecto:    HABILITACIÓN TERRA-LIMA         │   ║
║  │ Ubicación:   Lima, Perú                      │   ║
║  │ Manzana:     D          Etapa:        1      │   ║
║  │ Lote:        129        Área:    160.00 m²   │   ║
║  │ Cliente:     [Nombre del Cliente]            │   ║
║  │ Asesor:      [Nombre del Vendedor]           │   ║
║  └──────────────────────────────────────────────┘   ║
║                                                       ║
║  ┌──────────────────────────────────────────────┐   ║
║  │ 💰 DETALLE FINANCIERO                        │   ║
║  ├──────────────────────────────────────────────┤   ║
║  │                                              │   ║
║  │  Precio de Lista            S/ 120,000.00    │   ║
║  │  Descuento Aplicado (15.12%)  -S/ 18,148.15  │   ║
║  │                              [Rojo #DC2626]  │   ║
║  │  ───────────────────────────────────────────  │   ║
║  │  ⭐ VALOR TOTAL DE VENTA   S/ 101,851.85 ⭐  │   ║
║  │                          [Dorado #D4AF37]    │   ║
║  │                                              │   ║
║  │  Pago Inicial               S/  20,000.00    │   ║
║  │  ───────────────────────────────────────────  │   ║
║  │  🏠 SALDO A FINANCIAR      S/  81,851.85 🏠  │   ║
║  │                          [Verde #2A8560]     │   ║
║  │                                              │   ║
║  │  ┌────────────────────────────────────────┐ │   ║
║  │  │  📅 CUOTA MENSUAL:  S/ 1,136.83        │ │   ║
║  │  │     [Grande, Bold, Verde claro]        │ │   ║
║  │  │     Plazo: 72 meses (6 años)           │ │   ║
║  │  └────────────────────────────────────────┘ │   ║
║  │                                              │   ║
║  └──────────────────────────────────────────────┘   ║
║                                                       ║
║  💡 Beneficios de esta oferta:                       ║
║  ✓ Precio preferencial con descuento                 ║
║  ✓ Financiamiento directo sin intermediarios         ║
║  ✓ Cuotas fijas durante todo el periodo              ║
║  ✓ Ubicación privilegiada en Terra Lima              ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

---

## 🎨 Implementación de Colores

### Código de Colores RGB para jsPDF

```typescript
const COLORS = {
    // Verde TERRA LIMA
    primary: {
        main: [42, 133, 96],      // #2A8560
        dark: [31, 99, 71],       // #1F6347
        light: [63, 165, 117],    // #3FA575
        veryLight: [232, 245, 240] // #E8F5F0
    },
    
    // Grises Corporativos
    gray: {
        charcoal: [44, 62, 80],   // #2C3E50
        dark: [74, 85, 104],      // #4A5568
        medium: [113, 128, 150],  // #718096
        light: [226, 232, 240],   // #E2E8F0
        veryLight: [247, 250, 252] // #F7FAFC
    },
    
    // Acentos
    accent: {
        gold: [212, 175, 55],     // #D4AF37
        blue: [30, 64, 175],      // #1E40AF
        red: [220, 38, 38]        // #DC2626
    },
    
    // Utilidades
    white: [255, 255, 255],
    black: [0, 0, 0]
};
```

---

## ✨ Características del Diseño

### Principios de Diseño Aplicados

1. **Jerarquía Visual Clara**
   - Títulos grandes en verde corporativo
   - Información financiera destacada
   - Flujo de lectura natural de arriba a abajo

2. **Contraste y Legibilidad**
   - Alto contraste entre texto y fondo
   - Tipografía Helvetica (estándar PDF)
   - Tamaños de fuente apropiados (9-18pt)

3. **Profesionalismo**
   - Espaciado consistente (8mm entre secciones)
   - Alineación precisa
   - Uso equilibrado del espacio en blanco

4. **Identidad Corporativa**
   - Logo prominente
   - Verde TERRA LIMA como color principal
   - Diseño coherente con la marca

5. **Información Accesible**
   - Números grandes y claros
   - Colores semánticos (rojo=descuento, verde=saldo)
   - Jerarquía de información lógica

---

## 📋 Elementos Adicionales Propuestos

### 1. Códigos QR
- Posición: Esquina inferior derecha
- Tamaño: 20mm x 20mm
- Contenido: Link a página del lote

### 2. Watermark Sutil
- Texto: "TERRA LIMA"
- Opacidad: 5%
- Color: #2A8560
- Posición: Centro diagonal

### 3. Ícono de Verificación
- Para cotización confirmada
- Color: #2A8560
- Sello corporativo

---

## 🚀 Ventajas del Diseño Propuesto

✅ **Profesional**: Diseño corporativo de nivel internacional  
✅ **Legible**: Excelente contraste y jerarquía  
✅ **Memorable**: Verde TERRA LIMA como identidad fuerte  
✅ **Confiable**: Colores transmiten seguridad y seriedad  
✅ **Moderno**: Diseño limpio y actualizado  
✅ **Escalable**: Funciona en impresión y digital  

---

## 📊 Comparativa

| Aspecto | Diseño Actual | Diseño Propuesto |
|---------|---------------|------------------|
| **Colores** | Genéricos (azul/gris) | Verde corporativo TERRA LIMA |
| **Logo** | Texto simple | Logo real integrado |
| **Jerarquía** | Básica | Profesional con énfasis visual |
| **Tablas** | Estándar | Estilizadas con acentos |
| **Información** | Funcional | Jerarquizada y destacada |
| **Impacto** | Neutro | Memorable y profesional |

---

¿Deseas que implemente este diseño en el código del PDF?

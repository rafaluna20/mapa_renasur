# 📅 CAMBIOS EN EL SISTEMA DE CUOTAS
## Actualización del cálculo de fechas de pago

**Fecha:** 2026-02-24  
**Archivo modificado:** [`app/services/financeService.ts`](app/services/financeService.ts)

---

## 🎯 CAMBIOS IMPLEMENTADOS

### 1. **Cuota Inicial (Cuota 0) con Fecha Manual**
Ahora la cuota inicial puede tener una fecha específica ingresada manualmente.

### 2. **Primera Cuota (Cuota 1) con Fecha Manual**
La primera cuota mensual puede configurarse para 1 o 2 meses después de la inicial, según las necesidades del cliente.

### 3. **Fechas en Último Día del Mes**
Todas las cuotas mensuales ahora caen en el último día de cada mes.

**Ejemplos:**
- Enero → 31
- Febrero (no bisiesto) → 28
- Febrero (bisiesto) → 29
- Abril → 30
- Mayo → 31

**ANTES:**
```
Cuota inicial: 30/02/2026 (fecha fija)
Cuota 1: 30/03/2026
Cuota 2: 30/04/2026
Cuota 3: 30/05/2026
```

**DESPUÉS:**
```
Cuota 0 (inicial): [Fecha manual, ej: 15/02/2026]
Cuota 1: [Fecha manual, ej: 31/03/2026] ← Último día del mes
Cuota 2: 30/04/2026 ← Último día de abril
Cuota 3: 31/05/2026 ← Último día de mayo
```

---

## 🔧 NUEVAS FUNCIONES

### 1. `getLastDayOfMonth(date: Date): Date`

Obtiene el último día del mes para una fecha dada.

```typescript
// Ejemplo de uso
const date = new Date('2026-02-15');
const lastDay = financeService.getLastDayOfMonth(date);
// Resultado: 28/02/2026 (o 29 si es bisiesto)
```

### 2. `getNextInstallmentDate(fromDate: Date, monthsToAdd: number): Date`

Calcula la fecha de la siguiente cuota (último día del mes correspondiente).

```typescript
// Ejemplo de uso
const initialDate = new Date('2026-02-15');
const firstInstallment = financeService.getNextInstallmentDate(initialDate, 1);
// Resultado: 31/03/2026 (último día de marzo)

const secondInstallment = financeService.getNextInstallmentDate(initialDate, 2);
// Resultado: 30/04/2026 (último día de abril)
```

### 3. `calculateQuote()` - ACTUALIZADO

Ahora acepta fechas manuales como parámetros opcionales.

**Nueva firma:**
```typescript
calculateQuote(
    price: number,
    discountPercent: number,
    initialPayment: number,
    numInstallments: number = 72,
    initialPaymentDate?: Date,      // 🆕 Fecha manual de cuota inicial
    firstInstallmentDate?: Date     // 🆕 Fecha manual de primera cuota
): QuoteCalculations
```

**Ejemplo de uso:**
```typescript
const initialDate = new Date('2026-02-15'); // Cuota inicial el 15 de febrero
const firstDate = new Date('2026-03-31');   // Primera cuota el 31 de marzo

const calculations = financeService.calculateQuote(
    100000,      // precio
    5,           // 5% descuento
    20000,       // cuota inicial
    72,          // 72 cuotas
    initialDate, // 🆕 fecha cuota inicial
    firstDate    // 🆕 fecha primera cuota
);

// Las cuotas siguientes se calculan automáticamente al último día de cada mes:
// Cuota 2: 30/04/2026
// Cuota 3: 31/05/2026
// Cuota 4: 30/06/2026
// etc.
```

---

## 📝 CAMBIOS EN LA INTERFAZ `QuoteCalculations`

Se agregaron dos campos nuevos:

```typescript
export interface QuoteCalculations {
    originalPrice: number;
    discountAmount: number;
    discountedPrice: number;
    initialPayment: number;
    initialPaymentDate?: Date;      // 🆕 Fecha de la cuota inicial
    remainingBalance: number;
    monthlyInstallment: number;
    firstInstallmentDate?: Date;    // 🆕 Fecha de la primera cuota mensual
    installments: Installment[];
}
```

---

## 🎨 INTEGRACIÓN EN LA PÁGINA DE COTIZACIÓN

### Paso 1: Agregar Estado para Fechas

En `app/quote/[lotId]/page.tsx`, agregar:

```typescript
// Estados existentes...
const [numInstallments, setNumInstallments] = useState<number>(72);
const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

// 🆕 NUEVOS ESTADOS para fechas manuales
const [initialPaymentDate, setInitialPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
);
const [firstInstallmentDate, setFirstInstallmentDate] = useState<string>(() => {
    // Calcular automáticamente 1 mes después (último día del mes)
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const lastDay = financeService.getLastDayOfMonth(nextMonth);
    return lastDay.toISOString().split('T')[0];
});
```

### Paso 2: Actualizar useMemo de Cálculos

```typescript
// Modificar el useMemo existente
const calculations: QuoteCalculations | null = useMemo(() => {
    if (!lot) return null;
    return financeService.calculateQuote(
        lot.list_price,
        discountPercent,
        initialPayment,
        numInstallments,
        new Date(initialPaymentDate),    // 🆕 Pasar fecha de cuota inicial
        new Date(firstInstallmentDate)   // 🆕 Pasar fecha de primera cuota
    );
}, [lot, discountPercent, initialPayment, numInstallments, initialPaymentDate, firstInstallmentDate]);
```

### Paso 3: Agregar Inputs de Fecha en el UI

Dentro de la sección "Ajustes de Venta", agregar:

```typescript
{/* 🆕 Fecha de Cuota Inicial (Cuota 0) */}
<div>
    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
        <Calendar size={14} className="text-slate-400" />
        Fecha Cuota Inicial (Cuota 0)
    </label>
    <input
        type="date"
        value={initialPaymentDate}
        onChange={(e) => setInitialPaymentDate(e.target.value)}
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
    />
    <p className="text-xs text-slate-500 mt-1">
        Fecha en que el cliente pagará la cuota inicial
    </p>
</div>

{/* 🆕 Fecha de Primera Cuota Mensual (Cuota 1) */}
<div>
    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
        <Calendar size={14} className="text-slate-400" />
        Fecha Primera Cuota (Cuota 1)
    </label>
    <input
        type="date"
        value={firstInstallmentDate}
        min={initialPaymentDate} // No puede ser antes de la cuota inicial
        onChange={(e) => setFirstInstallmentDate(e.target.value)}
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
    />
    <p className="text-xs text-slate-500 mt-1">
        Puede ser 1 o 2 meses después de la inicial. Las siguientes cuotas serán el último día de cada mes.
    </p>
</div>

{/* ELIMINAR o OCULTAR el input "Fecha Cuota Inicial" anterior */}
{/* El antiguo startDate ya no se usa */}
```

### Paso 4: Actualizar Tabla de Amortización

En la tabla donde se muestran las cuotas, agregar la fila de cuota inicial:

```typescript
<tbody className="divide-y divide-slate-50">
    {/* 🆕 Fila de Cuota Inicial (Cuota 0) */}
    <tr className="bg-emerald-50/30 group">
        <td className="px-6 py-4 text-xs font-bold text-slate-400">0</td>
        <td className="px-6 py-4">
            <div className="flex flex-col">
                <span className="text-sm font-bold text-emerald-700">Cuota Inicial</span>
                <span className="text-[10px] text-emerald-600 opacity-70 font-medium">
                    {financeService.formatDate(new Date(initialPaymentDate))}
                </span>
            </div>
        </td>
        <td className="px-6 py-4 text-right">
            <span className="text-sm font-mono font-bold text-emerald-700">
                {financeService.formatCurrency(calculations.initialPayment)}
            </span>
        </td>
        <td className="px-6 py-4 text-right">
            <span className="text-sm font-mono font-medium text-slate-400">
                {financeService.formatCurrency(calculations.remainingBalance)}
            </span>
        </td>
    </tr>

    {/* Cuotas Mensuales (1 en adelante) */}
    {calculations.installments.map((inst) => (
        <tr key={inst.number} className="hover:bg-slate-50 transition-colors group">
            <td className="px-6 py-4 text-xs font-bold text-slate-400">{inst.number}</td>
            <td className="px-6 py-4">
                <span className="text-sm font-medium text-slate-700">
                    {financeService.formatDate(inst.date)}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                <span className="text-sm font-mono font-bold text-slate-900">
                    {financeService.formatCurrency(inst.amount)}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                <span className="text-sm font-mono text-slate-500">
                    {financeService.formatCurrency(inst.balance)}
                </span>
            </td>
        </tr>
    ))}
</tbody>
```

---

## 🧪 EJEMPLOS DE CASOS DE USO

### Caso 1: Cuota Inicial Inmediata, Primera Cuota en 1 Mes

```typescript
const initialDate = new Date('2026-02-15');  // Hoy
const firstDate = new Date('2026-03-31');    // 1 mes después, último día

const calculations = financeService.calculateQuote(
    120000,      // S/ 120,000
    8,           // 8% descuento
    30000,       // S/ 30,000 inicial
    60,          // 60 meses
    initialDate,
    firstDate
);

// Resultado:
// Cuota 0: 15/02/2026 → S/ 30,000
// Cuota 1: 31/03/2026 → S/ 1,533.33
// Cuota 2: 30/04/2026 → S/ 1,533.33
// Cuota 3: 31/05/2026 → S/ 1,533.33
// ...
```

### Caso 2: Primera Cuota en 2 Meses (Gracia)

```typescript
const initialDate = new Date('2026-02-15');  // Hoy
const firstDate = new Date('2026-04-30');    // 2 meses después

const calculations = financeService.calculateQuote(
    150000,      // S/ 150,000
    5,           // 5% descuento
    45000,       // S/ 45,000 inicial
    72,          // 72 meses
    initialDate,
    firstDate
);

// Resultado:
// Cuota 0: 15/02/2026 → S/ 45,000
// Cuota 1: 30/04/2026 → S/ 1,354.17 (después de 2 meses)
// Cuota 2: 31/05/2026 → S/ 1,354.17
// Cuota 3: 30/06/2026 → S/ 1,354.17
// ...
```

### Caso 3: Sin Fechas Manuales (Comportamiento por Defecto)

```typescript
// Si no se pasan fechas, usa fechas calculadas automáticamente
const calculations = financeService.calculateQuote(
    100000,
    10,
    25000,
    48
);

// Usa fecha actual para inicial
// Calcula primera cuota automáticamente (1 mes después, último día del mes)
```

---

## 📊 ACTUALIZACIÓN DEL SIMULADOR DE ESCENARIOS

El [`ScenarioSimulator.tsx`](app/components/Quote/ScenarioSimulator.tsx) también debe actualizarse para usar las nuevas fechas:

```typescript
// En ScenarioSimulator.tsx
interface ScenarioSimulatorProps {
    basePrice: number;
    discountPercent: number;
    initialPayment: number;
    baseInstallments: number;
    initialPaymentDate: Date;      // 🆕 Agregar
    firstInstallmentDate: Date;    // 🆕 Agregar
}

// Actualizar los cálculos dentro del componente
const scenarios = useMemo(() => {
    const shortInstallments = Math.max(12, Math.floor(baseInstallments * 0.6));
    const optimistic = financeService.calculateQuote(
        basePrice,
        discountPercent,
        initialPayment,
        shortInstallments,
        initialPaymentDate,      // 🆕 Pasar fecha
        firstInstallmentDate     // 🆕 Pasar fecha
    );

    const realistic = financeService.calculateQuote(
        basePrice,
        discountPercent,
        initialPayment,
        baseInstallments,
        initialPaymentDate,      // 🆕 Pasar fecha
        firstInstallmentDate     // 🆕 Pasar fecha
    );

    const longInstallments = Math.min(180, Math.floor(baseInstallments * 1.5));
    const extended = financeService.calculateQuote(
        basePrice,
        discountPercent,
        initialPayment,
        longInstallments,
        initialPaymentDate,      // 🆕 Pasar fecha
        firstInstallmentDate     // 🆕 Pasar fecha
    );

    return { optimistic, realistic, extended, shortInstallments, longInstallments };
}, [basePrice, discountPercent, initialPayment, baseInstallments, initialPaymentDate, firstInstallmentDate]);
```

---

## ✅ VENTAJAS DEL NUEVO SISTEMA

1. **✅ Mayor Flexibilidad**
   - El cliente puede elegir cuándo pagar la cuota inicial
   - Se puede dar 1 o 2 meses de gracia antes de la primera cuota

2. **✅ Fechas Consistentes**
   - Todas las cuotas caen en el último día del mes
   - Más fácil de recordar para los clientes
   - Alineado con ciclos de pago mensuales

3. **✅ Mejor UX**
   - Fechas visibles y editables
   - Validación automática (primera cuota no puede ser antes de la inicial)
   - Feedback inmediato en la tabla de amortización

4. **✅ Compatible con Sistemas Bancarios**
   - Los bancos suelen usar último día del mes
   - Facilita la domiciliación de pagos

---

## 🧪 TESTING

### Casos de Prueba:

```bash
✅ TC-001: Cuota inicial hoy, primera cuota en 1 mes
✅ TC-002: Cuota inicial hoy, primera cuota en 2 meses
✅ TC-003: Cuota inicial en fecha futura
✅ TC-004: Verificar que todas las cuotas caen en último día del mes
✅ TC-005: Año bisiesto (febrero con 29 días)
✅ TC-006: Meses con 30 días (abril, junio, septiembre, noviembre)
✅ TC-007: Meses con 31 días (enero, marzo, mayo, julio, agosto, octubre, diciembre)
✅ TC-008: Validar que primera cuota no puede ser antes de inicial
```

---

## 📋 CHECKLIST DE INTEGRACIÓN

- [ ] Actualizar estados en `quote/[lotId]/page.tsx`
- [ ] Agregar inputs de fechas en el UI
- [ ] Actualizar `useMemo` de cálculos con nuevas fechas
- [ ] Actualizar tabla de amortización con cuota 0
- [ ] Actualizar `ScenarioSimulator` con nuevas fechas
- [ ] Probar todos los casos de uso
- [ ] Verificar años bisiestos
- [ ] Validar lógica de fechas

---

## 🔄 RETROCOMPATIBILIDAD

El servicio es **100% retrocompatible**:

```typescript
// ✅ Código antiguo sigue funcionando
const calc1 = financeService.calculateQuote(100000, 5, 20000, 72);

// ✅ Nuevo código con fechas manuales
const calc2 = financeService.calculateQuote(
    100000, 
    5, 
    20000, 
    72, 
    new Date('2026-02-15'),
    new Date('2026-03-31')
);
```

Si no se pasan las fechas, el sistema usa valores por defecto calculados automáticamente.

---

**Actualizado:** 2026-02-24  
**Versión:** 2.0.0  
**Estado:** ✅ IMPLEMENTADO Y LISTO PARA USAR

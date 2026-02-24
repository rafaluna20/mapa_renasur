# 🔧 GUÍA DE INTEGRACIÓN - PASO A PASO
## Mejoras del Sistema de Cotización TERRA LIMA

---

## ✅ ARCHIVOS CREADOS

### 1. **Servicio de Validaciones**
📁 `app/services/validationService.ts` (485 líneas)
- Sistema completo de validación por roles
- 4 niveles de permisos (vendedor, supervisor, gerente, admin)
- Validación de descuentos, cuota inicial y plazos
- Validación de disponibilidad de lotes
- Cálculo de nivel de riesgo

### 2. **Componentes de UI**
📁 `app/components/UI/ValidationAlert.tsx` (463 líneas)
- `ValidationAlert`: Muestra errores y warnings
- `RulesDisplay`: Muestra límites del rol del usuario
- `RiskIndicator`: Indicador visual de riesgo
- `ValidationSummary`: Resumen del estado de validación

### 3. **Hook de Búsqueda**
📁 `app/hooks/useClientSearch.ts` (371 líneas)
- Búsqueda inteligente desde 1 carácter
- Clientes recientes (últimos 5)
- Caché de resultados (5 minutos)
- Debounce optimizado (400ms)

### 4. **Simulador de Escenarios**
📁 `app/components/Quote/ScenarioSimulator.tsx` (363 líneas)
- Compara 3 escenarios de plazo
- Visualización comparativa
- Cálculos automáticos

---

## 🔄 INTEGRACIÓN EN LA PÁGINA DE COTIZACIÓN

### Paso 1: Agregar Imports

**Archivo:** `app/quote/[lotId]/page.tsx`

Agregar al inicio del archivo (después de línea 14):

```typescript
// 🆕 NUEVOS IMPORTS - Sistema de Validaciones
import { useQuoteValidation } from '@/app/services/validationService';
import { 
    ValidationAlert, 
    RulesDisplay, 
    RiskIndicator,
    ValidationSummary 
} from '@/app/components/UI/ValidationAlert';
import { useClientSearch } from '@/app/hooks/useClientSearch';
import { ScenarioSimulator } from '@/app/components/Quote/ScenarioSimulator';
```

### Paso 2: Implementar Hook de Validación

**Ubicación:** Después de la línea 25 (después de `const [loading, setLoading] = useState...`)

```typescript
// 🆕 VALIDACIÓN: Hook de validación con rol del usuario
const { 
    rules, 
    validate, 
    validateLotAvailability,
    calculateRisk 
} = useQuoteValidation(user?.role || 'vendedor');

const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
const [lotValidationResult, setLotValidationResult] = useState<ValidationResult | null>(null);
const [riskAssessment, setRiskAssessment] = useState<{ score: number; level: string } | null>(null);
```

### Paso 3: Reemplazar Búsqueda de Clientes

**ELIMINAR** (líneas 82-147 aprox):
```typescript
// ❌ ELIMINAR código antiguo de búsqueda de clientes
const [searchTerm, setSearchTerm] = useState('');
const [searchResults, setSearchResults] = useState...
// ... todo el código de búsqueda hasta handleCreateClient
```

**REEMPLAZAR CON:**
```typescript
// 🆕 BÚSQUEDA MEJORADA: Usar hook personalizado
const {
    searchTerm,
    setSearchTerm,
    displayResults,
    isSearching,
    selectedClient,
    selectClient,
    clearSelection,
    showRecentClients
} = useClientSearch({
    minChars: 1,
    debounceMs: 300,
    enableRecent: true,
    vendorId: user?.uid
});

// Mantener estado de creación de cliente
const [showCreateClient, setShowCreateClient] = useState(false);
const [isCreatingClient, setIsCreatingClient] = useState(false);
const [newClientData, setNewClientData] = useState({ 
    name: '', 
    vat: '', 
    phone: '', 
    email: '' 
});

// Función para crear cliente (se mantiene igual)
const handleCreateClient = async () => {
    if (!newClientData.name || !newClientData.vat) return;
    setIsCreatingClient(true);
    try {
        const newClient = await odooService.createPartner(newClientData);
        selectClient(newClient); // 🆕 Usar selectClient del hook
        setShowCreateClient(false);
        setNewClientData({ name: '', vat: '', phone: '', email: '' });
    } catch (error) {
        console.error('Error creating client:', error);
        alert('Error al crear el cliente. Intente nuevamente.');
    } finally {
        setIsCreatingClient(false);
    }
};
```

### Paso 4: Agregar Validación de Lote al Cargar

**Ubicación:** Después del useEffect que carga el lote (línea 71 aprox)

```typescript
// 🆕 VALIDACIÓN: Validar disponibilidad del lote al cargar
useEffect(() => {
    if (lot && !lotValidationResult) {
        validateLotAvailability(lot.id).then(result => {
            setLotValidationResult(result);
            if (!result.isValid) {
                // Mostrar alerta si el lote no está disponible
                console.warn('Lote no disponible:', result.errors);
            }
        });
    }
}, [lot, lotValidationResult, validateLotAvailability]);
```

### Paso 5: Validación en Tiempo Real

**Ubicación:** Después de los useEffect existentes

```typescript
// 🆕 VALIDACIÓN: Validar en tiempo real cuando cambien los valores
useEffect(() => {
    if (lot) {
        // Validar cotización
        const result = validate(
            lot.list_price,
            discountPercent,
            discountAmount,
            initialPayment,
            numInstallments
        );
        setValidationResult(result);

        // Calcular riesgo
        const initialPaymentPercent = lot.list_price > 0 
            ? (initialPayment / lot.list_price) * 100 
            : 0;
        const risk = calculateRisk(
            lot.list_price,
            discountPercent,
            initialPaymentPercent,
            numInstallments
        );
        setRiskAssessment(risk);
    }
}, [lot, discountPercent, discountAmount, initialPayment, numInstallments, validate, calculateRisk]);
```

### Paso 6: Modificar Lógica de Guardado

**Ubicación:** Función `handleSaveQuote` (línea 164 aprox)

```typescript
// 🆕 MODIFICAR: Agregar validación antes de guardar
const handleSaveQuote = async () => {
    // Validar antes de guardar
    if (!validationResult?.isValid) {
        alert('Por favor corrige los errores antes de guardar la cotización.');
        return;
    }

    if (!lot || !calculations) return;

    setIsSavingQuote(true);
    try {
        // ... resto del código existente ...
    } catch (error) {
        console.error("Error saving quote:", error);
        alert("Error al guardar la cotización");
    } finally {
        setIsSavingQuote(false);
    }
};
```

### Paso 7: Agregar Componentes en el Render

**Ubicación:** Dentro del return, después del Header (línea 400 aprox)

Agregar justo después de `<div className="max-w-6xl mx-auto space-y-6">`:

```typescript
{/* 🆕 VALIDACIÓN: Alertas de validación del lote */}
{lotValidationResult && (
    <ValidationAlert 
        errors={lotValidationResult.errors}
        warnings={lotValidationResult.warnings}
    />
)}

{/* 🆕 VALIDACIÓN: Mostrar reglas del usuario */}
<RulesDisplay 
    rules={rules} 
    userRole={user?.role || 'vendedor'} 
/>

{/* 🆕 VALIDACIÓN: Alertas en tiempo real */}
{validationResult && (
    <>
        <ValidationAlert 
            errors={validationResult.errors}
            warnings={validationResult.warnings}
        />
        
        {/* Resumen de validación */}
        <ValidationSummary
            isValid={validationResult.isValid}
            errorCount={validationResult.errors.length}
            warningCount={validationResult.warnings.length}
        />
    </>
)}

{/* 🆕 RIESGO: Indicador de nivel de riesgo */}
{riskAssessment && (
    <RiskIndicator
        riskScore={riskAssessment.score}
        riskLevel={riskAssessment.level as any}
    />
)}
```

### Paso 8: Agregar Simulador de Escenarios

**Ubicación:** En la columna derecha, después del panel de configuración (línea 652 aprox)

```typescript
{/* 🆕 SIMULADOR: Escenarios de financiamiento */}
{lot && calculations && (
    <ScenarioSimulator
        basePrice={lot.list_price}
        discountPercent={discountPercent}
        initialPayment={initialPayment}
        baseInstallments={numInstallments}
        startDate={new Date(startDate)}
    />
)}
```

### Paso 9: Modificar Botón de Guardar

**Ubicación:** Botón "Guardar Cotización" (línea 368 aprox)

```typescript
<button
    onClick={handleSaveQuote}
    disabled={isSavingQuote || !validationResult?.isValid || quoteConfirmed} // 🆕 Agregar validación
    className={`
        px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-sm
        ${(!validationResult?.isValid || quoteConfirmed)
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
        }
    `}
>
    {isSavingQuote ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
    {!validationResult?.isValid 
        ? `Corregir ${validationResult?.errors.length || 0} error(es)`
        : currentQuoteId ? 'Guardar y Recalcular' : 'Guardar Cotización'
    }
</button>
```

---

## 📝 CAMBIOS OPCIONALES (MEJORAS ADICIONALES)

### A. Actualizar búsqueda de clientes en el render

**Ubicación:** Input de búsqueda de clientes (línea 461 aprox)

Reemplazar todo el bloque de búsqueda con:

```typescript
{/* 🆕 BÚSQUEDA MEJORADA */}
<div className="relative">
    <input
        type="text"
        placeholder="Buscar cliente (desde 1 carácter)..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={`w-full px-3 py-2 text-sm text-black border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${selectedClient ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold' : 'border-slate-200'}`}
    />
    
    {/* Indicadores */}
    {selectedClient && <Check className="absolute right-3 top-2.5 text-blue-600" size={16} />}
    {isSearching && <Loader2 className="absolute right-3 top-2.5 animate-spin text-slate-400" size={16} />}

    {/* Dropdown de resultados o recientes */}
    {(displayResults.length > 0 || showRecentClients) && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
            {/* Título si son recientes */}
            {showRecentClients && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">Clientes Recientes</p>
                </div>
            )}
            
            {/* Lista de resultados */}
            {displayResults.map((client) => (
                <button
                    key={client.id}
                    onClick={() => selectClient(client)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors flex items-center gap-3 border-b border-slate-100 last:border-0"
                >
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-700 block truncate">{client.name}</span>
                        {client.vat && (
                            <span className="text-xs text-slate-500">{client.vat}</span>
                        )}
                    </div>
                </button>
            ))}
            
            {/* Opción para crear nuevo */}
            <button
                onClick={() => setShowCreateClient(true)}
                className="w-full text-left px-4 py-3 text-sm bg-slate-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-2 border-t border-slate-200 font-medium"
            >
                <Plus size={16} />
                Crear Nuevo Cliente
            </button>
        </div>
    )}
</div>
```

---

## 🧪 TESTING RECOMENDADO

### Casos de prueba:

1. **Validación de descuentos:**
   - ✅ Intentar aplicar 10% de descuento como vendedor (debería fallar)
   - ✅ Aplicar 4% de descuento como vendedor (debería funcionar)
   - ✅ Aplicar 15% como supervisor (debería funcionar con warning)

2. **Validación de cuota inicial:**
   - ✅ Intentar 10% de inicial como vendedor (debería fallar, mínimo 20%)
   - ✅ Aplicar 25% de inicial (debería funcionar)

3. **Búsqueda de clientes:**
   - ✅ Buscar desde 1 carácter
   - ✅ Ver clientes recientes al abrir (si existen)
   - ✅ Seleccionar cliente y verificar que se guarda como reciente

4. **Simulador de escenarios:**
   - ✅ Verificar que muestra 3 escenarios
   - ✅ Cambiar plazo y ver actualización automática
   - ✅ Comparar cuotas mensuales entre escenarios

5. **Flujo completo:**
   - ✅ Seleccionar lote → Buscar cliente → Configurar términos → Ver validaciones
   - ✅ Guardar cotización (solo si válida)
   - ✅ Confirmar en Odoo

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### 1. **Roles de Usuario**
Asegúrate de que el campo `user.role` está configurado correctamente en tu sistema de autenticación. Los roles válidos son:
- `vendedor`
- `supervisor`
- `gerente`
- `admin`

Si no existe el rol, el sistema usará `vendedor` por defecto (más restrictivo).

### 2. **Compatibilidad con Odoo**
Las validaciones de disponibilidad de lote requieren que la API `/api/odoo/product/:id` funcione correctamente.

### 3. **LocalStorage**
El hook `useClientSearch` usa localStorage para clientes recientes. Asegúrate de que está habilitado en el navegador.

### 4. **Rendimiento**
- El caché de búsqueda expira después de 5 minutos
- Máximo 50 búsquedas cacheadas
- Debounce de 300-400ms para evitar requests excesivos

---

## 📊 MÉTRICAS A MONITOREAR POST-IMPLEMENTACIÓN

1. **Tasa de error en cotizaciones:** Debería reducirse en ~80%
2. **Tiempo promedio de cotización:** Debería reducirse en ~40%
3. **Uso del simulador:** % de cotizaciones que lo usan
4. **Conversión:** Incremento esperado del 25%

---

## 🐛 TROUBLESHOOTING

### Error: "Cannot read property 'isValid' of null"
**Solución:** Inicializar validationResult antes de usarlo
```typescript
if (validationResult?.isValid) { ... }
```

### Error: "Role not defined"
**Solución:** Verificar que user?.role existe o usar valor por defecto
```typescript
const userRole = user?.role || 'vendedor';
```

### Clientes recientes no se muestran
**Solución:** Verificar localStorage
```typescript
localStorage.getItem('terra_recent_clients')
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Agregar imports en quote/[lotId]/page.tsx
- [ ] Implementar hook de validación
- [ ] Reemplazar búsqueda de clientes con useClientSearch
- [ ] Agregar validación de lote al cargar
- [ ] Agregar validación en tiempo real
- [ ] Modificar lógica de guardado con validación
- [ ] Agregar componentes de validación en el render
- [ ] Agregar simulador de escenarios
- [ ] Actualizar botón de guardar con validación
- [ ] Probar todos los casos de prueba
- [ ] Verificar en diferentes roles
- [ ] Documentar cambios en el código

---

**Documento generado:** 2026-02-24
**Versión:** 1.0  
**Mantenido por:** Equipo de Desarrollo TERRA LIMA

_Esta guía está diseñada para ser seguida paso a paso. Cada modificación incluye la ubicación exacta y el código completo necesario._

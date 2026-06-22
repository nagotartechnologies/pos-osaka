# Diseño: Productos con Proteínas y Envolturas Intercambiables

**Fecha:** 2026-03-17
**Tema:** Sistema de personalización de productos en carta digital

---

## Resumen

Sistema que permite a los clientes personalizar productos de sushi intercambiando proteínas y envolturas, con precios dinámicos calculados automáticamente.

---

## Estructura de Datos

### Schema de Producto (Supabase)

```typescript
interface Product {
  id: string
  name: string              // Ej: "10 Piezas"
  price: number             // Precio base ($8,500)
  description: string       // Ej: "Pollo + Palta + Queso"
  
  // Proteína base
  baseProtein: string        // "pollo"
  proteinAlternatives: ProteinOption[]
  
  // Envoltura base
  baseWrapper: string       // "queso crema"
  wrapperAlternatives: WrapperOption[]
  
  // Fijos (no intercambiables)
  fixedFilling: string       // "cebollín"
  fixedExtra?: string       // "queso" (opcional)
}

interface ProteinOption {
  name: string
  price: number            // 0, 1000, o 1500
}

interface WrapperOption {
  name: string
  price: number            // 0 (base) o 1000 (cambio)
}
```

### Precios Configurados

| Tipo | Opciones | Precios |
|------|----------|---------|
| **Proteínas** | pollo, kanikama | $0 |
| | salmón, atún | +$1,000 |
| | camarón, jaiba | +$1,500 |
| **Envolturas** | queso crema | $0 |
| | palta, jamón, ciboulette, sésamo, nori, salmón, fritos | +$1,000 |

---

## Flujo de Usuario

### 1. Vista de Lista (Categoría)

```
┌─────────────────────────────────────┐
│ 10 Piezas                           │
│ Pollo + Queso Crema + Cebollín     │
│ $8,500                              │
│ [Agregar]                           │
└─────────────────────────────────────┘
```

### 2. Modal de Personalización (al hacer clic)

```
┌─────────────────────────────────────────┐
│ 10 Piezas - Personalizar               │
│                                         │
│ PROTEÍNA                                │
│ ○ Pollo              $0    ← base       │
│ ● Kanikama           $0                 │
│ ○ Salmón         +$1,000               │
│ ○ Atún           +$1,000               │
│ ○ Camarón        +$1,500               │
│ ○ Jaiba          +$1,500               │
│                                         │
│ ENVOLTURA                               │
│ ○ Queso Crema        $0    ← base       │
│ ● Palta          +$1,000               │
│ ○ Jamón          +$1,000               │
│ ○ Ciboulette     +$1,000               │
│ ○ Sésamo         +$1,000               │
│ ○ Nori           +$1,000               │
│ ○ Salmón         +$1,000               │
│ ○ Fritos         +$1,000               │
│                                         │
│ Fijos: Cebollín                         │
│                                         │
│ Total: $9,500                           │
│ (Base $8,500 + Palta $1,000)            │
│                                         │
│ [Cancelar]  [Agregar - $9,500]          │
└─────────────────────────────────────────┘
```

### 3. Carrito

```
10 Piezas
├─ Proteína: Pollo → Camarón (+$1,500)
├─ Envoltura: Queso Crema → Palta (+$1,000)
└─ Fijo: Cebollín

$11,000
```

---

## Cálculo de Precio

```javascript
const finalPrice = basePrice 
  + selectedProtein.price 
  + selectedWrapper.price

// Ejemplo: 8500 + 1500 + 1000 = 11,000
```

---

## Almacenamiento en Pedido

```typescript
interface CartItem {
  id: string
  name: string
  basePrice: number
  quantity: number
  
  // Personalización
  selectedProtein: { name: string, price: number }
  selectedWrapper: { name: string, price: number }
  
  // Fijos
  fixedFilling: string
  fixedExtra?: string
  
  // Total calculado
  finalPrice: number
}
```

---

## APIs Afectadas

1. **`/lib/supabase-menu.ts`** - Agregar campos `baseProtein`, `proteinAlternatives`, `baseWrapper`, `wrapperAlternatives`, `fixedFilling`, `fixedExtra`

2. **`/app/carta/[code]/page.tsx`** - Agregar modal de personalización, cálculo de precios dinámicos

3. **`/lib/receipt-pdf.ts`** - Mostrar cambios en comandas y recibos

4. **Base de datos Supabase** - Migrar tabla `products` con nuevos campos JSON

---

## Notas de Implementación

- Los productos sin `proteinAlternatives` o `wrapperAlternatives` se comportan como hoy (sin personalización)
- El modal solo aparece si el producto tiene al menos una alternativa configurada
- El precio se actualiza en tiempo real al cambiar selecciones
- Máximo 2 cambios por producto (proteína + envoltura)

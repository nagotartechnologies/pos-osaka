# Osaka POS — Sistema de Diseño

## Dirección y Feel
**Tickets de cocina** — denso, operacional, urgente pero ordenado. Como el rail de una cocina profesional: cada ticket tiene un color que lo identifica de un vistazo, sin necesidad de leer.

**Usuario:** operador de restaurante japonés, parado detrás del mostrador o en la barra, bajo presión, escanea en segundos.

**Sentimiento:** laca japonesa con temperatura. No frío corporativo — hay calidez en las superficies, precisión en la tipografía.

---

## Paleta (globals.css)

### Light mode
- **Background:** `oklch(0.985 0.004 75)` — blanco arroz ligeramente tostado
- **Card:** `oklch(1 0.002 75)` — mínimamente más claro que el bg
- **Primary (acento):** `oklch(0.46 0.2 27)` — rojo Osaka
- **Border:** `oklch(0.888 0.008 65)` — cálido, no gris frío
- **Muted foreground:** `oklch(0.52 0.012 50)` — gris cálido

### Dark mode
- **Background:** `oklch(0.13 0.008 35)` — laca negra con temperatura madera
- **Card:** `oklch(0.16 0.008 35)`
- **Primary:** `oklch(0.58 0.22 27)` — rojo más brillante para contraste
- **Border:** `oklch(0.25 0.008 38)` — oscuro cálido

---

## Firma Visual: Borde Izquierdo de Estado

El elemento que solo existe para este producto. Cada pedido/tarjeta/modal muestra un `border-l-4` del color del estado — como los tickets colgados en el rail de cocina.

### Colores por estado:
| Estado | Color | Clase Tailwind |
|---|---|---|
| recibido | azul | `border-l-blue-500` |
| preparando | ámbar | `border-l-amber-500` |
| en-camino | púrpura | `border-l-purple-500` |
| entregado | esmeralda | `border-l-emerald-500` |
| cancelado | rojo | `border-l-red-500` |

**Regla:** Aplicar en tarjetas de lista Y en el header del modal de detalle. El badge de estado se vuelve secundario — el borde ya comunica.

---

## Estrategia de Profundidad
**Borders-only** — sin sombras dramáticas. Sombra `shadow-sm` solo en cards para mínimo lift. `hover:shadow-md` para interacción.

Borders con `rgba` implícito via tokens oklch de baja saturación.

---

## Tipografía
- **Font:** Geist / Inter (sistema)
- **Títulos de página:** `font-black tracking-tight` — peso máximo, tracking apretado
- **Nombres de cliente:** `font-bold` o `font-black`
- **Precios:** siempre `tabular-nums font-black`
- **Labels/badges:** `text-[9px] font-bold uppercase tracking-wide`
- **Metadata:** `text-[10px] font-mono text-muted-foreground`

---

## Espaciado
- Base: 4px (Tailwind default)
- Cards: `p-3` (12px) en mobile, consistente
- Secciones: `space-y-3` dentro de modales
- Badges: `px-1.5 py-0.5` — compactos, no pills — usar `rounded-md` no `rounded-full`

---

## Border Radius
- `--radius: 0.75rem` (12px) — base
- Cards/modales: `rounded-xl`
- Badges: `rounded-md` — cuadrados, técnicos
- Botones de acción primarios: `rounded-xl`

---

## Componentes Documentados

### Tarjeta de Pedido (Order Card)
```
border-l-4 [color-estado] border border-border rounded-xl bg-card
padding: pl-3 pr-3 pt-2.5 pb-2.5
```
- Sin ícono de estado en círculo — el borde lo reemplaza
- Badge de estado: pequeño, `rounded-md`, `uppercase tracking-wide`
- Items: separados por `·` (interpunct), no comas
- Precio: `font-black tabular-nums` alineado a la derecha
- Alert urgente (comprobante pendiente): `ring-1 ring-amber-500/30`

### Tabs de Estado
- Contador: `rounded-md` (no pill), `h-[18px]`, `font-black tabular-nums`
- Activo: fondo del color del estado con border
- Inactivo: `bg-card border border-border`
- En mobile: solo ícono (label hidden con `hidden sm:inline`)

### Modal de Detalle
- Header sticky con `border-l-4` del estado — consistente con las cards
- Total en el header, grande, `font-black tabular-nums`
- Estado y metadata en línea debajo del nombre
- Sección productos: header `text-[9px] uppercase tracking-widest`
- Cantidad del item: `font-bold tabular-nums text-muted-foreground` + espacio + nombre

### Extras de Producto
- Indentados con `pl-4` bajo el item
- Color `text-amber-600`, símbolo `✦` en `text-amber-400`
- Precio del extra en `font-bold`

# Diseño: Sistema de Modificación de Pedidos con Costos Extra

## Resumen
Permitir al operador modificar pedidos existentes (estados "recibido" y "preparando") con soporte para cargos configurables por modificación.

## Modelo de Datos

### Tabla `orders` — Nuevas columnas:
- `modification_fee` (numeric, default 0) — cargo extra por modificación
- `original_total` (numeric, nullable) — total antes del primer cambio
- `modification_notes` (text, nullable) — resumen de cambios

### Tabla `config` — Nuevas keys:
- `modificationFee` — monto por defecto (ej: 500)
- `modificationFeeEnabled` — "true"/"false"

## Flujo
1. Operador abre detalle de pedido (recibido/preparando)
2. Presiona "Editar Pedido"
3. Se abre EditOrderModal con catálogo + items pre-cargados
4. Modifica items (agregar/quitar/cambiar cantidad/notas)
5. Paso 2: Resumen de cambios con diferencias y cargo configurable
6. Confirma → se actualiza el pedido en Supabase

## Componentes
- **EditOrderModal** — Modal tipo POS con 2 pasos (edición → resumen)
- **Botón "Editar"** en modal de detalle de pedido
- **Indicador visual** de pedido modificado en la lista

## Reglas de Negocio
- Solo pedidos en estado "recibido" o "preparando" son editables
- Cargo por modificación: valor por defecto desde config, editable al momento
- original_total se guarda solo en la primera modificación
- modification_notes: texto breve generado automáticamente

# Mejoras de Gestión Admin WhatsApp

**Fecha:** 2026-03-15  
**Enfoque:** Panel Lateral Integrado en /pedidos

---

## 1. Tab "Chats" en /pedidos

Un tab nuevo junto a los tabs de estado (Recibido, Preparando, etc.) que muestra todas las conversaciones activas.

### Lista de conversaciones
- Cada item: nombre del cliente (o número si no hay pedido), último mensaje truncado, hora, badge de no leídos
- Ordenadas por último mensaje (más reciente arriba)
- Agrupadas: **Con pedido activo** (borde color del estado) y **Sin pedido** (borde verde)
- Click → abre ChatPanel existente a la derecha

### Datos
- Query: agrupar `chat_messages` por `order_id`, cruzar con `orders` para nombre/estado, calcular unread count
- Suscripción realtime para actualizar lista en vivo

---

## 2. Respuestas Rápidas

### Almacenamiento
- Tabla `quick_replies` en Supabase: `id` (uuid), `title` (text), `message` (text), `sort_order` (int)
- Placeholders soportados: `{nombre}`, `{pedido}`, `{negocio}`

### En ChatPanel
- Botón ⚡ al lado del input
- Click → menú con respuestas rápidas
- Click en una → inserta texto en el input (editable antes de enviar)
- Placeholders se reemplazan automáticamente con datos del chat actual

### En Configuración
- Sección "Respuestas Rápidas" con CRUD completo
- Cada entrada: título corto + mensaje completo
- Agregar, editar, eliminar, reordenar

---

## 3. Contexto del Cliente en ChatPanel

### Sección colapsable (arriba del chat)
- **Datos:** Nombre, teléfono
- **Métricas:** Total de pedidos, gasto acumulado, último pedido (fecha)
- **Últimos 3 pedidos:** ID, items resumidos, total, fecha

### Datos
- Query a `orders` filtrando por `client_phone` del chat
- Se calcula al abrir el chat (no realtime necesario)

---

## 4. Alertas Mejoradas

- **Sonido** corto al recibir mensaje incoming (configurable on/off desde config)
- **Badge en tab "Chats"** con total de no leídos (siempre visible)
- **Notificación nativa** del navegador (ya existe, se mantiene)

---

## Orden de Implementación

1. Tab "Chats" con lista de conversaciones
2. Respuestas rápidas (tabla + CRUD + selector en chat)
3. Contexto del cliente en ChatPanel
4. Alertas mejoradas (sonido + badge)

## Stack

- **Frontend:** React, Next.js, TypeScript, TailwindCSS, Lucide icons
- **Backend:** Supabase (tablas, realtime)
- **WhatsApp:** GreenAPI

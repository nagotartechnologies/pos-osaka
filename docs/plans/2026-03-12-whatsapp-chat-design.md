# Diseño: Chat Interno + Notificaciones WhatsApp con GreenAPI

## Fecha: 2026-03-12

## Resumen

Integrar GreenAPI para:
1. Notificaciones automáticas de estado de pedido por WhatsApp
2. Chat bidireccional vendedor ↔ cliente dentro del módulo de pedidos
3. Envío automático del recibo PDF al entregar pedido
4. Badge de mensajes no leídos por pedido

## Arquitectura

```
Frontend (PedidosPage)
├── ChatPanel (slide-in) ← Supabase Realtime
├── Badge mensajes no leídos en tarjeta pedido
└── Cambio estado → API → notifica WhatsApp

API Routes
├── POST /api/whatsapp/send     → Enviar mensaje/archivo
├── POST /api/whatsapp/webhook  → Recibir mensajes GreenAPI
└── GET  /api/whatsapp/status   → Estado de conexión

Supabase
├── Tabla: chat_messages (historial + realtime)
└── Realtime subscription → push al frontend

GreenAPI
├── SendMessage / SendFileByUrl
└── Webhook → /api/whatsapp/webhook
```

## Tabla chat_messages (Supabase)

| Columna    | Tipo         | Descripción                        |
|------------|--------------|------------------------------------|
| id         | uuid         | PK                                 |
| order_id   | uuid         | FK a pedido                        |
| phone      | text         | Teléfono del cliente               |
| direction  | text         | "incoming" o "outgoing"            |
| message    | text         | Contenido del mensaje              |
| type       | text         | "text", "file", "status"           |
| read       | boolean      | Si fue leído por el vendedor       |
| created_at | timestamptz  | Fecha                              |

## Notificaciones Automáticas

| Cambio de estado | Mensaje WhatsApp                                              |
|-----------------|---------------------------------------------------------------|
| → Recibido      | "✅ Hola {nombre}, tu pedido #{id} ha sido recibido"          |
| → Preparando    | "👨‍🍳 Tu pedido #{id} está siendo preparado"                   |
| → En Camino     | "🚚 Tu pedido #{id} está en camino"                          |
| → Entregado     | "✅ Pedido entregado. ¡Gracias!" + PDF recibo                |
| → Cancelado     | "❌ Tu pedido #{id} ha sido cancelado"                        |

## Flujo Chat Bidireccional

1. Vendedor envía → API route → GreenAPI → Cliente + guarda en Supabase
2. Cliente responde → GreenAPI webhook → API route → guarda en Supabase → Realtime → Frontend

## Badge No Leídos

- Query: chat_messages WHERE direction='incoming' AND read=false GROUP BY order_id
- Badge rojo en tarjeta del pedido
- Al abrir chat → marcar como leídos

## Archivos

### Crear
- `lib/greenapi.ts` - Cliente GreenAPI
- `components/chat-panel.tsx` - Panel de chat
- `app/api/whatsapp/send/route.ts` - Enviar mensajes
- `app/api/whatsapp/webhook/route.ts` - Recibir mensajes

### Modificar
- `app/pedidos/page.tsx` - Integrar chat + notificaciones automáticas
- Supabase - Crear tabla chat_messages

## Variables de Entorno

```env
GREENAPI_ID_INSTANCE=
GREENAPI_API_TOKEN=
```

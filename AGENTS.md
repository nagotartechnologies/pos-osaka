# pos-osaka

POS para restaurante de sushi (Osaka, Chile): Next.js 16 (app router, `output: "standalone"`) + React 19 + Tailwind v4 + Supabase self-hosted (`deploy/backend`). Deploy con `bash deploy.sh` (rsync + docker compose en el VPS). Todo el código, UI y commits están en español.

## Comandos
- Gestor de paquetes: **npm** (el `Dockerfile` usa `npm ci` con `package-lock.json`; `pnpm-lock.yaml` es residual).
- `npm run dev` · `npm run build` · `npm run lint`. No hay tests automatizados.
- Deploy: `bash deploy.sh` → rsync a `root@docs.csec.cl:/root/osaka/app` y `docker compose -f docker-compose.prod.yml up -d --build` (contenedor `osaka-app`, expuesto en `127.0.0.1:3005`). Sincroniza la carpeta donde está `deploy.sh`.
- `deploy/gen-app-env.sh` genera `deploy/app.env` (producción) a partir de `.env`, repuntando Supabase a `https://osakasushi.nagotartech.com` y tomando las keys de `deploy/backend/.env`.
- Las variables `NEXT_PUBLIC_*` se incrustan en el build (build args del Dockerfile): si cambian, hay que reconstruir.

## Infraestructura
- Dominio: `osakasushi.nagotartech.com`. Nginx (`deploy/nginx-osaka.conf`) enruta `/rest/v1`, `/auth/v1`, `/storage/v1` y `/realtime/v1` a Kong (`:8000`) y `/` a la app (`:3005`).
- Supabase recortado en `deploy/backend/docker-compose.osaka.yml`: db + PostgREST + realtime + kong. Scripts SQL del backend: `osaka-schema.sql`, `osaka-grants-realtime.sql`, `osaka-storage-policy.sql`, `osaka-hardening.sql` (grants mínimos de anon + policy de subida de comprobantes, ya aplicado).
- En el VPS: app en `/root/osaka/app` (sin git, la sobrescribe `deploy.sh`), backend Supabase que corre en `/root/osaka/backend` (carpeta aparte, `deploy.sh` no la toca), backups en `/root/osaka/backups`. Nginx activo: `/etc/nginx/sites-available/osakasushi.nagotartech.com` (SSL con Certbot). Si se edita algo directo en el VPS, traerlo al repo antes del próximo deploy o se pierde.
- Imágenes: Cloudinary (`lib/cloudinary.ts`, `/api/cloudinary-delete`) y bucket `media` de Supabase Storage (`STORAGE_BUCKET` en `lib/supabase.ts`).
- Zona horaria del negocio: `America/Santiago` (se usa explícitamente en descuentos, días laborales, reportes y webhook). No asumir la TZ del servidor.

## Estructura
- `app/` — páginas: `/` (inicio/jornada), `/pos` (venta en mostrador), `/pedidos`, `/menu` (productos/categorías/descuentos), `/inventario`, `/finanzas`, `/dashboard`, `/whatsapp` (chat), `/configuracion`, `/login`, `/carta` y `/carta/[code]` (carta pública para clientes).
- `app/api/` — `auth/{login,logout,pin,session}`, `public/{config,orders}` (sin sesión), `whatsapp/{send,broadcast,webhook,status,notify-admin,post-venta,daily-summary,send-report}`, `logo`, `manifest`, `cloudinary-delete`.
- `lib/supabase-*.ts` — acceso a datos por dominio (orders, menu, inventory, finanzas, chat, config, quick-replies). `lib/supabase-orders.ts` también maneja la suscripción realtime de pedidos.
- `lib/whatsapp.ts` — fachada que delega en `lib/greenapi.ts` u `lib/openwa.ts` según `config.whatsappProvider` (cache 15 s, sin fallback automático).
- `lib/pdf/` — tickets de cocina, boletas, cierre de caja y reportes (jsPDF).
- `lib/business-days.ts` — jornadas laborales (Iniciar Día → Cerrar Día) guardadas en `config.businessDays`; los reportes de días pasados usan esas ventanas, no un horario fijo.
- `lib/schedule.ts` — horario de atención (`config.schedule`).
- Promos por franja: `products.visible_days/visible_time_start/visible_time_end` + `isProductOnSchedule()` (`lib/supabase-menu.ts`). Se filtran en la carta, el POS (`use-pos`, `pos-modal`, `edit-order-modal`, con `useNow()` que refresca cada minuto) y se validan en `/api/public/orders`. Nuevas vistas que listen productos para vender deben aplicar el mismo filtro.
- `components/`, `components/ui/` (shadcn), `hooks/` (`use-pos`, `use-chat-conversation`, `use-whatsapp-actions`, etc.).
- `docs/` — `schema.sql` (esquema de referencia), `migrations/` (SQL a aplicar a mano, con fecha), `plans/` (diseños de features).

## Datos
- Tablas: `categories`, `products`, `orders`, `chat_messages`, `inventory`, `stock_movements`, `transactions`, `config`, `quick_replies`.
- `config` es key/value (`text`): branding (`nombreNegocio`, `logoPublicUrl`, `themeColor`), carta (`cartaCode`, `deliveryFee`, `promoBanners`, `ordersBlocked`, `newProductDays`…), jornada (`lastDayStart`, `lastDayClose`, `businessDays`), WhatsApp (`whatsappProvider`, mensajes por estado), hashes de PIN. Valores complejos se guardan como JSON string.
- Estados de pedido: `recibido | cotizado | preparando | en-camino | entregado | cancelado`. Pago: `efectivo | transferencia | tarjeta` (`debito | credito`). Entrega: `delivery | retiro`.
- Cambios de esquema: agregar un archivo nuevo en `docs/migrations/AAAA-MM-DD-descripcion.sql` y actualizar `docs/schema.sql`.
- Algunas preferencias locales de UI (logo cacheado, nombre del negocio, categorías) usan localStorage (`lib/config-store.ts`); nunca datos sensibles.

## Seguridad / auth (no romper)
- Login por PIN validado en el servidor (`/api/auth/login`). PINs hasheados con scrypt en `config.pinAdminHash` / `config.pinVendedorHash` (`lib/server/pin.ts`). Nunca guardar PINs ni sesión en localStorage.
- Sesión = cookie httpOnly `pos_session` firmada (`lib/server/session.ts`). `proxy.ts` protege páginas; las API routes usan `verifyInternalRequest` (`lib/api-auth.ts`), que acepta la cookie o `INTERNAL_API_SECRET`, nunca la anon key.
- Roles: `admin` y `vendedor`. El vendedor no accede a `/dashboard`, `/menu`, `/inventario`, `/finanzas`, `/configuracion` (`ADMIN_ONLY` en `proxy.ts`); para APIs solo de admin usar `verifyInternalRequest(req, "admin")`.
- El navegador consulta Supabase con un JWT de sesión (`role: authenticated`, `app_role`) vía la opción `accessToken` en `lib/supabase.ts`. En el servidor `getSharedClient()` usa service_role; `lib/supabase-admin.ts` solo es para servidor.
- RLS (`docs/migrations/2026-11-02-security-rls.sql`): anon solo lee `products` y `categories`. La carta pública usa `/api/public/config` (whitelist de keys) y `/api/public/orders`.
- Si agregas una key de config que la carta necesita, súmala a `CARTA_KEYS` en `/api/public/config` (solo si es pública).
- `/api/public/orders` recalcula precios en el servidor (`getEffectivePrice`, opciones de proteína/envoltura del producto, salsas de `lib/carta-salsas.ts`, `config.deliveryFee`). Si cambias cómo la carta calcula precios, replica el cambio ahí o se rechazarán pedidos (409 `PRICE_MISMATCH`).
- `.env`, `deploy/app.env` y los dumps `.sql` con datos no se versionan (ver `.env.example`).

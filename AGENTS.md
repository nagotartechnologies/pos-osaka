# pos-osaka

POS para restaurante: Next.js 16 (app router) + Supabase self-hosted (`deploy/backend`), deploy con `bash deploy.sh` (rsync + docker compose en el VPS).

## Seguridad / auth (no romper)
- Login por PIN validado en el servidor (`/api/auth/login`). PINs hasheados con scrypt en `config.pinAdminHash` / `config.pinVendedorHash` (`lib/server/pin.ts`). Nunca guardar PINs ni sesión en localStorage.
- Sesión = cookie httpOnly `pos_session` firmada (`lib/server/session.ts`). `proxy.ts` protege páginas; las API routes usan `verifyInternalRequest` (`lib/api-auth.ts`), que acepta la cookie o `INTERNAL_API_SECRET`, nunca la anon key.
- El navegador consulta Supabase con un JWT de sesión (`role: authenticated`, `app_role`) vía la opción `accessToken` en `lib/supabase.ts`. En el servidor `getSharedClient()` usa service_role; `lib/supabase-admin.ts` solo es para servidor.
- RLS (`docs/migrations/2026-11-02-security-rls.sql`): anon solo lee `products` y `categories`. La carta pública usa `/api/public/config` (whitelist de keys) y `/api/public/orders`.
- `/api/public/orders` recalcula precios en el servidor (`getEffectivePrice`, opciones de proteína/envoltura del producto, salsas de `lib/carta-salsas.ts`, `config.deliveryFee`). Si cambias cómo la carta calcula precios, replica el cambio ahí o se rechazarán pedidos (409 `PRICE_MISMATCH`).
- `.env`, `deploy/app.env` y los dumps `.sql` con datos no se versionan (ver `.env.example`).

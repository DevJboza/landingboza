# Boza Control Center

Aplicación privada dentro de `boza.lat`, disponible en `/manage04`. La landing pública no comparte navegación ni estado visual con el panel.

## Arquitectura

- `app/manage04`: shell, login, vistas responsive, PWA y estilos aislados.
- `app/api/manage`: autenticación y API privada consistente (`{ success, data }`).
- `lib/manage`: tipos, repositorio, mocks, sesión e integraciones de servidor.
- `public/manage04`: icono y service worker. El worker nunca intercepta `/api/*`.

El repositorio en memoria permite una demo interactiva sin credenciales externas. Se reinicia al reiniciar la instancia. Para producción, se puede conservar la interfaz de `repository.ts` y reemplazar sus operaciones por Drizzle/Postgres. El esquema D1 existente no se modificó y no se ejecutó ninguna migración destructiva.

## Autenticación y seguridad

El password se compara en el servidor con bcrypt. La sesión es un token firmado con HMAC-SHA256 y vive en una cookie `HttpOnly`, `SameSite=Strict`, `Path=/`, segura en producción y con vencimiento de 12 horas. Las APIs privadas verifican la sesión, rechazan orígenes cruzados, no se cachean y validan payloads. Login permite cinco intentos por IP cada 15 minutos. En producción, ambas variables siguientes son obligatorias:

```env
MANAGE04_PASSWORD_HASH=...
SESSION_SECRET=...
```

Genera el hash sin guardarlo:

```bash
npm run hash-password
```

También admite `npm run hash-password -- "una contraseña temporal"`, pero el modo interactivo evita que aparezca en el historial del shell. Genera `SESSION_SECRET` con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

## Desarrollo local

```bash
npm install
npm run dev
```

Crea `.env.local` a partir de `.env.example`, añade el hash y un secreto de sesión, y abre `/manage04`.

## Vercel

Agrega las variables en Project Settings → Environment Variables y despliega normalmente. No uses el hash ni los tokens en variables con prefijo `NEXT_PUBLIC_`. El panel y sus APIs usan runtime Node.js, compatible con bcryptjs.

## PWA

El manifest usa `start_url: /manage04`, `scope: /manage04/` y modo standalone. El service worker adopta una estrategia network-first para el shell y excluye toda API y JSON sensible. Safari iOS permite instalar desde Compartir → Añadir a pantalla de inicio.

## Sustituir mocks y conectar Postgres

1. Implementa las mismas operaciones exportadas por `lib/manage/repository.ts` con Drizzle.
2. Crea tablas para contactos, negocios, conversaciones, mensajes, prospectos, leads, cotizaciones, seguimientos, notas, comandos, outreach y actividades.
3. Cambia el proveedor importado por las rutas y por `app/manage04/page.tsx`.
4. Ejecuta migraciones primero en staging. No existe seed automático de producción.

## n8n, WaSender y OpenRouter

`lib/manage/integrations.ts` contiene wrappers exclusivamente de servidor. Configura `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_SECRET`, `WASENDER_API_URL`, `WASENDER_API_TOKEN` y `OPENROUTER_API_KEY`. Sin credenciales, la UI continúa en modo demo. El webhook `/api/webhooks/wasender` espera `messages.post` y una firma HMAC SHA-256 en `x-webhook-signature`; adapta el nombre/formato solo después de confirmar la documentación exacta del proveedor.

## Límites deliberados del MVP

- Los cambios demo residen en memoria y no se sincronizan entre instancias serverless.
- Los botones de integraciones sensibles están preparados visualmente, pero no envían mensajes masivos.
- No se muestra ni se devuelve ningún secreto en Configuración.

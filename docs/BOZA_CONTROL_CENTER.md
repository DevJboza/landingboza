# Boza Control Center

Aplicación privada dentro de `boza.lat`, disponible en `/manage04`. La landing pública no comparte navegación ni estado visual con el panel.

## Arquitectura

- `app/manage04`: shell, login, vistas responsive, PWA y estilos aislados.
- `app/api/manage`: autenticación y API privada consistente (`{ success, data }`).
- `lib/manage`: tipos, repositorio PostgreSQL, sesión e integraciones de servidor.
- `public/manage04`: icono y service worker. El worker nunca intercepta `/api/*`.

`PostgresManageRepository` es la única fuente de datos utilizada por la aplicación y las APIs. La conexión usa Drizzle con `postgres.js`, `prepare: false` y una conexión por instancia para ser compatible con Supabase Transaction Pooler y Vercel.

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

## PostgreSQL y migraciones

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:verify
```

El seed solo crea los ajustes iniciales del agente y nunca inserta clientes ficticios. `db:verify` comprueba las 14 tablas y prueba operaciones reales de persistencia con registros temporales que elimina al finalizar.

## n8n, WaSender y OpenRouter

`lib/manage/integrations.ts` contiene wrappers exclusivamente de servidor. Configura `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_SECRET`, `WASENDER_API_URL`, `WASENDER_API_TOKEN`, `WASENDER_WEBHOOK_SECRET` y `OPENROUTER_API_KEY`. Las integraciones ausentes aparecen como no configuradas. El webhook `/api/webhooks/wasender` consume `body.messages[]`, verifica HMAC SHA-256 desde el body crudo mediante `x-wasender-signature` y evita duplicados por ID externo.

## Límites deliberados del MVP

- El archivo de mock histórico permanece únicamente como referencia demo y no se importa en producción.
- No existe envío masivo; cada mensaje requiere una conversación y acción humana individual.
- No se muestra ni se devuelve ningún secreto en Configuración.

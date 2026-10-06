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

El seed solo crea los ajustes iniciales del agente y nunca inserta clientes ficticios. `db:verify` comprueba las 16 tablas y prueba operaciones reales de persistencia con registros temporales que elimina al finalizar.

## Scout diario: ChatGPT → correo → n8n

ChatGPT es el Scout. OpenRouter no participa en el flujo normal y solamente puede usarse en n8n como reparación cuando el bloque JSON está ausente o corrupto. El importador nunca llama GREEN-API, nunca crea conversaciones y nunca envía WhatsApp.

Configura únicamente en backend/Vercel:

```env
SCOUT_API_SECRET=
SCOUT_TEST_ALLOWED_PHONE=
```

El workflow esperado en n8n es:

1. Gmail Trigger o IMAP sobre el buzón Scout.
2. Validar que el remitente coincide exactamente con el remitente autorizado configurado en n8n. No aceptar cualquier correo del buzón.
3. Verificar que el subject empiece con `BOZA_SCOUT | PEREZ |`.
4. Extraer exclusivamente el texto comprendido entre `---BOZA_SCOUT_JSON---` y `---END_BOZA_SCOUT_JSON---`.
5. Ejecutar `JSON.parse`; si funciona, no llamar OpenRouter.
6. Validar `schemaVersion === 1`.
7. Hacer `POST https://www.boza.lat/api/internal/scout/prospects/import` con `Authorization: Bearer {{$env.SCOUT_API_SECRET}}` y `Content-Type: application/json`.

Ejemplo exacto de correo:

```text
Subject: BOZA_SCOUT | PEREZ | 2026-10-06

Se analizaron fuentes públicas de negocios de Pérez Zeledón.

---BOZA_SCOUT_JSON---
{
  "schemaVersion": 1,
  "batchId": "scout-2026-10-06-perez",
  "generatedBy": "chatgpt",
  "targetArea": {
    "country": "Costa Rica",
    "province": "San José",
    "canton": "Pérez Zeledón"
  },
  "prospects": [{
    "businessName": "Negocio de prueba estructural",
    "category": "Servicios",
    "country": "Costa Rica",
    "province": "San José",
    "canton": "Pérez Zeledón",
    "city": "San Isidro de El General",
    "address": null,
    "phone": null,
    "whatsapp": null,
    "website": null,
    "instagram": null,
    "facebook": null,
    "source": "chatgpt_daily_scout",
    "sourceUrls": ["https://example.com/fuente-publica"],
    "score": 75,
    "confidence": 0.85,
    "signals": {
      "hasWebsite": false,
      "usesWhatsApp": false,
      "hasBookingSystem": false,
      "hasOnlineStore": false,
      "socialActivity": "unknown"
    },
    "opportunity": "Oportunidad sustentada por la fuente pública indicada.",
    "suggestedServices": ["pagina_web"],
    "reasonToContact": "Existe una oportunidad de presencia digital.",
    "suggestedMessage": "Hola, quisiera conversar sobre su presencia digital.",
    "evidence": [{
      "claim": "El negocio figura en una fuente pública",
      "sourceUrl": "https://example.com/fuente-publica"
    }]
  }]
}
---END_BOZA_SCOUT_JSON---
```

Los endpoints internos son `POST /api/internal/scout/prospects/import` y `POST /api/internal/scout/check`. Ambos requieren el mismo Bearer secret. El import admite hasta 50 candidatos, exige al menos una fuente, deduplica contra contactos, negocios, conversaciones, prospectos y outreach, aplica las exclusiones de Coto Brus, San Vito y Sabalito, y crea solamente `prospects.NEW` más `outreach_queue.DRAFT`.

`batchId` admite dos formatos estrictos: `scout-YYYY-MM-DD-perez` para lotes diarios y `scout-test-YYYY-MM-DD-NNN` para pruebas controladas del workflow. No se aceptan identificadores arbitrarios.

El import normal siempre termina en `outreach_queue.DRAFT` y no envía mensajes. Existe una excepción deliberadamente limitada para probar el pipeline: el payload debe incluir simultáneamente `"testMode": true` y `"autoSend": true`, contener exactamente un prospecto y su teléfono/WhatsApp normalizado debe coincidir exactamente con `SCOUT_TEST_ALLOWED_PHONE`. Un número diferente devuelve `TEST_PHONE_NOT_ALLOWED`. Cuando se cumplen todas las condiciones se crea una conversación `HUMAN`, se envía solamente `suggestedMessage`, se persiste un mensaje `OUTBOUND/AGENT`, el outreach pasa a `SENT` y se registra `SCOUT_TEST_MESSAGE_SENT`.

## n8n, GREEN-API y OpenRouter

La capa `WhatsAppProvider` selecciona el proveedor mediante `WHATSAPP_PROVIDER`. Producción usa `GREEN_API`; WaSender queda aislado únicamente como rollback legacy. Configura `GREEN_API_URL`, `GREEN_API_INSTANCE_ID`, `GREEN_API_TOKEN`, `GREEN_API_WEBHOOK_TOKEN`, `N8N_AGENT_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` y `OPENROUTER_API_KEY`.

GREEN-API entrega exclusivamente a `POST /api/webhooks/green-api`. El endpoint valida `Authorization: Bearer <GREEN_API_WEBHOOK_TOKEN>`, persiste primero en PostgreSQL y sólo reenvía el payload original a n8n cuando la conversación está en modo `AUTO`. En `HUMAN`, `PAUSED`, `CLOSED` e `IGNORE` nunca activa el bot. El envío manual usa `sendMessage`, recupera `externalChatId` de PostgreSQL y nunca expone el token al cliente.

## Límites deliberados del MVP

- El archivo de mock histórico permanece únicamente como referencia demo y no se importa en producción.
- No existe envío masivo; cada mensaje requiere una conversación y acción humana individual.
- No se muestra ni se devuelve ningún secreto en Configuración.

import { createHmac, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: "env.local", override: false });

const testSecret = `test-${randomUUID()}`;
process.env.WASENDER_WEBHOOK_SECRET = testSecret;

const [{ POST }, { getDb }, schema, repositoryModule, authModule] = await Promise.all([
  import("../app/api/webhooks/wasender/route"),
  import("../db"),
  import("../db/schema"),
  import("../lib/manage/repository"),
  import("../lib/manage/auth"),
]);

const externalId = `flow-test-${randomUUID()}`;
const phone = `5069${String(Date.now()).slice(-7)}`;
const chatId = `${phone}@s.whatsapp.net`;
const text = "MENSAJE DE PRUEBA CONTROL CENTER";
const raw = JSON.stringify({
  body: {
    messages: [
      {
        id: externalId,
        type: "text",
        chat_id: chatId,
        from_me: false,
        from_name: "Prueba Control Center",
        text: { body: text },
      },
    ],
  },
});
const signature = createHmac("sha256", testSecret).update(raw).digest("hex");
const response = await POST(
  new Request("http://localhost/api/webhooks/wasender", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-wasender-signature": signature,
    },
    body: raw,
  }),
);
if (response.status !== 200) throw new Error(`Webhook returned ${response.status}`);

const db = getDb();
const [contact] = await db
  .select()
  .from(schema.contacts)
  .where(eq(schema.contacts.phone, phone));
const [conversation] = contact
  ? await db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.contactId, contact.id),
          eq(schema.conversations.externalChatId, chatId),
        ),
      )
  : [];
const [message] = conversation
  ? await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.externalId, externalId))
  : [];

if (!contact || !conversation || !message) throw new Error("Persistence chain incomplete");
if (message.conversationId !== conversation.id)
  throw new Error("Message conversation relation is invalid");
if (
  message.direction !== "INBOUND" ||
  message.senderType !== "CUSTOMER" ||
  message.body !== text
)
  throw new Error("Persisted message fields are invalid");

const repositoryMessages =
  await repositoryModule.repository.getMessagesByConversationId(conversation.id);
if (
  repositoryMessages.length !== 1 ||
  repositoryMessages[0].externalId !== externalId ||
  repositoryMessages[0].text !== text
)
  throw new Error("Repository did not return the persisted message");

let apiStatus: number | "not-running" = "not-running";
let apiMessages = 0;
try {
  const apiResponse = await fetch(
    `http://localhost:3000/api/manage/conversations/${conversation.id}`,
    {
      headers: {
        cookie: `${authModule.SESSION_COOKIE}=${authModule.createSessionToken()}`,
      },
    },
  );
  apiStatus = apiResponse.status;
  const apiBody = (await apiResponse.json()) as {
    data?: { messages?: Array<{ externalId: string | null; text: string }> };
  };
  apiMessages = apiBody.data?.messages?.length || 0;
  if (
    apiResponse.status !== 200 ||
    !apiBody.data?.messages?.some(
      (item) => item.externalId === externalId && item.text === text,
    )
  )
    throw new Error("Manage API did not return the persisted message");
} catch (error) {
  if (apiStatus !== "not-running") throw error;
}

await db
  .delete(schema.messages)
  .where(eq(schema.messages.conversationId, conversation.id));
await db
  .delete(schema.conversations)
  .where(eq(schema.conversations.id, conversation.id));
await db.delete(schema.contacts).where(eq(schema.contacts.id, contact.id));

console.log(
  JSON.stringify({
    webhookStatus: response.status,
    contact: "persisted",
    conversation: "persisted-with-external-chat-id",
    message: "persisted-and-related",
    direction: message.direction,
    senderType: message.senderType,
    repositoryMessages: repositoryMessages.length,
    manageApiStatus: apiStatus,
    manageApiMessages: apiMessages,
    cleanup: "completed",
  }),
);

import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: "env.local", override: false });
const webhookToken = `test-${randomUUID()}`;
process.env.GREEN_API_WEBHOOK_TOKEN = webhookToken;
process.env.N8N_AGENT_WEBHOOK_URL = "";

const [{ POST }, { getDb }, schema, repositoryModule] = await Promise.all([
  import("../app/api/webhooks/green-api/route"),
  import("../db"),
  import("../db/schema"),
  import("../lib/manage/repository"),
]);
const phone = `5069${String(Date.now()).slice(-7)}`;
const chatId = `${phone}@c.us`;
const firstId = `green-test-${randomUUID()}`;
const text = "PRUEBA GREEN API CONTROL CENTER";
function payload(idMessage: string, body: string) {
  return {
    typeWebhook: "incomingMessageReceived",
    idMessage,
    timestamp: Math.floor(Date.now() / 1000),
    senderData: { chatId, sender: chatId, senderName: "Prueba GREEN-API" },
    messageData: {
      typeMessage: "textMessage",
      textMessageData: { textMessage: body },
    },
  };
}
async function deliver(body: object) {
  return POST(
    new Request("http://localhost/api/webhooks/green-api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${webhookToken}`,
      },
      body: JSON.stringify(body),
    }),
  );
}
const first = await deliver(payload(firstId, text));
if (first.status !== 200) throw new Error(`Webhook returned ${first.status}`);
const db = getDb();
const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.phone, phone));
const [conversation] = await db
  .select()
  .from(schema.conversations)
  .where(eq(schema.conversations.externalChatId, chatId));
const [message] = await db
  .select()
  .from(schema.messages)
  .where(eq(schema.messages.externalId, firstId));
if (!contact || !conversation || !message) throw new Error("Persistence chain incomplete");
if (
  message.conversationId !== conversation.id ||
  message.direction !== "INBOUND" ||
  message.senderType !== "CUSTOMER" ||
  message.body !== text
)
  throw new Error("Inbound message fields are invalid");
const duplicate = await deliver(payload(firstId, text));
const duplicateBody = (await duplicate.json()) as { data?: { duplicate?: boolean } };
if (!duplicateBody.data?.duplicate) throw new Error("Webhook is not idempotent");

await db
  .update(schema.conversations)
  .set({ agentMode: "HUMAN" })
  .where(eq(schema.conversations.id, conversation.id));
const humanId = `green-test-${randomUUID()}`;
const human = await deliver(payload(humanId, "HUMAN MODE TEST"));
const humanBody = (await human.json()) as { data?: { agent?: string } };
if (humanBody.data?.agent !== "skipped") throw new Error("HUMAN mode activated agent");

const repositoryMessages =
  await repositoryModule.repository.getMessagesByConversationId(conversation.id);
if (repositoryMessages.length !== 2) throw new Error("Repository message count mismatch");

await db.delete(schema.messages).where(eq(schema.messages.conversationId, conversation.id));
await db.delete(schema.conversations).where(eq(schema.conversations.id, conversation.id));
await db.delete(schema.contacts).where(eq(schema.contacts.id, contact.id));
console.log(
  JSON.stringify({
    webhookStatus: first.status,
    inbound: "persisted",
    idempotency: "verified",
    autoMode: "n8n-not-configured",
    humanMode: "agent-skipped",
    repositoryMessages: repositoryMessages.length,
    cleanup: "completed",
  }),
);

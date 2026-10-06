import { config } from "dotenv";
config({ path: ".env.local" });
import { count, eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { activities, contacts, conversations, messages, outreachQueue, prospects } from "../db/schema";
import { handleScoutTestSend } from "../app/api/internal/scout/test-send/route";
import type { WhatsAppProvider } from "../lib/manage/whatsapp";

const db = getDb();
const allowed = "50679990111", blocked = "50679990112", secret = "scout-test-secret";
process.env.SCOUT_TEST_ALLOWED_PHONE = allowed;
process.env.SCOUT_API_SECRET = secret;
let sends = 0;
const provider: WhatsAppProvider = {
  name: "GREEN_API",
  async sendText(phone, message) {
    sends += 1;
    if (phone !== allowed || message !== "Transporte Scout QA") throw new Error("Unexpected provider call");
    return { externalId: "green-scout-transport-qa", raw: { idMessage: "green-scout-transport-qa" } };
  },
  async getStatus() { return { provider: "GREEN_API", configured: true, status: "mock" }; },
};
const request = (phone: unknown) => new Request("http://localhost/api/internal/scout/test-send", {
  method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
  body: JSON.stringify({ phone, message: "Transporte Scout QA" }),
});
async function cleanup() {
  const rows = await db.select().from(contacts).where(eq(contacts.phone, allowed));
  for (const row of rows) await db.delete(conversations).where(eq(conversations.contactId, row.id));
  await db.delete(contacts).where(eq(contacts.phone, allowed));
  await db.delete(activities).where(eq(activities.detail, allowed));
}
await cleanup();
let failure: unknown;
try {
  const [beforeProspects] = await db.select({ value: count() }).from(prospects);
  const [beforeOutreach] = await db.select({ value: count() }).from(outreachQueue);
  const [contact] = await db.insert(contacts).values({ name: "Existing Scout QA", phone: allowed }).returning();
  const [existing] = await db.insert(conversations).values({ contactId: contact.id, externalChatId: `${allowed}@c.us`, agentMode: "AUTO" }).returning();

  const blockedResponse = await handleScoutTestSend(request(blocked), provider);
  const blockedBody = await blockedResponse.json() as { error?: { code?: string } };
  if (blockedResponse.status !== 403 || blockedBody.error?.code !== "TEST_PHONE_NOT_ALLOWED" || sends !== 0)
    throw new Error("Unauthorized phone was not blocked before provider call");

  const arrayResponse = await handleScoutTestSend(request([allowed, blocked]), provider);
  if (arrayResponse.status !== 400 || sends !== 0) throw new Error("Destination array was accepted");
  const emptyResponse = await handleScoutTestSend(request(""), provider);
  if (emptyResponse.status !== 400 || sends !== 0) throw new Error("Empty destination was accepted");

  const response = await handleScoutTestSend(request(allowed), provider);
  const body = await response.json() as { success?: boolean; provider?: string; phone?: string; messageSent?: boolean; externalId?: string };
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, existing.id));
  const [message] = await db.select().from(messages).where(eq(messages.conversationId, existing.id));
  const [afterProspects] = await db.select({ value: count() }).from(prospects);
  const [afterOutreach] = await db.select({ value: count() }).from(outreachQueue);
  if (response.status !== 200 || !body.success || body.provider !== "GREEN_API" || body.phone !== allowed ||
      !body.messageSent || body.externalId !== "green-scout-transport-qa" || Number(sends) !== 1 ||
      conversation.agentMode !== "HUMAN" || message.direction !== "OUTBOUND" || message.senderType !== "AGENT" ||
      message.status !== "SENT" || message.externalId !== "green-scout-transport-qa" ||
      beforeProspects.value !== afterProspects.value || beforeOutreach.value !== afterOutreach.value)
    throw new Error("Scout test-send contract failed");
  console.log(JSON.stringify({ authorized: "one send", unauthorized: "zero sends", existingConversation: "reused",
    mode: conversation.agentMode, message: `${message.direction}/${message.senderType}/${message.status}`,
    prospectsCreated: 0, outreachCreated: 0, providerCalls: sends }));
} catch (error) { failure = error; }
finally { await cleanup(); }
if (failure) { console.error(failure); process.exit(1); }
process.exit(0);

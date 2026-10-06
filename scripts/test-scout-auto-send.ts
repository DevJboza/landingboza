import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, inArray, like, or } from "drizzle-orm";
import { getDb } from "../db/index";
import { activities, contacts, conversations, messages, outreachQueue, prospects, scoutBatches } from "../db/schema";
import { importScoutBatch, ScoutTestModeError, scoutImportSchema } from "../lib/manage/scout";
import type { WhatsAppProvider } from "../lib/manage/whatsapp";

const db = getDb();
const allowedPhone = "50679990001", blockedPhone = "50679990002", normalPhone = "50679990003";
const batches = ["scout-test-2099-11-01-101", "scout-test-2099-11-01-102"];
process.env.SCOUT_TEST_ALLOWED_PHONE = allowedPhone;
let sends = 0;
const provider: WhatsAppProvider = {
  name: "GREEN_API",
  async sendText(destination, message) {
    sends += 1;
    if (destination !== allowedPhone || message !== "Mensaje automático Scout QA") throw new Error("Unexpected test send");
    return { externalId: "scout-test-external-id", raw: { idMessage: "scout-test-external-id" } };
  },
  async getStatus() { return { provider: "GREEN_API", configured: true, status: "mock" }; },
};
const candidate = (name: string, value: string) => ({
  businessName: name, category: "QA", country: "Costa Rica" as const, province: "San José" as const,
  canton: "Pérez Zeledón", city: "San Isidro de El General", address: null, phone: value, whatsapp: value,
  website: null, instagram: null, facebook: null, source: "chatgpt_daily_scout" as const,
  sourceUrls: ["https://example.com/scout-auto-send-test"], score: 90, confidence: 0.99,
  signals: { hasWebsite: false, usesWhatsApp: true, hasBookingSystem: false, hasOnlineStore: false, socialActivity: "unknown" as const },
  opportunity: "Prueba sintética", suggestedServices: ["automatizacion_whatsapp"],
  reasonToContact: "Validar el pipeline", suggestedMessage: "Mensaje automático Scout QA", evidence: [],
});
async function cleanup() {
  const rows = await db.select({ id: contacts.id }).from(contacts).where(inArray(contacts.phone, [allowedPhone, blockedPhone, normalPhone]));
  for (const row of rows) await db.delete(conversations).where(eq(conversations.contactId, row.id));
  await db.delete(contacts).where(inArray(contacts.phone, [allowedPhone, blockedPhone, normalPhone]));
  await db.delete(prospects).where(like(prospects.businessName, "SCOUT AUTO QA%"));
  await db.delete(scoutBatches).where(inArray(scoutBatches.batchId, batches));
  await db.delete(activities).where(or(like(activities.detail, "SCOUT AUTO QA%"), inArray(activities.detail, batches)));
}
await cleanup();
let failure: unknown;
try {
  const normal = scoutImportSchema.parse({ schemaVersion: 1, batchId: batches[0], generatedBy: "chatgpt",
    targetArea: { country: "Costa Rica", province: "San José", canton: "Pérez Zeledón" },
    prospects: [candidate("SCOUT AUTO QA NORMAL", normalPhone)] });
  await importScoutBatch(normal, { whatsappProvider: provider });
  if (sends !== 0) throw new Error("Normal Scout batch sent WhatsApp");
  const [normalProspect] = await db.select().from(prospects).where(eq(prospects.batchId, batches[0]));
  const [normalOutreach] = await db.select().from(outreachQueue).where(eq(outreachQueue.prospectId, normalProspect.id));
  if (normalOutreach.status !== "DRAFT") throw new Error("Normal outreach is not DRAFT");

  const blocked = scoutImportSchema.parse({ ...normal, batchId: "scout-test-2099-11-01-103", testMode: true, autoSend: true,
    prospects: [candidate("SCOUT AUTO QA BLOCKED", blockedPhone)] });
  let blockedCode = "";
  try { await importScoutBatch(blocked, { whatsappProvider: provider }); }
  catch (error) { if (error instanceof ScoutTestModeError) blockedCode = error.code; else throw error; }
  if (blockedCode !== "TEST_PHONE_NOT_ALLOWED" || sends !== 0) throw new Error("Blocked phone was not rejected safely");

  const tooMany = scoutImportSchema.safeParse({ ...normal, batchId: "scout-test-2099-11-01-104", testMode: true, autoSend: true,
    prospects: [candidate("SCOUT AUTO QA MANY 1", allowedPhone), candidate("SCOUT AUTO QA MANY 2", allowedPhone)] });
  if (tooMany.success || !tooMany.error.issues.some((x) => x.path[0] === "prospects")) throw new Error("Multi-prospect autoSend passed validation");

  const allowed = scoutImportSchema.parse({ ...normal, batchId: batches[1], testMode: true, autoSend: true,
    prospects: [candidate("SCOUT AUTO QA ALLOWED", allowedPhone)] });
  const result = await importScoutBatch(allowed, { whatsappProvider: provider });
  const [contact] = await db.select().from(contacts).where(eq(contacts.phone, allowedPhone));
  const [conversation] = await db.select().from(conversations).where(eq(conversations.contactId, contact.id));
  const [message] = await db.select().from(messages).where(eq(messages.conversationId, conversation.id));
  const [prospect] = await db.select().from(prospects).where(eq(prospects.batchId, batches[1]));
  const [outreach] = await db.select().from(outreachQueue).where(eq(outreachQueue.prospectId, prospect.id));
  if (Number(sends) !== 1 || !result.testMessageSent || conversation.agentMode !== "HUMAN" ||
      message.direction !== "OUTBOUND" || message.senderType !== "AGENT" || message.status !== "SENT" || outreach.status !== "SENT")
    throw new Error("Allowed Scout autoSend persistence is invalid");
  console.log(JSON.stringify({ allowedPhone: "sent exactly once", blockedPhone: blockedCode,
    normalBatch: "DRAFT, no send", multipleProspects: "rejected", conversationMode: conversation.agentMode,
    message: `${message.direction}/${message.senderType}/${message.status}`, outreach: outreach.status }));
} catch (error) { failure = error; }
finally { await cleanup(); }
if (failure) { console.error(failure); process.exit(1); }
process.exit(0);

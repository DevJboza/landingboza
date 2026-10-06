import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, inArray, like } from "drizzle-orm";
import { getDb } from "../db/index";
import { activities, contacts, conversations, messages, outreachQueue, prospects } from "../db/schema";
import { approveAndSendScoutProspect, ScoutSendError } from "../lib/manage/scout-outreach";
import type { WhatsAppProvider } from "../lib/manage/whatsapp";

const db = getDb();
const validPhone = "50679990201", failPhone = "50679990202";
let calls = 0;
const provider: WhatsAppProvider = {
  name: "GREEN_API",
  async sendText(phone) { calls += 1; return { externalId: `green-${phone}`, raw: { idMessage: `green-${phone}` } }; },
  async getStatus() { return { provider: "GREEN_API", configured: true, status: "mock" }; },
};
const failingProvider: WhatsAppProvider = {
  ...provider,
  async sendText() { calls += 1; throw new Error("GREEN-API test failure (502)"); },
};
async function createProspect(name: string, phone: string, city = "San Isidro de El General") {
  const [prospect] = await db.insert(prospects).values({ businessName: name, category: "QA", city, phone,
    whatsapp: Boolean(phone), whatsappNumber: phone || null, source: "chatgpt_daily_scout", status: "NEW",
    score: 90, opportunity: "QA", suggestedMessage: "Mensaje final QA" }).returning();
  const [outreach] = await db.insert(outreachQueue).values({ prospectId: prospect.id, message: "Borrador", status: "DRAFT" }).returning();
  return { prospect, outreach };
}
async function cleanup() {
  const contactRows = await db.select().from(contacts).where(inArray(contacts.phone, [validPhone, failPhone]));
  for (const contact of contactRows) await db.delete(conversations).where(eq(conversations.contactId, contact.id));
  await db.delete(contacts).where(inArray(contacts.phone, [validPhone, failPhone]));
  await db.delete(prospects).where(like(prospects.businessName, "SCOUT SEND QA%"));
  await db.delete(activities).where(like(activities.detail, "SCOUT SEND QA%"));
}
await cleanup();
let failure: unknown;
try {
  const [existingContact] = await db.insert(contacts).values({ name: "SCOUT SEND QA CONTACT", phone: validPhone }).returning();
  const [existingConversation] = await db.insert(conversations).values({ contactId: existingContact.id,
    externalChatId: `${validPhone}@c.us`, agentMode: "AUTO" }).returning();
  const valid = await createProspect("SCOUT SEND QA VALID", validPhone);
  const sent = await approveAndSendScoutProspect(valid.prospect.id, "Mensaje final QA", provider);
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, existingConversation.id));
  const [message] = await db.select().from(messages).where(eq(messages.requestId, `scout-outreach:${valid.outreach.id}`));
  const [outreach] = await db.select().from(outreachQueue).where(eq(outreachQueue.id, valid.outreach.id));
  if (calls !== 1 || sent.status !== "SENT" || outreach.status !== "SENT" || !outreach.approvedAt || !outreach.sentAt ||
      conversation.agentMode !== "HUMAN" || message.direction !== "OUTBOUND" || message.senderType !== "AGENT" || message.status !== "SENT")
    throw new Error("Valid approve-and-send flow failed");
  let secondCode = "";
  try { await approveAndSendScoutProspect(valid.prospect.id, "Mensaje final QA", provider); }
  catch (error) { if (error instanceof ScoutSendError) secondCode = error.code; else throw error; }
  if (calls !== 1 || secondCode !== "OUTREACH_ALREADY_SENT") throw new Error("Double send was not blocked");

  const failed = await createProspect("SCOUT SEND QA FAIL", failPhone);
  try { await approveAndSendScoutProspect(failed.prospect.id, "Mensaje final QA", failingProvider); } catch {}
  const [failedOutreach] = await db.select().from(outreachQueue).where(eq(outreachQueue.id, failed.outreach.id));
  if (failedOutreach.status === "SENT") throw new Error("Provider failure marked outreach SENT");

  const excluded = await createProspect("SCOUT SEND QA EXCLUDED", "50679990203", "San Vito");
  const callsBeforeExcluded = calls;
  try { await approveAndSendScoutProspect(excluded.prospect.id, "Mensaje final QA", provider); } catch {}
  if (calls !== callsBeforeExcluded) throw new Error("Excluded prospect reached provider");

  const noPhone = await createProspect("SCOUT SEND QA NO PHONE", "");
  const callsBeforeNoPhone = calls;
  try { await approveAndSendScoutProspect(noPhone.prospect.id, "Mensaje final QA", provider); } catch {}
  if (calls !== callsBeforeNoPhone) throw new Error("Prospect without phone reached provider");
  console.log(JSON.stringify({ draft: "SENT", providerCallsForValid: 1, doubleClick: "blocked",
    existingContact: "reused", existingConversation: "reused/HUMAN", message: "OUTBOUND/AGENT/SENT",
    providerFailure: failedOutreach.status, excluded: "not sent", noPhone: "not sent" }));
} catch (error) { failure = error; }
finally { await cleanup(); }
if (failure) { console.error(failure); process.exit(1); }
process.exit(0);

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: "env.local", override: false });
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { getDb } from "../db/index";
import {
  businesses,
  contacts,
  conversations,
  leads,
  messages,
  prospects,
} from "../db/schema";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is not configured");
const db = getDb(),
  nonce = Date.now(),
  created: {
    prospect?: string;
    lead?: string;
    message?: string;
    conversation?: string;
    contact?: string;
    business?: string;
  } = {};
try {
  const expected = [
    "contacts",
    "businesses",
    "conversations",
    "messages",
    "agent_sessions",
    "prospects",
    "leads",
    "quotes",
    "followups",
    "notes",
    "agent_commands",
    "outreach_queue",
    "activities",
    "agent_settings",
  ];
  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const existing = await client<
    { table_name: string }[]
  >`select table_name from information_schema.tables where table_schema = 'public' and table_name in ${client(expected)}`;
  await client.end();
  const missing = expected.filter(
    (name) => !existing.some((row) => row.table_name === name),
  );
  if (missing.length)
    throw new Error(`Missing database tables: ${missing.join(", ")}`);
  const [prospect] = await db
    .insert(prospects)
    .values({
      businessName: `Persistence QA ${nonce}`,
      category: "QA",
      city: "San Vito",
      phone: `qa-${nonce}`,
      score: 50,
      opportunity: "Verification",
      lastAction: "Created",
      suggestedMessage: "QA",
    })
    .returning();
  created.prospect = prospect.id;
  const [readProspect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospect.id));
  if (!readProspect) throw new Error("Prospect create/read failed");
  await db
    .update(prospects)
    .set({ score: 77 })
    .where(eq(prospects.id, prospect.id));
  const [updatedProspect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospect.id));
  if (updatedProspect.score !== 77)
    throw new Error("Prospect update persistence failed");
  const [contact] = await db
    .insert(contacts)
    .values({ name: "QA Contact", phone: `+506${String(nonce).slice(-8)}` })
    .returning();
  created.contact = contact.id;
  const [business] = await db
    .insert(businesses)
    .values({ name: `QA Business ${nonce}` })
    .returning();
  created.business = business.id;
  const [conversation] = await db
    .insert(conversations)
    .values({
      contactId: contact.id,
      businessId: business.id,
      agentMode: "AUTO",
    })
    .returning();
  created.conversation = conversation.id;
  await db
    .update(conversations)
    .set({ agentMode: "HUMAN" })
    .where(eq(conversations.id, conversation.id));
  const [updatedConversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversation.id));
  if (updatedConversation.agentMode !== "HUMAN")
    throw new Error("Conversation mode persistence failed");
  const [lead] = await db
    .insert(leads)
    .values({
      businessName: business.name,
      contactName: contact.name,
      stage: "NEW",
    })
    .returning();
  created.lead = lead.id;
  await db
    .update(leads)
    .set({ stage: "INTERESTED" })
    .where(eq(leads.id, lead.id));
  const [updatedLead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, lead.id));
  if (updatedLead.stage !== "INTERESTED")
    throw new Error("Lead stage persistence failed");
  const [message] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      direction: "INBOUND",
      senderType: "CONTACT",
      body: "Persistence verification",
      status: "SENT",
    })
    .returning();
  created.message = message.id;
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id));
  if (!history.some((x) => x.id === message.id))
    throw new Error("Message history persistence failed");
  console.log(
    JSON.stringify({
      tables: { expected: 14, found: existing.length, verified: true },
      prospect: "create-read-update-persisted",
      conversation: "auto-human-persisted",
      lead: "new-interested-persisted",
      message: "stored-and-read",
    }),
  );
} finally {
  if (created.message)
    await db.delete(messages).where(eq(messages.id, created.message));
  if (created.lead) await db.delete(leads).where(eq(leads.id, created.lead));
  if (created.conversation)
    await db
      .delete(conversations)
      .where(eq(conversations.id, created.conversation));
  if (created.contact)
    await db.delete(contacts).where(eq(contacts.id, created.contact));
  if (created.business)
    await db.delete(businesses).where(eq(businesses.id, created.business));
  if (created.prospect)
    await db.delete(prospects).where(eq(prospects.id, created.prospect));
  process.exit(0);
}

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { activities, contacts, conversations, messages } from "@/db/schema";
import { getWhatsAppProvider, type WhatsAppProvider } from "./whatsapp";

export const scoutTestSendSchema = z.object({
  phone: z.string().trim().min(1),
  message: z.string().trim().min(1).max(4000),
}).strict();

export class ScoutTestPhoneError extends Error {
  constructor() { super("TEST_PHONE_NOT_ALLOWED"); }
}

const normalizePhone = (value?: string) => {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length === 8 ? `506${digits}` : digits;
};

export async function sendScoutTransportTest(
  input: z.infer<typeof scoutTestSendSchema>,
  provider: WhatsAppProvider = getWhatsAppProvider(),
) {
  const phone = normalizePhone(input.phone);
  const allowed = normalizePhone(process.env.SCOUT_TEST_ALLOWED_PHONE);
  if (!phone || !allowed || phone !== allowed) throw new ScoutTestPhoneError();
  const db = getDb();
  await db.insert(contacts).values({ name: phone, phone }).onConflictDoUpdate({
    target: contacts.phone, set: { updatedAt: new Date() },
  });
  const [contact] = await db.select().from(contacts).where(eq(contacts.phone, phone)).limit(1);
  let [conversation] = await db.select().from(conversations).where(eq(conversations.contactId, contact.id)).limit(1);
  if (!conversation) {
    [conversation] = await db.insert(conversations).values({
      contactId: contact.id, externalChatId: `${phone}@c.us`, status: "ACTIVE", agentMode: "HUMAN",
      lastMessage: input.message, lastMessageAt: new Date(), source: "scout_test_send",
    }).returning();
  } else {
    [conversation] = await db.update(conversations).set({
      agentMode: "HUMAN", status: "ACTIVE", updatedAt: new Date(),
    }).where(eq(conversations.id, conversation.id)).returning();
  }
  const [pending] = await db.insert(messages).values({
    conversationId: conversation.id, direction: "OUTBOUND", senderType: "AGENT",
    body: input.message, status: "PENDING", metadata: { source: "SCOUT_TEST_SEND" },
  }).returning();
  try {
    const sent = await provider.sendText(phone, input.message);
    await db.update(messages).set({ externalId: sent.externalId, status: "SENT" }).where(eq(messages.id, pending.id));
    await db.update(conversations).set({
      agentMode: "HUMAN", status: "ACTIVE", lastMessage: input.message,
      lastMessageAt: new Date(), updatedAt: new Date(),
    }).where(eq(conversations.id, conversation.id));
    await db.insert(activities).values({
      type: "SCOUT_TEST_MESSAGE_SENT", title: "Mensaje Scout de transporte enviado",
      detail: phone, contactId: contact.id, conversationId: conversation.id,
      metadata: { messageId: pending.id, externalId: sent.externalId, provider: provider.name },
    });
    return { provider: provider.name, phone, messageSent: true as const, externalId: sent.externalId };
  } catch (error) {
    await db.update(messages).set({ status: "FAILED" }).where(eq(messages.id, pending.id));
    throw error;
  }
}

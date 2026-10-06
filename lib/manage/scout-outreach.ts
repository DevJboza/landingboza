import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activities, contacts, conversations, messages, outreachQueue,
  prospectExclusions, prospects,
} from "@/db/schema";
import { getWhatsAppProvider, type WhatsAppProvider } from "./whatsapp";

export type ScoutSendErrorCode =
  | "PROSPECT_NOT_FOUND" | "OUTREACH_NOT_FOUND" | "OUTREACH_ALREADY_SENT"
  | "OUTREACH_SEND_IN_PROGRESS" | "OUTREACH_NOT_SENDABLE" | "EXCLUDED_PROSPECT"
  | "INVALID_PHONE" | "ALREADY_CONTACTED" | "PROVIDER_FAILED";
export class ScoutSendError extends Error {
  constructor(public readonly code: ScoutSendErrorCode, public readonly status: number, message: string) {
    super(message);
  }
}
const normalizeText = (value?: string | null) => (value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const normalizePhone = (value?: string | null) => {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length === 8 ? `506${digits}` : digits;
};

export async function approveAndSendScoutProspect(
  prospectId: string,
  finalMessage: string,
  provider: WhatsAppProvider = getWhatsAppProvider(),
) {
  const db = getDb();
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
  if (!prospect) throw new ScoutSendError("PROSPECT_NOT_FOUND", 404, "Prospecto no encontrado");
  const [outreach] = await db.select().from(outreachQueue).where(eq(outreachQueue.prospectId, prospectId)).limit(1);
  if (!outreach) throw new ScoutSendError("OUTREACH_NOT_FOUND", 404, "Outreach no encontrado");
  if (outreach.status === "SENT") throw new ScoutSendError("OUTREACH_ALREADY_SENT", 409, "El outreach ya fue enviado");
  if (!["DRAFT", "APPROVED", "FAILED"].includes(outreach.status))
    throw new ScoutSendError("OUTREACH_NOT_SENDABLE", 409, "El outreach no está disponible para envío");

  const destination = normalizePhone(prospect.whatsappNumber || prospect.phone);
  if (destination.length < 10) throw new ScoutSendError("INVALID_PHONE", 400, "El prospecto no tiene un teléfono válido");
  const exclusions = await db.select().from(prospectExclusions);
  const excluded = exclusions.some((item) => {
    const actual = item.type === "CANTON" ? prospect.canton : item.type === "CITY" ? prospect.city
      : item.type === "BUSINESS_CITY" ? `${prospect.businessName}|${prospect.city}`
      : item.type === "PHONE" ? destination : "";
    return normalizeText(actual) === item.normalizedValue;
  });
  if (excluded) throw new ScoutSendError("EXCLUDED_PROSPECT", 409, "El prospecto está excluido");

  const sentOutreach = await db.select({ prospect: prospects, outreach: outreachQueue }).from(outreachQueue)
    .innerJoin(prospects, eq(outreachQueue.prospectId, prospects.id))
    .where(eq(outreachQueue.status, "SENT"));
  if (sentOutreach.some(({ prospect: other, outreach: otherOutreach }) =>
    otherOutreach.id !== outreach.id && [other.phone, other.whatsappNumber].some((value) => normalizePhone(value) === destination)))
    throw new ScoutSendError("ALREADY_CONTACTED", 409, "Ya se envió outreach a este número");

  const requestId = `scout-outreach:${outreach.id}`;
  const [existingMessage] = await db.select().from(messages).where(eq(messages.requestId, requestId)).limit(1);
  if (existingMessage?.status === "SENT")
    throw new ScoutSendError("OUTREACH_ALREADY_SENT", 409, "El mensaje del outreach ya fue enviado");
  if (existingMessage?.status === "PENDING")
    throw new ScoutSendError("OUTREACH_SEND_IN_PROGRESS", 409, "El envío ya está en proceso");

  await db.insert(contacts).values({ name: prospect.businessName, phone: destination, city: prospect.city })
    .onConflictDoUpdate({ target: contacts.phone, set: { name: prospect.businessName, city: prospect.city, updatedAt: new Date() } });
  const [contact] = await db.select().from(contacts).where(eq(contacts.phone, destination)).limit(1);
  let [conversation] = await db.select().from(conversations).where(eq(conversations.contactId, contact.id)).limit(1);
  if (!conversation) [conversation] = await db.insert(conversations).values({
    contactId: contact.id, externalChatId: `${destination}@c.us`, agentMode: "HUMAN", status: "ACTIVE",
    source: "chatgpt_daily_scout", lastMessage: finalMessage, lastMessageAt: new Date(),
  }).returning();
  else [conversation] = await db.update(conversations).set({ agentMode: "HUMAN", status: "ACTIVE", updatedAt: new Date() })
    .where(eq(conversations.id, conversation.id)).returning();

  let pending: typeof messages.$inferSelect | undefined;
  if (existingMessage?.status === "FAILED") {
    [pending] = await db.update(messages).set({ status: "PENDING", body: finalMessage })
      .where(and(eq(messages.id, existingMessage.id), eq(messages.status, "FAILED"))).returning();
  } else {
    [pending] = await db.insert(messages).values({
      conversationId: conversation.id, requestId, direction: "OUTBOUND", senderType: "AGENT",
      body: finalMessage, status: "PENDING", metadata: { outreachId: outreach.id, prospectId },
    }).onConflictDoNothing({ target: messages.requestId }).returning();
  }
  if (!pending) throw new ScoutSendError("OUTREACH_SEND_IN_PROGRESS", 409, "El envío ya está en proceso");

  const approvedAt = new Date();
  await db.update(outreachQueue).set({ status: "APPROVED", message: finalMessage, approvedAt,
    error: null, updatedAt: approvedAt }).where(eq(outreachQueue.id, outreach.id));
  await db.insert(activities).values({ type: "OUTREACH_APPROVED", title: "Outreach aprobado",
    detail: prospect.businessName, contactId: contact.id, conversationId: conversation.id,
    metadata: { prospectId, outreachId: outreach.id } });
  try {
    const sent = await provider.sendText(destination, finalMessage);
    const sentAt = new Date();
    await db.update(messages).set({ externalId: sent.externalId, status: "SENT", sentAt })
      .where(eq(messages.id, pending.id));
    await db.update(outreachQueue).set({ status: "SENT", externalId: sent.externalId,
      approvedAt, sentAt, error: null, updatedAt: sentAt }).where(eq(outreachQueue.id, outreach.id));
    await db.update(conversations).set({ agentMode: "HUMAN", status: "ACTIVE", lastMessage: finalMessage,
      lastMessageAt: sentAt, updatedAt: sentAt }).where(eq(conversations.id, conversation.id));
    await db.insert(activities).values({ type: "OUTREACH_SENT", title: "Outreach enviado",
      detail: prospect.businessName, contactId: contact.id, conversationId: conversation.id,
      metadata: { prospectId, outreachId: outreach.id, messageId: pending.id } });
    return { prospectId, outreachId: outreach.id, conversationId: conversation.id,
      status: "SENT" as const, provider: provider.name, externalId: sent.externalId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Error del proveedor";
    await db.update(messages).set({ status: "FAILED" }).where(eq(messages.id, pending.id));
    await db.update(outreachQueue).set({ status: "FAILED", error: reason.slice(0, 500), updatedAt: new Date() })
      .where(eq(outreachQueue.id, outreach.id));
    throw new ScoutSendError("PROVIDER_FAILED", 502, reason);
  }
}

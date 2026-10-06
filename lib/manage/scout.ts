import { and, desc, eq, gte, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  activities, businesses, contacts, conversations, leads, messages, outreachQueue,
  prospectExclusions, prospects, scoutBatches,
} from "@/db/schema";
import { getWhatsAppProvider, type WhatsAppProvider } from "./whatsapp";

const nullableUrl = z.string().url().nullable();
export const scoutProspectSchema = z.object({
  businessName: z.string().trim().min(2).max(200),
  category: z.string().trim().min(1).max(120),
  country: z.literal("Costa Rica"),
  province: z.literal("San José"),
  canton: z.string().trim().min(2),
  city: z.string().trim().min(2),
  address: z.string().trim().nullable(),
  phone: z.string().trim().nullable(),
  whatsapp: z.string().trim().nullable(),
  website: nullableUrl,
  instagram: nullableUrl,
  facebook: nullableUrl,
  source: z.literal("chatgpt_daily_scout"),
  sourceUrl: nullableUrl.optional(),
  sourceUrls: z.array(z.string().url()).min(1).max(20),
  score: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  signals: z.object({
    hasWebsite: z.boolean(), usesWhatsApp: z.boolean(), hasBookingSystem: z.boolean(),
    hasOnlineStore: z.boolean(), socialActivity: z.enum(["active", "inactive", "unknown"]),
  }),
  opportunity: z.string().trim().min(1),
  suggestedServices: z.array(z.string().trim().min(1)).max(20),
  reasonToContact: z.string().trim().min(1),
  suggestedMessage: z.string().trim().min(1),
  evidence: z.array(z.object({ claim: z.string().trim().min(1), sourceUrl: z.string().url() })).max(30).optional(),
});

export const scoutImportSchema = z.object({
  schemaVersion: z.literal(1),
  batchId: z.string().regex(
    /^scout-(?:\d{4}-\d{2}-\d{2}-perez|test-\d{4}-\d{2}-\d{2}-\d{3})$/,
    "batchId debe usar scout-YYYY-MM-DD-perez o scout-test-YYYY-MM-DD-NNN",
  ),
  generatedBy: z.literal("chatgpt"),
  targetArea: z.object({
    country: z.literal("Costa Rica"), province: z.literal("San José"), canton: z.literal("Pérez Zeledón"),
  }),
  testMode: z.boolean().optional().default(false),
  autoSend: z.boolean().optional().default(false),
  prospects: z.array(scoutProspectSchema).min(1).max(50),
}).superRefine((value, context) => {
  if (value.autoSend && !value.testMode)
    context.addIssue({ code: "custom", path: ["testMode"], message: "testMode debe ser true cuando autoSend es true" });
  if (value.autoSend && value.prospects.length !== 1)
    context.addIssue({ code: "custom", path: ["prospects"], message: "autoSend permite exactamente un prospecto" });
});

export type ScoutCandidate = z.infer<typeof scoutProspectSchema>;
const normalize = (value?: string | null) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const phone = (value?: string | null) => {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length === 8 ? `506${digits}` : digits;
};
export class ScoutTestModeError extends Error {
  constructor(public readonly code: "TEST_PHONE_NOT_ALLOWED") { super(code); }
}
export function validateScoutTestMode(input: z.infer<typeof scoutImportSchema>) {
  if (!input.autoSend) return;
  const candidatePhone = phone(input.prospects[0]?.whatsapp || input.prospects[0]?.phone);
  const allowedPhone = phone(process.env.SCOUT_TEST_ALLOWED_PHONE);
  if (!input.testMode || !allowedPhone || candidatePhone !== allowedPhone)
    throw new ScoutTestModeError("TEST_PHONE_NOT_ALLOWED");
}
const domain = (value?: string | null) => {
  if (!value) return "";
  try { return new URL(value).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
};

async function eligibility(candidate: Pick<ScoutCandidate, "businessName" | "city" | "canton" | "phone" | "whatsapp" | "website">) {
  const db = getDb();
  const exclusions = await db.select().from(prospectExclusions);
  const excluded = exclusions.some((x) => {
    const actual = x.type === "CANTON" ? candidate.canton : x.type === "CITY" ? candidate.city
      : x.type === "BUSINESS_CITY" ? `${candidate.businessName}|${candidate.city}` : "";
    return normalize(actual) === x.normalizedValue;
  });
  if (excluded) return { eligible: false as const, reason: "EXCLUDED_AREA" as const };
  const numbers = [phone(candidate.phone), phone(candidate.whatsapp)].filter(Boolean);
  const contactRows = await db.select().from(contacts);
  const prospectRows = await db.select().from(prospects);
  const businessRows = await db.select().from(businesses);
  const leadRows = await db.select().from(leads);
  const existingContact = contactRows.find((x) => numbers.includes(phone(x.phone)));
  if (existingContact) {
    const [conversation] = await db.select({ id: conversations.id }).from(conversations)
      .where(eq(conversations.contactId, existingContact.id)).limit(1);
    return { eligible: false as const, reason: conversation ? "ALREADY_CONTACTED" as const : "DUPLICATE" as const };
  }
  const duplicate = prospectRows.find((x) =>
    numbers.includes(phone(x.phone)) || numbers.includes(phone(x.whatsappNumber)) ||
    (domain(candidate.website) && domain(candidate.website) === domain(x.web)) ||
    (normalize(x.businessName) === normalize(candidate.businessName) && normalize(x.city) === normalize(candidate.city)));
  if (duplicate) {
    const [outreach] = await db.select({ id: outreachQueue.id }).from(outreachQueue)
      .where(eq(outreachQueue.prospectId, duplicate.id)).limit(1);
    return { eligible: false as const, reason: outreach ? "ALREADY_CONTACTED" as const : "DUPLICATE" as const };
  }
  if (businessRows.some((x) => (domain(candidate.website) && domain(x.website) === domain(candidate.website)) ||
      (normalize(x.name) === normalize(candidate.businessName) && normalize(x.city) === normalize(candidate.city))) ||
      leadRows.some((x) => normalize(x.businessName) === normalize(candidate.businessName)))
    return { eligible: false as const, reason: "DUPLICATE" as const };
  return { eligible: true as const };
}

export async function checkScoutCandidate(candidate: Pick<ScoutCandidate, "businessName" | "city" | "canton" | "phone" | "whatsapp" | "website">) {
  return eligibility(candidate);
}

export async function importScoutBatch(
  input: z.infer<typeof scoutImportSchema>,
  options: { whatsappProvider?: WhatsAppProvider } = {},
) {
  validateScoutTestMode(input);
  const db = getDb();
  const [existing] = await db.select().from(scoutBatches).where(eq(scoutBatches.batchId, input.batchId)).limit(1);
  if (existing) return { duplicateBatch: true, batchId: input.batchId, accepted: existing.accepted, rejected: existing.rejected, results: existing.results };
  const exclusions = await db.select().from(prospectExclusions);
  const contactRows = await db.select().from(contacts);
  const prospectRows = await db.select().from(prospects);
  const businessRows = await db.select().from(businesses);
  const leadRows = await db.select().from(leads);
  const conversationRows = await db.select({ contactId: conversations.contactId }).from(conversations);
  const outreachRows = await db.select({ prospectId: outreachQueue.prospectId }).from(outreachQueue);
  const contactedIds = new Set(conversationRows.map((x) => x.contactId).filter(Boolean));
  const outreachIds = new Set(outreachRows.map((x) => x.prospectId));
  function decide(candidate: ScoutCandidate): { eligible: boolean; reason?: string } {
    if (candidate.score < 60) return { eligible: false, reason: "BELOW_MINIMUM_SCORE" };
    if (exclusions.some((x) => {
      const actual = x.type === "CANTON" ? candidate.canton : x.type === "CITY" ? candidate.city
        : x.type === "BUSINESS_CITY" ? `${candidate.businessName}|${candidate.city}` : "";
      return normalize(actual) === x.normalizedValue;
    })) return { eligible: false, reason: "EXCLUDED_AREA" };
    const numbers = [phone(candidate.phone), phone(candidate.whatsapp)].filter(Boolean);
    const contact = contactRows.find((x) => numbers.includes(phone(x.phone)));
    if (contact) return { eligible: false, reason: contactedIds.has(contact.id) ? "ALREADY_CONTACTED" : "DUPLICATE" };
    const duplicate = prospectRows.find((x) => numbers.includes(phone(x.phone)) || numbers.includes(phone(x.whatsappNumber)) ||
      (domain(candidate.website) && domain(candidate.website) === domain(x.web)) ||
      (normalize(x.businessName) === normalize(candidate.businessName) && normalize(x.city) === normalize(candidate.city)));
    if (duplicate) return { eligible: false, reason: outreachIds.has(duplicate.id) ? "ALREADY_CONTACTED" : "DUPLICATE" };
    if (businessRows.some((x) => (domain(candidate.website) && domain(x.website) === domain(candidate.website)) ||
        (normalize(x.name) === normalize(candidate.businessName) && normalize(x.city) === normalize(candidate.city))) ||
        leadRows.some((x) => normalize(x.businessName) === normalize(candidate.businessName)))
      return { eligible: false, reason: "DUPLICATE" };
    return { eligible: true };
  }
  const results: { businessName: string; accepted: boolean; reason?: string; prospectId?: string }[] = [];
  const acceptedCandidates: ScoutCandidate[] = [];
  const rejectedActivities: (typeof activities.$inferInsert)[] = [];
  for (const candidate of input.prospects) {
    const duplicateInBatch = acceptedCandidates.some((x) => {
      const candidateNumbers = [phone(candidate.phone), phone(candidate.whatsapp)].filter(Boolean);
      return candidateNumbers.includes(phone(x.phone)) || candidateNumbers.includes(phone(x.whatsapp)) ||
        (domain(candidate.website) && domain(candidate.website) === domain(x.website)) ||
        (normalize(candidate.businessName) === normalize(x.businessName) && normalize(candidate.city) === normalize(x.city));
    });
    const decision = duplicateInBatch ? { eligible: false, reason: "DUPLICATE" } : decide(candidate);
    if (!decision.eligible) {
      results.push({ businessName: candidate.businessName, accepted: false, reason: decision.reason });
      rejectedActivities.push({
        type: decision.reason === "EXCLUDED_AREA" ? "SCOUT_PROSPECT_EXCLUDED" : "SCOUT_PROSPECT_REJECTED",
        title: "Prospecto Scout rechazado", detail: `${candidate.businessName}: ${decision.reason}`,
      });
      continue;
    }
    acceptedCandidates.push(candidate);
  }
  if (rejectedActivities.length) await db.insert(activities).values(rejectedActivities);
  const createdRows = acceptedCandidates.length ? await db.insert(prospects).values(acceptedCandidates.map((candidate) => ({
      businessName: candidate.businessName, category: candidate.category, city: candidate.city,
      phone: phone(candidate.phone), whatsapp: Boolean(candidate.whatsapp), whatsappNumber: phone(candidate.whatsapp),
      web: candidate.website || "", instagram: candidate.instagram || "", facebook: candidate.facebook || "",
      score: candidate.score, opportunity: candidate.opportunity, status: "NEW" as const, lastAction: "Importado por Scout",
      suggestedMessage: candidate.suggestedMessage, source: candidate.source,
      sourceUrl: candidate.sourceUrl || candidate.sourceUrls[0], sourceUrls: candidate.sourceUrls,
      discoveredAt: new Date(), batchId: input.batchId, country: candidate.country, province: candidate.province,
      canton: candidate.canton, address: candidate.address, confidence: String(candidate.confidence),
      signals: candidate.signals, evidence: candidate.evidence || [], suggestedServices: candidate.suggestedServices,
      reasonToContact: candidate.reasonToContact,
    }))).returning() : [];
  let createdOutreach: (typeof outreachQueue.$inferSelect)[] = [];
  if (createdRows.length) {
    createdOutreach = await db.insert(outreachQueue).values(createdRows.map((created, index) => ({
        prospectId: created.id, message: acceptedCandidates[index].suggestedMessage, status: "DRAFT" as const,
      }))).returning();
    await db.insert(activities).values(createdRows.map((created, index) => ({
        type: "SCOUT_PROSPECT_IMPORTED", title: "Prospecto Scout importado",
        detail: acceptedCandidates[index].businessName, metadata: { batchId: input.batchId, prospectId: created.id },
      })));
  }
  createdRows.forEach((created, index) => {
    results.push({ businessName: acceptedCandidates[index].businessName, accepted: true, prospectId: created.id });
  });
  const accepted = results.filter((x) => x.accepted).length;
  let testMessageSent = false;
  if (input.autoSend && accepted === 1) {
    const candidate = acceptedCandidates[0], created = createdRows[0], outreach = createdOutreach[0];
    const destination = phone(candidate.whatsapp || candidate.phone);
    await db.insert(contacts).values({ name: candidate.businessName, phone: destination, city: candidate.city })
      .onConflictDoUpdate({ target: contacts.phone, set: { name: candidate.businessName, city: candidate.city, updatedAt: new Date() } });
    const [contact] = await db.select().from(contacts).where(eq(contacts.phone, destination)).limit(1);
    let [conversation] = await db.select().from(conversations).where(eq(conversations.contactId, contact.id)).limit(1);
    if (!conversation) [conversation] = await db.insert(conversations).values({
      contactId: contact.id, externalChatId: `${destination}@c.us`, agentMode: "HUMAN", status: "ACTIVE",
      lastMessage: candidate.suggestedMessage, lastMessageAt: new Date(), source: "chatgpt_daily_scout",
    }).returning();
    else [conversation] = await db.update(conversations).set({ agentMode: "HUMAN", status: "ACTIVE", updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id)).returning();
    const [pending] = await db.insert(messages).values({ conversationId: conversation.id, direction: "OUTBOUND",
      senderType: "AGENT", body: candidate.suggestedMessage, status: "PENDING",
      metadata: { source: "SCOUT_TEST", batchId: input.batchId, prospectId: created.id } }).returning();
    const sent = await (options.whatsappProvider || getWhatsAppProvider()).sendText(destination, candidate.suggestedMessage);
    await db.update(messages).set({ externalId: sent.externalId, status: "SENT" }).where(eq(messages.id, pending.id));
    await db.update(outreachQueue).set({ status: "SENT", externalId: sent.externalId, updatedAt: new Date() })
      .where(eq(outreachQueue.id, outreach.id));
    await db.insert(activities).values({ type: "SCOUT_TEST_MESSAGE_SENT", title: "Mensaje Scout de prueba enviado",
      detail: candidate.businessName, contactId: contact.id, conversationId: conversation.id,
      metadata: { batchId: input.batchId, prospectId: created.id, outreachId: outreach.id } });
    testMessageSent = true;
  }
  await db.insert(scoutBatches).values({ batchId: input.batchId, generatedBy: input.generatedBy,
    targetArea: input.targetArea, received: input.prospects.length, accepted,
    rejected: results.length - accepted, results });
  await db.insert(activities).values({ type: "SCOUT_BATCH_RECEIVED", title: "Lote Scout recibido",
    detail: input.batchId, metadata: { received: input.prospects.length, accepted } });
  return { duplicateBatch: false, batchId: input.batchId, accepted, rejected: results.length - accepted, results, testMessageSent };
}

export async function scoutDashboard() {
  const db = getDb();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows = await db.select({ prospect: prospects, outreach: outreachQueue }).from(prospects)
      .innerJoin(outreachQueue, eq(outreachQueue.prospectId, prospects.id))
      .where(and(eq(prospects.source, "chatgpt_daily_scout"), ne(prospects.status, "DISCARDED")))
      .orderBy(desc(prospects.discoveredAt));
  const batches = await db.select().from(scoutBatches).where(gte(scoutBatches.createdAt, today)).orderBy(desc(scoutBatches.createdAt));
  return {
    config: { zone: "Pérez Zeledón", dailyTarget: 10, minimumScore: 60 },
    metrics: {
      found: batches.reduce((n, x) => n + x.received, 0), accepted: batches.reduce((n, x) => n + x.accepted, 0),
      rejected: batches.reduce((n, x) => n + x.rejected, 0),
      approved: rows.filter((x) => x.outreach.status === "APPROVED").length,
      contacted: rows.filter((x) => x.outreach.status === "SENT").length,
      replied: rows.filter((x) => x.outreach.status === "REPLIED").length,
    },
    prospects: rows.map(({ prospect: p, outreach: o }) => ({
      id: p.id, businessName: p.businessName, category: p.category, city: p.city,
      phone: p.phone, whatsapp: p.whatsappNumber, website: p.web || null, score: p.score,
      confidence: Number(p.confidence || 0), opportunity: p.opportunity,
      suggestedServices: p.suggestedServices, sourceUrls: p.sourceUrls, evidence: p.evidence,
      suggestedMessage: p.suggestedMessage, outreachStatus: o.status,
    })),
  };
}

export async function excludeScoutProspect(id: string) {
  const db = getDb();
  const [p] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!p) return false;
  const value = `${p.businessName}|${p.city}`;
  await db.insert(prospectExclusions).values({ type: "BUSINESS_CITY", value, normalizedValue: normalize(value), reason: "Excluido desde Control Center" })
    .onConflictDoNothing();
  await db.update(prospects).set({ status: "DISCARDED", updatedAt: new Date() }).where(eq(prospects.id, id));
  await db.update(outreachQueue).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(outreachQueue.prospectId, id));
  return true;
}

export async function discardScoutProspect(id: string) {
  const db = getDb();
  const [p] = await db.select({ id: prospects.id }).from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!p) return false;
  await db.update(prospects).set({ status: "DISCARDED", updatedAt: new Date() }).where(eq(prospects.id, id));
  await db.update(outreachQueue).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(outreachQueue.prospectId, id));
  return true;
}

import { config } from "dotenv";
config({ path: ".env.local" });
import { count, eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { conversations, messages, outreachQueue, prospects, scoutBatches } from "../db/schema";
import { importScoutBatch, scoutImportSchema } from "../lib/manage/scout";

export const exactN8nPayload = {
  schemaVersion: 1,
  batchId: "scout-test-2026-10-06-001",
  generatedBy: "chatgpt",
  targetArea: { country: "Costa Rica", province: "San José", canton: "Pérez Zeledón" },
  prospects: [{
    businessName: "Negocio Scout Prueba", category: "Veterinaria", country: "Costa Rica",
    province: "San José", canton: "Pérez Zeledón", city: "San Isidro de El General",
    address: null, phone: "50670000001", whatsapp: "50670000001", website: "https://example.com",
    instagram: null, facebook: null, source: "chatgpt_daily_scout",
    sourceUrls: ["https://example.com"], score: 85, confidence: 0.95,
    signals: { hasWebsite: true, usesWhatsApp: true, hasBookingSystem: false, hasOnlineStore: false, socialActivity: "unknown" },
    opportunity: "Prospecto sintético utilizado únicamente para validar el pipeline Scout.",
    suggestedServices: ["pagina_web", "automatizacion_whatsapp"],
    reasonToContact: "Registro de prueba del sistema.", suggestedMessage: "Mensaje de prueba. No enviar.",
    evidence: [{ claim: "Prospecto sintético para prueba", sourceUrl: "https://example.com" }],
  }],
};

const result = scoutImportSchema.safeParse(exactN8nPayload);
if (!result.success) {
  console.log(JSON.stringify({ success: false, issues: result.error.issues }, null, 2));
  process.exit(1);
}
const db = getDb();
await db.delete(prospects).where(eq(prospects.businessName, "Negocio Scout Prueba"));
await db.delete(scoutBatches).where(eq(scoutBatches.batchId, exactN8nPayload.batchId));
const [beforeConversations] = await db.select({ value: count() }).from(conversations);
const [beforeMessages] = await db.select({ value: count() }).from(messages);
let failure: unknown;
try {
  const imported = await importScoutBatch(result.data);
  const [prospect] = await db.select().from(prospects).where(eq(prospects.batchId, exactN8nPayload.batchId));
  const [outreach] = prospect
    ? await db.select().from(outreachQueue).where(eq(outreachQueue.prospectId, prospect.id)) : [];
  const [afterConversations] = await db.select({ value: count() }).from(conversations);
  const [afterMessages] = await db.select({ value: count() }).from(messages);
  if (imported.accepted !== 1 || imported.rejected !== 0 || !prospect || outreach?.status !== "DRAFT" ||
      beforeConversations.value !== afterConversations.value || beforeMessages.value !== afterMessages.value)
    throw new Error("Exact n8n payload did not satisfy the Scout persistence contract");
  console.log(JSON.stringify({ safeParse: "success", accepted: imported.accepted, rejected: imported.rejected,
    prospect: "created", outreach: "DRAFT", conversation: "not created", whatsapp: "not sent" }));
} catch (error) {
  failure = error;
} finally {
  await db.delete(prospects).where(eq(prospects.businessName, "Negocio Scout Prueba"));
  await db.delete(scoutBatches).where(eq(scoutBatches.batchId, exactN8nPayload.batchId));
}
if (failure) { console.error(failure); process.exit(1); }
process.exit(0);

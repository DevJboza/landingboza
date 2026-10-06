import { config } from "dotenv";
config({ path: ".env.local" });
import { count, eq, like } from "drizzle-orm";
import { getDb } from "../db/index";
import { activities, businesses, contacts, conversations, messages, prospects, scoutBatches } from "../db/schema";
import { checkScoutCandidate, importScoutBatch, scoutImportSchema } from "../lib/manage/scout";
import { POST as importEndpoint } from "../app/api/internal/scout/prospects/import/route";

const db = getDb();
const nonce = String(Date.now()).slice(-8);
const batchId = "scout-2099-12-28-perez";
const [beforeMessages] = await db.select({ value: count() }).from(messages);
const [beforeConversations] = await db.select({ value: count() }).from(conversations);
const candidate = (index: number, city = "San Isidro de El General", canton = "Pérez Zeledón") => ({
  businessName: `SCOUT QA ${nonce} ${index}`, category: "Servicios", country: "Costa Rica" as const,
  province: "San José" as const, canton, city, address: null,
  phone: `5068${nonce.slice(1, 7)}${index}`, whatsapp: null, website: `https://qa-${nonce}-${index}.example.com`,
  instagram: null, facebook: null, source: "chatgpt_daily_scout" as const,
  sourceUrls: [`https://example.com/scout-source-${nonce}-${index}`], score: 75 + index,
  confidence: 0.9, signals: { hasWebsite: true, usesWhatsApp: false, hasBookingSystem: false,
    hasOnlineStore: false, socialActivity: "active" as const }, opportunity: "Oportunidad pública verificable",
  suggestedServices: ["pagina_web"], reasonToContact: "Oportunidad de mejora digital",
  suggestedMessage: "Mensaje sintético de prueba", evidence: [],
});

await db.delete(prospects).where(like(prospects.businessName, "SCOUT QA %"));
await db.delete(scoutBatches).where(eq(scoutBatches.batchId, batchId));
const payload = scoutImportSchema.parse({ schemaVersion: 1, batchId, generatedBy: "chatgpt",
  targetArea: { country: "Costa Rica", province: "San José", canton: "Pérez Zeledón" },
  prospects: Array.from({ length: 10 }, (_, i) => candidate(i)),
});
try {
  const imported = await importScoutBatch(payload);
  if (imported.accepted !== 10 || imported.rejected !== 0) throw new Error("Ten valid prospects were not accepted");
  const sanVito = await checkScoutCandidate(candidate(20, "San Vito"));
  const cotoBrus = await checkScoutCandidate(candidate(21, "Agua Buena", "Coto Brus"));
  if (sanVito.reason !== "EXCLUDED_AREA" || cotoBrus.reason !== "EXCLUDED_AREA") throw new Error("Geographic exclusions failed");

  const duplicateBatch = await importScoutBatch(payload);
  if (!duplicateBatch.duplicateBatch || duplicateBatch.accepted !== 10) throw new Error("Batch idempotency failed");
  process.env.SCOUT_API_SECRET = `qa-${nonce}`;
  const unauthorized = await importEndpoint(new Request("http://localhost/api/internal/scout/prospects/import", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  }));
  if (unauthorized.status !== 401) throw new Error("Scout endpoint accepted an unauthenticated request");
  const apiResponse = await importEndpoint(new Request("http://localhost/api/internal/scout/prospects/import", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer qa-${nonce}` }, body: JSON.stringify(payload),
  }));
  if (apiResponse.status !== 201) throw new Error(`Scout endpoint returned ${apiResponse.status}`);

  const existingPhone = `5067${nonce.slice(1)}`;
  const [contact] = await db.insert(contacts).values({ name: `SCOUT QA ${nonce}`, phone: existingPhone }).returning();
  const phoneResult = await checkScoutCandidate({ ...candidate(30), phone: existingPhone });
  if (phoneResult.reason !== "DUPLICATE") throw new Error("Phone deduplication failed");
  const whatsappResult = await checkScoutCandidate({ ...candidate(32), phone: null, whatsapp: existingPhone });
  if (whatsappResult.reason !== "DUPLICATE") throw new Error("WhatsApp deduplication failed");
  await db.delete(contacts).where(eq(contacts.id, contact.id));

  const [business] = await db.insert(businesses).values({ name: `SCOUT Domain QA ${nonce}`, website: `https://domain-${nonce}.example.com` }).returning();
  const domainResult = await checkScoutCandidate({ ...candidate(31), website: `https://domain-${nonce}.example.com/path` });
  if (domainResult.reason !== "DUPLICATE") throw new Error("Domain deduplication failed");
  await db.delete(businesses).where(eq(businesses.id, business.id));

  const contactedResult = await checkScoutCandidate(candidate(0));
  if (contactedResult.reason !== "ALREADY_CONTACTED") throw new Error("Previous outreach was not detected");
  const [afterMessages] = await db.select({ value: count() }).from(messages);
  const [afterConversations] = await db.select({ value: count() }).from(conversations);
  if (afterMessages.value !== beforeMessages.value || afterConversations.value !== beforeConversations.value)
    throw new Error("Scout import created messages or conversations");
  console.log(JSON.stringify({ perezZeledon: "10 accepted", sanVito: sanVito.reason,
    cotoBrus: cotoBrus.reason, phoneDuplicate: phoneResult.reason, whatsappDuplicate: whatsappResult.reason, domainDuplicate: domainResult.reason,
    priorOutreach: contactedResult.reason, duplicateBatch: "idempotent", whatsappSent: false }));
} finally {
  await db.delete(prospects).where(like(prospects.businessName, "SCOUT QA %"));
  await db.delete(scoutBatches).where(eq(scoutBatches.batchId, batchId));
  await db.delete(activities).where(like(activities.detail, "SCOUT QA %"));
  process.exit(0);
}

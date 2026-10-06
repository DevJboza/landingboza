import { config } from "dotenv";
config({ path: ".env.local" });
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/index";
import { messages, outreachQueue, prospects } from "../db/schema";

const db = getDb();
const unsent = await db.select({ id: outreachQueue.id }).from(outreachQueue)
  .innerJoin(prospects, eq(outreachQueue.prospectId, prospects.id))
  .where(and(
    eq(prospects.source, "chatgpt_daily_scout"),
    inArray(outreachQueue.status, ["APPROVED", "FAILED"]),
    isNull(outreachQueue.sentAt),
    isNull(outreachQueue.externalId),
  ));
if (unsent.length) {
  const requestIds = unsent.map((item) => `scout-outreach:${item.id}`);
  await db.delete(messages).where(and(
    inArray(messages.requestId, requestIds),
    inArray(messages.status, ["PENDING", "FAILED"]),
  ));
  await db.update(outreachQueue).set({
    status: "DRAFT", approvedAt: null, sentAt: null, error: null, updatedAt: new Date(),
  }).where(inArray(outreachQueue.id, unsent.map((item) => item.id)));
}
console.log(JSON.stringify({ resetToDraft: unsent.length, sentRowsTouched: 0 }));
process.exit(0);

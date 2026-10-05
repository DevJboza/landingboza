import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { activities, contacts, conversations } from "@/db/schema";
import { fail, ok } from "@/lib/manage/api";
import { authorizeInternal } from "@/lib/manage/internal-auth";
export const runtime = "nodejs";
const schema = z.object({
  phone: z.string().min(5).max(30),
  type: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  detail: z.string().max(1000).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});
export async function POST(request: Request) {
  if (!authorizeInternal(request))
    return fail("UNAUTHORIZED", "Autenticación requerida", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_PAYLOAD", "Payload inválido", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Payload inválido", 400);
  const db = getDb();
  const [row] = await db
    .select({ contact: contacts, conversation: conversations })
    .from(contacts)
    .leftJoin(conversations, eq(conversations.contactId, contacts.id))
    .where(eq(contacts.phone, parsed.data.phone))
    .limit(1);
  const [activity] = await db
    .insert(activities)
    .values({
      type: parsed.data.type,
      title: parsed.data.title,
      detail: parsed.data.detail || "",
      contactId: row?.contact.id,
      conversationId: row?.conversation?.id,
      metadata: parsed.data.context || {},
    })
    .returning({ id: activities.id, createdAt: activities.createdAt });
  return ok(activity, 201);
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { activities, contacts, conversations, messages } from "@/db/schema";
import { fail, ok } from "@/lib/manage/api";

export const runtime = "nodejs";
const item = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  type: z.string().optional(),
  chat_id: z.union([z.string(), z.number()]).optional(),
  from_me: z.boolean().default(false),
  timestamp: z.union([z.number(), z.string()]).optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  phone: z.string().optional(),
  from_name: z.string().optional(),
  text: z.object({ body: z.string() }),
});
const payload = z.object({
  body: z.object({ messages: z.array(item).min(1) }),
});
let discoveredSecret: string | null = null;

async function webhookSecret() {
  if (process.env.WASENDER_WEBHOOK_SECRET)
    return process.env.WASENDER_WEBHOOK_SECRET;
  if (discoveredSecret) return discoveredSecret;
  const token = process.env.WASENDER_API_TOKEN;
  if (!token) return null;
  const baseUrl = (
    process.env.WASENDER_API_URL || "https://api.wasender.dev"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const settings = (await response.json()) as {
      webhooks?: Array<{ secret?: unknown }>;
    };
    const secret = settings.webhooks?.find(
      (webhook) =>
        typeof webhook.secret === "string" && webhook.secret.length > 0,
    )?.secret;
    if (typeof secret !== "string") return null;
    discoveredSecret = secret;
    return discoveredSecret;
  } catch {
    return null;
  }
}
function safeSignature(raw: string, given: string, secret: string) {
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const normalized = given.replace(/^sha256=/i, "");
  const a = Buffer.from(normalized),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizePhone(value: string) {
  return value.replace(/@.*$/, "").replace(/\D/g, "");
}

function messageDate(value?: string | number) {
  if (value === undefined) return new Date();
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return new Date();
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function POST(request: Request) {
  const secret = await webhookSecret();
  if (!secret) return fail("NOT_CONFIGURED", "Webhook no configurado", 503);
  const raw = await request.text();
  const signature = request.headers.get("x-wasender-signature") || "";
  if (!safeSignature(raw, signature, secret))
    return fail("INVALID_SIGNATURE", "Firma inválida", 401);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("INVALID_PAYLOAD", "Payload inválido", 400);
  }
  const parsed = payload.safeParse(body);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Payload inválido", 400);
  const db = getDb();
  let accepted = 0,
    duplicates = 0;
  for (const event of parsed.data.body.messages) {
    console.info("[WaSender webhook] message received", {
      externalId: event.id,
      direction: event.from_me ? "OUTBOUND" : "INBOUND",
    });
    const existing = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.externalId, event.id))
      .limit(1);
    if (existing.length) {
      duplicates++;
      continue;
    }
    const phone = normalizePhone(event.phone || event.from || "");
    if (!phone) continue;
    await db
      .insert(contacts)
      .values({ name: event.from_name || phone, phone })
      .onConflictDoNothing({ target: contacts.phone });
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.phone, phone))
      .limit(1);
    console.info("[DB] contact found/created", { contactId: contact.id });
    const externalChatId = event.chat_id ? String(event.chat_id) : null;
    let [conversation] = await db
      .select()
      .from(conversations)
      .where(
        externalChatId
          ? or(
              eq(conversations.externalChatId, externalChatId),
              eq(conversations.contactId, contact.id),
            )
          : eq(conversations.contactId, contact.id),
      )
      .limit(1);
    if (!conversation) {
      [conversation] = await db
        .insert(conversations)
        .values({
          contactId: contact.id,
          externalChatId,
          status: "ACTIVE",
          agentMode: "AUTO",
          lastMessage: event.text.body,
          lastMessageAt: messageDate(event.timestamp),
        })
        .returning();
    } else if (externalChatId && conversation.externalChatId !== externalChatId) {
      [conversation] = await db
        .update(conversations)
        .set({ externalChatId, updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id))
        .returning();
    }
    console.info("[DB] conversation found/created", {
      conversationId: conversation.id,
    });
    const sentAt = messageDate(event.timestamp);
    const inserted = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        externalId: event.id,
        direction: event.from_me ? "OUTBOUND" : "INBOUND",
        senderType: event.from_me ? "AGENT" : "CUSTOMER",
        body: event.text.body,
        status:
          event.status === "read"
            ? "READ"
            : event.status === "delivered"
              ? "DELIVERED"
              : "SENT",
        sentAt,
      })
      .onConflictDoNothing({ target: messages.externalId })
      .returning({ id: messages.id });
    if (!inserted.length) {
      duplicates++;
      continue;
    }
    console.info("[DB] message inserted", {
      messageId: inserted[0].id,
      conversationId: conversation.id,
    });
    await db
      .update(conversations)
      .set({
        lastMessage: event.text.body,
        lastMessageAt: sentAt,
        status: "ACTIVE",
        unreadCount: event.from_me
          ? conversation.unreadCount
          : conversation.unreadCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id));
    await db
      .insert(activities)
      .values({
        type: event.from_me ? "message.outbound" : "message.inbound",
        title: event.from_me ? "Mensaje enviado" : "Cliente respondió",
        detail: event.from_name || phone,
        contactId: contact.id,
        conversationId: conversation.id,
      });
    accepted++;
  }
  return ok({ accepted, duplicates });
}
export function GET() {
  return fail("METHOD_NOT_ALLOWED", "Método no permitido", 405);
}

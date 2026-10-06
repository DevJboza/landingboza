import { timingSafeEqual } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { activities, contacts, conversations, messages } from "@/db/schema";
import { fail, ok } from "@/lib/manage/api";

export const runtime = "nodejs";

const webhook = z
  .object({
    typeWebhook: z.string(),
    idMessage: z.string().optional(),
    timestamp: z.union([z.number(), z.string()]).optional(),
    status: z.string().optional(),
    senderData: z
      .object({
        chatId: z.string(),
        sender: z.string().optional(),
        senderName: z.string().optional(),
        senderContactName: z.string().optional(),
        chatName: z.string().optional(),
      })
      .optional(),
    messageData: z
      .object({
        typeMessage: z.string().optional(),
        textMessageData: z.object({ textMessage: z.string() }).optional(),
        extendedTextMessageData: z
          .object({ text: z.string().optional(), textMessage: z.string().optional() })
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function authorized(request: Request) {
  const secret = process.env.GREEN_API_WEBHOOK_TOKEN;
  if (!secret) return false;
  const supplied = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const expected = Buffer.from(secret.replace(/^Bearer\s+/i, ""));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function eventDate(value?: string | number) {
  const numeric = Number(value);
  const date = new Date(
    Number.isFinite(numeric) ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric) : Date.now(),
  );
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function messageText(data: z.infer<typeof webhook>["messageData"]) {
  return (
    data?.textMessageData?.textMessage ||
    data?.extendedTextMessageData?.text ||
    data?.extendedTextMessageData?.textMessage ||
    (data?.typeMessage ? `[${data.typeMessage}]` : "[mensaje no compatible]")
  );
}

function messageStatus(value?: string) {
  const status = value?.toLowerCase();
  if (status === "read") return "READ" as const;
  if (status === "delivered") return "DELIVERED" as const;
  if (status === "failed" || status === "notdelivered") return "FAILED" as const;
  return "SENT" as const;
}

async function forwardToAgent(payload: unknown) {
  const url = process.env.N8N_AGENT_WEBHOOK_URL;
  if (!url) return "not configured" as const;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-boza-secret": secret } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`n8n forward failed (${response.status})`);
  return "forwarded" as const;
}

export async function POST(request: Request) {
  if (!process.env.GREEN_API_WEBHOOK_TOKEN)
    return fail("NOT_CONFIGURED", "Webhook no configurado", 503);
  if (!authorized(request)) return fail("UNAUTHORIZED", "Acceso denegado", 401);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("INVALID_PAYLOAD", "Payload inválido", 400);
  }
  const parsed = webhook.safeParse(raw);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Payload inválido", 400);
  const event = parsed.data;
  const db = getDb();

  if (
    ["outgoingAPIMessageReceived", "outgoingMessageReceived", "outgoingMessageStatus"].includes(
      event.typeWebhook,
    )
  ) {
    if (event.idMessage)
      await db
        .update(messages)
        .set({ status: messageStatus(event.status) })
        .where(eq(messages.externalId, event.idMessage));
    return ok({ accepted: true, type: event.typeWebhook });
  }

  if (event.typeWebhook !== "incomingMessageReceived")
    return ok({ accepted: true, ignored: event.typeWebhook });
  if (!event.idMessage || !event.senderData)
    return fail("INVALID_PAYLOAD", "Mensaje incompleto", 400);
  const chatId = event.senderData.chatId;
  if (chatId.endsWith("@g.us")) return ok({ accepted: true, ignored: "group" });
  const phone = (event.senderData.sender || chatId)
    .replace(/@.*$/, "")
    .replace(/\D/g, "");
  if (!phone) return fail("INVALID_PAYLOAD", "Remitente inválido", 400);

  const duplicate = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.externalId, event.idMessage))
    .limit(1);
  if (duplicate.length) return ok({ accepted: true, duplicate: true });

  const name =
    event.senderData.senderContactName ||
    event.senderData.senderName ||
    event.senderData.chatName ||
    phone;
  await db
    .insert(contacts)
    .values({ name, phone })
    .onConflictDoUpdate({ target: contacts.phone, set: { name, updatedAt: new Date() } });
  const [contact] = await db.select().from(contacts).where(eq(contacts.phone, phone)).limit(1);
  let [conversation] = await db
    .select()
    .from(conversations)
    .where(
      or(
        eq(conversations.externalChatId, chatId),
        eq(conversations.contactId, contact.id),
      ),
    )
    .limit(1);
  const text = messageText(event.messageData);
  const sentAt = eventDate(event.timestamp);
  if (!conversation) {
    [conversation] = await db
      .insert(conversations)
      .values({
        contactId: contact.id,
        externalChatId: chatId,
        status: "ACTIVE",
        agentMode: "AUTO",
        lastMessage: text,
        lastMessageAt: sentAt,
      })
      .returning();
  } else if (conversation.externalChatId !== chatId) {
    [conversation] = await db
      .update(conversations)
      .set({ externalChatId: chatId, updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id))
      .returning();
  }
  const inserted = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      externalId: event.idMessage,
      direction: "INBOUND",
      senderType: "CUSTOMER",
      body: text,
      status: "DELIVERED",
      sentAt,
      metadata: { provider: "GREEN_API", typeMessage: event.messageData?.typeMessage },
    })
    .onConflictDoNothing({ target: messages.externalId })
    .returning({ id: messages.id });
  if (!inserted.length) return ok({ accepted: true, duplicate: true });
  await Promise.all([
    db
      .update(conversations)
      .set({
        lastMessage: text,
        lastMessageAt: sentAt,
        unreadCount: conversation.unreadCount + 1,
        status: conversation.status === "CLOSED" ? "CLOSED" : "ACTIVE",
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id)),
    db.insert(activities).values({
      type: "message.inbound",
      title: "Cliente respondió",
      detail: name,
      contactId: contact.id,
      conversationId: conversation.id,
    }),
  ]);

  let agent = "skipped";
  if (conversation.agentMode === "AUTO") {
    try {
      agent = await forwardToAgent(raw);
    } catch {
      agent = "error";
    }
  }
  console.info("[GREEN-API webhook] message persisted", {
    messageId: inserted[0].id,
    conversationId: conversation.id,
    agent,
  });
  return ok({ accepted: true, duplicate: false, agent });
}

export function GET() {
  return fail("METHOD_NOT_ALLOWED", "Método no permitido", 405);
}

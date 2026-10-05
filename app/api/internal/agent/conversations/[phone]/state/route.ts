import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  agentSessions,
  agentSettings,
  contacts,
  conversations,
} from "@/db/schema";
import { fail, ok } from "@/lib/manage/api";
import { authorizeInternal } from "@/lib/manage/internal-auth";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> },
) {
  if (!authorizeInternal(request))
    return fail("UNAUTHORIZED", "Autenticación requerida", 401);
  const { phone } = await params,
    db = getDb();
  const [row] = await db
    .select({ conversation: conversations })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(eq(contacts.phone, decodeURIComponent(phone)))
    .limit(1);
  const [settings] = await db
    .select()
    .from(agentSettings)
    .where(eq(agentSettings.id, "default"))
    .limit(1);
  if (!row)
    return ok({
      mode: "AUTO",
      conversationId: null,
      agentEnabled: settings?.agentEnabled ?? true,
      session: { active: false },
    });
  const [session] = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.conversationId, row.conversation.id))
    .limit(1);
  return ok({
    mode: row.conversation.agentMode,
    conversationId: row.conversation.id,
    agentEnabled: settings?.agentEnabled ?? true,
    session: { active: session?.active ?? false },
  });
}

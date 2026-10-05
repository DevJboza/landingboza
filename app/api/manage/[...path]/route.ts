import { z } from "zod";
import { fail, ok, requireApiSession, validOrigin } from "@/lib/manage/api";
import { repository } from "@/lib/manage/repository";
import type { AgentMode, LeadStatus } from "@/lib/manage/types";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
const bodySchema = z.object({ body: z.string().trim().min(1).max(4000) });
const prospectSchema = z.object({
  business: z.string().min(2),
  category: z.string(),
  city: z.string(),
  phone: z.string(),
  whatsapp: z.boolean(),
  web: z.string(),
  instagram: z.string(),
  facebook: z.string(),
  score: z.number().min(0).max(100),
  opportunity: z.string(),
  status: z.enum([
    "NEW",
    "PRIORITY",
    "CONTACTED",
    "REPLIED",
    "INTERESTED",
    "DISCARDED",
  ]),
  lastAction: z.string(),
  problems: z.array(z.string()),
  suggestedMessage: z.string(),
});
async function auth() {
  return requireApiSession();
}
export async function GET(_: Request, context: Context) {
  const denied = await auth();
  if (denied) return denied;
  const p = (await context.params).path;
  if (p[0] === "dashboard") return ok(repository.dashboard());
  if (p[0] === "conversations")
    return ok(
      p[1] ? repository.conversation(p[1]) : repository.conversations(),
    );
  if (p[0] === "prospects")
    return ok(p[1] ? repository.prospect(p[1]) : repository.prospects());
  if (p[0] === "leads") return ok(repository.leads());
  if (p[0] === "quotes") return ok(repository.quotes());
  if (p[0] === "followups") return ok(repository.followups());
  if (p[0] === "outreach") return ok(repository.outreach());
  if (p[0] === "agent" && p[1] === "status") return ok(repository.agent());
  return fail("NOT_FOUND", "Recurso no encontrado", 404);
}
export async function POST(request: Request, context: Context) {
  const denied = await auth();
  if (denied) return denied;
  if (!validOrigin(request))
    return fail("INVALID_ORIGIN", "Solicitud rechazada", 403);
  const p = (await context.params).path;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  if (p[0] === "conversations" && p[1] && p[2] === "message") {
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success)
      return fail("INVALID_PAYLOAD", "Mensaje inválido", 400);
    return ok(repository.sendMessage(p[1], parsed.data.body));
  }
  if (
    p[0] === "conversations" &&
    p[1] &&
    ["take", "release", "pause", "close"].includes(p[2])
  ) {
    const modes: Record<string, AgentMode> = {
      take: "HUMAN",
      release: "AUTO",
      pause: "PAUSED",
      close: "CLOSED",
    };
    const result = repository.setMode(p[1], modes[p[2]]);
    if (!result) return fail("NOT_FOUND", "Conversación no encontrada", 404);
    const command = {
      take: "take_conversation",
      release: "release_conversation",
      pause: "pause_agent",
      close: "close_session",
    } as const;
    repository.command(command[p[2] as keyof typeof command], p[1]);
    return ok(result);
  }
  if (p[0] === "prospects") {
    const parsed = prospectSchema.safeParse(json);
    return parsed.success
      ? ok(repository.createProspect(parsed.data), 201)
      : fail("INVALID_PAYLOAD", "Prospecto inválido", 400);
  }
  if (p[0] === "outreach" && p[1] && p[2] === "approve")
    return ok(repository.approveOutreach(p[1]));
  if (p[0] === "agent" && ["pause", "resume"].includes(p[1])) {
    repository.command(
      p[1] === "pause" ? "pause_agent" : "resume_agent",
      "global",
    );
    return ok(repository.setAgent(p[1] === "resume"));
  }
  if (p[0] === "quotes")
    return ok(
      repository.createQuote(
        json as Parameters<typeof repository.createQuote>[0],
      ),
      201,
    );
  if (p[0] === "followups")
    return ok(
      repository.createFollowup(
        json as Parameters<typeof repository.createFollowup>[0],
      ),
      201,
    );
  return fail("NOT_FOUND", "Acción no encontrada", 404);
}
export async function PATCH(request: Request, context: Context) {
  const denied = await auth();
  if (denied) return denied;
  if (!validOrigin(request))
    return fail("INVALID_ORIGIN", "Solicitud rechazada", 403);
  const p = (await context.params).path;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("INVALID_PAYLOAD", "Datos inválidos", 400);
  }
  if (p[0] === "prospects" && p[1])
    return ok(repository.updateProspect(p[1], json as object));
  if (p[0] === "leads" && p[1]) {
    const parsed = z
      .object({
        stage: z.enum([
          "NEW",
          "CONTACTED",
          "REPLIED",
          "INTERESTED",
          "QUALIFIED",
          "QUOTE",
          "MEETING",
          "WON",
          "LOST",
        ]),
      })
      .safeParse(json);
    return parsed.success
      ? ok(repository.updateLead(p[1], parsed.data.stage as LeadStatus))
      : fail("INVALID_PAYLOAD", "Etapa inválida", 400);
  }
  return fail("NOT_FOUND", "Acción no encontrada", 404);
}

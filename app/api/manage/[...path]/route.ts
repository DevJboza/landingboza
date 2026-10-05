import { z } from "zod";
import { checkDatabase } from "@/db";
import { fail, ok, requireApiSession, validOrigin } from "@/lib/manage/api";
import { getWhatsAppStatus } from "@/lib/manage/integrations";
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
const settingsSchema = z.object({
  sessionTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
  reminderMinutes: z.number().int().min(1).max(1440).optional(),
  autoReply: z.boolean().optional(),
  aiFallback: z.boolean().optional(),
  outOfHoursEnabled: z.boolean().optional(),
});
async function json(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function GET(_: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const p = (await context.params).path;
  if (p[0] === "dashboard") return ok(await repository.dashboard());
  if (p[0] === "conversations")
    return ok(
      p[1]
        ? await repository.conversation(p[1])
        : await repository.conversations(),
    );
  if (p[0] === "prospects")
    return ok(
      p[1] ? await repository.prospect(p[1]) : await repository.prospects(),
    );
  if (p[0] === "leads") return ok(await repository.leads());
  if (p[0] === "quotes") return ok(await repository.quotes());
  if (p[0] === "followups") return ok(await repository.followups());
  if (p[0] === "outreach") return ok(await repository.outreach());
  if (p[0] === "agent" && p[1] === "status")
    return ok(await repository.agent());
  if (p[0] === "system" && p[1] === "health") {
    let database: "connected" | "error" = "error";
    try {
      if (await checkDatabase()) database = "connected";
    } catch {}
    let wasender: "configured" | "unconfigured" | "error" = process.env.WASENDER_API_TOKEN ? "configured" : "unconfigured";
    if (wasender === "configured") {
      try { await getWhatsAppStatus(); } catch { wasender = "error"; }
    }
    return ok({
      database,
      wasender,
      n8n:
        process.env.N8N_BASE_URL && process.env.N8N_API_KEY
          ? "configured"
          : "unconfigured",
      openrouter: process.env.OPENROUTER_API_KEY
        ? "configured"
        : "unconfigured",
    });
  }
  return fail("NOT_FOUND", "Recurso no encontrado", 404);
}

export async function POST(request: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  if (!validOrigin(request))
    return fail("INVALID_ORIGIN", "Solicitud rechazada", 403);
  const p = (await context.params).path,
    data = await json(request);
  if (p[0] === "conversations" && p[1] && p[2] === "message") {
    const parsed = bodySchema.safeParse(data);
    if (!parsed.success)
      return fail("INVALID_PAYLOAD", "Mensaje inválido", 400);
    try {
      return ok(await repository.sendMessage(p[1], parsed.data.body));
    } catch {
      return fail("MESSAGE_FAILED", "No fue posible enviar el mensaje", 502);
    }
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
    const result = await repository.setMode(p[1], modes[p[2]]);
    return result
      ? ok(result)
      : fail("NOT_FOUND", "Conversación no encontrada", 404);
  }
  if (p[0] === "prospects") {
    const parsed = prospectSchema.safeParse(data);
    return parsed.success
      ? ok(await repository.createProspect(parsed.data), 201)
      : fail("INVALID_PAYLOAD", "Prospecto inválido", 400);
  }
  if (p[0] === "outreach" && p[1] && p[2] === "approve")
    return ok(await repository.approveOutreach(p[1]));
  if (p[0] === "agent" && ["pause", "resume"].includes(p[1]))
    return ok(await repository.setAgent(p[1] === "resume"));
  if (p[0] === "quotes")
    return ok(
      await repository.createQuote(
        data as Parameters<typeof repository.createQuote>[0],
      ),
      201,
    );
  if (p[0] === "followups")
    return ok(
      await repository.createFollowup(
        data as Parameters<typeof repository.createFollowup>[0],
      ),
      201,
    );
  return fail("NOT_FOUND", "Acción no encontrada", 404);
}

export async function PATCH(request: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  if (!validOrigin(request))
    return fail("INVALID_ORIGIN", "Solicitud rechazada", 403);
  const p = (await context.params).path,
    data = await json(request);
  if (p[0] === "prospects" && p[1])
    return ok(
      await repository.updateProspect(
        p[1],
        data as Parameters<typeof repository.updateProspect>[1],
      ),
    );
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
      .safeParse(data);
    return parsed.success
      ? ok(await repository.updateLead(p[1], parsed.data.stage as LeadStatus))
      : fail("INVALID_PAYLOAD", "Etapa inválida", 400);
  }
  if (p[0] === "agent" && p[1] === "settings") {
    const parsed = settingsSchema.safeParse(data);
    return parsed.success
      ? ok(await repository.updateAgentSettings(parsed.data))
      : fail("INVALID_PAYLOAD", "Ajustes inválidos", 400);
  }
  return fail("NOT_FOUND", "Acción no encontrada", 404);
}

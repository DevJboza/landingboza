import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activities,
  agentCommands,
  agentSessions,
  agentSettings,
  businesses,
  contacts,
  conversations,
  followups,
  leads,
  messages,
  outreachQueue,
  prospects,
  quotes,
} from "@/db/schema";
import type {
  AgentMode,
  Conversation,
  Followup,
  Lead,
  LeadStatus,
  OutreachItem,
  Prospect,
  Quote,
} from "./types";
import { getWhatsAppProvider } from "./whatsapp";

export interface ManageRepository {
  dashboard(): Promise<DashboardState>;
  conversations(): Promise<Conversation[]>;
  conversation(id: string): Promise<Conversation | null>;
  getConversationById(id: string): Promise<Conversation | null>;
  getMessagesByConversationId(id: string): Promise<ConversationMessage[]>;
  setMode(id: string, mode: AgentMode): Promise<Conversation | null>;
  sendMessage(id: string, body: string, requestId?: string): Promise<unknown>;
  createContact(data: { name?: string; phone: string; email?: string; city?: string; agentMode: AgentMode }): Promise<Conversation>;
  deleteConversation(id: string): Promise<boolean>;
  registerBusiness(id: string, data: { name: string; category?: string; city?: string; website?: string; interest?: string; objective?: string; score?: number }): Promise<Conversation | null>;
  prospects(): Promise<Prospect[]>;
  prospect(id: string): Promise<Prospect | null>;
  createProspect(data: Omit<Prospect, "id">): Promise<Prospect>;
  updateProspect(id: string, data: Partial<Prospect>): Promise<Prospect | null>;
  approveOutreach(id: string): Promise<OutreachItem | null>;
  outreach(): Promise<OutreachItem[]>;
  leads(): Promise<Lead[]>;
  createLead(data: Omit<Lead, "id" | "lastActivity">): Promise<Lead>;
  updateLead(id: string, stage: LeadStatus): Promise<Lead | null>;
  quotes(): Promise<Quote[]>;
  createQuote(data: Omit<Quote, "id">): Promise<Quote>;
  followups(): Promise<Followup[]>;
  createFollowup(data: Omit<Followup, "id">): Promise<Followup>;
  agent(): Promise<AgentState>;
  setAgent(online: boolean): Promise<AgentState>;
  updateAgentSettings(data: Record<string, unknown>): Promise<AgentState>;
}
export type ConversationMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND" | "SYSTEM";
  senderType: "CONTACT" | "CUSTOMER" | "AGENT" | "HUMAN" | "SYSTEM";
  text: string;
  createdAt: string;
  externalId: string | null;
  status: string;
};
export type DashboardState = {
  metrics: Record<string, number>;
  activity: number[];
  activities: { time: string; text: string; detail: string }[];
  leadFunnel: { name: string; value: number }[];
  agentOnline: boolean;
};
export type AgentState = {
  online: boolean;
  model: string;
  provider: string;
  activeSessions: number;
  messagesProcessed: number;
  fallbacks: number;
  humanChats: number;
  settings: Record<string, string | number | boolean>;
};
const iso = (date: Date | string | null | undefined) =>
  date ? new Date(date).toISOString() : new Date().toISOString();
const clock = (date: Date | string | null | undefined) =>
  new Intl.DateTimeFormat("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Costa_Rica",
  }).format(date ? new Date(date) : new Date());

export class PostgresManageRepository implements ManageRepository {
  private db() {
    return getDb();
  }
  async dashboard() {
    const db = this.db(),
      today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const [active] = await db
      .select({ value: count() })
      .from(conversations)
      .where(eq(conversations.status, "ACTIVE"));
    const [newProspects] = await db
      .select({ value: count() })
      .from(prospects)
      .where(eq(prospects.status, "NEW"));
    const [hotLeads] = await db
      .select({ value: count() })
      .from(leads)
      .where(gte(leads.score, 85));
    const [pendingQuotes] = await db
      .select({ value: count() })
      .from(quotes)
      .where(inArray(quotes.status, ["DRAFT", "SENT", "VIEWED"]));
    const [todayFollowups] = await db
      .select({ value: count() })
      .from(followups)
      .where(
        and(
          gte(followups.scheduledAt, today),
          inArray(followups.status, ["PENDING", "TODAY"]),
        ),
      );
    const [messageCount] = await db.select({ value: count() }).from(messages);
    const [humanChats] = await db
      .select({ value: count() })
      .from(conversations)
      .where(eq(conversations.agentMode, "HUMAN"));
    const [sessions] = await db
      .select({ value: count() })
      .from(agentSessions)
      .where(eq(agentSessions.active, true));
    const [meetings] = await db
      .select({ value: count() })
      .from(leads)
      .where(eq(leads.stage, "MEETING"));
    const messageActivity = await db
      .select({ sentAt: messages.sentAt })
      .from(messages)
      .where(gte(messages.sentAt, weekStart));
    const leadStageRows = await db
      .select({ stage: leads.stage, value: count() })
      .from(leads)
      .groupBy(leads.stage);
    const activityRows = await db
      .select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(8);
    const settings = await this.ensureSettings();
    return {
      metrics: {
        activeConversations: active.value,
        newProspects: newProspects.value,
        hotLeads: hotLeads.value,
        pendingQuotes: pendingQuotes.value,
        todayFollowups: todayFollowups.value,
        meetings: meetings.value,
        responseRate: 0,
        messagesProcessed: messageCount.value,
        humanChats: humanChats.value,
        activeSessions: sessions.value,
      },
      activity: Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + index);
        return messageActivity.filter((x) => {
          const d = new Date(x.sentAt);
          return (
            d.getFullYear() === day.getFullYear() &&
            d.getMonth() === day.getMonth() &&
            d.getDate() === day.getDate()
          );
        }).length;
      }),
      activities: activityRows.map((x) => ({
        time: clock(x.createdAt),
        text: x.title,
        detail: x.detail,
      })),
      leadFunnel: ["NEW", "CONTACTED", "INTERESTED", "QUOTE", "WON"].map(
        (stage) => ({
          name:
            {
              NEW: "Nuevos",
              CONTACTED: "Contactados",
              INTERESTED: "Interesados",
              QUOTE: "Cotización",
              WON: "Ganados",
            }[stage] || stage,
          value: leadStageRows.find((x) => x.stage === stage)?.value || 0,
        }),
      ),
      agentOnline: settings.agentEnabled,
    };
  }
  async conversationRows() {
    return this.db()
      .select({
        conversation: conversations,
        contact: contacts,
        business: businesses,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(businesses, eq(conversations.businessId, businesses.id))
      .orderBy(desc(conversations.lastMessageAt));
  }
  async mapConversations(
    rows: Awaited<ReturnType<PostgresManageRepository["conversationRows"]>>,
    includeMessages = false,
  ) {
    const db = this.db(),
      ids = rows.map((x) => x.conversation.id),
      all = includeMessages && ids.length
        ? await db
            .select()
            .from(messages)
            .where(inArray(messages.conversationId, ids))
            .orderBy(asc(messages.createdAt))
        : [];
    return rows.map(({ conversation: c, contact, business }): Conversation => ({
      id: c.id,
      name: contact?.name || "Sin nombre",
      business: business?.name || "Sin negocio",
      phone: contact?.phone || "",
      status: c.status,
      agentMode: c.agentMode,
      unread: c.unreadCount,
      lastMessage: c.lastMessage,
      lastMessageAt: clock(c.lastMessageAt),
      category: business?.category || "",
      city: business?.city || contact?.city || "",
      leadStatus: "NEW",
      score: c.score,
      interest: c.interest || "",
      source: c.source || "",
      objective: c.objective || "",
      notes: "",
      messages: all
        .filter((m) => m.conversationId === c.id)
        .map((m) => ({
          id: m.id,
          direction:
            m.direction === "INBOUND"
              ? "in"
              : m.direction === "OUTBOUND"
                ? "out"
                : "system",
          body: m.body,
          at: clock(m.sentAt),
          author:
            m.senderType === "HUMAN"
              ? "Johan"
              : m.senderType === "AGENT"
                ? "Agente"
                : m.senderType === "CONTACT" || m.senderType === "CUSTOMER"
                  ? "Cliente"
                  : "Sistema",
        })),
    }));
  }
  async conversations() {
    return this.mapConversations(await this.conversationRows(), true);
  }
  async conversation(id: string) {
    return this.getConversationById(id);
  }
  async getConversationById(id: string) {
    const all = await this.mapConversations(
      (await this.conversationRows()).filter((x) => x.conversation.id === id),
      true,
    );
    return all[0] || null;
  }
  async getMessagesByConversationId(id: string): Promise<ConversationMessage[]> {
    const rows = await this.db()
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    return rows.map((message) => ({
      id: message.id,
      direction: message.direction,
      senderType: message.senderType,
      text: message.body,
      createdAt: message.createdAt.toISOString(),
      externalId: message.externalId,
      status: message.status,
    }));
  }
  async setMode(id: string, mode: AgentMode) {
    const db = this.db();
    const [row] = await db
      .update(conversations)
      .set({
        agentMode: mode,
        status: mode === "CLOSED" ? "CLOSED" : "ACTIVE",
        unreadCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning();
    if (!row) return null;
    await Promise.all([
      db.insert(agentCommands).values({
        action:
          mode === "HUMAN"
            ? "take_conversation"
            : mode === "AUTO"
              ? "release_conversation"
              : mode === "PAUSED"
                ? "pause_agent"
                : "close_session",
        target: id,
      }),
      db.insert(activities).values({
        type: "conversation.mode",
        title: `Conversación cambió a ${mode}`,
        conversationId: id,
      }),
    ]);
    return this.conversation(id);
  }
  async createContact(data: { name?: string; phone: string; email?: string; city?: string; agentMode: AgentMode }) {
    const db = this.db();
    const digits = data.phone.replace(/\D/g, "");
    const phone = digits.length === 8 ? `506${digits}` : digits;
    const name = data.name?.trim() || phone;
    await db.insert(contacts).values({ name, phone, email: data.email, city: data.city }).onConflictDoUpdate({
      target: contacts.phone,
      set: { name, email: data.email || null, city: data.city || null, updatedAt: new Date() },
    });
    const [contact] = await db.select().from(contacts).where(eq(contacts.phone, phone)).limit(1);
    let [conversation] = await db.select().from(conversations)
      .where(eq(conversations.contactId, contact.id)).limit(1);
    if (!conversation) [conversation] = await db.insert(conversations).values({
      contactId: contact.id,
      externalChatId: `${phone}@c.us`,
      status: "NEW",
      agentMode: data.agentMode,
      lastMessage: "Contacto agregado manualmente",
    }).returning();
    else await db.update(conversations).set({
      agentMode: data.agentMode,
      status: data.agentMode === "CLOSED" ? "CLOSED" : "ACTIVE",
      externalChatId: conversation.externalChatId || `${phone}@c.us`,
      updatedAt: new Date(),
    }).where(eq(conversations.id, conversation.id));
    return (await this.getConversationById(conversation.id))!;
  }
  async deleteConversation(id: string) {
    const [deleted] = await this.db().delete(conversations).where(eq(conversations.id, id)).returning({ id: conversations.id });
    return Boolean(deleted);
  }
  async registerBusiness(id: string, data: { name: string; category?: string; city?: string; website?: string; interest?: string; objective?: string; score?: number }) {
    const db = this.db();
    const [target] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!target) return null;
    let businessId = target.businessId;
    if (businessId) {
      await db.update(businesses).set({ name: data.name, category: data.category || null, city: data.city || null,
        website: data.website || null, updatedAt: new Date() }).where(eq(businesses.id, businessId));
    } else {
      const [business] = await db.insert(businesses).values({ name: data.name, category: data.category,
        city: data.city, website: data.website }).returning();
      businessId = business.id;
    }
    await db.update(conversations).set({ businessId, interest: data.interest || null,
      objective: data.objective || null, score: data.score ?? target.score, updatedAt: new Date() })
      .where(eq(conversations.id, id));
    await db.insert(activities).values({ type: "business.registered", title: "Negocio registrado",
      detail: data.name, contactId: target.contactId, conversationId: id });
    return this.getConversationById(id);
  }
  async sendMessage(id: string, body: string, requestId?: string) {
    const db = this.db();
    const [recentDuplicate] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, id),
          eq(messages.direction, "OUTBOUND"),
          eq(messages.senderType, "HUMAN"),
          eq(messages.body, body),
          gte(messages.createdAt, new Date(Date.now() - 5_000)),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (recentDuplicate)
      return {
        id: recentDuplicate.id,
        direction: "out",
        body: recentDuplicate.body,
        at: clock(recentDuplicate.sentAt),
        author: "Johan",
        status: recentDuplicate.status,
        externalId: recentDuplicate.externalId || undefined,
      };
    const [target] = await db
      .select({ phone: contacts.phone })
      .from(conversations)
      .innerJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(eq(conversations.id, id))
      .limit(1);
    if (!target?.phone) throw new Error("Conversation has no phone number");
    const inserted = await db
      .insert(messages)
      .values({
        conversationId: id,
        requestId,
        direction: "OUTBOUND",
        senderType: "HUMAN",
        body,
        status: "PENDING",
      })
      .onConflictDoNothing({ target: messages.requestId })
      .returning();
    let message = inserted[0];
    if (!message && requestId) {
      [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.requestId, requestId))
        .limit(1);
      if (message)
        return {
          id: message.id,
          direction: "out",
          body: message.body,
          at: clock(message.sentAt),
          author: "Johan",
          status: message.status,
          externalId: message.externalId || undefined,
        };
    }
    if (!message) throw new Error("Could not create outbound message");
    let externalId: string | undefined;
    try {
      const response = await getWhatsAppProvider().sendText(
        target.phone,
        body,
      );
      externalId = response.externalId;
      await db
        .update(messages)
        .set({ status: "SENT", externalId })
        .where(eq(messages.id, message.id));
    } catch (error) {
      await db
        .update(messages)
        .set({ status: "FAILED" })
        .where(eq(messages.id, message.id));
      await db.insert(activities).values({
        type: "message.failed",
        title: "Error al enviar mensaje",
        conversationId: id,
      });
      throw error;
    }
    await db
      .update(conversations)
      .set({
        lastMessage: body,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id));
    await db.insert(activities).values({
      type: "message.outbound",
      title: "Mensaje registrado",
      conversationId: id,
      detail: "Mensaje saliente de Johan",
    });
    return {
      id: message.id,
      direction: "out",
      body: message.body,
      at: clock(message.sentAt),
      author: "Johan",
      status: "SENT",
      externalId,
    };
  }
  mapProspect(p: typeof prospects.$inferSelect): Prospect {
    return {
      id: p.id,
      business: p.businessName,
      category: p.category,
      city: p.city,
      phone: p.phone,
      whatsapp: p.whatsapp,
      web: p.web,
      instagram: p.instagram,
      facebook: p.facebook,
      score: p.score,
      opportunity: p.opportunity,
      status: p.status,
      lastAction: p.lastAction,
      problems: p.problems,
      suggestedMessage: p.suggestedMessage,
    };
  }
  async prospects() {
    return (
      await this.db().select().from(prospects).orderBy(desc(prospects.score))
    ).map((x) => this.mapProspect(x));
  }
  async prospect(id: string) {
    const [row] = await this.db()
      .select()
      .from(prospects)
      .where(eq(prospects.id, id))
      .limit(1);
    return row ? this.mapProspect(row) : null;
  }
  async createProspect(data: Omit<Prospect, "id">) {
    const [row] = await this.db()
      .insert(prospects)
      .values({ businessName: data.business, ...data })
      .returning();
    return this.mapProspect(row);
  }
  async updateProspect(id: string, data: Partial<Prospect>) {
    const values: Partial<typeof prospects.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.business !== undefined) values.businessName = data.business;
    for (const key of [
      "category",
      "city",
      "phone",
      "whatsapp",
      "web",
      "instagram",
      "facebook",
      "score",
      "opportunity",
      "status",
      "lastAction",
      "problems",
      "suggestedMessage",
    ] as const)
      if (data[key] !== undefined) Object.assign(values, { [key]: data[key] });
    const [row] = await this.db()
      .update(prospects)
      .set(values)
      .where(eq(prospects.id, id))
      .returning();
    return row ? this.mapProspect(row) : null;
  }
  async approveOutreach(id: string) {
    const db = this.db(),
      p = await this.prospect(id);
    if (!p) return null;
    const existing = await db
      .select()
      .from(outreachQueue)
      .where(eq(outreachQueue.prospectId, id))
      .limit(1);
    const [row] = existing.length
      ? await db
          .update(outreachQueue)
          .set({
            status: "APPROVED",
            message: p.suggestedMessage,
            updatedAt: new Date(),
          })
          .where(eq(outreachQueue.id, existing[0].id))
          .returning()
      : await db
          .insert(outreachQueue)
          .values({
            prospectId: id,
            message: p.suggestedMessage,
            status: "APPROVED",
          })
          .returning();
    await db
      .update(prospects)
      .set({ lastAction: "Mensaje aprobado", updatedAt: new Date() })
      .where(eq(prospects.id, id));
    return {
      id: row.id,
      prospectId: id,
      prospect: p.business,
      message: row.message,
      scheduledAt: row.scheduledAt?.toISOString() || null,
      status: row.status,
      channel: row.channel as "WhatsApp" | "Email",
    };
  }
  async outreach() {
    const rows = await this.db()
      .select({ queue: outreachQueue, prospect: prospects })
      .from(outreachQueue)
      .innerJoin(prospects, eq(outreachQueue.prospectId, prospects.id))
      .orderBy(desc(outreachQueue.createdAt));
    return rows.map(({ queue: q, prospect: p }) => ({
      id: q.id,
      prospectId: q.prospectId,
      prospect: p.businessName,
      message: q.message,
      scheduledAt: q.scheduledAt?.toISOString() || null,
      status: q.status,
      channel: q.channel as "WhatsApp" | "Email",
    }));
  }
  mapLead(l: typeof leads.$inferSelect): Lead {
    return {
      id: l.id,
      business: l.businessName,
      contact: l.contactName,
      value: Number(l.estimatedValue),
      score: l.score,
      stage: l.stage,
      lastActivity: iso(l.lastActivityAt),
    };
  }
  async leads() {
    return (
      await this.db().select().from(leads).orderBy(desc(leads.lastActivityAt))
    ).map((x) => this.mapLead(x));
  }
  async createLead(data: Omit<Lead, "id" | "lastActivity">) {
    const [row] = await this.db().insert(leads).values({
      businessName: data.business,
      contactName: data.contact,
      estimatedValue: String(data.value),
      score: data.score,
      stage: data.stage,
    }).returning();
    return this.mapLead(row);
  }
  async updateLead(id: string, stage: LeadStatus) {
    const [row] = await this.db()
      .update(leads)
      .set({ stage, lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return row ? this.mapLead(row) : null;
  }
  async quotes() {
    return (
      await this.db().select().from(quotes).orderBy(desc(quotes.createdAt))
    ).map((q) => ({
      id: q.id,
      client: q.client,
      business: q.business,
      service: q.service,
      scope: q.scope,
      notes: q.notes,
      estimatedPrice: Number(q.estimatedPrice),
      status: q.status,
    }));
  }
  async createQuote(data: Omit<Quote, "id">) {
    const [q] = await this.db()
      .insert(quotes)
      .values({ ...data, estimatedPrice: String(data.estimatedPrice) })
      .returning();
    return { ...data, id: q.id };
  }
  async followups() {
    return (
      await this.db().select().from(followups).orderBy(followups.scheduledAt)
    ).map((f) => ({
      id: f.id,
      client: f.client,
      reason: f.reason,
      date: f.scheduledAt.toISOString().slice(0, 10),
      time: clock(f.scheduledAt),
      channel: f.channel as Followup["channel"],
      message: f.message,
      status: f.status,
    }));
  }
  async createFollowup(data: Omit<Followup, "id">) {
    const [f] = await this.db()
      .insert(followups)
      .values({
        client: data.client,
        reason: data.reason,
        scheduledAt: new Date(`${data.date}T${data.time}:00-06:00`),
        channel: data.channel,
        message: data.message,
        status: data.status,
      })
      .returning();
    return { ...data, id: f.id };
  }
  async ensureSettings() {
    const db = this.db();
    const [existing] = await db
      .select()
      .from(agentSettings)
      .where(eq(agentSettings.id, "default"));
    if (existing) return existing;
    const [created] = await db
      .insert(agentSettings)
      .values({ id: "default" })
      .onConflictDoNothing()
      .returning();
    return (
      created ||
      (
        await db
          .select()
          .from(agentSettings)
          .where(eq(agentSettings.id, "default"))
      )[0]
    );
  }
  async agent() {
    const db = this.db(),
      s = await this.ensureSettings();
    const [sessions] = await db
      .select({ value: count() })
      .from(agentSessions)
      .where(eq(agentSessions.active, true));
    const [processed] = await db.select({ value: count() }).from(messages);
    const [humans] = await db
      .select({ value: count() })
      .from(conversations)
      .where(eq(conversations.agentMode, "HUMAN"));
    return {
      online: s.agentEnabled,
      model: "OpenRouter",
      provider: getWhatsAppProvider().name === "GREEN_API" ? "GREEN-API" : "WaSender",
      activeSessions: sessions.value,
      messagesProcessed: processed.value,
      fallbacks: 0,
      humanChats: humans.value,
      settings: {
        closeMinutes: s.sessionTimeoutMinutes,
        reminderMinutes: s.reminderMinutes,
        autoReply: s.autoReply,
        aiFallback: s.aiFallback,
        afterHours: s.outOfHoursEnabled,
      },
    };
  }
  async setAgent(online: boolean) {
    await this.db()
      .update(agentSettings)
      .set({ agentEnabled: online, updatedAt: new Date() })
      .where(eq(agentSettings.id, "default"));
    return this.agent();
  }
  async updateAgentSettings(data: Record<string, unknown>) {
    const allowed = {
      sessionTimeoutMinutes: data.sessionTimeoutMinutes,
      reminderMinutes: data.reminderMinutes,
      autoReply: data.autoReply,
      aiFallback: data.aiFallback,
      outOfHoursEnabled: data.outOfHoursEnabled,
    };
    const clean = Object.fromEntries(
      Object.entries(allowed).filter(([, v]) => v !== undefined),
    );
    await this.db()
      .update(agentSettings)
      .set({ ...clean, updatedAt: new Date() })
      .where(eq(agentSettings.id, "default"));
    return this.agent();
  }
}
export const repository: ManageRepository = new PostgresManageRepository();

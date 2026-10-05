import {
  activities,
  conversations,
  followups,
  leads,
  outreach,
  prospects,
  quotes,
} from "./mock-data";
import type {
  AgentCommand,
  AgentMode,
  Followup,
  LeadStatus,
  Prospect,
  Quote,
} from "./types";

const state = {
  agentOnline: true,
  conversations,
  prospects,
  leads,
  quotes,
  followups,
  outreach,
  commands: [] as AgentCommand[],
};
const id = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const repository = {
  dashboard() {
    return {
      metrics: {
        activeConversations: state.conversations.filter(
          (x) => x.status === "ACTIVE",
        ).length,
        newProspects: state.prospects.filter((x) => x.status === "NEW").length,
        hotLeads: state.leads.filter((x) => x.score >= 85).length,
        pendingQuotes: state.quotes.filter((x) =>
          ["DRAFT", "SENT", "VIEWED"].includes(x.status),
        ).length,
        todayFollowups: state.followups.filter((x) => x.status === "TODAY")
          .length,
        meetings: state.leads.filter((x) => x.stage === "MEETING").length,
        responseRate: 87,
      },
      activity: [18, 25, 21, 36, 30, 46, 41],
      activities,
      agentOnline: state.agentOnline,
    };
  },
  conversations() {
    return state.conversations;
  },
  conversation(cid: string) {
    return state.conversations.find((x) => x.id === cid);
  },
  setMode(cid: string, mode: AgentMode) {
    const c = this.conversation(cid);
    if (!c) return null;
    c.agentMode = mode;
    c.status = mode === "CLOSED" ? "CLOSED" : "ACTIVE";
    c.unread = 0;
    return c;
  },
  sendMessage(cid: string, body: string) {
    const c = this.conversation(cid);
    if (!c) return null;
    const message = {
      id: id("msg"),
      direction: "out" as const,
      body,
      at: new Date().toLocaleTimeString("es-CR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      author: "Johan" as const,
    };
    c.messages.push(message);
    c.lastMessage = body;
    c.lastMessageAt = message.at;
    return message;
  },
  prospects() {
    return state.prospects;
  },
  prospect(pid: string) {
    return state.prospects.find((x) => x.id === pid);
  },
  createProspect(data: Omit<Prospect, "id">) {
    const item = { ...data, id: id("pros") };
    state.prospects.unshift(item);
    return item;
  },
  updateProspect(pid: string, data: Partial<Prospect>) {
    const item = this.prospect(pid);
    if (!item) return null;
    Object.assign(item, data, { id: pid });
    return item;
  },
  approveOutreach(pid: string) {
    const p = this.prospect(pid);
    if (!p) return null;
    let item = state.outreach.find((x) => x.prospectId === pid);
    if (!item) {
      item = {
        id: id("out"),
        prospectId: pid,
        prospect: p.business,
        message: p.suggestedMessage,
        scheduledAt: null,
        status: "APPROVED",
        channel: "WhatsApp",
      };
      state.outreach.unshift(item);
    } else item.status = "APPROVED";
    return item;
  },
  outreach() {
    return state.outreach;
  },
  leads() {
    return state.leads;
  },
  updateLead(lid: string, stage: LeadStatus) {
    const item = state.leads.find((x) => x.id === lid);
    if (!item) return null;
    item.stage = stage;
    return item;
  },
  quotes() {
    return state.quotes;
  },
  createQuote(data: Omit<Quote, "id">) {
    const item = { ...data, id: id("quote") };
    state.quotes.unshift(item);
    return item;
  },
  followups() {
    return state.followups;
  },
  createFollowup(data: Omit<Followup, "id">) {
    const item = { ...data, id: id("follow") };
    state.followups.unshift(item);
    return item;
  },
  agent() {
    return {
      online: state.agentOnline,
      model: "OpenRouter",
      provider: "WaSender",
      activeSessions: state.conversations.filter((x) => x.status === "ACTIVE")
        .length,
      messagesProcessed: 1284,
      fallbacks: 12,
      humanChats: state.conversations.filter((x) => x.agentMode === "HUMAN")
        .length,
      settings: {
        closeMinutes: 10,
        reminderMinutes: 7,
        autoReply: true,
        aiFallback: true,
        afterHours: false,
      },
    };
  },
  setAgent(online: boolean) {
    state.agentOnline = online;
    return this.agent();
  },
  command(
    action: AgentCommand["action"],
    target: string,
    payload: Record<string, unknown> = {},
  ) {
    const cmd: AgentCommand = {
      id: id("cmd"),
      action,
      target,
      payload,
      status: "pending",
      source: "dashboard",
      createdAt: new Date().toISOString(),
    };
    state.commands.unshift(cmd);
    return cmd;
  },
};

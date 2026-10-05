export type AgentMode = "AUTO" | "HUMAN" | "PAUSED" | "CLOSED";
export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "REPLIED"
  | "INTERESTED"
  | "QUALIFIED"
  | "QUOTE"
  | "MEETING"
  | "WON"
  | "LOST";
export type OutreachStatus =
  | "DRAFT"
  | "APPROVED"
  | "SCHEDULED"
  | "SENT"
  | "REPLIED"
  | "CANCELLED"
  | "FAILED";

export interface Message {
  id: string;
  direction: "in" | "out" | "system";
  body: string;
  at: string;
  author: "Cliente" | "Agente" | "Johan" | "Sistema";
}
export interface Conversation {
  id: string;
  name: string;
  business: string;
  phone: string;
  status: "NEW" | "ACTIVE" | "PENDING" | "CLOSED";
  agentMode: AgentMode;
  unread: number;
  lastMessage: string;
  lastMessageAt: string;
  category: string;
  city: string;
  leadStatus: LeadStatus;
  score: number;
  interest: string;
  source: string;
  objective: string;
  notes: string;
  messages: Message[];
}
export interface Prospect {
  id: string;
  business: string;
  category: string;
  city: string;
  phone: string;
  whatsapp: boolean;
  web: string;
  instagram: string;
  facebook: string;
  score: number;
  opportunity: string;
  status:
    "NEW" | "PRIORITY" | "CONTACTED" | "REPLIED" | "INTERESTED" | "DISCARDED";
  lastAction: string;
  problems: string[];
  suggestedMessage: string;
}
export interface Lead {
  id: string;
  business: string;
  contact: string;
  value: number;
  score: number;
  stage: LeadStatus;
  lastActivity: string;
}
export interface Quote {
  id: string;
  client: string;
  business: string;
  service: string;
  scope: string;
  notes: string;
  estimatedPrice: number;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED";
}
export interface Followup {
  id: string;
  client: string;
  reason: string;
  date: string;
  time: string;
  channel: "WhatsApp" | "Llamada" | "Email";
  message: string;
  status: "PENDING" | "TODAY" | "COMPLETED" | "CANCELLED";
}
export interface OutreachItem {
  id: string;
  prospectId: string;
  prospect: string;
  message: string;
  scheduledAt: string | null;
  status: OutreachStatus;
  channel: "WhatsApp" | "Email";
}
export interface AgentCommand {
  id: string;
  action:
    | "send_message"
    | "pause_agent"
    | "resume_agent"
    | "take_conversation"
    | "release_conversation"
    | "close_session"
    | "create_followup"
    | "set_lead_stage";
  target: string;
  payload: Record<string, unknown>;
  status: "pending" | "completed" | "failed";
  source: "dashboard";
  createdAt: string;
}

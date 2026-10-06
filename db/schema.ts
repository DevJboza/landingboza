import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const agentModeEnum = pgEnum("agent_mode", [
  "AUTO",
  "HUMAN",
  "PAUSED",
  "CLOSED",
  "IGNORE",
  "KEYWORD_ONLY",
]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "NEW",
  "ACTIVE",
  "PENDING",
  "CLOSED",
]);
export const messageDirectionEnum = pgEnum("message_direction", [
  "INBOUND",
  "OUTBOUND",
  "SYSTEM",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
]);
export const senderTypeEnum = pgEnum("sender_type", [
  "CONTACT",
  "CUSTOMER",
  "AGENT",
  "HUMAN",
  "SYSTEM",
]);
export const leadStatusEnum = pgEnum("lead_status", [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "QUALIFIED",
  "QUOTE",
  "MEETING",
  "WON",
  "LOST",
]);
export const prospectStatusEnum = pgEnum("prospect_status", [
  "NEW",
  "PRIORITY",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "DISCARDED",
]);
export const quoteStatusEnum = pgEnum("quote_status", [
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
]);
export const followupStatusEnum = pgEnum("followup_status", [
  "PENDING",
  "TODAY",
  "COMPLETED",
  "CANCELLED",
]);
export const outreachStatusEnum = pgEnum("outreach_status", [
  "DRAFT",
  "APPROVED",
  "SCHEDULED",
  "SENT",
  "REPLIED",
  "CANCELLED",
  "FAILED",
]);
export const commandStatusEnum = pgEnum("command_status", [
  "PENDING",
  "COMPLETED",
  "FAILED",
]);
const audit = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  city: text("city"),
  ...audit,
});
export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  city: text("city"),
  website: text("website"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  ...audit,
});
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  businessId: uuid("business_id").references(() => businesses.id, {
    onDelete: "set null",
  }),
  externalChatId: text("external_chat_id").unique(),
  status: conversationStatusEnum("status").default("NEW").notNull(),
  agentMode: agentModeEnum("agent_mode").default("AUTO").notNull(),
  unreadCount: integer("unread_count").default(0).notNull(),
  lastMessage: text("last_message").default("").notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  interest: text("interest"),
  source: text("source"),
  objective: text("objective"),
  score: integer("score").default(0).notNull(),
  ...audit,
});
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  externalId: text("external_id").unique(),
  requestId: text("request_id").unique(),
  direction: messageDirectionEnum("direction").notNull(),
  senderType: senderTypeEnum("sender_type").notNull(),
  body: text("body").notNull(),
  status: messageStatusEnum("status").default("PENDING").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: audit.createdAt,
});
export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  active: boolean("active").default(true).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
});
export const prospects = pgTable("prospects", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").references(() => businesses.id, {
    onDelete: "set null",
  }),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  businessName: text("business_name").notNull(),
  category: text("category").default("").notNull(),
  city: text("city").default("").notNull(),
  phone: text("phone").default("").notNull(),
  whatsapp: boolean("whatsapp").default(false).notNull(),
  web: text("web").default("").notNull(),
  instagram: text("instagram").default("").notNull(),
  facebook: text("facebook").default("").notNull(),
  score: integer("score").default(0).notNull(),
  opportunity: text("opportunity").default("").notNull(),
  status: prospectStatusEnum("status").default("NEW").notNull(),
  lastAction: text("last_action").default("").notNull(),
  problems: jsonb("problems").$type<string[]>().default([]).notNull(),
  suggestedMessage: text("suggested_message").default("").notNull(),
  source: text("source"),
  sourceUrl: text("source_url"),
  sourceUrls: jsonb("source_urls").$type<string[]>().default([]).notNull(),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }),
  batchId: text("batch_id"),
  country: text("country"),
  province: text("province"),
  canton: text("canton"),
  address: text("address"),
  whatsappNumber: text("whatsapp_number"),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  signals: jsonb("signals").$type<Record<string, unknown>>().default({}).notNull(),
  evidence: jsonb("evidence").$type<{ claim: string; sourceUrl: string }[]>().default([]).notNull(),
  suggestedServices: jsonb("suggested_services").$type<string[]>().default([]).notNull(),
  reasonToContact: text("reason_to_contact"),
  ...audit,
});
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").references(() => prospects.id, {
    onDelete: "set null",
  }),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  businessId: uuid("business_id").references(() => businesses.id, {
    onDelete: "set null",
  }),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").default("").notNull(),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  score: integer("score").default(0).notNull(),
  stage: leadStatusEnum("stage").default("NEW").notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...audit,
});
export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  client: text("client").notNull(),
  business: text("business").notNull(),
  service: text("service").notNull(),
  scope: text("scope").notNull(),
  notes: text("notes").default("").notNull(),
  estimatedPrice: numeric("estimated_price", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  status: quoteStatusEnum("status").default("DRAFT").notNull(),
  ...audit,
});
export const followups = pgTable("followups", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  client: text("client").notNull(),
  reason: text("reason").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  channel: text("channel").notNull(),
  message: text("message").default("").notNull(),
  status: followupStatusEnum("status").default("PENDING").notNull(),
  ...audit,
});
export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "cascade",
  }),
  conversationId: uuid("conversation_id").references(() => conversations.id, {
    onDelete: "cascade",
  }),
  body: text("body").notNull(),
  author: text("author").default("admin").notNull(),
  createdAt: audit.createdAt,
});
export const agentCommands = pgTable("agent_commands", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  payload: jsonb("payload")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  status: commandStatusEnum("status").default("PENDING").notNull(),
  source: text("source").default("dashboard").notNull(),
  error: text("error"),
  createdAt: audit.createdAt,
  processedAt: timestamp("processed_at", { withTimezone: true }),
});
export const outreachQueue = pgTable("outreach_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: outreachStatusEnum("status").default("DRAFT").notNull(),
  channel: text("channel").default("WhatsApp").notNull(),
  externalId: text("external_id"),
  error: text("error"),
  ...audit,
});
export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail").default("").notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  conversationId: uuid("conversation_id").references(() => conversations.id, {
    onDelete: "set null",
  }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: audit.createdAt,
});
export const agentSettings = pgTable("agent_settings", {
  id: text("id").primaryKey().default("default"),
  agentEnabled: boolean("agent_enabled").default(true).notNull(),
  sessionTimeoutMinutes: integer("session_timeout_minutes")
    .default(10)
    .notNull(),
  reminderMinutes: integer("reminder_minutes").default(7).notNull(),
  autoReply: boolean("auto_reply").default(true).notNull(),
  aiFallback: boolean("ai_fallback").default(true).notNull(),
  outOfHoursEnabled: boolean("out_of_hours_enabled").default(false).notNull(),
  ...audit,
});

export const scoutBatches = pgTable("scout_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: text("batch_id").notNull().unique(),
  generatedBy: text("generated_by").notNull(),
  targetArea: jsonb("target_area").$type<{ country: string; province: string; canton: string }>().notNull(),
  received: integer("received").default(0).notNull(),
  accepted: integer("accepted").default(0).notNull(),
  rejected: integer("rejected").default(0).notNull(),
  results: jsonb("results").$type<{ businessName: string; accepted: boolean; reason?: string }[]>().default([]).notNull(),
  createdAt: audit.createdAt,
});

export const prospectExclusions = pgTable("prospect_exclusions", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  value: text("value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  reason: text("reason").default("").notNull(),
  createdAt: audit.createdAt,
}, (table) => [uniqueIndex("prospect_exclusions_type_value_idx").on(table.type, table.normalizedValue)]);

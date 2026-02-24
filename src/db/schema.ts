import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "office_manager",
  "crew_chief",
  "instrument_person",
]);

export const contactTypeEnum = pgEnum("contact_type", [
  "homeowner",
  "title_company",
  "realtor",
  "attorney",
  "lender",
  "contractor",
  "government",
  "other",
]);

export const surveyTypeEnum = pgEnum("survey_type", [
  "boundary",
  "alta",
  "topographic",
  "as_built",
  "subdivision",
  "construction",
  "elevation_cert",
  "route",
  "other",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "phone_intake",
  "email",
  "website",
  "referral",
  "rfp",
  "walk_in",
  "repeat_client",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "qualifying",
  "proposal_sent",
  "won",
  "lost",
  "expired",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
]);

export const pricingModeEnum = pgEnum("pricing_mode", [
  "fixed",
  "unit",
  "time_materials",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "pending",
  "in_progress",
  "field_complete",
  "drafting",
  "review",
  "delivered",
  "closed",
  "on_hold",
]);

export const invoiceTypeEnum = pgEnum("invoice_type", [
  "deposit",
  "progress",
  "final",
  "retainer",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "credit_card",
  "ach",
  "check",
  "cash",
  "other",
]);

export const fieldVisitStatusEnum = pgEnum("field_visit_status", [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "rescheduled",
]);

export const timeWindowEnum = pgEnum("time_window", [
  "morning",
  "afternoon",
  "full_day",
  "multi_day",
]);

export const equipmentTypeEnum = pgEnum("equipment_type", [
  "total_station",
  "gps_receiver",
  "level",
  "drone",
  "data_collector",
  "other",
]);

export const equipmentStatusEnum = pgEnum("equipment_status", [
  "available",
  "in_field",
  "maintenance",
]);

export const callDirectionEnum = pgEnum("call_direction", [
  "inbound",
  "outbound",
  "missed",
]);

export const urgencyEnum = pgEnum("urgency", ["low", "medium", "high"]);

// ============================================================
// TENANTS (firms)
// ============================================================

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  // Firm details
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zip: varchar("zip", { length: 10 }),
  // Professional info
  plsLicenseNumber: varchar("pls_license_number", { length: 50 }),
  plsLicenseState: varchar("pls_license_state", { length: 2 }),
  insuranceInfo: text("insurance_info"),
  // Service area (could be expanded to PostGIS polygon later)
  serviceAreaCounties: text("service_area_counties"), // comma-separated for MVP
  // Branding
  logoUrl: text("logo_url"),
  // Retell AI config for this firm
  retellAgentId: varchar("retell_agent_id", { length: 100 }),
  retellPhoneNumber: varchar("retell_phone_number", { length: 20 }),
  // Stripe
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  // Subscription
  subscriptionStatus: varchar("subscription_status", { length: 20 }).default("trialing"), // trialing | active | past_due | canceled
  subscriptionPlan: varchar("subscription_plan", { length: 20 }).default("starter"), // starter | pro
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  // Onboarding
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  // Settings
  defaultSurveyTypes: jsonb("default_survey_types").$type<string[]>(),
  proposalTerms: text("proposal_terms"), // default terms & conditions
  invoiceNotes: text("invoice_notes"), // default invoice footer
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// USERS (team members within a firm)
// ============================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Supabase Auth user ID — links to auth.users
    authId: uuid("auth_id").notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    role: userRoleEnum("role").notNull().default("instrument_person"),
    isActive: boolean("is_active").notNull().default(true),
    // Notification prefs
    smsNotifications: boolean("sms_notifications").notNull().default(true),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    // Onboarding
    welcomeComplete: boolean("welcome_complete").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("users_tenant_idx").on(table.tenantId),
    index("users_auth_idx").on(table.authId),
  ]
);

// ============================================================
// CONTACTS (clients: homeowners, title companies, etc.)
// ============================================================

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: contactTypeEnum("type").notNull().default("homeowner"),
    // Person info
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    // Company info (for title companies, law firms, etc.)
    companyName: varchar("company_name", { length: 255 }),
    // Contact details
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 2 }),
    zip: varchar("zip", { length: 10 }),
    // Relationship
    referralSource: varchar("referral_source", { length: 255 }),
    notes: text("notes"),
    // Billing defaults
    defaultPaymentTermsDays: integer("default_payment_terms_days").default(0), // 0 = due on receipt
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("contacts_tenant_idx").on(table.tenantId),
    index("contacts_type_idx").on(table.tenantId, table.type),
  ]
);

// ============================================================
// LEADS (potential projects from intake)
// ============================================================

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    // Property
    propertyAddress: text("property_address").notNull(),
    parcelNumber: varchar("parcel_number", { length: 50 }),
    // Survey details
    surveyType: surveyTypeEnum("survey_type").notNull(),
    source: leadSourceEnum("source").notNull().default("phone_intake"),
    status: leadStatusEnum("status").notNull().default("new"),
    urgency: urgencyEnum("urgency").notNull().default("medium"),
    // Caller info (denormalized from contact for quick access)
    callerEmail: varchar("caller_email", { length: 255 }),
    callerPhone: varchar("caller_phone", { length: 20 }),
    // Context
    notes: text("notes"),
    specialRequests: text("special_requests"),
    lostReason: text("lost_reason"), // if status = lost
    // Reference back to the call that created this lead
    callLogId: uuid("call_log_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("leads_tenant_idx").on(table.tenantId),
    index("leads_status_idx").on(table.tenantId, table.status),
    index("leads_contact_idx").on(table.contactId),
  ]
);

// ============================================================
// PROPOSAL TEMPLATES
// ============================================================

export const proposalTemplates = pgTable(
  "proposal_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    surveyType: surveyTypeEnum("survey_type").notNull(),
    // Default scope items for this template
    // Array of { task: string, description: string, includedByDefault: boolean }
    defaultScopeItems: jsonb("default_scope_items")
      .$type<
        Array<{
          task: string;
          description: string;
          includedByDefault: boolean;
        }>
      >()
      .notNull()
      .default([]),
    // Default pricing
    defaultBasePrice: numeric("default_base_price", {
      precision: 10,
      scale: 2,
    }),
    defaultPricingMode: pricingModeEnum("default_pricing_mode")
      .notNull()
      .default("fixed"),
    // Default terms
    termsAndConditions: text("terms_and_conditions"),
    validDays: integer("valid_days").notNull().default(30), // how long proposals are valid
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("proposal_templates_tenant_idx").on(table.tenantId)]
);

// ============================================================
// PROPOSALS
// ============================================================

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    templateId: uuid("template_id").references(() => proposalTemplates.id, {
      onDelete: "set null",
    }),
    // Property
    propertyAddress: text("property_address").notNull(),
    parcelNumber: varchar("parcel_number", { length: 50 }),
    surveyType: surveyTypeEnum("survey_type").notNull(),
    // Scope
    // Array of { task: string, description: string, included: boolean }
    scopeItems: jsonb("scope_items")
      .$type<
        Array<{ task: string; description: string; included: boolean }>
      >()
      .notNull()
      .default([]),
    // Pricing
    pricingMode: pricingModeEnum("pricing_mode").notNull().default("fixed"),
    // Array of { description: string, quantity: number, unitPrice: number, total: number }
    lineItems: jsonb("line_items")
      .$type<
        Array<{
          description: string;
          quantity: number;
          unitPrice: number;
          total: number;
        }>
      >()
      .notNull()
      .default([]),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
    // Terms
    termsAndConditions: text("terms_and_conditions"),
    validUntil: date("valid_until").notNull(),
    depositRequired: boolean("deposit_required").notNull().default(false),
    depositPercent: integer("deposit_percent").default(50),
    // Status tracking
    status: proposalStatusEnum("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    // Acceptance
    acceptanceToken: varchar("acceptance_token", { length: 100 }), // for the public accept link
    acceptedByName: varchar("accepted_by_name", { length: 255 }),
    acceptedByEmail: varchar("accepted_by_email", { length: 255 }),
    acceptedByIp: varchar("accepted_by_ip", { length: 45 }),
    // PDF
    pdfUrl: text("pdf_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("proposals_tenant_idx").on(table.tenantId),
    index("proposals_status_idx").on(table.tenantId, table.status),
    index("proposals_contact_idx").on(table.contactId),
    index("proposals_lead_idx").on(table.leadId),
    uniqueIndex("proposals_acceptance_token_idx").on(table.acceptanceToken),
  ]
);

// ============================================================
// PROJECTS (created when a proposal is accepted)
// ============================================================

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id").references(() => proposals.id, {
      onDelete: "set null",
    }),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    // Property
    propertyAddress: text("property_address").notNull(),
    parcelNumber: varchar("parcel_number", { length: 50 }),
    surveyType: surveyTypeEnum("survey_type").notNull(),
    // Status
    status: projectStatusEnum("status").notNull().default("pending"),
    // PLS who will sign/seal the deliverables
    assignedPlsId: uuid("assigned_pls_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Task checklist (copied from proposal scope)
    // Array of { task: string, description: string, completed: boolean, completedAt?: string }
    taskChecklist: jsonb("task_checklist")
      .$type<
        Array<{
          task: string;
          description: string;
          completed: boolean;
          completedAt?: string;
        }>
      >()
      .default([]),
    // Financial
    contractValue: numeric("contract_value", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    totalInvoiced: numeric("total_invoiced", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    totalPaid: numeric("total_paid", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    // Documents (array of { name: string, url: string, type: string, uploadedAt: string })
    documents: jsonb("documents")
      .$type<
        Array<{
          name: string;
          url: string;
          type: string;
          uploadedAt: string;
        }>
      >()
      .default([]),
    notes: text("notes"),
    // Dates
    startedAt: timestamp("started_at", { withTimezone: true }),
    fieldCompletedAt: timestamp("field_completed_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("projects_tenant_idx").on(table.tenantId),
    index("projects_status_idx").on(table.tenantId, table.status),
    index("projects_contact_idx").on(table.contactId),
  ]
);

// ============================================================
// INVOICES
// ============================================================

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    // Invoice number (auto-incrementing per tenant, set by application logic)
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    type: invoiceTypeEnum("type").notNull().default("final"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    // Line items
    lineItems: jsonb("line_items")
      .$type<
        Array<{
          description: string;
          quantity: number;
          unitPrice: number;
          total: number;
        }>
      >()
      .notNull()
      .default([]),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    // Terms
    dueDate: date("due_date").notNull(),
    notes: text("notes"), // shown on invoice
    internalNotes: text("internal_notes"), // not shown to client
    // Stripe
    stripePaymentLinkId: varchar("stripe_payment_link_id", { length: 100 }),
    stripePaymentLinkUrl: text("stripe_payment_link_url"),
    // Status tracking
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // PDF
    pdfUrl: text("pdf_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("invoices_tenant_idx").on(table.tenantId),
    index("invoices_status_idx").on(table.tenantId, table.status),
    index("invoices_project_idx").on(table.projectId),
    index("invoices_contact_idx").on(table.contactId),
    uniqueIndex("invoices_number_tenant_idx").on(
      table.tenantId,
      table.invoiceNumber
    ),
  ]
);

// ============================================================
// PAYMENTS
// ============================================================

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    // Stripe reference
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 100,
    }),
    // Check info (for manual payments)
    checkNumber: varchar("check_number", { length: 50 }),
    notes: text("notes"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payments_tenant_idx").on(table.tenantId),
    index("payments_invoice_idx").on(table.invoiceId),
  ]
);

// ============================================================
// CREWS
// ============================================================

export const crews = pgTable(
  "crews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // "Crew A", "Crew B"
    crewChiefId: uuid("crew_chief_id").references(() => users.id, {
      onDelete: "set null",
    }),
    chiefName: varchar("chief_name", { length: 150 }), // freeform name — no login required
    isActive: boolean("is_active").notNull().default(true),
    // Default equipment assigned to this crew
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("crews_tenant_idx").on(table.tenantId)]
);

// Many-to-many: crew members
export const crewMembers = pgTable(
  "crew_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("crew_members_crew_idx").on(table.crewId),
    uniqueIndex("crew_members_unique_idx").on(table.crewId, table.userId),
  ]
);

// ============================================================
// EQUIPMENT
// ============================================================

export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(), // "Trimble S7 #1"
    type: equipmentTypeEnum("type").notNull(),
    serialNumber: varchar("serial_number", { length: 100 }),
    status: equipmentStatusEnum("status").notNull().default("available"),
    // Currently assigned to which crew (null = unassigned)
    assignedCrewId: uuid("assigned_crew_id").references(() => crews.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("equipment_tenant_idx").on(table.tenantId)]
);

// ============================================================
// FIELD VISITS (scheduled crew visits to job sites)
// ============================================================

export const fieldVisits = pgTable(
  "field_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    crewId: uuid("crew_id")
      .references(() => crews.id, { onDelete: "restrict" }),
    // Schedule
    scheduledDate: date("scheduled_date").notNull(),
    timeWindow: timeWindowEnum("time_window").notNull().default("full_day"),
    estimatedDurationHours: numeric("estimated_duration_hours", {
      precision: 4,
      scale: 1,
    }),
    // Status
    status: fieldVisitStatusEnum("status").notNull().default("scheduled"),
    // Access info
    accessNotes: text("access_notes"), // gate codes, contact person, etc.
    utilityLocateStatus: varchar("utility_locate_status", { length: 100 }),
    // Field updates (from crew chief)
    actualArrival: timestamp("actual_arrival", { withTimezone: true }),
    actualDeparture: timestamp("actual_departure", { withTimezone: true }),
    fieldNotes: text("field_notes"),
    // Client notification tracking
    clientNotifiedAt: timestamp("client_notified_at", { withTimezone: true }),
    // Rescheduling
    rescheduledFromId: uuid("rescheduled_from_id"), // self-reference, points to the original visit
    rescheduleReason: text("reschedule_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("field_visits_tenant_idx").on(table.tenantId),
    index("field_visits_date_idx").on(table.tenantId, table.scheduledDate),
    index("field_visits_crew_date_idx").on(
      table.crewId,
      table.scheduledDate
    ),
    index("field_visits_project_idx").on(table.projectId),
  ]
);

// Many-to-many: equipment assigned to a specific field visit
export const fieldVisitEquipment = pgTable(
  "field_visit_equipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldVisitId: uuid("field_visit_id")
      .notNull()
      .references(() => fieldVisits.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("fv_equipment_visit_idx").on(table.fieldVisitId),
    uniqueIndex("fv_equipment_unique_idx").on(
      table.fieldVisitId,
      table.equipmentId
    ),
  ]
);

// ============================================================
// CALL LOG (from Retell AI voice agent)
// ============================================================

export const callLog = pgTable(
  "call_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Retell IDs
    retellCallId: varchar("retell_call_id", { length: 100 }),
    retellAgentId: varchar("retell_agent_id", { length: 100 }),
    // Call details
    direction: callDirectionEnum("direction").notNull(),
    callerPhone: varchar("caller_phone", { length: 20 }),
    duration: integer("duration"), // seconds
    // AI processing
    summary: text("summary"), // AI-generated call summary
    transcript: text("transcript"), // full transcript
    // Matched contact (if identified)
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    // What happened as a result
    // e.g., "lead_created", "status_update", "transferred", "voicemail"
    outcome: varchar("outcome", { length: 50 }),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    // Recording
    recordingUrl: text("recording_url"),
    // Timestamps
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("call_log_tenant_idx").on(table.tenantId),
    index("call_log_date_idx").on(table.tenantId, table.startedAt),
    index("call_log_contact_idx").on(table.contactId),
    index("call_log_retell_idx").on(table.retellCallId),
  ]
);

// ============================================================
// INTEGRATIONS (OAuth tokens for Gmail, etc.)
// ============================================================

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // "gmail"
    // OAuth tokens (encrypted in production)
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
    // Provider-specific data
    accountEmail: varchar("account_email", { length: 255 }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("integrations_tenant_idx").on(table.tenantId),
    uniqueIndex("integrations_tenant_provider_idx").on(table.tenantId, table.provider),
  ]
);

// ============================================================
// EMAIL LOG (processed inbound emails)
// ============================================================

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    gmailMessageId: varchar("gmail_message_id", { length: 100 }),
    threadId: varchar("thread_id", { length: 100 }),
    from: varchar("from_address", { length: 255 }),
    fromName: varchar("from_name", { length: 255 }),
    to: varchar("to_address", { length: 255 }),
    subject: text("subject"),
    bodyPreview: text("body_preview"), // first ~500 chars
    // Parsed data
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    outcome: varchar("outcome", { length: 50 }), // "lead_created", "existing_client", "spam", "ignored"
    // Timestamps
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("email_log_tenant_idx").on(table.tenantId),
    index("email_log_date_idx").on(table.tenantId, table.receivedAt),
    index("email_log_gmail_idx").on(table.gmailMessageId),
  ]
);

// ============================================================
// SUPER ADMINS (platform-level admin users)
// ============================================================

export const superAdmins = pgTable(
  "super_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Links to Supabase auth.users — NOT tenant-scoped
    authId: uuid("auth_id").notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("super_admins_auth_idx").on(table.authId),
    index("super_admins_email_idx").on(table.email),
  ]
);

// ============================================================
// RELATIONS (for Drizzle query builder)
// ============================================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  contacts: many(contacts),
  leads: many(leads),
  proposals: many(proposals),
  projects: many(projects),
  invoices: many(invoices),
  crews: many(crews),
  equipment: many(equipment),
  fieldVisits: many(fieldVisits),
  callLog: many(callLog),
  emailLog: many(emailLog),
  integrations: many(integrations),
  proposalTemplates: many(proposalTemplates),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  crewMemberships: many(crewMembers),
  assignedProjects: many(projects),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contacts.tenantId],
    references: [tenants.id],
  }),
  leads: many(leads),
  proposals: many(proposals),
  projects: many(projects),
  invoices: many(invoices),
  calls: many(callLog),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [leads.tenantId], references: [tenants.id] }),
  contact: one(contacts, {
    fields: [leads.contactId],
    references: [contacts.id],
  }),
  proposals: many(proposals),
  call: one(callLog, { fields: [leads.callLogId], references: [callLog.id] }),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  tenant: one(tenants, {
    fields: [proposals.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, { fields: [proposals.leadId], references: [leads.id] }),
  contact: one(contacts, {
    fields: [proposals.contactId],
    references: [contacts.id],
  }),
  template: one(proposalTemplates, {
    fields: [proposals.templateId],
    references: [proposalTemplates.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [projects.tenantId],
    references: [tenants.id],
  }),
  proposal: one(proposals, {
    fields: [projects.proposalId],
    references: [proposals.id],
  }),
  lead: one(leads, { fields: [projects.leadId], references: [leads.id] }),
  contact: one(contacts, {
    fields: [projects.contactId],
    references: [contacts.id],
  }),
  assignedPls: one(users, {
    fields: [projects.assignedPlsId],
    references: [users.id],
  }),
  invoices: many(invoices),
  fieldVisits: many(fieldVisits),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
  contact: one(contacts, {
    fields: [invoices.contactId],
    references: [contacts.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const crewsRelations = relations(crews, ({ one, many }) => ({
  tenant: one(tenants, { fields: [crews.tenantId], references: [tenants.id] }),
  crewChief: one(users, {
    fields: [crews.crewChiefId],
    references: [users.id],
  }),
  members: many(crewMembers),
  fieldVisits: many(fieldVisits),
  equipment: many(equipment),
}));

export const crewMembersRelations = relations(crewMembers, ({ one }) => ({
  crew: one(crews, { fields: [crewMembers.crewId], references: [crews.id] }),
  user: one(users, { fields: [crewMembers.userId], references: [users.id] }),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  tenant: one(tenants, {
    fields: [equipment.tenantId],
    references: [tenants.id],
  }),
  assignedCrew: one(crews, {
    fields: [equipment.assignedCrewId],
    references: [crews.id],
  }),
}));

export const fieldVisitsRelations = relations(fieldVisits, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [fieldVisits.tenantId],
    references: [tenants.id],
  }),
  project: one(projects, {
    fields: [fieldVisits.projectId],
    references: [projects.id],
  }),
  crew: one(crews, { fields: [fieldVisits.crewId], references: [crews.id] }),
  equipmentAssignments: many(fieldVisitEquipment),
}));

export const callLogRelations = relations(callLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [callLog.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [callLog.contactId],
    references: [contacts.id],
  }),
  lead: one(leads, { fields: [callLog.leadId], references: [leads.id] }),
}));

export const emailLogRelations = relations(emailLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [emailLog.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [emailLog.contactId],
    references: [contacts.id],
  }),
  lead: one(leads, { fields: [emailLog.leadId], references: [leads.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [integrations.tenantId],
    references: [tenants.id],
  }),
}));

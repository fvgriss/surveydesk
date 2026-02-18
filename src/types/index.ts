/**
 * Shared types for SurveyOS.
 *
 * These are inferred from the Drizzle schema so they stay in sync.
 * Use these in API responses and React components.
 */
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "@/db/schema";

// Select types (reading from DB)
export type Tenant = InferSelectModel<typeof schema.tenants>;
export type User = InferSelectModel<typeof schema.users>;
export type Contact = InferSelectModel<typeof schema.contacts>;
export type Lead = InferSelectModel<typeof schema.leads>;
export type ProposalTemplate = InferSelectModel<typeof schema.proposalTemplates>;
export type Proposal = InferSelectModel<typeof schema.proposals>;
export type Project = InferSelectModel<typeof schema.projects>;
export type Invoice = InferSelectModel<typeof schema.invoices>;
export type Payment = InferSelectModel<typeof schema.payments>;
export type Crew = InferSelectModel<typeof schema.crews>;
export type CrewMember = InferSelectModel<typeof schema.crewMembers>;
export type Equipment = InferSelectModel<typeof schema.equipment>;
export type FieldVisit = InferSelectModel<typeof schema.fieldVisits>;
export type CallLogEntry = InferSelectModel<typeof schema.callLog>;

// Insert types (writing to DB)
export type NewContact = InferInsertModel<typeof schema.contacts>;
export type NewLead = InferInsertModel<typeof schema.leads>;
export type NewProposal = InferInsertModel<typeof schema.proposals>;
export type NewProject = InferInsertModel<typeof schema.projects>;
export type NewInvoice = InferInsertModel<typeof schema.invoices>;
export type NewFieldVisit = InferInsertModel<typeof schema.fieldVisits>;

// Enum value types
export type UserRole = User["role"];
export type ContactType = Contact["type"];
export type SurveyType = Lead["surveyType"];
export type LeadStatus = Lead["status"];
export type ProposalStatus = Proposal["status"];
export type ProjectStatus = Project["status"];
export type InvoiceStatus = Invoice["status"];
export type FieldVisitStatus = FieldVisit["status"];

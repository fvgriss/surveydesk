/**
 * Seed script for SurveyOS development
 *
 * Run with: npm run db:seed
 *
 * Seeds a single tenant (surveying firm) with realistic data:
 * - 2 crews, 4 team members
 * - 7 contacts (title companies, realtors, homeowners, etc.)
 * - 4 leads from voice intake
 * - 5 proposals in various statuses
 * - 4 active projects
 * - 6 invoices
 * - 3 equipment items
 * - Field visits for the current week
 * - Call log entries
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Copy .env.example to .env.local and fill in your Supabase connection string.");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

async function seed() {
  console.log("🌱 Seeding SurveyOS database...\n");

  // Clean existing data (in reverse dependency order)
  console.log("  Cleaning existing data...");
  await db.delete(schema.fieldVisitEquipment);
  await db.delete(schema.fieldVisits);
  await db.delete(schema.payments);
  await db.delete(schema.invoices);
  await db.delete(schema.projects);
  await db.delete(schema.proposals);
  await db.delete(schema.proposalTemplates);
  await db.delete(schema.callLog);
  await db.delete(schema.leads);
  await db.delete(schema.contacts);
  await db.delete(schema.equipment);
  await db.delete(schema.crewMembers);
  await db.delete(schema.crews);
  await db.delete(schema.users);
  await db.delete(schema.tenants);

  // ---- TENANT ----
  console.log("  Creating tenant...");
  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      name: "Griss Land Surveying",
      phone: "(512) 555-0100",
      email: "info@grisssurvey.com",
      address: "4200 Medical Pkwy, Suite 200",
      city: "Austin",
      state: "TX",
      zip: "78756",
      plsLicenseNumber: "6842",
      plsLicenseState: "TX",
      insuranceInfo: "General Liability: $1M/$2M, Professional Liability: $1M",
      serviceAreaCounties: "Travis, Williamson, Hays, Bastrop, Caldwell",
      defaultSurveyTypes: ["boundary", "alta", "topographic", "as_built"],
      proposalTerms:
        "Payment is due upon receipt of deliverables unless otherwise agreed. A 50% deposit is required for ALTA/NSPS surveys. Survey is valid as of the date of field work. Licensed Professional Land Surveyor, State of Texas #6842.",
      invoiceNotes:
        "Please remit payment within 15 days. Checks payable to Griss Land Surveying. Online payment available via the link above.",
    })
    .returning();

  const tenantId = tenant.id;

  // ---- USERS ----
  // Note: auth_id would normally come from Supabase Auth.
  // For seeding, we use placeholder UUIDs. Replace after first real signup.
  console.log("  Creating users...");
  const [ownerUser, officeUser, crewChief1, crewChief2] = await db
    .insert(schema.users)
    .values([
      {
        tenantId,
        authId: "0f24ead2-3283-4e4b-a872-257eab3f2e9d",
        email: "vancefgriss@gmail.com",
        fullName: "Vance Griss",
        phone: "(512) 555-0101",
        role: "owner" as const,
      },
      {
        tenantId,
        authId: "00000000-0000-0000-0000-000000000002",
        email: "office@grisssurvey.com",
        fullName: "Jenny Griss",
        phone: "(512) 555-0102",
        role: "office_manager" as const,
      },
      {
        tenantId,
        authId: "00000000-0000-0000-0000-000000000003",
        email: "tony@grisssurvey.com",
        fullName: "Tony Alvarez",
        phone: "(512) 555-0103",
        role: "crew_chief" as const,
      },
      {
        tenantId,
        authId: "00000000-0000-0000-0000-000000000004",
        email: "marcus@grisssurvey.com",
        fullName: "Marcus Johnson",
        phone: "(512) 555-0104",
        role: "crew_chief" as const,
      },
    ])
    .returning();

  // ---- CREWS ----
  console.log("  Creating crews...");
  const [crewA, crewB] = await db
    .insert(schema.crews)
    .values([
      { tenantId, name: "Crew A", crewChiefId: crewChief1.id },
      { tenantId, name: "Crew B", crewChiefId: crewChief2.id },
    ])
    .returning();

  await db.insert(schema.crewMembers).values([
    { crewId: crewA.id, userId: crewChief1.id },
    { crewId: crewB.id, userId: crewChief2.id },
  ]);

  // ---- EQUIPMENT ----
  console.log("  Creating equipment...");
  const [totalStation, gps1, gps2] = await db
    .insert(schema.equipment)
    .values([
      {
        tenantId,
        name: "Trimble S7 Total Station",
        type: "total_station" as const,
        serialNumber: "TS-2024-8841",
        status: "in_field" as const,
        assignedCrewId: crewA.id,
      },
      {
        tenantId,
        name: "Trimble R12i GPS #1",
        type: "gps_receiver" as const,
        serialNumber: "GPS-2023-4412",
        status: "in_field" as const,
        assignedCrewId: crewA.id,
      },
      {
        tenantId,
        name: "Trimble R12i GPS #2",
        type: "gps_receiver" as const,
        serialNumber: "GPS-2023-4413",
        status: "in_field" as const,
        assignedCrewId: crewB.id,
      },
    ])
    .returning();

  // ---- CONTACTS ----
  console.log("  Creating contacts...");
  const [
    sarahMitchell,
    jamesThornton,
    rebeccaHayes,
    mikeRodriguez,
    karenWu,
    davidPatterson,
    lisaChen,
  ] = await db
    .insert(schema.contacts)
    .values([
      {
        tenantId,
        type: "title_company" as const,
        firstName: "Sarah",
        lastName: "Mitchell",
        companyName: "Lone Star Title Co.",
        email: "vance@terrainplot.com",
        phone: "(512) 555-0142",
        address: "1100 S Congress Ave",
        city: "Austin",
        state: "TX",
        zip: "78704",
        defaultPaymentTermsDays: 30,
        referralSource: "Repeat client",
      },
      {
        tenantId,
        type: "homeowner" as const,
        firstName: "James",
        lastName: "Thornton",
        email: "vance@terrainplot.com",
        phone: "(512) 555-0198",
        address: "789 Elm St",
        city: "Round Rock",
        state: "TX",
        zip: "78664",
      },
      {
        tenantId,
        type: "attorney" as const,
        firstName: "Rebecca",
        lastName: "Hayes",
        companyName: "Hayes & Associates Law",
        email: "vance@terrainplot.com",
        phone: "(512) 555-0267",
        address: "500 W 5th St, Suite 300",
        city: "Austin",
        state: "TX",
        zip: "78701",
        defaultPaymentTermsDays: 30,
        referralSource: "Referral from Lone Star Title",
      },
      {
        tenantId,
        type: "realtor" as const,
        firstName: "Mike",
        lastName: "Rodriguez",
        companyName: "Summit Realty Group",
        email: "vance@terrainplot.com",
        phone: "(512) 555-0331",
        address: "3500 N Lamar Blvd",
        city: "Austin",
        state: "TX",
        zip: "78705",
        referralSource: "Google search",
      },
      {
        tenantId,
        type: "lender" as const,
        firstName: "Karen",
        lastName: "Wu",
        companyName: "First National Lending",
        email: "vance@terrainplot.com",
        phone: "(512) 555-0415",
        address: "200 Congress Ave, Suite 1200",
        city: "Austin",
        state: "TX",
        zip: "78701",
        defaultPaymentTermsDays: 15,
      },
      {
        tenantId,
        type: "homeowner" as const,
        firstName: "David",
        lastName: "Patterson",
        email: "vance@terrainplot.com",
        phone: "(512) 555-0488",
        address: "8830 Mockingbird Ln",
        city: "Austin",
        state: "TX",
        zip: "78745",
        referralSource: "Neighbor referral",
      },
      {
        tenantId,
        type: "title_company" as const,
        firstName: "Lisa",
        lastName: "Chen",
        companyName: "Bluebonnet Title",
        email: "vance@terrainplot.com",
        phone: "(512) 555-0523",
        address: "8300 N MoPac, Suite 400",
        city: "Austin",
        state: "TX",
        zip: "78759",
        defaultPaymentTermsDays: 30,
        referralSource: "Industry conference",
      },
    ])
    .returning();

  // ---- PROPOSAL TEMPLATES ----
  console.log("  Creating proposal templates...");
  const [boundaryTemplate, altaTemplate, topoTemplate] = await db
    .insert(schema.proposalTemplates)
    .values([
      {
        tenantId,
        name: "Standard Boundary Survey",
        surveyType: "boundary" as const,
        defaultBasePrice: "1600.00",
        defaultPricingMode: "fixed" as const,
        validDays: 30,
        defaultScopeItems: [
          { task: "Record research", description: "Review deeds, plats, and prior surveys", includedByDefault: true },
          { task: "Monument search", description: "Locate existing property corners and monuments", includedByDefault: true },
          { task: "Field traverse", description: "Establish survey control and measure boundaries", includedByDefault: true },
          { task: "Boundary calculations", description: "Compute boundary lines and areas", includedByDefault: true },
          { task: "Plat preparation", description: "Draft boundary survey plat", includedByDefault: true },
          { task: "Legal description", description: "Write metes and bounds legal description", includedByDefault: false },
          { task: "Corner monumentation", description: "Set iron rods at property corners", includedByDefault: true },
          { task: "Digital deliverables", description: "DWG/PDF files of survey plat", includedByDefault: false },
        ],
        termsAndConditions: tenant.proposalTerms,
      },
      {
        tenantId,
        name: "ALTA/NSPS Land Title Survey",
        surveyType: "alta" as const,
        defaultBasePrice: "4200.00",
        defaultPricingMode: "fixed" as const,
        validDays: 30,
        defaultScopeItems: [
          { task: "Record research", description: "Review deeds, plats, easements, title commitment", includedByDefault: true },
          { task: "Monument search", description: "Locate existing property corners", includedByDefault: true },
          { task: "Field traverse & boundary", description: "Establish control, measure boundaries", includedByDefault: true },
          { task: "Improvements survey", description: "Locate all buildings, drives, utilities", includedByDefault: true },
          { task: "Flood zone determination", description: "FEMA flood zone certification", includedByDefault: true },
          { task: "Table A items", description: "Optional ALTA/NSPS Table A items as requested", includedByDefault: true },
          { task: "ALTA/NSPS plat", description: "Prepare survey per 2021 ALTA/NSPS standards", includedByDefault: true },
          { task: "Zoning compliance", description: "Zoning classification and setback analysis", includedByDefault: false },
          { task: "Digital deliverables", description: "DWG/PDF files", includedByDefault: true },
        ],
        termsAndConditions: tenant.proposalTerms,
      },
      {
        tenantId,
        name: "Topographic Survey",
        surveyType: "topographic" as const,
        defaultBasePrice: "2800.00",
        defaultPricingMode: "fixed" as const,
        validDays: 30,
        defaultScopeItems: [
          { task: "Field survey", description: "Collect topographic data points", includedByDefault: true },
          { task: "Control establishment", description: "Set survey control points", includedByDefault: true },
          { task: "Contour mapping", description: "Generate contour lines at 1-foot intervals", includedByDefault: true },
          { task: "Feature location", description: "Locate trees, utilities, structures", includedByDefault: true },
          { task: "Topo map preparation", description: "Draft topographic survey map", includedByDefault: true },
          { task: "Digital terrain model", description: "3D surface model (TIN/DTM)", includedByDefault: false },
          { task: "Digital deliverables", description: "DWG/PDF files", includedByDefault: true },
        ],
        termsAndConditions: tenant.proposalTerms,
      },
    ])
    .returning();

  // ---- CALL LOG (simulating today's Retell AI calls) ----
  console.log("  Creating call log...");
  const today = new Date();
  const todayAt = (h: number, m: number) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const [call1, call2, call3, call4] = await db
    .insert(schema.callLog)
    .values([
      {
        tenantId,
        retellCallId: "call_abc123",
        direction: "inbound" as const,
        callerPhone: "(512) 555-0142",
        duration: 222,
        summary: "Needs boundary survey at 4521 Ridgecrest Dr. Closing in 3 weeks. Wants quote today.",
        transcript: "AI: Good morning, Griss Land Surveying. How can I help you today?\nCaller: Hi, this is Sarah from Lone Star Title. We have a closing coming up and need a boundary survey at 4521 Ridgecrest Drive in Austin...",
        contactId: sarahMitchell.id,
        outcome: "lead_created",
        startedAt: todayAt(9, 15),
        endedAt: todayAt(9, 19),
      },
      {
        tenantId,
        retellCallId: "call_def456",
        direction: "inbound" as const,
        callerPhone: "(512) 555-0198",
        duration: 138,
        summary: "Checking status on his ALTA survey at 789 Elm St. Informed field work is Thursday.",
        contactId: jamesThornton.id,
        outcome: "status_update",
        startedAt: todayAt(10, 30),
        endedAt: todayAt(10, 32),
      },
      {
        tenantId,
        retellCallId: "call_ghi789",
        direction: "inbound" as const,
        callerPhone: "(512) 555-0331",
        duration: 255,
        summary: "New listing needs topo survey for a 2.5-acre lot on FM 1431. Wants it done within 2 weeks.",
        contactId: mikeRodriguez.id,
        outcome: "lead_created",
        startedAt: todayAt(11, 45),
        endedAt: todayAt(11, 49),
      },
      {
        tenantId,
        retellCallId: "call_jkl012",
        direction: "inbound" as const,
        callerPhone: "(512) 555-0523",
        duration: 112,
        summary: "Needs ALTA/NSPS for commercial property at 1200 Congress Ave. Lender requirement.",
        contactId: lisaChen.id,
        outcome: "lead_created",
        startedAt: todayAt(14, 0),
        endedAt: todayAt(14, 2),
      },
    ])
    .returning();

  // ---- LEADS ----
  console.log("  Creating leads...");
  const [lead1, lead2, lead3, lead4] = await db
    .insert(schema.leads)
    .values([
      {
        tenantId,
        contactId: sarahMitchell.id,
        propertyAddress: "4521 Ridgecrest Dr, Austin, TX 78731",
        parcelNumber: "01-2345-0067",
        surveyType: "boundary" as const,
        source: "phone_intake" as const,
        status: "qualifying" as const,
        urgency: "high" as const,
        notes: "Closing in 3 weeks. Client needs quote ASAP.",
        callLogId: call1.id,
      },
      {
        tenantId,
        contactId: mikeRodriguez.id,
        propertyAddress: "Lot 12, Block 3, FM 1431, Cedar Park, TX 78613",
        parcelNumber: "14-0892-0012",
        surveyType: "topographic" as const,
        source: "phone_intake" as const,
        status: "new" as const,
        urgency: "medium" as const,
        notes: "2.5-acre lot. New listing — realtor wants fast turnaround.",
        callLogId: call3.id,
      },
      {
        tenantId,
        contactId: lisaChen.id,
        propertyAddress: "1200 Congress Ave, Austin, TX 78701",
        parcelNumber: "02-1100-0044",
        surveyType: "alta" as const,
        source: "phone_intake" as const,
        status: "proposal_sent" as const,
        urgency: "medium" as const,
        notes: "Commercial property. Lender requires ALTA/NSPS.",
        callLogId: call4.id,
      },
      {
        tenantId,
        contactId: davidPatterson.id,
        propertyAddress: "8830 Mockingbird Ln, Austin, TX 78745",
        parcelNumber: "08-4421-0019",
        surveyType: "boundary" as const,
        source: "phone_intake" as const,
        status: "new" as const,
        urgency: "low" as const,
        notes: "Fence line dispute with neighbor. Needs to confirm property corners.",
      },
    ])
    .returning();

  // Update call log with lead references
  await db
    .update(schema.callLog)
    .set({ leadId: lead1.id })
    .where(eq(schema.callLog.id, call1.id));
  await db
    .update(schema.callLog)
    .set({ leadId: lead2.id })
    .where(eq(schema.callLog.id, call3.id));
  await db
    .update(schema.callLog)
    .set({ leadId: lead3.id })
    .where(eq(schema.callLog.id, call4.id));

  // ---- PROPOSALS ----
  console.log("  Creating proposals...");
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
  const validUntil = thirtyDaysOut.toISOString().split("T")[0];

  const feb3 = new Date(2026, 1, 3);
  const feb5 = new Date(2026, 1, 5);
  const feb8 = new Date(2026, 1, 8);
  const feb10 = new Date(2026, 1, 10);
  const feb11 = new Date(2026, 1, 11);
  const jan28 = new Date(2026, 0, 28);
  const jan30 = new Date(2026, 0, 30);

  const [prop1, prop2, prop3, prop4, prop5] = await db
    .insert(schema.proposals)
    .values([
      {
        tenantId,
        contactId: karenWu.id,
        propertyAddress: "3200 Lake Austin Blvd, Austin, TX 78703",
        surveyType: "alta" as const,
        templateId: altaTemplate.id,
        pricingMode: "fixed" as const,
        scopeItems: altaTemplate.defaultScopeItems.map((s) => ({
          task: s.task,
          description: s.description,
          included: s.includedByDefault,
        })),
        lineItems: [{ description: "ALTA/NSPS Land Title Survey", quantity: 1, unitPrice: 4200, total: 4200 }],
        subtotal: "4200.00",
        total: "4200.00",
        validUntil: "2026-03-05",
        depositRequired: true,
        depositPercent: 50,
        status: "accepted" as const,
        sentAt: feb3,
        viewedAt: feb3,
        acceptedAt: feb5,
        acceptedByName: "Karen Wu",
        acceptedByEmail: "vance@terrainplot.com",
      },
      {
        tenantId,
        contactId: rebeccaHayes.id,
        propertyAddress: "1450 Barton Creek Blvd, Austin, TX 78735",
        surveyType: "boundary" as const,
        templateId: boundaryTemplate.id,
        pricingMode: "fixed" as const,
        scopeItems: boundaryTemplate.defaultScopeItems.map((s) => ({
          task: s.task,
          description: s.description,
          included: s.includedByDefault,
        })),
        lineItems: [{ description: "Boundary Survey", quantity: 1, unitPrice: 1800, total: 1800 }],
        subtotal: "1800.00",
        total: "1800.00",
        validUntil: "2026-03-10",
        status: "sent" as const,
        sentAt: feb10,
        viewedAt: feb11,
      },
      {
        tenantId,
        leadId: lead3.id,
        contactId: lisaChen.id,
        propertyAddress: "1200 Congress Ave, Austin, TX 78701",
        surveyType: "alta" as const,
        templateId: altaTemplate.id,
        pricingMode: "fixed" as const,
        scopeItems: altaTemplate.defaultScopeItems.map((s) => ({
          task: s.task,
          description: s.description,
          included: s.includedByDefault,
        })),
        lineItems: [
          { description: "ALTA/NSPS Land Title Survey", quantity: 1, unitPrice: 4800, total: 4800 },
          { description: "Zoning compliance report", quantity: 1, unitPrice: 700, total: 700 },
        ],
        subtotal: "5500.00",
        total: "5500.00",
        validUntil: "2026-03-15",
        depositRequired: true,
        depositPercent: 50,
        status: "draft" as const,
      },
      {
        tenantId,
        contactId: sarahMitchell.id,
        propertyAddress: "9020 Great Hills Trail, Austin, TX 78759",
        surveyType: "topographic" as const,
        templateId: topoTemplate.id,
        pricingMode: "fixed" as const,
        scopeItems: topoTemplate.defaultScopeItems.map((s) => ({
          task: s.task,
          description: s.description,
          included: s.includedByDefault,
        })),
        lineItems: [{ description: "Topographic Survey", quantity: 1, unitPrice: 3200, total: 3200 }],
        subtotal: "3200.00",
        total: "3200.00",
        validUntil: "2026-03-08",
        status: "viewed" as const,
        sentAt: feb8,
        viewedAt: new Date(2026, 1, 12),
      },
      {
        tenantId,
        contactId: jamesThornton.id,
        propertyAddress: "789 Elm St, Round Rock, TX 78664",
        surveyType: "alta" as const,
        templateId: altaTemplate.id,
        pricingMode: "fixed" as const,
        scopeItems: altaTemplate.defaultScopeItems.map((s) => ({
          task: s.task,
          description: s.description,
          included: s.includedByDefault,
        })),
        lineItems: [{ description: "ALTA/NSPS Land Title Survey", quantity: 1, unitPrice: 3800, total: 3800 }],
        subtotal: "3800.00",
        total: "3800.00",
        validUntil: "2026-02-28",
        depositRequired: true,
        depositPercent: 50,
        status: "accepted" as const,
        sentAt: jan28,
        viewedAt: jan28,
        acceptedAt: jan30,
        acceptedByName: "James Thornton",
        acceptedByEmail: "vance@terrainplot.com",
      },
    ])
    .returning();

  // ---- PROJECTS ----
  console.log("  Creating projects...");
  const [proj1, proj2, proj3, proj4] = await db
    .insert(schema.projects)
    .values([
      {
        tenantId,
        proposalId: prop1.id,
        contactId: karenWu.id,
        propertyAddress: "3200 Lake Austin Blvd, Austin, TX 78703",
        surveyType: "alta" as const,
        status: "in_progress" as const,
        assignedPlsId: ownerUser.id,
        contractValue: "4200.00",
        totalInvoiced: "2100.00",
        totalPaid: "2100.00",
        taskChecklist: [
          { task: "Record research", description: "Review deeds, plats, easements, title commitment", completed: true, completedAt: "2026-02-06" },
          { task: "Monument search", description: "Locate existing property corners", completed: false },
          { task: "Field traverse & boundary", description: "Establish control, measure boundaries", completed: false },
          { task: "Improvements survey", description: "Locate all buildings, drives, utilities", completed: false },
          { task: "Flood zone determination", description: "FEMA flood zone certification", completed: false },
          { task: "ALTA/NSPS plat", description: "Prepare survey per 2021 ALTA/NSPS standards", completed: false },
        ],
        startedAt: feb5,
      },
      {
        tenantId,
        proposalId: prop5.id,
        contactId: jamesThornton.id,
        propertyAddress: "789 Elm St, Round Rock, TX 78664",
        surveyType: "alta" as const,
        status: "field_complete" as const,
        assignedPlsId: ownerUser.id,
        contractValue: "3800.00",
        totalInvoiced: "1900.00",
        totalPaid: "1900.00",
        taskChecklist: [
          { task: "Record research", description: "Review deeds, plats, easements, title commitment", completed: true, completedAt: "2026-01-31" },
          { task: "Field traverse & boundary", description: "Establish control, measure boundaries", completed: true, completedAt: "2026-02-10" },
          { task: "Improvements survey", description: "Locate all buildings, drives, utilities", completed: true, completedAt: "2026-02-10" },
          { task: "ALTA/NSPS plat", description: "Prepare survey per 2021 ALTA/NSPS standards", completed: false },
        ],
        startedAt: jan30,
        fieldCompletedAt: feb10,
      },
      {
        tenantId,
        contactId: sarahMitchell.id,
        propertyAddress: "2100 S Lamar Blvd, Austin, TX 78704",
        surveyType: "boundary" as const,
        status: "delivered" as const,
        assignedPlsId: ownerUser.id,
        contractValue: "1650.00",
        totalInvoiced: "1650.00",
        totalPaid: "1650.00",
        startedAt: new Date(2026, 0, 20),
        fieldCompletedAt: new Date(2026, 0, 25),
        deliveredAt: new Date(2026, 1, 1),
      },
      {
        tenantId,
        contactId: rebeccaHayes.id,
        propertyAddress: "5500 Balcones Dr, Austin, TX 78731",
        surveyType: "topographic" as const,
        status: "drafting" as const,
        assignedPlsId: ownerUser.id,
        contractValue: "2800.00",
        totalInvoiced: "0.00",
        totalPaid: "0.00",
        startedAt: new Date(2026, 1, 5),
        fieldCompletedAt: new Date(2026, 1, 10),
      },
    ])
    .returning();

  // ---- INVOICES ----
  console.log("  Creating invoices...");
  const [inv1, inv2, inv3, inv4, inv5, inv6] = await db
    .insert(schema.invoices)
    .values([
      {
        tenantId,
        projectId: proj1.id,
        contactId: karenWu.id,
        invoiceNumber: "INV-2026-041",
        type: "deposit" as const,
        status: "paid" as const,
        lineItems: [{ description: "ALTA/NSPS Survey — 50% Deposit", quantity: 1, unitPrice: 2100, total: 2100 }],
        subtotal: "2100.00",
        total: "2100.00",
        amountPaid: "2100.00",
        dueDate: "2026-02-05",
        sentAt: feb5,
        paidAt: feb5,
      },
      {
        tenantId,
        projectId: proj3.id,
        contactId: sarahMitchell.id,
        invoiceNumber: "INV-2026-038",
        type: "final" as const,
        status: "paid" as const,
        lineItems: [{ description: "Boundary Survey — Final", quantity: 1, unitPrice: 1650, total: 1650 }],
        subtotal: "1650.00",
        total: "1650.00",
        amountPaid: "1650.00",
        dueDate: "2026-02-15",
        sentAt: new Date(2026, 1, 1),
        paidAt: feb8,
      },
      {
        tenantId,
        projectId: proj2.id,
        contactId: jamesThornton.id,
        invoiceNumber: "INV-2026-042",
        type: "deposit" as const,
        status: "paid" as const,
        lineItems: [{ description: "ALTA/NSPS Survey — 50% Deposit", quantity: 1, unitPrice: 1900, total: 1900 }],
        subtotal: "1900.00",
        total: "1900.00",
        amountPaid: "1900.00",
        dueDate: "2026-01-30",
        sentAt: jan30,
        paidAt: new Date(2026, 0, 31),
      },
      {
        tenantId,
        projectId: proj1.id,
        contactId: karenWu.id,
        invoiceNumber: "INV-2026-043",
        type: "final" as const,
        status: "draft" as const,
        lineItems: [{ description: "ALTA/NSPS Survey — Final Balance", quantity: 1, unitPrice: 2100, total: 2100 }],
        subtotal: "2100.00",
        total: "2100.00",
        amountPaid: "0.00",
        dueDate: "2026-03-01",
      },
      {
        tenantId,
        contactId: lisaChen.id,
        invoiceNumber: "INV-2026-036",
        type: "final" as const,
        status: "overdue" as const,
        lineItems: [{ description: "Boundary Survey — 800 W 5th St", quantity: 1, unitPrice: 2400, total: 2400 }],
        subtotal: "2400.00",
        total: "2400.00",
        amountPaid: "0.00",
        dueDate: "2026-01-30",
        sentAt: new Date(2026, 0, 15),
      },
      {
        tenantId,
        contactId: mikeRodriguez.id,
        invoiceNumber: "INV-2026-034",
        type: "final" as const,
        status: "sent" as const,
        lineItems: [{ description: "Topographic Survey — 11400 Jollyville Rd", quantity: 1, unitPrice: 1800, total: 1800 }],
        subtotal: "1800.00",
        total: "1800.00",
        amountPaid: "0.00",
        dueDate: "2026-02-25",
        sentAt: feb10,
      },
    ])
    .returning();

  // ---- PAYMENTS ----
  console.log("  Creating payments...");
  await db.insert(schema.payments).values([
    { tenantId, invoiceId: inv1.id, amount: "2100.00", method: "credit_card" as const, receivedAt: feb5 },
    { tenantId, invoiceId: inv2.id, amount: "1650.00", method: "check" as const, checkNumber: "4821", receivedAt: feb8 },
    { tenantId, invoiceId: inv3.id, amount: "1900.00", method: "ach" as const, receivedAt: new Date(2026, 0, 31) },
  ]);

  // ---- FIELD VISITS (current week) ----
  console.log("  Creating field visits...");

  // Get next Monday
  const getNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  const monday = getNextMonday();
  const dayOf = (offset: number) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  await db.insert(schema.fieldVisits).values([
    // Crew A
    {
      tenantId,
      projectId: proj1.id,
      crewId: crewA.id,
      scheduledDate: dayOf(0),
      timeWindow: "full_day" as const,
      estimatedDurationHours: "8.0",
      status: "confirmed" as const,
      accessNotes: "Side gate unlocked. Park on street.",
    },
    {
      tenantId,
      projectId: proj3.id,
      crewId: crewA.id,
      scheduledDate: dayOf(1),
      timeWindow: "morning" as const,
      estimatedDurationHours: "4.0",
      status: "confirmed" as const,
    },
    {
      tenantId,
      projectId: proj4.id,
      crewId: crewA.id,
      scheduledDate: dayOf(2),
      timeWindow: "full_day" as const,
      estimatedDurationHours: "8.0",
      status: "confirmed" as const,
      accessNotes: "Meet Rebecca Hayes at property. Gate code: 4472.",
    },
    {
      tenantId,
      projectId: proj2.id,
      crewId: crewA.id,
      scheduledDate: dayOf(3),
      timeWindow: "full_day" as const,
      estimatedDurationHours: "8.0",
      status: "scheduled" as const,
      accessNotes: "Call James Thornton 30 min before arrival.",
    },
    // Crew B
    {
      tenantId,
      projectId: proj3.id,
      crewId: crewB.id,
      scheduledDate: dayOf(0),
      timeWindow: "morning" as const,
      estimatedDurationHours: "4.0",
      status: "confirmed" as const,
    },
    {
      tenantId,
      projectId: proj1.id,
      crewId: crewB.id,
      scheduledDate: dayOf(2),
      timeWindow: "full_day" as const,
      estimatedDurationHours: "8.0",
      status: "scheduled" as const,
    },
    {
      tenantId,
      projectId: proj4.id,
      crewId: crewB.id,
      scheduledDate: dayOf(4),
      timeWindow: "full_day" as const,
      estimatedDurationHours: "8.0",
      status: "confirmed" as const,
    },
  ]);

  console.log("\n✅ Seed complete!");
  console.log(`   Tenant: ${tenant.name}`);
  console.log(`   Users: 4 (owner, office manager, 2 crew chiefs)`);
  console.log(`   Contacts: 7`);
  console.log(`   Leads: 4`);
  console.log(`   Proposals: 5 (1 draft, 1 sent, 1 viewed, 2 accepted)`);
  console.log(`   Projects: 4 (in_progress, field_complete, delivered, drafting)`);
  console.log(`   Invoices: 6 (3 paid, 1 draft, 1 overdue, 1 sent)`);
  console.log(`   Call log: 4 entries`);
  console.log(`   Crews: 2, Equipment: 3`);
  console.log(`   Field visits: 7 (this week)`);

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

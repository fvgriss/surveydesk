/**
 * Quick script to add a fake Retell call + lead to test the Intake page.
 * Run with: npx tsx src/db/seed-call.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

async function seedCall() {
  console.log("Adding test call + lead...\n");

  // Get tenant
  const [tenant] = await db.select().from(schema.tenants).limit(1);
  if (!tenant) {
    console.error("No tenant found. Run the main seed first.");
    process.exit(1);
  }
  const tenantId = tenant.id;

  // Create a new contact (the caller)
  const [contact] = await db
    .insert(schema.contacts)
    .values({
      tenantId,
      firstName: "Sarah",
      lastName: "Mitchell",
      companyName: null,
      type: "homeowner",
      phone: "(512) 555-0199",
      email: "vance@terrainplot.com",
    })
    .returning();

  console.log("  Created contact:", contact.firstName, contact.lastName);

  // Create a call log entry (simulating a Retell call)
  const [call] = await db
    .insert(schema.callLog)
    .values({
      tenantId,
      retellCallId: "call_test_" + Date.now(),
      retellAgentId: "agent_test",
      direction: "inbound",
      callerPhone: "(512) 555-0199",
      duration: 147,
      summary:
        "Homeowner Sarah Mitchell called about a boundary survey for a property she's purchasing at 2847 Ridgeview Trail, Austin TX 78731. Needs it done within 2 weeks for closing. Gate code is #4521. Title company is Lone Star Title.",
      transcript:
        "Agent: Hello, this is Griss Land Surveying, how can I help you today?\nCaller: Hi, I'm buying a house and my title company said I need a boundary survey done before closing.\nAgent: Sure thing, I can help with that. Can I get your name?\nCaller: Sarah Mitchell.\nAgent: Great, Sarah. And what's the property address?\nCaller: It's 2847 Ridgeview Trail in Austin, 78731.\nAgent: Got it. And when's your closing date?\nCaller: March 1st, so I'd need it done in the next couple weeks.\nAgent: Okay, we should be able to fit that in. Any gate codes or access issues we should know about?\nCaller: Yeah, the gate code is 4521.\nAgent: Perfect. I'll have our office put together a quote and get back to you within a few hours. What's the best email for that?\nCaller: sarah.mitchell@gmail.com\nAgent: Got it. We'll have a quote ready for you shortly. Thanks for calling Griss Land Surveying.\nCaller: Thank you!",
      outcome: "lead_created",
      contactId: contact.id,
      startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
      endedAt: new Date(Date.now() - 7 * 60 * 1000),
    })
    .returning();

  console.log("  Created call log:", call.id);

  // Create a lead from the call
  const [lead] = await db
    .insert(schema.leads)
    .values({
      tenantId,
      contactId: contact.id,
      callLogId: call.id,
      propertyAddress: "2847 Ridgeview Trail, Austin, TX 78731",
      surveyType: "boundary",
      source: "phone_intake",
      status: "new",
      urgency: "high",
      notes:
        "Buyer needs boundary survey before closing on March 1st. Gate code #4521. Title company: Lone Star Title.",
    })
    .returning();

  // Link lead back to call
  await db
    .update(schema.callLog)
    .set({ leadId: lead.id })
    .where(eq(schema.callLog.id, call.id));

  console.log("  Created lead:", lead.id);
  console.log("\nDone! Check the Intake page — you should see the call and lead.\n");

  await client.end();
}

seedCall().catch(console.error);

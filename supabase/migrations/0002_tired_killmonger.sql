CREATE TYPE "public"."prospect_status" AS ENUM('new', 'contacted', 'booked', 'converted', 'lost');--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_name" varchar(255) NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"firm_size" varchar(100),
	"current_tools" text,
	"pain_points" text,
	"interest_level" varchar(20),
	"status" "prospect_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"follow_up_sent_at" timestamp with time zone,
	"sms_sent_at" timestamp with time zone,
	"call_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "prospects_status_idx" ON "prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prospects_created_idx" ON "prospects" USING btree ("created_at");
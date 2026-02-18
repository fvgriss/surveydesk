# SurveyOS

Operations platform for small land surveying firms. AI voice intake, proposal management, crew scheduling, and billing — all in one place.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Supabase** (Postgres, Auth, Storage)
- **Drizzle ORM** (type-safe database queries)
- **Retell AI** (voice agent for phone intake)
- **Stripe** (payment links for invoices)
- **Twilio** (SMS notifications)
- **Resend** (transactional email)
- Deployed on **Vercel**

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd surveyos
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** — copy the URL and anon key
3. Go to **Settings > Database** — copy the connection string (URI)

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials. The other services (Retell, Stripe, Twilio, Resend) can be added later as you build each module.

### 4. Push the database schema

```bash
npm run db:push
```

This creates all tables in your Supabase Postgres database.

### 5. Seed development data

```bash
npm run db:seed
```

Populates the database with a sample surveying firm ("Griss Land Surveying") including contacts, leads, proposals, projects, invoices, crews, and call log entries.

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Deploy to Vercel

```bash
npx vercel
```

Add your `.env.local` variables in the Vercel dashboard under **Settings > Environment Variables**.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, signup (public)
│   ├── (dashboard)/     # Main app (authenticated)
│   │   ├── dashboard/   # Pipeline overview
│   │   ├── intake/      # AI call log + leads
│   │   ├── proposals/   # Proposal builder + tracking
│   │   ├── schedule/    # Crew calendar
│   │   └── billing/     # Invoices + payments
│   └── api/
│       ├── retell/      # Voice agent webhook + tool calls
│       └── ...          # CRUD endpoints
├── db/
│   ├── schema.ts        # Complete Drizzle schema (all tables)
│   ├── index.ts         # Database connection
│   └── seed.ts          # Development seed data
├── lib/
│   ├── supabase/        # Auth helpers (client, server, middleware)
│   └── utils/           # Shared utilities
└── types/
    └── index.ts         # TypeScript types (inferred from schema)
```

## Database Schema

13 tables covering the full surveying workflow:

| Table | Purpose |
|-------|---------|
| `tenants` | Surveying firms (multi-tenant) |
| `users` | Team members with roles |
| `contacts` | Clients (title companies, realtors, homeowners, etc.) |
| `leads` | Potential projects from intake |
| `proposal_templates` | Reusable scope + pricing templates by survey type |
| `proposals` | Quotes sent to clients |
| `projects` | Active jobs (created when proposals are accepted) |
| `invoices` | Billing with Stripe payment links |
| `payments` | Payment records |
| `crews` | Field crews with assigned members |
| `equipment` | Survey instruments tracked by crew |
| `field_visits` | Scheduled crew visits to job sites |
| `call_log` | Retell AI voice agent call records |

All tables have `tenant_id` for multi-tenant isolation via Postgres RLS.

## Retell AI Voice Agent

The voice agent handles inbound calls and can:

- **Capture new leads** — collects property address, survey type, caller info
- **Check project status** — looks up projects by address and gives plain-English updates
- **Check schedule availability** — reports if crews have openings on a given date
- **Transfer calls** — falls back to the owner's cell when needed

Configuration:
1. Create an agent at [retellai.com](https://www.retellai.com)
2. Set the webhook URL to `https://your-app.vercel.app/api/retell/webhook`
3. Set the tool call URL to `https://your-app.vercel.app/api/retell/tool-call`
4. Add your agent ID and API key to `.env.local`

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:push      # Push schema to database
npm run db:generate  # Generate migration files
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio (DB browser)
npm run db:seed      # Seed development data
```

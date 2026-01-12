# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**ArubaCRM** is a sales outreach tracking CRM for health systems. It helps sales teams manage accounts, opportunities, contacts, and track outreach cadence with AI-assisted email drafting.

**Product Context:** The products sold are IMO Health solutions (Core, Coding Intelligence, Discovery, Periop, Procedure, Medical Necessity, Precision Sets, Normalize).

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Frontend:** React 19, Tailwind CSS v4, Recharts
- **Database:** Supabase (PostgreSQL) with Row-Level Security enabled
- **Auth:** Simple password-based auth with HTTP-only cookies (shared `APP_PASSWORD`)
- **LLM:** Anthropic SDK for AI-powered email prompt generation
- **Testing:** Vitest
- **Deployment:** Vercel

## Development Commands

```bash
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run start    # Run production server
npm run lint     # ESLint
npm run test     # Vitest
```

## Environment Setup

Copy `env.example` to `.env.local` and configure:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `APP_PASSWORD` - Single password for app access

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with AppShell
│   ├── page.tsx            # Redirects to /todo
│   ├── login/              # Password authentication
│   ├── todo/               # Daily outreach to-do list (primary view)
│   ├── dashboard/          # Activity metrics & charts
│   ├── accounts/           # Health system management
│   ├── opportunities/      # Pipeline management
│   ├── contacts/           # Cross-account contact list
│   └── api/auth/           # Login/logout API
├── components/
│   ├── AppShell.tsx        # Root wrapper (nav visibility)
│   ├── Navigation.tsx      # Top nav with desktop/mobile menus
│   ├── ContactHistoryModal.tsx  # Outreach history modal
│   └── Logo.tsx            # SVG logo
└── lib/
    ├── supabase.ts         # Supabase client, types, product definitions
    └── emailPrompt.ts      # LLM prompt builder for outreach emails
```

## Database Schema

### Current Tables

1. **health_systems** - Customer accounts (health systems)
2. **opportunities** - Sales opportunities tied to health systems
3. **contacts** - People at health systems
4. **outreach_logs** - Email/call tracking per contact

### Important Data Model Note

**Contacts should be linkable to BOTH opportunities AND accounts independently.** The current schema has `opportunity_id` as optional on contacts, but the intended design is a proper CRM relational structure where contacts can exist at the account level and/or be associated with specific opportunities. When modifying the data model, maintain this flexibility.

### Key Relationships

- Health System → many Opportunities
- Health System → many Contacts (directly)
- Opportunity → many Contacts
- Contact → many Outreach Logs

## Key Features

### Daily To-Do (`/todo`)
- Lists contacts due for outreach based on cadence (default 10 business days)
- Business day logic (excludes weekends)
- "Rollover" badges for overdue contacts
- Inline action logging (Email/Called toggles with notes)
- LLM-powered email prompt generation (copy to clipboard)

### Dashboard (`/dashboard`)
- Activity metrics with bar charts (calls vs emails)
- Period filters (weekly, monthly, annual)
- Recent activity table

### Opportunities (`/opportunities`)
- Filter by status: Prospect, Active, Won
- Track contacts and last outreach per opportunity

### Accounts (`/accounts`)
- CRUD for health systems
- View associated opportunities and contacts

## LLM Email Integration

The `buildLlmPromptForContact()` function in `src/lib/emailPrompt.ts` generates detailed B2B sales email prompts including:
- Contact details (name, role, company)
- Product-specific context for all 8 IMO Health products
- Internal notes (capped at 500 chars)

**Current implementation:** Users copy the generated prompt and paste into Claude manually.

**Future consideration:** Direct API calls to generate emails in-app may be added later.

## Authentication

- Single shared password (`APP_PASSWORD`) protects all routes except `/login` and `/api/auth`
- Middleware in `src/middleware.ts` handles auth guards
- 30-day session cookies (HTTP-only, secure)
- Row-Level Security (RLS) is enabled in Supabase

## Code Patterns

### Page Components
- All pages are client components (`'use client'`) using hooks and browser-side Supabase
- Data fetching via `useEffect` with the shared `supabase` client
- Form state management with `useState`

### Imports
- Use path alias: `@/lib/supabase`, `@/components/...`
- All Supabase access and domain types go through `src/lib/supabase.ts`

### Styling
- Tailwind CSS v4 with `@import "tailwindcss"` in globals.css
- Dark mode support via `dark:` prefix classes
- Responsive design with `sm:` breakpoint

### Business Day Logic
Helper functions in todo page: `isBusinessDay()`, `addBusinessDays()`, `countBusinessDays()`
- Skip weekends (Saturday & Sunday)
- Cadence calculations use business days only

## Testing

Tests are in `tests/` directory using Vitest:
- `emailPrompt.test.ts` - Tests for prompt generation and product context

Run with: `npm run test`

## Database Migrations

SQL migration files are in the repo root (`supabase-*.sql`). Run these in the Supabase SQL editor when adding new tables/columns.

When modifying the schema:
1. Update the SQL migration files
2. Run migrations in Supabase
3. Update types in `src/lib/supabase.ts`

## Things to Watch For

1. **Prospect-only logic:** The to-do page only shows contacts from opportunities with `prospect` status
2. **Cascade deletes:** Deleting a health system cascades to opportunities, contacts, and outreach logs
3. **Cadence default:** New contacts default to 10-day cadence
4. **Product enum:** Products are defined in `PRODUCTS` array in `src/lib/supabase.ts` - keep this in sync with `PRODUCT_EMAIL_CONTEXT` in `emailPrompt.ts`

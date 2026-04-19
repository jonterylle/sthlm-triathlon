# STHLM Triathlon 2026 — Funktionärsapp

Volunteer management app for STHLM Triathlon, 9 August 2026, Stora Skuggan, Djurgården.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + Backend | Next.js 14 + TypeScript |
| Styling | Tailwind CSS |
| Database + Auth | Supabase (PostgreSQL + Auth) |
| Email (magic links) | Resend |
| Hosting | Vercel |

## Sprint 0 — Walking Skeleton ✅

- [x] Next.js project with TypeScript + Tailwind
- [x] Supabase auth — passwordless magic link login
- [x] Role-based routing (TL / Sektionsledare / Funktionär)
- [x] TL dashboard (empty shell)
- [x] Funktionär welcome page
- [x] Database schema with RLS policies
- [x] Deployed to Vercel

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase and Resend keys.

## Database Setup

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
After running it, log in once with your email, then run the seed query
at the bottom of the migration file to give yourself the TL role.

## Sprint Plan

| Sprint | Focus | Status |
|--------|-------|--------|
| 0 | Walking skeleton | ✅ Done |
| 1 | Volunteer registration + sections | Nästa |
| 2 | Schedule + conflict detection | — |
| 3 | Invitations + email flow | — |
| 4 | Volunteer mobile view | — |
| 5 | Excel import | — |
| 6 | Race day mode | — |
| 7 | OWASP audit + polish | — |

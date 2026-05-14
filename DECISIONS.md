# Decisions Log — Case 2: Pocket

## Assumptions I made

1. **Currency is INR** — because the brief uses ₹ in the unequal split example. A real product would add currency selection per group.
2. **No phone number auth** — email magic link is simpler and doesn't require Twilio. Roommates typically share email addresses anyway.
3. **One group per page, not a dashboard** — keeps the core loop fast: open group → see balances → settle.
4. **Recurring expenses are soft-scheduled** — the `recur_day` field flags the expense; a cron job (e.g. Vercel Cron or Supabase Edge Function) would auto-insert them monthly. Cron not wired in this version.

## Trade-offs

| Choice | Alternative | Why I picked this |
|--------|------------|-------------------|
| Next.js App Router | Separate React + Express | Single deploy target; server components reduce client JS |
| Supabase Auth (magic link) | Username/password | No password resets to build; frictionless for non-technical roommates |
| RLS policies on all tables | API-layer auth checks | Defense-in-depth; data is safe even if an API route has a bug |
| Greedy netting algorithm | Exact min-transactions (NP-hard) | Greedy gives optimal results for ≤ 20 people; exact algo is overkill |
| Tailwind CSS | Chakra / shadcn/ui | No component library overhead; full control; faster cold build |
| ₹ currency symbol hardcoded | i18n library | Out of scope for time-box; trivial to swap |

## What I de-scoped and why

- **Receipt photo upload** — Supabase Storage + a file input is straightforward, but wiring the upload flow + displaying thumbnails would take ~2h. Cut to hit the time box.
- **Cron for recurring expenses** — Logic is built (recur_day stored, seed data includes recurring expenses) but the auto-generation cron is not wired. Would use Vercel Cron + a route handler.
- **Real-time updates** — Supabase has built-in Realtime. Not wired here; `window.location.reload()` is the pragmatic fallback for a day-long build.
- **Expense deletion** — Intentionally omitted to preserve the audit trail. In production, soft-delete with a `deleted_at` column.

## What I'd do differently with another day

- Add Supabase Realtime so balances update live when a roommate adds an expense
- Wire the recurring expense cron job
- Add receipt photo upload with Supabase Storage
- Add Playwright E2E tests covering the netting algorithm with the 3-person example
- Replace `window.location.reload()` with proper React state mutations via server actions

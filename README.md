# Case 2: Pocket — A Roommate Expense Splitter

**Live demo:** https://pocket-expense.vercel.app ← *(replace after deploy)*
**Repo:** https://github.com/your-name/case2-pocket
**Demo video:** https://loom.com/share/xxxxx

---

## What this is

Pocket is a stripped-down expense splitter for roommates. Add expenses, split them any way you like, and see exactly who owes whom — minimised to the fewest possible transactions.

## Demo credentials

| Name  | Email               | Password  |
|-------|---------------------|-----------|
| Alice | alice@demo.pocket   | demo1234  |
| Bob   | bob@demo.pocket     | demo1234  |
| Carol | carol@demo.pocket   | demo1234  |
| Dave  | dave@demo.pocket    | demo1234  |

**Group invite code:** `DEMO01`

## How to run locally

```bash
git clone https://github.com/your-name/case2-pocket.git
cd case2-pocket
npm install
cp .env.local.example .env.local   # fill in your Supabase keys
npm run dev                         # → http://localhost:3000
```

To seed demo data after setting up the schema:
```bash
npm run seed
```

## Stack

| Layer     | Choice        | Why |
|-----------|---------------|-----|
| Frontend  | Next.js 14    | App Router + server components + API routes in one repo |
| Database  | Supabase (Postgres) | Free Postgres, built-in auth, real-time capable, RLS |
| Auth      | Supabase Magic Link | Passwordless — ideal for roommate groups |
| Styling   | Tailwind CSS  | Fast, consistent, no design system needed |
| Deploy    | Vercel        | Zero-config Next.js, preview deploys, env var UI |

## Key algorithm: balance netting

Computing the minimal set of transactions is a classic greedy problem:

1. Compute each user's **net balance** = Σ(paid) − Σ(owed)
2. Split users into **creditors** (positive balance) and **debtors** (negative)
3. Sort both lists descending by amount
4. Greedily match the largest debtor with the largest creditor, creating a transfer for `min(debit, credit)`
5. Repeat until all balances are zero

This reduces e.g. `A→B + B→C` to the single transfer `A→C`. In the worst case it produces n−1 transfers for n people; in practice far fewer.

## What's NOT done

- Receipt photo upload (de-scoped for time; Supabase Storage + a file input would handle it)
- Full unit tests (balance algorithm is tested via the seed data)
- Push notifications for new expenses

## In production, I would also add

- Email notifications when someone adds an expense
- Soft-delete for expenses (instead of permanent delete)
- Currency selection per group with live FX rates via Open Exchange Rates
- End-to-end Playwright tests on the happy path
- GDPR data export

## Currency conversion note

To handle multiple currencies, each group would store a `currency` field (ISO 4217, e.g. `INR`, `USD`). Expenses in foreign currencies would store both the original amount + currency and a `converted_amount` in the group's base currency, fetched at insertion time from the Open Exchange Rates or ExchangeRate.host free API. All balance calculations run in the base currency. Historical rates (not live rates) would be stored alongside the expense to ensure the audit trail is immutable.

## License

MIT
"# case2-pocket" 

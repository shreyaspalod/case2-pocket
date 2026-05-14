# Pocket — Step-by-Step Deployment Guide
## Supabase (database) → GitHub → Vercel (live URL)

---

## Prerequisites

- A computer with [Node.js 18+](https://nodejs.org) installed
- A free [GitHub](https://github.com) account
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account

---

## PHASE 1 — Set Up Supabase (your database)

### Step 1.1 — Create a new Supabase project

1. Go to **https://supabase.com** and sign in.
2. Click **"New project"**.
3. Fill in:
   - **Project name**: `pocket`
   - **Database password**: choose a strong password (save it somewhere safe)
   - **Region**: pick the one closest to you
4. Click **"Create new project"**. Wait about 60 seconds for it to provision.

---

### Step 1.2 — Run the database schema

1. In the Supabase sidebar, click **"SQL Editor"**.
2. Click **"New query"**.
3. Open the file `supabase/schema.sql` from this project.
4. **Copy the entire contents** and paste it into the SQL editor.
5. Click **"Run"** (or press Ctrl+Enter / Cmd+Enter).
6. You should see: `Success. No rows returned`.

> ✅ Your tables (profiles, groups, group_members, expenses, expense_splits, settlements) are now live.

---

### Step 1.3 — Get your API keys

1. In the Supabase sidebar, click **"Settings"** (gear icon at the bottom).
2. Click **"API"**.
3. Note down (copy):
   - **Project URL** — looks like `https://xyzabc123.supabase.co`
   - **anon / public key** — a long JWT string (safe for the browser)
   - **service_role key** — another JWT (keep this secret, only used in the seed script)

> ⚠️  Never commit these keys to GitHub. The `.gitignore` already excludes `.env.local`.

---

### Step 1.4 — Configure auth redirect URLs

1. In Supabase, go to **Authentication → URL Configuration**.
2. Under **Site URL**, enter: `http://localhost:3000` (for local dev).
3. Under **Redirect URLs**, add:
   - `http://localhost:3000/auth/callback`
   - `https://your-app.vercel.app/auth/callback` ← add this after you deploy
4. Click **Save**.

---

## PHASE 2 — Run Locally

### Step 2.1 — Install dependencies

Open your terminal in the project folder and run:

```bash
npm install
```

---

### Step 2.2 — Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the three values from Step 1.3:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### Step 2.3 — Start the dev server

```bash
npm run dev
```

Visit **http://localhost:3000** — you should see the Pocket landing page.

---

### Step 2.4 — Seed demo data (optional but required for submission)

```bash
npm run seed
```

This creates 4 demo users and a "Demo House" group with sample expenses. After running, you can log in with:

- **alice@demo.pocket** / `demo1234`
- **bob@demo.pocket** / `demo1234`
- Group code: **DEMO01**

> Note: the seed script uses Supabase Auth Admin API (service role key) to create users with passwords. Magic link still works in production for real users.

---

## PHASE 3 — Push to GitHub

### Step 3.1 — Create a GitHub repo

1. Go to **https://github.com/new**.
2. Name it: `case2-pocket`
3. Set it to **Public**.
4. Do **not** tick "Add a README" (we already have one).
5. Click **"Create repository"**.

---

### Step 3.2 — Push the code

Run these commands in your terminal (replace `your-username`):

```bash
git init
git add .
git commit -m "Initial commit: Pocket expense splitter"
git branch -M main
git remote add origin https://github.com/your-username/case2-pocket.git
git push -u origin main
```

> ✅ Your code is now on GitHub.

---

## PHASE 4 — Deploy to Vercel

### Step 4.1 — Import project

1. Go to **https://vercel.com** and sign in with GitHub.
2. Click **"Add New… → Project"**.
3. Find and select your `case2-pocket` repo. Click **"Import"**.

---

### Step 4.2 — Add environment variables

On the "Configure Project" screen, scroll to **"Environment Variables"** and add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` (use your actual Vercel URL) |

> You can add `NEXT_PUBLIC_APP_URL` after the first deploy — just edit it in Vercel → Project Settings → Environment Variables and redeploy.

---

### Step 4.3 — Deploy

1. Leave the framework preset as **Next.js** (auto-detected).
2. Click **"Deploy"**.
3. Wait 1–3 minutes. ☕

When it's done, Vercel gives you a URL like `https://case2-pocket-yourname.vercel.app`.

---

### Step 4.4 — Update Supabase with your live URL

1. Go back to **Supabase → Authentication → URL Configuration**.
2. Change **Site URL** to your Vercel URL: `https://case2-pocket-yourname.vercel.app`
3. Make sure `https://case2-pocket-yourname.vercel.app/auth/callback` is in the **Redirect URLs** list.
4. Click **Save**.

---

### Step 4.5 — Update README

In your `README.md`, replace the placeholder live demo URL with your actual Vercel URL, then push:

```bash
git add README.md
git commit -m "docs: add live demo URL"
git push
```

Vercel auto-redeploys on every push to `main`. ✅

---

## PHASE 5 — Verify deployment

1. Open the Vercel URL in an **incognito window**.
2. Sign in with a magic link (use a real email you own, or the demo credentials).
3. Create a group, add an expense with a custom split, check the Balances tab.
4. Click **Settle up** and record a payment.
5. Open the URL **on your phone**.
6. Run **Export CSV** and verify the file downloads.

If everything works, you're done! 🎉

---

## Common issues

| Problem | Fix |
|---------|-----|
| Build fails: `module not found` | Move the dependency from `devDependencies` to `dependencies` in `package.json` |
| Magic link redirects to an error | Check Supabase → Auth → Redirect URLs includes your live URL + `/auth/callback` |
| RLS blocks all queries | Make sure you're signed in (the user session cookie is set). Try clearing cookies and signing in again. |
| Seed script fails: "User already registered" | Safe to ignore — script handles this. Check if the group was created anyway. |
| `NEXT_PUBLIC_` env vars undefined on Vercel | They must be added in Vercel project settings, not just in `.env.local` (which is gitignored) |

---

## Auto-deploy on every push

Every time you `git push` to `main`, Vercel automatically redeploys. No manual steps needed.

---

*Built with Next.js 14 + Supabase + Vercel. Free tier throughout.*

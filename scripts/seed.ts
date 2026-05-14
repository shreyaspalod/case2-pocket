/**
 * Seed script — creates a "Demo House" group with 4 users and sample expenses.
 * Run: npx tsx scripts/seed.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const DEMO_USERS = [
  { email: 'alice@demo.pocket', name: 'Alice', password: 'demo1234' },
  { email: 'bob@demo.pocket',   name: 'Bob',   password: 'demo1234' },
  { email: 'carol@demo.pocket', name: 'Carol', password: 'demo1234' },
  { email: 'dave@demo.pocket',  name: 'Dave',  password: 'demo1234' },
]

async function seed() {
  console.log('🌱 Seeding demo data...\n')

  // ── Create users ─────────────────────────────────────────
  const userIds: string[] = []

  for (const u of DEMO_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name },
    })
    if (error && !error.message.includes('already been registered')) {
      console.error(`Error creating user ${u.email}:`, error.message)
      continue
    }
    // Fetch by email if already exists
    if (!data?.user) {
      const { data: existing } = await supabase.auth.admin.listUsers()
      const found = existing?.users.find(x => x.email === u.email)
      if (found) userIds.push(found.id)
    } else {
      userIds.push(data.user.id)
    }
    console.log(`✓ User: ${u.name} (${u.email})`)
  }

  if (userIds.length < 4) {
    console.error('Not enough users created. Aborting.')
    process.exit(1)
  }

  const [aliceId, bobId, carolId, daveId] = userIds

  // ── Ensure profiles exist ────────────────────────────────
  await supabase.from('profiles').upsert(
    DEMO_USERS.map((u, i) => ({
      id: userIds[i],
      name: u.name,
      email: u.email,
    })),
    { onConflict: 'id' }
  )

  // ── Create group ─────────────────────────────────────────
  const { data: group, error: grpErr } = await supabase
    .from('groups')
    .insert({ name: 'Demo House', invite_code: 'DEMO01', created_by: aliceId })
    .select()
    .single()

  if (grpErr) {
    // Group might already exist — try fetching it
    const { data: existing } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', 'DEMO01')
      .single()
    if (!existing) { console.error('Could not create/find group'); process.exit(1) }
    console.log(`✓ Group already exists: ${existing.name}`)
  } else {
    console.log(`✓ Group created: ${group!.name} (code: DEMO01)`)
  }

  const { data: grp } = await supabase.from('groups').select('*').eq('invite_code', 'DEMO01').single()
  const groupId = grp!.id

  // ── Add members ──────────────────────────────────────────
  await supabase.from('group_members').upsert(
    userIds.map(uid => ({ group_id: groupId, user_id: uid })),
    { onConflict: 'group_id,user_id' }
  )
  console.log('✓ Added 4 members to Demo House')

  // ── Add expenses ─────────────────────────────────────────
  const expensesData = [
    {
      group_id: groupId,
      paid_by: aliceId,
      description: 'Monthly rent',
      amount: 12000,
      is_recurring: true,
      recur_day: 1,
      splits: [
        { user_id: aliceId, amount: 3000 },
        { user_id: bobId,   amount: 3000 },
        { user_id: carolId, amount: 3000 },
        { user_id: daveId,  amount: 3000 },
      ],
    },
    {
      group_id: groupId,
      paid_by: bobId,
      description: 'Groceries',
      amount: 1200,
      is_recurring: false,
      recur_day: null,
      splits: [
        { user_id: aliceId, amount: 480 },  // 40%
        { user_id: bobId,   amount: 360 },  // 30%
        { user_id: carolId, amount: 360 },  // 30%
      ],
    },
    {
      group_id: groupId,
      paid_by: carolId,
      description: 'Internet bill',
      amount: 800,
      is_recurring: true,
      recur_day: 15,
      splits: [
        { user_id: aliceId, amount: 200 },
        { user_id: bobId,   amount: 200 },
        { user_id: carolId, amount: 200 },
        { user_id: daveId,  amount: 200 },
      ],
    },
    {
      group_id: groupId,
      paid_by: aliceId,
      description: 'Electricity',
      amount: 1500,
      is_recurring: false,
      recur_day: null,
      splits: [
        { user_id: aliceId, amount: 375 },
        { user_id: bobId,   amount: 375 },
        { user_id: carolId, amount: 375 },
        { user_id: daveId,  amount: 375 },
      ],
    },
  ]

  for (const expData of expensesData) {
    const { splits, ...expenseFields } = expData
    const { data: exp, error: expErr } = await supabase
      .from('expenses')
      .insert(expenseFields)
      .select()
      .single()

    if (expErr) { console.error(`Error inserting expense: ${expErr.message}`); continue }

    await supabase.from('expense_splits').insert(
      splits.map(s => ({ ...s, expense_id: exp!.id }))
    )
    console.log(`✓ Expense: ${expData.description} (₹${expData.amount})`)
  }

  console.log('\n✅ Seed complete!')
  console.log('\nDemo login credentials:')
  DEMO_USERS.forEach(u => console.log(`  ${u.name}: ${u.email} / ${u.password}`))
  console.log('\nGroup invite code: DEMO01')
}

seed().catch(console.error)

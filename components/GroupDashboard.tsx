'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Group, GroupMember, Expense, Settlement, Profile } from '@/types'
import { computeNetBalances, minimiseSettlements } from '@/lib/balance'
import { exportGroupCSV, downloadCSV } from '@/lib/csv'
import AddExpenseModal from './AddExpenseModal'
import SettleModal from './SettleModal'

interface Props {
  group: Group
  currentUser: User
  members: GroupMember[]
  expenses: Expense[]
  settlements: Settlement[]
}

export default function GroupDashboard({ group, currentUser, members, expenses, settlements }: Props) {
  const [activeTab, setActiveTab] = useState<'balances' | 'expenses' | 'activity'>('balances')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettle, setShowSettle] = useState(false)

  // Build profiles map
  const profiles = new Map<string, Profile>()
  members.forEach(m => {
    if (m.profiles) profiles.set(m.user_id, m.profiles as Profile)
  })

  // Compute net balances and suggested settlements
  const balances = computeNetBalances(expenses, settlements)
  const suggestions = minimiseSettlements(balances, profiles)

  const currentUserBalance = balances.get(currentUser.id) ?? 0

  // ── Copy invite code ────────────────────────────────────
  const [copied, setCopied] = useState(false)
  function copyCode() {
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Export CSV ──────────────────────────────────────────
  function handleExport() {
    const csv = exportGroupCSV(group.name, expenses, settlements, profiles)
    downloadCSV(csv, `pocket-${group.name.toLowerCase().replace(/\s+/g, '-')}.csv`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">Invite code:</span>
            <button
              onClick={copyCode}
              className="rounded bg-gray-100 px-2 py-0.5 text-sm font-mono font-semibold tracking-widest hover:bg-gray-200 transition"
            >
              {group.invite_code}
            </button>
            {copied && <span className="text-xs text-brand-600">Copied!</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary text-xs">
            ↓ Export CSV
          </button>
          <button onClick={() => setShowSettle(true)} className="btn-secondary">
            Settle up
          </button>
          <button onClick={() => setShowAddExpense(true)} className="btn-primary">
            + Add expense
          </button>
        </div>
      </div>

      {/* My balance banner */}
      <div className={`rounded-xl p-4 flex items-center justify-between ${
        currentUserBalance > 0.01
          ? 'bg-brand-50 border border-brand-200'
          : currentUserBalance < -0.01
          ? 'bg-red-50 border border-red-200'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <div>
          <p className="text-sm font-medium text-gray-600">Your balance</p>
          <p className={`text-2xl font-bold ${
            currentUserBalance > 0.01 ? 'text-brand-700'
            : currentUserBalance < -0.01 ? 'text-red-700'
            : 'text-gray-500'
          }`}>
            {currentUserBalance > 0.01
              ? `+₹${currentUserBalance.toFixed(2)} owed to you`
              : currentUserBalance < -0.01
              ? `-₹${Math.abs(currentUserBalance).toFixed(2)} you owe`
              : '✓ All settled up'}
          </p>
        </div>
        <span className="text-3xl">
          {currentUserBalance > 0.01 ? '🟢' : currentUserBalance < -0.01 ? '🔴' : '✅'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        {(['balances', 'expenses', 'activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`pb-2 text-sm font-medium capitalize transition border-b-2 -mb-px ${
              activeTab === t
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'balances' && (
        <BalancesTab suggestions={suggestions} members={members} balances={balances} />
      )}
      {activeTab === 'expenses' && (
        <ExpensesTab expenses={expenses} profiles={profiles} />
      )}
      {activeTab === 'activity' && (
        <ActivityTab expenses={expenses} settlements={settlements} profiles={profiles} />
      )}

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          group={group}
          members={members}
          currentUser={currentUser}
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => { setShowAddExpense(false); window.location.reload() }}
        />
      )}
      {showSettle && (
        <SettleModal
          group={group}
          suggestions={suggestions}
          currentUser={currentUser}
          profiles={profiles}
          onClose={() => setShowSettle(false)}
          onSuccess={() => { setShowSettle(false); window.location.reload() }}
        />
      )}
    </div>
  )
}

// ── Balances tab ──────────────────────────────────────────────

function BalancesTab({
  suggestions,
  members,
  balances,
}: {
  suggestions: ReturnType<typeof minimiseSettlements>
  members: GroupMember[]
  balances: Map<string, number>
}) {
  return (
    <div className="space-y-4">
      {suggestions.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-semibold text-gray-700">Everyone is settled up!</p>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Suggested settlements ({suggestions.length} transfer{suggestions.length > 1 ? 's' : ''})
          </h2>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">→</span>
                  <div>
                    <span className="font-medium">{s.fromName}</span>
                    <span className="text-gray-400 mx-2">pays</span>
                    <span className="font-medium">{s.toName}</span>
                  </div>
                </div>
                <span className="font-bold text-brand-600">₹{s.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-6">Member balances</h2>
      <div className="space-y-2">
        {members.map(m => {
          const bal = Math.round((balances.get(m.user_id) ?? 0) * 100) / 100
          const name = (m.profiles as Profile | undefined)?.name ?? 'Unknown'
          return (
            <div key={m.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
                  {name[0]?.toUpperCase()}
                </div>
                <span className="font-medium">{name}</span>
              </div>
              <span className={`font-semibold ${
                bal > 0.01 ? 'text-brand-600'
                : bal < -0.01 ? 'text-red-600'
                : 'text-gray-400'
              }`}>
                {bal > 0.01 ? `+₹${bal.toFixed(2)}` : bal < -0.01 ? `-₹${Math.abs(bal).toFixed(2)}` : 'Settled'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Expenses tab ──────────────────────────────────────────────

function ExpensesTab({ expenses, profiles }: { expenses: Expense[]; profiles: Map<string, Profile> }) {
  if (expenses.length === 0) {
    return (
      <div className="card text-center py-10 text-gray-500">
        No expenses yet. Hit <strong>+ Add expense</strong> to get started.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {expenses.map(e => {
        const payer = profiles.get(e.paid_by)
        return (
          <div key={e.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{e.description}</p>
                  {e.is_recurring && (
                    <span className="badge-green text-xs">🔁 Recurring day {e.recur_day}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Paid by <strong>{payer?.name ?? 'Unknown'}</strong>
                  {' · '}
                  {new Date(e.created_at).toLocaleDateString()}
                </p>
                {e.expense_splits && e.expense_splits.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.expense_splits.map(s => (
                      <span key={s.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {(s.profiles as Profile | undefined)?.name ?? s.user_id}: ₹{Number(s.amount).toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="font-bold text-lg text-gray-900 whitespace-nowrap">₹{Number(e.amount).toFixed(2)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Activity tab ──────────────────────────────────────────────

function ActivityTab({
  expenses,
  settlements,
  profiles,
}: {
  expenses: Expense[]
  settlements: Settlement[]
  profiles: Map<string, Profile>
}) {
  const items = [
    ...expenses.map(e => ({ ...e, _type: 'expense' as const })),
    ...settlements.map(s => ({ ...s, _type: 'settlement' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (items.length === 0) {
    return <div className="card text-center py-10 text-gray-500">No activity yet.</div>
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        if (item._type === 'expense') {
          const e = item as Expense & { _type: 'expense' }
          return (
            <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-xl">💸</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{e.description}</p>
                <p className="text-xs text-gray-400">
                  {profiles.get(e.paid_by)?.name} paid · {new Date(e.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="font-semibold text-sm">₹{Number(e.amount).toFixed(2)}</span>
            </div>
          )
        } else {
          const s = item as Settlement & { _type: 'settlement'; payer?: Profile; payee?: Profile }
          return (
            <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-xl">✅</span>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {s.payer?.name ?? profiles.get(s.paid_by)?.name} settled with {s.payee?.name ?? profiles.get(s.paid_to)?.name}
                </p>
                <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString()}</p>
              </div>
              <span className="font-semibold text-sm text-brand-600">₹{Number(s.amount).toFixed(2)}</span>
            </div>
          )
        }
      })}
    </div>
  )
}

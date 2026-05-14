'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Group, GroupMember, Profile } from '@/types'

interface Props {
  group: Group
  members: GroupMember[]
  currentUser: User
  onClose: () => void
  onSuccess: () => void
}

type SplitMode = 'equal' | 'custom'

export default function AddExpenseModal({ group, members, currentUser, onClose, onSuccess }: Props) {
  const supabase = createClient()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(currentUser.id)
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map(m => m.user_id))
  )
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurDay, setRecurDay] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalAmount = parseFloat(amount) || 0

  function toggleMember(userId: string) {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // Calculate split amounts
  function getSplits(): Record<string, number> {
    const splits: Record<string, number> = {}
    const selected = [...selectedMembers]

    if (splitMode === 'equal') {
      const perPerson = selected.length > 0 ? totalAmount / selected.length : 0
      const base = Math.floor(perPerson * 100) / 100
      const remainder = Math.round((totalAmount - base * selected.length) * 100)
      selected.forEach((uid, i) => {
        splits[uid] = i < remainder ? base + 0.01 : base
      })
    } else {
      selected.forEach(uid => {
        splits[uid] = parseFloat(customAmounts[uid] ?? '0') || 0
      })
    }

    return splits
  }

  const splits = getSplits()
  const splitTotal = Object.values(splits).reduce((a, b) => a + b, 0)
  const isValid =
    description.trim().length > 0 &&
    totalAmount > 0 &&
    selectedMembers.size > 0 &&
    Math.abs(splitTotal - totalAmount) < 0.02

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setLoading(true)
    setError('')

    // Insert expense
    const { data: expense, error: expErr } = await supabase
      .from('expenses')
      .insert({
        group_id: group.id,
        paid_by: paidBy,
        description: description.trim(),
        amount: totalAmount,
        is_recurring: isRecurring,
        recur_day: isRecurring ? parseInt(recurDay) : null,
      })
      .select()
      .single()

    if (expErr || !expense) {
      setError(expErr?.message ?? 'Failed to add expense')
      setLoading(false)
      return
    }

    // Insert splits
    const splitRows = Object.entries(splits).map(([userId, amt]) => ({
      expense_id: expense.id,
      user_id: userId,
      amount: amt,
    }))

    const { error: splitErr } = await supabase.from('expense_splits').insert(splitRows)

    if (splitErr) {
      setError(splitErr.message)
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Add expense</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              className="input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Groceries, electricity bill…"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total amount (₹)</label>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Paid by */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
            <select
              className="input"
              value={paidBy}
              onChange={e => setPaidBy(e.target.value)}
            >
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {(m.profiles as Profile | undefined)?.name ?? m.user_id}
                  {m.user_id === currentUser.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Split among */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Split among</label>
              <div className="flex gap-2">
                {(['equal', 'custom'] as SplitMode[]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                    className={`rounded-full px-3 py-0.5 text-xs font-medium capitalize transition ${
                      splitMode === mode
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {members.map(m => {
                const profile = m.profiles as Profile | undefined
                const name = profile?.name ?? m.user_id
                const checked = selectedMembers.has(m.user_id)
                return (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(m.user_id)}
                      className="rounded"
                    />
                    <span className="flex-1 text-sm">{name}</span>
                    {splitMode === 'equal' ? (
                      <span className="text-sm text-gray-500">
                        {checked && totalAmount > 0 ? `₹${(splits[m.user_id] ?? 0).toFixed(2)}` : '—'}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={customAmounts[m.user_id] ?? ''}
                        onChange={e => setCustomAmounts(p => ({ ...p, [m.user_id]: e.target.value }))}
                        disabled={!checked}
                        placeholder="0.00"
                        className="input w-24 text-right"
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {splitMode === 'custom' && totalAmount > 0 && (
              <p className={`text-xs mt-2 ${Math.abs(splitTotal - totalAmount) < 0.02 ? 'text-brand-600' : 'text-red-600'}`}>
                Split total: ₹{splitTotal.toFixed(2)} / ₹{totalAmount.toFixed(2)}
                {Math.abs(splitTotal - totalAmount) >= 0.02 ? ' — amounts must add up' : ' ✓'}
              </p>
            )}
          </div>

          {/* Recurring */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">Recurring expense 🔁</span>
            </label>
            {isRecurring && (
              <div className="flex items-center gap-2 ml-5">
                <span className="text-sm text-gray-600">Repeats on day</span>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={recurDay}
                  onChange={e => setRecurDay(e.target.value)}
                  className="input w-16 text-center"
                />
                <span className="text-sm text-gray-600">of each month</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="btn-primary flex-1"
            >
              {loading ? 'Adding…' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

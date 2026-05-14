'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Group, Profile, SettlementSuggestion } from '@/types'

interface Props {
  group: Group
  suggestions: SettlementSuggestion[]
  currentUser: User
  profiles: Map<string, Profile>
  onClose: () => void
  onSuccess: () => void
}

export default function SettleModal({ group, suggestions, currentUser, profiles, onClose, onSuccess }: Props) {
  const supabase = createClient()

  // Filter suggestions that involve the current user (as debtor or creditor)
  const mySuggestions = suggestions.filter(
    s => s.from === currentUser.id || s.to === currentUser.id
  )

  const [selected, setSelected] = useState<SettlementSuggestion | null>(
    mySuggestions[0] ?? suggestions[0] ?? null
  )
  const [customAmount, setCustomAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setLoading(true)
    setError('')

    const amount = customAmount ? parseFloat(customAmount) : selected.amount

    const { error: err } = await supabase.from('settlements').insert({
      group_id: group.id,
      paid_by: selected.from,
      paid_to: selected.to,
      amount,
      note: note.trim() || null,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    onSuccess()
  }

  if (suggestions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="card w-full max-w-sm text-center">
          <p className="text-3xl mb-3">🎉</p>
          <h2 className="text-lg font-bold">All settled up!</h2>
          <p className="text-sm text-gray-500 mt-1">No outstanding balances in this group.</p>
          <button onClick={onClose} className="btn-primary mt-4 w-full">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Settle up</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSettle} className="space-y-4">
          {/* Pick a settlement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Record payment</label>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <label key={i} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  selected === s ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="settlement"
                    checked={selected === s}
                    onChange={() => { setSelected(s); setCustomAmount('') }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      <span className={s.from === currentUser.id ? 'text-red-600' : ''}>{s.fromName}</span>
                      {' → '}
                      <span className={s.to === currentUser.id ? 'text-brand-600' : ''}>{s.toName}</span>
                    </p>
                  </div>
                  <span className="font-bold text-brand-600">₹{s.amount.toFixed(2)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Override amount */}
          {selected && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (default: ₹{selected.amount.toFixed(2)})
              </label>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder={selected.amount.toFixed(2)}
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <input
              className="input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="UPI transfer, cash…"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              disabled={loading || !selected}
              className="btn-primary flex-1"
            >
              {loading ? 'Recording…' : 'Record payment ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Group } from '@/types'

interface Props {
  user: User | null
  groups: Group[]
}

export default function HomeClient({ user, groups }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Auth state
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [authSent, setAuthSent] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // Group actions
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [tab, setTab] = useState<'create' | 'join'>('create')

  // ── Auth ─────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setAuthError(error.message)
    } else {
      setAuthSent(true)
    }
    setAuthLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  // ── Groups ───────────────────────────────────────────────
  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setGroupLoading(true)
    setGroupError('')

    const { data: grp, error: grpErr } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), created_by: user.id })
      .select()
      .single()

    if (grpErr || !grp) {
      setGroupError(grpErr?.message ?? 'Failed to create group')
      setGroupLoading(false)
      return
    }

    // Auto-join creator
    await supabase
      .from('group_members')
      .insert({ group_id: grp.id, user_id: user.id })

    router.push(`/groups/${grp.id}`)
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setGroupLoading(true)
    setGroupError('')

    const { data: grp, error: grpErr } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()

    if (grpErr || !grp) {
      setGroupError('Invalid invite code. Check the code and try again.')
      setGroupLoading(false)
      return
    }

    await supabase
      .from('group_members')
      .upsert({ group_id: grp.id, user_id: user.id }, { onConflict: 'group_id,user_id' })

    router.push(`/groups/${grp.id}`)
  }

  // ── Render: not logged in ────────────────────────────────
  if (!user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Split expenses. <span className="text-brand-600">Simply.</span>
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Track who owes who — settle up in one tap.
          </p>
        </div>

        <div className="card w-full max-w-sm">
          {authSent ? (
            <div className="text-center">
              <p className="text-3xl mb-3">📬</p>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-gray-500">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <h2 className="text-lg font-semibold">Get started</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Alex"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  required
                />
              </div>
              {authError && <p className="text-sm text-red-600">{authError}</p>}
              <button type="submit" className="btn-primary w-full" disabled={authLoading}>
                {authLoading ? 'Sending…' : 'Send magic link →'}
              </button>
              <p className="text-xs text-center text-gray-400">No password. Just click the link in your email.</p>
            </form>
          )}
        </div>
      </div>
    )
  }

  // ── Render: logged in ────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
        </div>
        <button onClick={handleSignOut} className="btn-secondary text-xs">Sign out</button>
      </div>

      {groups.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g: Group) => (
            <a
              key={g.id}
              href={`/groups/${g.id}`}
              className="card flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
            >
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Code: {g.invite_code}</p>
              </div>
              <span className="text-gray-400">→</span>
            </a>
          ))}
        </div>
      )}

      <div className="card max-w-md">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === 'create' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Create group
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === 'join' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Join group
          </button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={createGroup} className="space-y-3">
            <input
              className="input"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. Flat 4B"
              required
            />
            {groupError && <p className="text-sm text-red-600">{groupError}</p>}
            <button type="submit" className="btn-primary w-full" disabled={groupLoading}>
              {groupLoading ? 'Creating…' : 'Create group'}
            </button>
          </form>
        ) : (
          <form onSubmit={joinGroup} className="space-y-3">
            <input
              className="input"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="Enter 6-character invite code"
              maxLength={6}
              required
            />
            {groupError && <p className="text-sm text-red-600">{groupError}</p>}
            <button type="submit" className="btn-primary w-full" disabled={groupLoading}>
              {groupLoading ? 'Joining…' : 'Join group'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GroupDashboard from '@/components/GroupDashboard'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupPage({ params }: Props) {
  const { id } = await params
  const supabase = createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/?join=${params.id}`)

  // Fetch group (RLS ensures the user is a member)
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', params.id)
    .single()

  if (groupError || !group) notFound()

  // Fetch members with profiles
  const { data: members } = await supabase
    .from('group_members')
    .select('*, profiles(*)')
    .eq('group_id', params.id)

  // Fetch expenses with splits and payer profile
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, profiles(*), expense_splits(*, profiles(*))')
    .eq('group_id', params.id)
    .order('created_at', { ascending: false })

  // Fetch settlements with payer/payee profiles
  const { data: settlements } = await supabase
    .from('settlements')
    .select('*, payer:profiles!settlements_paid_by_fkey(*), payee:profiles!settlements_paid_to_fkey(*)')
    .eq('group_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <GroupDashboard
      group={group}
      currentUser={user}
      members={members ?? []}
      expenses={expenses ?? []}
      settlements={settlements ?? []}
    />
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeClient from '@/components/HomeClient'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If already logged in, show their groups
  if (user) {
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, invite_code, created_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    const groups = (memberships ?? []).map((m: any) => m.groups).filter(Boolean)

    return <HomeClient user={user} groups={groups} />
  }

  return <HomeClient user={null} groups={[]} />
}

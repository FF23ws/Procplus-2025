import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

async function currentOrganization() {
  const { data, error } = await supabase.from('organizations').select('id,name,subscription_plan').order('created_at').limit(1)
  if (error) throw error
  return data?.[0] || null
}

export async function loadAdministration() {
  ensureClient()
  const organization = await currentOrganization()
  if (!organization) return { organization: null, members: [], rules: [], logs: [] }
  const [members, rules, logs] = await Promise.all([
    supabase.from('organization_members').select('user_id,role,active,profiles(full_name,email)').eq('organization_id', organization.id),
    supabase.from('funding_rules').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('audit_logs').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(50),
  ])
  if (members.error) throw members.error
  if (rules.error) throw rules.error
  if (logs.error) throw logs.error
  return { organization, members: members.data || [], rules: rules.data || [], logs: logs.data || [] }
}

export async function createFundingRule(organizationId, values) {
  ensureClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const { data, error } = await supabase.from('funding_rules').insert({
    ...values,
    organization_id: organizationId,
    created_by: userData.user.id,
  }).select().single()
  if (error) throw error
  return data
}

export async function toggleFundingRule(id, active) {
  ensureClient()
  const { error } = await supabase.from('funding_rules').update({ active }).eq('id', id)
  if (error) throw error
}

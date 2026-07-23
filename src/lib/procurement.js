import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

export async function loadProcurementProcesses() {
  ensureClient()
  const { data: organizations, error: organizationError } = await supabase
    .from('organizations')
    .select('id,name')
    .order('created_at')
    .limit(1)
  if (organizationError) throw organizationError
  const organization = organizations?.[0]
  if (!organization) return { organization: null, processes: [] }

  const { data, error } = await supabase
    .from('procurement_processes')
    .select('*')
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return { organization, processes: data || [] }
}

export async function createProcurementProcess(organizationId, values) {
  ensureClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const reference = `PP-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const { data, error } = await supabase
    .from('procurement_processes')
    .insert({
      ...values,
      organization_id: organizationId,
      created_by: userData.user.id,
      reference,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProcurementStatus(id, status) {
  ensureClient()
  const { data, error } = await supabase
    .from('procurement_processes')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

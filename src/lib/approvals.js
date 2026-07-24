import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

export async function loadApprovals() {
  ensureClient()
  const { data: organizations, error: organizationError } = await supabase
    .from('organizations')
    .select('id,name')
    .order('created_at')
    .limit(1)
  if (organizationError) throw organizationError
  const organization = organizations?.[0]
  if (!organization) return { organization: null, requests: [] }

  const { data, error } = await supabase
    .from('approval_requests')
    .select(`
      *,
      procurement_processes(reference,title,description,estimated_value,currency,procurement_method,funding_source),
      finance_entries(reference,description,amount_mzn,currency,entry_type,status,finance_projects(code,name)),
      approval_decisions(id,level,decision,comment,decided_at,profiles(full_name,email))
    `)
    .eq('organization_id', organization.id)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return { organization, requests: data || [] }
}

export async function decideApproval(requestId, decision, comment) {
  ensureClient()
  const { data, error } = await supabase.rpc('decide_procurement_approval', {
    p_request_id: requestId,
    p_decision: decision,
    p_comment: comment || null,
  })
  if (error) throw error
  return data
}

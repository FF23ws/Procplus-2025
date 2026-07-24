import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

export async function loadContracts() {
  ensureClient()
  const { data: organizations, error: organizationError } = await supabase
    .from('organizations')
    .select('id,name')
    .order('created_at')
    .limit(1)
  if (organizationError) throw organizationError
  const organization = organizations?.[0]
  if (!organization) return { organization: null, contracts: [], processes: [], suppliers: [] }

  const [contractsResult, processesResult, suppliersResult, approvalsResult, notificationsResult] = await Promise.all([
    supabase
      .from('contracts')
      .select('*, procurement_processes(reference,title), suppliers(supplier_code,legal_name,trading_name), contract_milestones(*)')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('procurement_processes')
      .select('id,reference,title,estimated_value,currency,status')
      .eq('organization_id', organization.id)
      .in('status', ['published', 'evaluation', 'awarded', 'closed'])
      .order('created_at', { ascending: false }),
    supabase
      .from('suppliers')
      .select('id,supplier_code,legal_name,trading_name,status')
      .eq('organization_id', organization.id)
      .eq('status', 'prequalified')
      .order('legal_name'),
    supabase
      .from('approval_requests')
      .select('id,contract_id,status,current_level,required_levels,submitted_at,completed_at')
      .eq('organization_id', organization.id)
      .eq('entity_type', 'contract')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('award_notifications')
      .select('*')
      .eq('organization_id', organization.id)
      .order('notified_at', { ascending: false }),
  ])
  if (contractsResult.error) throw contractsResult.error
  if (processesResult.error) throw processesResult.error
  if (suppliersResult.error) throw suppliersResult.error
  if (approvalsResult.error) throw approvalsResult.error
  if (notificationsResult.error) throw notificationsResult.error
  return {
    organization,
    contracts: contractsResult.data || [],
    processes: processesResult.data || [],
    suppliers: suppliersResult.data || [],
    approvals: approvalsResult.data || [],
    notifications: notificationsResult.data || [],
  }
}

export async function submitContractApproval(contractId) {
  ensureClient()
  const { data, error } = await supabase.rpc('submit_contract_approval', {
    p_contract_id: contractId,
  })
  if (error) throw error
  return data
}

export async function recordAwardNotification(contractId) {
  ensureClient()
  const { data, error } = await supabase.rpc('record_award_notification', {
    p_contract_id: contractId,
  })
  if (error) throw error
  return data
}

export async function recordAwardResponse(notificationId, response, notes) {
  ensureClient()
  const { data, error } = await supabase.rpc('record_award_response', {
    p_notification_id: notificationId,
    p_response: response,
    p_notes: notes || null,
  })
  if (error) throw error
  return data
}

export async function createContract(organizationId, values) {
  ensureClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const prefix = values.document_type === 'purchase_order' ? 'OC' : 'CTR'
  const contractNumber = `${prefix}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      ...values,
      organization_id: organizationId,
      created_by: userData.user.id,
      contract_number: contractNumber,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateContractStatus(id, status) {
  ensureClient()
  const { data, error } = await supabase
    .from('contracts')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createMilestone(contractId, values) {
  ensureClient()
  const { data, error } = await supabase
    .from('contract_milestones')
    .insert({ ...values, contract_id: contractId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMilestoneStatus(id, status) {
  ensureClient()
  const { data, error } = await supabase
    .from('contract_milestones')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

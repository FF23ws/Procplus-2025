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

  const [contractsResult, processesResult, suppliersResult] = await Promise.all([
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
  ])
  if (contractsResult.error) throw contractsResult.error
  if (processesResult.error) throw processesResult.error
  if (suppliersResult.error) throw suppliersResult.error
  return {
    organization,
    contracts: contractsResult.data || [],
    processes: processesResult.data || [],
    suppliers: suppliersResult.data || [],
  }
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

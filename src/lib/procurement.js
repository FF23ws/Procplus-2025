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
  const requestedStatus = values.status
  const { data, error } = await supabase
    .from('procurement_processes')
    .insert({
      ...values,
      status: 'draft',
      organization_id: organizationId,
      created_by: userData.user.id,
      reference,
    })
    .select()
    .single()
  if (error) throw error
  if (requestedStatus === 'pending_approval') {
    return updateProcurementStatus(data.id, requestedStatus)
  }
  return data
}

export async function previewProcurementRule(organizationId, values) {
  ensureClient()
  const { data, error } = await supabase.rpc('preview_procurement_rule', {
    p_organization_id: organizationId,
    p_funding_source: values.funding_source,
    p_estimated_value: Number(values.estimated_value || 0),
    p_currency: values.currency,
    p_method: values.procurement_method,
    p_deadline: values.deadline ? new Date(values.deadline).toISOString() : null,
  })
  if (error) throw error
  return data
}

export async function evaluateProcurementProcess(id, targetStatus = null) {
  ensureClient()
  const { data, error } = await supabase.rpc('evaluate_procurement_process', {
    p_process_id: id,
    p_target_status: targetStatus,
  })
  if (error) throw error
  return data
}

export async function recordRuleEvidence(id, requirementCode, reference) {
  ensureClient()
  const { data, error } = await supabase.rpc('set_procurement_rule_evidence', {
    p_process_id: id,
    p_requirement_code: requirementCode,
    p_evidence_reference: reference,
  })
  if (error) throw error
  return data
}

export async function updateProcurementStatus(id, status, exceptionJustification = null) {
  ensureClient()
  const { data, error } = await supabase.rpc('transition_procurement_process', {
    p_process_id: id,
    p_target_status: status,
    p_exception_justification: exceptionJustification,
  })
  if (error) throw error
  return data
}

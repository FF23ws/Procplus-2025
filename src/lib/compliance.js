import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

export async function loadComplianceWorkspace() {
  ensureClient()
  const { data: organization, error: organizationError } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
  if (organizationError) throw organizationError
  if (!organization) throw new Error('A sua conta ainda não está associada a uma organização.')
  const [{ data: controls, error: controlError }, { data: audit, error: auditError }] = await Promise.all([
    supabase.from('compliance_controls').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('procplus_audit_events').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(20),
  ])
  if (controlError) throw controlError
  if (auditError) throw auditError
  return { organizationId: organization.id, controls: controls || [], audit: audit || [] }
}

export async function createComplianceControl(organizationId, values) {
  ensureClient()
  const { data, error } = await supabase.from('compliance_controls').insert({
    organization_id: organizationId,
    area: values.area.trim(),
    control_name: values.control.trim(),
    funding_source: values.fund.trim() || null,
    owner_role: values.owner.trim() || null,
    status: values.status,
    risk_level: values.risk,
    evidence: values.evidence.trim() || null,
    due_date: values.dueDate || null,
  }).select().single()
  if (error) throw error
  return data
}

import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

async function getOrganizationId() {
  ensureClient()
  const { data, error } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('A sua conta ainda não está associada a uma organização.')
  return data.id
}

export async function loadFinanceWorkspace() {
  const organizationId = await getOrganizationId()
  const [{ data: projects, error: projectError }, { data: entries, error: entryError }] = await Promise.all([
    supabase.from('finance_project_summary').select('*').eq('organization_id', organizationId).order('code'),
    supabase.from('finance_entries').select('id,project_id,reference,entry_type,description,document_date,amount,currency,amount_mzn,status,finance_projects(code)').eq('organization_id', organizationId).order('document_date', { ascending: false }).limit(100),
  ])
  if (projectError) throw projectError
  if (entryError) throw entryError
  return { organizationId, projects: projects || [], entries: entries || [] }
}

export async function createFinanceProject(organizationId, values) {
  ensureClient()
  const { data, error } = await supabase.from('finance_projects').insert({
    organization_id: organizationId,
    code: values.code.trim(),
    name: values.name.trim(),
    donor: values.donor.trim() || null,
    funding_source: values.fundingSource.trim() || null,
    approved_budget: Number(values.budget),
    base_currency: values.currency,
    indirect_cost_rate: Number(values.indirect || 0),
  }).select().single()
  if (error) throw error
  return data
}

export async function createFinanceEntry(organizationId, values) {
  ensureClient()
  const { data, error } = await supabase.from('finance_entries').insert({
    organization_id: organizationId,
    project_id: values.projectId,
    reference: values.reference.trim(),
    entry_type: values.type,
    description: values.description.trim(),
    document_date: values.date,
    amount: Number(values.amount),
    currency: values.currency,
    exchange_rate: Number(values.exchangeRate || 1),
    status: values.status,
  }).select().single()
  if (error) throw error
  return data
}

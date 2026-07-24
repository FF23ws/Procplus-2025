import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

export async function loadReportingDashboard() {
  ensureClient()
  const { data: organizations, error: organizationError } = await supabase
    .from('organizations')
    .select('id,name')
    .order('created_at')
    .limit(1)
  if (organizationError) throw organizationError
  const organization = organizations?.[0]
  if (!organization) return { organization: null, processes: [], suppliers: [], contracts: [], approvals: [] }

  const [processes, suppliers, contracts, approvals] = await Promise.all([
    supabase.from('procurement_processes').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('contracts').select('*,contract_milestones(*)').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('approval_requests').select('*').eq('organization_id', organization.id).order('submitted_at', { ascending: false }),
  ])
  for (const result of [processes, suppliers, contracts, approvals]) {
    if (result.error) throw result.error
  }
  return {
    organization,
    processes: processes.data || [],
    suppliers: suppliers.data || [],
    contracts: contracts.data || [],
    approvals: approvals.data || [],
  }
}

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

export function downloadProcurementReport(workspace) {
  const headers = ['Referência', 'Título', 'Método', 'Financiamento', 'Valor', 'Moeda', 'Estado', 'Prazo']
  const rows = workspace.processes.map(item => [
    item.reference,
    item.title,
    item.procurement_method,
    item.funding_source,
    item.estimated_value,
    item.currency,
    item.status,
    item.deadline || '',
  ])
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `procplus-processos-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

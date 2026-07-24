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
  if (!organization) return { organization: null, processes: [], suppliers: [], contracts: [], approvals: [], financeProjects: [], financeEntries: [], controls: [] }

  const [processes, suppliers, contracts, approvals, financeProjects, financeEntries, controls] = await Promise.all([
    supabase.from('procurement_processes').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('contracts').select('*,contract_milestones(*)').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('approval_requests').select('*').eq('organization_id', organization.id).order('submitted_at', { ascending: false }),
    supabase.from('finance_project_summary').select('*').eq('organization_id', organization.id).order('code'),
    supabase.from('finance_entries').select('*,finance_projects(code,name)').eq('organization_id', organization.id).order('document_date', { ascending: false }),
    supabase.from('compliance_controls').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
  ])
  for (const result of [processes, suppliers, contracts, approvals, financeProjects, financeEntries, controls]) {
    if (result.error) throw result.error
  }
  return {
    organization,
    processes: processes.data || [],
    suppliers: suppliers.data || [],
    contracts: contracts.data || [],
    approvals: approvals.data || [],
    financeProjects: financeProjects.data || [],
    financeEntries: financeEntries.data || [],
    controls: controls.data || [],
  }
}

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

export function downloadProcurementReport(workspace) {
  const headers = ['Tipo de registo', 'Referência/Código', 'Descrição', 'Categoria/Método', 'Financiamento/Projecto', 'Valor MZN', 'Moeda', 'Estado', 'Data/Prazo']
  const rows = [
    ...workspace.processes.map(item => ['Processo', item.reference, item.title, item.procurement_method, item.funding_source, item.currency === 'MZN' ? item.estimated_value : '', item.currency, item.status, item.deadline || '']),
    ...workspace.contracts.map(item => ['Contrato', item.contract_number, item.title || item.description, 'Contrato', item.supplier_name || '', item.currency === 'MZN' ? item.total_value : '', item.currency, item.status, item.end_date || '']),
    ...workspace.financeProjects.map(item => ['Projecto financeiro', item.code, item.name, 'Orçamento', item.funding_source || item.donor, item.approved_budget, item.base_currency, '', '']),
    ...workspace.financeEntries.map(item => ['Movimento financeiro', item.reference, item.description, item.entry_type, item.finance_projects?.code || '', item.amount_mzn, item.currency, item.status, item.document_date]),
    ...workspace.controls.map(item => ['Controlo', item.id, item.control_name, item.area, item.funding_source || '', '', '', item.status, item.due_date || '']),
  ]
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `procplus-relatorio-consolidado-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

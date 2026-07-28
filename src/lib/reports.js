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

const dateStamp = () => new Date().toISOString().slice(0, 10)
const reportName = (extension) => `procplus-relatorio-${dateStamp()}.${extension}`
const number = value => Number(value || 0)
const displayDate = value => value ? new Date(value).toLocaleDateString('pt-MZ') : ''

const reportRows = workspace => [
  ...workspace.processes.map(item => ['Processo', item.reference, item.title, item.procurement_method, item.funding_source, item.currency === 'MZN' ? item.estimated_value : '', item.currency, item.status, item.deadline || '']),
  ...workspace.contracts.map(item => ['Contrato', item.contract_number, item.title || item.description, 'Contrato', item.supplier_name || '', item.currency === 'MZN' ? item.total_value : '', item.currency, item.status, item.end_date || '']),
  ...workspace.financeProjects.map(item => ['Projecto financeiro', item.code, item.name, 'Orçamento', item.funding_source || item.donor, item.approved_budget, item.base_currency, '', '']),
  ...workspace.financeEntries.map(item => ['Movimento financeiro', item.reference, item.description, item.entry_type, item.finance_projects?.code || '', item.amount_mzn, item.currency, item.status, item.document_date]),
  ...workspace.controls.map(item => ['Controlo', item.id, item.control_name, item.area, item.funding_source || '', '', '', item.status, item.due_date || '']),
]

export function downloadProcurementCsv(workspace) {
  const headers = ['Tipo de registo', 'Referência/Código', 'Descrição', 'Categoria/Método', 'Financiamento/Projecto', 'Valor MZN', 'Moeda', 'Estado', 'Data/Prazo']
  const rows = reportRows(workspace)
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = reportName('csv')
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function downloadProcurementExcel(workspace) {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  const sheets = {
    'Resumo': [
      ['PROCPLUS — RELATÓRIO CONSOLIDADO'],
      ['Organização', workspace.organization.name],
      ['Período', workspace.periodLabel],
      ['Gerado em', new Date().toLocaleString('pt-MZ')],
      [],
      ['Indicador', 'Valor'],
      ['Processos', workspace.processes.length],
      ['Fornecedores', workspace.suppliers.length],
      ['Contratos', workspace.contracts.length],
      ['Aprovações', workspace.approvals.length],
      ['Projectos financeiros', workspace.financeProjects.length],
      ['Controlos de conformidade', workspace.controls.length],
    ],
    'Processos': workspace.processes.map(item => ({
      Referência: item.reference, Título: item.title, Método: item.procurement_method,
      Financiamento: item.funding_source, Valor: number(item.estimated_value),
      Moeda: item.currency, Estado: item.status, Prazo: displayDate(item.deadline),
    })),
    'Fornecedores': workspace.suppliers.map(item => ({
      Código: item.supplier_code, 'Razão social': item.legal_name, NUIT: item.nuit,
      Estado: item.status, Risco: item.risk_level, Pontuação: number(item.score),
      'Pré-qualificação válida até': displayDate(item.prequalified_until),
    })),
    'Contratos': workspace.contracts.map(item => ({
      Número: item.contract_number, Título: item.title, Tipo: item.document_type,
      Valor: number(item.total_value), Moeda: item.currency, Estado: item.status,
      Início: displayDate(item.start_date), Fim: displayDate(item.end_date),
    })),
    'Finanças': workspace.financeEntries.map(item => ({
      Referência: item.reference, Descrição: item.description, Tipo: item.entry_type,
      Projecto: item.finance_projects?.code, Valor: number(item.amount),
      Moeda: item.currency, 'Valor MZN': number(item.amount_mzn),
      Estado: item.status, Data: displayDate(item.document_date),
    })),
    'Conformidade': workspace.controls.map(item => ({
      Controlo: item.control_name, Área: item.area, Risco: item.risk_level,
      Estado: item.status, Prazo: displayDate(item.due_date),
    })),
  }
  Object.entries(sheets).forEach(([name, data]) => {
    const sheet = Array.isArray(data) && Array.isArray(data[0])
      ? XLSX.utils.aoa_to_sheet(data)
      : XLSX.utils.json_to_sheet(data)
    sheet['!cols'] = Array.from({ length: 9 }, () => ({ wch: 22 }))
    XLSX.utils.book_append_sheet(book, sheet, name)
  })
  XLSX.writeFile(book, reportName('xlsx'))
}

export async function downloadProcurementPdf(workspace, dashboard) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pdf.setFillColor(12, 52, 43)
  pdf.rect(0, 0, 297, 32, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.text('PROCPLUS', 15, 14)
  pdf.setFontSize(12)
  pdf.text('Relatório Consolidado de Procurement', 15, 23)
  pdf.setTextColor(35, 52, 46)
  pdf.setFontSize(10)
  pdf.text(`Organização: ${workspace.organization.name}`, 15, 42)
  pdf.text(`Período: ${workspace.periodLabel}`, 15, 48)
  pdf.text(`Gerado em: ${new Date().toLocaleString('pt-MZ')}`, 215, 42)
  pdf.text(`Classificação: Uso interno`, 215, 48)

  autoTable(pdf, {
    startY: 56,
    head: [['Processos activos', 'Taxa de aprovação', 'Fornecedores aptos', 'Contratos activos', 'Conformidade']],
    body: [[dashboard.activeProcesses.length, `${dashboard.approvalRate}%`, dashboard.prequalified, dashboard.activeContracts.length, `${dashboard.complianceScore}%`]],
    theme: 'grid',
    headStyles: { fillColor: [18, 99, 79] },
  })
  autoTable(pdf, {
    startY: pdf.lastAutoTable.finalY + 8,
    head: [['Referência', 'Descrição', 'Método', 'Financiamento', 'Valor', 'Estado', 'Prazo']],
    body: workspace.processes.map(item => [
      item.reference, item.title, item.procurement_method, item.funding_source,
      `${number(item.estimated_value).toLocaleString('pt-MZ')} ${item.currency}`,
      item.status, displayDate(item.deadline),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [18, 99, 79] },
    didDrawPage: data => {
      pdf.setFontSize(8)
      pdf.setTextColor(110)
      pdf.text(`${workspace.organization.name} · Procplus · Página ${data.pageNumber}`, 15, 202)
    },
  })
  if (dashboard.alerts.length) {
    pdf.addPage()
    pdf.setTextColor(35, 52, 46)
    pdf.setFontSize(14)
    pdf.text('Alertas e pontos de atenção', 15, 18)
    autoTable(pdf, {
      startY: 24,
      head: [['Nível', 'Ponto', 'Recomendação']],
      body: dashboard.alerts.map(item => [item.level === 'high' ? 'Alto' : 'Médio', item.title, item.detail]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [18, 99, 79] },
    })
  }
  pdf.save(reportName('pdf'))
}

export async function downloadProcurementReport(format, workspace, dashboard) {
  if (format === 'pdf') return downloadProcurementPdf(workspace, dashboard)
  if (format === 'xlsx') return downloadProcurementExcel(workspace)
  return downloadProcurementCsv(workspace)
}

import { supabase } from './supabase.js'

const daysUntil = date => date ? Math.ceil((new Date(date) - new Date()) / 86400000) : null
export async function loadNotifications() {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
  const { data: organization, error } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
  if (error) throw error
  if (!organization) return []
  const results = await Promise.all([
    supabase.from('approval_requests').select('id,entity_type,submitted_at').eq('organization_id', organization.id).eq('status', 'pending'),
    supabase.from('contracts').select('id,contract_number,end_date,status,contract_milestones(id,title,due_date,status)').eq('organization_id', organization.id),
    supabase.from('documents').select('id,name,expires_at').eq('organization_id', organization.id),
    supabase.from('finance_project_summary').select('id,code,approved_budget,spent_mzn').eq('organization_id', organization.id),
    supabase.from('compliance_controls').select('id,control_name,risk_level,status,due_date').eq('organization_id', organization.id),
  ])
  for (const result of results) if (result.error) throw result.error
  const [approvals, contracts, documents, projects, controls] = results.map(result => result.data || [])
  const items = []
  approvals.forEach(item => items.push({ id: `approval-${item.id}`, level: 'medium', title: 'Aprovação pendente', detail: item.entity_type === 'finance' ? 'Existe um lançamento financeiro por decidir.' : 'Existe um processo de procurement por decidir.', path: '/app/aprovações', date: item.submitted_at }))
  contracts.forEach(item => {
    const remaining = daysUntil(item.end_date)
    if (item.status === 'active' && remaining !== null && remaining <= 30) items.push({ id: `contract-${item.id}`, level: remaining < 0 ? 'high' : 'medium', title: `${item.contract_number} ${remaining < 0 ? 'expirado' : 'a terminar'}`, detail: remaining < 0 ? 'Actualize o estado do contrato.' : `Termina dentro de ${remaining} dia(s).`, path: '/app/contratos' })
    item.contract_milestones?.forEach(milestone => {
      if (!['completed', 'cancelled'].includes(milestone.status) && daysUntil(milestone.due_date) < 0) items.push({ id: `milestone-${milestone.id}`, level: 'high', title: 'Entrega contratual em atraso', detail: `${item.contract_number} · ${milestone.title}`, path: '/app/contratos' })
    })
  })
  documents.forEach(item => {
    const remaining = daysUntil(item.expires_at)
    if (remaining !== null && remaining <= 30) items.push({ id: `document-${item.id}`, level: remaining < 0 ? 'high' : 'medium', title: `Documento ${remaining < 0 ? 'expirado' : 'a expirar'}`, detail: item.name, path: '/app/documentos' })
  })
  projects.forEach(item => {
    if (Number(item.spent_mzn) > Number(item.approved_budget)) items.push({ id: `finance-${item.id}`, level: 'high', title: `Overspent em ${item.code}`, detail: 'A execução excede o orçamento aprovado.', path: '/app/finanças' })
  })
  controls.forEach(item => {
    if (item.status !== 'compliant' && ['high', 'critical'].includes(item.risk_level)) items.push({ id: `control-${item.id}`, level: item.risk_level === 'critical' ? 'high' : 'medium', title: 'Controlo de conformidade aberto', detail: item.control_name, path: '/app/conformidade' })
  })
  return items.sort((a, b) => Number(b.level === 'high') - Number(a.level === 'high')).slice(0, 30)
}

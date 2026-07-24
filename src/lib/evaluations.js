import { supabase } from './supabase.js'
import { createContract } from './contracts.js'

const ensure = () => { if (!supabase) throw new Error('Ligação ao Supabase indisponível.') }
export async function loadEvaluationWorkspace() {
  ensure()
  const { data: organization, error } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
  if (error) throw error
  if (!organization) return { organization: null, processes: [], suppliers: [], bids: [] }
  const results = await Promise.all([
    supabase.from('procurement_processes').select('id,reference,title,status,currency,estimated_value').eq('organization_id', organization.id).in('status', ['published','evaluation','awarded']).order('created_at', { ascending: false }),
    supabase.from('suppliers').select('id,legal_name,status').eq('organization_id', organization.id).neq('status', 'suspended').order('legal_name'),
    supabase.from('procurement_bids').select('*,suppliers(legal_name),procurement_processes(reference,title)').eq('organization_id', organization.id).order('total_score', { ascending: false }),
    supabase.from('contracts').select('id,contract_number,document_type,process_id,supplier_id,status').eq('organization_id', organization.id),
  ])
  for (const result of results) if (result.error) throw result.error
  return { organization, processes: results[0].data || [], suppliers: results[1].data || [], bids: results[2].data || [], contracts: results[3].data || [] }
}
export async function createBid(organizationId, values) {
  ensure()
  const { data, error } = await supabase.from('procurement_bids').insert({
    organization_id: organizationId, process_id: values.processId, supplier_id: values.supplierId,
    bid_reference: values.reference.trim(), amount: Number(values.amount), currency: values.currency,
    validity_date: values.validityDate || null, compliance_status: values.compliance,
    status: 'received',
  }).select().single()
  if (error) throw error
  await supabase.from('procurement_processes').update({ status: 'evaluation' }).eq('id', values.processId).eq('status', 'published')
  return data
}
export async function scoreBid(id, values) {
  ensure()
  const { data: user } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('procurement_bids').update({
    technical_score: Number(values.technical), financial_score: Number(values.financial),
    compliance_status: values.compliance, evaluation_notes: values.notes.trim() || null,
    status: 'evaluated', evaluated_by: user.user.id, evaluated_at: new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function recommendBid(bid) {
  ensure()
  const demote = await supabase.from('procurement_bids').update({ status: 'evaluated' }).eq('process_id', bid.process_id).eq('status', 'recommended')
  if (demote.error) throw demote.error
  const { data, error } = await supabase.from('procurement_bids').update({ status: 'recommended' }).eq('id', bid.id).eq('compliance_status', 'compliant').select().single()
  if (error) throw error
  if (!data) throw new Error('Apenas propostas conformes podem ser recomendadas.')
  return data
}

export async function awardBid(organizationId, bid) {
  ensure()
  if (bid.status !== 'recommended' || bid.compliance_status !== 'compliant') {
    throw new Error('A adjudicação exige uma proposta conforme e recomendada.')
  }
  const { data: existing, error: existingError } = await supabase
    .from('contracts')
    .select('id,contract_number,document_type')
    .eq('organization_id', organizationId)
    .eq('process_id', bid.process_id)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return { contract: existing, existed: true }

  const documentType = bid.currency === 'USD' && Number(bid.amount) <= 50000
    ? 'purchase_order'
    : 'contract'
  const processTitle = bid.procurement_processes?.title || 'Aquisição adjudicada'
  const supplierName = bid.suppliers?.legal_name || 'fornecedor seleccionado'
  const contract = await createContract(organizationId, {
    document_type: documentType,
    process_id: bid.process_id,
    supplier_id: bid.supplier_id,
    title: processTitle,
    description: `Adjudicação da proposta ${bid.bid_reference} apresentada por ${supplierName}.`,
    total_value: Number(bid.amount),
    currency: bid.currency,
    start_date: null,
    end_date: null,
    status: 'draft',
  })
  const processUpdate = await supabase
    .from('procurement_processes')
    .update({ status: 'awarded' })
    .eq('id', bid.process_id)
  if (processUpdate.error) throw processUpdate.error
  return { contract, existed: false }
}

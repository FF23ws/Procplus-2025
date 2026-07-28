import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

export async function loadSupplierPortal() {
  ensureClient()
  await supabase.rpc('claim_supplier_portal_access')
  const { data: accounts, error: accountError } = await supabase
    .from('supplier_portal_users')
    .select('id,role,organization_id,supplier_id,organizations(id,name),suppliers(*)')
    .eq('active', true)
    .order('created_at')
  if (accountError) throw accountError
  const account = accounts?.[0]
  if (!account) return { account: null, supplier: null, documents: [], tenders: [], bids: [], contracts: [] }

  const [documents, tenders, bids, contracts] = await Promise.all([
    supabase.from('supplier_documents').select('*').eq('supplier_id', account.supplier_id).order('uploaded_at', { ascending: false }),
    supabase.from('procurement_processes').select('id,reference,title,description,procurement_method,funding_source,estimated_value,currency,deadline,status,created_at')
      .eq('organization_id', account.organization_id).in('status', ['published','evaluation','awarded','closed']).order('created_at', { ascending: false }),
    supabase.from('procurement_bids').select('*').eq('supplier_id', account.supplier_id).order('submitted_at', { ascending: false }),
    supabase.from('contracts').select('id,contract_number,document_type,title,total_value,currency,start_date,end_date,status,created_at')
      .eq('supplier_id', account.supplier_id).order('created_at', { ascending: false }),
  ])
  for (const result of [documents, tenders, bids, contracts]) if (result.error) throw result.error
  return {
    account,
    supplier: account.suppliers,
    organization: account.organizations,
    documents: documents.data || [],
    tenders: tenders.data || [],
    bids: bids.data || [],
    contracts: contracts.data || [],
  }
}

export async function updatePortalSupplier(id, values) {
  ensureClient()
  const { data, error } = await supabase.from('suppliers').update({
    legal_name: values.legal_name,
    trading_name: values.trading_name || null,
    nuit: values.nuit || null,
    email: values.email,
    phone: values.phone,
    address: values.address || null,
    country_code: values.country_code,
    supplier_type: values.supplier_type,
    categories: values.categories.split(',').map(item => item.trim()).filter(Boolean),
  }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function uploadPortalDocument(workspace, values) {
  ensureClient()
  const extension = values.file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${workspace.supplier.id}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('supplier-documents').upload(path, values.file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) throw uploadError
  const { data, error } = await supabase.from('supplier_documents').insert({
    organization_id: workspace.account.organization_id,
    supplier_id: workspace.supplier.id,
    document_type: values.documentType,
    name: values.file.name,
    storage_path: path,
    expires_at: values.expiresAt || null,
  }).select().single()
  if (error) {
    await supabase.storage.from('supplier-documents').remove([path])
    throw error
  }
  return data
}

export async function submitPortalBid(workspace, process, values) {
  ensureClient()
  const bidReference = `PROP-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const { data, error } = await supabase.from('procurement_bids').insert({
    organization_id: workspace.account.organization_id,
    process_id: process.id,
    supplier_id: workspace.supplier.id,
    bid_reference: bidReference,
    amount: Number(values.amount),
    currency: values.currency,
    validity_date: values.validityDate || null,
  }).select().single()
  if (error) throw error
  return data
}

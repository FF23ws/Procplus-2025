import { supabase } from './supabase.js'

const STORE_KEY = 'procplus-documents'
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]') } catch { return [] }
}

const statusOf = date => {
  if (!date) return 'valid'
  const days = Math.ceil((new Date(date) - new Date()) / 86400000)
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring'
  return 'valid'
}

const requiredDocuments = [
  { id: 'required-1', name: 'Declaração de conflito de interesses', entity_type: 'approval', entity_name: 'Comité de avaliação', reference: 'Obrigatório', status: 'missing' },
  { id: 'required-2', name: 'Certidão de quitação fiscal', entity_type: 'supplier', entity_name: 'Fornecedores pré-qualificados', reference: 'Obrigatório', status: 'missing' },
  { id: 'required-3', name: 'Relatório de avaliação e adjudicação', entity_type: 'tender', entity_name: 'Processos adjudicados', reference: 'Obrigatório', status: 'missing' },
]

export async function loadDocumentWorkspace() {
  const local = readLocal().map(item => ({ ...item, status: statusOf(item.expires_at) }))
  if (!supabase) return { documents: [...local, ...requiredDocuments] }
  try {
    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return { documents: [...(data || []).map(item => ({ ...item, status: statusOf(item.expires_at) })), ...requiredDocuments] }
  } catch {
    return { documents: [...local, ...requiredDocuments] }
  }
}

export async function addDocument(document) {
  if (!document.file?.name) throw new Error('Seleccione um ficheiro.')
  const record = {
    id: crypto.randomUUID(),
    name: document.name,
    entity_type: document.entity_type,
    entity_name: document.entity_name,
    reference: document.reference,
    expires_at: document.expires_at,
    file_name: document.file.name,
    file_size: document.file.size,
    created_at: new Date().toISOString(),
  }
  if (supabase) {
    try {
      const { data: organizations } = await supabase.from('organizations').select('id').order('created_at').limit(1)
      const organizationId = organizations?.[0]?.id
      const path = `${organizationId || 'shared'}/${record.id}-${document.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const upload = await supabase.storage.from('procurement-documents').upload(path, document.file)
      if (upload.error) throw upload.error
      const insert = await supabase.from('documents').insert({ ...record, organization_id: organizationId, storage_path: path }).select().single()
      if (insert.error) throw insert.error
      return insert.data
    } catch {
      // Keep a usable local registry when the storage migration has not yet been applied.
    }
  }
  const current = readLocal()
  localStorage.setItem(STORE_KEY, JSON.stringify([record, ...current]))
  return record
}

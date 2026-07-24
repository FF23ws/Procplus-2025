import { supabase } from './supabase.js'

const BUCKET = 'procurement-documents'
const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}
const statusOf = date => {
  if (!date) return 'valid'
  const days = Math.ceil((new Date(date) - new Date()) / 86400000)
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring'
  return 'valid'
}
async function getOrganizationId() {
  ensureClient()
  const { data, error } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('A sua conta ainda não está associada a uma organização.')
  return data.id
}
export async function loadDocumentWorkspace() {
  const organizationId = await getOrganizationId()
  const { data, error } = await supabase.from('documents').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
  if (error) throw error
  return { organizationId, documents: (data || []).map(item => ({ ...item, status: statusOf(item.expires_at) })) }
}
export async function addDocument(document) {
  if (!document.file?.name) throw new Error('Seleccione um ficheiro.')
  const organizationId = await getOrganizationId()
  const id = crypto.randomUUID()
  const safeName = document.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${organizationId}/${id}-${safeName}`
  const upload = await supabase.storage.from(BUCKET).upload(path, document.file, { contentType: document.file.type, upsert: false })
  if (upload.error) throw upload.error
  const { data, error } = await supabase.from('documents').insert({
    id, organization_id: organizationId, name: document.name, entity_type: document.entity_type,
    entity_name: document.entity_name, reference: document.reference || null,
    expires_at: document.expires_at || null, file_name: document.file.name,
    file_size: document.file.size, mime_type: document.file.type || null, storage_path: path,
  }).select().single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  return data
}
export async function openDocument(storagePath) {
  ensureClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60)
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
export async function removeDocument(document) {
  ensureClient()
  const storage = await supabase.storage.from(BUCKET).remove([document.storage_path])
  if (storage.error) throw storage.error
  const { error } = await supabase.from('documents').delete().eq('id', document.id)
  if (error) throw error
}

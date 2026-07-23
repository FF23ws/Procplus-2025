import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

export async function loadSuppliers() {
  ensureClient()
  const { data: organizations, error: organizationError } = await supabase
    .from('organizations')
    .select('id,name')
    .order('created_at')
    .limit(1)
  if (organizationError) throw organizationError
  const organization = organizations?.[0]
  if (!organization) return { organization: null, suppliers: [] }

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return { organization, suppliers: data || [] }
}

export async function createSupplier(organizationId, values) {
  ensureClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const supplierCode = `FOR-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      ...values,
      organization_id: organizationId,
      created_by: userData.user.id,
      supplier_code: supplierCode,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSupplierAssessment(id, values) {
  ensureClient()
  const { data, error } = await supabase
    .from('suppliers')
    .update(values)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

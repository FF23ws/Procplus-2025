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

  const [suppliers, invitations, portalUsers] = await Promise.all([
    supabase.from('suppliers').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('supplier_portal_invitations').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('supplier_portal_users').select('id,supplier_id,user_id,role,active,created_at,last_access_at,profiles(full_name,email)').eq('organization_id', organization.id).order('created_at'),
  ])
  for (const result of [suppliers, invitations, portalUsers]) if (result.error) throw result.error
  return {
    organization,
    suppliers: suppliers.data || [],
    invitations: invitations.data || [],
    portalUsers: portalUsers.data || [],
  }
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

export async function manageSupplierPortalAccess(action, values) {
  ensureClient()
  if (action === 'invite' || action === 'resend') {
    const email = values.email.trim().toLowerCase()
    const { data: current, error: currentError } = await supabase
      .from('supplier_portal_invitations')
      .select('id')
      .eq('supplier_id', values.supplierId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()
    if (currentError) throw currentError
    const invitation = {
      organization_id: values.organizationId,
      supplier_id: values.supplierId,
      email,
      role: values.role,
      status: 'pending',
      invited_at: new Date().toISOString(),
      last_sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      accepted_at: null,
      accepted_by: null,
    }
    const invitationQuery = current
      ? supabase.from('supplier_portal_invitations').update(invitation).eq('id', current.id)
      : supabase.from('supplier_portal_invitations').insert(invitation)
    const { error: invitationError } = await invitationQuery
    if (invitationError) throw invitationError
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/portal-fornecedor`,
        data: { account_type: 'supplier', supplier_id: values.supplierId },
      },
    })
    if (authError) throw authError
    return { message: action === 'resend' ? 'Convite reenviado com sucesso.' : 'Convite enviado com sucesso.' }
  }
  if (action === 'cancel') {
    const { error } = await supabase.from('supplier_portal_invitations')
      .update({ status: 'cancelled' })
      .eq('id', values.invitationId)
      .eq('supplier_id', values.supplierId)
      .eq('status', 'pending')
    if (error) throw error
    return { message: 'Convite cancelado.' }
  }
  if (action === 'suspend' || action === 'activate') {
    const { error } = await supabase.from('supplier_portal_users')
      .update({ active: action === 'activate' })
      .eq('id', values.accessId)
      .eq('supplier_id', values.supplierId)
    if (error) throw error
    return { message: action === 'activate' ? 'Acesso reactivado.' : 'Acesso suspenso.' }
  }
  throw new Error('Acção desconhecida.')
}

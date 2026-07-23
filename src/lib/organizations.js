import { supabase } from './supabase.js'

const ensureClient = () => {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
}

export async function loadOrganizationWorkspace() {
  ensureClient()
  const { data: organizations, error: organizationError } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at')
  if (organizationError) throw organizationError
  const organization = organizations?.[0]
  if (!organization) return { organization: null, members: [], invitations: [] }

  const [{ data: members, error: memberError }, { data: invitations, error: invitationError }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('user_id, role, active, joined_at, profiles(full_name,email,phone)')
      .eq('organization_id', organization.id)
      .order('joined_at'),
    supabase
      .from('organization_invitations')
      .select('id,email,role,status,created_at')
      .eq('organization_id', organization.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])
  if (memberError) throw memberError
  if (invitationError) throw invitationError
  return { organization, members: members || [], invitations: invitations || [] }
}

export async function saveOrganization(id, changes) {
  ensureClient()
  const { data, error } = await supabase
    .from('organizations')
    .update(changes)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function inviteMember(organizationId, email, role) {
  ensureClient()
  const { data, error } = await supabase.rpc('invite_organization_member', {
    p_organization_id: organizationId,
    p_email: email,
    p_role: role,
  })
  if (error) throw error
  return data
}

export async function updateMember(organizationId, userId, changes) {
  ensureClient()
  const { error } = await supabase
    .from('organization_members')
    .update(changes)
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
  if (error) throw error
}

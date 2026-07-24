import { supabase } from './supabase.js'

export const moduleRoles = {
  organization: ['owner', 'admin'],
  procurement: ['owner', 'admin', 'procurement_manager', 'procurement_officer', 'evaluator', 'approver', 'auditor', 'viewer'],
  suppliers: ['owner', 'admin', 'procurement_manager', 'procurement_officer', 'evaluator', 'auditor', 'contract_manager', 'viewer'],
  contracts: ['owner', 'admin', 'procurement_manager', 'procurement_officer', 'approver', 'finance', 'auditor', 'contract_manager', 'viewer'],
  approvals: ['owner', 'admin', 'procurement_manager', 'approver', 'finance', 'auditor'],
  finance: ['owner', 'admin', 'finance', 'approver', 'auditor', 'viewer'],
  compliance: ['owner', 'admin', 'procurement_manager', 'procurement_officer', 'evaluator', 'approver', 'finance', 'auditor', 'contract_manager', 'viewer'],
  reports: ['owner', 'admin', 'procurement_manager', 'approver', 'finance', 'auditor', 'viewer'],
  documents: ['owner', 'admin', 'procurement_manager', 'procurement_officer', 'evaluator', 'approver', 'finance', 'auditor', 'contract_manager', 'viewer'],
  administration: ['owner', 'admin'],
  integrations: ['owner', 'admin'],
  assistant: ['owner', 'admin', 'procurement_manager', 'procurement_officer', 'evaluator', 'approver', 'finance', 'auditor', 'contract_manager', 'viewer'],
}

export async function loadCurrentAccess() {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const { data, error } = await supabase
    .from('organization_members')
    .select('role,active,organizations(id,name,subscription_plan)')
    .eq('user_id', userData.user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export const canAccess = (role, module) => Boolean(role && moduleRoles[module]?.includes(role))

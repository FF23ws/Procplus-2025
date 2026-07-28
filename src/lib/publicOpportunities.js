import { supabase } from './supabase.js'

export async function loadPublicOpportunities() {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
  const { data, error } = await supabase.rpc('list_public_procurement_opportunities')
  if (error) throw error
  return data || []
}

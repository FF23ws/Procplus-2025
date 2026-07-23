import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigured = Boolean(url && key)
export const supabase = supabaseConfigured ? createClient(url, key) : null
export async function signIn(email, password) {
  if (supabase) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  localStorage.setItem('procplus_session', email)
}
export async function signInWithGoogle() {
  if (!supabase) throw new Error('Configure primeiro as chaves do Supabase.')
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/app` } })
  if (error) throw error
}
export async function signOut() {
  localStorage.removeItem('procplus_session')
  if (supabase) await supabase.auth.signOut()
}

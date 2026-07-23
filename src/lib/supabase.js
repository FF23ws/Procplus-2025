import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigured = Boolean(url && key)
export const supabase = supabaseConfigured ? createClient(url, key) : null
export async function signIn(email, password) {
  if (!supabase) throw new Error('Configure primeiro as chaves do Supabase.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}
export async function getSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}
export function onAuthStateChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}
export async function updatePassword(password) {
  if (!supabase) throw new Error('Configure primeiro as chaves do Supabase.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}
export async function sendPasswordReset(email) {
  if (!supabase) throw new Error('Configure primeiro as chaves do Supabase.')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/set-password`,
  })
  if (error) throw error
}
export async function signInWithGoogle() {
  if (!supabase) throw new Error('Configure primeiro as chaves do Supabase.')
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/app` } })
  if (error) throw error
}
export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}

import { supabase } from './supabase.js'

export async function askProcplusAssistant(message, history = []) {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
  const { data, error } = await supabase.functions.invoke('procurement-assistant', {
    body: { message, history: history.slice(-8) },
  })
  if (error) throw error
  if (!data?.answer) throw new Error('O assistente não devolveu uma resposta.')
  return data.answer
}

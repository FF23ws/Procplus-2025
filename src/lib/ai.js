import { supabase } from './supabase.js'

export async function askProcplusAssistant(message, history = []) {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.')
  const { data, error } = await supabase.functions.invoke('procurement-assistant', {
    body: { message, history: history.slice(-8) },
  })
  if (error) {
    let message = error.message || 'Não foi possível contactar o assistente.'
    try {
      const payload = await error.context?.json()
      message = payload?.error || message
    } catch {
      // Mantém a mensagem original quando a resposta não contém JSON.
    }
    if (/quota|billing|credit|insufficient_quota/i.test(message)) {
      throw new Error('O Assistente IA está temporariamente suspenso por falta de quota. Os restantes módulos continuam disponíveis.')
    }
    throw new Error(message)
  }
  if (!data?.answer) throw new Error('O assistente não devolveu uma resposta.')
  return data.answer
}

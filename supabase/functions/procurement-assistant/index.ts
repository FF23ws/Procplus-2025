import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) throw new Error('Sessão inválida.')
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new Error('Utilizador não autenticado.')
    const { message, history = [] } = await req.json()
    if (!message || typeof message !== 'string') throw new Error('Pergunta inválida.')

    const { data: organizations } = await supabase.from('organizations').select('id,name').limit(1)
    const organization = organizations?.[0]
    const [rules, processes, documents] = organization ? await Promise.all([
      supabase.from('funding_rules').select('name,funding_source,threshold,currency,quotations_required,approval_levels,active').eq('organization_id', organization.id).eq('active', true).limit(30),
      supabase.from('procurement_processes').select('reference,title,status,estimated_value,currency,funding_source').eq('organization_id', organization.id).limit(20),
      supabase.from('documents').select('name,entity_type,entity_name,reference,expires_at').eq('organization_id', organization.id).limit(30),
    ]) : [{ data: [] }, { data: [] }, { data: [] }]

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('OPENAI_API_KEY não configurada no Supabase.')
    const context = JSON.stringify({ organization: organization?.name, rules: rules.data || [], processes: processes.data || [], documents: documents.data || [] })
    const input = [
      { role: 'system', content: 'És o Assistente Procplus, especialista em procurement e conformidade em Moçambique. Responde em português claro, de forma prática e profissional. Usa apenas o contexto fornecido para factos específicos da organização. Não inventes regras, valores ou documentos. Distingue recomendação de decisão formal e alerta quando for necessária validação humana. Contexto: '+context },
      ...history.filter((x:any) => ['user','assistant'].includes(x.role)).slice(-8).map((x:any) => ({ role:x.role, content:String(x.content).slice(0,4000) })),
      { role: 'user', content: message.slice(0,8000) },
    ]
    const openai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer '+apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini', input, max_output_tokens: 1200 }),
    })
    const result = await openai.json()
    if (!openai.ok) throw new Error(result?.error?.message || 'Falha no serviço de IA.')
    const answer = result.output_text || result.output?.flatMap((x:any) => x.content || []).find((x:any) => x.type === 'output_text')?.text
    if (!answer) throw new Error('Resposta vazia.')
    return new Response(JSON.stringify({ answer }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

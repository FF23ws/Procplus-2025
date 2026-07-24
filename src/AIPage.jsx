import { useState } from 'react'
import { askProcplusAssistant } from './lib/ai.js'

const suggestions = [
  'Que documentos faltam para concluir um processo de compra?',
  'Qual método de aquisição devo usar?',
  'Analise os principais riscos de conformidade.',
  'Resuma as etapas antes da adjudicação.',
]

export default function AIPage() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Olá, Fernando. Sou o Assistente Procplus. Posso apoiar na conformidade, documentação, riscos, avaliações e contratos.' }])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const send = async value => {
    const question = (value ?? text).trim()
    if (!question || loading) return
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next); setText(''); setLoading(true); setError('')
    try {
      const answer = await askProcplusAssistant(question, next)
      setMessages([...next, { role: 'assistant', content: answer }])
    } catch (e) {
      setError(e.message || 'Não foi possível contactar o assistente.')
    } finally { setLoading(false) }
  }

  return <main className="dashboard ai-page">
    <div className="headline ai-headline"><div><p className="eyebrow green">PROCPLUS INTELLIGENCE</p><h1>Assistente de Procurement</h1><p>Orientação contextual com segurança e rastreabilidade.</p></div><span className="ai-status">● IA protegida</span></div>
    <section className="ai-layout">
      <article className="card ai-chat">
        <div className="ai-messages">{messages.map((m, i) => <div key={i} className={'ai-message '+m.role}><span>{m.role === 'assistant' ? 'P+' : 'FF'}</span><div>{m.content}</div></div>)}{loading && <div className="ai-message assistant"><span>P+</span><div>A analisar o processo…</div></div>}</div>
        {error && <p className="alert error">{error}</p>}
        <div className="ai-composer"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Pergunte sobre procurement, conformidade ou documentação…" rows="3" /><button className="primary compact" onClick={() => send()} disabled={loading || !text.trim()}>Enviar</button></div>
        <small className="ai-disclaimer">As recomendações devem ser validadas pelo responsável de procurement antes da decisão final.</small>
      </article>
      <aside className="card ai-side">
        <div className="card-title"><div><h3>Perguntas rápidas</h3><p>Comece por um tema frequente.</p></div></div>
        <div className="ai-suggestions">{suggestions.map(x => <button key={x} onClick={() => send(x)} disabled={loading}>{x}<span>→</span></button>)}</div>
        <div className="ai-scope"><h3>Âmbito do assistente</h3><p>✓ Regras por financiador</p><p>✓ Documentos obrigatórios</p><p>✓ Riscos e conformidade</p><p>✓ Avaliação e contratos</p></div>
      </aside>
    </section>
  </main>
}

import { useState } from 'react'

const initialConnections = [
  { id: 'supabase', name: 'Supabase', category: 'Base de dados e autenticação', description: 'Utilizadores, organizações, processos e documentos.', status: 'Ligado', lastSync: 'Agora', tone: 'green' },
  { id: 'vercel', name: 'Vercel', category: 'Publicação e desempenho', description: 'Deploy contínuo e monitorização da aplicação.', status: 'Ligado', lastSync: 'Há 2 min', tone: 'green' },
  { id: 'email', name: 'E-mail transaccional', category: 'Notificações', description: 'Convites, aprovações, alertas e recuperação de conta.', status: 'Configuração necessária', lastSync: 'Nunca', tone: 'amber' },
  { id: 'accounting', name: 'Sistema contabilístico', category: 'Finanças', description: 'Exportação de compromissos, despesas e centros de custo.', status: 'Disponível', lastSync: 'Nunca', tone: 'blue' },
  { id: 'storage', name: 'Arquivo documental', category: 'Documentos', description: 'Cópias de segurança e arquivo de evidências.', status: 'Disponível', lastSync: 'Nunca', tone: 'blue' },
  { id: 'openai', name: 'OpenAI API', category: 'Assistente IA', description: 'Respostas contextuais sobre procurement e conformidade.', status: 'Aguarda crédito', lastSync: 'Suspenso', tone: 'red' },
]

const events = [
  { date: '24 Jul · 13:51', service: 'Vercel', event: 'Nova versão publicada', result: 'Sucesso' },
  { date: '24 Jul · 13:38', service: 'Supabase', event: 'Edge Function actualizada', result: 'Sucesso' },
  { date: '24 Jul · 13:32', service: 'OpenAI API', event: 'Consulta ao assistente', result: 'Sem quota' },
  { date: '24 Jul · 12:41', service: 'Supabase', event: 'Sessão de utilizador validada', result: 'Sucesso' },
]

export default function IntegrationsPage() {
  const [connections, setConnections] = useState(initialConnections)
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')

  const test = connection => {
    setMessage(connection.status === 'Ligado'
      ? `Ligação com ${connection.name} verificada com sucesso.`
      : `${connection.name}: conclua primeiro a configuração necessária.`)
  }

  const enable = connection => {
    if (connection.id === 'openai') {
      setMessage('A OpenAI API será activada no final, após a adição de crédito.')
      return
    }
    setConnections(items => items.map(item => item.id === connection.id ? { ...item, status: 'Configuração necessária', tone: 'amber' } : item))
    setSelected(connection.id)
    setMessage(`Configuração de ${connection.name} preparada.`)
  }

  return <main className="dashboard integrations-page">
    <div className="headline integrations-headline">
      <div><p className="eyebrow green">ECOSSISTEMA PROCPLUS</p><h1>Integrações</h1><p>Ligue serviços externos com controlo, rastreabilidade e segurança.</p></div>
      <span className="integration-health">● Sistemas principais operacionais</span>
    </div>
    {message && <p className="alert success">{message}</p>}

    <section className="integration-metrics">
      <article><small>INTEGRAÇÕES</small><strong>{connections.length}</strong><span>Serviços registados</span></article>
      <article><small>LIGADAS</small><strong>{connections.filter(item => item.status === 'Ligado').length}</strong><span className="up">Operacionais</span></article>
      <article><small>PENDENTES</small><strong>{connections.filter(item => item.status !== 'Ligado').length}</strong><span className="warn">Configuração faseada</span></article>
      <article><small>ÚLTIMA PUBLICAÇÃO</small><strong>2 min</strong><span>Vercel Enterprise</span></article>
    </section>

    <section className="integration-grid">
      {connections.map(connection => <article className={`card integration-card ${selected === connection.id ? 'selected' : ''}`} key={connection.id}>
        <div className="integration-card-head"><span className={`integration-logo ${connection.tone}`}>{connection.name.slice(0, 2).toUpperCase()}</span><span className={`integration-status ${connection.tone}`}>{connection.status}</span></div>
        <small>{connection.category}</small><h3>{connection.name}</h3><p>{connection.description}</p>
        <div className="integration-meta"><span>Última sincronização</span><b>{connection.lastSync}</b></div>
        <div className="integration-actions">{connection.status === 'Ligado'
          ? <><button onClick={() => test(connection)}>Testar ligação</button><button onClick={() => setSelected(connection.id)}>Gerir</button></>
          : <button className="primary compact" onClick={() => enable(connection)}>{connection.id === 'openai' ? 'Ver pendência' : 'Configurar'}</button>}
        </div>
      </article>)}
    </section>

    <article className="card integration-events">
      <div className="card-title"><div><h3>Actividade das integrações</h3><p>Últimos eventos recebidos pelos serviços ligados.</p></div><button>Ver todos</button></div>
      <div className="integration-event-list">{events.map(item => <div className="integration-event" key={item.date + item.service}>
        <span className={item.result === 'Sucesso' ? 'event-ok' : 'event-warning'}>{item.result === 'Sucesso' ? '✓' : '!'}</span>
        <div><b>{item.event}</b><small>{item.service}</small></div><time>{item.date}</time><strong>{item.result}</strong>
      </div>)}</div>
    </article>

    <article className="card api-card">
      <div><p className="eyebrow green">API PROCPLUS</p><h3>Integração personalizada</h3><p>Prepare uma ligação segura para ERP, Primavera, Microsoft Dynamics NAV, plataformas de doadores ou sistemas internos.</p></div>
      <button className="primary compact" onClick={() => setMessage('Pedido de credenciais API registado para configuração posterior.')}>Solicitar credenciais API</button>
    </article>
  </main>
}

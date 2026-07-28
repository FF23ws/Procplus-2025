import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPublicOpportunities } from './lib/publicOpportunities.js'
import './public-opportunities.css'

const methods = {
  request_for_quotation: 'Pedido de cotações',
  open_tender: 'Concurso público',
  restricted_tender: 'Concurso restrito',
  direct_award: 'Ajuste directo',
}
const states = {
  published: 'Aberto',
  evaluation: 'Em avaliação',
  awarded: 'Adjudicado',
  closed: 'Encerrado',
}
const money = (value, currency) => value == null ? null : new Intl.NumberFormat('pt-MZ', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(value)

export default function PublicOpportunitiesPage() {
  const [opportunities, setOpportunities] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('open')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPublicOpportunities().then(setOpportunities).catch(err => setError(err.message))
  }, [])

  const categories = useMemo(() => [...new Set(opportunities.map(item => item.category).filter(Boolean))].sort(), [opportunities])
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return opportunities.filter(item => {
      const open = item.status === 'published' && (!item.deadline || new Date(item.deadline) > new Date())
      return (status === 'all' || (status === 'open' ? open : item.status === status))
        && (category === 'all' || item.category === category)
        && (!term || [item.title, item.reference, item.organization_name, item.description, item.location]
          .filter(Boolean).some(value => value.toLowerCase().includes(term)))
    })
  }, [opportunities, query, category, status])

  return <main className="opportunities-page">
    <header className="opportunities-nav">
      <Link className="opportunities-logo" to="/oportunidades">P<span>+</span><b>procplus</b></Link>
      <nav><a href="#oportunidades">Oportunidades</a><Link to="/fornecedor">Portal do Fornecedor</Link><Link className="opportunities-login" to="/login">Área das organizações</Link></nav>
    </header>
    <section className="opportunities-hero">
      <p className="eyebrow">MERCADO DE PROCUREMENT</p>
      <h1>Oportunidades transparentes para fornecedores preparados.</h1>
      <p>Consulte concursos publicados por organizações compradoras e participe através de um processo electrónico seguro.</p>
      <div className="opportunities-search"><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar por título, referência, organização ou local…" /><a href="#oportunidades">Pesquisar</a></div>
    </section>
    <section className="opportunities-content" id="oportunidades">
      <div className="opportunities-heading"><div><p className="eyebrow green">OPORTUNIDADES</p><h2>Concursos publicados</h2><p>{visible.length} oportunidade(s) encontrada(s)</p></div>
        <div className="opportunities-filters">
          <select value={status} onChange={e => setStatus(e.target.value)}><option value="open">Abertos</option><option value="all">Todos</option><option value="evaluation">Em avaliação</option><option value="awarded">Adjudicados</option><option value="closed">Encerrados</option></select>
          <select value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todas as categorias</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
        </div>
      </div>
      {error && <p className="alert error">{error}</p>}
      <div className="opportunities-grid">
        {visible.map(item => {
          const open = item.status === 'published' && (!item.deadline || new Date(item.deadline) > new Date())
          return <article className="opportunity-card" key={item.id}>
            <div className="opportunity-top"><span className={open ? 'open' : item.status}>{open ? 'Aberto' : states[item.status]}</span><small>{item.reference}</small></div>
            <p className="opportunity-org">{item.organization_name}</p><h3>{item.title}</h3>
            <p className="opportunity-description">{item.description || 'Consulte os detalhes da oportunidade e os requisitos de participação.'}</p>
            <dl><div><dt>Categoria</dt><dd>{item.category || 'Geral'}</dd></div><div><dt>Local</dt><dd>{item.location || 'Moçambique'}</dd></div><div><dt>Método</dt><dd>{methods[item.procurement_method]}</dd></div><div><dt>Prazo</dt><dd>{item.deadline ? new Date(item.deadline).toLocaleString('pt-MZ') : 'A confirmar'}</dd></div></dl>
            {item.estimated_value != null && <strong className="opportunity-value">{money(item.estimated_value, item.currency)}</strong>}
            <button onClick={() => setSelected(item)}>Ver oportunidade</button>
          </article>
        })}
      </div>
      {!visible.length && !error && <div className="opportunities-empty"><h3>Sem oportunidades neste filtro</h3><p>Altere os filtros ou volte mais tarde para consultar novas publicações.</p></div>}
    </section>
    {selected && <div className="opportunity-modal"><article><button className="modal-close" onClick={() => setSelected(null)}>×</button><p className="eyebrow green">{selected.reference}</p><h2>{selected.title}</h2><p className="opportunity-org">{selected.organization_name}</p><p>{selected.description}</p><dl><div><dt>Categoria</dt><dd>{selected.category || 'Geral'}</dd></div><div><dt>Local</dt><dd>{selected.location || 'Moçambique'}</dd></div><div><dt>Método</dt><dd>{methods[selected.procurement_method]}</dd></div><div><dt>Prazo</dt><dd>{selected.deadline ? new Date(selected.deadline).toLocaleString('pt-MZ') : 'A confirmar'}</dd></div></dl><Link className="primary participate" to={`/fornecedor?opportunity=${selected.id}`}>Entrar para participar</Link><small>A submissão exige uma conta de fornecedor autorizada.</small></article></div>}
    <footer><div className="opportunities-logo">P<span>+</span><b>procplus</b></div><p>Procurement transparente, seguro e auditável.</p></footer>
  </main>
}

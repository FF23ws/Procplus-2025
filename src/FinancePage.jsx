import { useMemo, useState } from 'react'

const projects = [
  { id: 1, code: 'TRWB-UE-2026', name: 'Teachers Resilience & Well-Being', donor: 'União Europeia', budget: 36800000, committed: 24160000, spent: 19840000, currency: 'MZN', rate: 73.67, indirect: 7 },
  { id: 2, code: 'LFW-INC-2026', name: 'Educação Inclusiva', donor: 'Light for the World', budget: 18250000, committed: 15780000, spent: 14960000, currency: 'MZN', rate: 73.67, indirect: 7 },
  { id: 3, code: 'ADPP-HOS-2026', name: 'Head Office Support Pool', donor: 'Fundos próprios', budget: 9250000, committed: 8410000, spent: 8795000, currency: 'MZN', rate: 1, indirect: 0 },
]

const entries = [
  { date: '2026-07-22', reference: 'PV-260722-018', description: 'Equipamento informático', project: 'TRWB-UE-2026', type: 'Despesa', amount: 2480000, status: 'Registado' },
  { date: '2026-07-19', reference: 'PO-2026-031', description: 'Serviços de transporte', project: 'LFW-INC-2026', type: 'Compromisso', amount: 870000, status: 'Comprometido' },
  { date: '2026-07-15', reference: 'PAY-260715-009', description: 'Custos de pessoal e apoio', project: 'ADPP-HOS-2026', type: 'Despesa', amount: 145304.11, status: 'Alerta' },
  { date: '2026-07-12', reference: 'PV-260712-014', description: 'Materiais de formação', project: 'TRWB-UE-2026', type: 'Despesa', amount: 425000, status: 'Registado' },
]

const money = value => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 2 }).format(value)
const percent = (value, total) => total ? Math.round((value / total) * 100) : 0

export default function FinancePage() {
  const [period, setPeriod] = useState('2026')
  const [project, setProject] = useState('all')
  const [showEntry, setShowEntry] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ reference: '', description: '', project: projects[0].code, type: 'Despesa', amount: '' })

  const visibleProjects = useMemo(() => project === 'all' ? projects : projects.filter(item => item.code === project), [project])
  const totals = useMemo(() => visibleProjects.reduce((acc, item) => ({
    budget: acc.budget + item.budget,
    committed: acc.committed + item.committed,
    spent: acc.spent + item.spent,
  }), { budget: 0, committed: 0, spent: 0 }), [visibleProjects])
  const available = totals.budget - Math.max(totals.committed, totals.spent)
  const overspent = visibleProjects.filter(item => item.spent > item.budget)

  const submit = event => {
    event.preventDefault()
    setMessage('Lançamento preparado. A gravação contabilística será activada com a migração financeira.')
    setShowEntry(false)
    setForm({ reference: '', description: '', project: projects[0].code, type: 'Despesa', amount: '' })
  }

  return <main className="dashboard finance-page">
    <div className="headline finance-headline">
      <div><p className="eyebrow green">CONTROLO FINANCEIRO</p><h1>Finanças e orçamento</h1><p>Acompanhe orçamento, compromissos, despesas, câmbio e custos indirectos.</p></div>
      <div className="finance-actions">
        <select value={period} onChange={event => setPeriod(event.target.value)} aria-label="Período"><option>2026</option><option>2025</option></select>
        <button className="primary compact" onClick={() => setShowEntry(!showEntry)}>{showEntry ? 'Fechar' : '+ Novo lançamento'}</button>
      </div>
    </div>

    {message && <p className="alert success">{message}</p>}
    {showEntry && <form className="card procurement-form finance-form" onSubmit={submit}>
      <div className="card-title"><div><h3>Novo lançamento financeiro</h3><p>Registe uma despesa ou compromisso ligado ao projecto.</p></div></div>
      <div className="form-pair">
        <label>Referência<input value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} placeholder="PV-2026-000" required /></label>
        <label>Projecto<select value={form.project} onChange={event => setForm({ ...form, project: event.target.value })}>{projects.map(item => <option key={item.code}>{item.code}</option>)}</select></label>
        <label className="span-two">Descrição<input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} required /></label>
        <label>Tipo<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}><option>Despesa</option><option>Compromisso</option><option>Adiantamento</option><option>Ajustamento cambial</option></select></label>
        <label>Valor (MZN)<input type="number" min="0" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} required /></label>
      </div>
      <button className="primary compact">Preparar lançamento</button>
    </form>}

    <section className="finance-metrics">
      <article><small>ORÇAMENTO APROVADO</small><strong>{money(totals.budget)}</strong><span>{visibleProjects.length} projecto(s)</span></article>
      <article><small>COMPROMETIDO</small><strong>{money(totals.committed)}</strong><span>{percent(totals.committed, totals.budget)}% do orçamento</span></article>
      <article><small>EXECUTADO</small><strong>{money(totals.spent)}</strong><span>{percent(totals.spent, totals.budget)}% de execução</span></article>
      <article className={available < 0 ? 'metric-danger' : ''}><small>DISPONÍVEL</small><strong>{money(available)}</strong><span>{available < 0 ? 'Orçamento excedido' : 'Saldo para comprometer'}</span></article>
    </section>

    <section className="finance-grid">
      <article className="card">
        <div className="card-title finance-card-title"><div><h3>Execução por projecto</h3><p>Orçamento comparado com compromissos e despesas.</p></div><select value={project} onChange={event => setProject(event.target.value)}><option value="all">Todos os projectos</option>{projects.map(item => <option value={item.code} key={item.code}>{item.code}</option>)}</select></div>
        <div className="budget-list">{visibleProjects.map(item => {
          const execution = percent(item.spent, item.budget)
          return <div className="budget-row" key={item.code}>
            <div className="budget-heading"><div><b>{item.name}</b><small>{item.code} · {item.donor}</small></div><strong className={execution > 100 ? 'danger' : ''}>{execution}%</strong></div>
            <div className="budget-values"><span>Orçamento <b>{money(item.budget)}</b></span><span>Comprometido <b>{money(item.committed)}</b></span><span>Executado <b>{money(item.spent)}</b></span></div>
            <i><u className={execution > 100 ? 'over' : ''} style={{ width: `${Math.min(execution, 100)}%` }} /></i>
          </div>
        })}</div>
      </article>

      <article className="card finance-alert-card">
        <div className="card-title"><div><h3>Alertas financeiros</h3><p>Desvios que exigem atenção.</p></div></div>
        {overspent.length ? overspent.map(item => <div className="finance-alert danger" key={item.code}><span>!</span><div><b>Overspent em {item.code}</b><p>A execução excede o orçamento em {money(item.spent - item.budget)}.</p></div></div>) : <div className="finance-alert clear"><span>✓</span><div><b>Sem overspent</b><p>Os projectos seleccionados permanecem dentro do orçamento.</p></div></div>}
        <div className="finance-alert warning"><span>↗</span><div><b>Taxa cambial a validar</b><p>Confirme a taxa de liquidação antes do próximo relatório ao financiador.</p></div></div>
        <div className="finance-alert info"><span>%</span><div><b>Custos indirectos</b><p>Aplicação de 7% configurada nos projectos elegíveis.</p></div></div>
      </article>
    </section>

    <article className="card finance-ledger">
      <div className="card-title"><div><h3>Movimentos recentes</h3><p>Despesas e compromissos do período {period}.</p></div><button>Exportar</button></div>
      <div className="finance-table">
        <div className="finance-table-row finance-table-head"><span>Data / Referência</span><span>Descrição</span><span>Projecto</span><span>Tipo</span><span>Valor</span><span>Estado</span></div>
        {entries.filter(item => project === 'all' || item.project === project).map(item => <div className="finance-table-row" key={item.reference}>
          <div><b>{item.date}</b><small>{item.reference}</small></div><span>{item.description}</span><span>{item.project}</span><span>{item.type}</span><strong>{money(item.amount)}</strong><span className={`process-status finance-${item.status.toLowerCase()}`}>{item.status}</span>
        </div>)}
      </div>
    </article>
  </main>
}

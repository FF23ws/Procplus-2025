import { useEffect, useMemo, useState } from 'react'
import { createFinanceEntry, createFinanceProject, loadFinanceWorkspace } from './lib/finance.js'

const money = value => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 2 }).format(Number(value || 0))
const percent = (value, total) => total ? Math.round((Number(value) / Number(total)) * 100) : 0
const typeLabels = { commitment: 'Compromisso', expense: 'Despesa', advance: 'Adiantamento', exchange_adjustment: 'Ajustamento cambial', indirect_cost: 'Custo indirecto', reversal: 'Reversão' }
const statusLabels = { draft: 'Rascunho', pending_approval: 'Pendente', approved: 'Aprovado', posted: 'Registado', cancelled: 'Cancelado' }
const entryStatusLabels = { draft: 'Rascunho', pending_approval: 'Submeter para aprovação' }

export default function FinancePage() {
  const [workspace, setWorkspace] = useState({ organizationId: null, projects: [], entries: [] })
  const [project, setProject] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [panel, setPanel] = useState('')
  const [entry, setEntry] = useState({ reference: '', description: '', projectId: '', type: 'expense', amount: '', currency: 'MZN', exchangeRate: 1, status: 'draft', date: new Date().toISOString().slice(0, 10) })
  const [newProject, setNewProject] = useState({ code: '', name: '', donor: '', fundingSource: '', budget: '', currency: 'MZN', indirect: 0 })

  const refresh = async () => {
    setLoading(true); setError('')
    try {
      const data = await loadFinanceWorkspace()
      setWorkspace(data)
      setEntry(current => ({ ...current, projectId: current.projectId || data.projects[0]?.id || '' }))
    } catch (cause) { setError(cause.message || 'Não foi possível carregar os dados financeiros.') }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const visibleProjects = useMemo(() => project === 'all' ? workspace.projects : workspace.projects.filter(item => item.code === project), [project, workspace.projects])
  const totals = useMemo(() => visibleProjects.reduce((sum, item) => ({
    budget: sum.budget + Number(item.approved_budget || 0),
    committed: sum.committed + Number(item.committed_mzn || 0),
    spent: sum.spent + Number(item.spent_mzn || 0),
  }), { budget: 0, committed: 0, spent: 0 }), [visibleProjects])
  const available = totals.budget - Math.max(totals.committed, totals.spent)
  const visibleEntries = workspace.entries.filter(item => project === 'all' || item.finance_projects?.code === project)

  const submitEntry = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createFinanceEntry(workspace.organizationId, entry)
      setMessage('Lançamento financeiro gravado com sucesso.')
      setPanel(''); setEntry(current => ({ ...current, reference: '', description: '', amount: '' })); await refresh()
    } catch (cause) { setError(cause.message || 'Não foi possível gravar o lançamento.') }
    finally { setSaving(false) }
  }
  const submitProject = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createFinanceProject(workspace.organizationId, newProject)
      setMessage('Projecto financeiro criado com sucesso.')
      setPanel(''); setNewProject({ code: '', name: '', donor: '', fundingSource: '', budget: '', currency: 'MZN', indirect: 0 }); await refresh()
    } catch (cause) { setError(cause.message || 'Não foi possível criar o projecto.') }
    finally { setSaving(false) }
  }

  return <main className="dashboard finance-page">
    <div className="headline finance-headline">
      <div><p className="eyebrow green">CONTROLO FINANCEIRO</p><h1>Finanças e orçamento</h1><p>Dados reais de orçamento, compromissos, despesas, câmbio e custos indirectos.</p></div>
      <div className="finance-actions"><button onClick={() => setPanel(panel === 'project' ? '' : 'project')}>+ Novo projecto</button><button className="primary compact" disabled={!workspace.projects.length} onClick={() => setPanel(panel === 'entry' ? '' : 'entry')}>+ Novo lançamento</button></div>
    </div>
    {loading && <p className="alert">A carregar informação financeira…</p>}
    {error && <p className="alert error">{error}</p>}
    {message && <p className="alert success">{message}</p>}

    {panel === 'project' && <form className="card procurement-form finance-form" onSubmit={submitProject}>
      <div className="card-title"><div><h3>Novo projecto financeiro</h3><p>Configure o orçamento e a fonte de financiamento.</p></div></div>
      <div className="form-pair">
        <label>Código<input required value={newProject.code} onChange={e => setNewProject({ ...newProject, code: e.target.value })} /></label>
        <label>Nome<input required value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} /></label>
        <label>Doador<input value={newProject.donor} onChange={e => setNewProject({ ...newProject, donor: e.target.value })} /></label>
        <label>Fonte de fundos<input value={newProject.fundingSource} onChange={e => setNewProject({ ...newProject, fundingSource: e.target.value })} /></label>
        <label>Orçamento aprovado<input required type="number" min="0" step="0.01" value={newProject.budget} onChange={e => setNewProject({ ...newProject, budget: e.target.value })} /></label>
        <label>Custos indirectos (%)<input type="number" min="0" max="100" step="0.01" value={newProject.indirect} onChange={e => setNewProject({ ...newProject, indirect: e.target.value })} /></label>
      </div><button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Criar projecto'}</button>
    </form>}

    {panel === 'entry' && <form className="card procurement-form finance-form" onSubmit={submitEntry}>
      <div className="card-title"><div><h3>Novo lançamento financeiro</h3><p>Registe um movimento ligado ao projecto.</p></div></div>
      <div className="form-pair">
        <label>Referência<input required value={entry.reference} onChange={e => setEntry({ ...entry, reference: e.target.value })} /></label>
        <label>Projecto<select required value={entry.projectId} onChange={e => setEntry({ ...entry, projectId: e.target.value })}>{workspace.projects.map(item => <option value={item.id} key={item.id}>{item.code}</option>)}</select></label>
        <label className="span-two">Descrição<input required value={entry.description} onChange={e => setEntry({ ...entry, description: e.target.value })} /></label>
        <label>Tipo<select value={entry.type} onChange={e => setEntry({ ...entry, type: e.target.value })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Valor<input required type="number" min="0" step="0.01" value={entry.amount} onChange={e => setEntry({ ...entry, amount: e.target.value })} /></label>
        <label>Data<input type="date" value={entry.date} onChange={e => setEntry({ ...entry, date: e.target.value })} /></label>
        <label>Estado<select value={entry.status} onChange={e => setEntry({ ...entry, status: e.target.value })}>{Object.entries(entryStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div><button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Guardar lançamento'}</button>
    </form>}

    <section className="finance-metrics">
      <article><small>ORÇAMENTO APROVADO</small><strong>{money(totals.budget)}</strong><span>{visibleProjects.length} projecto(s)</span></article>
      <article><small>COMPROMETIDO</small><strong>{money(totals.committed)}</strong><span>{percent(totals.committed, totals.budget)}% do orçamento</span></article>
      <article><small>EXECUTADO</small><strong>{money(totals.spent)}</strong><span>{percent(totals.spent, totals.budget)}% de execução</span></article>
      <article className={available < 0 ? 'metric-danger' : ''}><small>DISPONÍVEL</small><strong>{money(available)}</strong><span>{available < 0 ? 'Orçamento excedido' : 'Saldo disponível'}</span></article>
    </section>

    <section className="finance-grid">
      <article className="card">
        <div className="card-title finance-card-title"><div><h3>Execução por projecto</h3><p>Orçamento comparado com compromissos e despesas.</p></div><select value={project} onChange={e => setProject(e.target.value)}><option value="all">Todos os projectos</option>{workspace.projects.map(item => <option value={item.code} key={item.id}>{item.code}</option>)}</select></div>
        {!visibleProjects.length && !loading ? <p>Ainda não existem projectos financeiros. Use “Novo projecto” para começar.</p> : <div className="budget-list">{visibleProjects.map(item => {
          const execution = percent(item.spent_mzn, item.approved_budget)
          return <div className="budget-row" key={item.id}><div className="budget-heading"><div><b>{item.name}</b><small>{item.code} · {item.donor || 'Sem doador'}</small></div><strong className={execution > 100 ? 'danger' : ''}>{execution}%</strong></div><div className="budget-values"><span>Orçamento <b>{money(item.approved_budget)}</b></span><span>Comprometido <b>{money(item.committed_mzn)}</b></span><span>Executado <b>{money(item.spent_mzn)}</b></span></div><i><u className={execution > 100 ? 'over' : ''} style={{ width: `${Math.min(execution, 100)}%` }} /></i></div>
        })}</div>}
      </article>
      <article className="card finance-alert-card"><div className="card-title"><div><h3>Alertas financeiros</h3><p>Desvios calculados em tempo real.</p></div></div>
        {visibleProjects.filter(item => Number(item.spent_mzn) > Number(item.approved_budget)).map(item => <div className="finance-alert danger" key={item.id}><span>!</span><div><b>Overspent em {item.code}</b><p>Excesso de {money(Number(item.spent_mzn) - Number(item.approved_budget))}.</p></div></div>)}
        {!visibleProjects.some(item => Number(item.spent_mzn) > Number(item.approved_budget)) && <div className="finance-alert clear"><span>✓</span><div><b>Sem overspent</b><p>Não existem desvios acima do orçamento seleccionado.</p></div></div>}
      </article>
    </section>

    <article className="card finance-ledger"><div className="card-title"><div><h3>Movimentos recentes</h3><p>Últimos 100 lançamentos autorizados.</p></div></div>
      <div className="finance-table"><div className="finance-table-row finance-table-head"><span>Data / Referência</span><span>Descrição</span><span>Projecto</span><span>Tipo</span><span>Valor</span><span>Estado</span></div>
        {visibleEntries.map(item => <div className="finance-table-row" key={item.id}><div><b>{item.document_date}</b><small>{item.reference}</small></div><span>{item.description}</span><span>{item.finance_projects?.code || '—'}</span><span>{typeLabels[item.entry_type] || item.entry_type}</span><strong>{money(item.amount_mzn)}</strong><span className="process-status">{statusLabels[item.status] || item.status}</span></div>)}
      </div>{!visibleEntries.length && !loading && <p>Ainda não existem movimentos financeiros.</p>}
    </article>
  </main>
}

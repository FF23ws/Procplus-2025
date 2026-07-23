import { useEffect, useMemo, useState } from 'react'
import { createProcurementProcess, loadProcurementProcesses, updateProcurementStatus } from './lib/procurement.js'

const emptyForm = {
  title: '',
  description: '',
  procurement_method: 'request_for_quotation',
  funding_source: 'internal',
  estimated_value: '',
  currency: 'MZN',
  deadline: '',
  status: 'draft',
}

const statusLabels = {
  draft: 'Rascunho',
  pending_approval: 'Aguarda aprovação',
  published: 'Publicado',
  evaluation: 'Em avaliação',
  awarded: 'Adjudicado',
  cancelled: 'Cancelado',
  closed: 'Encerrado',
}

const fundLabels = {
  internal: 'Fundos próprios',
  eu: 'União Europeia',
  american_government: 'Governo dos Estados Unidos',
  mozambique_government: 'Governo de Moçambique',
  international: 'Financiador internacional',
  other: 'Outro financiador',
}

const methodLabels = {
  request_for_quotation: 'Pedido de cotações',
  open_tender: 'Concurso público',
  restricted_tender: 'Concurso restrito',
  direct_award: 'Ajuste directo',
}

const money = (value, currency) => new Intl.NumberFormat('pt-MZ', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
}).format(value)

export default function ProcurementPage() {
  const [workspace, setWorkspace] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = async () => {
    const data = await loadProcurementProcesses()
    setWorkspace(data)
    if (selected) setSelected(data.processes.find(item => item.id === selected.id) || null)
  }

  useEffect(() => { refresh().catch(err => setError(err.message)) }, [])

  const visibleProcesses = useMemo(() => {
    if (!workspace) return []
    return filter === 'all' ? workspace.processes : workspace.processes.filter(item => item.status === filter)
  }, [workspace, filter])

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createProcurementProcess(workspace.organization.id, {
        ...form,
        estimated_value: Number(form.estimated_value),
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      })
      setForm(emptyForm)
      setShowForm(false)
      setMessage('Processo de procurement criado com sucesso.')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (status) => {
    setSaving(true); setError(''); setMessage('')
    try {
      const updated = await updateProcurementStatus(selected.id, status)
      setSelected(updated)
      setMessage(`Estado alterado para “${statusLabels[status]}”.`)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!workspace) return <main className="dashboard"><div className="empty">A carregar os concursos…</div></main>
  if (!workspace.organization) return <main className="dashboard"><div className="empty"><h2>Sem organização associada</h2></div></main>

  return <main className="dashboard">
    <div className="headline">
      <div><h1>Concursos</h1><p>Crie e acompanhe os processos de procurement da organização.</p></div>
      <button className="primary compact" onClick={() => { setShowForm(!showForm); setSelected(null) }}>{showForm ? 'Fechar' : '+ Novo processo'}</button>
    </div>
    {message && <p className="alert success">{message}</p>}
    {error && <p className="alert error">{error}</p>}

    {showForm && <form className="card procurement-form" onSubmit={submit}>
      <div className="card-title"><div><h3>Novo processo</h3><p>Registe os dados essenciais para iniciar o procedimento.</p></div></div>
      <div className="form-pair">
        <label className="span-two">Título<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
        <label>Método<select value={form.procurement_method} onChange={e => setForm({ ...form, procurement_method: e.target.value })}>{Object.entries(methodLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label>Origem dos fundos<select value={form.funding_source} onChange={e => setForm({ ...form, funding_source: e.target.value })}>{Object.entries(fundLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label>Valor estimado<input type="number" min="0" step="0.01" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })} required /></label>
        <label>Moeda<select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}><option>MZN</option><option>USD</option><option>EUR</option><option>ZAR</option></select></label>
        <label>Prazo para propostas<input type="datetime-local" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></label>
        <label>Estado inicial<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="draft">Rascunho</option><option value="pending_approval">Enviar para aprovação</option></select></label>
        <label className="span-two">Descrição<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows="4" /></label>
      </div>
      <button className="primary compact" disabled={saving}>{saving ? 'A criar…' : 'Criar processo'}</button>
    </form>}

    {!showForm && <section className="procurement-layout">
      <div className="card process-list">
        <div className="process-toolbar">
          <div><h3>Processos registados</h3><small>{workspace.processes.length} processo(s)</small></div>
          <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
        </div>
        {visibleProcesses.length === 0 && <div className="list-empty">Ainda não existem processos neste estado.</div>}
        {visibleProcesses.map(item => <button className={`process-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item)}>
          <div><b>{item.title}</b><small>{item.reference} · {fundLabels[item.funding_source]}</small></div>
          <strong>{money(item.estimated_value, item.currency)}</strong>
          <span className={`process-status status-${item.status}`}>{statusLabels[item.status]}</span>
        </button>)}
      </div>
      <aside className="card process-detail">
        {!selected ? <div className="detail-placeholder"><h3>Detalhes do processo</h3><p>Seleccione um processo para consultar toda a informação.</p></div> : <>
          <div className="detail-heading"><span className={`process-status status-${selected.status}`}>{statusLabels[selected.status]}</span><small>{selected.reference}</small><h2>{selected.title}</h2></div>
          <dl>
            <div><dt>Valor estimado</dt><dd>{money(selected.estimated_value, selected.currency)}</dd></div>
            <div><dt>Método</dt><dd>{methodLabels[selected.procurement_method]}</dd></div>
            <div><dt>Financiamento</dt><dd>{fundLabels[selected.funding_source]}</dd></div>
            <div><dt>Prazo</dt><dd>{selected.deadline ? new Date(selected.deadline).toLocaleString('pt-PT') : 'Não definido'}</dd></div>
          </dl>
          {selected.description && <p className="detail-description">{selected.description}</p>}
          <label>Alterar estado<select value={selected.status} onChange={e => changeStatus(e.target.value)} disabled={saving}>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        </>}
      </aside>
    </section>}
  </main>
}

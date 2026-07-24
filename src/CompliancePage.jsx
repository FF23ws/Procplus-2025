import { useEffect, useMemo, useState } from 'react'
import { createComplianceControl, loadComplianceWorkspace } from './lib/compliance.js'

const statusLabels = { compliant: 'Conforme', pending: 'Pendente', alert: 'Alerta', not_applicable: 'Não aplicável' }
const riskLabels = { low: 'Baixo', medium: 'Médio', high: 'Alto', critical: 'Crítico' }

export default function CompliancePage() {
  const [workspace, setWorkspace] = useState({ organizationId: null, controls: [], audit: [] })
  const [fund, setFund] = useState('all')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ area: '', control: '', fund: '', owner: '', status: 'pending', risk: 'medium', evidence: '', dueDate: '' })

  const refresh = async () => {
    setLoading(true); setError('')
    try { setWorkspace(await loadComplianceWorkspace()) }
    catch (cause) { setError(cause.message || 'Não foi possível carregar os dados de conformidade.') }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  const visible = useMemo(() => workspace.controls.filter(item => (fund === 'all' || item.funding_source === fund) && (status === 'all' || item.status === status)), [fund, status, workspace.controls])
  const compliant = workspace.controls.filter(item => item.status === 'compliant').length
  const pending = workspace.controls.filter(item => item.status === 'pending').length
  const alerts = workspace.controls.filter(item => ['alert', 'critical'].includes(item.status) || item.risk_level === 'critical').length
  const score = workspace.controls.length ? Math.round((compliant / workspace.controls.length) * 100) : 0
  const risks = workspace.controls.filter(item => ['high', 'critical'].includes(item.risk_level) && item.status !== 'compliant')

  const submit = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createComplianceControl(workspace.organizationId, form)
      setMessage('Controlo de conformidade criado com sucesso.'); setShowForm(false)
      setForm({ area: '', control: '', fund: '', owner: '', status: 'pending', risk: 'medium', evidence: '', dueDate: '' }); await refresh()
    } catch (cause) { setError(cause.message || 'Não foi possível criar o controlo.') }
    finally { setSaving(false) }
  }

  return <main className="dashboard compliance-page">
    <div className="headline compliance-headline">
      <div><p className="eyebrow green">GOVERNAÇÃO E CONTROLO</p><h1>Conformidade e auditoria</h1><p>Regras, evidências e alterações gravadas no Supabase.</p></div>
      <button className="primary compact" onClick={() => setShowForm(!showForm)}>{showForm ? 'Fechar' : '+ Novo controlo'}</button>
    </div>
    {loading && <p className="alert">A carregar controlos e auditoria…</p>}
    {error && <p className="alert error">{error}</p>}
    {message && <p className="alert success">{message}</p>}
    {showForm && <form className="card procurement-form finance-form" onSubmit={submit}>
      <div className="card-title"><div><h3>Novo controlo</h3><p>Defina o requisito, responsável e risco.</p></div></div>
      <div className="form-pair">
        <label>Área<input required value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></label>
        <label>Controlo<input required value={form.control} onChange={e => setForm({ ...form, control: e.target.value })} /></label>
        <label>Fonte de fundos<input value={form.fund} onChange={e => setForm({ ...form, fund: e.target.value })} /></label>
        <label>Responsável<input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} /></label>
        <label>Estado<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Risco<select value={form.risk} onChange={e => setForm({ ...form, risk: e.target.value })}>{Object.entries(riskLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="span-two">Evidência<input value={form.evidence} onChange={e => setForm({ ...form, evidence: e.target.value })} /></label>
      </div><button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Guardar controlo'}</button>
    </form>}

    <section className="compliance-metrics">
      <article><small>ÍNDICE DE CONFORMIDADE</small><strong>{score}%</strong><span>Controlos verificados</span></article>
      <article><small>CONTROLOS CONFORMES</small><strong>{compliant}</strong><span>de {workspace.controls.length} controlos</span></article>
      <article><small>PENDENTES</small><strong>{pending}</strong><span className="warn">Requer acompanhamento</span></article>
      <article className={alerts ? 'metric-danger' : ''}><small>ALERTAS CRÍTICOS</small><strong>{alerts}</strong><span>Acção necessária</span></article>
    </section>

    <section className="compliance-grid">
      <article className="card control-card">
        <div className="control-toolbar"><div><h3>Matriz de controlos</h3><small>Requisitos reais por financiador</small></div>
          <select value={fund} onChange={e => setFund(e.target.value)}><option value="all">Todos os financiadores</option>{[...new Set(workspace.controls.map(item => item.funding_source).filter(Boolean))].map(item => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        </div>
        <div className="control-list">{visible.map(item => <div className="control-row" key={item.id}>
          <span className={`control-icon control-${statusLabels[item.status]?.toLowerCase() || 'pendente'}`}>{item.status === 'compliant' ? '✓' : item.status === 'pending' ? '…' : '!'}</span>
          <div><b>{item.control_name}</b><small>{item.area} · {item.funding_source || 'Sem financiador'}</small><p>{item.evidence || 'Sem evidência anexada'}</p></div><span>{item.owner_role || '—'}</span><span className="process-status">{statusLabels[item.status] || item.status}</span>
        </div>)}</div>{!visible.length && !loading && <p>Ainda não existem controlos com estes filtros.</p>}
      </article>
      <article className="card risk-card"><div className="card-title"><div><h3>Riscos prioritários</h3><p>Excepções de risco alto ou crítico.</p></div></div>
        {risks.map(item => <div className={`risk-item ${item.risk_level}`} key={item.id}><span>{riskLabels[item.risk_level]?.toUpperCase()}</span><div><b>{item.control_name}</b><p>{item.evidence || 'Requer evidência e tratamento.'}</p></div></div>)}
        {!risks.length && <div className="risk-item low"><span>OK</span><div><b>Sem riscos prioritários</b><p>Não existem controlos abertos de risco alto ou crítico.</p></div></div>}
      </article>
    </section>

    <article className="card audit-card"><div className="card-title"><div><h3>Trilho de auditoria</h3><p>Alterações registadas automaticamente.</p></div></div>
      <div className="audit-timeline">{workspace.audit.map((item, index) => <div className="audit-event" key={item.id}><span>{index + 1}</span><div><b>{item.action} · {item.entity_type}</b><small>{item.entity_id || 'Sistema'}</small></div><time>{new Date(item.created_at).toLocaleString('pt-MZ')}</time></div>)}</div>
      {!workspace.audit.length && !loading && <p>O trilho será preenchido após a primeira alteração financeira ou de conformidade.</p>}
    </article>
  </main>
}

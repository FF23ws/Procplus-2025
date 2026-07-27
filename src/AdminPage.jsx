import { useEffect, useMemo, useState } from 'react'
import { createFundingRule, loadAdministration, toggleFundingRule } from './lib/admin.js'

const sourceLabels = {
  internal: 'Fundos próprios',
  eu: 'União Europeia',
  american_government: 'Fundos do Governo dos Estados Unidos da América',
  mozambique_government: 'Governo de Moçambique',
  international: 'Organizações multilaterais, internacionais e cooperação bilateral',
  other: 'Outro financiador ou regra personalizada',
}

const methodLabels = {
  request_for_quotation: 'Pedido de cotações',
  open_tender: 'Concurso público',
  restricted_tender: 'Concurso restrito',
  direct_award: 'Ajuste directo',
}

const emptyRule = {
  name: '', funding_source: 'internal', min_value: 0, threshold: '', currency: 'MZN',
  procurement_method: 'request_for_quotation', quotations_required: 3, approval_levels: 1,
  required_documents_text: '', min_deadline_days: 3, publication_required: false,
  committee_required: false, contract_required: false,
}

export default function AdminPage() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(emptyRule)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const refresh = async () => setData(await loadAdministration())
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [])
  const activeMembers = useMemo(() => data?.members.filter(x => x.active).length || 0, [data])

  const submit = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createFundingRule(data.organization.id, {
        ...form,
        min_value: Number(form.min_value || 0),
        threshold: form.threshold === '' ? null : Number(form.threshold),
        quotations_required: Number(form.quotations_required),
        approval_levels: Number(form.approval_levels),
        min_deadline_days: Number(form.min_deadline_days || 0),
        required_documents: form.required_documents_text.split(',').map(item => item.trim()).filter(Boolean),
        required_documents_text: undefined,
        active: true,
      })
      setMessage('Regra de procurement criada e activada.')
      setForm(emptyRule)
      await refresh()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const toggle = async rule => {
    setSaving(true); setError('')
    try { await toggleFundingRule(rule.id, !rule.active); await refresh() }
    catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  if (!data) return <main className="dashboard"><div className="empty">A carregar a administração…</div></main>
  return <main className="dashboard">
    <div className="headline admin-headline"><div><h1>Administração</h1><p>Gira permissões, regras de procurement e rastreabilidade da plataforma.</p></div><span className="plan-badge">{data.organization?.subscription_plan || 'Enterprise'}</span></div>
    {message && <p className="alert success">{message}</p>}
    {error && <p className="alert error">{error}</p>}
    <section className="admin-metrics">
      <article><small>UTILIZADORES ACTIVOS</small><strong>{activeMembers}</strong><span>{data.members.length} associados</span></article>
      <article><small>REGRAS ACTIVAS</small><strong>{data.rules.filter(x => x.active).length}</strong><span>Por financiador e faixa de valor</span></article>
      <article><small>EVENTOS DE AUDITORIA</small><strong>{data.logs.length}</strong><span>Últimos 50 eventos</span></article>
    </section>
    <section className="admin-grid">
      <form className="card settings-form" onSubmit={submit}>
        <div className="card-title"><div><h3>Nova regra automática</h3><p>Defina a faixa, o método e os requisitos obrigatórios.</p></div></div>
        <label>Nome da regra<input value={form.name} onChange={e => setForm({...form,name:e.target.value})} required /></label>
        <label>Origem dos fundos<select value={form.funding_source} onChange={e => setForm({...form,funding_source:e.target.value})}>{Object.entries(sourceLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Método obrigatório<select value={form.procurement_method} onChange={e => setForm({...form,procurement_method:e.target.value})}>{Object.entries(methodLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <div className="form-pair"><label>Valor mínimo<input type="number" min="0" value={form.min_value} onChange={e => setForm({...form,min_value:e.target.value})} required /></label><label>Valor máximo<input type="number" min="0" value={form.threshold} onChange={e => setForm({...form,threshold:e.target.value})} placeholder="Vazio = sem limite" /></label></div>
        <label>Moeda<select value={form.currency} onChange={e => setForm({...form,currency:e.target.value})}><option>MZN</option><option>USD</option><option>EUR</option><option>ZAR</option></select></label>
        <div className="form-pair"><label>Cotações exigidas<input type="number" min="0" max="10" value={form.quotations_required} onChange={e => setForm({...form,quotations_required:e.target.value})} /></label><label>Níveis de aprovação<input type="number" min="1" max="5" value={form.approval_levels} onChange={e => setForm({...form,approval_levels:e.target.value})} /></label></div>
        <label>Prazo mínimo para propostas (dias)<input type="number" min="0" value={form.min_deadline_days} onChange={e => setForm({...form,min_deadline_days:e.target.value})} /></label>
        <label>Documentos obrigatórios<input value={form.required_documents_text} onChange={e => setForm({...form,required_documents_text:e.target.value})} placeholder="Pedido de compra, especificações, orçamento aprovado" /><small>Separe os documentos por vírgulas.</small></label>
        <label><input type="checkbox" checked={form.publication_required} onChange={e => setForm({...form,publication_required:e.target.checked})} /> Publicação pública obrigatória</label>
        <label><input type="checkbox" checked={form.committee_required} onChange={e => setForm({...form,committee_required:e.target.checked})} /> Comissão de avaliação obrigatória</label>
        <label><input type="checkbox" checked={form.contract_required} onChange={e => setForm({...form,contract_required:e.target.checked})} /> Contrato obrigatório</label>
        <button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Activar regra'}</button>
      </form>
      <section className="card">
        <div className="card-title"><div><h3>Regras configuradas</h3><p>{data.rules.length} regra(s) da organização</p></div></div>
        <div className="admin-rule-list">{data.rules.length ? data.rules.map(rule => <div className="admin-rule" key={rule.id}><div><b>{rule.name}</b><small>{sourceLabels[rule.funding_source] || rule.funding_source} · {Number(rule.min_value || 0).toLocaleString('pt-PT')}–{rule.threshold == null ? 'sem limite' : Number(rule.threshold).toLocaleString('pt-PT')} {rule.currency} · {methodLabels[rule.procurement_method] || rule.procurement_method} · {rule.quotations_required} cotação(ões)</small></div><span className={rule.active ? 'status-active' : 'status-inactive'}>{rule.active ? 'Activa' : 'Inactiva'}</span><button className="text-button inline" onClick={() => toggle(rule)} disabled={saving}>{rule.active ? 'Desactivar' : 'Activar'}</button></div>) : <p className="list-empty">Ainda não existem regras personalizadas.</p>}</div>
      </section>
    </section>
    <section className="card admin-audit">
      <div className="card-title"><div><h3>Registo de auditoria</h3><p>Acções administrativas e alterações relevantes.</p></div></div>
      <div className="audit-list">{data.logs.length ? data.logs.map(log => <div className="audit-row" key={log.id}><span>●</span><div><b>{log.action}</b><small>{log.entity_type}{log.entity_id ? ' · '+log.entity_id : ''}</small></div><time>{new Date(log.created_at).toLocaleString('pt-PT')}</time></div>) : <p className="list-empty">O registo começará a ser preenchido com as próximas alterações.</p>}</div>
    </section>
  </main>
}

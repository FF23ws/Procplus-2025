import { useEffect, useMemo, useState } from 'react'
import { awardBid, createBid, loadEvaluationWorkspace, recommendBid, scoreBid } from './lib/evaluations.js'
import './evaluations.css'

const money = (value, currency) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
const statusLabels = { received: 'Recebida', under_review: 'Em análise', evaluated: 'Avaliada', recommended: 'Recomendada', rejected: 'Rejeitada', withdrawn: 'Retirada' }
const complianceLabels = { pending: 'Pendente', compliant: 'Conforme', non_compliant: 'Não conforme' }

export default function EvaluationsPage() {
  const [workspace, setWorkspace] = useState(null)
  const [processId, setProcessId] = useState('')
  const [selected, setSelected] = useState(null)
  const [showBid, setShowBid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [bid, setBid] = useState({ processId: '', supplierId: '', reference: '', amount: '', currency: 'MZN', validityDate: '', compliance: 'pending' })
  const [score, setScore] = useState({ technical: '', financial: '', compliance: 'pending', notes: '' })
  const refresh = async () => {
    const data = await loadEvaluationWorkspace(); setWorkspace(data)
    const current = processId || data.processes[0]?.id || ''
    setProcessId(current); setBid(value => ({ ...value, processId: current, supplierId: value.supplierId || data.suppliers[0]?.id || '' }))
    if (selected) setSelected(data.bids.find(item => item.id === selected.id) || null)
  }
  useEffect(() => { refresh().catch(cause => setError(cause.message)) }, [])
  const bids = useMemo(() => (workspace?.bids || []).filter(item => !processId || item.process_id === processId).sort((a, b) => Number(b.total_score) - Number(a.total_score)), [workspace, processId])
  const submitBid = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try { await createBid(workspace.organization.id, { ...bid, processId }); setMessage('Proposta registada.'); setShowBid(false); setBid(value => ({ ...value, reference: '', amount: '', validityDate: '', compliance: 'pending' })); await refresh() }
    catch (cause) { setError(cause.message) } finally { setSaving(false) }
  }
  const submitScore = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try { await scoreBid(selected.id, score); setMessage('Avaliação gravada.'); await refresh() }
    catch (cause) { setError(cause.message) } finally { setSaving(false) }
  }
  const recommend = async item => {
    setSaving(true); setError(''); setMessage('')
    try { await recommendBid(item); setMessage('Proposta recomendada para adjudicação.'); await refresh() }
    catch (cause) { setError(cause.message) } finally { setSaving(false) }
  }
  const award = async item => {
    setSaving(true); setError(''); setMessage('')
    try {
      const result = await awardBid(workspace.organization.id, item)
      const label = result.contract.document_type === 'purchase_order' ? 'Ordem de Compra' : 'Contrato'
      setMessage(result.existed
        ? `${label} ${result.contract.contract_number} já existe para este processo.`
        : `Adjudicação concluída. ${label} ${result.contract.contract_number} criado em rascunho.`)
      await refresh()
    } catch (cause) { setError(cause.message) } finally { setSaving(false) }
  }
  if (!workspace) return <main className="dashboard"><div className="empty">{error || 'A carregar as avaliações…'}</div></main>
  return <main className="dashboard evaluation-page">
    <div className="headline"><div><h1>Cotações e avaliações</h1><p>Compare propostas e documente a recomendação de adjudicação.</p></div><button className="primary compact" disabled={!workspace.processes.length || !workspace.suppliers.length} onClick={() => setShowBid(!showBid)}>+ Registar proposta</button></div>
    {message && <p className="alert success">{message}</p>}{error && <p className="alert error">{error}</p>}
    <div className="evaluation-filter"><label>Processo<select value={processId} onChange={e => { setProcessId(e.target.value); setSelected(null) }}>{workspace.processes.map(item => <option value={item.id} key={item.id}>{item.reference} · {item.title}</option>)}</select></label><span>{bids.length} proposta(s)</span></div>
    {showBid && <form className="card procurement-form evaluation-form" onSubmit={submitBid}><div className="form-pair">
      <label>Fornecedor<select required value={bid.supplierId} onChange={e => setBid({ ...bid, supplierId: e.target.value })}>{workspace.suppliers.map(item => <option value={item.id} key={item.id}>{item.legal_name}</option>)}</select></label>
      <label>Referência<input required value={bid.reference} onChange={e => setBid({ ...bid, reference: e.target.value })} /></label>
      <label>Valor<input required type="number" min="0" step="0.01" value={bid.amount} onChange={e => setBid({ ...bid, amount: e.target.value })} /></label>
      <label>Moeda<select value={bid.currency} onChange={e => setBid({ ...bid, currency: e.target.value })}><option>MZN</option><option>USD</option><option>EUR</option><option>ZAR</option></select></label>
      <label>Validade<input type="date" value={bid.validityDate} onChange={e => setBid({ ...bid, validityDate: e.target.value })} /></label>
      <label>Conformidade<select value={bid.compliance} onChange={e => setBid({ ...bid, compliance: e.target.value })}>{Object.entries(complianceLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
    </div><button className="primary compact" disabled={saving}>Guardar proposta</button></form>}
    <section className="evaluation-layout">
      <article className="card evaluation-table"><div className="evaluation-row evaluation-head"><span>Fornecedor</span><span>Valor</span><span>Técnica</span><span>Financeira</span><span>Total</span><span>Estado</span></div>
        {bids.map(item => <button className={`evaluation-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => { setSelected(item); setScore({ technical: item.technical_score ?? '', financial: item.financial_score ?? '', compliance: item.compliance_status, notes: item.evaluation_notes || '' }) }}><div><b>{item.suppliers?.legal_name}</b><small>{item.bid_reference}</small></div><strong>{money(item.amount, item.currency)}</strong><span>{item.technical_score ?? '—'}</span><span>{item.financial_score ?? '—'}</span><b>{item.total_score ?? '—'}</b><span className={`process-status bid-${item.status}`}>{statusLabels[item.status]}</span></button>)}
        {!bids.length && <p className="list-empty">Ainda não existem propostas para este processo.</p>}
      </article>
      <aside className="card evaluation-detail">{!selected ? <div className="detail-placeholder"><h3>Avaliar proposta</h3><p>Seleccione uma proposta para pontuar.</p></div> : <form onSubmit={submitScore}><h3>{selected.suppliers?.legal_name}</h3><p>{selected.bid_reference} · {money(selected.amount, selected.currency)}</p><label>Pontuação técnica (70%)<input required type="number" min="0" max="100" step="0.01" value={score.technical} onChange={e => setScore({ ...score, technical: e.target.value })} /></label><label>Pontuação financeira (30%)<input required type="number" min="0" max="100" step="0.01" value={score.financial} onChange={e => setScore({ ...score, financial: e.target.value })} /></label><label>Conformidade<select value={score.compliance} onChange={e => setScore({ ...score, compliance: e.target.value })}>{Object.entries(complianceLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Notas<textarea rows="4" value={score.notes} onChange={e => setScore({ ...score, notes: e.target.value })} /></label><button className="primary compact" disabled={saving}>Guardar avaliação</button>{selected.compliance_status === 'compliant' && selected.status === 'evaluated' && <button type="button" className="recommend-button" onClick={() => recommend(selected)} disabled={saving}>Recomendar adjudicação</button>}{selected.status === 'recommended' && <div className="award-panel"><b>Pronta para adjudicação</b><small>Será criado um documento contratual em rascunho com os dados desta proposta.</small><button type="button" className="award-button" onClick={() => award(selected)} disabled={saving}>{saving ? 'A processar…' : 'Adjudicar e criar documento'}</button></div>}</form>}</aside>
    </section>
  </main>
}

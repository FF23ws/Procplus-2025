import { useEffect, useMemo, useState } from 'react'
import { decideApproval, loadApprovals } from './lib/approvals.js'

const statusLabels = { pending: 'Aguarda decisão', approved: 'Aprovado', rejected: 'Rejeitado', changes_requested: 'Alterações solicitadas', cancelled: 'Cancelado' }
const decisionLabels = { approved: 'Aprovou', rejected: 'Rejeitou', changes_requested: 'Solicitou alterações' }
const fundLabels = { internal: 'Fundos próprios', eu: 'União Europeia', american_government: 'Governo dos Estados Unidos', mozambique_government: 'Governo de Moçambique', international: 'Financiador internacional', other: 'Outro financiador' }
const methodLabels = { request_for_quotation: 'Pedido de cotações', open_tender: 'Concurso público', restricted_tender: 'Concurso restrito', direct_award: 'Ajuste directo' }
const money = (value, currency = 'MZN') => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
const subjectOf = item => {
  if (item.entity_type === 'finance') return { title: item.finance_entries?.description || 'Lançamento financeiro', reference: item.finance_entries?.reference, fund: item.finance_entries?.finance_projects?.code || 'Projecto financeiro', value: item.finance_entries?.amount_mzn, currency: 'MZN', method: 'Movimento financeiro', description: `${item.finance_entries?.finance_projects?.name || ''} · ${item.finance_entries?.entry_type || ''}` }
  if (item.entity_type === 'contract') return { title: item.contracts?.title || 'Documento contratual', reference: item.contracts?.contract_number, fund: item.contracts?.suppliers?.trading_name || item.contracts?.suppliers?.legal_name || 'Fornecedor', value: item.contracts?.total_value, currency: item.contracts?.currency, method: item.contracts?.document_type === 'purchase_order' ? 'Ordem de Compra' : 'Contrato', description: item.contracts?.description }
  return { title: item.procurement_processes?.title, reference: item.procurement_processes?.reference, fund: fundLabels[item.procurement_processes?.funding_source], value: item.procurement_processes?.estimated_value, currency: item.procurement_processes?.currency, method: methodLabels[item.procurement_processes?.procurement_method], description: item.procurement_processes?.description }
}

export default function ApprovalsPage() {
  const [workspace, setWorkspace] = useState(null)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const refresh = async selectedId => {
    const data = await loadApprovals(); setWorkspace(data)
    if (selectedId) setSelected(data.requests.find(item => item.id === selectedId) || null)
  }
  useEffect(() => { refresh().catch(err => setError(err.message)) }, [])
  const visible = useMemo(() => !workspace ? [] : filter === 'all' ? workspace.requests : workspace.requests.filter(item => item.status === filter), [workspace, filter])
  const pendingCount = workspace?.requests.filter(item => item.status === 'pending').length || 0
  const decide = async decision => {
    if (decision !== 'approved' && !comment.trim()) return setError('Indique a justificação para rejeitar ou solicitar alterações.')
    setSaving(true); setError(''); setMessage('')
    try {
      await decideApproval(selected.id, decision, comment.trim())
      setComment(''); setMessage(decision === 'approved' ? 'Aprovação registada.' : decision === 'rejected' ? 'Rejeição registada.' : 'Pedido de alterações registado.')
      await refresh(selected.id)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }
  if (!workspace) return <main className="dashboard"><div className="empty">{error || 'A carregar as aprovações…'}</div></main>
  if (!workspace.organization) return <main className="dashboard"><div className="empty"><h2>Sem organização associada</h2></div></main>
  const subject = selected ? subjectOf(selected) : null
  return <main className="dashboard">
    <div className="headline"><div><h1>Aprovações</h1><p>Decisões de procurement, contratos e finanças num fluxo auditável.</p></div><span className="approval-counter">{pendingCount} pendente(s)</span></div>
    {message && <p className="alert success">{message}</p>}{error && <p className="alert error">{error}</p>}
    <section className="approval-metrics">
      <article><small>PENDENTES</small><strong>{pendingCount}</strong></article>
      <article><small>APROVADAS</small><strong>{workspace.requests.filter(item => item.status === 'approved').length}</strong></article>
      <article><small>DEVOLVIDAS</small><strong>{workspace.requests.filter(item => item.status === 'changes_requested').length}</strong></article>
    </section>
    <section className="procurement-layout approval-layout">
      <div className="card process-list">
        <div className="process-toolbar"><div><h3>Pedidos de aprovação</h3><small>{workspace.requests.length} pedido(s)</small></div><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
        {!visible.length && <div className="list-empty">Não existem pedidos neste estado.</div>}
        {visible.map(item => { const row = subjectOf(item); return <button className={`process-row approval-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => { setSelected(item); setComment('') }}><div><b>{row.title}</b><small>{row.reference} · {row.fund}</small></div><strong>{money(row.value, row.currency)}</strong><span className={`process-status approval-${item.status}`}>{statusLabels[item.status]}</span></button> })}
      </div>
      <aside className="card process-detail approval-detail">
        {!selected ? <div className="detail-placeholder"><h3>Análise do pedido</h3><p>Seleccione um pedido para consultar os detalhes e decidir.</p></div> : <>
          <div className="detail-heading"><span className={`process-status approval-${selected.status}`}>{statusLabels[selected.status]}</span><small>{subject.reference} · Nível {selected.current_level} de {selected.required_levels}</small><h2>{subject.title}</h2></div>
          <dl><div><dt>Valor</dt><dd>{money(subject.value, subject.currency)}</dd></div><div><dt>Tipo</dt><dd>{subject.method}</dd></div><div><dt>Financiamento</dt><dd>{subject.fund}</dd></div><div><dt>Submetido</dt><dd>{new Date(selected.submitted_at).toLocaleString('pt-MZ')}</dd></div></dl>
          {subject.description && <p className="detail-description">{subject.description}</p>}
          <div className="approval-timeline"><h3>Histórico de decisões</h3>{!selected.approval_decisions.length && <p>Ainda não foi tomada nenhuma decisão.</p>}{[...selected.approval_decisions].sort((a, b) => a.level - b.level).map(item => <div className="decision-entry" key={item.id}><span>{item.level}</span><div><b>{decisionLabels[item.decision]} · {item.profiles?.full_name || item.profiles?.email || 'Utilizador'}</b><small>{new Date(item.decided_at).toLocaleString('pt-MZ')}</small>{item.comment && <p>{item.comment}</p>}</div></div>)}</div>
          {selected.status === 'pending' && <div className="decision-panel"><label>Comentário da decisão<textarea rows="3" value={comment} onChange={e => setComment(e.target.value)} /></label><div className="decision-actions"><button className="decision-change" onClick={() => decide('changes_requested')} disabled={saving}>Solicitar alterações</button><button className="decision-reject" onClick={() => decide('rejected')} disabled={saving}>Rejeitar</button><button className="primary compact" onClick={() => decide('approved')} disabled={saving}>{saving ? 'A guardar…' : 'Aprovar'}</button></div></div>}
        </>}
      </aside>
    </section>
  </main>
}

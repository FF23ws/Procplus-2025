import { useEffect, useMemo, useState } from 'react'
import { createContract, createMilestone, loadContracts, recordAwardNotification, recordAwardResponse, recordContractDelivery, recordContractSignature, recordSupplierPayment, submitContractApproval, submitSupplierInvoice, updateContractStatus, updateMilestoneStatus } from './lib/contracts.js'

const emptyForm = {
  document_type: 'contract',
  process_id: '',
  supplier_id: '',
  title: '',
  description: '',
  total_value: '',
  currency: 'MZN',
  start_date: '',
  end_date: '',
  status: 'draft',
}

const statusLabels = {
  draft: 'Rascunho',
  pending_signature: 'Aguarda assinatura',
  active: 'Activo',
  completed: 'Concluído',
  terminated: 'Rescindido',
  cancelled: 'Cancelado',
}

const milestoneLabels = {
  pending: 'Pendente',
  in_progress: 'Em curso',
  completed: 'Concluído',
  overdue: 'Em atraso',
  cancelled: 'Cancelado',
}

const money = (value, currency) => new Intl.NumberFormat('pt-MZ', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
}).format(value)

export default function ContractsPage() {
  const [workspace, setWorkspace] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [milestone, setMilestone] = useState({ title: '', due_date: '', amount: '' })
  const [responseNotes, setResponseNotes] = useState('')
  const [signature, setSignature] = useState({ party: 'organization', signatoryName: '', evidenceReference: '' })
  const [delivery, setDelivery] = useState({ milestoneId: '', reference: '', date: new Date().toISOString().slice(0, 10), notes: '' })
  const [invoice, setInvoice] = useState({ deliveryId: '', projectId: '', number: '', date: new Date().toISOString().slice(0, 10), amount: '', exchangeRate: 1 })
  const [paymentReference, setPaymentReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = async (selectedId = selected?.id) => {
    const data = await loadContracts()
    setWorkspace(data)
    if (selectedId) setSelected(data.contracts.find(item => item.id === selectedId) || null)
  }

  useEffect(() => { refresh().catch(err => setError(err.message)) }, [])

  const visible = useMemo(() => {
    if (!workspace) return []
    return filter === 'all' ? workspace.contracts : workspace.contracts.filter(item => item.status === filter)
  }, [workspace, filter])

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createContract(workspace.organization.id, {
        ...form,
        process_id: form.process_id || null,
        total_value: Number(form.total_value),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        description: form.description || null,
      })
      setForm(emptyForm)
      setShowForm(false)
      setMessage('Contrato registado com sucesso.')
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
      await updateContractStatus(selected.id, status)
      setMessage(`Estado alterado para “${statusLabels[status]}”.`)
      await refresh(selected.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const requestApproval = async () => {
    setSaving(true); setError(''); setMessage('')
    try {
      await submitContractApproval(selected.id)
      setMessage('Documento submetido à aprovação em dois níveis.')
      await refresh(selected.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const notifyAward = async () => {
    setSaving(true); setError(''); setMessage('')
    try {
      const notification = await recordAwardNotification(selected.id)
      setMessage(`Notificação ${notification.notification_reference} registada como enviada.`)
      await refresh(selected.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveAwardResponse = async (notification, response) => {
    if (response === 'rejected' && !responseNotes.trim()) return setError('Indique a justificação da rejeição.')
    setSaving(true); setError(''); setMessage('')
    try {
      await recordAwardResponse(notification.id, response, responseNotes.trim())
      setResponseNotes('')
      setMessage(response === 'accepted' ? 'Aceitação do fornecedor registada.' : 'Rejeição do fornecedor registada.')
      await refresh(selected.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveSignature = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await recordContractSignature(selected.id, signature.party, signature.signatoryName, signature.evidenceReference)
      setSignature({ party: signature.party === 'organization' ? 'supplier' : 'organization', signatoryName: '', evidenceReference: '' })
      setMessage('Assinatura registada com rastreabilidade.')
      await refresh(selected.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveDelivery = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await recordContractDelivery(selected.id, delivery)
      setDelivery(value => ({ ...value, milestoneId: '', reference: '', notes: '' }))
      setMessage('Entrega aceite e registada.')
      await refresh(selected.id)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const saveInvoice = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await submitSupplierInvoice(selected.id, invoice)
      setInvoice(value => ({ ...value, number: '', amount: '' }))
      setMessage('Correspondência tripla validada e pagamento submetido à aprovação financeira.')
      await refresh(selected.id)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const savePayment = async invoiceId => {
    if (!paymentReference.trim()) return setError('Indique a referência do pagamento.')
    setSaving(true); setError(''); setMessage('')
    try {
      await recordSupplierPayment(invoiceId, paymentReference.trim())
      setPaymentReference('')
      setMessage('Pagamento registado e comprovativo marcado como pago.')
      await refresh(selected.id)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const addMilestone = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createMilestone(selected.id, {
        title: milestone.title,
        due_date: milestone.due_date,
        amount: Number(milestone.amount || 0),
      })
      setMilestone({ title: '', due_date: '', amount: '' })
      setMessage('Marco contratual adicionado.')
      await refresh(selected.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const changeMilestone = async (id, status) => {
    setSaving(true); setError(''); setMessage('')
    try {
      await updateMilestoneStatus(id, status)
      setMessage('Marco actualizado.')
      await refresh(selected.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!workspace) return <main className="dashboard"><div className="empty">A carregar os contratos…</div></main>
  if (!workspace.organization) return <main className="dashboard"><div className="empty"><h2>Sem organização associada</h2></div></main>

  return <main className="dashboard">
    <div className="headline">
      <div><h1>Contratos</h1><p>Controle contratos, ordens de compra, entregas e pagamentos.</p></div>
      <button className="primary compact" onClick={() => { setShowForm(!showForm); setSelected(null) }}>{showForm ? 'Fechar' : '+ Novo contrato'}</button>
    </div>
    {message && <p className="alert success">{message}</p>}
    {error && <p className="alert error">{error}</p>}

    {showForm && <form className="card procurement-form" onSubmit={submit}>
      <div className="card-title"><div><h3>Novo documento contratual</h3><p>Ligue a contratação ao processo e ao fornecedor seleccionado.</p></div></div>
      <div className="form-pair">
        <label>Tipo<select value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}><option value="contract">Contrato</option><option value="purchase_order">Ordem de compra</option></select></label>
        <label>Estado inicial<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="draft">Rascunho</option></select></label>
        <label className="span-two">Título<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
        <label>Processo<select value={form.process_id} onChange={e => setForm({ ...form, process_id: e.target.value })}><option value="">Sem processo associado</option>{workspace.processes.map(item => <option key={item.id} value={item.id}>{item.reference} · {item.title}</option>)}</select></label>
        <label>Fornecedor<select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} required><option value="">Seleccione</option>{workspace.suppliers.map(item => <option key={item.id} value={item.id}>{item.trading_name || item.legal_name}</option>)}</select></label>
        <label>Valor total<input type="number" min="0" step="0.01" value={form.total_value} onChange={e => setForm({ ...form, total_value: e.target.value })} required /></label>
        <label>Moeda<select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}><option>MZN</option><option>USD</option><option>EUR</option><option>ZAR</option></select></label>
        <label>Data de início<input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></label>
        <label>Data de término<input type="date" min={form.start_date} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></label>
        <label className="span-two">Objecto e condições<textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      </div>
      {workspace.suppliers.length === 0 && <p className="form-warning">É necessário pré‑qualificar pelo menos um fornecedor antes de criar o contrato.</p>}
      <button className="primary compact" disabled={saving || workspace.suppliers.length === 0}>{saving ? 'A registar…' : 'Registar documento'}</button>
    </form>}

    {!showForm && <section className="procurement-layout contract-layout">
      <div className="card process-list">
        <div className="process-toolbar">
          <div><h3>Documentos contratuais</h3><small>{workspace.contracts.length} documento(s)</small></div>
          <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
        </div>
        {visible.length === 0 && <div className="list-empty">Ainda não existem documentos neste estado.</div>}
        {visible.map(item => <button className={`process-row contract-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item)}>
          <div><b>{item.title}</b><small>{item.contract_number} · {item.suppliers?.trading_name || item.suppliers?.legal_name}</small></div>
          <strong>{money(item.total_value, item.currency)}</strong>
          <span className={`process-status contract-${item.status}`}>{statusLabels[item.status]}</span>
        </button>)}
      </div>

      <aside className="card process-detail contract-detail">
        {!selected ? <div className="detail-placeholder"><h3>Execução contratual</h3><p>Seleccione um contrato para acompanhar o seu cumprimento.</p></div> : <>
          <div className="detail-heading">
            <span className={`process-status contract-${selected.status}`}>{statusLabels[selected.status]}</span>
            <small>{selected.contract_number} · {selected.document_type === 'contract' ? 'Contrato' : 'Ordem de compra'}</small>
            <h2>{selected.title}</h2>
          </div>
          <dl>
            <div><dt>Fornecedor</dt><dd>{selected.suppliers?.trading_name || selected.suppliers?.legal_name}</dd></div>
            <div><dt>Valor total</dt><dd>{money(selected.total_value, selected.currency)}</dd></div>
            <div><dt>Vigência</dt><dd>{selected.start_date || '—'} a {selected.end_date || '—'}</dd></div>
            <div><dt>Processo</dt><dd>{selected.procurement_processes?.reference || 'Não associado'}</dd></div>
          </dl>
          {selected.description && <p className="detail-description">{selected.description}</p>}
          {(() => {
            const approval = workspace.approvals.find(item => item.contract_id === selected.id)
            const notification = workspace.notifications.find(item => item.contract_id === selected.id)
            return <div className="contract-approval">
              <h3>Notificação de adjudicação</h3>
              {!notification && selected.status === 'draft' && <><p>Registe o envio da notificação ao fornecedor antes de iniciar a aprovação contratual.</p><button className="primary compact" onClick={notifyAward} disabled={saving || !selected.process_id}>{saving ? 'A registar…' : 'Registar notificação enviada'}</button></>}
              {notification && <div className="award-notification">
                <p><b>{notification.notification_reference}</b><br />Enviada em {new Date(notification.notified_at).toLocaleString('pt-MZ')}<br />Prazo de reclamação: {new Date(`${notification.complaint_deadline}T00:00:00`).toLocaleDateString('pt-MZ')}</p>
                {notification.response_status === 'pending' && <><label>Observação da resposta<textarea rows="2" value={responseNotes} onChange={e => setResponseNotes(e.target.value)} placeholder="Referência da carta ou motivo de rejeição" /></label><div className="decision-actions"><button className="decision-reject" onClick={() => saveAwardResponse(notification, 'rejected')} disabled={saving}>Registar rejeição</button><button className="primary compact" onClick={() => saveAwardResponse(notification, 'accepted')} disabled={saving}>Registar aceitação</button></div></>}
                {notification.response_status === 'accepted' && <p className="alert success">Fornecedor aceitou a adjudicação.</p>}
                {notification.response_status === 'rejected' && <p className="alert error">Fornecedor rejeitou a adjudicação. {notification.response_notes}</p>}
              </div>}
              {approval?.status === 'pending' && <p className="form-warning">Aprovação em curso · nível {approval.current_level} de {approval.required_levels}</p>}
              {approval?.status === 'approved' && <p className="alert success">Documento aprovado e pronto para assinatura.</p>}
              {approval?.status === 'changes_requested' && <p className="form-warning">Foram solicitadas alterações. Reveja o documento e volte a submeter.</p>}
              {selected.status === 'draft' && notification?.response_status === 'accepted' && approval?.status !== 'pending' && <button className="primary compact" onClick={requestApproval} disabled={saving}>{saving ? 'A submeter…' : 'Submeter à aprovação'}</button>}
            </div>
          })()}
          {(() => {
            const signing = workspace.signatures.find(item => item.contract_id === selected.id)
            if (!signing || !['pending_signature', 'active'].includes(selected.status)) return null
            const overdue = selected.status === 'pending_signature' && new Date(`${signing.issuance_deadline}T23:59:59`) < new Date()
            return <div className="contract-approval signature-panel">
              <h3>Assinaturas e activação</h3>
              <p className={overdue ? 'alert error' : 'form-warning'}>Prazo de emissão: {new Date(`${signing.issuance_deadline}T00:00:00`).toLocaleDateString('pt-MZ')}{overdue ? ' · Em atraso' : ''}</p>
              <p>Organização: <b>{signing.organization_signed_at ? `Assinado por ${signing.organization_signatory_name}` : 'Pendente'}</b><br />Fornecedor: <b>{signing.supplier_signed_at ? `Assinado por ${signing.supplier_signatory_name}` : 'Pendente'}</b></p>
              {selected.status === 'pending_signature' && <form onSubmit={saveSignature}>
                <label>Parte<select value={signature.party} onChange={e => setSignature({ ...signature, party: e.target.value })}><option value="organization" disabled={Boolean(signing.organization_signed_at)}>Organização</option><option value="supplier" disabled={Boolean(signing.supplier_signed_at)}>Fornecedor</option></select></label>
                <label>Nome do signatário<input value={signature.signatoryName} onChange={e => setSignature({ ...signature, signatoryName: e.target.value })} required /></label>
                <label>Referência do comprovativo<input value={signature.evidenceReference} onChange={e => setSignature({ ...signature, evidenceReference: e.target.value })} placeholder="Ex.: assinatura digital, carta ou ficheiro" required /></label>
                <button className="primary compact" disabled={saving}>{saving ? 'A registar…' : 'Registar assinatura'}</button>
              </form>}
              {selected.status === 'active' && <p className="alert success">Documento integralmente assinado e activo desde {new Date(signing.activated_at).toLocaleString('pt-MZ')}.</p>}
            </div>
          })()}
          <label>Estado do contrato<select value={selected.status} onChange={e => changeStatus(e.target.value)} disabled={saving || workspace.approvals.some(item => item.contract_id === selected.id && item.status === 'pending')}>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>

          <div className="milestone-section">
            <h3>Entregas e pagamentos</h3>
            {selected.contract_milestones.length === 0 && <p>Ainda não existem marcos definidos.</p>}
            {[...selected.contract_milestones].sort((a, b) => a.due_date.localeCompare(b.due_date)).map(item => <div className="milestone-row" key={item.id}>
              <div><b>{item.title}</b><small>{item.due_date} · {money(item.amount, selected.currency)}</small></div>
              <select value={item.status} onChange={e => changeMilestone(item.id, e.target.value)} disabled={saving}>{Object.entries(milestoneLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
            </div>)}
            <form className="milestone-form" onSubmit={addMilestone}>
              <input value={milestone.title} onChange={e => setMilestone({ ...milestone, title: e.target.value })} placeholder="Novo marco" required />
              <input type="date" value={milestone.due_date} onChange={e => setMilestone({ ...milestone, due_date: e.target.value })} required />
              <input type="number" min="0" step="0.01" value={milestone.amount} onChange={e => setMilestone({ ...milestone, amount: e.target.value })} placeholder="Valor" />
              <button className="primary compact" disabled={saving}>Adicionar</button>
            </form>
          </div>
          {selected.status === 'active' && (() => {
            const deliveries = workspace.deliveries.filter(item => item.contract_id === selected.id)
            const invoices = workspace.invoices.filter(item => item.contract_id === selected.id)
            return <div className="milestone-section execution-section">
              <h3>Correspondência tripla</h3>
              <p>Valide Contrato/OC, entrega aceite e factura antes de solicitar o pagamento.</p>
              <form className="milestone-form" onSubmit={saveDelivery}>
                <select value={delivery.milestoneId} onChange={e => setDelivery({ ...delivery, milestoneId: e.target.value })}><option value="">Entrega geral</option>{selected.contract_milestones.filter(item => item.status !== 'completed').map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select>
                <input value={delivery.reference} onChange={e => setDelivery({ ...delivery, reference: e.target.value })} placeholder="Guia/Form H/Certificado" required />
                <input type="date" value={delivery.date} onChange={e => setDelivery({ ...delivery, date: e.target.value })} required />
                <input value={delivery.notes} onChange={e => setDelivery({ ...delivery, notes: e.target.value })} placeholder="Observações da aceitação" />
                <button className="primary compact" disabled={saving}>Aceitar entrega</button>
              </form>
              {deliveries.map(item => <div className="milestone-row" key={item.id}><div><b>Entrega aceite · {item.delivery_reference}</b><small>{item.delivery_date} · {item.acceptance_notes || 'Sem observações'}</small></div><span className="process-status contract-active">Aceite</span></div>)}

              {deliveries.length > 0 && workspace.financeProjects.length > 0 && <form className="procurement-form" onSubmit={saveInvoice}>
                <h3>Registar factura e solicitar pagamento</h3>
                <div className="form-pair">
                  <label>Entrega<select required value={invoice.deliveryId} onChange={e => setInvoice({ ...invoice, deliveryId: e.target.value })}><option value="">Seleccione</option>{deliveries.map(item => <option value={item.id} key={item.id}>{item.delivery_reference}</option>)}</select></label>
                  <label>Projecto financeiro<select required value={invoice.projectId} onChange={e => setInvoice({ ...invoice, projectId: e.target.value })}><option value="">Seleccione</option>{workspace.financeProjects.map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
                  <label>N.º da factura<input required value={invoice.number} onChange={e => setInvoice({ ...invoice, number: e.target.value })} /></label>
                  <label>Data da factura<input required type="date" value={invoice.date} onChange={e => setInvoice({ ...invoice, date: e.target.value })} /></label>
                  <label>Valor<input required type="number" min="0.01" step="0.01" value={invoice.amount} onChange={e => setInvoice({ ...invoice, amount: e.target.value })} /></label>
                  <label>Taxa de câmbio<input required type="number" min="0.000001" step="0.000001" value={invoice.exchangeRate} onChange={e => setInvoice({ ...invoice, exchangeRate: e.target.value })} /></label>
                </div>
                <button className="primary compact" disabled={saving}>Validar e submeter pagamento</button>
              </form>}
              {deliveries.length > 0 && workspace.financeProjects.length === 0 && <p className="form-warning">Crie primeiro um projecto no módulo Financeiro para submeter a factura.</p>}
              {invoices.map(item => <div className="milestone-row" key={item.id}><div><b>Factura {item.invoice_number} · {money(item.amount, item.currency)}</b><small>{item.status === 'pending_approval' ? 'Aguarda aprovação financeira' : item.status === 'approved' ? 'Aprovada para pagamento' : item.status === 'paid' ? `Paga · ${item.payment_reference}` : 'Rejeitada'}</small></div>{item.status === 'approved' ? <div><input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Referência bancária" /><button className="primary compact" onClick={() => savePayment(item.id)} disabled={saving}>Marcar paga</button></div> : <span className="process-status">{item.status}</span>}</div>)}
            </div>
          })()}
        </>}
      </aside>
    </section>}
  </main>
}
